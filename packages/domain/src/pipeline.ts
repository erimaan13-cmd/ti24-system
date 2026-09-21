/** Reglas del pipeline, propuestas y proyectos (AT-11 §9, §22). */

export const STAGES = ['discovery', 'proposal', 'negotiation', 'won', 'lost'] as const;
export type StageCode = (typeof STAGES)[number];
export const OPEN_STAGES: StageCode[] = ['discovery', 'proposal', 'negotiation'];
export const isClosed = (s: StageCode) => s === 'won' || s === 'lost';

export const STAGE_LABELS: Record<StageCode, string> = {
  discovery: 'Diagnóstico',
  proposal: 'Propuesta',
  negotiation: 'Negociación',
  won: 'Ganada',
  lost: 'Perdida',
};

export interface StageChangeInput {
  from: StageCode;
  to: StageCode;
  lostReason?: string | null;
  hasAcceptedProposal: boolean;
  amount: number | null;
}

/**
 * Devuelve la lista de errores (vacía = transición válida).
 * - Una oportunidad cerrada no se reabre en P0 (se crea otra, tipo renewal/upsell).
 * - «Ganada» exige una propuesta aceptada y monto > 0.
 * - «Perdida» exige motivo (también lo exige la base de datos).
 */
export function validateStageChange(i: StageChangeInput): string[] {
  const errors: string[] = [];
  if (i.from === i.to) errors.push('La oportunidad ya está en esa etapa.');
  if (isClosed(i.from)) errors.push('Una oportunidad cerrada no se puede mover.');
  if (i.to === 'won') {
    if (!i.hasAcceptedProposal) errors.push('Para ganar se necesita una propuesta aceptada.');
    if (i.amount === null || !(i.amount > 0)) errors.push('Para ganar se necesita un monto mayor a 0.');
  }
  if (i.to === 'lost' && !(i.lostReason && i.lostReason.trim().length >= 3)) {
    errors.push('Para marcar como perdida escribe el motivo.');
  }
  return errors;
}

// ─── Propuestas ─────────────────────────────────────────────────────────
export type ProposalStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';

const PROPOSAL_TRANSITIONS: Record<ProposalStatus, ProposalStatus[]> = {
  draft: ['sent'],
  sent: ['accepted', 'rejected', 'expired'],
  accepted: [],
  rejected: [],
  expired: [],
};

export function canTransitionProposal(from: ProposalStatus, to: ProposalStatus): boolean {
  return PROPOSAL_TRANSITIONS[from].includes(to);
}

export interface ProposalItemLike {
  quantity: number;
  unit_price: number;
  billing: 'one_time' | 'monthly';
}

/** Totales separados: pago único y mensual (el mensual no se suma al único). */
export function proposalTotals(items: ProposalItemLike[]) {
  let oneTime = 0;
  let monthly = 0;
  for (const it of items) {
    const line = Math.round(it.quantity * it.unit_price * 100) / 100;
    if (it.billing === 'monthly') monthly += line;
    else oneTime += line;
  }
  return { oneTime: round2(oneTime), monthly: round2(monthly) };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Folio legible y único por año: TI24-2026-0007 */
export function formatFolio(year: number, seq: number): string {
  return `TI24-${year}-${String(seq).padStart(4, '0')}`;
}

// ─── Proyecto al ganar ─────────────────────────────────────────────────
export type RevenueModel = 'project' | 'recurring' | 'education' | 'package';

/** Se crea un Project si la oportunidad ganada incluye al menos un servicio de tipo proyecto. */
export function shouldCreateProject(models: RevenueModel[]): boolean {
  return models.includes('project');
}
