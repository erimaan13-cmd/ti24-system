'use server';
/**
 * Acciones del servidor del CRM. Cada acción:
 * 1) obtiene el usuario (requireActor), 2) valida la entrada con Zod,
 * 3) llama al núcleo (@ti24/db, que aplica reglas de dominio + RLS + auditoría),
 * 4) redirige con ?ok= o ?error= para mostrar el resultado.
 */
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { ServiceCode } from '@ti24/contracts';
import { STAGES } from '@ti24/domain';
import {
  addActivity, addProposalItem, addTask, changeStage, completeTask, convertLead, createProposal,
  DomainError, findActiveUserByEmail, removeProposalItem, setLeadStatus, setOpportunityServices,
  tenantId, transitionProposal, updateOpportunity, updateProposalItem,
} from '@ti24/db';
import { requireActor } from './auth';
import { clearSessionCookie, passwordMatches, setSessionCookie } from './session';

const withMsg = (path: string, key: 'ok' | 'error', msg: string) => `${path}${path.includes('?') ? '&' : '?'}${key}=${encodeURIComponent(msg)}`;
const uuid = z.uuid();
const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const safeBack = (fd: FormData, fallback: string) => {
  const b = str(fd, 'back');
  return b.startsWith('/') && !b.startsWith('//') ? b : fallback;
};

/** Ejecuta la mutación; los errores de dominio vuelven como mensaje, los inesperados como genérico. */
async function run(back: string, okMsg: string, fn: () => Promise<unknown>): Promise<never> {
  try {
    await fn();
  } catch (e) {
    if (e instanceof DomainError) redirect(withMsg(back, 'error', e.message));
    if (e instanceof z.ZodError) redirect(withMsg(back, 'error', e.issues[0]?.message ?? 'Datos no válidos.'));
    console.error('[crm action]', (e as Error).message);
    redirect(withMsg(back, 'error', 'No se pudo completar la acción. Intenta de nuevo.'));
  }
  revalidatePath('/', 'layout');
  redirect(withMsg(back, 'ok', okMsg));
}

// ─── Sesión ─────────────────────────────────────────────────────────────
const loginAttempts = new Map<string, { n: number; until: number }>();

export async function loginAction(fd: FormData) {
  const email = str(fd, 'email').toLowerCase();
  const password = String(fd.get('password') ?? '');
  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  const now = Date.now();
  const a = loginAttempts.get(ip);
  if (a && a.until > now && a.n >= 10) redirect('/login?error=' + encodeURIComponent('Demasiados intentos. Espera 10 minutos.'));
  if (!process.env.SESSION_SECRET || !process.env.CRM_DEMO_PASSWORD) {
    redirect('/login?error=' + encodeURIComponent('El CRM no está configurado (faltan SESSION_SECRET o CRM_DEMO_PASSWORD).'));
  }
  const user = z.email().safeParse(email).success ? await findActiveUserByEmail(tenantId(), email) : null;
  if (!user || !passwordMatches(password)) {
    loginAttempts.set(ip, { n: (a && a.until > now ? a.n : 0) + 1, until: now + 10 * 60_000 });
    redirect('/login?error=' + encodeURIComponent('Correo o contraseña incorrectos.'));
  }
  loginAttempts.delete(ip);
  await setSessionCookie(user.id);
  redirect('/');
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect('/login');
}

// ─── Leads ──────────────────────────────────────────────────────────────
const LeadStatusIn = z.enum(['new', 'contacted', 'qualified', 'disqualified', 'duplicate']);

export async function leadStatusAction(fd: FormData) {
  const actor = await requireActor();
  const id = uuid.parse(str(fd, 'id'));
  const back = `/leads/${id}`;
  await run(back, 'Estado actualizado.', () =>
    setLeadStatus(actor, id, LeadStatusIn.parse(str(fd, 'to')), { reason: str(fd, 'reason') || null }));
}

export async function convertLeadAction(fd: FormData) {
  const actor = await requireActor();
  const id = uuid.parse(str(fd, 'id'));
  let oppId = '';
  const services = z.array(ServiceCode).min(1, 'Elige al menos un servicio.').safeParse(fd.getAll('services'));
  if (!services.success) redirect(withMsg(`/leads/${id}`, 'error', 'Elige al menos un servicio.'));
  const amountRaw = str(fd, 'amount');
  try {
    const r = await convertLead(actor, id, {
      accountName: str(fd, 'account_name'),
      opportunityTitle: str(fd, 'title'),
      services: services.data,
      amount: amountRaw ? z.coerce.number().nonnegative('El monto no puede ser negativo.').parse(amountRaw) : null,
      useSuggestedAccount: fd.get('use_suggested') === 'on',
    });
    oppId = r.opportunityId;
  } catch (e) {
    const msg = e instanceof DomainError ? e.message : e instanceof z.ZodError ? (e.issues[0]?.message ?? 'Datos no válidos.') : 'No se pudo convertir el lead.';
    if (!(e instanceof DomainError) && !(e instanceof z.ZodError)) console.error('[convertLead]', (e as Error).message);
    redirect(withMsg(`/leads/${id}`, 'error', msg));
  }
  revalidatePath('/', 'layout');
  redirect(withMsg(`/oportunidades/${oppId}`, 'ok', 'Lead convertido: se creó la cuenta, el contacto y la oportunidad.'));
}

// ─── Actividades y tareas ──────────────────────────────────────────────
export async function activityAction(fd: FormData) {
  const actor = await requireActor();
  const back = safeBack(fd, '/');
  const target = {
    leadId: str(fd, 'lead_id') ? uuid.parse(str(fd, 'lead_id')) : null,
    accountId: str(fd, 'account_id') ? uuid.parse(str(fd, 'account_id')) : null,
    opportunityId: str(fd, 'opportunity_id') ? uuid.parse(str(fd, 'opportunity_id')) : null,
  };
  await run(back, 'Actividad registrada.', () =>
    addActivity(actor, target, {
      kind: z.enum(['call', 'meeting', 'email', 'note', 'whatsapp']).parse(str(fd, 'kind')),
      subject: str(fd, 'subject'),
      body: str(fd, 'body') || null,
    }));
}

export async function taskAction(fd: FormData) {
  const actor = await requireActor();
  const back = safeBack(fd, '/tareas');
  const due = str(fd, 'due_at');
  await run(back, 'Tarea creada.', () =>
    addTask(actor, {
      title: str(fd, 'title'),
      dueAt: due ? new Date(`${due}T17:00:00-06:00`).toISOString() : '',
      leadId: str(fd, 'lead_id') ? uuid.parse(str(fd, 'lead_id')) : null,
      opportunityId: str(fd, 'opportunity_id') ? uuid.parse(str(fd, 'opportunity_id')) : null,
    }));
}

export async function completeTaskAction(fd: FormData) {
  const actor = await requireActor();
  const back = safeBack(fd, '/tareas');
  await run(back, 'Tarea completada.', () => completeTask(actor, uuid.parse(str(fd, 'id'))));
}

// ─── Oportunidades ─────────────────────────────────────────────────────
export async function stageAction(fd: FormData) {
  const actor = await requireActor();
  const id = uuid.parse(str(fd, 'id'));
  const to = z.enum(STAGES).parse(str(fd, 'to'));
  await run(`/oportunidades/${id}`, to === 'won' ? 'Oportunidad ganada. Se creó el proyecto.' : 'Etapa actualizada.', () =>
    changeStage(actor, id, to, { lostReason: str(fd, 'lost_reason') || null }));
}

export async function updateOpportunityAction(fd: FormData) {
  const actor = await requireActor();
  const id = uuid.parse(str(fd, 'id'));
  const amount = str(fd, 'amount');
  await run(`/oportunidades/${id}`, 'Oportunidad actualizada.', () =>
    updateOpportunity(actor, id, {
      title: str(fd, 'title') || undefined,
      amount: amount === '' ? null : z.coerce.number().nonnegative('El monto no puede ser negativo.').parse(amount),
      expected_close: str(fd, 'expected_close') || null,
    }));
}

export async function servicesAction(fd: FormData) {
  const actor = await requireActor();
  const id = uuid.parse(str(fd, 'id'));
  await run(`/oportunidades/${id}`, 'Servicios actualizados.', () =>
    setOpportunityServices(actor, id, z.array(ServiceCode).parse(fd.getAll('services'))));
}

// ─── Propuestas ────────────────────────────────────────────────────────
export async function createProposalAction(fd: FormData) {
  const actor = await requireActor();
  const oppId = uuid.parse(str(fd, 'opportunity_id'));
  let pid = '';
  try {
    pid = (await createProposal(actor, oppId, { validUntil: str(fd, 'valid_until') || null })).id;
  } catch (e) {
    redirect(withMsg(`/oportunidades/${oppId}`, 'error', e instanceof DomainError ? e.message : 'No se pudo crear la propuesta.'));
  }
  revalidatePath('/', 'layout');
  redirect(withMsg(`/propuestas/${pid}`, 'ok', 'Propuesta creada en borrador. Captura los precios.'));
}

const money = z.coerce.number({ error: 'Número no válido.' });

export async function addItemAction(fd: FormData) {
  const actor = await requireActor();
  const pid = uuid.parse(str(fd, 'proposal_id'));
  await run(`/propuestas/${pid}`, 'Línea agregada.', () =>
    addProposalItem(actor, pid, {
      service_code: ServiceCode.parse(str(fd, 'service_code')),
      description: str(fd, 'description'),
      quantity: money.parse(str(fd, 'quantity') || '1'),
      unit_price: money.parse(str(fd, 'unit_price') || '0'),
      billing: z.enum(['one_time', 'monthly']).parse(str(fd, 'billing')),
    }));
}

export async function updateItemAction(fd: FormData) {
  const actor = await requireActor();
  const pid = uuid.parse(str(fd, 'proposal_id'));
  await run(`/propuestas/${pid}`, 'Línea actualizada.', () =>
    updateProposalItem(actor, pid, uuid.parse(str(fd, 'item_id')), {
      description: str(fd, 'description'),
      quantity: money.parse(str(fd, 'quantity')),
      unit_price: money.parse(str(fd, 'unit_price')),
    }));
}

export async function removeItemAction(fd: FormData) {
  const actor = await requireActor();
  const pid = uuid.parse(str(fd, 'proposal_id'));
  await run(`/propuestas/${pid}`, 'Línea eliminada.', () => removeProposalItem(actor, pid, uuid.parse(str(fd, 'item_id'))));
}

export async function proposalStatusAction(fd: FormData) {
  const actor = await requireActor();
  const pid = uuid.parse(str(fd, 'proposal_id'));
  const to = z.enum(['sent', 'accepted', 'rejected', 'expired']).parse(str(fd, 'to'));
  const msg = { sent: 'Propuesta marcada como enviada.', accepted: 'Propuesta aceptada.', rejected: 'Propuesta rechazada.', expired: 'Propuesta vencida.' }[to];
  await run(`/propuestas/${pid}`, msg, () => transitionProposal(actor, pid, to));
}
