'use client';

import { readLastKnownUserId } from '@/lib/last-known';
import { hasSupabaseAuthCookie } from '@/lib/supabase-session-hint';

type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];

export async function authFetch(input: FetchInput, init?: FetchInit): Promise<Response> {
  let token: string | null = null;
  if (readLastKnownUserId() || hasSupabaseAuthCookie()) {
    try {
      const { supabase } = await import('@/lib/supabaseClient');
      const { data } = await supabase.auth.getSession();
      token = data.session?.access_token ?? null;
    } catch {
      token = null;
    }
  }

  const headers = new Headers(init?.headers ?? {});
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
