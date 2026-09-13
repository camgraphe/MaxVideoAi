'use client';

import { readLastKnownUserId } from '@/lib/last-known';
import { hasSupabaseAuthCookie } from '@/lib/supabase-session-hint';

type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];

export async function authFetch(input: FetchInput, init?: FetchInit): Promise<Response> {
  const headers = new Headers(init?.headers ?? {});
  let token: string | null = null;
  // An explicit token is authoritative; do not insert a session await before its dispatch.
  if (!headers.has('Authorization') && (readLastKnownUserId() || hasSupabaseAuthCookie())) {
    try {
      const { supabase } = await import('@/lib/supabaseClient');
      const { data } = await supabase.auth.getSession();
      token = data.session?.access_token ?? null;
    } catch {
      token = null;
    }
  }

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const credentials = init?.credentials ?? 'include';

  return fetch(input, {
    ...init,
    headers,
    credentials,
  });
}
export function hasAuthFetchSessionHint(): boolean {
  return Boolean(readLastKnownUserId() || hasSupabaseAuthCookie());
}
