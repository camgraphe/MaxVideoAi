import { query } from '@/lib/db';
import { deriveJobSurface } from '@/lib/job-surface';
import type { PricingSnapshot } from '@/types/engines';
import type { JobRow } from './jobs-route-types';

const STALE_AUDIO_JOB_TIMEOUT_MS = 10 * 60 * 1000;

export function isStaleAudioJob(row: JobRow): boolean {
  const surface = deriveJobSurface({
    surface: row.surface,
    settingsSnapshot: row.settings_snapshot,
    jobId: row.job_id,
    engineId: row.engine_id,
    videoUrl: row.video_url,
    renderIds: row.render_ids,
  });
  if (surface !== 'audio') return false;
  if (row.video_url || row.audio_url) return false;
  const status = (row.status ?? '').trim().toLowerCase();
  if (!status || !['pending', 'running', 'queued'].includes(status)) return false;
  const updatedAt = new Date(row.updated_at);
  if (Number.isNaN(updatedAt.getTime())) return false;
  return Date.now() - updatedAt.getTime() > STALE_AUDIO_JOB_TIMEOUT_MS;
}

export async function expireStaleAudioJob(row: JobRow, userId: string): Promise<void> {
  const refundAmountCents =
    typeof row.final_price_cents === 'number'
      ? row.final_price_cents
      : typeof row.pricing_snapshot?.totalCents === 'number'
        ? row.pricing_snapshot.totalCents
        : 0;
  const refundCurrency = row.currency ?? row.pricing_snapshot?.currency ?? 'USD';
  const refundSnapshot =
    row.pricing_snapshot ??
    ({
      currency: refundCurrency,
      totalCents: refundAmountCents,
      subtotalBeforeDiscountCents: refundAmountCents,
      base: {
        seconds: 0,
        rate: 0,
        unit: 'sec',
        amountCents: refundAmountCents,
      },
      addons: [],
      margin: {
        amountCents: 0,
      },
      membershipTier: 'member',
      meta: {
        surface: 'audio',
      },
    } satisfies PricingSnapshot);

  if (refundAmountCents > 0 && row.payment_status === 'paid_wallet') {
    const existingRefund = await query<{ present: number }>(
      `SELECT 1 AS present
         FROM app_receipts
        WHERE job_id = $1
          AND type = 'refund'
        LIMIT 1`,
      [row.job_id]
    );
    if (!existingRefund[0]) {
      await query(
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
           vendor_account_id
         )
         VALUES ($1, 'refund', $2, $3, $4, $5, 'audio', $6, $7::jsonb, 0, NULL)`,
        [
          userId,
          refundAmountCents,
          refundCurrency,
          'Refund stale audio render',
          row.job_id,
          row.billing_product_key ?? null,
          JSON.stringify(refundSnapshot),
        ]
      );
    }
  }

  await query(
    `UPDATE app_jobs
        SET status = 'failed',
            progress = 0,
            message = $1,
            payment_status = CASE
              WHEN payment_status = 'paid_wallet' THEN 'refunded_wallet'
              ELSE payment_status
            END,
            updated_at = NOW()
      WHERE job_id = $2`,
    ['Audio render timed out before completion.', row.job_id]
  );
}
