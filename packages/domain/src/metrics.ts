/**
 * Métricas del dashboard. Regla (AT-11 §16): con pocos datos se muestra
 * «datos insuficientes» en lugar de un cero o un porcentaje engañoso.
 */
export const MIN_CLOSED_FOR_WIN_RATE = 5;
export const MIN_LEADS_FOR_CONVERSION = 5;

export type Ratio = { sufficient: true; value: number; n: number } | { sufficient: false; n: number; needed: number };

export function ratio(numerator: number, denominator: number, minSample: number): Ratio {
  if (denominator < minSample) return { sufficient: false, n: denominator, needed: minSample };
  return { sufficient: true, value: numerator / denominator, n: denominator };
}

/** Win rate = ganadas / (ganadas + perdidas). Las abiertas no cuentan. */
export function winRate(won: number, lost: number): Ratio {
  return ratio(won, won + lost, MIN_CLOSED_FOR_WIN_RATE);
}

export function leadToOpportunity(leadsWithOpportunity: number, totalLeads: number): Ratio {
  return ratio(leadsWithOpportunity, totalLeads, MIN_LEADS_FOR_CONVERSION);
}

export function formatRatio(r: Ratio): string {
  return r.sufficient ? `${Math.round(r.value * 100)} %` : `Datos insuficientes (${r.n} de ${r.needed})`;
}

export function formatMoney(amount: number, currency: 'MXN' | 'USD' = 'MXN'): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
}
