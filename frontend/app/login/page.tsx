'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AuthApiError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { syncSupabaseCookies, clearSupabaseCookies } from '@/lib/supabase-cookies';
import { LOGIN_NEXT_STORAGE_KEY, LOGIN_LAST_TARGET_KEY, LOGIN_SKIP_ONBOARDING_KEY } from '@/lib/auth-storage';
import clsx from 'clsx';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

type AuthMode = 'signin' | 'signup' | 'reset';

const MIN_AGE_ENV = Number.parseInt(process.env.NEXT_PUBLIC_LEGAL_MIN_AGE ?? '15', 10);
const LEGAL_MIN_AGE = Number.isNaN(MIN_AGE_ENV) ? 15 : MIN_AGE_ENV;

const DEFAULT_NEXT_PATH = '/generate';
const NEXT_PATH_PREFIXES = ['/app', '/generate', '/dashboard', '/jobs', '/billing', '/settings', '/admin', '/connect'];

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

export default function LoginPage() {
  const router = useRouter();
  const [nextPath, setNextPath] = useState<string>(() => {
    if (typeof window === 'undefined') return DEFAULT_NEXT_PATH;
    const params = new URLSearchParams(window.location.search);
    const queryValue = params.get('next');
    if (queryValue && queryValue.startsWith('/')) {
      return sanitizeNextPath(queryValue);
    }
    let stored = window.sessionStorage.getItem(LOGIN_NEXT_STORAGE_KEY);
    if (!stored) {
      const legacyStored = window.localStorage.getItem(LOGIN_NEXT_STORAGE_KEY);
      if (legacyStored) {
        window.localStorage.removeItem(LOGIN_NEXT_STORAGE_KEY);
        stored = legacyStored;
      }
    }
    if (stored) {
      return sanitizeNextPath(stored);
    }
    let lastTarget = window.sessionStorage.getItem(LOGIN_LAST_TARGET_KEY);
    if (!lastTarget) {
      const legacyLast = window.localStorage.getItem(LOGIN_LAST_TARGET_KEY);
      if (legacyLast) {
        window.localStorage.removeItem(LOGIN_LAST_TARGET_KEY);
        lastTarget = legacyLast;
      }
    }
    if (lastTarget) {
      return sanitizeNextPath(lastTarget);
    }
    return DEFAULT_NEXT_PATH;
  });
  const [nextPathReady, setNextPathReady] = useState(false);
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : '')) as string;
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
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<'info' | 'success'>('info');
  const [error, setError] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement | null>(null);
  const passwordRef = useRef<HTMLInputElement | null>(null);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [locale, setLocale] = useState<string | null>(null);
  const [signupSuggestion, setSignupSuggestion] = useState<{ email: string; password: string } | null>(null);
  const redirectTo = useMemo(() => {
    if (!siteUrl) return undefined;
    const base = siteUrl.endsWith('/') ? siteUrl.slice(0, -1) : siteUrl;
    return `${base}/login`;
  }, [siteUrl]);

  const syncInputState = useCallback(() => {
    const nextEmail = emailRef.current?.value ?? '';
    const nextPassword = passwordRef.current?.value ?? '';
    setEmail((prev) => (prev === nextEmail ? prev : nextEmail));
    setPassword((prev) => (prev === nextPassword ? prev : nextPassword));
  }, [setEmail, setPassword]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const value = params.get('next');
    let resolved = DEFAULT_NEXT_PATH;
    let source: 'query' | 'stored' | 'last' | 'default' = 'default';
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
    setNextPath(resolved);
    persistNextTarget(resolved);
    setNextPathReady(true);
    if (process.env.NODE_ENV !== 'production') {
      console.log('[login] resolved next path', { value, resolved, source });
      console.log('[login] cookie snapshot', {
        nextCookie: document?.cookie
          ?.split('; ')
          ?.find((entry) => entry.startsWith('sb-access-token='))
          ?.slice('sb-access-token='.length, 'sb-access-token='.length + 12),
        storageSnapshot: {
          next: window.sessionStorage.getItem(LOGIN_NEXT_STORAGE_KEY),
          last: window.sessionStorage.getItem(LOGIN_LAST_TARGET_KEY),
          nextLocal: window.localStorage.getItem(LOGIN_NEXT_STORAGE_KEY),
          lastLocal: window.localStorage.getItem(LOGIN_LAST_TARGET_KEY),
          skip: window.sessionStorage.getItem(LOGIN_SKIP_ONBOARDING_KEY),
          skipLocal: window.localStorage.getItem(LOGIN_SKIP_ONBOARDING_KEY),
        },
      });
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
    if (typeof navigator !== 'undefined') {
      setLocale(navigator.language ?? null);
    }
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
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      const session = data.session ?? null;
      if (session?.user && nextPath) {
        syncSupabaseCookies(session);
        const safeTarget = sanitizeNextPath(nextPath);
        persistNextTarget(safeTarget);
        router.replace(safeTarget);
      } else if (!session?.user) {
        clearSupabaseCookies();
      }
    }

    void redirectIfAuthenticated();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      if (session?.user && nextPath) {
        syncSupabaseCookies(session);
        const safeTarget = sanitizeNextPath(nextPath);
        persistNextTarget(safeTarget);
        router.replace(safeTarget);
      } else if (!session?.user) {
        clearSupabaseCookies();
      }
    });

    return () => {
      cancelled = true;
      authListener?.subscription.unsubscribe();
    };
  }, [nextPath, nextPathReady, persistNextTarget, router]);

  async function signInWithPassword(e: React.FormEvent) {
    e.preventDefault();
    setStatusTone('info');
    setStatus('Signing in…');
    setError(null);
    setSignupSuggestion(null);
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

    const session = data.session ?? (await supabase.auth.getSession().then(({ data: sessionData }) => sessionData.session ?? null));
    syncSupabaseCookies(session);
    const safeTarget = sanitizeNextPath(nextPath);
    if (typeof window !== 'undefined') {
      persistNextTarget(safeTarget);
      window.sessionStorage.removeItem(LOGIN_NEXT_STORAGE_KEY);
    }
    router.replace(safeTarget);
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
          locale,
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
      setError('You must accept the Terms of Service and Privacy Policy to continue.');
      setStatus(null);
      return;
    }
    if (!ageConfirmed) {
      setError(`You must confirm you are at least ${LEGAL_MIN_AGE} years old to create an account.`);
      setStatus(null);
      return;
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectTo },
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
      syncSupabaseCookies(data.session);
      const target = sanitizeNextPath('/generate');
      if (typeof window !== 'undefined') {
        persistNextTarget(target);
        window.sessionStorage.removeItem(LOGIN_NEXT_STORAGE_KEY);
      }
      router.replace(target);
    } else {
      setStatusTone('success');
      setStatus('Check your inbox to confirm your email.');
    }
  }

  async function sendReset(e: React.FormEvent) {
    e.preventDefault();
    setStatusTone('info');
    setStatus('Sending reset link…');
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: siteUrl || undefined });
    if (error) {
      setError(error.message);
      setStatus(null);
      return;
    }
    setStatusTone('info');
    setStatus('Password reset email sent.');
  }

  async function signInWithGoogle() {
    setError(null);
    if (!siteUrl) {
      setStatusTone('info');
      setStatus('Google sign-in requires NEXT_PUBLIC_SITE_URL to be set.');
      return;
    }
    setStatusTone('info');
    setStatus('Redirecting to Google…');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: true,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });
    if (error) {
      setError(error.message);
      setStatus(null);
      return;
    }
    if (data?.url) {
      if (typeof window !== 'undefined') {
        const safeNext = sanitizeNextPath(nextPath);
        persistNextTarget(safeNext);
      }
      window.location.href = data.url;
    }
  }

  useEffect(() => {
    if (!nextPathReady) return;
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      const session = data.session ?? null;
      if (cancelled) return;
      if (session?.access_token) {
        syncSupabaseCookies(session);
        const safeTarget = sanitizeNextPath(nextPath);
        persistNextTarget(safeTarget);
        router.replace(safeTarget);
      } else {
        clearSupabaseCookies();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [router, nextPath, persistNextTarget, nextPathReady]);

  const effectiveMode: AuthMode = mode === 'reset' ? 'signin' : mode;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-bg p-6">
      <div className="mb-6 w-full max-w-md">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-text-secondary transition hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white"
        >
          <span aria-hidden>←</span>
          <span>Back to homepage</span>
        </Link>
      </div>
      <div className="w-full max-w-md space-y-5 rounded-card border border-border bg-white p-6 shadow-card">
        <header className="space-y-4">
          <div>
            <h1 className="text-lg font-semibold text-text-primary">
              {mode === 'signup' ? 'Create your workspace account' : mode === 'reset' ? 'Reset your password' : 'Access your workspace'}
            </h1>
            <p className="text-sm text-text-secondary">
              {mode === 'signup'
                ? "Get instant access to the MaxVideoAI workspace. We'll confirm your email before your first render."
                : mode === 'reset'
                  ? "We'll send a secure link to reset your password."
                  : 'Sign in with Google or email to jump back into the workspace.'}
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-pill bg-bg p-1 text-sm font-medium">
            <button
              type="button"
              onClick={() => setMode('signin')}
              className={clsx(
                'flex-1 rounded-pill px-3 py-2 transition',
                effectiveMode === 'signin' ? 'bg-accent text-white shadow-card' : 'text-text-secondary hover:bg-white'
              )}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setMode('signup')}
              className={clsx(
                'flex-1 rounded-pill px-3 py-2 transition',
                effectiveMode === 'signup' ? 'bg-accent text-white shadow-card' : 'text-text-secondary hover:bg-white'
              )}
            >
              Create account
            </button>
          </div>
        </header>

        {mode !== 'reset' ? (
          <>
            <button
              type="button"
              onClick={signInWithGoogle}
              className="flex w-full items-center justify-center gap-2 rounded-input border border-border bg-white px-3 py-2 text-sm font-medium transition hover:bg-bg"
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
            </button>
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-text-muted">
              <span className="h-px flex-1 bg-border" aria-hidden />
              <span>Email access</span>
              <span className="h-px flex-1 bg-border" aria-hidden />
            </div>
            <form onSubmit={mode === 'signin' ? signInWithPassword : signUpWithPassword} className="space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block text-text-secondary">Email</span>
                <input
                  type="email"
                  required
                  ref={emailRef}
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={syncInputState}
                  className="w-full rounded-input border border-border bg-bg px-3 py-2"
                  placeholder="you@domain.com"
                  autoComplete="email"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-text-secondary">Password</span>
                <input
                  type="password"
                  required
                  ref={passwordRef}
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={syncInputState}
                  className="w-full rounded-input border border-border bg-bg px-3 py-2"
                  placeholder={mode === 'signup' ? 'At least 6 characters' : '••••••••'}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                />
              </label>
              {mode === 'signup' && (
                <label className="block text-sm">
                  <span className="mb-1 block text-text-secondary">Confirm password</span>
                  <input
                    type="password"
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="w-full rounded-input border border-border bg-bg px-3 py-2"
                    placeholder="Repeat password"
                    autoComplete="new-password"
                  />
                </label>
              )}
              {mode === 'signup' && (
                <div className="space-y-3 rounded-card bg-bg p-3 text-sm text-text-secondary">
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={acceptTerms}
                      onChange={(event) => setAcceptTerms(event.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-border text-accent focus:ring-accent"
                      required
                    />
                    <span>
                      I have read and agree to the{' '}
                      <a href="/legal/terms" target="_blank" rel="noopener noreferrer" className="text-accent underline">
                        Terms of Service
                      </a>{' '}
                      and the{' '}
                      <a href="/legal/privacy" target="_blank" rel="noopener noreferrer" className="text-accent underline">
                        Privacy Policy
                      </a>
                      .
                    </span>
                  </label>
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={ageConfirmed}
                      onChange={(event) => setAgeConfirmed(event.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-border text-accent focus:ring-accent"
                      required
                    />
                    <span>I confirm I am at least {LEGAL_MIN_AGE} years old.</span>
                  </label>
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={marketingOptIn}
                      onChange={(event) => setMarketingOptIn(event.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-border text-accent focus:ring-accent"
                    />
                    <span>
                      Yes, send me occasional product emails. I can unsubscribe anytime.
                    </span>
                  </label>
                </div>
              )}

              <button
                type="submit"
                className={clsx(
                  'w-full rounded-input px-3 py-2 text-sm font-semibold transition',
                  mode === 'signup'
                    ? 'bg-accent text-white hover:bg-accentSoft'
                    : 'border border-border bg-white hover:bg-bg text-text-primary'
                )}
              >
                {mode === 'signin' ? 'Sign in with email' : 'Create account'}
              </button>
            </form>

            {mode === 'signin' ? (
              <div className="flex flex-col gap-2 text-xs">
                <button type="button" onClick={() => setMode('reset')} className="self-start text-accent hover:underline">
                  Forgot password?
                </button>
                <button
                  type="button"
                  onClick={() => setMode('signup')}
                  className="self-start rounded-pill bg-accent/10 px-3 py-2 font-semibold text-accent transition hover:bg-accent/20"
                >
                  Create a new account instead
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setMode('signin')}
                className="text-xs font-medium text-text-secondary hover:underline"
              >
                Already have an account? Sign in
              </button>
            )}
          </>
        ) : (
          <form onSubmit={sendReset} className="space-y-3">
            <label className="block text-sm">
              <span className="mb-1 block text-text-secondary">Email</span>
              <input
                type="email"
                required
                ref={emailRef}
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={syncInputState}
                className="w-full rounded-input border border-border bg-bg px-3 py-2"
                placeholder="you@domain.com"
                autoComplete="email"
              />
            </label>
            <div className="flex justify-between text-xs">
              <button type="button" onClick={() => setMode('signin')} className="text-text-secondary hover:underline">
                Back to sign in
              </button>
            </div>
            <button type="submit" className="w-full rounded-input border border-border bg-white px-3 py-2 text-sm font-medium transition hover:bg-bg">
              Send reset link
            </button>
          </form>
        )}

        {status && (
          <div
            className={clsx(
              'rounded-card border px-3 py-3 text-sm font-medium',
              statusTone === 'success'
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-border bg-bg text-text-secondary'
            )}
          >
            {status}
          </div>
        )}
        {mode === 'signin' && signupSuggestion && (
          <div className="rounded-card border border-dashed border-border bg-white/75 px-3 py-3 text-xs text-text-secondary">
            <p className="text-sm font-semibold text-text-primary">New here?</p>
            <p className="mt-1">
              Create an account with <span className="font-medium text-text-primary">{signupSuggestion.email}</span> without
              re-entering your details.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleAcceptSignupSuggestion}
                className="rounded-pill bg-accent px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-accentSoft"
              >
                Create this account
              </button>
              <button
                type="button"
                onClick={() => setSignupSuggestion(null)}
                className="rounded-pill border border-border px-3 py-1.5 text-sm font-semibold text-text-secondary transition hover:bg-bg"
              >
                I&apos;ll try again
              </button>
            </div>
          </div>
        )}
        {error && <p className="text-xs text-state-warning">{error}</p>}
      </div>
    </main>
  );
}
