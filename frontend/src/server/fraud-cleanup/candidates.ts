import { query } from '@/lib/db';
import { getUserIdentity } from '@/server/supabase-admin';
import { DEFAULT_SMALL_TOPUP_MAX_CENTS, FRAUD_REVERSAL_REASON } from './constants';
import { coerceNumber, normalizeCurrency, normalizeIdList } from './normalization';
import { countFailedOrBlockedTopupAttempts, resolveStripeStatus } from './stripe-status';
import type { FraudTopupCandidate, RawTopupRow, RunFraudCleanupParams } from './types';

type FraudUserStats = {
  balance: Map<string, number>;
  completed: Map<string, number>;
  topups: Map<string, number>;
  restrictions: Set<string>;
  reversals: Map<number, number>;
};

async function fetchEmailMap(userIds: string[]): Promise<Map<string, string | null>> {
  const uniqueUserIds = Array.from(new Set(userIds));
  const emails = new Map<string, string | null>();
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    uniqueUserIds.forEach((userId) => emails.set(userId, null));
    return emails;
  }

  await Promise.all(
    uniqueUserIds.map(async (userId) => {
      try {
        const identity = await getUserIdentity(userId);
        emails.set(userId, identity?.email ?? null);
      } catch {
        emails.set(userId, null);
      }
    })
  );
  return emails;
}

async function fetchTopupRows(params: RunFraudCleanupParams): Promise<RawTopupRow[]> {
  const values: unknown[] = [];
  const conditions = [`type = 'topup'`];
  const paymentIntentIds = normalizeIdList(params.paymentIntentIds);
  const chargeIds = normalizeIdList(params.chargeIds);
  const checkoutSessionIds = normalizeIdList(params.checkoutSessionIds);
  const hasExplicitIds = paymentIntentIds.length || chargeIds.length || checkoutSessionIds.length;

  if (paymentIntentIds.length) {
    values.push(paymentIntentIds);
    conditions.push(`stripe_payment_intent_id = ANY($${values.length}::text[])`);
  }
  if (chargeIds.length) {
    values.push(chargeIds);
    conditions.push(`stripe_charge_id = ANY($${values.length}::text[])`);
  }
  if (checkoutSessionIds.length) {
    values.push(checkoutSessionIds);
    conditions.push(`stripe_checkout_session_id = ANY($${values.length}::text[])`);
  }

  let idClause = '';
  if (hasExplicitIds) {
    idClause = `AND (${conditions.slice(1).join(' OR ')})`;
  }

  const windowConditions = [`type = 'topup'`];
  if (!hasExplicitIds) {
    if (params.since) {
      values.push(params.since);
      windowConditions.push(`created_at >= $${values.length}`);
    }
    if (params.until) {
      values.push(params.until);
      windowConditions.push(`created_at <= $${values.length}`);
    }
    if (params.maxTopupAmountCents != null) {
      values.push(Math.max(0, Math.round(params.maxTopupAmountCents)));
      windowConditions.push(`amount_cents <= $${values.length}`);
    }
  }

  values.push(Math.min(1000, Math.max(1, params.limit ?? 500)));
  const limitParam = `$${values.length}`;

  const whereClause = hasExplicitIds
    ? `type = 'topup' ${idClause}`
    : windowConditions.join(' AND ');

  return query<RawTopupRow>(
    `
      SELECT
        id AS receipt_id,
        user_id,
        amount_cents,
        currency,
        created_at,
        stripe_payment_intent_id,
        stripe_charge_id,
        stripe_checkout_session_id,
        stripe_customer_id
      FROM app_receipts
      WHERE ${whereClause}
        AND (
          stripe_payment_intent_id IS NOT NULL
          OR stripe_charge_id IS NOT NULL
          OR stripe_checkout_session_id IS NOT NULL
        )
      ORDER BY created_at DESC
      LIMIT ${limitParam}
    `,
    values
  );
}

async function fetchUserStats(
  userIds: string[],
  since: Date | undefined,
  smallTopupMaxCents: number
): Promise<FraudUserStats> {
  const uniqueUserIds = Array.from(new Set(userIds));
  if (!uniqueUserIds.length) {
    return {
      balance: new Map<string, number>(),
      completed: new Map<string, number>(),
      topups: new Map<string, number>(),
      restrictions: new Set<string>(),
      reversals: new Map<number, number>(),
    };
  }

  const [balanceRows, completedRows, topupRows, restrictionRows, reversalRows] = await Promise.all([
    query<{ user_id: string; currency: string | null; balance_cents: number | string | null }>(
      `
        SELECT
          user_id,
          UPPER(COALESCE(NULLIF(currency, ''), 'USD')) AS currency,
          COALESCE(SUM(
            CASE
              WHEN type = 'topup' THEN amount_cents
              WHEN type = 'refund' THEN amount_cents
              WHEN type = 'charge' THEN -amount_cents
              ELSE 0
            END
          ), 0)::bigint AS balance_cents
        FROM app_receipts
        WHERE user_id = ANY($1::text[])
        GROUP BY user_id, UPPER(COALESCE(NULLIF(currency, ''), 'USD'))
      `,
      [uniqueUserIds]
    ),
    query<{ user_id: string; completed_count: number | string | null }>(
      `
        SELECT user_id, COUNT(*)::bigint AS completed_count
        FROM app_jobs
        WHERE user_id = ANY($1::text[])
          AND status = 'completed'
        GROUP BY user_id
      `,
      [uniqueUserIds]
    ),
    query<{ user_id: string; topup_count: number | string | null }>(
      `
        SELECT user_id, COUNT(*)::bigint AS topup_count
        FROM app_receipts
        WHERE user_id = ANY($1::text[])
          AND type = 'topup'
          AND amount_cents <= $2
          ${since ? 'AND created_at >= $3' : ''}
        GROUP BY user_id
      `,
      since ? [uniqueUserIds, smallTopupMaxCents, since] : [uniqueUserIds, smallTopupMaxCents]
    ),
    query<{ user_id: string }>(
      `
        SELECT user_id
        FROM user_account_restrictions
        WHERE user_id = ANY($1::text[])
          AND active IS TRUE
      `,
      [uniqueUserIds]
    ).catch((error) => {
      const code = typeof error === 'object' && error && 'code' in error ? (error as { code?: string }).code : undefined;
      if (code === '42P01') return [] as { user_id: string }[];
      throw error;
    }),
    query<{ original_topup_receipt_id: string | null; reversed_cents: number | string | null }>(
      `
        SELECT
          metadata ->> 'original_topup_receipt_id' AS original_topup_receipt_id,
          COALESCE(SUM(amount_cents), 0)::bigint AS reversed_cents
        FROM app_receipts
        WHERE type = 'charge'
          AND metadata ->> 'reason' = $1
          AND metadata ->> 'original_topup_receipt_id' IS NOT NULL
        GROUP BY metadata ->> 'original_topup_receipt_id'
      `,
      [FRAUD_REVERSAL_REASON]
    ),
  ]);

  return {
    balance: new Map(balanceRows.map((row) => [`${row.user_id}:${normalizeCurrency(row.currency)}`, coerceNumber(row.balance_cents)])),
    completed: new Map(completedRows.map((row) => [row.user_id, coerceNumber(row.completed_count)])),
    topups: new Map(topupRows.map((row) => [row.user_id, coerceNumber(row.topup_count)])),
    restrictions: new Set(restrictionRows.map((row) => row.user_id)),
    reversals: new Map(
      reversalRows
        .filter((row) => row.original_topup_receipt_id)
        .map((row) => [Number(row.original_topup_receipt_id), coerceNumber(row.reversed_cents)])
    ),
  };
}

export async function buildCandidates(params: RunFraudCleanupParams): Promise<FraudTopupCandidate[]> {
  const topupRows = await fetchTopupRows(params);
  const userIds = topupRows.map((row) => row.user_id);
  const [emails, stats] = await Promise.all([
    fetchEmailMap(userIds),
    fetchUserStats(userIds, params.since, params.maxTopupAmountCents ?? DEFAULT_SMALL_TOPUP_MAX_CENTS),
  ]);

  const failedAttemptsByUser = new Map<string, number>();
  if (params.includeStripeAttemptCounts !== false) {
    await Promise.all(
      Array.from(new Set(userIds)).map(async (userId) => {
        failedAttemptsByUser.set(userId, await countFailedOrBlockedTopupAttempts(params.stripe, userId, params.since));
      })
    );
  }

  return Promise.all(
    topupRows.map(async (row) => {
      const receiptId = coerceNumber(row.receipt_id);
      const currency = normalizeCurrency(row.currency);
      const stripeStatus = await resolveStripeStatus(params.stripe, {
        paymentIntentId: row.stripe_payment_intent_id,
        chargeId: row.stripe_charge_id,
        checkoutSessionId: row.stripe_checkout_session_id,
      });

      return {
        receiptId,
        userId: row.user_id,
        email: emails.get(row.user_id) ?? null,
        amountCents: coerceNumber(row.amount_cents),
        currency,
        createdAt: row.created_at,
        stripePaymentIntentId: row.stripe_payment_intent_id,
        stripeChargeId: row.stripe_charge_id,
        stripeCheckoutSessionId: row.stripe_checkout_session_id,
        currentBalanceCents: Math.max(0, stats.balance.get(`${row.user_id}:${currency}`) ?? 0),
        alreadyReversedCents: stats.reversals.get(receiptId) ?? 0,
        completedGenerations: stats.completed.get(row.user_id) ?? 0,
        topupsInWindow: stats.topups.get(row.user_id) ?? 0,
        failedOrBlockedAttemptsInWindow: failedAttemptsByUser.get(row.user_id) ?? 0,
        accountAlreadyRestricted: stats.restrictions.has(row.user_id),
        stripeStatus,
      };
    })
  );
}
