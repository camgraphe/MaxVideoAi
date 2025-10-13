import { query } from '@/lib/db';

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

type ReserveWalletChargeParams = {
  userId: string;
  amountCents: number;
  currency: string;
  description: string;
  jobId: string;
  pricingSnapshotJson: string;
  applicationFeeCents: number;
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
};

export type ReserveWalletChargeResult = ReserveWalletChargeSuccess | ReserveWalletChargeFailure;

export async function reserveWalletCharge(params: ReserveWalletChargeParams): Promise<ReserveWalletChargeResult> {
  const fallbackToMock = () => {
    const result = consumeMockWalletBalance(params.userId, params.amountCents);
    if (!result.ok) {
      return { ok: false as const, balanceCents: result.balanceCents };
    }
    return {
      ok: true as const,
      receiptId: `mock-receipt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      balanceCents: result.balanceCents,
      remainingCents: result.remainingCents,
    };
  };

  if (!process.env.DATABASE_URL) {
    return fallbackToMock();
  }

  try {
    const rows = await query<{
      balance_cents: string | number | null;
      remaining_cents: string | number | null;
      receipt_id: string | null;
    }>(
      `
        WITH balance AS (
          SELECT COALESCE(SUM(
            CASE
              WHEN type = 'topup' THEN amount_cents
              WHEN type = 'refund' THEN amount_cents
              WHEN type = 'charge' THEN -amount_cents
              ELSE 0
            END
          )::bigint, 0::bigint) AS balance_cents
          FROM app_receipts
          WHERE user_id = $1
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
            stripe_charge_id
          )
          SELECT
            $1,
            'charge',
            $2::bigint,
            $3,
            $4,
            $5,
            $6::jsonb,
            $7,
            $8,
            $9,
            $10
          FROM balance
          WHERE balance.balance_cents >= $2::bigint
          RETURNING id
        )
        SELECT
          balance.balance_cents,
          balance.balance_cents - $2::bigint AS remaining_cents,
          (SELECT id FROM ins) AS receipt_id
        FROM balance
      `,
      [
        params.userId,
        params.amountCents,
        params.currency,
        params.description,
        params.jobId,
        params.pricingSnapshotJson,
        params.applicationFeeCents,
        params.vendorAccountId,
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

    if (!receiptId) {
      return { ok: false, balanceCents };
    }

    return { ok: true, receiptId, balanceCents, remainingCents };
  } catch (error) {
    console.warn('[wallet] reserve failed, using mock ledger', error);
    return fallbackToMock();
  }
}
