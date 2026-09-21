'use client';
import { useEffect, useState } from 'react';
import type { ServiceCode } from '@ti24/contracts';
import { refCodeFor } from '@ti24/domain';
import { anonymousId, track } from '@/lib/tracking';

/**
 * Botón de WhatsApp con código REF (AT-11 §16): el mensaje prellenado incluye un código corto
 * ligado al visitante anónimo; al capturar el lead a mano, ese código recupera su atribución.
 * Se oculta si no hay número configurado (NEXT_PUBLIC_WHATSAPP_NUMBER).
 */
export function WhatsAppButton({ context, serviceCode = null }: { context: string; serviceCode?: ServiceCode | null }) {
  const number = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;
  const [ref, setRef] = useState<string | null>(null);
  useEffect(() => { setRef(refCodeFor(anonymousId())); }, []);
  if (!number || !/^\d{10,15}$/.test(number)) return null;
  const text = `Hola, vengo de la página de ${context} (${ref ?? 'REF'})`;
  return (
    <a className="btn btn-secondary" href={`https://wa.me/${number}?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer"
      onClick={() => { if (ref) void track('CTA_CLICKED', { service_code: serviceCode, metadata: { cta_id: 'whatsapp', channel: 'whatsapp', ref_code: ref } }); }}>
      Escríbenos por WhatsApp
    </a>
  );
}
