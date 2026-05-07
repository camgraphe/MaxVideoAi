import { query } from '@/lib/db';
import type { PendingReceipt, PaymentMode } from './initial-video-job';

type QueryFn = (sql: string, params?: unknown[]) => Promise<unknown>;

export async function persistFinalChargeReceipt(params: {
  pendingReceipt: PendingReceipt | null;
  walletChargeReserved: boolean;
  queryFn?: QueryFn;
}): Promise<void> {
  if (!params.pendingReceipt || params.walletChargeReserved) {
    return;
  }

  const queryFn = params.queryFn ?? query;
  const receipt = params.pendingReceipt;
  try {
    await queryFn(
      `INSERT INTO app_receipts (user_id, type, amount_cents, currency, description, job_id, surface, billing_product_key, pricing_snapshot, application_fee_cents, vendor_account_id, stripe_payment_intent_id, stripe_charge_id, platform_revenue_cents, destination_acct)
       VALUES ($1,'charge',$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13,$14)`,
      [
        receipt.userId,
        receipt.amountCents,
        receipt.currency,
        receipt.description,
        receipt.jobId,
        'video',
        null,
        JSON.stringify(receipt.snapshot),
        receipt.applicationFeeCents ?? null,
        receipt.vendorAccountId,
        receipt.stripePaymentIntentId ?? null,
        receipt.stripeChargeId ?? null,
        receipt.applicationFeeCents ?? null,
        receipt.vendorAccountId,
      ]
    );
  } catch (error) {
    console.error('[api/generate] failed to persist payment receipt', error);
  }
}

export async function persistWalletFailureRefundReceipt(params: {
  status: string;
  pendingReceipt: PendingReceipt | null;
  paymentMode: PaymentMode;
  engineLabel: string;
  durationSec: number;
  priceOnlyReceipts: boolean;
  queryFn?: QueryFn;
}): Promise<void> {
  if (params.status !== 'failed' || !params.pendingReceipt || params.paymentMode !== 'wallet') {
    return;
  }

  const queryFn = params.queryFn ?? query;
  const receipt = params.pendingReceipt;
  try {
    await queryFn(
      `INSERT INTO app_receipts (user_id, type, amount_cents, currency, description, job_id, surface, billing_product_key, pricing_snapshot, application_fee_cents, vendor_account_id, stripe_payment_intent_id, stripe_charge_id, platform_revenue_cents, destination_acct)
       VALUES ($1,'refund',$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13,$14)
       ON CONFLICT DO NOTHING`,
      [
        receipt.userId,
        receipt.amountCents,
        receipt.currency,
        `Refund ${params.engineLabel} - ${params.durationSec}s`,
        receipt.jobId,
        'video',
        null,
        JSON.stringify(receipt.snapshot),
        params.priceOnlyReceipts ? null : 0,
        params.priceOnlyReceipts ? null : receipt.vendorAccountId,
        receipt.stripePaymentIntentId ?? null,
        receipt.stripeChargeId ?? null,
        params.priceOnlyReceipts ? null : 0,
        params.priceOnlyReceipts ? null : receipt.vendorAccountId,
      ]
    );
    await queryFn(`UPDATE app_jobs SET payment_status = 'refunded_wallet' WHERE job_id = $1`, [receipt.jobId]);
  } catch (error) {
    console.warn('[wallet] failed to record refund', error);
  }
}
