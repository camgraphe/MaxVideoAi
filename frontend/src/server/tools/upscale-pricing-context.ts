import { computeBillingProductSnapshot } from '@/lib/billing-products';
import {
  UPSCALE_VIDEO_DYNAMIC_MARGIN_MULTIPLIER,
  estimateImageUpscaleCostUsd,
  estimateVideoUpscaleCostUsd,
} from '@/lib/tools-upscale';
import type { PricingSnapshot } from '@/types/engines';
import type { UpscaleToolEngineDefinition, UpscaleToolRequest } from '@/types/tools-upscale';
import {
  UPSCALE_SURFACE,
  cloneUpscalePricingWithDynamicTotal,
  type VideoMetadata,
} from './upscale-request-utils';
import { UpscaleToolError } from './upscale-errors';

export type UpscalePricingEstimate = {
  megapixels?: number | null;
  frames?: number | null;
  durationSec?: number | null;
};

type ResolveUpscalePricingContextInput = {
  billingProductKey: string;
  engine: UpscaleToolEngineDefinition;
  input: Pick<UpscaleToolRequest, 'imageHeight' | 'imageWidth' | 'mediaType'>;
  targetResolution: UpscaleToolRequest['targetResolution'];
  upscaleFactor: number;
  videoMetadata: VideoMetadata | null;
};

export async function resolveUpscalePricingContext({
  billingProductKey,
  engine,
  input,
  targetResolution,
  upscaleFactor,
  videoMetadata,
}: ResolveUpscalePricingContextInput): Promise<{
  pricing: PricingSnapshot;
  pricingEstimate: UpscalePricingEstimate;
}> {
  try {
    let pricing = await computeBillingProductSnapshot({
      productKey: billingProductKey,
      quantity: 1,
      engineId: engine.id,
    });

    if (input.mediaType === 'video' && videoMetadata) {
      const estimate = estimateVideoUpscaleCostUsd({
        engineId: engine.id,
        width: videoMetadata.width,
        height: videoMetadata.height,
        durationSec: videoMetadata.durationSec,
        fps: videoMetadata.fps,
        targetResolution,
        factor: upscaleFactor,
      });
      const dynamicCents = Math.max(1, Math.ceil(estimate.costUsd * 100 * UPSCALE_VIDEO_DYNAMIC_MARGIN_MULTIPLIER));
      pricing = cloneUpscalePricingWithDynamicTotal(pricing, dynamicCents, {
        surface: UPSCALE_SURFACE,
        billingProductKey,
        providerEstimateUsd: estimate.costUsd,
        dynamicMultiplier: UPSCALE_VIDEO_DYNAMIC_MARGIN_MULTIPLIER,
        videoMetadata,
      });
      return {
        pricing,
        pricingEstimate: {
          megapixels: estimate.outputMegapixels,
          frames: estimate.frames,
          durationSec: videoMetadata.durationSec,
        },
      };
    }

    const estimateCostUsd = estimateImageUpscaleCostUsd({
      engineId: engine.id,
      width: input.imageWidth,
      height: input.imageHeight,
      factor: upscaleFactor,
    });
    pricing.meta = {
      ...(pricing.meta ?? {}),
      surface: UPSCALE_SURFACE,
      billingProductKey,
      providerEstimateUsd: estimateCostUsd,
    };

    return {
      pricing,
      pricingEstimate: {
        megapixels:
          typeof input.imageWidth === 'number' && typeof input.imageHeight === 'number'
            ? Number(((input.imageWidth * input.imageHeight * upscaleFactor * upscaleFactor) / 1_000_000).toFixed(4))
            : null,
      },
    };
  } catch (error) {
    throw new UpscaleToolError('Unable to compute upscale pricing.', {
      status: 500,
      code: 'pricing_error',
      detail: error instanceof Error ? error.message : error,
    });
  }
}
