'use client';

import { useEffect, useMemo, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useSWRConfig } from 'swr';

const RESYNC_THROTTLE_MS = 5000;
const PROTECTED_PREFIXES = [
  '/app',
  '/dashboard',
  '/generate',
  '/jobs',
  '/billing',
  '/settings',
  '/video',
  '/library',
  '/connect',
  '/admin',
];

function isProtectedPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function shouldResyncKey(key: unknown): boolean {
  if (typeof key === 'string') {
    return key.startsWith('/api/') || key.startsWith('static-engines:');
  }
  if (Array.isArray(key)) {
    const head = key[0];
    return head === 'jobs' || head === 'image-pricing';
  }
  return false;
}

export function SWRFocusResync() {
  const { mutate } = useSWRConfig();
  const lastResyncRef = useRef(0);
  const pathname = usePathname();
  const shouldWatch = useMemo(() => isProtectedPath(pathname), [pathname]);

  useEffect(() => {
    if (!shouldWatch) return;
    if (typeof window === 'undefined') return;
    const resync = () => {
      if (document.visibilityState === 'hidden') return;
      const now = Date.now();
      if (now - lastResyncRef.current < RESYNC_THROTTLE_MS) return;
      lastResyncRef.current = now;
      void mutate(shouldResyncKey);
    };
    const handleFocus = () => {
      resync();
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        resync();
      }
    };
    window.addEventListener('focus', handleFocus);
    window.addEventListener('pageshow', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('pageshow', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [mutate, shouldWatch]);

  return null;
}
