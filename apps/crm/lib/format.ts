import { formatMoney, STAGE_LABELS, type StageCode } from '@ti24/domain';

const TZ = 'America/Monterrey';
export const fmtDate = (d: Date | string | null) =>
  d ? new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeZone: TZ }).format(new Date(d)) : '—';
export const fmtDateTime = (d: Date | string | null) =>
  d ? new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short', timeZone: TZ }).format(new Date(d)) : '—';
export const money = (n: number | null | undefined, c: 'MXN' | 'USD' = 'MXN') => (n === null || n === undefined ? '—' : formatMoney(n, c));
export const stageLabel = (s: string) => STAGE_LABELS[s as StageCode] ?? s;

export const LEAD_STATUS: Record<string, { label: string; tone?: 'amber' | 'ok' | 'danger' | 'info' }> = {
  new: { label: 'Nuevo', tone: 'amber' },
  contacted: { label: 'Contactado', tone: 'info' },
  qualified: { label: 'Calificado', tone: 'ok' },
  disqualified: { label: 'Descalificado', tone: 'danger' },
  converted: { label: 'Convertido', tone: 'ok' },
  duplicate: { label: 'Duplicado' },
};

export const PROPOSAL_STATUS: Record<string, { label: string; tone?: 'amber' | 'ok' | 'danger' | 'info' }> = {
  draft: { label: 'Borrador' },
  sent: { label: 'Enviada', tone: 'info' },
  accepted: { label: 'Aceptada', tone: 'ok' },
  rejected: { label: 'Rechazada', tone: 'danger' },
  expired: { label: 'Vencida' },
};

export const STAGE_TONE: Record<string, 'amber' | 'ok' | 'danger' | 'info' | undefined> = {
  discovery: 'amber', proposal: 'info', negotiation: 'info', won: 'ok', lost: 'danger',
};

export const SOURCE_LABEL: Record<string, string> = {
  google: 'Google', bing: 'Bing', meta: 'Meta', linkedin: 'LinkedIn', tiktok: 'TikTok', whatsapp: 'WhatsApp',
  direct: 'Directo', email: 'Correo', x: 'X', youtube: 'YouTube', duckduckgo: 'DuckDuckGo',
};
export const sourceLabel = (s: string | null) => (s ? SOURCE_LABEL[s] ?? s : '—');

export const ACTIVITY_KIND: Record<string, string> = { call: 'Llamada', meeting: 'Reunión', email: 'Correo', note: 'Nota', whatsapp: 'WhatsApp' };

export const SERVICE_LABEL: Record<string, string> = {
  DIAG: 'Diagnóstico', WEB: 'Sitio web', MKT: 'Marketing digital', SOC: 'Redes', SYS: 'Software a medida',
  APP: 'Aplicación', MNT: 'Mantenimiento', 'EDU-IC': 'Capacitación in-company', 'EDU-OP': 'Cursos abiertos',
};

/** Convierte "?error=" / "?ok=" en mensajes. */
export async function flashFrom(sp: Promise<Record<string, string | string[] | undefined>>) {
  const p = await sp;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;
  return { error: one(p.error), ok: one(p.ok), params: p, one };
}
