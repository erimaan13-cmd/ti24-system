/**
 * Ingesta desde la web pública: eventos anónimos y envío del formulario de diagnóstico.
 * Idempotente por event_id (AT-11 §17): repetir un envío no duplica nada.
 */
import type { EventBatch, LeadSubmission, RawAttribution } from '@ti24/contracts';
import { corporateDomain, firstResponseDue, normalizeAttribution, type NormalizedTouch } from '@ti24/domain';
import { asSystem, audit, type Sql, type Tx } from './client';

export interface RecordEventsResult {
  accepted: number;
  duplicates: number;
}

async function ensureSession(
  tx: Tx,
  tenant: string,
  s: { session_id: string; anonymous_id: string; landing_path: string | null; device: string | null },
  touch: NormalizedTouch,
) {
  await tx`insert into web_sessions (id, tenant_id, anonymous_id, landing_path, referrer, source, medium, campaign, content, term, device)
           values (${s.session_id}, ${tenant}, ${s.anonymous_id}, ${s.landing_path}, ${touch.referrer}, ${touch.source},
                   ${touch.medium}, ${touch.campaign}, ${touch.content}, ${touch.term}, ${s.device})
           on conflict (id) do nothing`;
}

export async function recordEvents(
  tenant: string,
  batch: EventBatch,
  ctx: { device: string | null },
  sql?: Sql,
): Promise<RecordEventsResult> {
  return asSystem(async (tx) => {
    let accepted = 0;
    for (const e of batch.events) {
      const touch = normalizeAttribution(e.attribution);
      await ensureSession(
        tx,
        tenant,
        { session_id: e.session_id, anonymous_id: e.anonymous_id, landing_path: e.attribution?.landing_path ?? e.page.path, device: ctx.device },
        touch,
      );
      const res = await tx`insert into web_events (event_id, tenant_id, session_id, anonymous_id, event_name, schema_version,
                                                   occurred_at, page_path, service_code, metadata)
             values (${e.event_id}, ${tenant}, ${e.session_id}, ${e.anonymous_id}, ${e.event_name}, ${e.schema_version},
                     ${e.occurred_at}, ${e.page.path}, ${e.service_code}, ${tx.json(e.metadata as never)})
             on conflict (event_id) do nothing`;
      accepted += res.count;
    }
    return { accepted, duplicates: batch.events.length - accepted };
  }, sql);
}

function sameTouch(a: RawAttribution | null, b: RawAttribution | null) {
  if (!a || !b) return true;
  return a.occurred_at === b.occurred_at;
}

async function insertTouch(tx: Tx, tenant: string, anonymousId: string, t: NormalizedTouch): Promise<string> {
  const [row] = await tx<{ id: string }[]>`
    insert into touches (tenant_id, anonymous_id, occurred_at, source, medium, platform, campaign, content, term,
                         landing_path, referrer, ref_code, kind)
    values (${tenant}, ${anonymousId}, ${t.occurred_at}, ${t.source}, ${t.medium}, ${t.platform}, ${t.campaign},
            ${t.content}, ${t.term}, ${t.landing_path}, ${t.referrer}, ${t.ref_code}, ${t.kind})
    returning id`;
  return row!.id;
}

export type IntakeOutcome = { status: 'created' | 'duplicate' | 'replayed'; lead_id: string };

/** Crea FormSubmission → Touch(es) → Lead (+ deduplicación) → eventos del servidor → auditoría. */
export async function intakeLead(
  tenant: string,
  sub: LeadSubmission,
  ctx: { device: string | null; now?: Date },
  sql?: Sql,
): Promise<IntakeOutcome> {
  return asSystem(async (tx) => {
    // 1) Idempotencia
    const [prev] = await tx<{ id: string }[]>`
      select l.id from form_submissions f join leads l on l.form_submission_id = f.id
      where f.event_id = ${sub.event_id} and f.tenant_id = ${tenant}`;
    if (prev) return { status: 'replayed', lead_id: prev.id };

    const now = ctx.now ?? new Date();
    const f = { ...sub.fields, email: sub.fields.email.trim().toLowerCase() }; // defensa extra además de Zod
    const firstRaw = sub.first_touch ?? sub.last_touch;
    const lastRaw = sub.last_touch ?? sub.first_touch;
    const first = normalizeAttribution(firstRaw);
    const last = normalizeAttribution(lastRaw);

    // 2) Sesión (por si el navegador bloqueó /api/events)
    await ensureSession(
      tx,
      tenant,
      { session_id: sub.session_id, anonymous_id: sub.anonymous_id, landing_path: last.landing_path, device: ctx.device },
      last,
    );

    // 3) Carga cruda e inmutable (sin el token de Turnstile ni el honeypot)
    const payload = { fields: f, page_path: sub.page_path, lang: sub.lang, first_touch: sub.first_touch, last_touch: sub.last_touch };
    const [submission] = await tx<{ id: string }[]>`
      insert into form_submissions (tenant_id, form_id, event_id, anonymous_id, payload, privacy_accepted)
      values (${tenant}, ${sub.form_id}, ${sub.event_id}, ${sub.anonymous_id}, ${tx.json(payload as never)}, ${f.privacy_accepted})
      returning id`;

    // 4) Toques de atribución
    const firstTouchId = await insertTouch(tx, tenant, sub.anonymous_id, first);
    const lastTouchId = sameTouch(firstRaw, lastRaw) ? firstTouchId : await insertTouch(tx, tenant, sub.anonymous_id, last);

    // 5) Deduplicación: correo exacto (sin importar mayúsculas) → duplicado; dominio → cuenta sugerida
    const [original] = await tx<{ id: string }[]>`
      select id from leads where tenant_id = ${tenant} and lower(email) = ${f.email} and status <> 'duplicate'
      order by created_at asc limit 1`;
    const domain = corporateDomain(f.email);
    const [suggested] = domain
      ? await tx<{ id: string }[]>`select id from accounts where tenant_id = ${tenant} and lower(domain) = ${domain} limit 1`
      : [];

    const [lead] = await tx<{ id: string }[]>`
      insert into leads (tenant_id, status, intent, full_name, email, phone, company, service_code, message, lang,
                         form_submission_id, first_touch_id, last_touch_id, duplicate_of, suggested_account_id,
                         company_size, marketing_consent, first_response_due_at)
      values (${tenant}, ${original ? 'duplicate' : 'new'}, 'diagnostic', ${f.full_name}, ${f.email}, ${f.phone},
              ${f.company}, ${f.service_code}, ${f.message}, ${sub.lang}, ${submission!.id}, ${firstTouchId},
              ${lastTouchId}, ${original?.id ?? null}, ${suggested?.id ?? null}, ${f.company_size},
              ${f.marketing_consent}, ${firstResponseDue(now).toISOString()})
      returning id`;

    if (original) {
      await tx`insert into activities (tenant_id, kind, subject, body, lead_id)
               values (${tenant}, 'note', 'Nuevo envío del mismo correo',
                       ${`Se recibió otro formulario (${f.service_code}). Lead duplicado: ${lead!.id}`}, ${original.id})`;
    }

    // 6) Eventos del servidor (los emite el servidor, no el navegador)
    const meta = tx.json({ form_id: sub.form_id, submission_id: submission!.id } as never);
    await tx`insert into web_events (event_id, tenant_id, session_id, anonymous_id, event_name, occurred_at, page_path, service_code, metadata)
             values (${sub.event_id}, ${tenant}, ${sub.session_id}, ${sub.anonymous_id}, 'FORM_SUBMITTED', ${now.toISOString()},
                     ${sub.page_path}, ${f.service_code}, ${meta})
             on conflict (event_id) do nothing`;
    await tx`insert into web_events (event_id, tenant_id, session_id, anonymous_id, event_name, occurred_at, page_path, service_code, metadata)
             values (gen_random_uuid(), ${tenant}, ${sub.session_id}, ${sub.anonymous_id}, 'DIAGNOSTIC_REQUESTED', ${now.toISOString()},
                     ${sub.page_path}, ${f.service_code}, ${meta})`;

    await audit(tx, { tenantId: tenant, actorId: null }, original ? 'lead.created_duplicate' : 'lead.created', 'lead', lead!.id, null, {
      service_code: f.service_code,
      source: first.source,
      medium: first.medium,
      duplicate_of: original?.id ?? null,
      suggested_account_id: suggested?.id ?? null,
    });

    return { status: original ? 'duplicate' : 'created', lead_id: lead!.id };
  }, sql);
}
