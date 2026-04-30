import { cookies } from 'next/headers';
import type { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptionsWithName } from '@supabase/ssr';
import { readBearerAccessToken } from '@/lib/request-auth';

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

export function createSupabaseMiddlewareClient(req: NextRequest, res: NextResponse) {
  assertSupabaseEnv();
  return createServerClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    cookieOptions,
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value, options }) => {
          res.cookies.set(name, value, options);
        });
      },
    },
  });
}

export async function updateSession(req: NextRequest, res: NextResponse) {
  const supabase = createSupabaseMiddlewareClient(req, res);
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims as { sub?: string } | null | undefined;
  const userId = typeof claims?.sub === 'string' ? claims.sub : null;
  return { supabase, userId, error };
}

export async function getRouteAuthContext(req?: NextRequest) {
  const supabase = await createSupabaseRouteClient();
  const accessToken = readBearerAccessToken(req?.headers);

  if (accessToken) {
    const [{ data: sessionData }, { data: userData }] = await Promise.all([
      supabase.auth.getSession(),
      supabase.auth.getUser(accessToken),
    ]);
    const tokenUserId = userData.user?.id ?? null;
    if (tokenUserId) {
      return { supabase, session: sessionData.session ?? null, userId: tokenUserId };
    }
  }

  const [{ data: sessionData }, { data: claimsData }] = await Promise.all([
    supabase.auth.getSession(),
    supabase.auth.getClaims(),
  ]);
  const session = sessionData.session ?? null;
  const sessionUserId = typeof claimsData?.claims?.sub === 'string' ? claimsData.claims.sub : null;
  return { supabase, session, userId: sessionUserId };
}
