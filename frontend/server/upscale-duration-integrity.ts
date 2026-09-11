import { detectVideoMetadata } from '@/server/media/detect-has-audio';
import { withDbTransaction } from '@/lib/db';

export function upscaleDurationIsComplete(sourceDuration: number, outputDuration: number, fps: number): boolean {
  // Two frames accommodate container rounding, never a percentage of a long clip.
  return Number.isFinite(outputDuration) && outputDuration > 0 && outputDuration + 2 / Math.max(1, fps) >= sourceDuration;
}

export async function checkUpscaleDuration(videoUrl: string, snapshot: unknown, probe = detectVideoMetadata) {
  const settings = snapshot as { source?: { metadata?: { durationSec?: number; fps?: number } } } | null;
  const source = settings?.source?.metadata;
  if (!source?.durationSec) return 'legacy' as const;
  const output = await probe(videoUrl);
  if (!output) throw new Error('Upscale output duration is temporarily unavailable.');
  return upscaleDurationIsComplete(source.durationSec, output.durationSec, source.fps ?? output.fps) ? 'complete' as const : 'truncated' as const;
}

/** Failure and wallet restitution commit together; a database failure leaves the job recoverable. */
export async function rejectTruncatedUpscale(jobId: string, providerJobId: string | null, outputUrl: string) {
  return withDbTransaction(async executor => {
    const [job] = await executor.query<{ status: string; payment_status: string }>(
      'SELECT status, payment_status FROM app_jobs WHERE job_id = $1 FOR UPDATE', [jobId]);
    if (!job || job.status === 'completed') return;
    if (job.payment_status === 'paid_wallet') {
      await executor.query(`INSERT INTO app_receipts
        (user_id, type, amount_cents, currency, description, job_id, surface, billing_product_key,
         pricing_snapshot, application_fee_cents, vendor_account_id, platform_revenue_cents, destination_acct)
        SELECT user_id, 'refund', amount_cents, currency, 'Refund: upscale output shorter than original',
          job_id, surface, billing_product_key, pricing_snapshot, 0, vendor_account_id, 0, vendor_account_id
        FROM app_receipts WHERE job_id = $1 AND type = 'charge'
        ORDER BY created_at DESC LIMIT 1 ON CONFLICT DO NOTHING`, [jobId]);
      const refunds = await executor.query<{ id: number }>(
        "SELECT id FROM app_receipts WHERE job_id = $1 AND type = 'refund'", [jobId]);
      if (refunds.length !== 1) throw new Error('Truncated upscale refund could not be confirmed.');
    }
    await executor.query(`UPDATE app_jobs SET status = 'failed', progress = 0, message = $2,
      payment_status = CASE WHEN payment_status = 'paid_wallet' THEN 'refunded_wallet' ELSE payment_status END,
      settings_snapshot = jsonb_set(COALESCE(settings_snapshot, '{}'::jsonb), '{upscaleDurationIntegrity}', $3::jsonb),
      updated_at = NOW() WHERE job_id = $1`, [jobId,
      'The upscaled video is shorter than the original. Contact support before retrying.',
      JSON.stringify({ status: 'truncated', providerJobId, outputUrl })]);
  });
}
