import type { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/user';

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
