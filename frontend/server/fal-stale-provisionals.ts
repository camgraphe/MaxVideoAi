import { query, withDbTransaction, type TransactionQueryExecutor } from '@/lib/db';
import { buildUserFacingRefundDescription } from '@/server/user-facing-failure-messages';

const STALE_PROVISIONAL_MESSAGE =
  'MaxVideoAI could not start this render. Please retry in a few moments.';

type StaleProvisionalJob = {
  job_id: string;
  user_id: string | null;
  engine_id: string;
  engine_label: string | null;
  duration_sec: number | string | null;
  payment_status: string | null;
  pricing_snapshot: unknown;
  currency: string | null;
  vendor_account_id: string | null;
  surface: string | null;
  billing_product_key: string | null;
};

type ChargeReceipt = {
  id: number;
  user_id: string | null;
  amount_cents: number | string | null;
  currency: string | null;
  pricing_snapshot: unknown;
  vendor_account_id: string | null;
  surface: string | null;
  billing_product_key: string | null;
};

function positiveInteger(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0;
}

async function refundChargedStaleJob(
  executor: TransactionQueryExecutor,
  job: StaleProvisionalJob
): Promise<void> {
  if (job.payment_status !== 'paid_wallet') return;

  const existingRefund = await executor.query<{ id: number }>(
    `SELECT id FROM app_receipts WHERE job_id = $1 AND type = 'refund' LIMIT 1`,
    [job.job_id]
  );
  if (existingRefund.length) return;

  const charges = await executor.query<ChargeReceipt>(
    `SELECT id, user_id, amount_cents, currency, pricing_snapshot, vendor_account_id,
            surface, billing_product_key
       FROM app_receipts
      WHERE job_id = $1
        AND type = 'charge'
      ORDER BY created_at DESC
      LIMIT 1
      FOR UPDATE`,
    [job.job_id]
  );
  const charge = charges.at(0);
  const amountCents = positiveInteger(charge?.amount_cents);
  if (!charge || !amountCents) {
    throw new Error(`Charged stale Fal job ${job.job_id} has no refundable receipt.`);
  }

  const pricingSnapshot = charge.pricing_snapshot ?? job.pricing_snapshot;
  const vendorAccountId = charge.vendor_account_id ?? job.vendor_account_id;
  const description = buildUserFacingRefundDescription({
    engineLabel: job.engine_label ?? job.engine_id,
    durationSec: job.duration_sec,
    reason: STALE_PROVISIONAL_MESSAGE,
  });
  const inserted = await executor.query<{ id: number }>(
    `INSERT INTO app_receipts (
       user_id, type, amount_cents, currency, description, job_id,
       surface, billing_product_key, pricing_snapshot, application_fee_cents,
       vendor_account_id, stripe_payment_intent_id, stripe_charge_id,
       platform_revenue_cents, destination_acct, metadata
     )
     VALUES ($1,'refund',$2,$3,$4,$5,$6,$7,$8::jsonb,0,$9,NULL,NULL,0,$9,$10::jsonb)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [
      charge.user_id ?? job.user_id,
      amountCents,
      (charge.currency ?? job.currency ?? 'USD').toUpperCase(),
      description,
      job.job_id,
      charge.surface ?? job.surface,
      charge.billing_product_key ?? job.billing_product_key,
      pricingSnapshot == null ? null : JSON.stringify(pricingSnapshot),
      vendorAccountId,
      JSON.stringify({
        reason: 'auto_render_failure_refund',
        original_receipt_id: charge.id,
        provider_job_id: null,
        failure_origin: 'poll_internal',
        note: STALE_PROVISIONAL_MESSAGE,
      }),
    ]
  );
  if (!inserted.length) {
    const concurrentRefund = await executor.query<{ id: number }>(
      `SELECT id FROM app_receipts WHERE job_id = $1 AND type = 'refund' LIMIT 1`,
      [job.job_id]
    );
    if (!concurrentRefund.length) {
      throw new Error(`Refund for stale Fal job ${job.job_id} was not persisted.`);
    }
  }
}

async function settleStaleFalProvisional(jobId: string): Promise<boolean> {
  return withDbTransaction(async (executor) => {
    await executor.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [jobId]);
    const jobs = await executor.query<StaleProvisionalJob>(
      `SELECT job_id, user_id, engine_id, engine_label, duration_sec, payment_status,
              pricing_snapshot, currency, vendor_account_id, surface, billing_product_key
         FROM app_jobs
        WHERE job_id = $1
          AND provider_job_id IS NULL
          AND COALESCE(provider, 'fal') = 'fal'
          AND engine_id IS DISTINCT FROM 'toolbox-finishing'
          AND status = 'pending'
          AND NOT (COALESCE(settings_snapshot, '{}'::jsonb) ? 'requestFingerprint')
          AND created_at < NOW() - INTERVAL '5 minutes'
        FOR UPDATE`,
      [jobId]
    );
    const job = jobs.at(0);
    if (!job) return false;

    await refundChargedStaleJob(executor, job);
    await executor.query(
      `UPDATE app_jobs
          SET status = 'failed',
              progress = 0,
              payment_status = CASE
                WHEN payment_status = 'paid_wallet' THEN 'refunded_wallet'
                ELSE payment_status
              END,
              message = $2,
              provisional = FALSE,
              updated_at = NOW()
        WHERE job_id = $1`,
      [job.job_id, STALE_PROVISIONAL_MESSAGE]
    );
    await executor.query(
      `INSERT INTO fal_queue_log (job_id, provider, provider_job_id, engine_id, status, payload)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
      [
        job.job_id,
        'fal',
        null,
        job.engine_id,
        'poll:not-started',
        JSON.stringify({
          at: new Date().toISOString(),
          note: 'Job never started at Fal; marked as failed.',
          autoRefundEligible: job.payment_status === 'paid_wallet',
        }),
      ]
    );
    return true;
  });
}

export async function reconcileStaleFalProvisionals(
  options: { limit?: number } = {}
): Promise<{ failed: number }> {
  const limit = Math.max(1, Math.min(100, Math.floor(options.limit ?? 20)));
  const staleJobs = await query<{ job_id: string }>(
    `SELECT job_id
       FROM app_jobs
      WHERE provider_job_id IS NULL
        AND NOT (COALESCE(settings_snapshot, '{}'::jsonb) ? 'requestFingerprint')
        AND COALESCE(provider, 'fal') = 'fal'
        AND engine_id IS DISTINCT FROM 'toolbox-finishing'
        AND status = 'pending'
        AND created_at < NOW() - INTERVAL '5 minutes'
      ORDER BY created_at ASC
      LIMIT $1`,
    [limit]
  );

  let failed = 0;
  for (const stale of staleJobs) {
    try {
      if (await settleStaleFalProvisional(stale.job_id)) failed += 1;
    } catch (error) {
      console.warn('[fal-poll] failed to settle stale provisional job', {
        jobId: stale.job_id,
        error,
      });
    }
  }
  return { failed };
}
