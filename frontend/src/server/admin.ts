import type { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { query } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/user';
import { getSupabaseServer } from '@/lib/supabase';

let adminCache: Map<string, boolean> | null = null;
let cacheExpiry = 0;

async function refreshAdminCache(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    adminCache = null;
    cacheExpiry = Date.now() + 30_000;
    return;
  }
  const rows = await query<{ user_id: string }>(`SELECT user_id FROM app_admins`);
  adminCache = new Map(rows.map((row) => [row.user_id, true]));
  cacheExpiry = Date.now() + 30_000;
}

export async function isUserAdmin(userId: string | null | undefined): Promise<boolean> {
  if (!userId || !process.env.DATABASE_URL) return false;
  const now = Date.now();
  if (!adminCache || now > cacheExpiry) {
    await refreshAdminCache().catch(() => {
      adminCache = null;
      cacheExpiry = now + 10_000;
    });
  }
  return adminCache?.get(userId) ?? false;
}

export async function requireAdmin(req: NextRequest): Promise<string> {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    throw new Response('Unauthorized', { status: 401 });
  }
  const ok = await isUserAdmin(userId);
  if (!ok) {
    throw new Response('Forbidden', { status: 403 });
  }
  return userId;
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

function getTokenFromCookies(): string | null {
  const jar = cookies();
  return jar.get('sb-access-token')?.value ?? jar.get('supabase-access-token')?.value ?? null;
}

export async function getUserIdFromCookies(): Promise<string | null> {
  const token = getTokenFromCookies();
  if (!token) return null;

  try {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase.auth.getUser(token);
    if (!error && data?.user?.id) {
      return data.user.id;
    }
  } catch {
    // ignore and fall back to decoding below
  }

  if (process.env.NODE_ENV !== 'production') {
    return decodeUserIdFromToken(token);
  }

  return null;
}
