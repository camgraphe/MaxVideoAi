'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { loadSupabaseClient } from '@/lib/supabaseClientLoader';
import { writeLastKnownUserId } from '@/lib/last-known';
import { parseRecoveryProof, verifyRecoveryProof, updateRecoveredPassword, type RecoveryProof, type PasswordUpdateResult } from '@/lib/password-recovery';
import type { AppLocale } from '@/i18n/locales';
import en from '@/messages/en.json';
import fr from '@/messages/fr.json';
import es from '@/messages/es.json';

const COPY = { en: en.passwordRecovery, fr: fr.passwordRecovery, es: es.passwordRecovery };
type Phase = 'loading' | 'verify' | 'verifying' | 'ready' | 'saving' | 'saved' | 'invalid';

export function PasswordRecoveryForm({ locale, next }: { locale: AppLocale; next: string }) {
  const copy = COPY[locale];
  const [phase, setPhase] = useState<Phase>('loading');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<Exclude<PasswordUpdateResult, 'saved'> | null>(null);
  const initialized = useRef(false);
  const busy = useRef(false);
  const proof = useRef<RecoveryProof | null>(null);
  const userId = useRef<string | null>(null);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    proof.current = parseRecoveryProof(window.location.search, window.location.hash);
    // One-time credentials stay in memory only and leave browser history immediately.
    const clean = new URL(window.location.href);
    clean.search = new URLSearchParams({ next, lang: locale }).toString();
    clean.hash = '';
    window.history.replaceState({}, '', clean.pathname + clean.search);
    setPhase(proof.current ? 'verify' : 'invalid');
  }, [next, locale]);

  async function verify() {
    if (busy.current || !proof.current) return;
    busy.current = true;
    setPhase('verifying');
    try {
      const client = await loadSupabaseClient();
      userId.current = await verifyRecoveryProof(client.auth, proof.current);
      proof.current = null;
      setPhase(userId.current ? 'ready' : 'invalid');
    } catch {
      setPhase('invalid');
    } finally {
      busy.current = false;
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || phase !== 'ready' || !userId.current) return;
    busy.current = true;
    setPhase('saving');
    setError(null);
    try {
      const client = await loadSupabaseClient();
      const result = await updateRecoveredPassword(client.auth, userId.current, password, confirmation);
      if (result === 'saved') {
        setPassword('');
        setConfirmation('');
        writeLastKnownUserId(userId.current);
        setPhase('saved');
      } else {
        setError(result);
        setPhase(result === 'invalid' ? 'invalid' : 'ready');
      }
    } catch {
      setError('unavailable');
      setPhase('ready');
    } finally {
      busy.current = false;
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-5 py-12 text-text-primary">
      <section className="w-full max-w-md space-y-5 rounded-card border border-border bg-surface p-6">
        <p className="text-sm font-semibold">MaxVideoAI</p>
        <h1 className="text-2xl font-semibold">{copy.title}</h1>
        {(phase === 'loading' || phase === 'verifying') && <p role="status">{copy.verifying}</p>}
        {phase === 'verify' && <>
          <p>{copy.intro}</p>
          <Button className="w-full" onClick={() => void verify()}>{copy.verify}</Button>
        </>}
        {(phase === 'ready' || phase === 'saving') && <form onSubmit={save} className="space-y-4">
          <p>{copy.ready}</p>
          <label className="block space-y-2" htmlFor="new-password">
            <span>{copy.password}</span>
            <Input id="new-password" name="password" type="password" autoComplete="new-password" required minLength={6} value={password} onChange={event => setPassword(event.target.value)} disabled={phase === 'saving'} aria-describedby={error ? 'recovery-error' : undefined} />
          </label>
          <label className="block space-y-2" htmlFor="confirm-new-password">
            <span>{copy.confirm}</span>
            <Input id="confirm-new-password" name="confirmation" type="password" autoComplete="new-password" required minLength={6} value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={phase === 'saving'} aria-describedby={error ? 'recovery-error' : undefined} />
          </label>
          {error && <p id="recovery-error" role="alert" className="text-state-warning">{copy[error]}</p>}
          <Button type="submit" className="w-full" disabled={phase === 'saving'} aria-busy={phase === 'saving'}>{phase === 'saving' ? copy.saving : copy.save}</Button>
        </form>}
        {phase === 'invalid' && <>
          <p role="alert">{copy.invalid}</p>
          <a className="block text-brand underline" href={`/login?mode=reset&next=${encodeURIComponent(next)}&lang=${locale}`}>{copy.requestNew}</a>
        </>}
        {phase === 'saved' && <>
          <p role="status">{copy.saved}</p>
          <a className="block text-brand underline" href={next}>{copy.continueToApp}</a>
        </>}
      </section>
    </main>
  );
}
