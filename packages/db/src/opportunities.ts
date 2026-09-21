/** Pipeline: lista con filtros, detalle, cambio de etapa, ganar → proyecto. */
import {
  shouldCreateProject,
  validateStageChange,
  type RevenueModel,
  type StageCode,
} from '@ti24/domain';
import type { ServiceCode } from '@ti24/contracts';
import { asUser, audit, DomainError, type Actor, type Sql } from './client';

export interface OpportunityRow {
  id: string;
  title: string;
  stage_code: StageCode;
  type: string;
  amount: number | null;
  currency: 'MXN' | 'USD';
  expected_close: Date | null;
  lost_reason: string | null;
  account_id: string;
  account_name: string;
  is_demo: boolean;
  first_touch_source: string | null;
  first_touch_medium: string | null;
  first_touch_landing: string | null;
  last_touch_source: string | null;
  last_touch_medium: string | null;
  owner_name: string | null;
  services: string[];
  closed_at: Date | null;
  created_at: Date;
  lead_id: string | null;
  primary_contact_id: string | null;
}

export interface OpportunityFilters {
  stage?: StageCode;
  service?: string;
  source?: string;
  from?: string; // YYYY-MM-DD
  to?: string;
  q?: string;
}

const oppSelect = (tx: import('./client').Tx) => tx`
  select o.id, o.title, o.stage_code, o.type, o.amount::float8 as amount, o.currency, o.expected_close, o.lost_reason,
         o.account_id, a.name as account_name, a.is_demo, o.first_touch_source, o.first_touch_medium, o.first_touch_landing,
         o.last_touch_source, o.last_touch_medium, u.full_name as owner_name,
         coalesce((select array_agg(os.service_code order by os.service_code) from opportunity_services os where os.opportunity_id = o.id), '{}') as services,
         o.closed_at, o.created_at, o.lead_id, o.primary_contact_id
  from opportunities o
  join accounts a on a.id = o.account_id
  left join app_users u on u.id = o.owner_id`;

export async function listOpportunities(actor: Actor, f: OpportunityFilters = {}, sql?: Sql): Promise<OpportunityRow[]> {
  const q = f.q?.trim();
  return asUser(actor, (tx) => tx<OpportunityRow[]>`
    ${oppSelect(tx)}
    where true
    ${f.stage ? tx`and o.stage_code = ${f.stage}` : tx``}
    ${f.service ? tx`and exists (select 1 from opportunity_services s where s.opportunity_id = o.id and s.service_code = ${f.service})` : tx``}
    ${f.source ? tx`and o.first_touch_source = ${f.source}` : tx``}
    ${f.from ? tx`and o.created_at >= ${f.from}::date` : tx``}
    ${f.to ? tx`and o.created_at < (${f.to}::date + 1)` : tx``}
    ${q ? tx`and (o.title ilike ${'%' + q + '%'} or a.name ilike ${'%' + q + '%'})` : tx``}
    order by o.created_at desc
    limit 300`, sql);
}

export async function getOpportunity(actor: Actor, id: string, sql?: Sql) {
  return asUser(actor, async (tx) => {
    const [opp] = await tx<OpportunityRow[]>`${oppSelect(tx)} where o.id = ${id}`;
    if (!opp) return null;
    const proposals = await tx<{ id: string; folio: string; status: string; created_at: Date; one_time: number; monthly: number }[]>`
      select p.id, p.folio, p.status, p.created_at,
             coalesce(sum(i.quantity * i.unit_price) filter (where i.billing = 'one_time'), 0)::float8 as one_time,
             coalesce(sum(i.quantity * i.unit_price) filter (where i.billing = 'monthly'), 0)::float8 as monthly
      from proposals p left join proposal_items i on i.proposal_id = p.id
      where p.opportunity_id = ${id} group by p.id order by p.created_at desc`;
    const [project] = await tx<{ id: string; name: string; status: string }[]>`select id, name, status from projects where opportunity_id = ${id}`;
    const [contact] = opp.primary_contact_id
      ? await tx<{ id: string; full_name: string; email: string | null; phone: string | null }[]>`select id, full_name, email, phone from contacts where id = ${opp.primary_contact_id}`
      : [];
    return { opp, proposals, project: project ?? null, contact: contact ?? null };
  }, sql);
}

export async function updateOpportunity(
  actor: Actor,
  id: string,
  patch: { amount?: number | null; expected_close?: string | null; title?: string },
  sql?: Sql,
) {
  return asUser(actor, async (tx) => {
    const [before] = await tx<{ amount: number | null; expected_close: Date | null; title: string; stage_code: StageCode }[]>`
      select amount::float8 as amount, expected_close, title, stage_code from opportunities where id = ${id} for update`;
    if (!before) throw new DomainError('Oportunidad no encontrada.');
    if (before.stage_code === 'won' || before.stage_code === 'lost') throw new DomainError('Una oportunidad cerrada no se edita.');
    if (patch.amount !== undefined && patch.amount !== null && !(patch.amount >= 0)) throw new DomainError('El monto no puede ser negativo.');
    await tx`update opportunities set
      amount = ${patch.amount === undefined ? before.amount : patch.amount},
      expected_close = ${patch.expected_close === undefined ? before.expected_close : patch.expected_close},
      title = ${patch.title?.trim() || before.title}
      where id = ${id}`;
    await audit(tx, { tenantId: actor.tenantId, actorId: actor.id }, 'opportunity.updated', 'opportunity', id, before, patch);
  }, sql);
}

export async function setOpportunityServices(actor: Actor, id: string, services: ServiceCode[], sql?: Sql) {
  if (services.length === 0) throw new DomainError('Elige al menos un servicio.');
  return asUser(actor, async (tx) => {
    const [o] = await tx<{ stage_code: StageCode }[]>`select stage_code from opportunities where id = ${id} for update`;
    if (!o) throw new DomainError('Oportunidad no encontrada.');
    if (o.stage_code === 'won' || o.stage_code === 'lost') throw new DomainError('Una oportunidad cerrada no se edita.');
    const before = (await tx<{ service_code: string }[]>`select service_code from opportunity_services where opportunity_id = ${id}`).map((r) => r.service_code);
    await tx`delete from opportunity_services where opportunity_id = ${id}`;
    for (const code of new Set(services)) {
      await tx`insert into opportunity_services (opportunity_id, tenant_id, service_code) values (${id}, ${actor.tenantId}, ${code})`;
    }
    await audit(tx, { tenantId: actor.tenantId, actorId: actor.id }, 'opportunity.services_changed', 'opportunity', id, { services: before }, { services });
  }, sql);
}

/** Cambia de etapa aplicando las reglas del dominio. «Ganada» crea el proyecto y vuelve cliente a la cuenta. */
export async function changeStage(actor: Actor, id: string, to: StageCode, opts: { lostReason?: string | null } = {}, sql?: Sql) {
  return asUser(actor, async (tx) => {
    const [o] = await tx<{ stage_code: StageCode; amount: number | null; account_id: string; title: string }[]>`
      select stage_code, amount::float8 as amount, account_id, title from opportunities where id = ${id} for update`;
    if (!o) throw new DomainError('Oportunidad no encontrada.');
    const [acc0] = await tx<{ accepted: boolean }[]>`
      select exists(select 1 from proposals where opportunity_id = ${id} and status = 'accepted') as accepted`;
    const accepted = acc0?.accepted ?? false;
    const errors = validateStageChange({ from: o.stage_code, to, lostReason: opts.lostReason, hasAcceptedProposal: accepted, amount: o.amount });
    if (errors.length) throw new DomainError(errors[0]!, errors);

    const closing = to === 'won' || to === 'lost';
    await tx`update opportunities set stage_code = ${to},
               lost_reason = ${to === 'lost' ? opts.lostReason!.trim() : null},
               closed_at = ${closing ? tx`now()` : null}
             where id = ${id}`;
    const a = { tenantId: actor.tenantId, actorId: actor.id };
    await audit(tx, a, 'opportunity.stage_changed', 'opportunity', id, { stage: o.stage_code }, { stage: to, lost_reason: opts.lostReason ?? null });

    let projectId: string | null = null;
    if (to === 'won') {
      const [acc] = await tx<{ lifecycle: string }[]>`select lifecycle from accounts where id = ${o.account_id} for update`;
      if (acc && acc.lifecycle !== 'customer') {
        await tx`update accounts set lifecycle = 'customer' where id = ${o.account_id}`;
        await audit(tx, a, 'account.lifecycle_changed', 'account', o.account_id, { lifecycle: acc.lifecycle }, { lifecycle: 'customer' });
      }
      const models = (await tx<{ revenue_model: RevenueModel }[]>`
        select s.revenue_model from opportunity_services os
        join services s on s.tenant_id = os.tenant_id and s.code = os.service_code
        where os.opportunity_id = ${id}`).map((r) => r.revenue_model);
      if (shouldCreateProject(models)) {
        const [p] = await tx<{ id: string }[]>`
          insert into projects (tenant_id, account_id, opportunity_id, name) values (${actor.tenantId}, ${o.account_id}, ${id}, ${o.title})
          on conflict (opportunity_id) do nothing returning id`;
        if (p) {
          projectId = p.id;
          await audit(tx, a, 'project.created', 'project', p.id, null, { opportunity_id: id });
        }
      }
      await audit(tx, a, 'opportunity.won', 'opportunity', id, null, { amount: o.amount, project_id: projectId });
    }
    return { projectId };
  }, sql);
}

export async function listProjects(actor: Actor, sql?: Sql) {
  return asUser(actor, (tx) => tx<{ id: string; name: string; status: string; account_id: string; account_name: string; opportunity_id: string; amount: number | null; created_at: Date; services: string[] }[]>`
    select p.id, p.name, p.status, p.account_id, a.name as account_name, p.opportunity_id, o.amount::float8 as amount, p.created_at,
           coalesce((select array_agg(os.service_code order by os.service_code) from opportunity_services os where os.opportunity_id = p.opportunity_id), '{}') as services
    from projects p join accounts a on a.id = p.account_id join opportunities o on o.id = p.opportunity_id
    order by p.created_at desc`, sql);
}
