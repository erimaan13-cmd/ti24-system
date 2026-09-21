/**
 * Prueba de integración contra Postgres real (TEST_DATABASE_URL).
 * Flujo P0 completo + pruebas negativas de reglas y de RLS.
 * Si no hay TEST_DATABASE_URL, se omite (p. ej., en Vercel).
 */
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { LeadSubmission } from '@ti24/contracts';
import {
  addActivity,
  addProposalItem,
  asUser,
  changeStage,
  convertLead,
  createProposal,
  dashboard,
  DomainError,
  getAccount360,
  getProposal,
  intakeLead,
  listAudit,
  listLeads,
  recordEvents,
  setLeadStatus,
  transitionProposal,
  updateProposalItem,
  type Actor,
} from '../src';

const url = process.env.TEST_DATABASE_URL;
const T = '00000000-0000-0000-0000-000000000001';
const admin: Actor = { id: '00000000-0000-0000-0000-0000000000aa', tenantId: T, role: 'admin', fullName: 'Admin Demo', email: 'admin@ti24.example' };
const sales: Actor = { id: '00000000-0000-0000-0000-0000000000bb', tenantId: T, role: 'sales', fullName: 'Ventas Demo', email: 'ventas@ti24.example' };

const ANON = '20000000-0000-4000-8000-000000000001';
const SESSION = '10000000-0000-4000-8000-000000000001';

function submission(over: Partial<LeadSubmission> = {}, fields: Partial<LeadSubmission['fields']> = {}): LeadSubmission {
  const touch = {
    utm_source: null, utm_medium: null, utm_campaign: null, utm_content: null, utm_term: null,
    referrer: 'https://www.google.com/', landing_path: '/desarrollo-de-software', click_ids: {}, ref_code: null,
    occurred_at: '2026-09-21T15:00:00.000Z',
  };
  return {
    event_id: crypto.randomUUID(),
    form_id: 'diagnostico',
    lang: 'es',
    anonymous_id: ANON,
    session_id: SESSION,
    page_path: '/diagnostico',
    first_touch: touch,
    last_touch: touch,
    website: '',
    turnstile_token: null,
    fields: {
      full_name: 'Contacto Demo', email: 'compras@aceros-demo.example', company: 'Aceros Demo SA de CV',
      service_code: 'SYS', message: 'Necesitamos un sistema de cotizaciones.', phone: null, company_size: '10-49',
      privacy_accepted: true, marketing_consent: false, ...fields,
    },
    ...over,
  };
}

describe.skipIf(!url)('flujo P0 contra Postgres', () => {
  let sql: postgres.Sql;
  let leadId = '';
  let oppId = '';
  let proposalId = '';
  let accountId = '';

  beforeAll(() => {
    execFileSync('node', [join(__dirname, '../../../scripts/migrate.mjs'), '--reset', '--seed'], {
      env: { ...process.env, DATABASE_URL: url },
      stdio: 'pipe',
    });
    sql = postgres(url!, { max: 3, prepare: false, onnotice: () => {} });
  });
  afterAll(async () => { await sql?.end(); });

  it('1. eventos anónimos: se registran y un event_id repetido no entra dos veces', async () => {
    const ev = {
      event_id: crypto.randomUUID(), event_name: 'SERVICE_VIEWED' as const, schema_version: 1 as const,
      occurred_at: '2026-09-21T14:59:00.000Z', anonymous_id: ANON, session_id: SESSION, contact_ref: null,
      page: { path: '/desarrollo-de-software', title: null, referrer: 'https://www.google.com/' },
      attribution: submission().first_touch, service_code: 'SYS' as const, metadata: {},
    };
    expect(await recordEvents(T, { events: [ev] }, { device: 'mobile' }, sql)).toEqual({ accepted: 1, duplicates: 0 });
    expect(await recordEvents(T, { events: [ev] }, { device: 'mobile' }, sql)).toEqual({ accepted: 0, duplicates: 1 });
    const [s] = await sql`select source, medium from web_sessions where id = ${SESSION}`;
    expect(s).toMatchObject({ source: 'google', medium: 'organic' });
  });

  it('2. formulario → lead con first_touch_source=google; repetir el envío no duplica', async () => {
    const sub = submission();
    const r = await intakeLead(T, sub, { device: 'mobile' }, sql);
    expect(r.status).toBe('created');
    leadId = r.lead_id;
    expect(await intakeLead(T, sub, { device: 'mobile' }, sql)).toEqual({ status: 'replayed', lead_id: leadId });
    const [l] = await sql`select l.status, t.source, t.medium, t.landing_path from leads l join touches t on t.id = l.first_touch_id where l.id = ${leadId}`;
    expect(l).toMatchObject({ status: 'new', source: 'google', medium: 'organic', landing_path: '/desarrollo-de-software' });
    const events = await sql`select event_name from web_events where anonymous_id = ${ANON} order by occurred_at`;
    expect(events.map((e) => e.event_name)).toEqual(expect.arrayContaining(['SERVICE_VIEWED', 'FORM_SUBMITTED', 'DIAGNOSTIC_REQUESTED']));
  });

  it('3. mismo correo con otra capitalización → lead duplicado ligado al original', async () => {
    const r = await intakeLead(T, submission({}, { email: 'COMPRAS@aceros-demo.example', service_code: 'MNT' }), { device: null }, sql);
    expect(r.status).toBe('duplicate');
    const [d] = await sql`select duplicate_of from leads where id = ${r.lead_id}`;
    expect(d!.duplicate_of).toBe(leadId);
  });

  it('4. no se puede convertir un lead sin calificar; ventas lo califica y lo convierte', async () => {
    await expect(convertLead(sales, leadId, { accountName: '', opportunityTitle: 'Sistema de cotizaciones', services: ['SYS'] }, sql)).rejects.toThrow(DomainError);
    await addActivity(sales, { leadId }, { kind: 'call', subject: 'Llamada de diagnóstico' }, sql);
    const [st] = await sql`select status from leads where id = ${leadId}`;
    expect(st!.status).toBe('contacted');
    await setLeadStatus(sales, leadId, 'qualified', {}, sql);
    const r = await convertLead(sales, leadId, { accountName: 'Aceros Demo SA de CV', opportunityTitle: 'Sistema de cotizaciones', services: ['SYS', 'MNT'] }, sql);
    oppId = r.opportunityId;
    accountId = r.accountId;
    const [o] = await sql`select stage_code, first_touch_source, first_touch_landing from opportunities where id = ${oppId}`;
    expect(o).toMatchObject({ stage_code: 'discovery', first_touch_source: 'google', first_touch_landing: '/desarrollo-de-software' });
    const [a] = await sql`select domain, is_demo, lifecycle from accounts where id = ${accountId}`;
    expect(a).toMatchObject({ domain: 'aceros-demo.example', is_demo: true, lifecycle: 'prospect' });
  });

  it('5. un segundo lead del mismo dominio sugiere la cuenta existente', async () => {
    const r = await intakeLead(T, submission({ event_id: crypto.randomUUID() }, { email: 'direccion@aceros-demo.example', full_name: 'Dirección Demo' }), { device: null }, sql);
    const [l] = await sql`select status, suggested_account_id from leads where id = ${r.lead_id}`;
    expect(l).toMatchObject({ status: 'new', suggested_account_id: accountId });
  });

  it('6. ganar sin propuesta aceptada se rechaza; perder sin motivo se rechaza', async () => {
    await expect(changeStage(sales, oppId, 'won', {}, sql)).rejects.toThrow('Para ganar se necesita una propuesta aceptada.');
    await expect(changeStage(sales, oppId, 'lost', {}, sql)).rejects.toThrow('motivo');
  });

  it('7. propuesta: borrador con precios → enviada (la oportunidad pasa a Propuesta) → aceptada', async () => {
    const p = await createProposal(sales, oppId, {}, sql);
    proposalId = p.id;
    expect(p.folio).toMatch(/^TI24-\d{4}-0001$/);
    await expect(transitionProposal(sales, proposalId, 'sent', sql)).rejects.toThrow('línea con precio');
    const detail = await getProposal(sales, proposalId, sql);
    const sys = detail!.items.find((i) => i.service_code === 'SYS')!;
    const mnt = detail!.items.find((i) => i.service_code === 'MNT')!;
    expect(mnt.billing).toBe('monthly');
    await updateProposalItem(sales, proposalId, sys.id, { quantity: 1, unit_price: 100000, description: 'Desarrollo del sistema' }, sql);
    await updateProposalItem(sales, proposalId, mnt.id, { quantity: 1, unit_price: 2000, description: 'Mantenimiento mensual' }, sql);
    await addProposalItem(sales, proposalId, { service_code: 'SYS', description: 'Capacitación de arranque', quantity: 1, unit_price: 20000, billing: 'one_time' }, sql);
    await transitionProposal(sales, proposalId, 'sent', sql);
    const [o1] = await sql`select stage_code from opportunities where id = ${oppId}`;
    expect(o1!.stage_code).toBe('proposal');
    await expect(updateProposalItem(sales, proposalId, sys.id, { quantity: 2, unit_price: 1, description: 'x' }, sql)).rejects.toThrow('borrador');
    await transitionProposal(sales, proposalId, 'accepted', sql);
    const [o2] = await sql`select amount::float8 as amount from opportunities where id = ${oppId}`;
    expect(o2!.amount).toBe(120000);
  });

  it('8. ganar → crea el proyecto, la cuenta queda como cliente; reporte canal → ingreso', async () => {
    const r = await changeStage(sales, oppId, 'won', {}, sql);
    expect(r.projectId).toBeTruthy();
    const view = await getAccount360(sales, accountId, sql);
    expect(view!.account.lifecycle).toBe('customer');
    expect(view!.projects).toHaveLength(1);
    expect(view!.services.map((s) => `${s.service_code}:${s.status}`)).toEqual(['MNT:contratado', 'SYS:contratado']);
    const d = await dashboard(sales, null, sql);
    expect(d.revenueByChannel).toEqual([{ source: 'google', won: 1, value: 120000 }]);
    expect(d.winRate.sufficient).toBe(false); // 1 cerrada < 5: «datos insuficientes»
    await expect(changeStage(sales, oppId, 'negotiation', {}, sql)).rejects.toThrow('cerrada');
  });

  // ─── Negativas de seguridad (RLS real: el CRM corre como rol authenticated) ───
  it('9. ventas no puede borrar registros de negocio (RLS)', async () => {
    const deleted = await asUser(sales, (tx) => tx`delete from accounts where id = ${accountId}`, sql);
    expect(deleted.count).toBe(0);
    const [a] = await sql`select count(*)::int as n from accounts where id = ${accountId}`;
    expect(a!.n).toBe(1);
  });

  it('10. ventas no puede leer la auditoría; admin sí', async () => {
    await expect(listAudit(sales, 10, sql)).rejects.toThrow('administrador');
    const rows = await asUser(sales, (tx) => tx`select id from audit_events`, sql);
    expect(rows).toHaveLength(0);
    const adminRows = await listAudit(admin, 500, sql);
    const actions = adminRows.map((r) => r.action);
    for (const a of ['lead.created', 'lead.converted', 'opportunity.created', 'proposal.sent', 'proposal.accepted', 'opportunity.won', 'project.created'])
      expect(actions).toContain(a);
  });

  it('11. la auditoría es solo de agregar, incluso para el dueño de la base', async () => {
    await expect(sql`update audit_events set action = 'x'`).rejects.toThrow('append-only');
    await expect(sql`delete from audit_events`).rejects.toThrow('append-only');
  });

  it('12. aislamiento entre inquilinos: otro tenant no ve nada de TI24', async () => {
    const T2 = '00000000-0000-0000-0000-000000000002';
    const other = '00000000-0000-0000-0000-0000000000cc';
    await sql`insert into tenants (id, name) values (${T2}, 'Otro') on conflict do nothing`;
    await sql`insert into app_users (id, tenant_id, full_name, email, role) values (${other}, ${T2}, 'Otro', 'otro@x.example', 'admin') on conflict do nothing`;
    const actor: Actor = { id: other, tenantId: T2, role: 'admin', fullName: 'Otro', email: 'otro@x.example' };
    expect(await listLeads(actor, { status: 'all' }, sql)).toHaveLength(0);
    await expect(asUser(actor, (tx) => tx`insert into accounts (tenant_id, name) values (${T}, 'Intrusa')`, sql)).rejects.toThrow(/row-level security/);
  });

  it('13. la base rechaza un formulario sin aviso de privacidad y un correo de contacto repetido', async () => {
    await expect(sql`insert into form_submissions (tenant_id, form_id, payload, privacy_accepted) values (${T}, 'diagnostico', '{}', false)`).rejects.toThrow();
    await expect(sql`insert into contacts (tenant_id, full_name, email) values (${T}, 'X', 'COMPRAS@ACEROS-DEMO.EXAMPLE')`).rejects.toThrow(/contacts_email_uq/);
  });
});
