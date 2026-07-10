import type { AspectRatio, EnginePricingDetails, Resolution, TokenVideoPricingDimensions } from '@/types/engines';

const DEFAULT_ASPECT_RATIO: AspectRatio = '16:9';
const EPSILON = 1e-9;

export type Seedance2TokenQuote = {
  aspectRatio: AspectRatio;
  width: number;
  height: number;
  frameRate: number;
  tokenCount: number;
  unitPriceUsdPer1kTokens: number;
  vendorCostUsd: number;
  vendorCostPerSecondUsd: number;
  billingInputType?: Seedance2BillingInputType;
  pricingSource?: string;
};

export type Seedance2BillingInputType = 'no_video_input' | 'video_input';

function normalizeResolution(
  dimensions: Partial<Record<Resolution, Partial<Record<AspectRatio, TokenVideoPricingDimensions>>>>,
  resolution: string
): Resolution | null {
  const candidate = resolution.trim() as Resolution;
  return dimensions[candidate] ? candidate : null;
}

function normalizeAspectRatio(
  dimensions: Partial<Record<AspectRatio, TokenVideoPricingDimensions>>,
  aspectRatio?: string | null,
  fallback?: AspectRatio
): AspectRatio {
  const candidate = typeof aspectRatio === 'string' ? aspectRatio.trim() : '';
  if (candidate && candidate in dimensions) {
    return candidate as AspectRatio;
  }
  if (fallback && fallback in dimensions) {
    return fallback;
  }
  if (DEFAULT_ASPECT_RATIO in dimensions) {
    return DEFAULT_ASPECT_RATIO;
  }
  return (Object.keys(dimensions)[0] as AspectRatio | undefined) ?? DEFAULT_ASPECT_RATIO;
}

export function isSeedance2TokenPricing(
  details?: EnginePricingDetails | null
): details is EnginePricingDetails & { tokenPricing: NonNullable<EnginePricingDetails['tokenPricing']> } {
  return details?.tokenPricing?.model === 'byteplus_tokens' || details?.tokenPricing?.model === 'fal_tokens';
}

export function resolveSeedance2Dimensions(
  details: EnginePricingDetails & { tokenPricing: NonNullable<EnginePricingDetails['tokenPricing']> },
  resolution: string,
  aspectRatio?: string | null
): { resolution: Resolution; aspectRatio: AspectRatio; width: number; height: number } {
  const normalizedResolution = normalizeResolution(details.tokenPricing.dimensions, resolution);
  if (!normalizedResolution) {
    throw new Error(`Unsupported Seedance 2 resolution: ${resolution}`);
  }
  const dimensionMap = details.tokenPricing.dimensions[normalizedResolution];
  if (!dimensionMap) {
    throw new Error(`Missing Seedance 2 dimensions for resolution: ${normalizedResolution}`);
  }
  const resolvedAspectRatio = normalizeAspectRatio(
    dimensionMap,
    aspectRatio,
    details.tokenPricing.defaultAspectRatio ?? DEFAULT_ASPECT_RATIO
  );
  const resolvedDimensions = dimensionMap[resolvedAspectRatio];
  if (!resolvedDimensions) {
    throw new Error(`Missing Seedance 2 dimensions for ${normalizedResolution} ${resolvedAspectRatio}`);
  }
  return {
    resolution: normalizedResolution,
    aspectRatio: resolvedAspectRatio,
    width: resolvedDimensions.width,
    height: resolvedDimensions.height,
  };
}

export function resolveSeedance2UnitPriceUsdPer1kTokens(params: {
  tokenPricing: NonNullable<EnginePricingDetails['tokenPricing']>;
  resolution: Resolution;
  billingInputType?: Seedance2BillingInputType;
}): number {
  const resolutionInputPrice =
    params.billingInputType &&
    params.tokenPricing.unitPriceUsdPer1kTokensByResolutionAndInputType?.[params.resolution]?.[
      params.billingInputType
    ];
  if (typeof resolutionInputPrice === 'number' && Number.isFinite(resolutionInputPrice)) {
    return resolutionInputPrice;
  }

  const resolutionPrice = params.tokenPricing.unitPriceUsdPer1kTokensByResolution?.[params.resolution];
  if (typeof resolutionPrice === 'number' && Number.isFinite(resolutionPrice)) {
    return resolutionPrice;
  }

  const inputSpecificPrice =
    params.billingInputType && params.tokenPricing.unitPriceUsdPer1kTokensByInputType?.[params.billingInputType];
  if (typeof inputSpecificPrice === 'number' && Number.isFinite(inputSpecificPrice)) {
    return inputSpecificPrice;
  }

  return params.tokenPricing.unitPriceUsdPer1kTokens;
}

export function computeSeedance2TokenQuote(params: {
  details: EnginePricingDetails & { tokenPricing: NonNullable<EnginePricingDetails['tokenPricing']> };
  durationSec: number;
  resolution: string;
  aspectRatio?: string | null;
  billingInputType?: Seedance2BillingInputType;
}): Seedance2TokenQuote {
  const durationSec = Math.max(1, Math.round(params.durationSec));
  const { resolution, aspectRatio, width, height } = resolveSeedance2Dimensions(
    params.details,
    params.resolution,
    params.aspectRatio
  );
  const frameRate = params.details.tokenPricing.framesPerSecond;
  const tokenCount = (width * height * durationSec * frameRate) / 1024;
  const unitPriceUsdPer1kTokens = resolveSeedance2UnitPriceUsdPer1kTokens({
    tokenPricing: params.details.tokenPricing,
    resolution,
    billingInputType: params.billingInputType,
  });
  const vendorCostUsd = (tokenCount * unitPriceUsdPer1kTokens) / 1000;
  const vendorCostPerSecondUsd = durationSec > 0 ? vendorCostUsd / durationSec : vendorCostUsd;

  return {
    aspectRatio,
    width,
    height,
    frameRate,
    tokenCount,
    unitPriceUsdPer1kTokens,
    vendorCostUsd: Number((vendorCostUsd + EPSILON).toFixed(6)),
    vendorCostPerSecondUsd: Number((vendorCostPerSecondUsd + EPSILON).toFixed(6)),
    billingInputType: params.billingInputType,
    pricingSource: params.details.tokenPricing.pricingSource,
  };
}

export function roundUsdUpToCents(amountUsd: number): number {
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) return 0;
  return Math.max(0, Math.ceil(amountUsd * 100 - EPSILON));
}
