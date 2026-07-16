import { query, type QueryExecutor } from '@/lib/db';
import { RESTRICTED_ACCOUNT_MESSAGE } from './constants';

export async function getActiveAccountRestriction(userId: string): Promise<{
  userId: string;
  reason: string;
  message: string;
  restrictedAt: string;
} | null> {
  if (!process.env.DATABASE_URL || !userId) return null;

  try {
    const rows = await query<{
      user_id: string;
      reason: string;
      message: string | null;
      restricted_at: string;
    }>(
      `
        SELECT user_id, reason, message, restricted_at
        FROM user_account_restrictions
        WHERE user_id = $1
          AND active IS TRUE
        LIMIT 1
      `,
      [userId]
    );
    const row = rows[0];
    if (!row) return null;
    return {
      userId: row.user_id,
      reason: row.reason,
      message: row.message ?? RESTRICTED_ACCOUNT_MESSAGE,
      restrictedAt: row.restricted_at,
    };
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? (error as { code?: string }).code : undefined;
    if (code !== '42P01') {
      console.warn('[fraud-cleanup] failed to check account restriction', error);
    }
    return null;
  }
}

export async function getActiveAccountRestrictionInExecutor(
  userId: string,
  executor: QueryExecutor,
): Promise<{
  userId: string;
  reason: string;
  message: string;
  restrictedAt: string;
} | null> {
  if (!userId || userId !== userId.trim()) {
    throw new Error('Invalid restricted account lookup.');
  }
  await executor.query('LOCK TABLE user_account_restrictions IN SHARE MODE');
  const rows = await executor.query<{
    user_id: string;
    reason: string;
    message: string | null;
    restricted_at: string;
  }>(
    `SELECT user_id, reason, message, restricted_at
       FROM user_account_restrictions
      WHERE user_id = $1
        AND active IS TRUE
      LIMIT 1`,
    [userId],
  );
  const row = rows[0];
  if (!row) return null;
  if (row.user_id !== userId || typeof row.reason !== 'string' || typeof row.restricted_at !== 'string') {
    throw new Error('Invalid restricted account result.');
  }
  return {
    userId: row.user_id,
    reason: row.reason,
    message: row.message ?? RESTRICTED_ACCOUNT_MESSAGE,
    restrictedAt: row.restricted_at,
  };
}

export function buildRestrictedAccountPayload() {
  return {
    ok: false,
    error: 'account_restricted',
    message: RESTRICTED_ACCOUNT_MESSAGE,
  };
}
