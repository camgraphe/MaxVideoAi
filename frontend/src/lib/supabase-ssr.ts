import { cookies } from 'next/headers';
import type { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptionsWithName } from '@supabase/ssr';
import { readBearerAccessToken } from '@/lib/request-auth';
import { withMiddlewareAuthDeadline } from '@/lib/middleware/auth-deadline';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function assertSupabaseEnv() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
}

function resolveCookieDomain(): string | undefined {
  if (process.env.VERCEL_ENV === 'preview') {
    return undefined;
  }
  const explicit = process.env.COOKIE_DOMAIN?.trim() || process.env.NEXT_PUBLIC_COOKIE_DOMAIN?.trim();
  if (!explicit || explicit.includes('localhost') || explicit.includes('127.0.0.1')) {
    return undefined;
  }
  return explicit;
}

const cookieDomain = resolveCookieDomain();
const cookieOptions: CookieOptionsWithName = {
  ...(cookieDomain ? { domain: cookieDomain } : {}),
  path: '/',
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
};

const hostOnlyCookieOptions: CookieOptionsWithName = {
  path: '/',
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
};

function isInvalidRefreshTokenError(error: unknown): boolean {
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

function isSupabaseAuthCookieName(name: string): boolean {
  return name.startsWith('sb-') && name.includes('-auth-token');
}

function clearSupabaseAuthCookies(req: NextRequest, res: NextResponse) {
  for (const { name } of req.cookies.getAll()) {
    if (!isSupabaseAuthCookieName(name)) continue;
    res.cookies.set(name, '', { ...cookieOptions, maxAge: 0 });
    if (cookieDomain) {
      res.cookies.set(name, '', { ...hostOnlyCookieOptions, maxAge: 0 });
    }
  }
}

function createServerClientWithCookies(cookieStore: Awaited<Awaited<ReturnType<typeof cookies>>>, cookieOptions?: CookieOptionsWithName) {
  assertSupabaseEnv();
  return createServerClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    cookieOptions,
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value, options }) => {
          try {
            cookieStore.set(name, value, options);
          } catch {
            // Some contexts (server components) are read-only for cookies.
          }
        });
      },
    },
  });
}

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClientWithCookies(cookieStore, cookieOptions);
}

export async function createSupabaseRouteClient() {
  const cookieStore = await cookies();
  return createServerClientWithCookies(cookieStore, cookieOptions);
}

export function createSupabaseMiddlewareClient(req: NextRequest, res: NextResponse, signal?: AbortSignal) {
  assertSupabaseEnv();
  return createServerClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    cookieOptions,
    ...(signal ? { global: { fetch: (input: RequestInfo | URL, init?: RequestInit) => {
      signal.throwIfAborted();
      const signals = [signal, init?.signal, input instanceof Request ? input.signal : null]
        .filter((value): value is AbortSignal => value != null);
      // Next's Edge runtime does not implement AbortSignal.any. Keep forwarding
      // cancellation through response-body reads until the auth operation ends.
      const controller = new AbortController();
      const listeners = new Map<AbortSignal, () => void>();
      const cleanup = () => listeners.forEach((listener, source) => source.removeEventListener('abort', listener));
      for (const source of new Set(signals)) {
        if (source.aborted) {
          controller.abort(source.reason);
          break;
        }
        const listener = () => { controller.abort(source.reason); cleanup(); };
        listeners.set(source, listener);
        source.addEventListener('abort', listener, { once: true });
      }
      if (controller.signal.aborted) cleanup();
      return fetch(input, { ...init, signal: controller.signal }).catch((error) => { cleanup(); throw error; });
    } } } : {}),
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (cookiesToSet) => {
        if (signal?.aborted) return;
        cookiesToSet.forEach(({ name, value, options }) => {
          res.cookies.set(name, value, options);
        });
      },
    },
  });
}

export async function updateSession(req: NextRequest, res: NextResponse) {
  return withMiddlewareAuthDeadline(async (signal) => {
    const supabase = createSupabaseMiddlewareClient(req, res, signal);
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    signal.throwIfAborted();
    if (isInvalidRefreshTokenError(sessionError)) {
      clearSupabaseAuthCookies(req, res);
    }
    const accessToken = sessionData.session?.access_token ?? null;
    if (!accessToken || sessionError) {
      return { supabase, userId: null, error: sessionError };
    }
    const { data, error } = await supabase.auth.getClaims(accessToken);
    signal.throwIfAborted();
    const claims = data?.claims as { sub?: string } | null | undefined;
    const userId = typeof claims?.sub === 'string' ? claims.sub : null;
    return { supabase, userId, error };
  });
}

export async function getRouteAuthContext(req?: NextRequest) {
  const supabase = await createSupabaseRouteClient();
  const accessToken = readBearerAccessToken(req?.headers);

  if (accessToken) {
    const { data: userData } = await supabase.auth.getUser(accessToken);
    const tokenUserId = userData.user?.id ?? null;
    if (tokenUserId) {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (isInvalidRefreshTokenError(sessionError)) {
        await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
      }
      return { supabase, session: sessionData.session ?? null, userId: tokenUserId };
    }
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (isInvalidRefreshTokenError(sessionError)) {
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
  }
  const session = sessionData.session ?? null;
  if (!session?.access_token) {
    return { supabase, session, userId: null };
  }
  const { data: claimsData } = await supabase.auth.getClaims(session.access_token);
  const sessionUserId = typeof claimsData?.claims?.sub === 'string' ? claimsData.claims.sub : null;
  return { supabase, session, userId: sessionUserId };
}
