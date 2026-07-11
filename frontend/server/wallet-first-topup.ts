import type { QueryExecutor } from '@/lib/db';

export async function lockAndResolveFirstWalletTopup(
  executor: QueryExecutor,
  userId: string
): Promise<boolean> {
  await executor.query(
    `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
    [`wallet-topup:${userId}`]
  );
  const rows = await executor.query<{ has_topup: boolean }>(
    `SELECT EXISTS (
       SELECT 1
         FROM app_receipts
        WHERE user_id = $1
          AND type = 'topup'
          AND amount_cents > 0
     ) AS has_topup`,
    [userId]
  );
  return !Boolean(rows[0]?.has_topup);
}
