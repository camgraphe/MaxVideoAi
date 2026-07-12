import { computeBillingProductSnapshot, repriceCanonicalFixedProductSnapshot } from '@/lib/billing-products';
import { buildBackgroundRemovalPricingPreview } from '@/lib/tools-background-removal';
import type { PricingSnapshot } from '@/types/engines';
import type { BackgroundRemovalOutputCodec, BackgroundRemovalToolEngineDefinition } from '@/types/tools-background-removal';
import { BackgroundRemovalToolError } from './background-removal-errors';
import {
  BACKGROUND_REMOVAL_SURFACE,
  type BackgroundRemovalVideoMetadata,
} from './background-removal-request-utils';

export type BackgroundRemovalPricingEstimate = {
  durationSec?: number | null;
  estimatedCostUsd?: number | null;
  priceMultiplier?: number | null;
};

export async function resolveBackgroundRemovalPricingContext(params: {
  billingProductKey: string;
  engine: BackgroundRemovalToolEngineDefinition;
  outputCodec: BackgroundRemovalOutputCodec;
  videoMetadata: BackgroundRemovalVideoMetadata;
}): Promise<{ pricing: PricingSnapshot; pricingEstimate: BackgroundRemovalPricingEstimate }> {
  try {
    let pricing = await computeBillingProductSnapshot({
      productKey: params.billingProductKey,
      quantity: 1,
      engineId: params.engine.id,
    });
    const preview = buildBackgroundRemovalPricingPreview({
      unitPriceCents: pricing.totalCents,
      currency: pricing.currency,
      durationSec: params.videoMetadata.durationSec,
      outputCodec: params.outputCodec,
    });
    const dynamicCents = Math.max(1, preview.totalCents ?? pricing.totalCents);
    const dynamicFloorCents = pricing.totalCents;
    pricing = repriceCanonicalFixedProductSnapshot(pricing, dynamicCents, {
      ...(dynamicCents > dynamicFloorCents
        ? { pricingModel: 'dynamic-background-removal-video', dynamicFloorCents }
        : {}),
      surface: BACKGROUND_REMOVAL_SURFACE,
      billingProductKey: params.billingProductKey,
      estimatedCostUsd: preview.estimate?.estimatedCostUsd ?? null,
      priceMultiplier: preview.estimate?.priceMultiplier ?? null,
      outputCodec: params.outputCodec,
      videoMetadata: params.videoMetadata,
    });
    return {
      pricing,
      pricingEstimate: {
        durationSec: params.videoMetadata.durationSec,
        estimatedCostUsd: preview.estimate?.estimatedCostUsd ?? null,
        priceMultiplier: preview.estimate?.priceMultiplier ?? null,
      },
    };
  } catch (error) {
    throw new BackgroundRemovalToolError('Unable to compute background removal pricing.', {
      status: 500,
      code: 'pricing_error',
      detail: error instanceof Error ? error.message : error,
    });
  }
}
