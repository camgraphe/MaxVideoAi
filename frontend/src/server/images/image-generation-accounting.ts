import { isDatabaseConfigured, query } from '@/lib/db';
import { ensureBillingSchema } from '@/lib/schema';
import { requiresMembershipPricingRefresh, MEMBERSHIP_PRICING_REFRESH_MESSAGE } from '@/lib/membership-policy';
import type { ImageGenerationResponse } from '@/types/image-generation';
import type { ExecuteImageGenerationOptions } from './image-generation-execution-contract';
import { buildResponseFromExistingJob, type ExistingImageJobRow } from './existing-image-job-response';
import { ImageGenerationExecutionError } from './image-generation-error';

type AccountingOptions = Pick<ExecuteImageGenerationOptions,
  'userId' | 'body' | 'walletReservation' | 'preReservedInitialState' | 'trustedQuotedBilling'>;

/** Owned paid jobs return their persisted quote before any new pricing or provider work. */
export async function prepareImageGenerationAccounting(options: AccountingOptions): Promise<ImageGenerationResponse | null> {
  const { userId, body, walletReservation, preReservedInitialState, trustedQuotedBilling } = options;
  if ((walletReservation === 'already_reserved' && (!preReservedInitialState || preReservedInitialState.kind !== 'created'
      || preReservedInitialState.recoveredCharge !== true || !trustedQuotedBilling))
    || (walletReservation === 'reserve' && (preReservedInitialState !== undefined || trustedQuotedBilling !== undefined))) {
    throw new ImageGenerationExecutionError('Invalid pre-reserved image generation state.', { mode: 't2i', code: 'job_charge_conflict', status: 409 });
  }
  const jobId = typeof body.jobId === 'string' ? body.jobId.trim() : '';
  const membershipRefresh = !trustedQuotedBilling && requiresMembershipPricingRefresh(body.membershipTier);
  const assertMembership = () => {
    if (membershipRefresh) throw new ImageGenerationExecutionError(MEMBERSHIP_PRICING_REFRESH_MESSAGE,
      { mode: 't2i', code: 'PRICING_REFRESH_REQUIRED', status: 409 });
  };
  // A new legacy-discount request needs no database access. Only a retry with an
  // owned persisted job can recover its previously paid historical snapshot.
  if (walletReservation !== 'reserve' || !jobId) assertMembership();
  if (!isDatabaseConfigured()) throw new ImageGenerationExecutionError('Database unavailable.', { mode: 't2i', code: 'db_unavailable', status: 503 });
  if (walletReservation === 'reserve' && jobId) {
    const [job] = await query<ExistingImageJobRow>(
      `SELECT job_id, user_id, status, progress, provider_job_id, thumb_url, aspect_ratio,
        pricing_snapshot, currency, payment_status, engine_id, engine_label, render_ids,
        hero_render_id, message, settings_snapshot
       FROM app_jobs WHERE job_id = $1 AND user_id = $2 AND surface IN ('image', 'storyboard') LIMIT 1`, [jobId, userId]);
    if (job) return buildResponseFromExistingJob({ job, mode: body.mode === 'i2i' ? 'i2i' : 't2i',
      engineId: job.engine_id, engineLabel: job.engine_label, pricing: job.pricing_snapshot ?? undefined,
      resolvedAspectRatio: job.aspect_ratio, resolution: '' });
  }
  assertMembership();
  try { await ensureBillingSchema(); }
  catch {
    throw new ImageGenerationExecutionError('Database unavailable.', { mode: 't2i', code: 'db_unavailable', status: 503 });
  }
  return null;
}
