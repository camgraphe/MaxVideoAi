import { cookies } from 'next/headers';
import type { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptionsWithName } from '@supabase/ssr';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function assertSupabaseEnv() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
}

function resolveCookieDomain(): string | undefined {
  const explicit = process.env.NEXT_PUBLIC_COOKIE_DOMAIN?.trim() || process.env.COOKIE_DOMAIN?.trim();
  if (explicit) {
    if (explicit.includes('localhost') || explicit.includes('127.0.0.1')) return undefined;
    return explicit;
  }
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || '';
  if (siteUrl.includes('maxvideoai.com')) {
    return 'maxvideoai.com';
  }
  return undefined;
}

const cookieDomain = resolveCookieDomain();
const cookieOptions: CookieOptionsWithName = {
  ...(cookieDomain ? { domain: cookieDomain } : {}),
  path: '/',
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
};

function createServerClientWithCookies(cookieStore: ReturnType<typeof cookies>, cookieOptions?: CookieOptionsWithName) {
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

export function createSupabaseServerClient() {
  const cookieStore = cookies();
  return createServerClientWithCookies(cookieStore, cookieOptions);
}

export function createSupabaseRouteClient() {
  const cookieStore = cookies();
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

export async function getRouteAuthContext(_req?: NextRequest) {
  void _req;
  const supabase = createSupabaseRouteClient();
  const [{ data: sessionData }, { data: userData }] = await Promise.all([
    supabase.auth.getSession(),
    supabase.auth.getUser(),
  ]);
  const session = sessionData.session ?? null;
  const sessionUserId = userData.user?.id ?? null;
  return { supabase, session, userId: sessionUserId };
}
