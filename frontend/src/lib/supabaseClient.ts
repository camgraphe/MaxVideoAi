'use client';

import { createClient } from '@supabase/supabase-js';
import { createStorageFromOptions } from '@supabase/ssr/dist/module/cookies';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

function resolveCookieDomain(): string | undefined {
  const explicit = process.env.NEXT_PUBLIC_COOKIE_DOMAIN?.trim() || process.env.COOKIE_DOMAIN?.trim();
  if (!explicit || explicit.includes('localhost') || explicit.includes('127.0.0.1')) {
    return undefined;
  }
  if (typeof window === 'undefined') return explicit;
  const normalizedDomain = explicit.replace(/^\./, '').toLowerCase();
  const hostname = window.location.hostname.toLowerCase();
  return hostname === normalizedDomain || hostname.endsWith(`.${normalizedDomain}`) ? explicit : undefined;
}

const cookieDomain = resolveCookieDomain();
const cookieOptions = {
  ...(cookieDomain ? { domain: cookieDomain } : {}),
  path: '/',
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
};

const { storage } = createStorageFromOptions(
  {
    cookieEncoding: 'base64url',
    cookieOptions,
  },
  false
);

// The SSR browser factory always enables URL session detection; the login page owns PKCE code exchange.
export const supabase = createClient(supabaseUrl, supabaseKey, {
  global: {
    headers: {
      'X-Client-Info': 'maxvideoai-browser-auth',
    },
  },
  auth: {
    flowType: 'pkce',
    autoRefreshToken: true,
    detectSessionInUrl: false,
    persistSession: true,
    storage,
  },
});
