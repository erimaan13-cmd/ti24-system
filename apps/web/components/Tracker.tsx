'use client';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { track } from '@/lib/tracking';

/** Emite PAGE_VIEWED en cada cambio de ruta (incluida la primera carga). */
export function Tracker() {
  const pathname = usePathname();
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (last.current === pathname) return;
    last.current = pathname;
    void track('PAGE_VIEWED');
  }, [pathname]);
  return null;
}
