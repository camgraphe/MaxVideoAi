'use client';

const SUPABASE_AUTH_COOKIE_PATTERN = /(?:^|;\s*)sb-[^=]+-auth-token(?:\.\d+)?=/;

export function hasSupabaseAuthCookie(): boolean {
  if (typeof document === 'undefined') return false;
  return SUPABASE_AUTH_COOKIE_PATTERN.test(document.cookie);
}
