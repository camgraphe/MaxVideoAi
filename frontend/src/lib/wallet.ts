import { isDatabaseConfigured, query } from '@/lib/db';
import { receiptsPriceOnlyEnabled } from '@/lib/env';
import { getUserPreferredCurrency, normalizeCurrencyCode } from '@/lib/currency';
import type { Currency } from '@/lib/currency';

export type WalletBalanceByCurrency = {
  currency: Currency | null;
  balanceCents: number;
};

type MockWalletStore = Map<string, number>;
type MockReceiptStore = Set<string>;

function getMockWalletStore(): MockWalletStore {
  const globalAny = globalThis as typeof globalThis & {
    __MAXVIDEOAI_MOCK_WALLET__?: MockWalletStore;
    __MAXVIDEOAI_MOCK_WALLET_RECEIPTS__?: MockReceiptStore;
  };
  if (!globalAny.__MAXVIDEOAI_MOCK_WALLET__) {
    globalAny.__MAXVIDEOAI_MOCK_WALLET__ = new Map<string, number>();
  }
  return globalAny.__MAXVIDEOAI_MOCK_WALLET__;
}

function getMockReceiptStore(): MockReceiptStore {
  const globalAny = globalThis as typeof globalThis & {
    __MAXVIDEOAI_MOCK_WALLET__?: MockWalletStore;
    __MAXVIDEOAI_MOCK_WALLET_RECEIPTS__?: MockReceiptStore;
  };
  if (!globalAny.__MAXVIDEOAI_MOCK_WALLET_RECEIPTS__) {
    globalAny.__MAXVIDEOAI_MOCK_WALLET_RECEIPTS__ = new Set<string>();
  }
  return globalAny.__MAXVIDEOAI_MOCK_WALLET_RECEIPTS__;
}

export function getMockWalletBalance(userId: string): number {
  return getMockWalletStore().get(userId) ?? 0;
}

export function applyMockWalletTopUp(userId: string, amountCents: number): number {
  const normalizedAmount = Math.max(0, amountCents);
  if (normalizedAmount === 0) return getMockWalletBalance(userId);
  const store = getMockWalletStore();
  const current = store.get(userId) ?? 0;
  const next = Math.max(0, current + normalizedAmount);
  store.set(userId, next);
  return next;
}

function buildMockReceiptKey(paymentIntentId?: string | null, chargeId?: string | null): string | null {
  if (paymentIntentId) return `pi:${paymentIntentId}`;
  if (chargeId) return `ch:${chargeId}`;
  return null;
}

export function recordMockWalletTopUp(userId: string, amountCents: number, paymentIntentId?: string | null, chargeId?: string | null) {
  const key = buildMockReceiptKey(paymentIntentId, chargeId);
  const receiptStore = getMockReceiptStore();
  if (key && receiptStore.has(key)) {
    return { balanceCents: getMockWalletBalance(userId) };
  }
  const balanceCents = applyMockWalletTopUp(userId, amountCents);
  if (key) {
    receiptStore.add(key);
  }
  return { balanceCents };
}

function consumeMockWalletBalance(
  userId: string,
  amountCents: number
): { ok: boolean; balanceCents: number; remainingCents: number } {
  const store = getMockWalletStore();
  const current = store.get(userId) ?? 0;
  const normalizedAmount = Math.max(0, amountCents);
  if (current < normalizedAmount) {
    return { ok: false, balanceCents: current, remainingCents: current };
  }
  const remaining = current - normalizedAmount;
  store.set(userId, remaining);
  return { ok: true, balanceCents: current, remainingCents: remaining };
}

export async function getWalletBalancesByCurrency(userId: string): Promise<WalletBalanceByCurrency[]> {
  if (!isDatabaseConfigured()) return [];
  try {
    const rows = await query<{ currency: string | null; balance_cents: string | number | null }>(
      `
        SELECT
          CASE
            WHEN currency IS NULL OR TRIM(currency) = '' THEN NULL
            ELSE UPPER(currency)
          END AS currency,
          COALESCE(SUM(
            CASE
              WHEN type = 'topup' THEN amount_cents
              WHEN type = 'refund' THEN amount_cents
              WHEN type = 'charge' THEN -amount_cents
              ELSE 0
            END
          )::bigint, 0::bigint) AS balance_cents
        FROM app_receipts
        WHERE user_id = $1
        GROUP BY 1
      `,
      [userId]
    );

    return rows.map((row) => ({
      currency: normalizeCurrencyCode(row.currency) ?? null,
      balanceCents: Number(row.balance_cents ?? 0),
    }));
  } catch (error) {
    console.warn('[wallet] failed to load balances', error instanceof Error ? error.message : error);
    return [];
  }
}

type ReserveWalletChargeParams = {
  userId: string;
  amountCents: number;
  currency: string;
  description: string;
  jobId: string;
  pricingSnapshotJson: string;
  applicationFeeCents: number | null;
  vendorAccountId: string | null;
  stripePaymentIntentId?: string | null;
  stripeChargeId?: string | null;
};

type ReserveWalletChargeSuccess = {
  ok: true;
  receiptId: string;
  balanceCents: number;
  remainingCents: number;
};

type ReserveWalletChargeFailure = {
  ok: false;
  balanceCents: number;
  errorCode?: 'currency_mismatch';
  preferredCurrency?: Currency | null;
};

export type ReserveWalletChargeResult = ReserveWalletChargeSuccess | ReserveWalletChargeFailure;

export async function reserveWalletCharge(params: ReserveWalletChargeParams): Promise<ReserveWalletChargeResult> {
  const normalizedCurrencyLower = normalizeCurrencyCode(params.currency) ?? 'usd';
  const normalizedCurrencyUpper = normalizedCurrencyLower.toUpperCase();
  const fallbackToMock = () => {
    const result = consumeMockWalletBalance(params.userId, params.amountCents);
    if (!result.ok) {
      return { ok: false as const, balanceCents: result.balanceCents };
    }
    const success = {
      ok: true as const,
      receiptId: `mock-receipt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      balanceCents: result.balanceCents,
      remainingCents: result.remainingCents,
    };
    return success;
  };

  if (!isDatabaseConfigured()) {
    return fallbackToMock();
  }

  try {
    const preferredCurrency = await getUserPreferredCurrency(params.userId);
    if (preferredCurrency && preferredCurrency !== normalizedCurrencyLower && normalizedCurrencyLower !== 'usd') {
      return {
        ok: false,
        balanceCents: 0,
        errorCode: 'currency_mismatch',
        preferredCurrency,
      };
    }

    const priceOnly = receiptsPriceOnlyEnabled();
    const applicationFeeParam = priceOnly ? null : params.applicationFeeCents;
    const vendorAccountParam = priceOnly ? null : params.vendorAccountId;

    const rows = await query<{
      balance_cents: string | number | null;
      remaining_cents: string | number | null;
      receipt_id: string | null;
      has_mismatch: number | null;
    }>(
      `
        WITH receipts AS (
          SELECT
            type,
            amount_cents,
            CASE
              WHEN currency IS NULL OR TRIM(currency) = '' THEN NULL
              ELSE UPPER(currency)
            END AS currency
          FROM app_receipts
          WHERE user_id = $1
        ),
        balances AS (
          SELECT
            currency,
            COALESCE(SUM(
              CASE
                WHEN type = 'topup' THEN amount_cents
                WHEN type = 'refund' THEN amount_cents
                WHEN type = 'charge' THEN -amount_cents
                ELSE 0
              END
            )::bigint, 0::bigint) AS net_cents
          FROM receipts
          GROUP BY currency
        ),
        balance AS (
          SELECT
            COALESCE(SUM(
              CASE
                WHEN currency IS NULL OR currency = $3 THEN net_cents
                ELSE 0
              END
            ), 0::bigint) AS balance_cents,
            COALESCE(MAX(
              CASE
                WHEN currency IS NOT NULL AND currency <> $3 AND net_cents > 0 THEN 1
                ELSE 0
              END
            ), 0) AS has_mismatch
          FROM balances
        ),
        ins AS (
          INSERT INTO app_receipts (
            user_id,
            type,
            amount_cents,
            currency,
            description,
            job_id,
            pricing_snapshot,
            application_fee_cents,
            vendor_account_id,
            stripe_payment_intent_id,
            stripe_charge_id,
            platform_revenue_cents,
            destination_acct
          )
          SELECT
            $1,
            'charge',
            $2::bigint,
            $3,
            $4,
            $5,
            $6::jsonb,
            $7::integer,
            $8,
            $9,
            $10,
            $7::integer,
            $8
          FROM balance
          WHERE balance.balance_cents >= $2::bigint
            AND COALESCE(balance.has_mismatch, 0) = 0
          RETURNING id
        )
        SELECT
          balance.balance_cents,
          balance.balance_cents - $2::bigint AS remaining_cents,
          (SELECT id FROM ins) AS receipt_id,
          balance.has_mismatch
        FROM balance
      `,
      [
        params.userId,
        params.amountCents,
        normalizedCurrencyUpper,
        params.description,
        params.jobId,
        params.pricingSnapshotJson,
        applicationFeeParam,
        vendorAccountParam,
        params.stripePaymentIntentId ?? null,
        params.stripeChargeId ?? null,
      ]
    );

    const row = rows[0];
    if (!row) {
      throw new Error('reserveWalletCharge: balance query returned no rows');
    }

    const balanceCents = Number(row.balance_cents ?? 0);
    const remainingCents = Number(row.remaining_cents ?? 0);
    const receiptId = row.receipt_id;
    const hasMismatch = Number(row.has_mismatch ?? 0) > 0;

    if (hasMismatch) {
      const walletCurrency = preferredCurrency ?? (await fetchExistingWalletCurrency(params.userId));
      return {
        ok: false,
        balanceCents,
        errorCode: 'currency_mismatch',
        preferredCurrency: walletCurrency ?? null,
      };
    }

    if (!receiptId) {
      return { ok: false, balanceCents };
    }

    const outcome: ReserveWalletChargeSuccess = { ok: true, receiptId, balanceCents, remainingCents };
    return outcome;
  } catch (error) {
    console.warn('[wallet] reserve failed, using mock ledger', error);
    return fallbackToMock();
  }
}

async function fetchExistingWalletCurrency(userId: string): Promise<Currency | null> {
  const balances = await getWalletBalancesByCurrency(userId);
  const positive = balances.find((entry) => entry.currency && entry.balanceCents > 0);
  if (positive?.currency) {
    return positive.currency;
  }
  const firstCurrency = balances.find((entry) => entry.currency)?.currency ?? null;
  return firstCurrency;
}

export async function getWalletBalanceCents(userId: string): Promise<{ balanceCents: number; mock: boolean }> {
  if (!userId) return { balanceCents: 0, mock: true };
  if (!isDatabaseConfigured()) {
    return { balanceCents: getMockWalletBalance(userId), mock: true };
  }

  try {
    const rows = await query<{ type: string; amount_cents: number }>(
      `SELECT type, amount_cents FROM app_receipts WHERE user_id = $1`,
      [userId]
    );

    let topups = 0;
    let charges = 0;
    let refunds = 0;
    for (const row of rows) {
      if (row.type === 'topup') topups += row.amount_cents;
      if (row.type === 'charge') charges += row.amount_cents;
      if (row.type === 'refund') refunds += row.amount_cents;
    }
    const balanceCents = Math.max(0, topups + refunds - charges);
    return { balanceCents, mock: false };
  } catch (error) {
    console.warn('[wallet] failed to compute balance for admin view', error);
    return { balanceCents: getMockWalletBalance(userId), mock: true };
  }
}
