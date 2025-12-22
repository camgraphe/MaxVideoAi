'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';

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

export function SessionWatchdog() {
  const router = useRouter();
  const pathname = usePathname();
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
    router.refresh();
    notifyAccountRefresh();
  }, [router, shouldWatch]);

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
