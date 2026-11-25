import { query } from '@/lib/db';
import { normalizeGptImage2Quality, parseGptImage2SizeKey, resolveGptImage2PricingTier, type GptImage2ImageSize } from '@/lib/image/gptImage2';
import {
  computeCanonicalBillingSnapshot,
  computeCanonicalStoryboardBillingSnapshot,
} from '@/server/pricing/quote-billing';
import {
  STORYBOARD_BILLING_ENGINE_ID,
  STORYBOARD_SOURCE,
  STORYBOARD_IMAGE_ENGINE_ID,
  STORYBOARD_REFERENCE_SLOT_COUNT,
  isStoryboardBillingSource,
  applyStoryboardKlingBundlePricing,
  createIncludedStoryboardKlingFirstFramePricing,
  getKlingStoryboardFirstFrameParentJobId,
  getStoryboardBillingIdentity,
  getStoryboardKlingFirstFrameJobId,
  getStoryboardKlingFirstFramePricingConfig,
  isKlingStoryboardBoardMetadata,
  resolveStoryboardTier,
  STORYBOARD_EDIT_SOURCE,
} from '@/lib/storyboard-pricing';
import type { JobSurface } from '@/types/billing';
import type { EngineCaps, PricingSnapshot } from '@/types/engines';
import type { ImageGenerationMode, ImageGenerationRequest } from '@/types/image-generation';
import { ImageGenerationExecutionError } from './image-generation-error';
import { CustomerTariffRevisionError } from '@/server/pricing/customer-tariff-revision';

export function resolveStoryboardRequestBillingIdentity({
  jobSurface, engine, mode, numImages, body, metadata,
}: {
  jobSurface: JobSurface;
  engine: EngineCaps;
  mode: ImageGenerationMode;
  numImages: number;
  body: Partial<ImageGenerationRequest>;
  metadata: ImageGenerationRequest['metadata'] | null;
}) {
  if (jobSurface !== 'storyboard') return null;
  if (engine.id !== STORYBOARD_IMAGE_ENGINE_ID || engine.providerMeta?.provider !== 'openai_images') {
    throw new ImageGenerationExecutionError('Refresh Storyboarder to use the current image model.', {
      mode, code: 'storyboard_model_changed', status: 409,
    });
  }
  const isEdit = body.source === STORYBOARD_EDIT_SOURCE;
  const referenceCount = Array.isArray(body.imageUrls) ? body.imageUrls.length : 0;
  if (mode !== 'i2i' || numImages !== 1 || body.characterReferences?.length || referenceCount < 1 ||
      referenceCount > STORYBOARD_REFERENCE_SLOT_COUNT + 1 ||
      (isEdit && (referenceCount !== 1 || metadata?.storyboard))) {
    throw new ImageGenerationExecutionError('Storyboarder requires a single image edit with the expected references.', {
      mode, code: 'storyboard_settings_invalid', status: 400,
    });
  }
  return getStoryboardBillingIdentity(body.source);
}

export async function resolveIncludedKlingFirstFrameParentJobId(params: {
  userId: string;
  jobId: string;
  mode: ImageGenerationMode;
  engineId: string;
  jobSurface: JobSurface;
  source: unknown;
  metadata: ImageGenerationRequest['metadata'] | null;
  resolution: string;
  quality: string | null;
  referenceImageCount: number;
}): Promise<string | null> {
  const parentJobId = getKlingStoryboardFirstFrameParentJobId(params.metadata);
  const isFirstFrameRequest = params.metadata?.storyboard?.role === 'kling_first_frame';
  if (!isFirstFrameRequest) return null;

  if (
    params.engineId !== STORYBOARD_IMAGE_ENGINE_ID ||
    params.jobSurface !== 'storyboard' ||
    params.source !== STORYBOARD_SOURCE ||
    !parentJobId ||
    params.jobId !== getStoryboardKlingFirstFrameJobId(parentJobId)
  ) {
    throw new ImageGenerationExecutionError('Invalid storyboard first-frame request.', {
      mode: params.mode,
      status: 400,
      code: 'storyboard_first_frame_invalid',
      detail: { jobId: params.jobId, parentJobId },
    });
  }

  const [parent] = await query<{
    core: { resolution?: string; customImageSize?: GptImage2ImageSize | null; aspectRatio?: string | null } | null;
    reference_count: number;
  }>(
    `SELECT settings_snapshot->'core' AS core,
            CASE WHEN jsonb_typeof(settings_snapshot#>'{refs,imageUrls}') = 'array'
                 THEN jsonb_array_length(settings_snapshot#>'{refs,imageUrls}') ELSE 0 END AS reference_count
     FROM app_jobs
     WHERE job_id = $1
       AND user_id = $2
       AND surface = 'storyboard'
       AND status = 'completed'
       AND payment_status = 'paid_wallet'
       AND COALESCE(final_price_cents, 0) > 0
       AND engine_id = $3
       AND settings_snapshot->>'engineId' = $4
       AND settings_snapshot->'storyboard'->>'role' = 'board'
       AND settings_snapshot->'storyboard'->>'targetModel' = 'kling'
     LIMIT 1`,
    [parentJobId, params.userId, STORYBOARD_BILLING_ENGINE_ID, STORYBOARD_IMAGE_ENGINE_ID]
  );
  if (!parent) {
    throw new ImageGenerationExecutionError('The storyboard first frame must be attached to a paid Kling storyboard.', {
      mode: params.mode,
      status: 409,
      code: 'storyboard_parent_invalid',
      detail: { parentJobId },
    });
  }

  const expectedFrame = getStoryboardKlingFirstFramePricingConfig({
    engineId: params.engineId,
    customImageSize: parent.core?.customImageSize ?? parseGptImage2SizeKey(parent.core?.resolution),
    aspectRatio: parent.core?.aspectRatio,
  });
  if (
    params.resolution !== expectedFrame.resolution ||
    params.quality !== expectedFrame.quality ||
    params.referenceImageCount > parent.reference_count
  ) {
    throw new ImageGenerationExecutionError('The first frame must use the settings included with its storyboard.', {
      mode: params.mode,
      status: 400,
      code: 'storyboard_first_frame_invalid',
      detail: { parentJobId },
    });
  }

  return parentJobId;
}

export async function applyStoryboardImagePricing(params: {
  pricing: PricingSnapshot;
  engine: EngineCaps;
  jobSurface: JobSurface;
  source: unknown;
  metadata: ImageGenerationRequest['metadata'] | null | undefined;
  includedKlingFirstFrameParentJobId: string | null;
  customImageSize: GptImage2ImageSize | null;
  editReferenceSize?: GptImage2ImageSize | null;
  resolution: string;
  quality: string | null;
  complexity?: string;
  referenceImageCount?: number;
  resolvedAspectRatio: string | null;
  membershipTier?: string;
  currency: string;
}, deps: {
  quoteImage?: typeof computeCanonicalBillingSnapshot;
  quoteStoryboard?: typeof computeCanonicalStoryboardBillingSnapshot;
} = {}): Promise<PricingSnapshot> {
  const {
    pricing, engine, jobSurface, source, metadata, includedKlingFirstFrameParentJobId,
    customImageSize, editReferenceSize, resolution, quality, complexity, referenceImageCount,
    resolvedAspectRatio, membershipTier, currency,
  } = params;
  const direct = engine.id === STORYBOARD_IMAGE_ENGINE_ID;
  if (jobSurface !== 'storyboard' || !isStoryboardBillingSource(source) || (!direct && engine.id !== 'gpt-image-2')) return pricing;
  if (includedKlingFirstFrameParentJobId) {
    return createIncludedStoryboardKlingFirstFramePricing(pricing, includedKlingFirstFrameParentJobId);
  }

  const quoteStoryboard = deps.quoteStoryboard ?? computeCanonicalStoryboardBillingSnapshot;
  // Preserve the previous displayed price basis without involving the legacy provider.
  const legacyCost = (size: string, dimensions: typeof customImageSize, imageQuality: string | null) =>
    resolveGptImage2PricingTier(size, dimensions).prices[normalizeGptImage2Quality(imageQuality)];
  if (source === STORYBOARD_EDIT_SOURCE) {
    return quoteStoryboard({
      snapshot: pricing,
      operation: source,
      ...(direct ? { legacySupplierCostCents: legacyCost('auto', editReferenceSize ?? null, quality) } : {}),
    });
  }

  const size = customImageSize ?? parseGptImage2SizeKey(resolution);
  const board = await quoteStoryboard({
    snapshot: pricing,
    operation: source,
    tier: resolveStoryboardTier({ customImageSize: size, resolution, quality }),
    ...(direct ? { legacySupplierCostCents: legacyCost(resolution, size, quality) } : {}),
  });
  if (!isKlingStoryboardBoardMetadata(metadata)) return board;

  const frameOptions = { customImageSize: size, aspectRatio: resolvedAspectRatio, engineId: engine.id };
  const frame = getStoryboardKlingFirstFramePricingConfig(frameOptions);
  const firstFrame = await (deps.quoteImage ?? computeCanonicalBillingSnapshot)({
    engine, durationSec: 1, mode: 'i2i',
    resolution: frame.resolution, customImageSize: frame.customImageSize, quality: frame.quality,
    ...(direct ? { complexity, referenceImageCount } : {}),
    membershipTier, currency,
  });
  if (direct && pricing.meta?.customerTariffRevision !== firstFrame.meta?.customerTariffRevision) {
    throw new CustomerTariffRevisionError();
  }
  return applyStoryboardKlingBundlePricing(board, await quoteStoryboard({
    snapshot: firstFrame,
    operation: source,
    tier: 'hd',
    ...(direct ? { legacySupplierCostCents: legacyCost(frame.resolution, frame.customImageSize, frame.quality) } : {}),
  }));
}
