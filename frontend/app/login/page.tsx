'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { syncSupabaseCookies, clearSupabaseCookies } from '@/lib/supabase-cookies';
import clsx from 'clsx';

export const dynamic = 'force-dynamic';

type AuthMode = 'signin' | 'signup' | 'reset';

export default function LoginPage() {
  const router = useRouter();
  const [nextPath, setNextPath] = useState<string>('/app');
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : '')) as string;
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<'info' | 'success'>('info');
  const [error, setError] = useState<string | null>(null);
  const nextQuery = useMemo(() => (nextPath && nextPath !== '/' ? `?next=${encodeURIComponent(nextPath)}` : ''), [nextPath]);
  const redirectTo = useMemo(() => (siteUrl ? `${siteUrl}${nextQuery}` : undefined), [siteUrl, nextQuery]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const value = params.get('next');
    if (value && value.startsWith('/')) {
      setNextPath(value);
    }
  }, []);

  async function signInWithPassword(e: React.FormEvent) {
    e.preventDefault();
    setStatusTone('info');
    setStatus('Signing in…');
    setError(null);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setStatus(null);
      return;
    }
    setStatus('Signed in. Redirecting…');
    setStatusTone('info');
    syncSupabaseCookies(data.session ?? null);
    router.replace(nextPath);
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
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectTo },
    });
    if (error) {
      setError(error.message);
      setStatus(null);
      return;
    }
    setStatusTone('success');
    setStatus('Check your inbox to confirm your email.');
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
      },
    });
    if (error) {
      setError(error.message);
      setStatus(null);
      return;
    }
    if (data?.url) {
      window.location.href = data.url;
    }
  }

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      const session = data.session ?? null;
      if (cancelled) return;
      if (session?.access_token) {
        syncSupabaseCookies(session);
        router.replace(nextPath);
      } else {
        clearSupabaseCookies();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [router, nextPath]);

  const effectiveMode: AuthMode = mode === 'reset' ? 'signin' : mode;

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-6">
      <div className="w-full max-w-md space-y-5 rounded-card border border-border bg-white p-6 shadow-card">
        <header className="space-y-4">
          <div>
            <h1 className="text-lg font-semibold text-text-primary">
              {mode === 'signup' ? 'Create your workspace account' : mode === 'reset' ? 'Reset your password' : 'Access your workspace'}
            </h1>
            <p className="text-sm text-text-secondary">
              {mode === 'signup'
                ? 'Get instant access to the MaxVideoAI workspace. We’ll confirm your email before your first render.'
                : mode === 'reset'
                  ? 'We’ll send a secure link to reset your password.'
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
              <span aria-hidden className="text-lg">⚡️</span>
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
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
        {error && <p className="text-xs text-state-warning">{error}</p>}
      </div>
    </main>
  );
}
