import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';

const AUTH_CACHE_REFRESH_MS = 60_000;

type AuthCacheState = {
  session: Session | null;
  user: User | null;
  updatedAt: number;
};

const AUTH_CACHE: AuthCacheState = {
  session: null,
  user: null,
  updatedAt: 0,
};

let AUTH_SESSION_PROMISE: Promise<Session | null> | null = null;

export function readAuthCache(): { session: Session | null; user: User | null; isFresh: boolean } {
  const session = AUTH_CACHE.session;
  const user = AUTH_CACHE.user ?? session?.user ?? null;
  const isFresh = Boolean(session) && Date.now() - AUTH_CACHE.updatedAt < AUTH_CACHE_REFRESH_MS;
  return { session, user, isFresh };
}

export function updateAuthCache(session: Session | null, user: User | null) {
  AUTH_CACHE.session = session;
  AUTH_CACHE.user = user ?? session?.user ?? null;
  AUTH_CACHE.updatedAt = Date.now();
}

export function clearAuthCache() {
  updateAuthCache(null, null);
}

export function fetchSessionOnce(): Promise<Session | null> {
  if (AUTH_SESSION_PROMISE) return AUTH_SESSION_PROMISE;
  AUTH_SESSION_PROMISE = supabase.auth
    .getSession()
    .then((sessionResult) => sessionResult.data.session ?? null)
    .finally(() => {
      AUTH_SESSION_PROMISE = null;
    });
  return AUTH_SESSION_PROMISE;
}
