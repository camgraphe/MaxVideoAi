'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { syncSupabaseCookies, clearSupabaseCookies } from '@/lib/supabase-cookies';

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
  const [error, setError] = useState<string | null>(null);

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
    setStatus('Signing in…');
    setError(null);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setStatus(null);
      return;
    }
    setStatus('Signed in. Redirecting…');
    syncSupabaseCookies(data.session ?? null);
    router.replace(nextPath);
  }

  async function signUpWithPassword(e: React.FormEvent) {
    e.preventDefault();
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
      options: { emailRedirectTo: siteUrl ? `${siteUrl}${nextPath && nextPath !== '/' ? `?next=${encodeURIComponent(nextPath)}` : ''}` : undefined },
    });
    if (error) {
      setError(error.message);
      setStatus(null);
      return;
    }
    setStatus('Check your inbox to confirm your email.');
  }

  async function sendReset(e: React.FormEvent) {
    e.preventDefault();
    setStatus('Sending reset link…');
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: siteUrl || undefined });
    if (error) {
      setError(error.message);
      setStatus(null);
      return;
    }
    setStatus('Password reset email sent.');
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

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-6">
      <div className="w-full max-w-md space-y-5 rounded-card border border-border bg-white p-6 shadow-card">
        <header className="space-y-1">
          <h1 className="text-lg font-semibold text-text-primary">Access your workspace</h1>
          <p className="text-sm text-text-secondary">Sign in with email and password. Social login returns soon.</p>
        </header>

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

          <button type="submit" className="w-full rounded-input border border-border bg-white px-3 py-2 text-sm font-medium transition hover:bg-bg">
            {mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        {mode === 'signin' && (
          <div className="flex flex-col gap-2 text-xs">
            <button type="button" onClick={() => setMode('reset')} className="self-start text-accent hover:underline">
              Forgot password?
            </button>
            <p className="text-text-secondary">
              Need a workspace account?{' '}
              <button
                type="button"
                onClick={() => setMode('signup')}
                className="font-semibold text-text-primary hover:underline"
              >
                Create one now
              </button>
              .
            </p>
          </div>
        )}

        {mode === 'signup' && (
          <button
            type="button"
            onClick={() => setMode('signin')}
            className="text-xs text-text-secondary hover:underline"
          >
            Already have an account? Sign in
          </button>
        )}

        {mode === 'reset' && (
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

        {status && <p className="text-xs text-text-secondary">{status}</p>}
        {error && <p className="text-xs text-state-warning">{error}</p>}
      </div>
    </main>
  );
}
