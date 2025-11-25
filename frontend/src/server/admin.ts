import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/user';
import { createSupabaseServerClient } from '@/lib/supabase-ssr';

let adminCache: Map<string, boolean> | null = null;
let cacheExpiry = 0;

export class AdminAuthError extends Error {
  status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.name = 'AdminAuthError';
    this.status = status;
  }
}

async function refreshAdminCache(): Promise<void> {
  const nextExpiry = Date.now() + 30_000;
  if (!process.env.DATABASE_URL) {
    adminCache = null;
    cacheExpiry = nextExpiry;
    return;
  }
  try {
    const roleRows = await query<{ user_id: string }>(`SELECT user_id FROM user_roles WHERE role = 'admin'`);
    if (roleRows.length) {
      adminCache = new Map(roleRows.map((row) => [row.user_id, true]));
      cacheExpiry = nextExpiry;
      return;
    }
  } catch (error) {
    console.warn('[admin] failed to load user_roles', error);
  }
  try {
    const legacyRows = await query<{ user_id: string }>(`SELECT user_id FROM app_admins`);
    adminCache = new Map(legacyRows.map((row) => [row.user_id, true]));
  } catch (error) {
    console.warn('[admin] failed to load legacy admin list', error);
    adminCache = null;
  }
  cacheExpiry = nextExpiry;
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

export async function requireAdmin(req?: NextRequest): Promise<string> {
  const userId = req ? await getUserIdFromRequest(req) : await getUserIdFromCookies();
  if (!userId) {
    throw new AdminAuthError('Unauthorized', 401);
  }
  const ok = await isUserAdmin(userId);
  if (!ok) {
    throw new AdminAuthError('Forbidden', 403);
  }
  return userId;
}

export async function getUserIdFromCookies(): Promise<string | null> {
  try {
    const supabase = createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.id) {
      return user.id;
    }
  } catch {
    return null;
  }
  return null;
}

export function adminErrorToResponse(error: unknown): NextResponse {
  if (error instanceof AdminAuthError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  }
  console.error('[admin] unexpected error', error);
  return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
}
