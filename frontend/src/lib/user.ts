import type { NextRequest } from 'next/server';
import { cookies as readServerCookies } from 'next/headers';
import { getUserIdFromSupabase } from '@/lib/supabase';

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

// Resolve user from Supabase; fallback to headers/cookies when invoked in server components
export async function getUserIdFromRequest(req?: NextRequest): Promise<string | null> {
  if (req) {
    const uid = await getUserIdFromSupabase(req);
    if (uid) return uid;
    const header = req.headers.get('x-user-id');
    if (process.env.NODE_ENV !== 'production' && header && header.trim()) return header.trim();
    return null;
  }

  try {
    const store = readServerCookies();
    const token =
      store.get('sb-access-token')?.value ??
      store.get('supabase-access-token')?.value ??
      null;
    if (!token) return null;
    return decodeUserIdFromToken(token);
  } catch {
    return null;
  }
}
