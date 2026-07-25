import { query } from '@/lib/db';
import {
  buildUserFacingRefundDescription,
  toUserFacingFailureMessage,
} from '@/server/user-facing-failure-messages';
import { BYTEPLUS_MODELARK_PROVIDER } from '@/server/video-providers/byteplus-modelark';
import type { BytePlusPendingJob } from './byteplus-poll-types';

const ACTIVE_JOB_STATUSES = ['pending', 'queued', 'running', 'processing', 'in_progress'];

export type BytePlusProviderFailure = {
  providerErrorCode: string | null;
  failureCode: string | null;
};

export async function recordBytePlusPollEvent(
  job: Pick<BytePlusPendingJob, 'job_id' | 'provider_job_id' | 'engine_id'>,
  status: string,
  payload: Record<string, unknown>
) {
  try {
    await query(
      `INSERT INTO fal_queue_log (job_id, provider, provider_job_id, engine_id, status, payload)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
      [
        job.job_id,
        BYTEPLUS_MODELARK_PROVIDER,
        job.provider_job_id,
        job.engine_id,
        status,
        JSON.stringify({
          at: new Date().toISOString(),
          ...payload,
        }),
      ]
    );
  } catch (error) {
    console.warn('[byteplus-poll] failed to record poll event', { jobId: job.job_id, status }, error);
  }
}

async function recordWalletRefundOnce(job: BytePlusPendingJob, reason: string) {
  if (job.payment_status !== 'paid_wallet' || !job.user_id || !job.final_price_cents) return false;

  const inserted = await query<{ id: string }>(
    `INSERT INTO app_receipts (
       user_id,
       type,
       amount_cents,
       currency,
       description,
       job_id,
       surface,
       billing_product_key,
       pricing_snapshot,
       application_fee_cents,
       vendor_account_id,
       stripe_payment_intent_id,
       stripe_charge_id,
       platform_revenue_cents,
       destination_acct
     )
     VALUES ($1,'refund',$2,$3,$4,$5,'video',NULL,$6::jsonb,NULL,NULL,NULL,NULL,NULL,NULL)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [
      job.user_id,
      job.final_price_cents,
      (job.currency ?? 'USD').toUpperCase(),
      buildUserFacingRefundDescription({
        engineLabel: job.engine_label,
        durationSec: job.duration_sec,
        reason,
      }),
      job.job_id,
      JSON.stringify(job.pricing_snapshot ?? {}),
    ]
  );
  if (!inserted.length) return false;

  await query(
    `UPDATE app_jobs
        SET payment_status = 'refunded_wallet',
            updated_at = NOW()
      WHERE job_id = $1
        AND payment_status = 'paid_wallet'`,
    [job.job_id]
  );
  return true;
}

export async function markBytePlusJobFailed(
  job: BytePlusPendingJob,
  message: string,
  providerStatus?: string | null,
  providerFailure?: BytePlusProviderFailure | null
) {
  const userMessage = toUserFacingFailureMessage(message);
  const providerFailureJson = providerFailure
    ? JSON.stringify({
        provider: BYTEPLUS_MODELARK_PROVIDER,
        providerErrorCode: providerFailure.providerErrorCode,
        failureCode: providerFailure.failureCode,
      })
    : null;
  const claimed = await query<{ job_id: string }>(
    `UPDATE app_jobs
        SET status = 'failed',
            progress = 0,
            message = $2,
            provisional = FALSE,
            settings_snapshot = CASE
              WHEN $4::jsonb IS NULL THEN settings_snapshot
              ELSE jsonb_set(COALESCE(settings_snapshot, '{}'::jsonb), '{providerFailure}', $4::jsonb, true)
            END,
            updated_at = NOW()
      WHERE job_id = $1
        AND status = ANY($3::text[])
      RETURNING job_id`,
    [job.job_id, userMessage, ACTIVE_JOB_STATUSES, providerFailureJson]
  );
  if (!claimed.length) {
    await recordBytePlusPollEvent(job, 'poll:failed:skipped', {
      providerStatus: providerStatus ?? null,
      providerErrorCode: providerFailure?.providerErrorCode ?? null,
      failureCode: providerFailure?.failureCode ?? null,
      reason: 'job_not_active',
    });
    return;
  }

  const refunded = await recordWalletRefundOnce(job, userMessage);
  await query(
    `UPDATE app_jobs
        SET payment_status = CASE WHEN $2 THEN 'refunded_wallet' ELSE payment_status END,
            updated_at = NOW()
      WHERE job_id = $1`,
    [job.job_id, refunded]
  );
  await recordBytePlusPollEvent(job, 'poll:failed', {
    providerStatus: providerStatus ?? null,
    providerErrorCode: providerFailure?.providerErrorCode ?? null,
    failureCode: providerFailure?.failureCode ?? null,
    refunded,
  });
}
