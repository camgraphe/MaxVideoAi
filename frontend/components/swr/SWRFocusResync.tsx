'use client';

import { useEffect, useMemo, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useSWRConfig } from 'swr';
import { isFocusResyncPath, shouldResyncKey } from './focus-resync-policy';

const RESYNC_THROTTLE_MS = 5000;
export function SWRFocusResync() {
  const { mutate } = useSWRConfig();
  const lastResyncRef = useRef(0);
  const pathname = usePathname();
  const shouldWatch = useMemo(() => isFocusResyncPath(pathname), [pathname]);

  useEffect(() => {
    if (!shouldWatch) return;
    if (typeof window === 'undefined') return;
    const resync = () => {
      if (document.visibilityState === 'hidden') return;
      const now = Date.now();
      if (now - lastResyncRef.current < RESYNC_THROTTLE_MS) return;
      lastResyncRef.current = now;
      window.dispatchEvent(new Event('wallet:invalidate'));
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
