'use client';
/**
 * Captura de atribución y eventos del navegador (AT-11 §16–17).
 * - anonymous_id: cookie propia, 180 días. Sin datos personales.
 * - sesión: se renueva tras 30 min sin actividad.
 * - first touch: se guarda una vez y NUNCA se sobrescribe. last touch: se actualiza por sesión.
 * - Los eventos nunca llevan nombre, correo ni teléfono (el esquema del servidor los rechazaría).
 */
import type { BrowserEvent, RawAttribution, ServiceCode } from '@ti24/contracts';
import { SCHEMA_VERSION } from '@ti24/contracts';

const AID = 'ti24_aid';
const FT = 'ti24_ft';
const SID = 'ti24_sid';
const LT = 'ti24_lt';
const SESSION_TTL_MS = 30 * 60 * 1000;
const COOKIE_DAYS = 180;

const uuid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });

function readCookie(name: string): string | null {
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]!) : null;
}
function writeCookie(name: string, value: string, days = COOKIE_DAYS) {
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${days * 86400}; Path=/; SameSite=Lax${secure}`;
}
function safeSession<T>(fn: () => T, fallback: T): T {
  try { return fn(); } catch { return fallback; }
}

export function anonymousId(): string {
  let id = readCookie(AID);
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    id = uuid();
    writeCookie(AID, id);
  }
  return id;
}

/** Señales crudas de esta visita (URL + referrer). */
export function captureAttribution(): RawAttribution {
  const p = new URLSearchParams(location.search);
  const get = (k: string) => (p.get(k)?.trim().slice(0, 150) || null);
  const ref = p.get('ref');
  const click_ids: RawAttribution['click_ids'] = {};
  for (const k of ['gclid', 'fbclid', 'li_fat_id'] as const) {
    const v = p.get(k);
    if (v) click_ids[k] = v.slice(0, 200);
  }
  let referrer: string | null = document.referrer || null;
  if (referrer) {
    try {
      const u = new URL(referrer);
      referrer = `${u.origin}${u.pathname}`.slice(0, 500); // sin query: puede traer datos personales
    } catch { referrer = null; }
  }
  return {
    utm_source: get('utm_source'),
    utm_medium: get('utm_medium'),
    utm_campaign: get('utm_campaign'),
    utm_content: get('utm_content'),
    utm_term: get('utm_term'),
    referrer,
    landing_path: location.pathname.slice(0, 300),
    click_ids,
    ref_code: ref && /^REF-[A-Z0-9]{4}$/.test(ref) ? ref : null,
    occurred_at: new Date().toISOString(),
  };
}

interface SessionState { id: string; last: number; attributionSent: boolean }

/** Devuelve la sesión actual; si es nueva, fija last touch y (una sola vez) first touch. */
export function currentSession(): { session: SessionState; isNew: boolean } {
  const now = Date.now();
  const stored = safeSession<SessionState | null>(() => JSON.parse(sessionStorage.getItem(SID) ?? 'null'), null);
  if (stored && now - stored.last < SESSION_TTL_MS) {
    stored.last = now;
    safeSession(() => sessionStorage.setItem(SID, JSON.stringify(stored)), undefined);
    return { session: stored, isNew: false };
  }
  const session: SessionState = { id: uuid(), last: now, attributionSent: false };
  const touch = captureAttribution();
  safeSession(() => {
    sessionStorage.setItem(SID, JSON.stringify(session));
    sessionStorage.setItem(LT, JSON.stringify(touch));
  }, undefined);
  if (!readCookie(FT)) writeCookie(FT, JSON.stringify(touch));
  return { session, isNew: true };
}

export function firstTouch(): RawAttribution | null {
  return safeSession(() => JSON.parse(readCookie(FT) ?? 'null'), null);
}
export function lastTouch(): RawAttribution | null {
  return safeSession(() => JSON.parse(sessionStorage.getItem(LT) ?? 'null'), null);
}

export interface TrackOptions {
  service_code?: ServiceCode | null;
  metadata?: BrowserEvent['metadata'];
}

export function track(event_name: BrowserEvent['event_name'], opts: TrackOptions = {}) {
  if (typeof window === 'undefined') return;
  const { session } = currentSession();
  const attribution = session.attributionSent ? null : lastTouch();
  const event: BrowserEvent = {
    event_id: uuid(),
    event_name,
    schema_version: SCHEMA_VERSION,
    occurred_at: new Date().toISOString(),
    anonymous_id: anonymousId(),
    session_id: session.id,
    contact_ref: null,
    page: { path: location.pathname.slice(0, 300), title: document.title.slice(0, 200) || null, referrer: null },
    attribution,
    service_code: opts.service_code ?? null,
    metadata: opts.metadata ?? {},
  };
  const body = JSON.stringify({ events: [event] });
  const sent = (() => {
    try {
      return fetch('/api/events', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true })
        .then((r) => r.ok)
        .catch(() => false);
    } catch {
      return Promise.resolve(false);
    }
  })();
  if (attribution) {
    session.attributionSent = true;
    safeSession(() => sessionStorage.setItem(SID, JSON.stringify(session)), undefined);
    // Si falla, la próxima llamada vuelve a mandar la atribución
    void sent.then((ok) => {
      if (!ok) {
        session.attributionSent = false;
        safeSession(() => sessionStorage.setItem(SID, JSON.stringify(session)), undefined);
      }
    });
  }
  return sent;
}
