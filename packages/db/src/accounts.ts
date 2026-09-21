/** Cuentas, ficha 360, actividades, tareas, dashboard y auditoría. */
import { leadToOpportunity, winRate } from '@ti24/domain';
import { asUser, audit, DomainError, type Actor, type Sql } from './client';

export async function listAccounts(actor: Actor, q?: string, sql?: Sql) {
  const term = q?.trim();
  return asUser(actor, (tx) => tx<{ id: string; name: string; domain: string | null; lifecycle: string; is_demo: boolean; open_opps: number; projects: number; created_at: Date }[]>`
    select a.id, a.name, a.domain, a.lifecycle, a.is_demo, a.created_at,
      (select count(*)::int from opportunities o where o.account_id = a.id and o.stage_code not in ('won','lost')) as open_opps,
      (select count(*)::int from projects p where p.account_id = a.id) as projects
    from accounts a
    where true ${term ? tx`and (a.name ilike ${'%' + term + '%'} or a.domain ilike ${'%' + term + '%'})` : tx``}
    order by a.created_at desc limit 200`, sql);
}

/** Ficha 360: todo lo que TI24 tiene con una cuenta (multiservicio, AT-11 §15.2). */
export async function getAccount360(actor: Actor, id: string, sql?: Sql) {
  return asUser(actor, async (tx) => {
    const [account] = await tx<{ id: string; name: string; domain: string | null; country: string | null; lifecycle: string; is_demo: boolean; created_at: Date }[]>`
      select id, name, domain, country, lifecycle, is_demo, created_at from accounts where id = ${id}`;
    if (!account) return null;
    const [contacts, opportunities, projects, proposals, activities, leads, services] = await Promise.all([
      tx<{ id: string; full_name: string; email: string | null; phone: string | null; job_title: string | null }[]>`
        select id, full_name, email, phone, job_title from contacts where account_id = ${id} order by full_name`,
      tx<{ id: string; title: string; stage_code: string; amount: number | null; currency: string; first_touch_source: string | null; created_at: Date }[]>`
        select id, title, stage_code, amount::float8 as amount, currency, first_touch_source, created_at from opportunities where account_id = ${id} order by created_at desc`,
      tx<{ id: string; name: string; status: string; created_at: Date }[]>`
        select id, name, status, created_at from projects where account_id = ${id} order by created_at desc`,
      tx<{ id: string; folio: string; status: string; opportunity_title: string }[]>`
        select p.id, p.folio, p.status, o.title as opportunity_title from proposals p join opportunities o on o.id = p.opportunity_id
        where o.account_id = ${id} order by p.created_at desc`,
      tx<{ id: string; kind: string; subject: string; body: string | null; occurred_at: Date; author: string | null }[]>`
        select a.id, a.kind, a.subject, a.body, a.occurred_at, u.full_name as author from activities a
        left join app_users u on u.id = a.created_by
        where a.account_id = ${id} or a.opportunity_id in (select id from opportunities where account_id = ${id})
           or a.lead_id in (select id from leads where converted_account_id = ${id})
        order by a.occurred_at desc limit 50`,
      tx<{ id: string; status: string; service_code: string | null; created_at: Date }[]>`
        select id, status, service_code, created_at from leads where converted_account_id = ${id} or suggested_account_id = ${id} order by created_at desc`,
      tx<{ service_code: string; status: string }[]>`
        select os.service_code, case when o.stage_code = 'won' then 'contratado' when o.stage_code = 'lost' then 'perdido' else 'en proceso' end as status
        from opportunity_services os join opportunities o on o.id = os.opportunity_id where o.account_id = ${id}
        group by 1, 2 order by 1`,
    ]);
    return { account, contacts, opportunities, projects, proposals, activities, leads, services };
  }, sql);
}

// ─── Actividades y tareas ──────────────────────────────────────────────
export type ActivityKind = 'call' | 'meeting' | 'email' | 'note' | 'whatsapp';
export interface ActivityTarget { leadId?: string | null; accountId?: string | null; opportunityId?: string | null }

export async function addActivity(actor: Actor, t: ActivityTarget, input: { kind: ActivityKind; subject: string; body?: string | null }, sql?: Sql) {
  if (input.subject.trim().length < 2) throw new DomainError('Escribe un asunto.');
  if (!t.leadId && !t.accountId && !t.opportunityId) throw new DomainError('La actividad debe ligarse a un lead, cuenta u oportunidad.');
  return asUser(actor, async (tx) => {
    const [row] = await tx<{ id: string }[]>`
      insert into activities (tenant_id, kind, subject, body, lead_id, account_id, opportunity_id, created_by)
      values (${actor.tenantId}, ${input.kind}, ${input.subject.trim()}, ${input.body?.trim() || null},
              ${t.leadId ?? null}, ${t.accountId ?? null}, ${t.opportunityId ?? null}, ${actor.id}) returning id`;
    // Registrar contacto con un lead nuevo lo pasa a «contactado»
    if (t.leadId && input.kind !== 'note') {
      const upd = await tx`update leads set status = 'contacted', owner_id = coalesce(owner_id, ${actor.id}) where id = ${t.leadId} and status = 'new'`;
      if (upd.count) await audit(tx, { tenantId: actor.tenantId, actorId: actor.id }, 'lead.status_changed', 'lead', t.leadId, { status: 'new' }, { status: 'contacted', reason: 'activity' });
    }
    await audit(tx, { tenantId: actor.tenantId, actorId: actor.id }, 'activity.created', 'activity', row!.id, null, { kind: input.kind, ...t });
    return row!.id;
  }, sql);
}

export async function listActivities(actor: Actor, t: ActivityTarget, sql?: Sql) {
  return asUser(actor, (tx) => tx<{ id: string; kind: string; subject: string; body: string | null; occurred_at: Date; author: string | null }[]>`
    select a.id, a.kind, a.subject, a.body, a.occurred_at, u.full_name as author from activities a
    left join app_users u on u.id = a.created_by
    where ${t.leadId ? tx`a.lead_id = ${t.leadId}` : t.opportunityId ? tx`a.opportunity_id = ${t.opportunityId}` : tx`a.account_id = ${t.accountId ?? null}`}
    order by a.occurred_at desc limit 100`, sql);
}

export async function addTask(actor: Actor, input: { title: string; dueAt: string; leadId?: string | null; opportunityId?: string | null; assigneeId?: string | null }, sql?: Sql) {
  if (input.title.trim().length < 2) throw new DomainError('Escribe la tarea.');
  if (Number.isNaN(Date.parse(input.dueAt))) throw new DomainError('Fecha de vencimiento no válida.');
  return asUser(actor, async (tx) => {
    const [row] = await tx<{ id: string }[]>`
      insert into tasks (tenant_id, title, due_at, assignee_id, lead_id, opportunity_id)
      values (${actor.tenantId}, ${input.title.trim()}, ${input.dueAt}, ${input.assigneeId ?? actor.id}, ${input.leadId ?? null}, ${input.opportunityId ?? null})
      returning id`;
    await audit(tx, { tenantId: actor.tenantId, actorId: actor.id }, 'task.created', 'task', row!.id, null, input);
    return row!.id;
  }, sql);
}

export async function completeTask(actor: Actor, id: string, sql?: Sql) {
  return asUser(actor, async (tx) => {
    const res = await tx`update tasks set done_at = now() where id = ${id} and done_at is null`;
    if (!res.count) throw new DomainError('La tarea no existe o ya estaba hecha.');
    await audit(tx, { tenantId: actor.tenantId, actorId: actor.id }, 'task.completed', 'task', id);
  }, sql);
}

export async function listTasks(actor: Actor, f: { open?: boolean; leadId?: string; opportunityId?: string; mine?: boolean } = {}, sql?: Sql) {
  return asUser(actor, (tx) => tx<{ id: string; title: string; due_at: Date; done_at: Date | null; lead_id: string | null; opportunity_id: string | null; assignee: string | null; context: string | null }[]>`
    select t.id, t.title, t.due_at, t.done_at, t.lead_id, t.opportunity_id, u.full_name as assignee,
           coalesce(o.title, l.full_name) as context
    from tasks t left join app_users u on u.id = t.assignee_id
    left join opportunities o on o.id = t.opportunity_id left join leads l on l.id = t.lead_id
    where true
    ${f.open ? tx`and t.done_at is null` : tx``}
    ${f.leadId ? tx`and t.lead_id = ${f.leadId}` : tx``}
    ${f.opportunityId ? tx`and t.opportunity_id = ${f.opportunityId}` : tx``}
    ${f.mine ? tx`and t.assignee_id = ${actor.id}` : tx``}
    order by t.done_at nulls first, t.due_at limit 200`, sql);
}

// ─── Dashboard ─────────────────────────────────────────────────────────
export async function dashboard(actor: Actor, days: number | null = 90, sql?: Sql) {
  return asUser(actor, async (tx) => {
    const since = days ? tx`now() - make_interval(days => ${days})` : tx`'-infinity'::timestamptz`;
    const leadsBySource = await tx<{ source: string; leads: number }[]>`
      select coalesce(t.source, 'direct') as source, count(*)::int as leads
      from leads l left join touches t on t.id = l.first_touch_id
      where l.status <> 'duplicate' and l.created_at >= ${since} group by 1 order by 2 desc`;
    const byStage = await tx<{ stage_code: string; n: number; value: number }[]>`
      select s.code as stage_code, count(o.id)::int as n, coalesce(sum(o.amount), 0)::float8 as value
      from pipeline_stages s left join opportunities o on o.stage_code = s.code and o.tenant_id = s.tenant_id and o.created_at >= ${since}
      group by s.code, s.position order by s.position`;
    const revenueByChannel = await tx<{ source: string; won: number; value: number }[]>`
      select coalesce(first_touch_source, 'direct') as source, count(*)::int as won, coalesce(sum(amount), 0)::float8 as value
      from opportunities where stage_code = 'won' and closed_at >= ${since} group by 1 order by 3 desc`;
    const [conv] = await tx<{ total: number; converted: number }[]>`
      select count(*)::int as total, count(*) filter (where status = 'converted')::int as converted
      from leads where status <> 'duplicate' and created_at >= ${since}`;
    const [overdue] = await tx<{ leads: number; tasks: number }[]>`
      select (select count(*)::int from leads where status = 'new' and first_response_due_at < now()) as leads,
             (select count(*)::int from tasks where done_at is null and due_at < now()) as tasks`;
    const won = byStage.find((s) => s.stage_code === 'won');
    const lost = byStage.find((s) => s.stage_code === 'lost');
    return {
      leadsBySource,
      byStage,
      revenueByChannel,
      won: { n: won?.n ?? 0, value: won?.value ?? 0 },
      openValue: byStage.filter((s) => !['won', 'lost'].includes(s.stage_code)).reduce((acc, s) => acc + s.value, 0),
      winRate: winRate(won?.n ?? 0, lost?.n ?? 0),
      leadConversion: leadToOpportunity(conv?.converted ?? 0, conv?.total ?? 0),
      overdue: overdue ?? { leads: 0, tasks: 0 },
    };
  }, sql);
}

export async function listAudit(actor: Actor, limit = 200, sql?: Sql) {
  if (actor.role !== 'admin') throw new DomainError('Solo un administrador puede ver la auditoría.');
  return asUser(actor, (tx) => tx<{ id: number; action: string; entity: string; entity_id: string | null; actor: string | null; at: Date; before: unknown; after: unknown }[]>`
    select e.id, e.action, e.entity, e.entity_id, coalesce(u.full_name, 'Sistema / web') as actor, e.at, e.before, e.after
    from audit_events e left join app_users u on u.id = e.actor_id order by e.id desc limit ${limit}`, sql);
}

export async function globalSearch(actor: Actor, q: string, sql?: Sql) {
  const term = `%${q.trim()}%`;
  if (q.trim().length < 2) return { accounts: [], leads: [], opportunities: [] };
  return asUser(actor, async (tx) => ({
    accounts: await tx<{ id: string; name: string }[]>`select id, name from accounts where name ilike ${term} or domain ilike ${term} limit 10`,
    leads: await tx<{ id: string; full_name: string; company: string | null; status: string }[]>`select id, full_name, company, status from leads where full_name ilike ${term} or email ilike ${term} or company ilike ${term} limit 10`,
    opportunities: await tx<{ id: string; title: string; stage_code: string }[]>`select id, title, stage_code from opportunities where title ilike ${term} limit 10`,
  }), sql);
}
