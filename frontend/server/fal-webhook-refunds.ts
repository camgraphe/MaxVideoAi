import { query } from '@/lib/db';
import {
  buildUserFacingRefundDescription,
  toUserFacingFailureMessage,
} from '@/server/user-facing-failure-messages';

function coerceNumber(value: number | string | null | undefined): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function normalizeCurrency(value: string | null | undefined): string {
  return (value ?? 'USD').toUpperCase();
}

export async function maybeAutoRefundWalletCharge(
  jobId: string,
  context: {
    engineLabel?: string | null;
    providerJobId?: string | null;
    failureMessage?: string | null;
    failureOrigin?: string | null;
  }
): Promise<boolean> {
  const jobInfoRows = await query<{
    payment_status: string | null;
    pricing_snapshot: unknown;
    vendor_account_id: string | null;
    currency: string | null;
    final_price_cents: number | string | null;
    user_id: string | null;
    engine_id: string | null;
    engine_label: string | null;
    duration_sec: number | string | null;
  }>(
    `SELECT payment_status, pricing_snapshot, vendor_account_id, currency, final_price_cents, user_id, engine_id, engine_label, duration_sec
     FROM app_jobs
     WHERE job_id = $1
     LIMIT 1`,
    [jobId]
  );
  const jobInfo = jobInfoRows.at(0);
  if (!jobInfo || jobInfo.payment_status !== 'paid_wallet') {
    return false;
  }

  const existingRefundRows = await query<{ id: number }>(
    `SELECT id FROM app_receipts WHERE job_id = $1 AND type = 'refund' LIMIT 1`,
    [jobId]
  );
  if (existingRefundRows.length) {
    return false;
  }

  const chargeRows = await query<{
    id: number;
    amount_cents: number | string | null;
    currency: string | null;
    description: string | null;
    user_id: string | null;
    vendor_account_id: string | null;
  }>(
    `SELECT id, amount_cents, currency, description, user_id, vendor_account_id
     FROM app_receipts
     WHERE job_id = $1
       AND type = 'charge'
     ORDER BY created_at DESC
     LIMIT 1`,
    [jobId]
  );

  const charge = chargeRows.at(0);
  if (!charge) {
    return false;
  }

  const amountCents = coerceNumber(charge.amount_cents ?? jobInfo.final_price_cents ?? 0);
  if (!amountCents) {
    return false;
  }

  const currency = normalizeCurrency(charge.currency ?? jobInfo.currency ?? 'USD');
  const userFailureMessage = toUserFacingFailureMessage(context.failureMessage);
  const description = buildUserFacingRefundDescription({
    engineLabel: context.engineLabel ?? jobInfo.engine_label ?? jobInfo.engine_id ?? null,
    durationSec: jobInfo.duration_sec,
    reason: context.failureMessage,
  });
  const pricingSnapshotJson =
    jobInfo.pricing_snapshot != null ? JSON.stringify(jobInfo.pricing_snapshot) : null;
  const vendorAccount = charge.vendor_account_id ?? jobInfo.vendor_account_id ?? null;
  const refundMetadata = {
    reason: 'auto_render_failure_refund',
    provider_job_id: context.providerJobId ?? null,
    failure_origin: context.failureOrigin ?? null,
    note: userFailureMessage,
  };

  let refundId: number | null = null;
  try {
    const inserted = await query<{ id: number }>(
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
         platform_revenue_cents,
         destination_acct,
         metadata
       )
       VALUES ($1,'refund',$2,$3,$4,$5,$6::jsonb,0,$7,NULL,NULL,0,$8,$9::jsonb)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [
        charge.user_id ?? jobInfo.user_id,
        amountCents,
        currency,
        description,
        jobId,
        pricingSnapshotJson,
        vendorAccount,
        vendorAccount,
        JSON.stringify(refundMetadata),
      ]
    );
    refundId = inserted.at(0)?.id ?? null;
  } catch (error) {
    console.warn('[fal-webhook] auto-refund insert failed', { jobId }, error);
    return false;
  }

  try {
    await query(
      `UPDATE app_jobs
       SET payment_status = 'refunded_wallet',
           message = COALESCE(message, $2),
           updated_at = NOW()
      WHERE job_id = $1
         AND payment_status = 'paid_wallet'`,
      [jobId, userFailureMessage]
    );
  } catch (error) {
    console.warn('[fal-webhook] auto-refund job update failed', { jobId }, error);
  }

  console.info('[fal-webhook] auto-refund wallet charge', {
    jobId,
    refundId,
    amountCents,
    currency,
    providerJobId: context.providerJobId ?? null,
  });

  return true;
}
