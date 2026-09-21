'use client';
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { ServiceCode } from '@ti24/contracts';
import { track } from '@/lib/tracking';

/** Enlace de llamado a la acción que emite CTA_CLICKED con su identificador. */
export function TrackedLink({
  href, ctaId, channel = 'form', serviceCode = null, className, children,
}: {
  href: string; ctaId: string; channel?: 'form' | 'whatsapp' | 'phone' | 'email';
  serviceCode?: ServiceCode | null; className?: string; children: ReactNode;
}) {
  return (
    <Link href={href} className={className} data-cta={ctaId}
      onClick={() => { void track('CTA_CLICKED', { service_code: serviceCode, metadata: { cta_id: ctaId, channel } }); }}>
      {children}
    </Link>
  );
}
