import Stripe from 'stripe';
import { ensureBillingSchema } from '@/lib/schema';
import { query, withDbTransaction, type QueryExecutor } from '@/lib/db';
import { getUserIdentity } from '@/server/supabase-admin';

export const RESTRICTED_ACCOUNT_MESSAGE =
  'Your account is temporarily restricted for security reasons. Please contact support.';

const CREDIT_REVERSAL_DESCRIPTION = 'Credit reversal: refunded suspected fraudulent payment';
const FRAUD_REVERSAL_REASON = 'fraud_credit_reversal';
const DEFAULT_REPEATED_SMALL_TOPUP_THRESHOLD = 3;
const DEFAULT_SMALL_TOPUP_MAX_CENTS = 1500;

export type StripeFraudStatus = {
  refunded: boolean;
  fraudMarked: boolean;
  refundedAmountCents: number;
  reasons: string[];
};

export type FraudTopupCandidate = {
  receiptId: number;
  userId: string;
  email: string | null;
  amountCents: number;
  currency: string;
  createdAt: string;
  stripePaymentIntentId: string | null;
  stripeChargeId: string | null;
  stripeCheckoutSessionId: string | null;
  currentBalanceCents: number;
  alreadyReversedCents: number;
  completedGenerations: number;
  topupsInWindow: number;
  failedOrBlockedAttemptsInWindow: number;
  accountAlreadyRestricted?: boolean;
  stripeStatus: StripeFraudStatus;
};

export type FraudCleanupPlanItem = {
  receiptId: number;
  userId: string;
  email: string | null;
  stripePaymentIntentId: string | null;
  stripeChargeId: string | null;
  stripeCheckoutSessionId: string | null;
  amountCents: number;
  currency: string;
  previousBalanceCents: number;
  newBalanceCents: number;
  reversalAmountCents: number;
  unreversedRemainderCents: number;
  restrictAccount: boolean;
  restrictionReason: string | null;
  stripeStatus: StripeFraudStatus;
};

export type FraudCleanupPlan = {
  dryRun: boolean;
  items: FraudCleanupPlanItem[];
  summary: {
    scannedPayments: number;
    matchedPayments: number;
    creditsToReverse: number;
    accountsToRestrict: number;
    totalReversalCents: number;
  };
};

type RawTopupRow = {
  receipt_id: number | string;
  user_id: string;
  amount_cents: number | string | null;
  currency: string | null;
  created_at: string;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  stripe_checkout_session_id: string | null;
  stripe_customer_id: string | null;
};

type RunFraudCleanupParams = {
  stripe: Stripe;
  adminUserId: string;
  adminEmail?: string | null;
  dryRun?: boolean;
  since?: Date;
  until?: Date;
  limit?: number;
  maxTopupAmountCents?: number | null;
  paymentIntentIds?: string[];
  chargeIds?: string[];
  checkoutSessionIds?: string[];
  includeStripeAttemptCounts?: boolean;
};

function coerceNumber(value: number | string | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function normalizeCurrency(value: string | null | undefined): string {
  return (value ?? 'USD').trim().toUpperCase() || 'USD';
}

function normalizeIdList(values: string[] | undefined): string[] {
  return Array.from(
    new Set((values ?? []).map((value) => value.trim()).filter((value) => value.length > 0))
  );
}

function isFraudMatched(status: StripeFraudStatus): boolean {
  return status.refunded || status.fraudMarked;
}

function resolveRestrictionReason(
  candidate: FraudTopupCandidate,
  matchedPaymentsForUser: number,
  repeatedSmallTopupThreshold: number
): string | null {
  if (candidate.accountAlreadyRestricted) return null;
  if (candidate.stripeStatus.fraudMarked) return 'fraud_marked_payment';
  if (candidate.completedGenerations > 0) return null;
  if (candidate.failedOrBlockedAttemptsInWindow >= 2) return 'multiple_failed_blocked_attempts';
  if (candidate.topupsInWindow >= repeatedSmallTopupThreshold) return 'repeated_refunded_small_topups';
  if (matchedPaymentsForUser >= 2) return 'repeated_refunded_payments';
  return null;
}

export function planFraudTopupActions({
  candidates,
  dryRun = true,
  repeatedSmallTopupThreshold = DEFAULT_REPEATED_SMALL_TOPUP_THRESHOLD,
}: {
  candidates: FraudTopupCandidate[];
  dryRun?: boolean;
  repeatedSmallTopupThreshold?: number;
}): FraudCleanupPlan {
  const matched = candidates.filter((candidate) => isFraudMatched(candidate.stripeStatus));
  const matchedCountByUser = new Map<string, number>();
  for (const candidate of matched) {
    matchedCountByUser.set(candidate.userId, (matchedCountByUser.get(candidate.userId) ?? 0) + 1);
  }

  const availableBalanceByUserCurrency = new Map<string, number>();
  const restrictedUsers = new Set<string>();
  const items: FraudCleanupPlanItem[] = [];

  for (const candidate of matched) {
    const balanceKey = `${candidate.userId}:${candidate.currency}`;
    if (!availableBalanceByUserCurrency.has(balanceKey)) {
      availableBalanceByUserCurrency.set(balanceKey, Math.max(0, candidate.currentBalanceCents));
    }
    const previousBalanceCents = availableBalanceByUserCurrency.get(balanceKey) ?? 0;
    const refundedBasisCents = candidate.stripeStatus.fraudMarked
      ? candidate.amountCents
      : candidate.stripeStatus.refundedAmountCents > 0
      ? Math.min(candidate.amountCents, candidate.stripeStatus.refundedAmountCents)
      : candidate.amountCents;
    const outstandingPaymentCredits = Math.max(0, refundedBasisCents - candidate.alreadyReversedCents);
    const reversalAmountCents = Math.min(previousBalanceCents, outstandingPaymentCredits);
    const newBalanceCents = Math.max(0, previousBalanceCents - reversalAmountCents);
    availableBalanceByUserCurrency.set(balanceKey, newBalanceCents);

    const restrictionReason = restrictedUsers.has(candidate.userId)
      ? null
      : resolveRestrictionReason(
          candidate,
          matchedCountByUser.get(candidate.userId) ?? 0,
          repeatedSmallTopupThreshold
        );
    const restrictAccount = Boolean(restrictionReason);
    if (restrictAccount) {
      restrictedUsers.add(candidate.userId);
    }

    items.push({
      receiptId: candidate.receiptId,
      userId: candidate.userId,
      email: candidate.email,
      stripePaymentIntentId: candidate.stripePaymentIntentId,
      stripeChargeId: candidate.stripeChargeId,
      stripeCheckoutSessionId: candidate.stripeCheckoutSessionId,
      amountCents: candidate.amountCents,
      currency: candidate.currency,
      previousBalanceCents,
      newBalanceCents,
      reversalAmountCents,
      unreversedRemainderCents: Math.max(0, outstandingPaymentCredits - reversalAmountCents),
      restrictAccount,
      restrictionReason,
      stripeStatus: candidate.stripeStatus,
    });
  }

  return {
    dryRun,
    items,
    summary: {
      scannedPayments: candidates.length,
      matchedPayments: items.length,
      creditsToReverse: items.filter((item) => item.reversalAmountCents > 0).length,
      accountsToRestrict: items.filter((item) => item.restrictAccount).length,
      totalReversalCents: items.reduce((sum, item) => sum + item.reversalAmountCents, 0),
    },
  };
}

export async function ensureFraudCleanupSchema(): Promise<void> {
  await ensureBillingSchema();

  await query(`
    CREATE TABLE IF NOT EXISTS user_account_restrictions (
      user_id TEXT PRIMARY KEY,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      reason TEXT NOT NULL,
      message TEXT NOT NULL DEFAULT '${RESTRICTED_ACCOUNT_MESSAGE.replace(/'/g, "''")}',
      restricted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      restricted_by TEXT,
      lifted_at TIMESTAMPTZ,
      lifted_by TEXT,
      metadata JSONB
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS user_account_restrictions_active_idx
    ON user_account_restrictions (active, restricted_at DESC);
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS wallet_fraud_cleanup_audit (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      email TEXT,
      stripe_payment_intent_id TEXT,
      stripe_checkout_session_id TEXT,
      stripe_charge_id TEXT,
      amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
      currency TEXT NOT NULL DEFAULT 'USD',
      previous_balance_cents INTEGER NOT NULL CHECK (previous_balance_cents >= 0),
      new_balance_cents INTEGER NOT NULL CHECK (new_balance_cents >= 0),
      action_taken TEXT NOT NULL CHECK (action_taken IN ('credits_reversed','account_restricted')),
      admin_user_id TEXT,
      metadata JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS wallet_fraud_cleanup_audit_user_created_idx
    ON wallet_fraud_cleanup_audit (user_id, created_at DESC);
  `);

  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS app_receipts_fraud_reversal_original_topup_unique
    ON app_receipts ((metadata ->> 'original_topup_receipt_id'))
    WHERE type = 'charge'
      AND metadata ->> 'reason' = '${FRAUD_REVERSAL_REASON}';
  `);
}

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

async function fetchUserStats(userIds: string[], since: Date | undefined, smallTopupMaxCents: number) {
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

function hasFraudDetails(charge: Stripe.Charge): boolean {
  const details = charge.fraud_details as Record<string, unknown> | null | undefined;
  if (!details) return false;
  return Boolean(details.user_report || details.stripe_report);
}

function statusFromCharge(charge: Stripe.Charge): StripeFraudStatus {
  const reasons = new Set<string>();
  const amountRefunded = Math.max(0, coerceNumber(charge.amount_refunded));
  if (charge.refunded || amountRefunded > 0) reasons.add('charge_refunded');
  if (charge.disputed) reasons.add('charge_disputed');
  if (hasFraudDetails(charge)) reasons.add('radar_fraud_details');

  const outcome = charge.outcome as Stripe.Charge.Outcome | null | undefined;
  if (outcome?.risk_level === 'highest') {
    reasons.add('stripe_highest_risk');
  }

  const refunds = (charge.refunds?.data ?? []) as Stripe.Refund[];
  if (refunds.some((refund) => refund.reason === 'fraudulent')) {
    reasons.add('refund_reason_fraudulent');
  }

  const fraudMarked = Array.from(reasons).some((reason) =>
    ['charge_disputed', 'radar_fraud_details', 'stripe_highest_risk', 'refund_reason_fraudulent'].includes(reason)
  );

  return {
    refunded: charge.refunded || amountRefunded > 0,
    fraudMarked,
    refundedAmountCents: amountRefunded,
    reasons: Array.from(reasons),
  };
}

async function resolveStripeStatus(
  stripe: Stripe,
  refs: {
    paymentIntentId?: string | null;
    chargeId?: string | null;
    checkoutSessionId?: string | null;
  }
): Promise<StripeFraudStatus> {
  let chargeId = refs.chargeId ?? null;

  if (!chargeId && refs.checkoutSessionId) {
    try {
      const session = await stripe.checkout.sessions.retrieve(refs.checkoutSessionId, {
        expand: ['payment_intent', 'payment_intent.latest_charge'],
      } as Stripe.Checkout.SessionRetrieveParams);
      const intent = session.payment_intent;
      if (typeof intent === 'object' && intent && 'latest_charge' in intent) {
        const latestCharge = intent.latest_charge;
        if (typeof latestCharge === 'string') chargeId = latestCharge;
        else if (latestCharge?.id) return statusFromCharge(latestCharge as Stripe.Charge);
      }
    } catch (error) {
      return { refunded: false, fraudMarked: false, refundedAmountCents: 0, reasons: [`stripe_session_lookup_failed:${error instanceof Error ? error.message : 'unknown'}`] };
    }
  }

  if (!chargeId && refs.paymentIntentId) {
    try {
      const intent = await stripe.paymentIntents.retrieve(refs.paymentIntentId, {
        expand: ['latest_charge', 'latest_charge.refunds'],
      } as Stripe.PaymentIntentRetrieveParams);
      const latestCharge = intent.latest_charge;
      if (typeof latestCharge === 'string') chargeId = latestCharge;
      else if (latestCharge?.id) return statusFromCharge(latestCharge as Stripe.Charge);
    } catch (error) {
      return { refunded: false, fraudMarked: false, refundedAmountCents: 0, reasons: [`stripe_intent_lookup_failed:${error instanceof Error ? error.message : 'unknown'}`] };
    }
  }

  if (!chargeId) {
    return { refunded: false, fraudMarked: false, refundedAmountCents: 0, reasons: ['missing_charge_reference'] };
  }

  try {
    const charge = await stripe.charges.retrieve(chargeId, {
      expand: ['refunds', 'dispute'],
    } as Stripe.ChargeRetrieveParams);
    return statusFromCharge(charge);
  } catch (error) {
    return { refunded: false, fraudMarked: false, refundedAmountCents: 0, reasons: [`stripe_charge_lookup_failed:${error instanceof Error ? error.message : 'unknown'}`] };
  }
}

async function countFailedOrBlockedTopupAttempts(
  stripe: Stripe,
  userId: string,
  since: Date | undefined
): Promise<number> {
  const search = stripe.paymentIntents.search?.bind(stripe.paymentIntents);
  if (!search || !since) return 0;

  const escapedUserId = userId.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const created = Math.floor(since.getTime() / 1000);

  try {
    const result = await search({
      query: `metadata['user_id']:'${escapedUserId}' AND metadata['kind']:'topup' AND created>${created}`,
      limit: 100,
    });

    return result.data.filter((intent) =>
      ['canceled', 'requires_payment_method'].includes(intent.status)
    ).length;
  } catch (error) {
    console.warn('[fraud-cleanup] failed to count Stripe failed attempts', {
      userId,
      error: error instanceof Error ? error.message : error,
    });
    return 0;
  }
}

async function buildCandidates(params: RunFraudCleanupParams): Promise<FraudTopupCandidate[]> {
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

async function insertFraudAudit(
  executor: QueryExecutor,
  item: FraudCleanupPlanItem,
  actionTaken: 'credits_reversed' | 'account_restricted',
  adminUserId: string,
  metadata: Record<string, unknown>
): Promise<void> {
  await executor.query(
    `
      INSERT INTO wallet_fraud_cleanup_audit (
        user_id,
        email,
        stripe_payment_intent_id,
        stripe_checkout_session_id,
        stripe_charge_id,
        amount_cents,
        currency,
        previous_balance_cents,
        new_balance_cents,
        action_taken,
        admin_user_id,
        metadata
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)
    `,
    [
      item.userId,
      item.email,
      item.stripePaymentIntentId,
      item.stripeCheckoutSessionId,
      item.stripeChargeId,
      item.amountCents,
      item.currency,
      item.previousBalanceCents,
      item.newBalanceCents,
      actionTaken,
      adminUserId,
      JSON.stringify(metadata),
    ]
  );
}

async function applyFraudCleanupPlan(
  plan: FraudCleanupPlan,
  params: Pick<RunFraudCleanupParams, 'adminUserId' | 'adminEmail'>
): Promise<void> {
  await withDbTransaction(async (executor) => {
    for (const item of plan.items) {
      const metadata = {
        reason: FRAUD_REVERSAL_REASON,
        original_topup_receipt_id: String(item.receiptId),
        stripe_payment_intent_id: item.stripePaymentIntentId,
        stripe_charge_id: item.stripeChargeId,
        stripe_checkout_session_id: item.stripeCheckoutSessionId,
        admin_user_id: params.adminUserId,
        admin_email: params.adminEmail ?? null,
        previous_balance_cents: item.previousBalanceCents,
        new_balance_cents: item.newBalanceCents,
        stripe_status: item.stripeStatus,
      };

      if (item.reversalAmountCents > 0) {
        const insertedReversal = await executor.query<{ id: number }>(
          `
            WITH updated AS (
              UPDATE app_receipts
              SET amount_cents = amount_cents + $2,
                  metadata = COALESCE(metadata, '{}'::jsonb) || $5::jsonb
              WHERE type = 'charge'
                AND metadata ->> 'reason' = $6
                AND metadata ->> 'original_topup_receipt_id' = $7
              RETURNING id
            ),
            inserted AS (
              INSERT INTO app_receipts (
                user_id,
                type,
                amount_cents,
                currency,
                description,
                metadata
              )
              SELECT $1, 'charge', $2, $3, $4, $5::jsonb
              WHERE NOT EXISTS (SELECT 1 FROM updated)
              ON CONFLICT DO NOTHING
              RETURNING id
            )
            SELECT id FROM updated
            UNION ALL
            SELECT id FROM inserted
          `,
          [
            item.userId,
            item.reversalAmountCents,
            item.currency,
            CREDIT_REVERSAL_DESCRIPTION,
            JSON.stringify(metadata),
            FRAUD_REVERSAL_REASON,
            String(item.receiptId),
          ]
        );

        if (insertedReversal.length) {
          await insertFraudAudit(executor, item, 'credits_reversed', params.adminUserId, {
            ...metadata,
            reversal_amount_cents: item.reversalAmountCents,
            unreversed_remainder_cents: item.unreversedRemainderCents,
          });
        }
      }

      if (item.restrictAccount) {
        const restrictionMetadata = {
          source: 'stripe_fraud_wallet_cleanup',
          restriction_reason: item.restrictionReason,
          original_topup_receipt_id: String(item.receiptId),
          stripe_payment_intent_id: item.stripePaymentIntentId,
          stripe_charge_id: item.stripeChargeId,
          stripe_checkout_session_id: item.stripeCheckoutSessionId,
          stripe_status: item.stripeStatus,
        };

        await executor.query(
          `
            INSERT INTO user_account_restrictions (
              user_id,
              active,
              reason,
              message,
              restricted_by,
              metadata
            )
            VALUES ($1, TRUE, $2, $3, $4, $5::jsonb)
            ON CONFLICT (user_id)
            DO UPDATE SET
              active = TRUE,
              reason = EXCLUDED.reason,
              message = EXCLUDED.message,
              restricted_by = EXCLUDED.restricted_by,
              restricted_at = NOW(),
              lifted_at = NULL,
              lifted_by = NULL,
              metadata = COALESCE(user_account_restrictions.metadata, '{}'::jsonb) || EXCLUDED.metadata
          `,
          [
            item.userId,
            item.restrictionReason ?? 'suspected_fraud',
            RESTRICTED_ACCOUNT_MESSAGE,
            params.adminUserId,
            JSON.stringify(restrictionMetadata),
          ]
        );

        await insertFraudAudit(executor, item, 'account_restricted', params.adminUserId, restrictionMetadata);
      }
    }
  });
}

export async function runStripeFraudWalletCleanup(params: RunFraudCleanupParams): Promise<FraudCleanupPlan> {
  if (!process.env.DATABASE_URL) {
    throw new Error('Database unavailable');
  }

  await ensureFraudCleanupSchema();
  const candidates = await buildCandidates(params);
  const plan = planFraudTopupActions({
    candidates,
    dryRun: params.dryRun !== false,
  });

  if (params.dryRun === false) {
    await applyFraudCleanupPlan(plan, params);
    return { ...plan, dryRun: false };
  }

  return plan;
}
