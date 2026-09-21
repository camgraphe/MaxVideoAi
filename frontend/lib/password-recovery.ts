import type { SupabaseClient } from '@supabase/supabase-js';
import { safeInternalReturnTarget } from './auth-return-target';

export const PASSWORD_RECOVERY_PATH = '/auth/reset-password';
export type RecoveryProof = { kind: 'code'; value: string }
  | { kind: 'tokenHash'; value: string }
  | { kind: 'session'; accessToken: string; refreshToken: string };
type RecoveryAuth = Pick<SupabaseClient['auth'], 'exchangeCodeForSession' | 'verifyOtp' | 'setSession' | 'getUser' | 'updateUser'>;

export function safeRecoveryNext(value: string | null | undefined): string {
  const next = safeInternalReturnTarget(value, '/app');
  return /^\/(?:auth|login|api|_next)(?:[/?#]|$)/.test(next) ? '/app' : next;
}

export function parseRecoveryProof(search: string, hash: string): RecoveryProof | null {
  const query = new URLSearchParams(search);
  const fragment = new URLSearchParams(hash.replace(/^#/, ''));
  if (query.has('error') || fragment.has('error')) return null;
  const tokenHash = query.get('token_hash');
  if (tokenHash) return { kind: 'tokenHash', value: tokenHash };
  const code = query.get('code');
  if (code) return { kind: 'code', value: code };
  const accessToken = fragment.get('access_token');
  const refreshToken = fragment.get('refresh_token');
  return fragment.get('type') === 'recovery' && accessToken && refreshToken
    ? { kind: 'session', accessToken, refreshToken } : null;
}

export async function verifyRecoveryProof(auth: RecoveryAuth, proof: RecoveryProof): Promise<string | null> {
  try {
    const { data, error } = proof.kind === 'code'
      ? await auth.exchangeCodeForSession(proof.value)
      : proof.kind === 'tokenHash'
        ? await auth.verifyOtp({ token_hash: proof.value, type: 'recovery' })
        : await auth.setSession({ access_token: proof.accessToken, refresh_token: proof.refreshToken });
    if (error || !data.session?.user?.id) return null;
    const verified = await auth.getUser();
    return !verified.error && verified.data.user?.id === data.session.user.id ? data.session.user.id : null;
  } catch {
    return null;
  }
}

export type PasswordUpdateResult = 'saved' | 'tooShort' | 'mismatch' | 'weak' | 'same' | 'invalid' | 'unavailable';

export async function updateRecoveredPassword(
  auth: RecoveryAuth, userId: string, password: string, confirmation: string
): Promise<PasswordUpdateResult> {
  if (password.length < 6) return 'tooShort';
  if (password !== confirmation) return 'mismatch';
  try {
    const verified = await auth.getUser();
    if (verified.error || verified.data.user?.id !== userId) return 'invalid';
    const { error } = await auth.updateUser({ password });
    if (!error) return 'saved';
    if (error.code === 'weak_password') return 'weak';
    if (error.code === 'same_password') return 'same';
    if (error.status === 401 || ['reauthentication_needed', 'session_not_found', 'refresh_token_not_found'].includes(error.code ?? '')) return 'invalid';
    return 'unavailable';
  } catch {
    return 'unavailable';
  }
}

// Hosted email templates wrap RedirectTo as data, never as a navigation target.
// Extract only the supported locale and an independently sanitized continuation.
export function recoveryEmailDestination(value: string | undefined): { locale?: string; next: string } {
  try {
    const target = new URL(value ?? '');
    if (target.origin !== 'https://maxvideoai.com' || target.pathname !== '/auth/callback') return { next: '/app' };
    const locale = target.searchParams.get('lang') ?? '';
    return { locale: ['en', 'fr', 'es'].includes(locale) ? locale : undefined, next: safeRecoveryNext(target.searchParams.get('next')) };
  } catch {
    return { next: '/app' };
  }
}

export function recoveryContinuationHref(next: string, locale: string): string {
  const target = new URL(safeRecoveryNext(next), 'https://maxvideoai.com');
  target.searchParams.set('lang', ['en', 'fr', 'es'].includes(locale) ? locale : 'en');
  return target.pathname + target.search + target.hash;
}
