import { query } from '@/lib/db';
import { getUserIdentity } from '@/server/supabase-admin';

type AdminAuditParams = {
  adminId: string;
  targetUserId?: string | null;
  action: string;
  route?: string | null;
  metadata?: Record<string, unknown> | null;
};

export async function logAdminAction({ adminId, targetUserId, action, route, metadata }: AdminAuditParams): Promise<void> {
  if (!process.env.DATABASE_URL) {
    return;
  }

  try {
    await query(
      `
        INSERT INTO admin_audit (admin_id, target_user_id, action, route, metadata, created_at)
        VALUES ($1::uuid, $2::uuid, $3, $4, $5::jsonb, NOW())
      `,
      [adminId, targetUserId ?? null, action, route ?? null, metadata ? JSON.stringify(metadata) : null]
    );
  } catch (error) {
    console.warn('[admin_audit] failed to record action', action, error);
  }
}

export type AdminAuditLog = {
  id: number;
  adminId: string;
  adminEmail: string | null;
  targetUserId: string | null;
  targetEmail: string | null;
  action: string;
  route: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export async function fetchAdminAuditLogs(limit = 100): Promise<AdminAuditLog[]> {
  if (!process.env.DATABASE_URL) {
    return [];
  }

  const rows = await query<{
    id: number;
    admin_id: string;
    target_user_id: string | null;
    action: string;
    route: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
  }>(
    `
      SELECT id, admin_id, target_user_id, action, route, metadata, created_at
      FROM admin_audit
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [Math.min(500, Math.max(1, limit))]
  );

  const uniqueUserIds = Array.from(
    new Set(
      rows
        .flatMap((row) => [row.admin_id, row.target_user_id])
        .filter((value): value is string => Boolean(value && value.length))
    )
  );

  const identityMap = new Map<string, string | null>();
  if (uniqueUserIds.length && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    await Promise.all(
      uniqueUserIds.map(async (userId) => {
        try {
          const identity = await getUserIdentity(userId);
          identityMap.set(userId, identity?.email ?? null);
        } catch {
          identityMap.set(userId, null);
        }
      })
    );
  }

  return rows.map((row) => ({
    id: row.id,
    adminId: row.admin_id,
    adminEmail: identityMap.get(row.admin_id) ?? null,
    targetUserId: row.target_user_id,
    targetEmail: row.target_user_id ? identityMap.get(row.target_user_id) ?? null : null,
    action: row.action,
    route: row.route,
    metadata: row.metadata ?? null,
    createdAt: row.created_at,
  }));
}
