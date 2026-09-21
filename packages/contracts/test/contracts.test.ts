import { describe, expect, it } from 'vitest';
import { BrowserEvent, EventBatch, LeadSubmission, fieldIssues } from '../src';

const baseEvent = {
  event_id: '11111111-1111-4111-8111-111111111111',
  event_name: 'PAGE_VIEWED',
  schema_version: 1,
  occurred_at: '2026-09-21T15:04:05.123Z',
  anonymous_id: '22222222-2222-4222-8222-222222222222',
  session_id: '33333333-3333-4333-8333-333333333333',
  page: { path: '/desarrollo-de-software', title: 'Software', referrer: 'https://www.google.com/' },
};

const baseLead = {
  event_id: '44444444-4444-4444-8444-444444444444',
  form_id: 'diagnostico',
  anonymous_id: baseEvent.anonymous_id,
  session_id: baseEvent.session_id,
  page_path: '/diagnostico',
  fields: {
    full_name: 'Contacto Demo',
    email: 'Compras@Aceros-Demo.example',
    company: 'Aceros Demo SA de CV',
    service_code: 'SYS',
    message: 'Necesitamos un sistema de cotizaciones.',
    privacy_accepted: true,
  },
};

describe('contrato de eventos v1', () => {
  it('acepta un evento de navegador válido y rellena valores por defecto', () => {
    const e = BrowserEvent.parse(baseEvent);
    expect(e.contact_ref).toBeNull();
    expect(e.metadata).toEqual({});
  });
  it('rechaza campos personales en un evento de navegador (esquema estricto)', () => {
    expect(BrowserEvent.safeParse({ ...baseEvent, email: 'x@y.com' }).success).toBe(false);
    expect(BrowserEvent.safeParse({ ...baseEvent, metadata: { email: 'x@y.com' } }).success).toBe(false);
  });
  it('el navegador no puede emitir FORM_SUBMITTED (lo emite el servidor)', () => {
    expect(BrowserEvent.safeParse({ ...baseEvent, event_name: 'FORM_SUBMITTED' }).success).toBe(false);
  });
  it('rechaza service_code fuera del catálogo y lotes vacíos', () => {
    expect(BrowserEvent.safeParse({ ...baseEvent, service_code: 'AUT' }).success).toBe(false);
    expect(EventBatch.safeParse({ events: [] }).success).toBe(false);
  });
});

describe('envío del formulario de diagnóstico', () => {
  it('normaliza el correo a minúsculas', () => {
    expect(LeadSubmission.parse(baseLead).fields.email).toBe('compras@aceros-demo.example');
  });
  it('rechaza el envío sin aceptar el aviso de privacidad', () => {
    const r = LeadSubmission.safeParse({ ...baseLead, fields: { ...baseLead.fields, privacy_accepted: false } });
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldIssues(r.error).privacy_accepted).toBe('Debes aceptar el aviso de privacidad');
  });
  it('rechaza correo inválido y mensaje corto con mensajes en español', () => {
    const r = LeadSubmission.safeParse({ ...baseLead, fields: { ...baseLead.fields, email: 'no-es-correo', message: 'hola' } });
    expect(r.success).toBe(false);
    if (!r.success) {
      const issues = fieldIssues(r.error);
      expect(issues.email).toBe('Correo no válido');
      expect(issues.message).toMatch(/mínimo 10/);
    }
  });
  it('rechaza campos desconocidos', () => {
    expect(LeadSubmission.safeParse({ ...baseLead, fields: { ...baseLead.fields, rfc: 'XAXX010101000' } }).success).toBe(false);
  });
});
