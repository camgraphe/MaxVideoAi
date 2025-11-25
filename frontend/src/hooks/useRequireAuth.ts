'use client';

import type { Session, User } from '@supabase/supabase-js';
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
import { consumeLogoutIntent } from '@/lib/logout-intent';

type RequireAuthResult = {
  userId: string | null;
  user: User | null;
  session: Session | null;
  loading: boolean;
};

export function useRequireAuth(): RequireAuthResult {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
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
        const [sessionResult, userResult] = await Promise.all([
          supabase.auth.getSession(),
          supabase.auth.getUser(),
        ]);
        if (cancelled) return;
        const nextSession = sessionResult.data.session ?? null;
        const nextUser = userResult.data.user ?? null;
        setSession(nextSession);
        setUser(nextUser);
        if (!nextUser) {
          redirectToLogin();
        }
      } catch {
        if (cancelled) return;
        setSession(null);
        setUser(null);
        redirectToLogin();
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    ensureSession();

    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (cancelled) return;
      setSession(newSession ?? null);
      const {
        data: { user: refreshedUser },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      setUser(refreshedUser ?? null);
      if (!refreshedUser) {
        redirectToLogin();
      }
    });

    return () => {
      cancelled = true;
      subscription?.subscription.unsubscribe();
    };
  }, [redirectToLogin]);

  useEffect(() => {
    const userId = user?.id ?? null;
    if (!userId) {
      identifiedRef.current = null;
      tagsSignatureRef.current = null;
      return;
    }
    const supaUser = user ?? null;
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
  }, [user]);

  return {
    userId: user?.id ?? null,
    user,
    session,
    loading,
  };
}
