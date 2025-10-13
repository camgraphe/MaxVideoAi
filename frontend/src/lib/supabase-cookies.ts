'use client';

import type { Session } from '@supabase/supabase-js';

export function syncSupabaseCookies(session: Session | null) {
  if (typeof document === 'undefined') return;
  if (!session?.access_token) {
    clearSupabaseCookies();
    return;
  }

  const accessToken = session.access_token;
  const refreshToken = session.refresh_token;
  const nowSeconds = Date.now() / 1000;
  const expiresAt =
    typeof session.expires_at === 'number'
      ? session.expires_at
      : nowSeconds + (session.expires_in ?? 3600);
  const accessMaxAge = Math.max(0, Math.round(expiresAt - nowSeconds));
  setCookie('sb-access-token', accessToken, accessMaxAge);
  setCookie('supabase-access-token', accessToken, accessMaxAge);

  if (typeof refreshToken === 'string' && refreshToken) {
    const refreshMaxAge = Math.max(accessMaxAge, 30 * 24 * 60 * 60);
    setCookie('sb-refresh-token', refreshToken, refreshMaxAge);
    setCookie('supabase-refresh-token', refreshToken, refreshMaxAge);
  }
}

export function clearSupabaseCookies() {
  if (typeof document === 'undefined') return;
  deleteCookie('sb-access-token');
  deleteCookie('sb-refresh-token');
  deleteCookie('supabase-access-token');
  deleteCookie('supabase-refresh-token');
}

function setCookie(name: string, value: string, maxAgeSeconds: number) {
  if (typeof document === 'undefined') return;
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'SameSite=Lax'];
  const maxAge = Number.isFinite(maxAgeSeconds) ? Math.max(0, Math.floor(maxAgeSeconds)) : 0;
  parts.push(`Max-Age=${maxAge}`);
  if (typeof window !== 'undefined' && window.location?.protocol === 'https:') {
    parts.push('Secure');
  }
  document.cookie = parts.join('; ');
}

function deleteCookie(name: string) {
  if (typeof document === 'undefined') return;
  const parts = [`${name}=`, 'Path=/', 'Expires=Thu, 01 Jan 1970 00:00:00 GMT', 'SameSite=Lax'];
  if (typeof window !== 'undefined' && window.location?.protocol === 'https:') {
    parts.push('Secure');
  }
  document.cookie = parts.join('; ');
}
