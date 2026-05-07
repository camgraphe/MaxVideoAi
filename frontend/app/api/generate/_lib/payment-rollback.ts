import Stripe from 'stripe';

import { query } from '@/lib/db';
import { ENV, receiptsPriceOnlyEnabled } from '@/lib/env';
import type { PendingReceipt } from './initial-video-job';

export async function recordRefundReceipt(
  receipt: PendingReceipt,
  description: string,
  stripeRefundId: string | null
): Promise<void> {
  const priceOnly = receiptsPriceOnlyEnabled();
  if (!receipt.jobId) return;
  try {
    const existing = await query<{ id: string }>(
      `SELECT id FROM app_receipts WHERE job_id = $1 AND type = 'refund' LIMIT 1`,
      [receipt.jobId]
    );
    if (existing.length) return;
  } catch (error) {
    console.warn('[receipts] failed to check existing refund', error);
    return;
  }

  try {
    await query(
      `INSERT INTO app_receipts (
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
         stripe_refund_id,
         platform_revenue_cents,
         destination_acct
       )
       VALUES (
         $1,'refund',$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12,$13
       )
       ON CONFLICT DO NOTHING`,
      [
        receipt.userId,
        receipt.amountCents,
        receipt.currency,
        description,
        receipt.jobId,
        JSON.stringify(receipt.snapshot),
        priceOnly ? null : 0,
        priceOnly ? null : receipt.vendorAccountId,
        receipt.stripePaymentIntentId ?? null,
        receipt.stripeChargeId ?? null,
        stripeRefundId ?? null,
        priceOnly ? null : 0,
        priceOnly ? null : receipt.vendorAccountId,
      ]
    );
  } catch (error) {
    console.warn('[receipts] failed to record refund', error);
  }
}

async function issueStripeRefund(receipt: PendingReceipt): Promise<string | null> {
  const refundReference = receipt.stripePaymentIntentId ?? receipt.stripeChargeId;
  if (!refundReference) return null;
  if (!ENV.STRIPE_SECRET_KEY) {
    console.warn('[stripe] unable to refund: STRIPE_SECRET_KEY missing');
    return null;
  }
  try {
    const stripe = new Stripe(ENV.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
    const params = receipt.stripePaymentIntentId
      ? { payment_intent: receipt.stripePaymentIntentId }
      : { charge: receipt.stripeChargeId! };
    const idempotencyKey = receipt.jobId ? `job-refund-${receipt.jobId}` : undefined;
    const refund = await stripe.refunds.create(
      params,
      idempotencyKey ? { idempotencyKey } : undefined
    );
    return refund?.id ?? null;
  } catch (error) {
    console.warn('[stripe] refund failed', error);
    return null;
  }
}

export async function rollbackPendingPayment(params: {
  pendingReceipt: PendingReceipt | null;
  walletChargeReserved: boolean;
  refundDescription: string;
}): Promise<void> {
  const { pendingReceipt, walletChargeReserved, refundDescription } = params;
  if (!pendingReceipt) return;
  try {
    if (walletChargeReserved) {
      await recordRefundReceipt(pendingReceipt, refundDescription, null);
      return;
    }
    const refundId = await issueStripeRefund(pendingReceipt);
    await recordRefundReceipt(pendingReceipt, refundDescription, refundId);
  } catch (error) {
    console.warn('[payments] failed to rollback pending payment', error);
  }
}
