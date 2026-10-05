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

/** Call within the receipt transaction after lockAndResolveFirstWalletTopup. */
export async function resolveFirstExternalPaymentUnderWalletLock(
  executor: QueryExecutor,
  userId: string,
): Promise<boolean | null> {
  await executor.query('SAVEPOINT commercial_payment_measurement');
  try {
    const rows = await executor.query<{ has_external_payment: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM app_receipts
        WHERE user_id = $1 AND type IN ('topup', 'charge') AND amount_cents > 0
          AND (stripe_payment_intent_id IS NOT NULL
            OR stripe_charge_id IS NOT NULL OR stripe_checkout_session_id IS NOT NULL)
          AND COALESCE(metadata ->> 'stripe_livemode', '') <> 'false'
          AND COALESCE(metadata ->> 'reason', '') <> 'manual_admin_topup'
          AND COALESCE(metadata ->> 'ledger_only', '') <> 'true'
     ) AS has_external_payment`,
    [userId],
  );
    await executor.query('RELEASE SAVEPOINT commercial_payment_measurement');
    // Legacy external receipts have no trusted mode. Count them conservatively so
    // a returning payer is never advertised as new without a historical audit.
    return rows[0] ? !rows[0].has_external_payment : null;
  } catch {
    // Recover the transaction after an optional measurement query error; a bare
    // catch would leave PostgreSQL aborted and prevent the real wallet receipt.
    await executor.query('ROLLBACK TO SAVEPOINT commercial_payment_measurement');
    await executor.query('RELEASE SAVEPOINT commercial_payment_measurement');
    return null;
  }
}

export async function isCommercialPaymentAnalyticsEligible(
  executor: QueryExecutor,
  userId: string,
  stripeLiveMode: unknown,
): Promise<boolean> {
  if (stripeLiveMode !== true) return false;
  return isCommercialAccountAnalyticsEligible(executor, userId);
}

export async function isCommercialAccountAnalyticsEligible(executor: QueryExecutor, userId: string): Promise<boolean> {
  try {
    const tables = await executor.query<{ has_roles: boolean; has_legacy: boolean }>(
      `SELECT to_regclass('public.user_roles') IS NOT NULL AS has_roles,
              to_regclass('public.app_admins') IS NOT NULL AS has_legacy`,
    );
    if (!tables[0]?.has_roles && !tables[0]?.has_legacy) return false;
    const checks = [
      ...(tables[0].has_roles ? ["SELECT EXISTS (SELECT 1 FROM user_roles WHERE user_id::text = $1 AND role = 'admin') AS is_admin"] : []),
      ...(tables[0].has_legacy ? ['SELECT EXISTS (SELECT 1 FROM app_admins WHERE user_id::text = $1) AS is_admin'] : []),
    ];
    for (const sql of checks) {
      const rows = await executor.query<{ is_admin: boolean }>(sql, [userId]);
      if (!rows[0] || rows[0].is_admin) return false;
    }
    return true;
  } catch {
    // Measurement uncertainty suppresses commercial analytics, never fulfillment.
    return false;
  }
}
