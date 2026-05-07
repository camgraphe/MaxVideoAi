'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AuthApiError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { LOGIN_NEXT_STORAGE_KEY, LOGIN_LAST_TARGET_KEY, LOGIN_SKIP_ONBOARDING_KEY } from '@/lib/auth-storage';
import { dispatchAnalyticsEvent, persistPendingAnalyticsEvent } from '@/lib/analytics-client';
import { writeLastKnownUserId } from '@/lib/last-known';
import {
  clearStaleBrowserAuthState,
  isInvalidRefreshTokenError,
  isPkceCodeVerifierError,
  readBrowserSession,
} from '@/lib/supabase-auth-cleanup';
import { canonicalizeBrowserAuthOrigin } from '@/lib/siteOrigin';
import { startOAuthCookieRedirectFallback } from './_lib/oauth-cookie-fallback';
import clsx from 'clsx';
import enMessages from '@/messages/en.json';
import frMessages from '@/messages/fr.json';
import esMessages from '@/messages/es.json';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export const dynamic = 'force-dynamic';

type AuthMode = 'signin' | 'signup' | 'reset';

const MIN_AGE_ENV = Number.parseInt(process.env.NEXT_PUBLIC_LEGAL_MIN_AGE ?? '15', 10);
const LEGAL_MIN_AGE = Number.isNaN(MIN_AGE_ENV) ? 15 : MIN_AGE_ENV;

const DEFAULT_NEXT_PATH = '/generate';
const NEXT_PATH_PREFIXES = ['/app', '/generate', '/dashboard', '/jobs', '/billing', '/settings', '/admin', '/connect'];
const PENDING_GOOGLE_LOGIN_STORAGE_KEY = 'mvai.pending-google-login.v1';
const PENDING_GOOGLE_LOGIN_TTL_MS = 10 * 60 * 1000;

const AUTH_COPY = {
  en: enMessages.auth,
  fr: frMessages.auth,
  es: esMessages.auth,
} as const;

type Locale = keyof typeof AUTH_COPY;

const LOCALE_OPTIONS: Locale[] = ['en', 'fr', 'es'];

function detectLocale(): Locale {
  if (typeof document !== 'undefined') {
    const attr = document.documentElement.lang?.slice(0, 2).toLowerCase();
    if (attr && LOCALE_OPTIONS.includes(attr as Locale)) {
      return attr as Locale;
    }
    const match = document.cookie.match(/(?:NEXT_LOCALE|mvid_locale)=([a-z]{2})/i);
    if (match && LOCALE_OPTIONS.includes(match[1].toLowerCase() as Locale)) {
      return match[1].toLowerCase() as Locale;
    }
  }
  return 'en';
}

function formatTemplate(template: string, replacements: Record<string, string>): string {
  return Object.entries(replacements).reduce((text, [key, value]) => text.replace(`{${key}}`, value), template);
}

function sanitizeNextPath(candidate: string | null | undefined): string {
  if (typeof candidate !== 'string') return DEFAULT_NEXT_PATH;
  const trimmed = candidate.trim();
  if (!trimmed.startsWith('/')) return DEFAULT_NEXT_PATH;
  if (trimmed === '/' || trimmed.startsWith('/login') || trimmed.startsWith('/api') || trimmed.startsWith('/_next')) {
    return DEFAULT_NEXT_PATH;
  }
  const pathname = trimmed.split(/[?#]/)[0] ?? trimmed;
  const isAllowed = NEXT_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  return isAllowed ? trimmed : DEFAULT_NEXT_PATH;
}

function getBrowserAuthRedirectOrigin(): string {
  if (typeof window === 'undefined') return '';
  return window.location.origin;
}

function buildAuthCallbackRedirect(origin: string, nextPath: string): string | undefined {
  const trimmed = origin.trim();
  if (!trimmed) return undefined;
  const base = trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
  return `${base}/auth/callback?next=${encodeURIComponent(sanitizeNextPath(nextPath))}`;
}

function markPendingGoogleLogin() {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(
      PENDING_GOOGLE_LOGIN_STORAGE_KEY,
      JSON.stringify({ createdAt: Date.now() })
    );
  } catch {
    // ignore storage failures
  }
}

function clearPendingGoogleLogin() {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(PENDING_GOOGLE_LOGIN_STORAGE_KEY);
  } catch {
    // ignore storage failures
  }
}

function consumePendingGoogleLogin(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.sessionStorage.getItem(PENDING_GOOGLE_LOGIN_STORAGE_KEY);
    window.sessionStorage.removeItem(PENDING_GOOGLE_LOGIN_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { createdAt?: number } | null;
    if (!parsed || typeof parsed.createdAt !== 'number') return false;
    return Date.now() - parsed.createdAt <= PENDING_GOOGLE_LOGIN_TTL_MS;
  } catch {
    return false;
  }
}

export default function LoginPage() {
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>('en');
  const [nextPath, setNextPath] = useState<string>(DEFAULT_NEXT_PATH);
  const [nextPathReady, setNextPathReady] = useState(false);
  const [authRedirectOrigin, setAuthRedirectOrigin] = useState('');
  const persistNextTarget = useCallback((value: string) => {
    if (typeof window === 'undefined') return;
    const safe = sanitizeNextPath(value);
    const prevSession = window.sessionStorage.getItem(LOGIN_LAST_TARGET_KEY);
    if (prevSession === safe) {
      window.localStorage.setItem(LOGIN_LAST_TARGET_KEY, safe);
      window.localStorage.setItem(LOGIN_NEXT_STORAGE_KEY, safe);
      if (
        safe.startsWith('/generate') ||
        safe.startsWith('/app') ||
        safe.includes('from=') ||
        safe.includes('engine=')
      ) {
        window.localStorage.setItem(LOGIN_SKIP_ONBOARDING_KEY, 'true');
      } else if (!safe.startsWith('/gallery')) {
        window.localStorage.removeItem(LOGIN_SKIP_ONBOARDING_KEY);
      }
      return;
    }
    if (process.env.NODE_ENV !== 'production') {
      console.log('[login] persistNextTarget', { safe });
    }
    window.sessionStorage.setItem(LOGIN_NEXT_STORAGE_KEY, safe);
    window.sessionStorage.setItem(LOGIN_LAST_TARGET_KEY, safe);
    window.localStorage.setItem(LOGIN_NEXT_STORAGE_KEY, safe);
    window.localStorage.setItem(LOGIN_LAST_TARGET_KEY, safe);
    if (
      safe.startsWith('/generate') ||
      safe.startsWith('/app') ||
      safe.includes('from=') ||
      safe.includes('engine=')
    ) {
      window.sessionStorage.setItem(LOGIN_SKIP_ONBOARDING_KEY, 'true');
      window.localStorage.setItem(LOGIN_SKIP_ONBOARDING_KEY, 'true');
    } else if (!safe.startsWith('/gallery')) {
      window.sessionStorage.removeItem(LOGIN_SKIP_ONBOARDING_KEY);
      window.localStorage.removeItem(LOGIN_SKIP_ONBOARDING_KEY);
    }
  }, []);
  const [mode, setMode] = useState<AuthMode>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<'info' | 'success'>('info');
  const [error, setError] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement | null>(null);
  const passwordRef = useRef<HTMLInputElement | null>(null);
  const oauthCodeExchangeStartedRef = useRef(false);
  const authNavigationStartedRef = useRef(false);
  const googleOAuthStartedRef = useRef(false);
  const [isGoogleOAuthStarting, setIsGoogleOAuthStarting] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [termsError, setTermsError] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [browserLocale, setBrowserLocale] = useState<string | null>(null);
  const [signupSuggestion, setSignupSuggestion] = useState<{ email: string; password: string } | null>(null);
  const safeNextPath = useMemo(() => sanitizeNextPath(nextPath), [nextPath]);
  const authCopy = AUTH_COPY[locale] ?? AUTH_COPY.en;

  const completeAuthenticatedRedirect = useCallback(
    (target: string, authenticatedUserId?: string | null) => {
      if (authNavigationStartedRef.current) return;
      authNavigationStartedRef.current = true;
      const safeTarget = sanitizeNextPath(target);
      const userId = authenticatedUserId ?? null;
      if (userId) {
        writeLastKnownUserId(userId);
      }
      if (typeof window !== 'undefined') {
        persistNextTarget(safeTarget);
        window.sessionStorage.removeItem(LOGIN_NEXT_STORAGE_KEY);
        window.dispatchEvent(new Event('wallet:invalidate'));
        window.location.replace(safeTarget);
        return;
      }
      router.replace(safeTarget);
    },
    [persistNextTarget, router]
  );

  const redirectFromExistingBrowserSession = useCallback(
    async function redirectFromExistingBrowserSession(target: string): Promise<boolean> {
      const session = await readBrowserSession();
      const userId = session?.user?.id ?? null;
      if (!session?.access_token || !userId) return false;
      if (consumePendingGoogleLogin()) {
        persistPendingAnalyticsEvent('login_completed', {
          route_family: 'auth',
          auth_surface: 'login',
          method: 'google',
        });
      }
      completeAuthenticatedRedirect(target, userId);
      return true;
    },
    [completeAuthenticatedRedirect]
  );

  const syncInputState = useCallback(() => {
    const nextEmail = emailRef.current?.value ?? '';
    const nextPassword = passwordRef.current?.value ?? '';
    setEmail((prev) => (prev === nextEmail ? prev : nextEmail));
    setPassword((prev) => (prev === nextPassword ? prev : nextPassword));
  }, [setEmail, setPassword]);

  useEffect(() => {
    if (canonicalizeBrowserAuthOrigin()) return;
    if (typeof window === 'undefined') return;
    setAuthRedirectOrigin(getBrowserAuthRedirectOrigin());
    const params = new URLSearchParams(window.location.search);
    const value = params.get('next');
    let resolved = DEFAULT_NEXT_PATH;
    let source: 'query' | 'stored' | 'last' | 'referrer' | 'default' = 'default';
    if (value && value.startsWith('/')) {
      resolved = sanitizeNextPath(value);
      source = 'query';
    } else {
      let stored = window.sessionStorage.getItem(LOGIN_NEXT_STORAGE_KEY);
      if (!stored) {
        stored = window.localStorage.getItem(LOGIN_NEXT_STORAGE_KEY) ?? null;
        if (stored) {
          window.localStorage.removeItem(LOGIN_NEXT_STORAGE_KEY);
          window.sessionStorage.setItem(LOGIN_NEXT_STORAGE_KEY, stored);
        }
      }
      let lastTarget = window.sessionStorage.getItem(LOGIN_LAST_TARGET_KEY);
      if (!lastTarget) {
        lastTarget = window.localStorage.getItem(LOGIN_LAST_TARGET_KEY) ?? null;
        if (lastTarget) {
          window.localStorage.removeItem(LOGIN_LAST_TARGET_KEY);
          window.sessionStorage.setItem(LOGIN_LAST_TARGET_KEY, lastTarget);
        }
      }
      if (stored) {
        resolved = sanitizeNextPath(stored);
        source = 'stored';
      } else if (lastTarget) {
        resolved = sanitizeNextPath(lastTarget);
        source = 'last';
      }
    }

    if (resolved === DEFAULT_NEXT_PATH) {
      const referrer = document.referrer;
      const origin = window.location.origin;
      if (referrer && origin && referrer.startsWith(origin)) {
        const pathname = referrer.slice(origin.length) || '/';
        if (pathname.startsWith('/')) {
          const sanitised = sanitizeNextPath(pathname);
          if (sanitised && sanitised !== DEFAULT_NEXT_PATH) {
            resolved = sanitised;
            source = 'referrer';
          }
        }
      }
    }
    setNextPath(resolved);
    persistNextTarget(resolved);
    setNextPathReady(true);
    if (process.env.NODE_ENV !== 'production') {
      console.log('[login] resolved next path', { value, resolved, source });
    }
  }, [persistNextTarget]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    syncInputState();
    const timers = [window.setTimeout(syncInputState, 100), window.setTimeout(syncInputState, 500)];
    const handle = () => syncInputState();
    const emailEl = emailRef.current;
    const passwordEl = passwordRef.current;
    emailEl?.addEventListener('input', handle);
    emailEl?.addEventListener('change', handle);
    passwordEl?.addEventListener('input', handle);
    passwordEl?.addEventListener('change', handle);
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      emailEl?.removeEventListener('input', handle);
      emailEl?.removeEventListener('change', handle);
      passwordEl?.removeEventListener('input', handle);
      passwordEl?.removeEventListener('change', handle);
    };
  }, [syncInputState, mode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const paramMode = params.get('mode');
    if (paramMode === 'signin' || paramMode === 'signup' || paramMode === 'reset') {
      setMode(paramMode);
    }
  }, []);

  useEffect(() => {
    if (!nextPathReady) return;
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const oauthCode = params.get('code');
    const authError = params.get('authError');
    if (!oauthCode && authError !== 'oauth_callback_failed') return;

    const cleanAuthQuery = () => {
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete('code');
      cleanUrl.searchParams.delete('state');
      cleanUrl.searchParams.delete('authError');
      cleanUrl.searchParams.delete('error');
      cleanUrl.searchParams.delete('error_description');
      cleanUrl.searchParams.delete('redirect_to');
      window.history.replaceState({}, document.title, cleanUrl.pathname + cleanUrl.search + cleanUrl.hash);
    };

    const localizedCopy = AUTH_COPY[detectLocale()] ?? authCopy;
    setMode('signin');

    if (authError === 'oauth_callback_failed') {
      cleanAuthQuery();
      clearPendingGoogleLogin();
      setStatus(null);
      setError(localizedCopy.oauthCallbackError);
      return;
    }

    if (!oauthCode || oauthCodeExchangeStartedRef.current) return;
    oauthCodeExchangeStartedRef.current = true;
    cleanAuthQuery();
    setStatusTone('info');
    setStatus('Completing sign-in…');
    setError(null);

    let cancelled = false;
    const target = sanitizeNextPath(params.get('next') ?? nextPath);
    const cancelAuthCookieFallback = startOAuthCookieRedirectFallback({
      isCancelled: () => cancelled || authNavigationStartedRef.current,
      onAuthenticatedCookie: () => {
        if (consumePendingGoogleLogin()) {
          persistPendingAnalyticsEvent('login_completed', {
            route_family: 'auth',
            auth_surface: 'login',
            method: 'google',
          });
        }
        completeAuthenticatedRedirect(target);
      },
    });
    void supabase.auth
      .exchangeCodeForSession(oauthCode)
      .then(async ({ data, error }) => {
        if (cancelled) return;
        if (error || !data.session) {
          if (isInvalidRefreshTokenError(error) || isPkceCodeVerifierError(error)) {
            void clearStaleBrowserAuthState();
          }
          const fallbackRedirected = await redirectFromExistingBrowserSession(target);
          if (cancelled || fallbackRedirected) return;
          oauthCodeExchangeStartedRef.current = false;
          clearPendingGoogleLogin();
          setStatus(null);
          setError(localizedCopy.oauthCallbackError);
          return;
        }
        if (consumePendingGoogleLogin()) {
          persistPendingAnalyticsEvent('login_completed', {
            route_family: 'auth',
            auth_surface: 'login',
            method: 'google',
          });
        }
        completeAuthenticatedRedirect(target, data.session.user?.id ?? null);
      })
      .catch(async (err) => {
        if (cancelled) return;
        if (isInvalidRefreshTokenError(err) || isPkceCodeVerifierError(err)) {
          void clearStaleBrowserAuthState();
        }
        const fallbackRedirected = await redirectFromExistingBrowserSession(target);
        if (cancelled || fallbackRedirected) return;
        oauthCodeExchangeStartedRef.current = false;
        clearPendingGoogleLogin();
        setStatus(null);
        setError(localizedCopy.oauthCallbackError);
      });

    return () => {
      cancelled = true;
      cancelAuthCookieFallback();
    };
  }, [authCopy, completeAuthenticatedRedirect, nextPath, nextPathReady, redirectFromExistingBrowserSession]);

  useEffect(() => {
    if (mode !== 'signup' && termsError) {
      setTermsError(false);
    }
  }, [mode, termsError]);

  useEffect(() => {
    if (typeof navigator !== 'undefined') {
      setBrowserLocale(navigator.language ?? null);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash;
    if (!hash || !hash.includes('access_token=')) {
      return;
    }
    const params = new URLSearchParams(hash.replace(/^#/, ''));
    const accessToken = params.get('access_token');
    const refreshToken =
      params.get('refresh_token') ?? params.get('refreshToken') ?? params.get('refresh-token');
    if (!accessToken || !refreshToken) {
      window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
      return;
    }
    let cancelled = false;
    setStatusTone('info');
    setStatus('Completing sign-in…');
    setError(null);
    void supabase.auth
      .setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setError(error.message ?? 'Unable to complete sign-in.');
          setStatus(null);
          return;
        }
        if (data.session) {
          const userId = data.session.user?.id ?? null;
          if (userId) {
            writeLastKnownUserId(userId);
          }
          if (consumePendingGoogleLogin()) {
            persistPendingAnalyticsEvent('login_completed', {
              route_family: 'auth',
              auth_surface: 'login',
              method: 'google',
            });
          }
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Unable to complete sign-in.');
        setStatus(null);
      })
      .finally(() => {
        if (cancelled) return;
        window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (mode !== 'signin' && signupSuggestion) {
      setSignupSuggestion(null);
    }
  }, [mode, signupSuggestion]);

  useEffect(() => {
    if (!nextPathReady) return;
    let cancelled = false;

    async function redirectIfAuthenticated() {
      if (oauthCodeExchangeStartedRef.current) return;
      const { data, error } = await supabase.auth.getUser();
      if (cancelled) return;
      if (error) {
        if (isInvalidRefreshTokenError(error)) {
          await clearStaleBrowserAuthState();
        }
        return;
      }
      const user = data.user ?? null;
      if (user && nextPath) {
        if (consumePendingGoogleLogin()) {
          persistPendingAnalyticsEvent('login_completed', {
            route_family: 'auth',
            auth_surface: 'login',
            method: 'google',
          });
        }
        const safeTarget = sanitizeNextPath(nextPath);
        completeAuthenticatedRedirect(safeTarget, user.id);
      } else if (!user) {
        // stay on page
      }
    }

    void redirectIfAuthenticated();

    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      if (oauthCodeExchangeStartedRef.current) return;
      void supabase.auth.getUser().then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          if (isInvalidRefreshTokenError(error)) {
            void clearStaleBrowserAuthState();
          }
          return;
        }
        const user = data.user ?? null;
        if (user && nextPath) {
          if (consumePendingGoogleLogin()) {
            persistPendingAnalyticsEvent('login_completed', {
              route_family: 'auth',
              auth_surface: 'login',
              method: 'google',
            });
          }
          const safeTarget = sanitizeNextPath(nextPath);
          completeAuthenticatedRedirect(safeTarget, user.id);
        } else if (!user) {
          // remain unauthenticated
        }
      }).catch((err) => {
        if (cancelled) return;
        if (isInvalidRefreshTokenError(err)) {
          void clearStaleBrowserAuthState();
        }
      });
    });

    return () => {
      cancelled = true;
      authListener?.subscription.unsubscribe();
    };
  }, [completeAuthenticatedRedirect, nextPath, nextPathReady]);

  async function signInWithPassword(e: React.FormEvent) {
    e.preventDefault();
    setStatusTone('info');
    setStatus('Signing in…');
    setError(null);
    setSignupSuggestion(null);
    clearPendingGoogleLogin();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (error instanceof AuthApiError && error.status === 400) {
        setSignupSuggestion({ email, password });
        setStatusTone('info');
        setStatus(
          "We couldn't sign you in with those details. If you're new, create your account without retyping anything."
        );
        setError(null);
      } else {
        setError(error.message);
        setStatus(null);
      }
      return;
    }
    setStatusTone('info');
    setStatus('Signed in. Redirecting…');
    persistPendingAnalyticsEvent('login_completed', {
      route_family: 'auth',
      auth_surface: 'login',
      method: 'password',
    });

    const safeTarget = sanitizeNextPath(nextPath);
    completeAuthenticatedRedirect(safeTarget, data.session?.user?.id ?? data.user?.id ?? null);
  }

  const handleAcceptSignupSuggestion = useCallback(() => {
    if (!signupSuggestion) return;
    setMode('signup');
    if (signupSuggestion.password) {
      setConfirm((prev) => (prev ? prev : signupSuggestion.password));
    }
    setStatusTone('info');
    setStatus("Great, let's create your account.");
    setSignupSuggestion(null);
  }, [signupSuggestion, setMode, setConfirm, setStatusTone, setStatus]);

  async function submitSignupConsents(userId: string) {
    try {
      const res = await fetch('/api/legal/consents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          userId,
          marketingOptIn,
          ageConfirmed: true,
          locale: browserLocale ?? locale,
          source: 'signup',
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? 'Failed to record legal consents');
      }
    } catch (error) {
      throw error instanceof Error ? error : new Error('Failed to record legal consents');
    }
  }

  async function signUpWithPassword(e: React.FormEvent) {
    e.preventDefault();
    setStatusTone('info');
    setStatus('Creating account…');
    setError(null);
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters.');
      setStatus(null);
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      setStatus(null);
      return;
    }
    if (!acceptTerms) {
      setTermsError(true);
      setError('You must accept the Terms of Service and Privacy Policy to continue.');
      setStatus(null);
      return;
    }
    if (!ageConfirmed) {
      setError(`You must confirm you are at least ${LEGAL_MIN_AGE} years old to create an account.`);
      setStatus(null);
      return;
    }
    clearPendingGoogleLogin();
    dispatchAnalyticsEvent('sign_up_started', {
      route_family: 'auth',
      auth_surface: 'login',
      method: 'password',
      marketing_opt_in: marketingOptIn,
    });
    const emailRedirectTo = buildAuthCallbackRedirect(
      getBrowserAuthRedirectOrigin() || authRedirectOrigin,
      safeNextPath
    );
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo },
    });
    if (error) {
      setError(error.message);
      setStatus(null);
      return;
    }

    if (data.user?.id) {
      try {
        await submitSignupConsents(data.user.id);
      } catch (consentError) {
        setError(consentError instanceof Error ? consentError.message : 'Failed to record legal consents.');
        setStatus(null);
        if (data.session) {
          await supabase.auth.signOut().catch(() => undefined);
        }
        return;
      }
    }

    if (data.session) {
      setStatusTone('success');
      setStatus('Account created. Redirecting…');
      persistPendingAnalyticsEvent('sign_up_completed', {
        route_family: 'auth',
        auth_surface: 'login',
        method: 'password',
        email_confirmation_required: false,
      });
      const target = sanitizeNextPath('/generate');
      completeAuthenticatedRedirect(target, data.session.user?.id ?? data.user?.id ?? null);
    } else {
      setStatusTone('success');
      setStatus('Check your inbox to confirm your email.');
      dispatchAnalyticsEvent('sign_up_completed', {
        route_family: 'auth',
        auth_surface: 'login',
        method: 'password',
        email_confirmation_required: true,
      });
    }
  }

  async function sendReset(e: React.FormEvent) {
    e.preventDefault();
    setStatusTone('info');
    setStatus('Sending reset link…');
    setError(null);
    const passwordResetRedirectTo = buildAuthCallbackRedirect(
      getBrowserAuthRedirectOrigin() || authRedirectOrigin,
      safeNextPath
    );
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: passwordResetRedirectTo,
    });
    if (error) {
      setError(error.message);
      setStatus(null);
      return;
    }
    setStatusTone('info');
    setStatus('Password reset email sent.');
  }

  async function signInWithGoogle() {
    if (googleOAuthStartedRef.current) return;
    if (canonicalizeBrowserAuthOrigin()) return;
    googleOAuthStartedRef.current = true;
    setIsGoogleOAuthStarting(true);
    setError(null);
    const safeNext = sanitizeNextPath(nextPath);
    const oauthRedirectTo = buildAuthCallbackRedirect(
      getBrowserAuthRedirectOrigin() || authRedirectOrigin,
      safeNext
    );
    if (!oauthRedirectTo) {
      googleOAuthStartedRef.current = false;
      setIsGoogleOAuthStarting(false);
      setStatusTone('info');
      setStatus('Google sign-in is unavailable because the auth redirect URL could not be resolved.');
      return;
    }
    setStatusTone('info');
    setStatus('Redirecting to Google…');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: oauthRedirectTo,
        skipBrowserRedirect: true,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });
    if (error) {
      googleOAuthStartedRef.current = false;
      setIsGoogleOAuthStarting(false);
      setError(error.message);
      setStatus(null);
      return;
    }
    if (data?.url) {
      if (typeof window !== 'undefined') {
        persistNextTarget(safeNext);
        markPendingGoogleLogin();
      }
      window.location.href = data.url;
      return;
    }
    googleOAuthStartedRef.current = false;
    setIsGoogleOAuthStarting(false);
  }

  useEffect(() => {
    if (!nextPathReady) return;
    if (oauthCodeExchangeStartedRef.current) return;
    let cancelled = false;
    readBrowserSession().then((session) => {
      if (cancelled) return;
      if (session?.access_token) {
        if (consumePendingGoogleLogin()) {
          persistPendingAnalyticsEvent('login_completed', {
            route_family: 'auth',
            auth_surface: 'login',
            method: 'google',
          });
        }
        const safeTarget = sanitizeNextPath(nextPath);
        completeAuthenticatedRedirect(safeTarget, session.user?.id ?? null);
      } else {
      }
    }).catch((err) => {
      if (cancelled) return;
      if (isInvalidRefreshTokenError(err)) {
        void clearStaleBrowserAuthState();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [completeAuthenticatedRedirect, nextPath, nextPathReady]);

  const effectiveMode: AuthMode = mode === 'reset' ? 'signin' : mode;

  const handleBack = useCallback(() => {
    if (typeof window === 'undefined') {
      router.push('/');
      return;
    }
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push('/');
    }
  }, [router]);

  useEffect(() => {
    const detected = detectLocale();
    setLocale(detected);
  }, []);

  const renderTermsStatement = () => (
    <span className={clsx(termsError && 'text-state-warning')}>
      {authCopy.terms.prefix}
      <a href="/legal/terms" target="_blank" rel="noopener noreferrer" className="text-brand underline">
        {authCopy.terms.termsLabel}
      </a>
      {authCopy.terms.infix}
      <a href="/legal/privacy" target="_blank" rel="noopener noreferrer" className="text-brand underline">
        {authCopy.terms.privacyLabel}
      </a>
      {authCopy.terms.suffix}
    </span>
  );

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-bg p-6">
      <div className="mb-6 w-full max-w-md">
        <Button type="button" onClick={handleBack} variant="ghost" size="sm" className="gap-2">
          <span aria-hidden>←</span>
          <span>{authCopy.back}</span>
        </Button>
      </div>
      <div className="w-full max-w-md stack-gap-lg rounded-card border border-border bg-surface p-6 shadow-card">
        <header className="stack-gap">
          <div>
            <h1 className="text-lg font-semibold text-text-primary">
              {mode === 'signup'
                ? authCopy.modes.signup.title
                : mode === 'reset'
                  ? authCopy.modes.reset.title
                  : authCopy.modes.signin.title}
            </h1>
            <p className="text-sm text-text-secondary">
              {mode === 'signup'
                ? authCopy.modes.signup.description
                : mode === 'reset'
                  ? authCopy.modes.reset.description
                  : authCopy.modes.signin.description}
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-pill bg-bg p-1 text-sm font-medium">
            <Button
              type="button"
              variant={effectiveMode === 'signin' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setMode('signin')}
              className={clsx(
                'flex-1 rounded-pill px-3 py-2',
                effectiveMode === 'signin' ? 'shadow-card' : 'hover:bg-surface'
              )}
            >
              {authCopy.tabs.signin}
            </Button>
            <Button
              type="button"
              variant={effectiveMode === 'signup' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setMode('signup')}
              className={clsx(
                'flex-1 rounded-pill px-3 py-2',
                effectiveMode === 'signup' ? 'shadow-card' : 'hover:bg-surface'
              )}
            >
              {authCopy.tabs.signup}
            </Button>
          </div>
        </header>

        {mode !== 'reset' ? (
          <>
            <Button
              type="button"
              onClick={signInWithGoogle}
              variant="outline"
              disabled={isGoogleOAuthStarting}
              aria-busy={isGoogleOAuthStarting}
              className="w-full justify-center gap-2 font-medium"
            >
              <span aria-hidden className="inline-flex h-5 w-5 items-center justify-center">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M19.6 10.2301C19.6 9.55008 19.54 8.90008 19.43 8.28008H10V12.0401H15.42C15.18 13.2901 14.5 14.3301 13.46 15.0301V17.5401H16.7C18.64 15.7401 19.6 13.2101 19.6 10.2301Z" fill="#4285F4" />
                  <path d="M10 20.0001C12.7 20.0001 14.97 19.1001 16.7 17.5401L13.46 15.0301C12.53 15.6501 11.37 16.0301 10 16.0301C7.39502 16.0301 5.19502 14.2201 4.40502 11.8201H1.06006V14.4101C2.78006 17.6401 6.11006 20.0001 10 20.0001Z" fill="#34A853" />
                  <path d="M4.405 11.8201C4.205 11.2001 4.09 10.5401 4.09 9.86008C4.09 9.18008 4.205 8.52008 4.405 7.90008V5.31006H1.06C0.38 6.68006 0 8.24008 0 9.86008C0 11.4801 0.38 13.0401 1.06 14.4101L4.405 11.8201Z" fill="#FBBC05" />
                  <path d="M10 3.98005C11.57 3.98005 12.97 4.52005 14.07 5.56005L16.78 2.85005C14.97 1.16005 12.7 0.200043 10 0.200043C6.11006 0.200043 2.78006 2.56005 1.06006 5.79005L4.40506 8.38005C5.19506 5.98005 7.39506 3.98005 10 3.98005Z" fill="#EA4335" />
                </svg>
              </span>
              Continue with Google
            </Button>
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-text-muted">
              <span className="h-px flex-1 bg-border" aria-hidden />
              <span>{authCopy.divider}</span>
              <span className="h-px flex-1 bg-border" aria-hidden />
            </div>
            <form onSubmit={mode === 'signin' ? signInWithPassword : signUpWithPassword} className="stack-gap-sm">
              <label className="block text-sm">
                <span className="mb-1 block text-text-secondary">{authCopy.fields.email}</span>
                <Input
                  type="email"
                  required
                  ref={emailRef}
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={syncInputState}
                  className="mt-2"
                  placeholder={authCopy.placeholders.email}
                  autoComplete="email"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-text-secondary">{authCopy.fields.password}</span>
                <Input
                  type="password"
                  required
                  ref={passwordRef}
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={syncInputState}
                  className="mt-2"
                  placeholder={mode === 'signup' ? authCopy.placeholders.passwordNew : authCopy.placeholders.password}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                />
              </label>
              {mode === 'signup' && (
                <label className="block text-sm">
                  <span className="mb-1 block text-text-secondary">{authCopy.fields.confirmPassword}</span>
                  <Input
                    type="password"
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="mt-2"
                    placeholder={authCopy.placeholders.passwordNew}
                    autoComplete="new-password"
                  />
                </label>
              )}
              {mode === 'signup' && (
                <div className="stack-gap-sm rounded-card bg-bg p-3 text-sm text-text-secondary">
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={acceptTerms}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setAcceptTerms(checked);
                        if (checked) {
                          setTermsError(false);
                          setError((prev) =>
                            prev === 'You must accept the Terms of Service and Privacy Policy to continue.' ? null : prev
                          );
                        }
                      }}
                      className={clsx(
                        'mt-1 h-4 w-4 rounded border-border text-brand focus:ring-ring',
                        termsError && 'border-state-warning text-state-warning focus:ring-state-warning'
                      )}
                      required
                    />
                  <span className={clsx(termsError && 'text-state-warning')}>
                      {renderTermsStatement()}
                    </span>
                  </label>
                  {termsError ? (
                    <p className="pl-6 text-xs text-state-warning">{authCopy.terms.error}</p>
                  ) : null}
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={ageConfirmed}
                      onChange={(event) => setAgeConfirmed(event.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-border text-brand focus:ring-ring"
                      required
                    />
                    <span>{formatTemplate(authCopy.terms.age, { age: String(LEGAL_MIN_AGE) })}</span>
                  </label>
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={marketingOptIn}
                      onChange={(event) => setMarketingOptIn(event.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-border text-brand focus:ring-ring"
                    />
                    <span>{authCopy.terms.marketing}</span>
                  </label>
                </div>
              )}

              <Button
                type="submit"
                variant={mode === 'signup' ? 'primary' : 'outline'}
                className="w-full"
              >
                {mode === 'signin' ? authCopy.actions.signin : authCopy.actions.signup}
              </Button>
            </form>

            {mode === 'signin' ? (
              <div className="flex flex-col gap-2 text-xs">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setMode('reset')}
                  className="self-start text-brand hover:text-brandHover"
                >
                  {authCopy.forgotPassword}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setMode('signup')}
                  className="self-start text-brand hover:text-brandHover"
                >
                  {authCopy.links.newAccount}
                </Button>
              </div>
            ) : (
              <Button type="button" variant="ghost" size="sm" onClick={() => setMode('signin')}>
                {authCopy.links.haveAccount}
              </Button>
            )}
          </>
        ) : (
          <form onSubmit={sendReset} className="stack-gap-sm">
            <label className="block text-sm">
              <span className="mb-1 block text-text-secondary">{authCopy.fields.email}</span>
              <Input
                type="email"
                required
                ref={emailRef}
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={syncInputState}
                className="mt-2"
                placeholder="you@domain.com"
                autoComplete="email"
              />
            </label>
            <div className="flex justify-between text-xs">
              <Button type="button" variant="ghost" size="sm" onClick={() => setMode('signin')}>
                {authCopy.links.backToSignIn}
              </Button>
            </div>
            <Button type="submit" variant="outline" className="w-full">
              {authCopy.actions.reset}
            </Button>
          </form>
        )}

        {status && (
          <div
            className={clsx(
              'rounded-card border px-3 py-3 text-sm font-medium',
              statusTone === 'success'
                ? 'border-brand bg-surface-2 text-brand'
                : 'border-border bg-bg text-text-secondary'
            )}
          >
            {status}
          </div>
        )}
        {mode === 'signin' && signupSuggestion && (
          <div className="rounded-card border border-dashed border-border bg-surface-glass-75 px-3 py-3 text-xs text-text-secondary">
            <p className="text-sm font-semibold text-text-primary">New here?</p>
            <p className="mt-1">
              {formatTemplate(authCopy.signupSuggestion.body, { email: signupSuggestion.email })}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={handleAcceptSignupSuggestion}>
                {authCopy.signupSuggestion.accept}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSignupSuggestion(null)}
              >
                {authCopy.signupSuggestion.decline}
              </Button>
            </div>
          </div>
        )}
        {error && <p className="text-xs text-state-warning">{error}</p>}
      </div>
    </main>
  );
}
