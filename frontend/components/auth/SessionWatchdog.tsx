'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useSWRConfig } from 'swr';

const REFRESH_DEBOUNCE_MS = 1500;
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

function isAuthPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname.startsWith('/login') || pathname.startsWith('/auth');
}

function notifyAccountRefresh() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('wallet:invalidate'));
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

export function SessionWatchdog() {
  const pathname = usePathname();
  const { mutate } = useSWRConfig();
  const lastAttemptRef = useRef(0);

  const shouldWatch = useMemo(() => {
    if (isAuthPath(pathname)) return false;
    return isProtectedPath(pathname);
  }, [pathname]);

  const refreshSession = useCallback(() => {
    if (!shouldWatch) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    const now = Date.now();
    if (now - lastAttemptRef.current < REFRESH_DEBOUNCE_MS) return;
    lastAttemptRef.current = now;
    notifyAccountRefresh();
    void mutate(shouldResyncKey);
  }, [mutate, shouldWatch]);

  useEffect(() => {
    if (!shouldWatch) return;
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void refreshSession();
      }
    };
    const handleFocus = () => {
      void refreshSession();
    };
    window.addEventListener('focus', handleFocus);
    window.addEventListener('pageshow', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('pageshow', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [refreshSession, shouldWatch]);

  return null;
}
