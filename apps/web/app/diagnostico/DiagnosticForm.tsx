'use client';
import Link from 'next/link';
import Script from 'next/script';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { PUBLIC_FORM_SERVICES, ServiceCode, type LeadIntakeResult } from '@ti24/contracts';
import { diagnostic, serviceNames } from '@/content/es';
import { anonymousId, currentSession, firstTouch, lastTouch, track } from '@/lib/tracking';

const t = diagnostic.form;
const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export function DiagnosticForm() {
  const router = useRouter();
  const params = useSearchParams();
  const pre = ServiceCode.safeParse(params.get('servicio'));
  const initialService = pre.success && (PUBLIC_FORM_SERVICES as readonly string[]).includes(pre.data) ? pre.data : 'DIAG';

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const started = useRef(false);
  const eventId = useRef<string | null>(null); // mismo id si la persona reintenta: el servidor no duplica

  function onFirstInteraction() {
    if (started.current) return;
    started.current = true;
    void track('FORM_STARTED', { service_code: initialService, metadata: { form_id: 'diagnostico' } });
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setFormError(null);
    const fd = new FormData(e.currentTarget);
    const str = (k: string) => String(fd.get(k) ?? '');
    eventId.current ??= crypto.randomUUID();
    const { session } = currentSession();
    const payload = {
      event_id: eventId.current,
      form_id: 'diagnostico',
      lang: 'es',
      anonymous_id: anonymousId(),
      session_id: session.id,
      page_path: location.pathname,
      first_touch: firstTouch(),
      last_touch: lastTouch(),
      website: str('website'),
      turnstile_token: (fd.get('cf-turnstile-response') as string | null) || null,
      fields: {
        full_name: str('full_name'),
        email: str('email'),
        company: str('company'),
        service_code: str('service_code'),
        message: str('message'),
        phone: str('phone'),
        company_size: str('company_size') || null,
        privacy_accepted: fd.get('privacy_accepted') === 'on',
        marketing_consent: fd.get('marketing_consent') === 'on',
      },
    };
    try {
      const res = await fetch('/api/leads', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const data = (await res.json().catch(() => ({ ok: false, error: 'server_error' }))) as LeadIntakeResult;
      if (data.ok) {
        router.push('/gracias');
        return;
      }
      if (data.error === 'invalid' && data.issues) {
        setErrors(data.issues);
        const first = Object.keys(data.issues)[0];
        if (first) document.getElementById(`f-${first}`)?.focus();
      } else {
        setErrors({});
        setFormError(data.error === 'rate_limited' ? t.errorRate : data.error === 'captcha_failed' ? t.errorCaptcha : t.errorGeneric);
      }
    } catch {
      setFormError(t.errorGeneric);
    }
    setSubmitting(false);
  }

  const inv = (k: string) => (errors[k] ? { 'aria-invalid': true as const, 'aria-describedby': `f-${k}-error` } : {});
  const err = (k: string) => (errors[k] ? <span className="error" id={`f-${k}-error`}>{errors[k]}</span> : null);

  return (
    <form noValidate onSubmit={onSubmit} onFocusCapture={onFirstInteraction} className="form-grid" aria-describedby={formError ? 'form-error' : undefined}>
      {siteKey ? <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer /> : null}
      <div className="form-grid form-grid-2">
        <div className="field">
          <label htmlFor="f-full_name">{t.full_name}</label>
          <input id="f-full_name" name="full_name" className="input" autoComplete="name" required maxLength={120} {...inv('full_name')} />
          {err('full_name')}
        </div>
        <div className="field">
          <label htmlFor="f-company">{t.company}</label>
          <input id="f-company" name="company" className="input" autoComplete="organization" required maxLength={160} {...inv('company')} />
          {err('company')}
        </div>
      </div>
      <div className="field">
        <label htmlFor="f-email">{t.email}</label>
        <input id="f-email" name="email" type="email" className="input" autoComplete="email" inputMode="email" required maxLength={200} {...inv('email')} />
        {errors.email ? err('email') : <span className="hint">{t.emailHint}</span>}
      </div>
      <div className="field">
        <label htmlFor="f-service_code">{t.service_code}</label>
        <select id="f-service_code" name="service_code" className="select" defaultValue={initialService} {...inv('service_code')}>
          {PUBLIC_FORM_SERVICES.map((code) => <option key={code} value={code}>{serviceNames[code]}</option>)}
        </select>
        {err('service_code')}
      </div>
      <div className="field">
        <label htmlFor="f-message">{t.message}</label>
        <textarea id="f-message" name="message" className="textarea" required maxLength={2000} {...inv('message')} />
        {errors.message ? err('message') : <span className="hint">{t.messageHint}</span>}
      </div>
      <div className="form-grid form-grid-2">
        <div className="field">
          <label htmlFor="f-phone">{t.phone}</label>
          <input id="f-phone" name="phone" type="tel" className="input" autoComplete="tel" inputMode="tel" maxLength={30} {...inv('phone')} />
          {err('phone')}
        </div>
        <div className="field">
          <label htmlFor="f-company_size">{t.company_size}</label>
          <select id="f-company_size" name="company_size" className="select" defaultValue="">
            {Object.entries(t.sizeOptions).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          </select>
        </div>
      </div>
      {/* Honeypot: invisible para personas; si se llena, es un bot */}
      <div className="hp" aria-hidden="true">
        <label htmlFor="f-website">No llenar</label>
        <input id="f-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <div>
        <label className="check">
          <input id="f-privacy_accepted" type="checkbox" name="privacy_accepted" required {...inv('privacy_accepted')} />
          <span>{t.privacy} <Link href="/aviso-de-privacidad" target="_blank">{t.privacyLink}</Link>.</span>
        </label>
        {err('privacy_accepted')}
        <label className="check">
          <input type="checkbox" name="marketing_consent" />
          <span className="muted">{t.marketing}</span>
        </label>
      </div>
      {siteKey ? <div className="cf-turnstile" data-sitekey={siteKey} data-language="es" /> : null}
      {formError ? <p className="notice notice-danger" id="form-error" role="alert">{formError}</p> : null}
      <div>
        <button type="submit" className="btn btn-primary" disabled={submitting} aria-busy={submitting}>
          {submitting ? t.submitting : t.submit}
        </button>
      </div>
    </form>
  );
}
