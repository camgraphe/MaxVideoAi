'use client';

import type { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { clearSupabaseCookies, syncSupabaseCookies } from '@/lib/supabase-cookies';

type RequireAuthResult = {
  userId: string | null;
  session: Session | null;
  loading: boolean;
};

export function useRequireAuth(): RequireAuthResult {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const redirectingRef = useRef(false);

  const nextPath = useMemo(() => {
    const base = pathname ?? '/app';
    const search = searchParams?.toString();
    return search ? `${base}?${search}` : base;
  }, [pathname, searchParams]);

  const redirectToLogin = useCallback(() => {
    if (redirectingRef.current) return;
    redirectingRef.current = true;
    const target =
      nextPath && nextPath !== '/login' ? `/login?next=${encodeURIComponent(nextPath)}` : '/login';
    router.replace(target);
  }, [router, nextPath]);

  useEffect(() => {
    let cancelled = false;

    async function ensureSession() {
      try {
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        const current = data.session ?? null;
        if (!current?.user?.id) {
          setSession(null);
          setLoading(false);
          clearSupabaseCookies();
          redirectToLogin();
          return;
        }
        setSession(current);
        setLoading(false);
        syncSupabaseCookies(current);
      } catch {
        if (cancelled) return;
        setSession(null);
        setLoading(false);
        clearSupabaseCookies();
        redirectToLogin();
      }
    }

    ensureSession();

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (cancelled) return;
      if (!newSession?.user?.id) {
        setSession(null);
        clearSupabaseCookies();
        redirectToLogin();
      } else {
        setSession(newSession);
        syncSupabaseCookies(newSession);
      }
    });

    return () => {
      cancelled = true;
      subscription?.subscription.unsubscribe();
    };
  }, [redirectToLogin]);

  return {
    userId: session?.user?.id ?? null,
    session,
    loading,
  };
}
