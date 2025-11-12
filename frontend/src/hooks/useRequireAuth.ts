'use client';

import type { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import {
  disableClarityForVisitor,
  enableClarityForVisitor,
  ensureClarityVisitorId,
  isClarityEnabledForRuntime,
  queueClarityCommand,
} from '@/lib/clarity-client';
import { clearSupabaseCookies, syncSupabaseCookies } from '@/lib/supabase-cookies';
import { consumeLogoutIntent } from '@/lib/logout-intent';

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
  const identifiedRef = useRef<string | null>(null);
  const tagsSignatureRef = useRef<string | null>(null);
  const forcedClarityOptOutRef = useRef(false);

  const nextPath = useMemo(() => {
    const base = pathname ?? '/app';
    const search = searchParams?.toString();
    return search ? `${base}?${search}` : base;
  }, [pathname, searchParams]);

  const redirectToLogin = useCallback(() => {
    if (redirectingRef.current) return;
    if (consumeLogoutIntent()) {
      redirectingRef.current = true;
      router.replace('/');
      router.refresh();
      redirectingRef.current = false;
      return;
    }
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

  useEffect(() => {
    const userId = session?.user?.id ?? null;
    if (!userId) {
      identifiedRef.current = null;
      tagsSignatureRef.current = null;
      return;
    }
    const supaUser = session?.user ?? null;
    if (!supaUser) return;

    const appMeta = (supaUser.app_metadata ?? {}) as Record<string, unknown>;
    const userMeta = (supaUser.user_metadata ?? {}) as Record<string, unknown>;

    const role =
      typeof appMeta.role === 'string'
        ? appMeta.role
        : Array.isArray(appMeta.roles) && typeof appMeta.roles[0] === 'string'
          ? appMeta.roles[0]
          : undefined;

    const planCandidate =
      typeof appMeta.plan === 'string'
        ? appMeta.plan
        : typeof userMeta.plan === 'string'
          ? userMeta.plan
          : typeof userMeta.subscription === 'string'
            ? userMeta.subscription
            : undefined;

    const plan =
      typeof planCandidate === 'string' && planCandidate.trim().length > 0
        ? planCandidate
        : undefined;

    const currencyCandidate =
      typeof userMeta.preferred_currency === 'string'
        ? userMeta.preferred_currency
        : typeof userMeta.currency === 'string'
          ? userMeta.currency
          : undefined;

    const currency =
      typeof currencyCandidate === 'string' && currencyCandidate.trim().length > 0
        ? currencyCandidate
        : undefined;

    const email = typeof supaUser.email === 'string' ? supaUser.email : undefined;
    const normalizedRole = role ? role.toLowerCase() : undefined;
    const isInternal = Boolean(email && /@maxvideoai\.(com|ai)$/i.test(email));
    const isAdminRole = normalizedRole === 'admin';
    const shouldSkipClarity = isInternal || isAdminRole;

    if (shouldSkipClarity) {
      if (!forcedClarityOptOutRef.current) {
        disableClarityForVisitor();
        forcedClarityOptOutRef.current = true;
      }
    } else if (forcedClarityOptOutRef.current) {
      enableClarityForVisitor();
      forcedClarityOptOutRef.current = false;
    }

    if (!isClarityEnabledForRuntime()) return;
    if (shouldSkipClarity) return;

    if (identifiedRef.current !== userId) {
      identifiedRef.current = userId;
      queueClarityCommand('identify', userId);
    }

    const tags: Record<string, string> = {};
    tags.auth_state = 'signed_in';
    tags.user_uuid = userId;
    if (role) tags.role = role.toLowerCase();
    if (plan) tags.plan = plan.toLowerCase();
    if (currency) tags.currency = currency.toLowerCase();
    if (isInternal) tags.internal = 'true';

    const visitor = ensureClarityVisitorId();
    if (visitor) {
      tags.visitor = visitor;
    }

    const serialized = JSON.stringify(tags);
    if (tagsSignatureRef.current !== serialized) {
      tagsSignatureRef.current = serialized;
      Object.entries(tags).forEach(([key, value]) => {
        queueClarityCommand('set', key, value);
      });
    }
  }, [session]);

  return {
    userId: session?.user?.id ?? null,
    session,
    loading,
  };
}
