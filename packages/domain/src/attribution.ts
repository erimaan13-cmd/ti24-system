/**
 * Normalización de atribución (AT-11 §16, D-16).
 * Convierte señales crudas (UTM, referrer, click ids, REF de WhatsApp) en source/medium/platform.
 * P0 prioriza orgánico: los click ids de pauta se guardan, pero se reportan hasta P2.
 */
import type { RawAttribution } from '@ti24/contracts';

export type TouchKind = 'web' | 'whatsapp' | 'manual' | 'referral' | 'event';

export interface NormalizedTouch {
  source: string;
  medium: string;
  platform: string | null;
  campaign: string | null;
  content: string | null;
  term: string | null;
  landing_path: string | null;
  referrer: string | null;
  ref_code: string | null;
  kind: TouchKind;
  occurred_at: string;
}

const SEARCH_ENGINES: Array<[RegExp, string]> = [
  [/(^|\.)google\./, 'google'],
  [/(^|\.)bing\.com$/, 'bing'],
  [/(^|\.)duckduckgo\.com$/, 'duckduckgo'],
  [/(^|\.)search\.yahoo\.com$|(^|\.)yahoo\.com$/, 'yahoo'],
  [/(^|\.)ecosia\.org$/, 'ecosia'],
];

const SOCIAL: Array<[RegExp, string, string]> = [
  // [host, source, platform]
  [/(^|\.)(facebook\.com|fb\.com|m\.facebook\.com|l\.facebook\.com|lm\.facebook\.com)$/, 'meta', 'facebook'],
  [/(^|\.)(instagram\.com|l\.instagram\.com)$/, 'meta', 'instagram'],
  [/(^|\.)(linkedin\.com|lnkd\.in)$/, 'linkedin', 'linkedin'],
  [/(^|\.)tiktok\.com$/, 'tiktok', 'tiktok'],
  [/(^|\.)(t\.co|twitter\.com|x\.com)$/, 'x', 'x'],
  [/(^|\.)youtube\.com$/, 'youtube', 'youtube'],
  [/(^|\.)(wa\.me|whatsapp\.com|web\.whatsapp\.com)$/, 'whatsapp', 'whatsapp'],
];

const PAID_MEDIUMS = new Set(['cpc', 'ppc', 'paid', 'paid_search', 'paid_social', 'display', 'cpm']);

function hostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

const lower = (v: string | null | undefined) => (v ? v.trim().toLowerCase() : null);

/**
 * @param raw   señales crudas capturadas por el navegador (o null = sin datos → directo)
 * @param ownHosts hosts propios; un referrer propio no cuenta como referido
 */
export function normalizeAttribution(
  raw: RawAttribution | null,
  ownHosts: string[] = ['ti24.com.mx', 'www.ti24.com.mx', 'localhost'],
): NormalizedTouch {
  const base: NormalizedTouch = {
    source: 'direct',
    medium: 'none',
    platform: null,
    campaign: raw?.utm_campaign ?? null,
    content: raw?.utm_content ?? null,
    term: raw?.utm_term ?? null,
    landing_path: raw?.landing_path ?? null,
    referrer: raw?.referrer ?? null,
    ref_code: raw?.ref_code ?? null,
    kind: 'web',
    occurred_at: raw?.occurred_at ?? new Date().toISOString(),
  };
  if (!raw) return base;

  const src = lower(raw.utm_source);
  const med = lower(raw.utm_medium);
  const clicks = raw.click_ids ?? {};

  // 1) Click ids de pauta (se guardan; el reporte de pauta llega en P2)
  if (clicks.gclid) return { ...base, source: 'google', medium: 'paid_search', platform: 'google_ads' };
  if (clicks.li_fat_id) return { ...base, source: 'linkedin', medium: 'paid_social', platform: 'linkedin' };

  // 2) UTM explícitos
  if (src) {
    const paid = med ? PAID_MEDIUMS.has(med) : false;
    if (src === 'google') return { ...base, source: 'google', medium: paid ? 'paid_search' : med ?? 'organic', platform: paid ? 'google_ads' : 'seo' };
    if (src === 'facebook' || src === 'instagram' || src === 'meta' || src === 'fb' || src === 'ig') {
      const platform = src === 'instagram' || src === 'ig' ? 'instagram' : 'facebook';
      return { ...base, source: 'meta', medium: paid || clicks.fbclid ? 'paid_social' : 'organic_social', platform };
    }
    if (src === 'linkedin') return { ...base, source: 'linkedin', medium: paid ? 'paid_social' : 'organic_social', platform: 'linkedin' };
    if (src === 'tiktok') return { ...base, source: 'tiktok', medium: paid ? 'paid_social' : 'organic_social', platform: 'tiktok' };
    if (src === 'whatsapp') return { ...base, source: 'whatsapp', medium: 'messaging', platform: 'whatsapp', kind: 'whatsapp' };
    if (med === 'email') return { ...base, source: src, medium: 'email', platform: 'newsletter' };
    return { ...base, source: src, medium: med ?? 'referral', platform: null };
  }
  if (med === 'email') return { ...base, source: 'email', medium: 'email', platform: 'newsletter' };

  // 3) fbclid sin UTM: tráfico de Meta (orgánico compartido o pauta; sin UTM no se sabe → orgánico)
  if (clicks.fbclid) return { ...base, source: 'meta', medium: 'organic_social', platform: 'facebook' };

  // 4) Referrer
  const host = hostOf(raw.referrer);
  if (host && !ownHosts.includes(host)) {
    for (const [re, name] of SEARCH_ENGINES) if (re.test(host)) return { ...base, source: name, medium: 'organic', platform: 'seo' };
    for (const [re, source, platform] of SOCIAL)
      if (re.test(host))
        return source === 'whatsapp'
          ? { ...base, source, medium: 'messaging', platform, kind: 'whatsapp' }
          : { ...base, source, medium: 'organic_social', platform };
    return { ...base, source: host.replace(/^www\./, ''), medium: 'referral', platform: null, kind: 'referral' };
  }

  // 5) Nada → directo
  return base;
}

/** Código REF corto y estable para WhatsApp, derivado del anonymous_id (AT-11 §16). */
export function refCodeFor(anonymousId: string): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O/1/I para dictarlo sin errores
  const hex = anonymousId.replace(/-/g, '');
  let n = 0;
  for (let i = 0; i < hex.length; i++) n = (n * 31 + parseInt(hex[i]!, 16)) >>> 0;
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += alphabet[n % alphabet.length];
    n = Math.floor(n / alphabet.length);
  }
  return `REF-${code}`;
}
