import type { QueryExecutor } from '@/lib/db';

/** Null permits measurement; unavailable roles must remain retryable, never success. */
export async function checkOpenAIAccountEligibility(
  db: QueryExecutor,
  userId: string
): Promise<{ status: 'retry' | 'suppressed'; code: string } | null> {
  const [tables] = await db.query<{ roles: boolean; legacy: boolean }>(
    `SELECT to_regclass('public.user_roles') IS NOT NULL AS roles,to_regclass('public.app_admins') IS NOT NULL AS legacy`
  );
  if (!tables?.roles && !tables?.legacy) return { status: 'retry', code: 'role_unavailable' };
  for (const sql of [
    ...(tables.roles
      ? ["SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id::text=$1 AND role='admin') AS excluded"]
      : []),
    ...(tables.legacy ? ['SELECT EXISTS(SELECT 1 FROM app_admins WHERE user_id::text=$1) AS excluded'] : []),
  ]) {
    const [role] = await db.query<{ excluded: boolean }>(sql, [userId]);
    if (!role) return { status: 'retry', code: 'role_unavailable' };
    if (role.excluded) return { status: 'suppressed', code: 'admin' };
  }
  return null;
}
