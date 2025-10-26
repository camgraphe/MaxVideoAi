'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import { syncSupabaseCookies } from '@/lib/supabase-cookies';
import { LOGIN_NEXT_STORAGE_KEY } from '@/lib/auth-storage';

function resolveNextTarget(): string {
  if (typeof window === 'undefined') return '/app';
  const stored = window.sessionStorage.getItem(LOGIN_NEXT_STORAGE_KEY);
  return stored && stored.startsWith('/') ? stored : '/app';
}

function clearNextTarget() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(LOGIN_NEXT_STORAGE_KEY);
}

function cleanupAuthHash() {
  if (typeof window === 'undefined') return;
  if (!window.location.hash) return;
  if (!window.location.hash.includes('access_token=')) return;
  const url = new URL(window.location.href);
  url.hash = '';
  window.history.replaceState(null, '', url.toString());
}

export function AuthCallbackHandler() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash;
    if (!hash || !hash.includes('access_token=')) return;

    let handled = false;

    const finalize = (session: Session | null) => {
      if (!session?.user || handled) return;
      handled = true;
      syncSupabaseCookies(session);
      const target = resolveNextTarget();
      clearNextTarget();
      cleanupAuthHash();
      router.replace(target);
    };

    void supabase.auth.getSession().then(({ data }) => {
      finalize(data.session ?? null);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      finalize(session ?? null);
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, [router]);

  return null;
}
