'use client';

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';

const REFRESH_THROTTLE_MS = 2000;

function notifyAccountRefresh() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('wallet:invalidate'));
}

export function PublicSessionWatchdog() {
  const lastAttemptRef = useRef(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const refresh = async () => {
      if (document.visibilityState === 'hidden') return;
      const now = Date.now();
      if (now - lastAttemptRef.current < REFRESH_THROTTLE_MS) return;
      lastAttemptRef.current = now;

      const { data } = await supabase.auth.getSession();
      if (data.session?.user) {
        notifyAccountRefresh();
        return;
      }

      const refreshed = await supabase.auth.refreshSession().catch(() => null);
      if (refreshed?.data?.session?.user) {
        notifyAccountRefresh();
      }
    };

    const handleFocus = () => {
      void refresh();
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void refresh();
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
  }, []);

  return null;
}
