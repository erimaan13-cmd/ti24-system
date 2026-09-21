/** Bandeja de leads, cambio de estado y conversión a cuenta + contacto + oportunidad. */
import {
  canConvertLead,
  canTransitionLead,
  corporateDomain,
  type LeadStatus,
} from '@ti24/domain';
import type { ServiceCode } from '@ti24/contracts';
import { asUser, audit, DomainError, type Actor, type Sql } from './client';

export interface LeadRow {
  id: string;
  status: LeadStatus;
  intent: string;
  full_name: string;
  email: string;
  phone: string | null;
  company: string | null;
  service_code: string | null;
  message: string | null;
  company_size: string | null;
  marketing_consent: boolean;
  duplicate_of: string | null;
  suggested_account_id: string | null;
  suggested_account_name: string | null;
  converted_account_id: string | null;
  disqualified_reason: string | null;
  first_response_due_at: Date | null;
  created_at: Date;
  source: string | null;
  medium: string | null;
  landing_path: string | null;
  owner_name: string | null;
}

export interface LeadFilters {
  status?: LeadStatus | 'open' | 'all';
  q?: string;
  source?: string;
}

const leadSelect = (tx: import('./client').Tx) => tx`
  select l.id, l.status, l.intent, l.full_name, l.email, l.phone, l.company, l.service_code, l.message,
         l.company_size, l.marketing_consent, l.duplicate_of, l.suggested_account_id, sa.name as suggested_account_name,
         l.converted_account_id, l.disqualified_reason, l.first_response_due_at, l.created_at,
         ft.source, ft.medium, ft.landing_path, u.full_name as owner_name
  from leads l
  left join touches ft on ft.id = l.first_touch_id
  left join accounts sa on sa.id = l.suggested_account_id
  left join app_users u on u.id = l.owner_id`;

export async function listLeads(actor: Actor, f: LeadFilters = {}, sql?: Sql): Promise<LeadRow[]> {
  const status = f.status ?? 'open';
  const q = f.q?.trim();
  return asUser(actor, (tx) => tx<LeadRow[]>`
    ${leadSelect(tx)}
    where true
    ${status === 'open' ? tx`and l.status in ('new','contacted','qualified')` : status === 'all' ? tx`` : tx`and l.status = ${status}`}
    ${q ? tx`and (l.full_name ilike ${'%' + q + '%'} or l.email ilike ${'%' + q + '%'} or l.company ilike ${'%' + q + '%'})` : tx``}
    ${f.source ? tx`and ft.source = ${f.source}` : tx``}
    order by l.created_at desc
    limit 200`, sql);
}

export async function getLead(actor: Actor, id: string, sql?: Sql) {
  return asUser(actor, async (tx) => {
    const [lead] = await tx<LeadRow[]>`${leadSelect(tx)} where l.id = ${id}`;
    if (!lead) return null;
    const touches = await tx<{ id: string; occurred_at: Date; source: string; medium: string; platform: string | null; campaign: string | null; landing_path: string | null; referrer: string | null; ref_code: string | null }[]>`
      select t.id, t.occurred_at, t.source, t.medium, t.platform, t.campaign, t.landing_path, t.referrer, t.ref_code
      from touches t where t.id in (select first_touch_id from leads where id = ${id} union select last_touch_id from leads where id = ${id})
      order by t.occurred_at`;
    const events = await tx<{ event_name: string; occurred_at: Date; page_path: string | null; service_code: string | null }[]>`
      select e.event_name, e.occurred_at, e.page_path, e.service_code from web_events e
      join form_submissions f on f.anonymous_id = e.anonymous_id
      join leads l on l.form_submission_id = f.id
      where l.id = ${id} order by e.occurred_at limit 50`;
    const duplicates = await tx<{ id: string; created_at: Date; service_code: string | null }[]>`
      select id, created_at, service_code from leads where duplicate_of = ${id} order by created_at`;
    return { lead, touches, events, duplicates };
  }, sql);
}

export async function setLeadStatus(
  actor: Actor,
  id: string,
  to: LeadStatus,
  opts: { reason?: string | null } = {},
  sql?: Sql,
) {
  return asUser(actor, async (tx) => {
    const [lead] = await tx<{ status: LeadStatus; owner_id: string | null }[]>`select status, owner_id from leads where id = ${id} for update`;
    if (!lead) throw new DomainError('Lead no encontrado.');
    if (to === 'converted') throw new DomainError('Usa «Convertir» para convertir un lead.');
    if (!canTransitionLead(lead.status, to)) throw new DomainError(`No se puede pasar de «${lead.status}» a «${to}».`);
    const reason = opts.reason?.trim() || null;
    if (to === 'disqualified' && (!reason || reason.length < 3)) throw new DomainError('Escribe el motivo de descalificación.');
    await tx`update leads set status = ${to},
               disqualified_reason = ${to === 'disqualified' ? reason : null},
               owner_id = coalesce(owner_id, ${actor.id})
             where id = ${id}`;
    await audit(tx, { tenantId: actor.tenantId, actorId: actor.id }, 'lead.status_changed', 'lead', id, { status: lead.status }, { status: to, reason });
  }, sql);
}

export interface ConvertLeadInput {
  accountName: string;
  opportunityTitle: string;
  services: ServiceCode[];
  amount?: number | null;
  useSuggestedAccount?: boolean;
}

/** Lead calificado → Cuenta (existente por dominio o nueva) + Contacto + Oportunidad con atribución congelada. */
export async function convertLead(actor: Actor, id: string, input: ConvertLeadInput, sql?: Sql) {
  if (input.services.length === 0) throw new DomainError('Elige al menos un servicio.');
  if (input.opportunityTitle.trim().length < 3) throw new DomainError('Escribe un título para la oportunidad.');
  return asUser(actor, async (tx) => {
    const [lead] = await tx<{
      status: LeadStatus; full_name: string; email: string; phone: string | null; company: string | null;
      marketing_consent: boolean; suggested_account_id: string | null; first_touch_id: string | null; last_touch_id: string | null;
    }[]>`select status, full_name, email, phone, company, marketing_consent, suggested_account_id, first_touch_id, last_touch_id
         from leads where id = ${id} for update`;
    if (!lead) throw new DomainError('Lead no encontrado.');
    if (!canConvertLead(lead.status)) throw new DomainError('Solo se convierte un lead calificado. Márcalo como «calificado» primero.');

    // Cuenta: sugerida por dominio → existente por dominio → nueva
    const domain = corporateDomain(lead.email);
    let accountId: string | null = null;
    if (input.useSuggestedAccount && lead.suggested_account_id) accountId = lead.suggested_account_id;
    if (!accountId && domain) {
      const [acc] = await tx<{ id: string }[]>`select id from accounts where lower(domain) = ${domain} limit 1`;
      accountId = acc?.id ?? null;
    }
    let accountCreated = false;
    if (!accountId) {
      const name = input.accountName.trim() || lead.company || lead.full_name;
      const isDemo = /demo/i.test(name) || (domain?.endsWith('.example') ?? false);
      const [acc] = await tx<{ id: string }[]>`
        insert into accounts (tenant_id, name, domain, is_demo) values (${actor.tenantId}, ${name}, ${domain}, ${isDemo}) returning id`;
      accountId = acc!.id;
      accountCreated = true;
    }

    // Contacto: existente por correo → nuevo
    const [existingContact] = await tx<{ id: string }[]>`select id from contacts where lower(email) = ${lead.email.toLowerCase()} limit 1`;
    const contactId =
      existingContact?.id ??
      (
        await tx<{ id: string }[]>`
          insert into contacts (tenant_id, account_id, full_name, email, phone, marketing_consent)
          values (${actor.tenantId}, ${accountId}, ${lead.full_name}, ${lead.email}, ${lead.phone}, ${lead.marketing_consent})
          returning id`
      )[0]!.id;

    // Oportunidad con atribución congelada
    const [ft] = lead.first_touch_id ? await tx<{ source: string; medium: string; campaign: string | null; landing_path: string | null }[]>`select source, medium, campaign, landing_path from touches where id = ${lead.first_touch_id}` : [];
    const [lt] = lead.last_touch_id ? await tx<{ source: string; medium: string; campaign: string | null; landing_path: string | null }[]>`select source, medium, campaign, landing_path from touches where id = ${lead.last_touch_id}` : [];
    const [opp] = await tx<{ id: string }[]>`
      insert into opportunities (tenant_id, account_id, primary_contact_id, lead_id, title, stage_code, amount, owner_id,
        first_touch_source, first_touch_medium, first_touch_campaign, first_touch_landing,
        last_touch_source, last_touch_medium, last_touch_campaign, last_touch_landing)
      values (${actor.tenantId}, ${accountId}, ${contactId}, ${id}, ${input.opportunityTitle.trim()}, 'discovery',
        ${input.amount ?? null}, ${actor.id},
        ${ft?.source ?? 'direct'}, ${ft?.medium ?? 'none'}, ${ft?.campaign ?? null}, ${ft?.landing_path ?? null},
        ${lt?.source ?? ft?.source ?? 'direct'}, ${lt?.medium ?? ft?.medium ?? 'none'}, ${lt?.campaign ?? null}, ${lt?.landing_path ?? null})
      returning id`;
    for (const code of new Set(input.services)) {
      await tx`insert into opportunity_services (opportunity_id, tenant_id, service_code) values (${opp!.id}, ${actor.tenantId}, ${code})`;
    }

    await tx`update leads set status = 'converted', converted_account_id = ${accountId}, converted_contact_id = ${contactId},
               owner_id = coalesce(owner_id, ${actor.id}) where id = ${id}`;
    const a = { tenantId: actor.tenantId, actorId: actor.id };
    if (accountCreated) await audit(tx, a, 'account.created', 'account', accountId, null, { from_lead: id });
    if (!existingContact) await audit(tx, a, 'contact.created', 'contact', contactId, null, { from_lead: id });
    await audit(tx, a, 'opportunity.created', 'opportunity', opp!.id, null, { services: input.services, source: ft?.source ?? 'direct' });
    await audit(tx, a, 'lead.converted', 'lead', id, { status: 'qualified' }, { status: 'converted', account_id: accountId, opportunity_id: opp!.id });
    return { accountId, contactId, opportunityId: opp!.id };
  }, sql);
}
