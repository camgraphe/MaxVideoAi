'use client';

import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY');
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
const cookieOptions = {
  ...(cookieDomain ? { domain: cookieDomain } : {}),
  path: '/',
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
};

export const supabase = createBrowserClient(supabaseUrl, supabaseKey, {
  cookieOptions,
  auth: {
    detectSessionInUrl: false,
  },
});
