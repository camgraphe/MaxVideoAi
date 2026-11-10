'use client';
import { useEffect, useRef } from 'react';

const INTERVAL_MS = 30_000;

/** Refresh only the latest loaded page, in place. Deep browsing never polls all visited pages. */
export function useLibraryAutoRefresh({ scopeKey, enabled, busy, refresh }: {
  scopeKey: string;
  enabled: boolean;
  busy: boolean;
  refresh: () => Promise<unknown>;
}) {
  const latest = useRef({ busy, refresh });
  latest.current = { busy, refresh };
  useEffect(() => {
    if (!enabled) return;
    let retired = false, pending = false, lastRefresh = Date.now();
    const update = () => {
      if (retired || pending || latest.current.busy || document.visibilityState !== 'visible' || navigator.onLine === false || Date.now() - lastRefresh < INTERVAL_MS) return;
      lastRefresh = Date.now();
      pending = true;
      // SWR retains the displayed data and exposes errors through its ordinary read state.
      void latest.current.refresh().catch(() => {}).finally(() => { pending = false; });
    };
    const timer = window.setInterval(update, INTERVAL_MS);
    document.addEventListener('visibilitychange', update);
    window.addEventListener('online', update);
    return () => {
      retired = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('online', update);
    };
  }, [enabled, scopeKey]);
}
