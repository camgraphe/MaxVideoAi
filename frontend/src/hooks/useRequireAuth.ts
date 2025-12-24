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
import { clearLastKnownAccount, readLastKnownUserId, writeLastKnownUserId } from '@/lib/last-known';

type RequireAuthResult = {
  userId: string | null;
  user: User | null;
  session: Session | null;
  loading: boolean;
  authStatus: 'unknown' | 'refreshing' | 'authed' | 'loggedOut';
};

const AUTH_SESSION_LOOKUP_TIMEOUT_MS = 4000;
const AUTH_USER_LOOKUP_TIMEOUT_MS = 4000;
const AUTH_FOCUS_THROTTLE_MS = 2000;

let refreshPromise: Promise<Session | null> | null = null;

async function refreshSessionOnce(): Promise<Session | null> {
  if (refreshPromise) {
    return refreshPromise;
  }
  refreshPromise = supabase.auth
    .refreshSession()
    .then(({ data }) => data.session ?? null)
    .catch(() => null)
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('timeout')), timeoutMs);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      }
    );
  });
}

export function useRequireAuth(): RequireAuthResult {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authStatus, setAuthStatus] = useState<'unknown' | 'refreshing' | 'authed' | 'loggedOut'>('unknown');
  const redirectingRef = useRef(false);
  const identifiedRef = useRef<string | null>(null);
  const tagsSignatureRef = useRef<string | null>(null);
  const forcedClarityOptOutRef = useRef(false);
  const ensureSessionInFlightRef = useRef<Promise<void> | null>(null);
  const lastFocusRef = useRef(0);
  const cancelledRef = useRef(false);
  const initialResolvedRef = useRef(false);
  const lastKnownSessionRef = useRef<Session | null>(null);
  const lastKnownUserRef = useRef<User | null>(null);
  const initialLastKnownUserId = useMemo(() => readLastKnownUserId(), []);
  const lastKnownUserIdRef = useRef<string | null>(initialLastKnownUserId);

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

  const applySession = useCallback((nextSession: Session) => {
    const nextUser = nextSession.user ?? null;
    setSession(nextSession);
    setUser(nextUser);
    lastKnownSessionRef.current = nextSession;
    lastKnownUserRef.current = nextUser;
    if (nextUser?.id) {
      lastKnownUserIdRef.current = nextUser.id;
      writeLastKnownUserId(nextUser.id);
    }
    setAuthStatus('authed');
    if (!initialResolvedRef.current) {
      setLoading(false);
      initialResolvedRef.current = true;
    }
  }, []);

  const markRefreshing = useCallback(() => {
    setAuthStatus((prev) => (prev === 'loggedOut' ? prev : 'refreshing'));
  }, []);

  const markLoggedOut = useCallback(() => {
    setSession(null);
    setUser(null);
    lastKnownSessionRef.current = null;
    lastKnownUserRef.current = null;
    lastKnownUserIdRef.current = null;
    clearLastKnownAccount();
    writeLastKnownUserId(null);
    setAuthStatus('loggedOut');
    if (!initialResolvedRef.current) {
      setLoading(false);
      initialResolvedRef.current = true;
    }
    redirectToLogin();
  }, [redirectToLogin]);

  const ensureSession = useCallback(async () => {
    if (ensureSessionInFlightRef.current) {
      await ensureSessionInFlightRef.current;
      return;
    }
    const run = (async () => {
      try {
        const sessionResult = await withTimeout(supabase.auth.getSession(), AUTH_SESSION_LOOKUP_TIMEOUT_MS);
        if (cancelledRef.current) return;
        let nextSession = sessionResult.data.session ?? null;
        if (!nextSession) {
          markRefreshing();
          const refreshed = await withTimeout(refreshSessionOnce(), AUTH_SESSION_LOOKUP_TIMEOUT_MS).catch(() => null);
          if (cancelledRef.current) return;
          nextSession = refreshed ?? null;
        }
        if (!nextSession || !nextSession.user) {
          const hasLastKnownUser = Boolean(lastKnownUserRef.current?.id ?? lastKnownUserIdRef.current);
          if (hasLastKnownUser) {
            markRefreshing();
            if (!initialResolvedRef.current) {
              setLoading(false);
              initialResolvedRef.current = true;
            }
            return;
          }
          markLoggedOut();
          return;
        }
        applySession(nextSession);

        try {
          const userResult = await withTimeout(supabase.auth.getUser(), AUTH_USER_LOOKUP_TIMEOUT_MS);
          if (cancelledRef.current) return;
          const verifiedUser = userResult.data.user ?? null;
          if (verifiedUser) {
            setUser(verifiedUser);
            lastKnownUserRef.current = verifiedUser;
            lastKnownUserIdRef.current = verifiedUser.id;
            writeLastKnownUserId(verifiedUser.id);
            return;
          }
        } catch {
          // Keep the local session/user if the network validation hangs or fails.
        }
      } catch {
        if (cancelledRef.current) return;
        markRefreshing();
        if (!initialResolvedRef.current) {
          setLoading(false);
          initialResolvedRef.current = true;
        }
      }
    })();
    ensureSessionInFlightRef.current = run;
    try {
      await run;
    } finally {
      ensureSessionInFlightRef.current = null;
    }
  }, [applySession, markLoggedOut, markRefreshing]);

  useEffect(() => {
    cancelledRef.current = false;
    void ensureSession();

    const { data: subscription } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (cancelledRef.current) return;
      if (newSession?.user) {
        applySession(newSession);
        return;
      }
      if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
        markLoggedOut();
        return;
      }
      const sessionResult = await supabase.auth.getSession().catch(() => null);
      if (cancelledRef.current) return;
      const recoveredSession = sessionResult?.data?.session ?? null;
      if (recoveredSession?.user) {
        applySession(recoveredSession);
        return;
      }
      const hasLastKnownUser = Boolean(lastKnownUserRef.current?.id ?? lastKnownUserIdRef.current);
      if (hasLastKnownUser) {
        markRefreshing();
        if (!initialResolvedRef.current) {
          setLoading(false);
          initialResolvedRef.current = true;
        }
        return;
      }
      markLoggedOut();
    });

    return () => {
      cancelledRef.current = true;
      subscription?.subscription.unsubscribe();
    };
  }, [applySession, ensureSession, markLoggedOut, markRefreshing]);

  useEffect(() => {
    const handleFocus = () => {
      const now = Date.now();
      if (now - lastFocusRef.current < AUTH_FOCUS_THROTTLE_MS) return;
      lastFocusRef.current = now;
      void ensureSession();
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        handleFocus();
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
  }, [ensureSession]);

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
    userId: user?.id ?? lastKnownUserIdRef.current ?? null,
    user,
    session,
    loading,
    authStatus,
  };
}
