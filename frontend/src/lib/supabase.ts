import { createClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';
import { ACCESS_TOKEN_COOKIE_NAMES } from '@/lib/supabase-cookie-keys';

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();

export function getSupabaseServer() {
  if (!url || !anonKey) throw new Error('Supabase env vars missing');
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function readAccessToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization');
  if (auth && auth.startsWith('Bearer ')) return auth.slice('Bearer '.length).trim();
  for (const cookieName of ACCESS_TOKEN_COOKIE_NAMES) {
    const cookieValue = req.cookies.get(cookieName)?.value;
    if (cookieValue) {
      return cookieValue;
    }
  }
  return null;
}

function decodeUserIdFromToken(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const json = Buffer.from(padded, 'base64').toString('utf8');
    const payload = JSON.parse(json) as { sub?: unknown };
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

export async function getUserIdFromSupabase(req: NextRequest): Promise<string | null> {
  const token = readAccessToken(req);
  if (!token) return null;

  try {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase.auth.getUser(token);
    if (!error && data?.user?.id) {
      return data.user.id;
    }
  } catch {
    // swallow and attempt local decode fallback
  }

  if (process.env.NODE_ENV !== 'production') {
    return decodeUserIdFromToken(token);
  }

  return null;
}
