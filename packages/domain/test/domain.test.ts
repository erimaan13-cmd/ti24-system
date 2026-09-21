import { describe, expect, it } from 'vitest';
import {
  canConvertLead,
  canTransitionLead,
  canTransitionProposal,
  corporateDomain,
  firstResponseDue,
  formatFolio,
  formatRatio,
  normalizeAttribution,
  proposalTotals,
  refCodeFor,
  shouldCreateProject,
  validateStageChange,
  winRate,
} from '../src';
import type { RawAttribution } from '@ti24/contracts';

const raw = (p: Partial<RawAttribution>): RawAttribution => ({
  utm_source: null, utm_medium: null, utm_campaign: null, utm_content: null, utm_term: null,
  referrer: null, landing_path: '/desarrollo-de-software', click_ids: {}, ref_code: null,
  occurred_at: '2026-09-21T15:00:00.000Z', ...p,
});

describe('atribución (AT-11 §16)', () => {
  it('Google orgánico por referrer, sin UTM', () => {
    const t = normalizeAttribution(raw({ referrer: 'https://www.google.com/' }));
    expect([t.source, t.medium, t.platform]).toEqual(['google', 'organic', 'seo']);
    expect(t.landing_path).toBe('/desarrollo-de-software');
  });
  it('Google con dominio de país (google.com.mx)', () => {
    expect(normalizeAttribution(raw({ referrer: 'https://www.google.com.mx/search?q=x' })).source).toBe('google');
  });
  it('gclid = pauta de Google aunque no haya UTM', () => {
    const t = normalizeAttribution(raw({ click_ids: { gclid: 'abc' } }));
    expect([t.source, t.medium, t.platform]).toEqual(['google', 'paid_search', 'google_ads']);
  });
  it('utm_source=instagram sin medio pagado = redes orgánicas', () => {
    const t = normalizeAttribution(raw({ utm_source: 'Instagram', utm_medium: 'social' }));
    expect([t.source, t.medium, t.platform]).toEqual(['meta', 'organic_social', 'instagram']);
  });
  it('LinkedIn por referrer = orgánico social', () => {
    const t = normalizeAttribution(raw({ referrer: 'https://www.linkedin.com/feed/' }));
    expect([t.source, t.medium]).toEqual(['linkedin', 'organic_social']);
  });
  it('WhatsApp por referrer marca kind=whatsapp', () => {
    const t = normalizeAttribution(raw({ referrer: 'https://wa.me/' }));
    expect([t.source, t.medium, t.kind]).toEqual(['whatsapp', 'messaging', 'whatsapp']);
  });
  it('referrer externo desconocido = referido', () => {
    const t = normalizeAttribution(raw({ referrer: 'https://www.canacintra-nl.org/socios' }));
    expect([t.source, t.medium, t.kind]).toEqual(['canacintra-nl.org', 'referral', 'referral']);
  });
  it('referrer propio no cuenta como referido → directo', () => {
    expect(normalizeAttribution(raw({ referrer: 'https://ti24.com.mx/' })).source).toBe('direct');
  });
  it('sin datos = directo / none', () => {
    const t = normalizeAttribution(null);
    expect([t.source, t.medium]).toEqual(['direct', 'none']);
  });
  it('utm_medium=email', () => {
    expect(normalizeAttribution(raw({ utm_source: 'boletin', utm_medium: 'email' })).medium).toBe('email');
  });
  it('código REF estable, 4 caracteres legibles', () => {
    const a = refCodeFor('20000000-0000-0000-0000-000000000001');
    expect(a).toMatch(/^REF-[A-HJ-NP-Z2-9]{4}$/);
    expect(refCodeFor('20000000-0000-0000-0000-000000000001')).toBe(a);
    expect(refCodeFor('20000000-0000-0000-0000-000000000002')).not.toBe(a);
  });
});

describe('leads', () => {
  it('dominio corporativo excluye proveedores públicos', () => {
    expect(corporateDomain('compras@Aceros-Demo.example')).toBe('aceros-demo.example');
    expect(corporateDomain('alguien@gmail.com')).toBeNull();
    expect(corporateDomain('alguien@hotmail.com')).toBeNull();
    expect(corporateDomain('sin-arroba')).toBeNull();
  });
  it('estados: convertido y duplicado son finales; solo calificado se convierte', () => {
    expect(canTransitionLead('new', 'qualified')).toBe(true);
    expect(canTransitionLead('converted', 'new')).toBe(false);
    expect(canTransitionLead('duplicate', 'qualified')).toBe(false);
    expect(canConvertLead('qualified')).toBe(true);
    expect(canConvertLead('new')).toBe(false);
  });
  it('primera respuesta: siguiente día hábil (viernes → lunes)', () => {
    const friday = new Date('2026-09-25T17:00:00Z');
    expect(firstResponseDue(friday).toISOString()).toBe('2026-09-28T17:00:00.000Z');
    const monday = new Date('2026-09-21T10:00:00Z');
    expect(firstResponseDue(monday).toISOString()).toBe('2026-09-22T10:00:00.000Z');
  });
});

describe('pipeline y propuestas', () => {
  it('ganar exige propuesta aceptada y monto', () => {
    expect(validateStageChange({ from: 'negotiation', to: 'won', hasAcceptedProposal: false, amount: 100 })).toContain('Para ganar se necesita una propuesta aceptada.');
    expect(validateStageChange({ from: 'negotiation', to: 'won', hasAcceptedProposal: true, amount: null })).toHaveLength(1);
    expect(validateStageChange({ from: 'proposal', to: 'won', hasAcceptedProposal: true, amount: 120000 })).toEqual([]);
  });
  it('perder exige motivo', () => {
    expect(validateStageChange({ from: 'discovery', to: 'lost', hasAcceptedProposal: false, amount: null })).toHaveLength(1);
    expect(validateStageChange({ from: 'discovery', to: 'lost', lostReason: 'Presupuesto', hasAcceptedProposal: false, amount: null })).toEqual([]);
  });
  it('una oportunidad cerrada no se mueve', () => {
    expect(validateStageChange({ from: 'won', to: 'discovery', hasAcceptedProposal: true, amount: 1 })).toContain('Una oportunidad cerrada no se puede mover.');
  });
  it('propuesta: borrador → enviada → aceptada; no se salta pasos', () => {
    expect(canTransitionProposal('draft', 'sent')).toBe(true);
    expect(canTransitionProposal('draft', 'accepted')).toBe(false);
    expect(canTransitionProposal('sent', 'accepted')).toBe(true);
    expect(canTransitionProposal('accepted', 'rejected')).toBe(false);
  });
  it('totales separan pago único y mensual', () => {
    expect(proposalTotals([
      { quantity: 1, unit_price: 100000, billing: 'one_time' },
      { quantity: 1, unit_price: 2000, billing: 'monthly' },
      { quantity: 2, unit_price: 0.105, billing: 'one_time' },
    ])).toEqual({ oneTime: 100000.21, monthly: 2000 });
  });
  it('folio y creación de proyecto', () => {
    expect(formatFolio(2026, 7)).toBe('TI24-2026-0007');
    expect(shouldCreateProject(['project', 'recurring'])).toBe(true);
    expect(shouldCreateProject(['recurring'])).toBe(false);
  });
});

describe('métricas: nunca un porcentaje engañoso', () => {
  it('menos de 5 cerradas = datos insuficientes', () => {
    const r = winRate(1, 0);
    expect(r.sufficient).toBe(false);
    expect(formatRatio(r)).toBe('Datos insuficientes (1 de 5)');
  });
  it('con muestra suficiente calcula el porcentaje', () => {
    expect(formatRatio(winRate(3, 2))).toBe('60 %');
  });
});
