/** Propuestas simples con estados: borrador → enviada → aceptada / rechazada / vencida. */
import { canTransitionProposal, formatFolio, proposalTotals, type ProposalStatus } from '@ti24/domain';
import type { ServiceCode } from '@ti24/contracts';
import { asUser, audit, DomainError, type Actor, type Sql, type Tx } from './client';

export interface ProposalItemRow {
  id: string;
  service_code: string;
  description: string;
  quantity: number;
  unit_price: number;
  billing: 'one_time' | 'monthly';
}

async function nextFolio(tx: Tx): Promise<string> {
  const year = new Date().getUTCFullYear();
  const prefix = `TI24-${year}-`;
  const [row] = await tx<{ max: number }[]>`
    select coalesce(max(substring(folio from ${prefix.length + 1})::int), 0) as max
    from proposals where folio like ${prefix + '%'}`;
  return formatFolio(year, (row?.max ?? 0) + 1);
}

export async function createProposal(actor: Actor, opportunityId: string, input: { validUntil?: string | null } = {}, sql?: Sql) {
  return asUser(actor, async (tx) => {
    const [o] = await tx<{ stage_code: string; currency: string }[]>`select stage_code, currency from opportunities where id = ${opportunityId} for update`;
    if (!o) throw new DomainError('Oportunidad no encontrada.');
    if (o.stage_code === 'won' || o.stage_code === 'lost') throw new DomainError('No se crean propuestas en una oportunidad cerrada.');
    const folio = await nextFolio(tx);
    const [p] = await tx<{ id: string }[]>`
      insert into proposals (tenant_id, opportunity_id, folio, valid_until, currency)
      values (${actor.tenantId}, ${opportunityId}, ${folio}, ${input.validUntil ?? null}, ${o.currency}) returning id`;
    // Prellenar una línea por servicio de la oportunidad
    const services = await tx<{ service_code: string; name_es: string; revenue_model: string }[]>`
      select os.service_code, s.name_es, s.revenue_model from opportunity_services os
      join services s on s.tenant_id = os.tenant_id and s.code = os.service_code where os.opportunity_id = ${opportunityId}`;
    for (const s of services) {
      await tx`insert into proposal_items (proposal_id, tenant_id, service_code, description, quantity, unit_price, billing)
               values (${p!.id}, ${actor.tenantId}, ${s.service_code}, ${s.name_es}, 1, 0, ${s.revenue_model === 'recurring' ? 'monthly' : 'one_time'})`;
    }
    await audit(tx, { tenantId: actor.tenantId, actorId: actor.id }, 'proposal.created', 'proposal', p!.id, null, { folio, opportunity_id: opportunityId });
    return { id: p!.id, folio };
  }, sql);
}

export async function getProposal(actor: Actor, id: string, sql?: Sql) {
  return asUser(actor, async (tx) => {
    const [p] = await tx<{ id: string; folio: string; status: ProposalStatus; valid_until: Date | null; currency: 'MXN' | 'USD'; sent_at: Date | null; decided_at: Date | null; created_at: Date; opportunity_id: string; opportunity_title: string; account_name: string; stage_code: string }[]>`
      select p.id, p.folio, p.status, p.valid_until, p.currency, p.sent_at, p.decided_at, p.created_at, p.opportunity_id,
             o.title as opportunity_title, a.name as account_name, o.stage_code
      from proposals p join opportunities o on o.id = p.opportunity_id join accounts a on a.id = o.account_id where p.id = ${id}`;
    if (!p) return null;
    const items = await tx<ProposalItemRow[]>`
      select id, service_code, description, quantity::float8 as quantity, unit_price::float8 as unit_price, billing
      from proposal_items where proposal_id = ${id} order by billing, service_code, description`;
    return { proposal: p, items, totals: proposalTotals(items) };
  }, sql);
}

async function lockDraft(tx: Tx, proposalId: string) {
  const [p] = await tx<{ status: ProposalStatus }[]>`select status from proposals where id = ${proposalId} for update`;
  if (!p) throw new DomainError('Propuesta no encontrada.');
  if (p.status !== 'draft') throw new DomainError('Solo se editan propuestas en borrador.');
}

export async function addProposalItem(
  actor: Actor,
  proposalId: string,
  item: { service_code: ServiceCode; description: string; quantity: number; unit_price: number; billing: 'one_time' | 'monthly' },
  sql?: Sql,
) {
  if (!(item.quantity > 0)) throw new DomainError('La cantidad debe ser mayor a 0.');
  if (!(item.unit_price >= 0)) throw new DomainError('El precio no puede ser negativo.');
  if (item.description.trim().length < 2) throw new DomainError('Escribe una descripción.');
  return asUser(actor, async (tx) => {
    await lockDraft(tx, proposalId);
    const [row] = await tx<{ id: string }[]>`
      insert into proposal_items (proposal_id, tenant_id, service_code, description, quantity, unit_price, billing)
      values (${proposalId}, ${actor.tenantId}, ${item.service_code}, ${item.description.trim()}, ${item.quantity}, ${item.unit_price}, ${item.billing})
      returning id`;
    await audit(tx, { tenantId: actor.tenantId, actorId: actor.id }, 'proposal.item_added', 'proposal', proposalId, null, item);
    return row!.id;
  }, sql);
}

export async function updateProposalItem(actor: Actor, proposalId: string, itemId: string, patch: { quantity: number; unit_price: number; description: string }, sql?: Sql) {
  if (!(patch.quantity > 0)) throw new DomainError('La cantidad debe ser mayor a 0.');
  if (!(patch.unit_price >= 0)) throw new DomainError('El precio no puede ser negativo.');
  return asUser(actor, async (tx) => {
    await lockDraft(tx, proposalId);
    const res = await tx`update proposal_items set quantity = ${patch.quantity}, unit_price = ${patch.unit_price}, description = ${patch.description.trim()}
                         where id = ${itemId} and proposal_id = ${proposalId}`;
    if (res.count === 0) throw new DomainError('Línea no encontrada.');
    await audit(tx, { tenantId: actor.tenantId, actorId: actor.id }, 'proposal.item_updated', 'proposal', proposalId, null, { item_id: itemId, ...patch });
  }, sql);
}

export async function removeProposalItem(actor: Actor, proposalId: string, itemId: string, sql?: Sql) {
  return asUser(actor, async (tx) => {
    await lockDraft(tx, proposalId);
    const [before] = await tx<ProposalItemRow[]>`
      delete from proposal_items where id = ${itemId} and proposal_id = ${proposalId}
      returning id, service_code, description, quantity::float8 as quantity, unit_price::float8 as unit_price, billing`;
    if (!before) throw new DomainError('Línea no encontrada.');
    await audit(tx, { tenantId: actor.tenantId, actorId: actor.id }, 'proposal.item_removed', 'proposal', proposalId, before, null);
  }, sql);
}

/** Cambia el estado. Enviar exige al menos una línea con precio; aceptar fija el monto si faltaba. */
export async function transitionProposal(actor: Actor, id: string, to: ProposalStatus, sql?: Sql) {
  return asUser(actor, async (tx) => {
    const [p] = await tx<{ status: ProposalStatus; opportunity_id: string }[]>`select status, opportunity_id from proposals where id = ${id} for update`;
    if (!p) throw new DomainError('Propuesta no encontrada.');
    if (!canTransitionProposal(p.status, to)) throw new DomainError(`No se puede pasar de «${p.status}» a «${to}».`);
    const items = await tx<{ quantity: number; unit_price: number; billing: 'one_time' | 'monthly' }[]>`
      select quantity::float8 as quantity, unit_price::float8 as unit_price, billing from proposal_items where proposal_id = ${id}`;
    const totals = proposalTotals(items);
    const a = { tenantId: actor.tenantId, actorId: actor.id };

    if (to === 'sent') {
      if (items.length === 0 || totals.oneTime + totals.monthly <= 0) throw new DomainError('Agrega al menos una línea con precio antes de enviar.');
      await tx`update proposals set status = 'sent', sent_at = now() where id = ${id}`;
      // La oportunidad avanza sola a «Propuesta» si seguía en «Diagnóstico»
      const [o] = await tx<{ stage_code: string }[]>`select stage_code from opportunities where id = ${p.opportunity_id} for update`;
      if (o?.stage_code === 'discovery') {
        await tx`update opportunities set stage_code = 'proposal' where id = ${p.opportunity_id}`;
        await audit(tx, a, 'opportunity.stage_changed', 'opportunity', p.opportunity_id, { stage: 'discovery' }, { stage: 'proposal', reason: 'proposal.sent' });
      }
    } else {
      await tx`update proposals set status = ${to}, decided_at = now() where id = ${id}`;
      if (to === 'accepted') {
        await tx`update opportunities set amount = coalesce(amount, ${totals.oneTime}) where id = ${p.opportunity_id}`;
      }
    }
    await audit(tx, a, `proposal.${to}`, 'proposal', id, { status: p.status }, { status: to, totals });
  }, sql);
}
