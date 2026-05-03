'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

import { hasStoredSupabaseSession } from '@/lib/supabase-session-presence';

const PublicSessionWatchdog = dynamic(
  () => import('@/components/auth/PublicSessionWatchdog').then((mod) => mod.PublicSessionWatchdog),
  { ssr: false }
);

export function DeferredPublicSessionWatchdog() {
  const [shouldMount, setShouldMount] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!hasStoredSupabaseSession()) return;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let idleId: number | null = null;

    const activate = () => {
      if ('requestIdleCallback' in window) {
        idleId = window.requestIdleCallback(() => setShouldMount(true), { timeout: 1500 });
        return;
      }
      timeoutId = globalThis.setTimeout(() => setShouldMount(true), 400);
    };

    if (document.readyState === 'complete') {
      activate();
    } else {
      window.addEventListener('load', activate, { once: true });
    }

    return () => {
      window.removeEventListener('load', activate);
      if (idleId != null && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId != null) {
        globalThis.clearTimeout(timeoutId);
      }
    };
  }, []);

  return shouldMount ? <PublicSessionWatchdog /> : null;
}
