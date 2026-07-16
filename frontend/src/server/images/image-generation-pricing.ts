import { computeBillingProductSnapshot } from '@/lib/billing-products';
import { isLumaAgentsImageEngineId } from '@/lib/luma-agents';
import { computeCanonicalBillingSnapshot } from '@/server/pricing/quote-billing';
import type { TrustedQuotedBilling } from '@/server/generations/initial-job-reservation';
import type { BillingProductKey, JobSurface } from '@/types/billing';
import type { EngineCaps, PricingSnapshot } from '@/types/engines';
import type { GptImage2ImageSize } from '@/lib/image/gptImage2';
import type { ImageGenerationMode, ImageGenerationRequest } from '@/types/image-generation';
import { applyStoryboardImagePricing } from './storyboard-image-billing';

const DISPLAY_CURRENCY = 'USD';

export async function resolveImageGenerationPricingSnapshot(params: {
  engine: EngineCaps;
  mode: ImageGenerationMode;
  durationSec: number;
  resolution: string;
  customImageSize: GptImage2ImageSize | null;
  quality: string | null;
  combinedImageCount: number;
  enableWebSearch: boolean;
  numImages: number;
  billingProductKey: BillingProductKey | null;
  billingQuantityMultiplier: number;
  jobSurface: JobSurface;
  source: ImageGenerationRequest['source'] | undefined;
  metadata: ImageGenerationRequest['metadata'] | null;
  includedKlingFirstFrameParentJobId: string | null;
  resolvedAspectRatio: string | null;
  requestedMembershipTier: string | undefined;
  trustedQuotedBilling: TrustedQuotedBilling | undefined;
}): Promise<{ pricing: PricingSnapshot; membershipTier: string | undefined }> {
  const membershipTier = params.trustedQuotedBilling?.membershipTier ?? params.requestedMembershipTier;
  const referenceImageCount = isLumaAgentsImageEngineId(params.engine.id)
    ? params.mode === 'i2i'
      ? Math.max(0, params.combinedImageCount - 1)
      : params.combinedImageCount
    : undefined;
  let pricing = params.trustedQuotedBilling
    ? JSON.parse(JSON.stringify(params.trustedQuotedBilling.pricing)) as PricingSnapshot
    : params.billingProductKey
      ? await computeBillingProductSnapshot({
        productKey: params.billingProductKey,
        quantity: params.numImages * Math.max(1, Math.round(params.billingQuantityMultiplier)),
        membershipTier,
        engineId: params.engine.id,
        })
      : await computeCanonicalBillingSnapshot({
        engine: params.engine,
        durationSec: params.durationSec,
        resolution: params.resolution,
        mode: params.mode,
        customImageSize: params.customImageSize,
        quality: params.quality,
        referenceImageCount,
        membershipTier,
        currency: DISPLAY_CURRENCY,
        addons: params.enableWebSearch ? { enable_web_search: true } : undefined,
        });

  if (params.trustedQuotedBilling) {
    if (
      !Number.isSafeInteger(pricing.totalCents)
      || pricing.totalCents < 0
      || pricing.currency !== DISPLAY_CURRENCY
      || pricing.membershipTier !== params.trustedQuotedBilling.membershipTier
    ) {
      throw new Error('Invalid trusted quoted image billing.');
    }
    return { pricing, membershipTier };
  }

  pricing = await applyStoryboardImagePricing({
    pricing,
    engine: params.engine,
    jobSurface: params.jobSurface,
    source: params.source,
    metadata: params.metadata,
    includedKlingFirstFrameParentJobId: params.includedKlingFirstFrameParentJobId,
    customImageSize: params.customImageSize,
    resolution: params.resolution,
    quality: params.quality,
    resolvedAspectRatio: params.resolvedAspectRatio,
    membershipTier,
    currency: DISPLAY_CURRENCY,
  });
  return { pricing, membershipTier };
}
