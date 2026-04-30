import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import { query } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/user';
import { createSupabaseServerClient } from '@/lib/supabase-ssr';

let adminCache: Map<string, boolean> | null = null;
let cacheExpiry = 0;

export const LOCAL_ADMIN_BYPASS_COOKIE = 'mva_local_admin_bypass';

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

async function resolveRequestHost(req?: NextRequest): Promise<string | null> {
  if (req) {
    return req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  }
  try {
    const headerStore = await headers();
    return headerStore.get('x-forwarded-host') ?? headerStore.get('host');
  } catch {
    return null;
  }
}

function isLoopbackHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const normalized = host.trim().toLowerCase().split(':')[0] ?? '';
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1';
}

async function hasLocalAdminBypassCookie(req?: NextRequest): Promise<boolean> {
  if (req) {
    return req.cookies.get(LOCAL_ADMIN_BYPASS_COOKIE)?.value === '1';
  }
  try {
    const cookieStore = await cookies();
    return cookieStore.get(LOCAL_ADMIN_BYPASS_COOKIE)?.value === '1';
  } catch {
    return false;
  }
}

export async function isLocalAdminBypassEnabled(req?: NextRequest): Promise<boolean> {
  if ((process.env.LOCAL_ADMIN_BYPASS ?? '').trim() !== '1') return false;
  if (!(await hasLocalAdminBypassCookie(req))) return false;

  const host = await resolveRequestHost(req);
  return host ? isLoopbackHost(host) : true;
}

export async function resolveConfiguredLocalAdminUserId(): Promise<string | null> {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  const explicitUserId = process.env.LOCAL_ADMIN_BYPASS_USER_ID?.trim();
  if (explicitUserId) {
    return (await isUserAdmin(explicitUserId)) ? explicitUserId : null;
  }

  try {
    const roleRows = await query<{ user_id: string }>(
      `SELECT user_id FROM user_roles WHERE role = 'admin' ORDER BY user_id ASC LIMIT 1`
    );
    if (roleRows[0]?.user_id) {
      return roleRows[0].user_id;
    }
  } catch (error) {
    console.warn('[admin] failed to resolve local bypass admin from user_roles', error);
  }

  try {
    const legacyRows = await query<{ user_id: string }>(
      `SELECT user_id FROM app_admins ORDER BY user_id ASC LIMIT 1`
    );
    return legacyRows[0]?.user_id ?? null;
  } catch (error) {
    console.warn('[admin] failed to resolve local bypass admin from app_admins', error);
    return null;
  }
}

export async function resolveLocalAdminBypassUserId(req?: NextRequest): Promise<string | null> {
  if (!(await isLocalAdminBypassEnabled(req))) {
    return null;
  }
  return resolveConfiguredLocalAdminUserId();
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
  if (userId) {
    const ok = await isUserAdmin(userId);
    if (ok) {
      return userId;
    }
  }

  const localBypassUserId = await resolveLocalAdminBypassUserId(req);
  if (localBypassUserId) {
    return localBypassUserId;
  }

  if (!userId) {
    throw new AdminAuthError('Unauthorized', 401);
  }
  throw new AdminAuthError('Forbidden', 403);
}

export async function getUserIdFromCookies(): Promise<string | null> {
  try {
    const supabase = await createSupabaseServerClient();
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
