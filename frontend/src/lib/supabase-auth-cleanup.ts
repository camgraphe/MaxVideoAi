'use client';

import type { Session } from '@supabase/supabase-js';
import { clearLastKnownAccount, writeLastKnownUserId } from '@/lib/last-known';
import { supabase } from '@/lib/supabaseClient';

let staleAuthClearPromise: Promise<void> | null = null;

export function isInvalidRefreshTokenError(error: unknown): boolean {
  const candidate = error as { code?: unknown; message?: unknown; status?: unknown } | null;
  const code = typeof candidate?.code === 'string' ? candidate.code.toLowerCase() : '';
  const message = typeof candidate?.message === 'string' ? candidate.message.toLowerCase() : '';
  return (
    code === 'refresh_token_not_found' ||
    code === 'invalid_refresh_token' ||
    message.includes('invalid refresh token') ||
    message.includes('refresh token not found')
  );
}

export function isPkceCodeVerifierError(error: unknown): boolean {
  const candidate = error as { code?: unknown; message?: unknown } | null;
  const code = typeof candidate?.code === 'string' ? candidate.code.toLowerCase() : '';
  const message = typeof candidate?.message === 'string' ? candidate.message.toLowerCase() : '';
  return (
    code === 'bad_code_verifier' ||
    message.includes('code challenge does not match') ||
    message.includes('code verifier')
  );
}

function isSupabaseAuthCookieName(name: string): boolean {
  return name.startsWith('sb-') && name.includes('-auth-token');
}

function getCookieDomainCandidates(): Array<string | undefined> {
  if (typeof window === 'undefined') return [undefined];
  const hostname = window.location.hostname.trim().toLowerCase();
  const candidates = new Set<string | undefined>([undefined]);
  if (!hostname || hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    return Array.from(candidates);
  }
  candidates.add(hostname);
  if (hostname.startsWith('www.')) {
    const apex = hostname.slice(4);
    candidates.add(apex);
    candidates.add(`.${apex}`);
  }
  const parts = hostname.split('.').filter(Boolean);
  if (parts.length >= 2) {
    candidates.add(`.${parts.slice(-2).join('.')}`);
  }
  return Array.from(candidates);
}

function expireBrowserCookie(name: string, domain?: string): void {
  if (typeof document === 'undefined') return;
  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
  const domainAttribute = domain ? `; domain=${domain}` : '';
  document.cookie = `${name}=; Max-Age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domainAttribute}; SameSite=Lax${secure}`;
}

function clearBrowserSupabaseAuthCookies(): void {
  if (typeof document === 'undefined') return;
  const names = document.cookie
    .split(';')
    .map((cookie) => cookie.split('=')[0]?.trim())
    .filter((name): name is string => Boolean(name && isSupabaseAuthCookieName(name)));
  const domains = getCookieDomainCandidates();
  for (const name of names) {
    for (const domain of domains) {
      expireBrowserCookie(name, domain);
    }
  }
}

export async function clearStaleBrowserAuthState(): Promise<void> {
  if (staleAuthClearPromise) return staleAuthClearPromise;
  staleAuthClearPromise = (async () => {
    clearBrowserSupabaseAuthCookies();
    clearLastKnownAccount();
    writeLastKnownUserId(null);
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('wallet:invalidate'));
    }
  })().finally(() => {
    staleAuthClearPromise = null;
  });
  return staleAuthClearPromise;
}

export async function readBrowserSession(): Promise<Session | null> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      if (isInvalidRefreshTokenError(error)) {
        await clearStaleBrowserAuthState();
      }
      return null;
    }
    return data.session ?? null;
  } catch (error) {
    if (isInvalidRefreshTokenError(error)) {
      await clearStaleBrowserAuthState();
    }
    return null;
  }
}

export async function refreshBrowserSession(): Promise<Session | null> {
  try {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) {
      if (isInvalidRefreshTokenError(error)) {
        await clearStaleBrowserAuthState();
      }
      return null;
    }
    return data.session ?? null;
  } catch (error) {
    if (isInvalidRefreshTokenError(error)) {
      await clearStaleBrowserAuthState();
    }
    return null;
  }
}
