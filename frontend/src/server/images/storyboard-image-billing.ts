import { query } from '@/lib/db';
import { computeCanonicalBillingSnapshot } from '@/server/pricing/quote-billing';
import {
  STORYBOARD_KLING_FIRST_FRAME_JOB_PREFIX,
  STORYBOARD_SOURCE,
  applyStoryboardEditPricing,
  applyStoryboardKlingBundlePricing,
  applyStoryboardPricing,
  createIncludedStoryboardKlingFirstFramePricing,
  getKlingStoryboardFirstFrameParentJobId,
  getStoryboardKlingFirstFramePricingConfig,
  isKlingStoryboardBoardMetadata,
  resolveStoryboardTier,
  STORYBOARD_EDIT_SOURCE,
} from '@/lib/storyboard-pricing';
import type { JobSurface } from '@/types/billing';
import type { EngineCaps, PricingSnapshot } from '@/types/engines';
import type { ImageGenerationMode, ImageGenerationRequest } from '@/types/image-generation';
import { ImageGenerationExecutionError } from './image-generation-error';

export async function resolveIncludedKlingFirstFrameParentJobId(params: {
  userId: string;
  jobId: string;
  mode: ImageGenerationMode;
  engineId: string;
  jobSurface: JobSurface;
  source: unknown;
  metadata: ImageGenerationRequest['metadata'] | null;
}): Promise<string | null> {
  const parentJobId = getKlingStoryboardFirstFrameParentJobId(params.metadata);
  const isFirstFrameRequest = params.metadata?.storyboard?.role === 'kling_first_frame';
  if (!isFirstFrameRequest) return null;

  if (
    params.engineId !== 'gpt-image-2' ||
    params.jobSurface !== 'storyboard' ||
    params.source !== STORYBOARD_SOURCE ||
    !parentJobId ||
    !params.jobId.startsWith(STORYBOARD_KLING_FIRST_FRAME_JOB_PREFIX)
  ) {
    throw new ImageGenerationExecutionError('Invalid storyboard first-frame request.', {
      mode: params.mode,
      status: 400,
      code: 'storyboard_first_frame_invalid',
      detail: { jobId: params.jobId, parentJobId },
    });
  }

  const parents = await query<{ job_id: string }>(
    `SELECT job_id
     FROM app_jobs
     WHERE job_id = $1
       AND user_id = $2
       AND surface = 'storyboard'
       AND payment_status = 'paid_wallet'
       AND COALESCE(final_price_cents, 0) > 0
       AND settings_snapshot->'storyboard'->>'role' = 'board'
       AND settings_snapshot->'storyboard'->>'targetModel' = 'kling'
     LIMIT 1`,
    [parentJobId, params.userId]
  );
  if (!parents.length) {
    throw new ImageGenerationExecutionError('The storyboard first frame must be attached to a paid Kling storyboard.', {
      mode: params.mode,
      status: 409,
      code: 'storyboard_parent_invalid',
      detail: { parentJobId },
    });
  }

  const existingIncludedFirstFrames = await query<{ job_id: string }>(
    `SELECT job_id
     FROM app_jobs
     WHERE user_id = $1
       AND job_id <> $2
       AND surface = 'storyboard'
       AND COALESCE(status, '') <> 'failed'
       AND settings_snapshot->'storyboard'->>'role' = 'kling_first_frame'
       AND settings_snapshot->'storyboard'->>'parentJobId' = $3
     LIMIT 1`,
    [params.userId, params.jobId, parentJobId]
  );
  if (existingIncludedFirstFrames.length) {
    throw new ImageGenerationExecutionError('This storyboard already has an included Kling first frame.', {
      mode: params.mode,
      status: 409,
      code: 'storyboard_first_frame_exists',
      detail: {
        parentJobId,
        existingJobId: existingIncludedFirstFrames[0]?.job_id,
      },
    });
  }

  return parentJobId;
}

export async function applyStoryboardImagePricing(params: {
  pricing: PricingSnapshot;
  engine: EngineCaps;
  jobSurface: JobSurface;
  source: unknown;
  metadata: ImageGenerationRequest['metadata'] | null;
  includedKlingFirstFrameParentJobId: string | null;
  customImageSize: { width?: number | null; height?: number | null } | null;
  resolution: string;
  quality: string | null;
  resolvedAspectRatio: string | null;
  membershipTier?: string;
  currency: string;
}): Promise<PricingSnapshot> {
  const {
    pricing,
    engine,
    jobSurface,
    source,
    metadata,
    includedKlingFirstFrameParentJobId,
    customImageSize,
    resolution,
    quality,
    resolvedAspectRatio,
    membershipTier,
    currency,
  } = params;

  if (jobSurface !== 'storyboard' || engine.id !== 'gpt-image-2') return pricing;
  if (includedKlingFirstFrameParentJobId) {
    return createIncludedStoryboardKlingFirstFramePricing(pricing, includedKlingFirstFrameParentJobId);
  }
  if (source === STORYBOARD_EDIT_SOURCE) {
    return applyStoryboardEditPricing(pricing);
  }

  const storyboardTier = resolveStoryboardTier({ customImageSize, resolution, quality });
  let storyboardPricing = applyStoryboardPricing(pricing, storyboardTier);
  if (!isKlingStoryboardBoardMetadata(metadata)) return storyboardPricing;

  const firstFrameConfig = getStoryboardKlingFirstFramePricingConfig({
    customImageSize,
    aspectRatio: resolvedAspectRatio,
  });
  const firstFramePricing = applyStoryboardPricing(
    await computeCanonicalBillingSnapshot({
      engine,
      durationSec: 1,
      resolution: firstFrameConfig.resolution,
      customImageSize: firstFrameConfig.customImageSize,
      quality: firstFrameConfig.quality,
      membershipTier,
      currency,
    }),
    'hd'
  );
  storyboardPricing = applyStoryboardKlingBundlePricing(storyboardPricing, firstFramePricing);
  return storyboardPricing;
}
