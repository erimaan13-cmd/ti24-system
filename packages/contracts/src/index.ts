/**
 * Contrato de eventos Web ↔ CRM — versión `ti24.events/v1` (AT-11 §17, AT-13 §2).
 * La web y el CRM importan ESTE archivo: si alguien cambia un campo, el otro deja de compilar.
 * Regla de privacidad: los eventos del navegador NUNCA llevan nombre, correo ni teléfono.
 */
import { z } from 'zod';

export const CONTRACT_VERSION = 'ti24.events/v1' as const;
export const SCHEMA_VERSION = 1 as const;

// ─── Catálogo compartido (SYNC 2, D-12) ────────────────────────────────
export const SERVICE_CODES = ['DIAG', 'WEB', 'MKT', 'SOC', 'SYS', 'APP', 'MNT', 'EDU-IC', 'EDU-OP'] as const;
export const ServiceCode = z.enum(SERVICE_CODES);
export type ServiceCode = z.infer<typeof ServiceCode>;

/** Servicios que el formulario público ofrece hoy (cursos solo «bajo oferta», D-18). */
export const PUBLIC_FORM_SERVICES = ['SYS', 'WEB', 'APP', 'MNT', 'MKT', 'DIAG'] as const satisfies readonly ServiceCode[];

export const EVENT_NAMES = [
  'PAGE_VIEWED', 'SERVICE_VIEWED', 'CTA_CLICKED', 'FORM_STARTED', 'FORM_SUBMITTED',
  'DIAGNOSTIC_REQUESTED', 'QUOTE_REQUESTED', 'MEETING_REQUESTED', 'RESOURCE_DOWNLOADED',
  'COURSE_VIEWED', 'COURSE_INTERESTED', 'COURSE_ENROLLED',
] as const;
export const EventName = z.enum(EVENT_NAMES);
export type EventName = z.infer<typeof EventName>;

/** Eventos que el NAVEGADOR puede emitir a /api/events. FORM_SUBMITTED y los *_REQUESTED los emite el servidor. */
export const BROWSER_EVENT_NAMES = ['PAGE_VIEWED', 'SERVICE_VIEWED', 'CTA_CLICKED', 'FORM_STARTED', 'COURSE_VIEWED'] as const;
export const BrowserEventName = z.enum(BROWSER_EVENT_NAMES);

const shortText = (max: number) => z.string().trim().max(max);
const nullableText = (max: number) => shortText(max).nullable().default(null);

// ─── Atribución (AT-11 §16) ────────────────────────────────────────────
export const ClickIds = z
  .object({ gclid: shortText(200), fbclid: shortText(200), li_fat_id: shortText(200) })
  .partial()
  .default({});

/** Señales crudas que el navegador captura; el servidor las normaliza con @ti24/domain. */
export const RawAttribution = z.object({
  utm_source: nullableText(100),
  utm_medium: nullableText(100),
  utm_campaign: nullableText(150),
  utm_content: nullableText(150),
  utm_term: nullableText(150),
  referrer: nullableText(500),
  landing_path: nullableText(300),
  click_ids: ClickIds,
  ref_code: z.string().regex(/^REF-[A-Z0-9]{4}$/).nullable().default(null),
  occurred_at: z.iso.datetime(),
});
export type RawAttribution = z.infer<typeof RawAttribution>;

// ─── Sobre común de un evento de navegador ─────────────────────────────
export const PagePayload = z.object({
  path: shortText(300).regex(/^\//, 'debe iniciar con /'),
  title: nullableText(200),
  referrer: nullableText(500),
});

export const BrowserEvent = z
  .object({
    event_id: z.uuid(),
    event_name: BrowserEventName,
    schema_version: z.literal(SCHEMA_VERSION),
    occurred_at: z.iso.datetime(),
    anonymous_id: z.uuid(),
    session_id: z.uuid(),
    contact_ref: z.null().default(null),
    page: PagePayload,
    attribution: RawAttribution.nullable().default(null), // solo en el primer evento de la sesión
    service_code: ServiceCode.nullable().default(null),
    metadata: z
      .object({
        cta_id: shortText(60),
        channel: z.enum(['form', 'whatsapp', 'phone', 'email']),
        ref_code: z.string().regex(/^REF-[A-Z0-9]{4}$/),
        form_id: shortText(60),
        course_id: shortText(60),
      })
      .partial()
      .strict()
      .default({}),
  })
  .strict();
export type BrowserEvent = z.infer<typeof BrowserEvent>;

export const EventBatch = z.object({ events: z.array(BrowserEvent).min(1).max(20) }).strict();
export type EventBatch = z.infer<typeof EventBatch>;

// ─── Formulario de diagnóstico (única carga con datos personales) ──────
export const COMPANY_SIZES = ['1-9', '10-49', '50-199', '200+'] as const;

export const LeadForm = z
  .object({
    full_name: z.string().trim().min(2, 'Escribe tu nombre').max(120),
    email: z.email('Correo no válido').trim().toLowerCase().max(200),
    company: z.string().trim().min(2, 'Escribe el nombre de la empresa').max(160),
    service_code: ServiceCode,
    message: z.string().trim().min(10, 'Cuéntanos un poco más (mínimo 10 caracteres)').max(2000),
    phone: z
      .string()
      .trim()
      .max(30)
      .regex(/^[+\d\s()-]*$/, 'Teléfono no válido')
      .transform((v) => (v === '' ? null : v))
      .nullable()
      .default(null),
    company_size: z.enum(COMPANY_SIZES).nullable().default(null),
    privacy_accepted: z.literal(true, { error: 'Debes aceptar el aviso de privacidad' }),
    marketing_consent: z.boolean().default(false),
  })
  .strict();
export type LeadForm = z.infer<typeof LeadForm>;

export const FORM_IDS = ['diagnostico'] as const;

export const LeadSubmission = z
  .object({
    event_id: z.uuid(), // idempotencia del envío: el mismo id no crea dos leads
    form_id: z.enum(FORM_IDS),
    lang: z.enum(['es', 'en']).default('es'),
    anonymous_id: z.uuid(),
    session_id: z.uuid(),
    page_path: shortText(300).regex(/^\//),
    first_touch: RawAttribution.nullable().default(null),
    last_touch: RawAttribution.nullable().default(null),
    fields: LeadForm,
    website: z.string().max(200).default(''), // honeypot: invisible para personas; si trae texto, es un bot
    turnstile_token: z.string().max(4096).nullable().default(null),
  })
  .strict();
export type LeadSubmission = z.infer<typeof LeadSubmission>;

export type LeadIntakeResult =
  | { ok: true; status: 'created' | 'duplicate' | 'replayed'; lead_id: string }
  | { ok: false; error: 'invalid' | 'spam' | 'rate_limited' | 'captcha_failed' | 'server_error'; issues?: Record<string, string> };

/** Convierte los errores de Zod en { campo: mensaje } para mostrarlos junto a cada campo. */
export function fieldIssues(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.filter((p) => p !== 'fields').join('.') || '_';
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
