import { AUDIO_SURFACE } from '@/lib/audio-generation';
import { withDbTransaction } from '@/lib/db';

export async function refundAudioCharge(params: {
  userId: string;
  jobId: string;
}): Promise<{ receiptId: string; created: boolean }> {
  return withDbTransaction(async executor => {
    const jobs = await executor.query<{
      user_id: string | null;
      surface: string | null;
      status: string;
      payment_status: string | null;
      final_price_cents: number | string | null;
      currency: string | null;
      billing_product_key: string | null;
      pricing_snapshot: unknown;
    }>(
      `SELECT user_id, surface, status, payment_status, final_price_cents,
              currency, billing_product_key, pricing_snapshot
         FROM app_jobs
        WHERE job_id = $1
        FOR UPDATE`,
      [params.jobId]
    );
    const job = jobs[0];
    if (!job || job.user_id !== params.userId || job.surface !== AUDIO_SURFACE) {
      throw new Error('Audio refund job ownership is inconsistent.');
    }
    if (job.status === 'completed') {
      throw new Error('A completed Audio job cannot be refunded.');
    }
    if (job.status !== 'failed' || !['paid_wallet', 'refunded_wallet'].includes(job.payment_status ?? '')) {
      throw new Error('Audio refund job state is inconsistent.');
    }

    const charges = await executor.query<{
      id: string;
      user_id: string;
      amount_cents: number | string;
      currency: string | null;
      surface: string | null;
      billing_product_key: string | null;
      pricing_snapshot: unknown;
    }>(
      `SELECT id, user_id, amount_cents, currency, surface,
              billing_product_key, pricing_snapshot
         FROM app_receipts
        WHERE job_id = $1
          AND type = 'charge'
        ORDER BY id DESC
        LIMIT 2
        FOR UPDATE`,
      [params.jobId]
    );
    if (charges.length !== 1) {
      throw new Error('Audio wallet charge is missing or inconsistent.');
    }
    const charge = charges[0]!;
    const chargeAmount = Number(charge.amount_cents);
    const jobAmount = Number(job.final_price_cents);
    const chargeCurrency = (charge.currency ?? '').toUpperCase();
    const jobCurrency = (job.currency ?? '').toUpperCase();
    if (
      charge.user_id !== params.userId
      || charge.surface !== AUDIO_SURFACE
      || !Number.isSafeInteger(chargeAmount)
      || chargeAmount <= 0
      || chargeAmount !== jobAmount
      || !chargeCurrency
      || chargeCurrency !== jobCurrency
      || charge.billing_product_key !== job.billing_product_key
      || JSON.stringify(charge.pricing_snapshot) !== JSON.stringify(job.pricing_snapshot)
    ) {
      throw new Error('Audio job and wallet charge are inconsistent.');
    }

    const inserted = await executor.query<{ id: string }>(
      `INSERT INTO app_receipts (
         user_id, type, amount_cents, currency, description, job_id, surface,
         billing_product_key, pricing_snapshot, application_fee_cents,
         vendor_account_id, stripe_payment_intent_id, stripe_charge_id,
         platform_revenue_cents, destination_acct, metadata
       )
       SELECT user_id, 'refund', amount_cents, currency,
              COALESCE(NULLIF(description, ''), 'Audio generation') || ' refund',
              job_id, surface, billing_product_key, pricing_snapshot, 0,
              vendor_account_id, NULL, NULL, 0, vendor_account_id,
              jsonb_build_object('reason', 'audio_generation_failure', 'original_receipt_id', id)
         FROM app_receipts
        WHERE id = $1
          AND type = 'charge'
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [charge.id]
    );

    const refunds = await executor.query<{
      id: string;
      user_id: string;
      amount_cents: number | string;
      currency: string | null;
      surface: string | null;
      billing_product_key: string | null;
      pricing_snapshot: unknown;
    }>(
      `SELECT id, user_id, amount_cents, currency, surface,
              billing_product_key, pricing_snapshot
         FROM app_receipts
        WHERE job_id = $1
          AND type = 'refund'
        LIMIT 2
        FOR UPDATE`,
      [params.jobId]
    );
    const refund = refunds[0];
    if (
      refunds.length !== 1
      || !refund
      || refund.user_id !== charge.user_id
      || Number(refund.amount_cents) !== chargeAmount
      || (refund.currency ?? '').toUpperCase() !== chargeCurrency
      || refund.surface !== charge.surface
      || refund.billing_product_key !== charge.billing_product_key
      || JSON.stringify(refund.pricing_snapshot) !== JSON.stringify(charge.pricing_snapshot)
    ) {
      throw new Error('Persisted Audio refund is missing or inconsistent.');
    }

    const updated = await executor.query<{ job_id: string }>(
      `UPDATE app_jobs
          SET payment_status = 'refunded_wallet',
              updated_at = NOW()
        WHERE job_id = $1
          AND user_id = $2
          AND surface = $3
          AND status = 'failed'
          AND payment_status IN ('paid_wallet', 'refunded_wallet')
      RETURNING job_id`,
      [params.jobId, params.userId, AUDIO_SURFACE]
    );
    if (!updated[0]) {
      throw new Error('Audio refund status transition is inconsistent.');
    }
    return { receiptId: refund.id, created: Boolean(inserted[0]) };
  });
}
