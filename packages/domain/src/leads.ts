/** Reglas de leads: deduplicación, estados y vencimiento de primera respuesta. */

/** Dominios de correo públicos: nunca se usan para sugerir una cuenta (AT-11 §22). */
export const PUBLIC_EMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'hotmail.com', 'hotmail.es', 'outlook.com', 'outlook.es', 'live.com',
  'live.com.mx', 'msn.com', 'yahoo.com', 'yahoo.com.mx', 'yahoo.es', 'icloud.com', 'me.com', 'mac.com',
  'aol.com', 'proton.me', 'protonmail.com', 'gmx.com', 'zoho.com', 'prodigy.net.mx', 'yandex.com',
]);

export function emailDomain(email: string): string | null {
  const at = email.lastIndexOf('@');
  if (at < 1) return null;
  return email.slice(at + 1).trim().toLowerCase() || null;
}

/** Dominio corporativo del correo, o null si es un proveedor público. */
export function corporateDomain(email: string): string | null {
  const d = emailDomain(email);
  return d && !PUBLIC_EMAIL_DOMAINS.has(d) ? d : null;
}

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'disqualified' | 'converted' | 'duplicate';

const LEAD_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  new: ['contacted', 'qualified', 'disqualified', 'duplicate'],
  contacted: ['qualified', 'disqualified', 'duplicate'],
  qualified: ['converted', 'disqualified', 'contacted'],
  disqualified: ['contacted'], // se puede reabrir
  converted: [],
  duplicate: [],
};

export function canTransitionLead(from: LeadStatus, to: LeadStatus): boolean {
  return LEAD_TRANSITIONS[from].includes(to);
}

export function allowedLeadTransitions(from: LeadStatus): LeadStatus[] {
  return LEAD_TRANSITIONS[from];
}

/** Solo un lead calificado se convierte (etapa 4 → 5 del ciclo de vida, AT-11 §9). */
export function canConvertLead(status: LeadStatus): boolean {
  return status === 'qualified';
}

/**
 * Vencimiento de primera respuesta: siguiente día hábil a la misma hora (lun–vie).
 * El SLA en horas hábiles con horario y festivos es P1 (se porta de AT-10).
 */
export function firstResponseDue(createdAt: Date): Date {
  const due = new Date(createdAt.getTime());
  do {
    due.setUTCDate(due.getUTCDate() + 1);
  } while (due.getUTCDay() === 0 || due.getUTCDay() === 6);
  return due;
}
