import { listFalEngines } from '@/config/falEngines';
import type { PricingSnapshot } from '@/types/engines';
import type { ImageGenerationMode, ImageGenerationRequest } from '@/types/image-generation';
import { isLumaAgentsImageEngineId } from '@/lib/luma-agents';
import {
  applyStoryboardKlingBundlePricing,
  getStoryboardKlingFirstFramePricingConfig,
  isKlingStoryboardBoardMetadata,
  resolveStoryboardTier,
  STORYBOARD_EDIT_SOURCE,
  STORYBOARD_SOURCE,
} from '@/lib/storyboard-pricing';
import {
  clampRequestedImageCount,
  getImageInputField,
  resolveRequestedResolution,
} from '@/lib/image/inputSchema';
import {
  parseGptImage2SizeKey,
  resolveGptImage2AutoInputImageSize,
  validateGptImage2CustomImageSize,
  type GptImage2ImageSize,
} from '@/lib/image/gptImage2';
import {
  computeCanonicalPublicSnapshot,
  computeCanonicalPublicStoryboardSnapshot,
} from '@/server/pricing/quote-public';

export type ImageEstimateInput = Pick<
  ImageGenerationRequest,
  'engineId' | 'mode' | 'numImages' | 'resolution' | 'quality' | 'aspectRatio'
> & {
  referenceImageCount?: number;
  referenceImageSizes?: Array<{ width: number; height: number }>;
};

export type ImageEstimateNormalized = {
  engineId: string;
  mode: ImageGenerationMode;
  numImages: number;
  resolution: string;
  quality: string | null;
  aspectRatio: string | null;
  customImageSize: GptImage2ImageSize | null;
  referenceImageCount: number;
  referenceImageSizes: GptImage2ImageSize[];
};

export type ImageEstimateErrorCode =
  | 'engine_unavailable'
  | 'mode_unsupported'
  | 'resolution_invalid'
  | 'image_size_invalid';

export class ImageEstimateError extends Error {
  constructor(
    readonly code: ImageEstimateErrorCode,
    readonly status: 400 | 404,
    readonly options: {
      allowed?: string[];
      detail?: Record<string, unknown>;
    } = {}
  ) {
    super(code);
    this.name = 'ImageEstimateError';
  }

  get allowed(): string[] | undefined {
    return this.options.allowed;
  }

  get detail(): Record<string, unknown> | undefined {
    return this.options.detail;
  }
}

type WebImageEstimateInput = ImageEstimateInput & {
  customImageSize?: GptImage2ImageSize | null;
  enableWebSearch?: boolean;
  metadata?: ImageGenerationRequest['metadata'];
  source?: ImageGenerationRequest['source'];
};

type InternalImageEstimateInput = Omit<WebImageEstimateInput, 'referenceImageSizes'> & {
  referenceImageSizes?: Array<Partial<GptImage2ImageSize> | null>;
};

function normalizeReferenceImageSizes(
  sizes: InternalImageEstimateInput['referenceImageSizes']
): GptImage2ImageSize[] {
  if (!Array.isArray(sizes)) return [];
  return sizes.flatMap((size) => {
    if (!size || typeof size !== 'object') return [];
    const width = typeof size.width === 'number' ? size.width : NaN;
    const height = typeof size.height === 'number' ? size.height : NaN;
    return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0
      ? [{ width, height }]
      : [];
  });
}

async function estimateImageGenerationInternal(
  input: InternalImageEstimateInput,
  webExtensions: boolean
): Promise<{ pricing: PricingSnapshot; normalized: ImageEstimateNormalized }> {
  const engineId = typeof input.engineId === 'string' ? input.engineId : null;
  const mode: ImageGenerationMode = input.mode === 'i2i' || input.mode === 't2i' ? input.mode : 't2i';
  const requestedImages =
    typeof input.numImages === 'number' && Number.isFinite(input.numImages)
      ? Math.round(input.numImages)
      : 1;
  const engineEntry = listFalEngines().find((entry) => entry.id === engineId);
  if (!engineEntry || (engineEntry.category ?? 'video') !== 'image') {
    throw new ImageEstimateError('engine_unavailable', 404);
  }

  const engine = engineEntry.engine;
  const numImages = clampRequestedImageCount(engine, mode, requestedImages);
  if (!engineEntry.modes.some((entry) => entry.mode === mode)) {
    throw new ImageEstimateError('mode_unsupported', 400);
  }

  const resolutionResult = resolveRequestedResolution(
    engine,
    mode,
    typeof input.resolution === 'string' ? input.resolution : null
  );
  if (!resolutionResult.ok) {
    throw new ImageEstimateError('resolution_invalid', 400, { allowed: resolutionResult.allowed });
  }

  const rawReferenceSizes = Array.isArray(input.referenceImageSizes) ? input.referenceImageSizes : [];
  const referenceImageSizes = normalizeReferenceImageSizes(rawReferenceSizes);
  let customImageSize = parseGptImage2SizeKey(resolutionResult.resolution);
  if (engine.id === 'gpt-image-2' && resolutionResult.resolution === 'custom') {
    const result = validateGptImage2CustomImageSize(webExtensions ? input.customImageSize : undefined);
    if (!result.ok) {
      throw new ImageEstimateError('image_size_invalid', 400, {
        detail: { message: result.message, detail: result.detail },
      });
    }
    customImageSize = result.size;
  }
  if (engine.id === 'gpt-image-2' && mode === 'i2i' && resolutionResult.resolution === 'auto') {
    customImageSize = resolveGptImage2AutoInputImageSize(rawReferenceSizes);
  }

  const submittedReferenceSizeCount = rawReferenceSizes.filter(
    (entry) => entry && typeof entry === 'object'
  ).length;
  const explicitReferenceCount =
    typeof input.referenceImageCount === 'number' && Number.isFinite(input.referenceImageCount)
      ? Math.max(0, Math.round(input.referenceImageCount))
      : 0;
  const referenceImageCount = explicitReferenceCount || submittedReferenceSizeCount;
  const pricedReferenceImageCount = isLumaAgentsImageEngineId(engine.id)
    ? mode === 'i2i'
      ? Math.max(0, referenceImageCount - 1)
      : referenceImageCount
    : undefined;

  const pricing = await computeCanonicalPublicSnapshot({
    engine,
    durationSec: numImages,
    resolution: resolutionResult.resolution,
    mode,
    customImageSize,
    quality: typeof input.quality === 'string' ? input.quality : undefined,
    referenceImageCount: pricedReferenceImageCount,
    currency: engine.pricing?.currency ?? 'USD',
    addons:
      webExtensions &&
      getImageInputField(engine, 'enable_web_search', mode) &&
      input.enableWebSearch === true
        ? { enable_web_search: true }
        : undefined,
  });

  let finalPricing = pricing;
  if (webExtensions && engine.id === 'gpt-image-2' && input.source === STORYBOARD_SOURCE) {
    finalPricing = await computeCanonicalPublicStoryboardSnapshot({
      snapshot: pricing,
      operation: STORYBOARD_SOURCE,
      tier: resolveStoryboardTier({
        customImageSize,
        resolution: resolutionResult.resolution,
        quality: input.quality,
      }),
    });
    if (isKlingStoryboardBoardMetadata(input.metadata)) {
      const firstFrameConfig = getStoryboardKlingFirstFramePricingConfig({
        customImageSize,
        aspectRatio: typeof input.aspectRatio === 'string' ? input.aspectRatio : null,
      });
      const firstFramePricing = await computeCanonicalPublicStoryboardSnapshot({
        snapshot: await computeCanonicalPublicSnapshot({
          engine,
          durationSec: 1,
          resolution: firstFrameConfig.resolution,
          customImageSize: firstFrameConfig.customImageSize,
          quality: firstFrameConfig.quality,
          currency: engine.pricing?.currency ?? 'USD',
        }),
        operation: STORYBOARD_SOURCE,
        tier: 'hd',
      });
      finalPricing = applyStoryboardKlingBundlePricing(finalPricing, firstFramePricing);
    }
  } else if (
    webExtensions &&
    engine.id === 'gpt-image-2' &&
    input.source === STORYBOARD_EDIT_SOURCE
  ) {
    finalPricing = await computeCanonicalPublicStoryboardSnapshot({
      snapshot: pricing,
      operation: STORYBOARD_EDIT_SOURCE,
    });
  }

  return {
    pricing: finalPricing,
    normalized: {
      engineId: engineEntry.id,
      mode,
      numImages,
      resolution: resolutionResult.resolution,
      quality: typeof input.quality === 'string' ? input.quality : null,
      aspectRatio: typeof input.aspectRatio === 'string' ? input.aspectRatio : null,
      customImageSize,
      referenceImageCount,
      referenceImageSizes,
    },
  };
}

export async function estimateImageGeneration(
  input: ImageEstimateInput
): Promise<{ pricing: PricingSnapshot; normalized: ImageEstimateNormalized }> {
  return estimateImageGenerationInternal(
    {
      engineId: input.engineId,
      mode: input.mode,
      numImages: input.numImages,
      resolution: input.resolution,
      quality: input.quality,
      aspectRatio: input.aspectRatio,
      referenceImageCount: input.referenceImageCount,
      referenceImageSizes: input.referenceImageSizes,
    },
    false
  );
}

export async function estimateWebImageGeneration(
  input: WebImageEstimateInput
): Promise<{ pricing: PricingSnapshot; normalized: ImageEstimateNormalized }> {
  return estimateImageGenerationInternal(input, true);
}
