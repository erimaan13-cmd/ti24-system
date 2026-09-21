'use client';
import { useEffect, useRef } from 'react';
import type { ServiceCode } from '@ti24/contracts';
import { track } from '@/lib/tracking';

/** Emite SERVICE_VIEWED cuando más del 50 % del bloque principal de la landing es visible. */
export function ServiceViewed({ serviceCode, children }: { serviceCode: ServiceCode; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let sent = false;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!sent && e.isIntersecting && e.intersectionRatio >= 0.5) {
          sent = true;
          void track('SERVICE_VIEWED', { service_code: serviceCode });
          io.disconnect();
        }
      }
    }, { threshold: [0.5] });
    io.observe(el);
    return () => io.disconnect();
  }, [serviceCode]);
  return <div ref={ref}>{children}</div>;
}
