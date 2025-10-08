'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export const dynamic = 'force-dynamic';

type Provider = 'github' | 'google';
type AuthMode = 'magic' | 'password' | 'signup' | 'reset';

export default function LoginPage() {
  const router = useRouter();
  const [nextPath, setNextPath] = useState<string>('/app');
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : '')) as string;
  const [mode, setMode] = useState<AuthMode>('magic');
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

  async function signInWithMagic(e: React.FormEvent) {
    e.preventDefault();
    setStatus('Sending magic link…');
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: siteUrl ? `${siteUrl}${nextPath && nextPath !== '/' ? `?next=${encodeURIComponent(nextPath)}` : ''}` : undefined },
    });
    if (error) setError(error.message);
    else setStatus('Check your inbox for a sign-in link.');
  }

  async function signInWithPassword(e: React.FormEvent) {
    e.preventDefault();
    setStatus('Signing in…');
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    else {
      setStatus('Signed in. Redirecting…');
      router.replace(nextPath);
    }
  }

  async function signUpWithPassword(e: React.FormEvent) {
    e.preventDefault();
    setStatus('Creating account…');
    setError(null);
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: siteUrl ? `${siteUrl}${nextPath && nextPath !== '/' ? `?next=${encodeURIComponent(nextPath)}` : ''}` : undefined },
    });
    if (error) setError(error.message);
    else setStatus('Check your inbox to confirm your email.');
  }

  async function sendReset(e: React.FormEvent) {
    e.preventDefault();
    setStatus('Sending reset link…');
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: siteUrl || undefined });
    if (error) setError(error.message);
    else setStatus('Password reset email sent.');
  }

  async function signInProvider(provider: Provider) {
    setStatus(`Redirecting to ${provider}…`);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: siteUrl ? `${siteUrl}${nextPath && nextPath !== '/' ? `?next=${encodeURIComponent(nextPath)}` : ''}` : undefined,
      },
    });
    if (error) setError(error.message);
  }

  // If already signed in (e.g., returning from magic link/OAuth), redirect
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled && data.session?.access_token) {
        router.replace(nextPath);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [router, nextPath]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-6">
      <div className="w-full max-w-md space-y-4 rounded-card border border-border bg-white p-6 shadow-card">
        <h1 className="text-lg font-semibold text-text-primary">Sign in</h1>

        {/* Mode switcher */}
        <div className="grid grid-cols-4 gap-2 text-xs">
          <button onClick={() => setMode('magic')} className={`rounded-input border px-2 py-1 ${mode==='magic'?'bg-bg border-ring':'border-border hover:bg-bg'}`}>Magic link</button>
          <button onClick={() => setMode('password')} className={`rounded-input border px-2 py-1 ${mode==='password'?'bg-bg border-ring':'border-border hover:bg-bg'}`}>Password</button>
          <button onClick={() => setMode('signup')} className={`rounded-input border px-2 py-1 ${mode==='signup'?'bg-bg border-ring':'border-border hover:bg-bg'}`}>Sign up</button>
          <button onClick={() => setMode('reset')} className={`rounded-input border px-2 py-1 ${mode==='reset'?'bg-bg border-ring':'border-border hover:bg-bg'}`}>Reset</button>
        </div>

        {mode === 'magic' && (
          <form onSubmit={signInWithMagic} className="space-y-3">
            <label className="block text-sm">
              <span className="mb-1 block text-text-secondary">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-input border border-border bg-bg px-3 py-2"
                placeholder="you@domain.com"
              />
            </label>
            <button type="submit" className="w-full rounded-input border border-border bg-white px-3 py-2 text-sm font-medium hover:bg-bg">
              Send magic link
            </button>
          </form>
        )}

        {mode === 'password' && (
          <form onSubmit={signInWithPassword} className="space-y-3">
            <label className="block text-sm">
              <span className="mb-1 block text-text-secondary">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-input border border-border bg-bg px-3 py-2"
                placeholder="you@domain.com"
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
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </label>
            <div className="flex items-center justify-between text-xs">
              <button type="button" onClick={() => setMode('reset')} className="text-accent hover:underline">Forgot password?</button>
            </div>
            <button type="submit" className="w-full rounded-input border border-border bg-white px-3 py-2 text-sm font-medium hover:bg-bg">
              Sign in
            </button>
          </form>
        )}

        {mode === 'signup' && (
          <form onSubmit={signUpWithPassword} className="space-y-3">
            <label className="block text-sm">
              <span className="mb-1 block text-text-secondary">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-input border border-border bg-bg px-3 py-2"
                placeholder="you@domain.com"
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
                placeholder="At least 6 characters"
                autoComplete="new-password"
              />
            </label>
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
            <button type="submit" className="w-full rounded-input border border-border bg-white px-3 py-2 text-sm font-medium hover:bg-bg">
              Create account
            </button>
          </form>
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
              />
            </label>
            <button type="submit" className="w-full rounded-input border border-border bg-white px-3 py-2 text-sm font-medium hover:bg-bg">
              Send reset link
            </button>
          </form>
        )}

        <div className="flex items-center gap-2 text-xs text-text-muted">
          <span className="flex-1 border-t border-border" />
          <span>or</span>
          <span className="flex-1 border-t border-border" />
        </div>

        <div className="grid gap-2">
          <button onClick={() => signInProvider('github')} className="rounded-input border border-border bg-white px-3 py-2 text-sm hover:bg-bg">
            Continue with GitHub
          </button>
          <button onClick={() => signInProvider('google')} className="rounded-input border border-border bg-white px-3 py-2 text-sm hover:bg-bg">
            Continue with Google
          </button>
        </div>

        {status && <p className="text-xs text-text-secondary">{status}</p>}
        {error && <p className="text-xs text-state-warning">{error}</p>}

        <p className="text-xs text-text-secondary">
          Back to <Link href="/" className="text-accent hover:underline">Generate</Link>
        </p>
      </div>
    </main>
  );
}
