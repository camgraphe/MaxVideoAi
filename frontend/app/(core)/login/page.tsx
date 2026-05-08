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
import { LoginAuthSurface } from './_components/LoginAuthSurface';
import { startOAuthCookieRedirectFallback } from './_lib/oauth-cookie-fallback';
import { AUTH_COPY, type AuthMode, type Locale } from './_lib/login-copy';
import {
  buildAuthCallbackRedirect,
  clearPendingGoogleLogin,
  consumePendingGoogleLogin,
  DEFAULT_NEXT_PATH,
  detectLocale,
  getBrowserAuthRedirectOrigin,
  markPendingGoogleLogin,
  sanitizeNextPath,
} from './_lib/login-helpers';

export const dynamic = 'force-dynamic';

const MIN_AGE_ENV = Number.parseInt(process.env.NEXT_PUBLIC_LEGAL_MIN_AGE ?? '15', 10);
const LEGAL_MIN_AGE = Number.isNaN(MIN_AGE_ENV) ? 15 : MIN_AGE_ENV;

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

  const handleClearSignupSuggestion = useCallback(() => {
    setSignupSuggestion(null);
  }, []);

  const handleAcceptTermsChange = useCallback((checked: boolean) => {
    setAcceptTerms(checked);
    if (checked) {
      setTermsError(false);
      setError((prev) =>
        prev === 'You must accept the Terms of Service and Privacy Policy to continue.' ? null : prev
      );
    }
  }, []);

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

  const effectiveMode: Exclude<AuthMode, 'reset'> = mode === 'reset' ? 'signin' : mode;

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

  return (
    <LoginAuthSurface
      authCopy={authCopy}
      mode={mode}
      effectiveMode={effectiveMode}
      email={email}
      password={password}
      confirm={confirm}
      status={status}
      statusTone={statusTone}
      error={error}
      signupSuggestion={signupSuggestion}
      isGoogleOAuthStarting={isGoogleOAuthStarting}
      acceptTerms={acceptTerms}
      termsError={termsError}
      ageConfirmed={ageConfirmed}
      marketingOptIn={marketingOptIn}
      legalMinAge={LEGAL_MIN_AGE}
      emailRef={emailRef}
      passwordRef={passwordRef}
      onBack={handleBack}
      onModeChange={setMode}
      onGoogleSignIn={signInWithGoogle}
      onSignInSubmit={signInWithPassword}
      onSignUpSubmit={signUpWithPassword}
      onResetSubmit={sendReset}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      onConfirmChange={setConfirm}
      onSyncInputState={syncInputState}
      onAcceptTermsChange={handleAcceptTermsChange}
      onAgeConfirmedChange={setAgeConfirmed}
      onMarketingOptInChange={setMarketingOptIn}
      onAcceptSignupSuggestion={handleAcceptSignupSuggestion}
      onClearSignupSuggestion={handleClearSignupSuggestion}
    />
  );
}
