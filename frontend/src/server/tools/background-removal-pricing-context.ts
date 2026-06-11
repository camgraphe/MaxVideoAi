import { BACKGROUND_REMOVAL_DYNAMIC_MARGIN_MULTIPLIER } from '@/config/tools-background-removal-engines';
import { computeBillingProductSnapshot } from '@/lib/billing-products';
import { buildBackgroundRemovalPricingPreview } from '@/lib/tools-background-removal';
import type { PricingSnapshot } from '@/types/engines';
import type { BackgroundRemovalToolEngineDefinition } from '@/types/tools-background-removal';
import { BackgroundRemovalToolError } from './background-removal-errors';
import {
  BACKGROUND_REMOVAL_SURFACE,
  cloneBackgroundRemovalPricingWithDynamicTotal,
  type BackgroundRemovalVideoMetadata,
} from './background-removal-request-utils';

export type BackgroundRemovalPricingEstimate = {
  durationSec?: number | null;
  providerEstimateUsd?: number | null;
};

export async function resolveBackgroundRemovalPricingContext(params: {
  billingProductKey: string;
  engine: BackgroundRemovalToolEngineDefinition;
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
    });
    const dynamicCents = Math.max(1, preview.totalCents ?? pricing.totalCents);
    pricing = cloneBackgroundRemovalPricingWithDynamicTotal(pricing, dynamicCents, {
      surface: BACKGROUND_REMOVAL_SURFACE,
      billingProductKey: params.billingProductKey,
      providerEstimateUsd: preview.estimate?.providerEstimateUsd ?? null,
      dynamicMultiplier: BACKGROUND_REMOVAL_DYNAMIC_MARGIN_MULTIPLIER,
      videoMetadata: params.videoMetadata,
    });
    return {
      pricing,
      pricingEstimate: {
        durationSec: params.videoMetadata.durationSec,
        providerEstimateUsd: preview.estimate?.providerEstimateUsd ?? null,
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
