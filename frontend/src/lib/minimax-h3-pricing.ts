export type MinimaxH3PricingInput = {
  durationSec: number;
  resolution: '768P' | '2K' | '4K';
  referenceImageCount?: number;
};

const RATE_PER_SECOND_USD: Record<MinimaxH3PricingInput['resolution'], number> = {
  '768P': 0.08,
  '2K': 0.13,
  '4K': 0.16,
};

const INCLUDED_REFERENCE_IMAGES = 5;
const REFERENCE_IMAGE_SURCHARGE_USD = 0.08;

function roundUsd(value: number): number {
  return Number(value.toFixed(2));
}

export function calculateMinimaxH3ProviderPrice(input: MinimaxH3PricingInput): {
  subtotalUsd: number;
  breakdown: {
    durationSec: number;
    resolution: string;
    ratePerSecondUsd: number;
    baseSubtotalUsd: number;
    referenceImageCount: number;
    includedReferenceImages: number;
    paidReferenceImages: number;
    referenceImageSurchargeUsd: number;
  };
} {
  if (!Number.isInteger(input.durationSec) || input.durationSec < 5 || input.durationSec > 15) {
    throw new Error('MiniMax H3 duration must be an integer from 5 through 15 seconds.');
  }
  const ratePerSecondUsd = RATE_PER_SECOND_USD[input.resolution];
  if (typeof ratePerSecondUsd !== 'number') {
    throw new Error(`Unsupported MiniMax H3 resolution: ${input.resolution}`);
  }
  const referenceImageCount = Math.max(0, Math.floor(input.referenceImageCount ?? 0));
  const paidReferenceImages = Math.max(0, referenceImageCount - INCLUDED_REFERENCE_IMAGES);
  const baseSubtotalUsd = roundUsd(input.durationSec * ratePerSecondUsd);
  const referenceImageSurchargeUsd = roundUsd(paidReferenceImages * REFERENCE_IMAGE_SURCHARGE_USD);
  const subtotalUsd = roundUsd(baseSubtotalUsd + referenceImageSurchargeUsd);

  return {
    subtotalUsd,
    breakdown: {
      durationSec: input.durationSec,
      resolution: input.resolution,
      ratePerSecondUsd,
      baseSubtotalUsd,
      referenceImageCount,
      includedReferenceImages: INCLUDED_REFERENCE_IMAGES,
      paidReferenceImages,
      referenceImageSurchargeUsd,
    },
  };
}
