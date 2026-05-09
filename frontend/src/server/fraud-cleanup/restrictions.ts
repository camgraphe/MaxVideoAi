import { query } from '@/lib/db';
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

export function buildRestrictedAccountPayload() {
  return {
    ok: false,
    error: 'account_restricted',
    message: RESTRICTED_ACCOUNT_MESSAGE,
  };
}
