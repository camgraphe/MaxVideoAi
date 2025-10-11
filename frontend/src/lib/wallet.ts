import { query } from '@/lib/db';

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
        ), 0) AS balance_cents
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
          $2,
          $3,
          $4,
          $5,
          $6::jsonb,
          $7,
          $8,
          $9,
          $10
        FROM balance
        WHERE balance.balance_cents >= $2
        RETURNING id
      )
      SELECT
        balance.balance_cents,
        balance.balance_cents - $2 AS remaining_cents,
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
}
