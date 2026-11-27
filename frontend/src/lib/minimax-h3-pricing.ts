export type MinimaxH3PricingInput = {
  durationSec: number;
  resolution: '480P' | '768P' | '2K' | '4K';
  referenceImageCount?: number;
};

export type MinimaxH3RateCard = {
  readonly perSecondUsd: Readonly<Record<MinimaxH3PricingInput['resolution'], number>>;
  readonly includedReferenceImages: number;
  readonly extraReferenceUsd: number;
};

export const MINIMAX_H3_FAL_RATES: MinimaxH3RateCard = {
  perSecondUsd: { '480P': 0.05, '768P': 0.06, '2K': 0.13, '4K': 0.16 },
  includedReferenceImages: 5,
  extraReferenceUsd: 0.08,
};

function roundUsd(value: number): number {
  return Number(value.toFixed(2));
}

export function calculateMinimaxH3ProviderPrice(input: MinimaxH3PricingInput, rates = MINIMAX_H3_FAL_RATES): {
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
  const ratePerSecondUsd = rates.perSecondUsd[input.resolution];
  if (typeof ratePerSecondUsd !== 'number') {
    throw new Error(`Unsupported MiniMax H3 resolution: ${input.resolution}`);
  }
  const referenceImageCount = Math.max(0, Math.floor(input.referenceImageCount ?? 0));
  const paidReferenceImages = Math.max(0, referenceImageCount - rates.includedReferenceImages);
  const baseSubtotalUsd = roundUsd(input.durationSec * ratePerSecondUsd);
  const referenceImageSurchargeUsd = roundUsd(paidReferenceImages * rates.extraReferenceUsd);
  const subtotalUsd = roundUsd(baseSubtotalUsd + referenceImageSurchargeUsd);

  return {
    subtotalUsd,
    breakdown: {
      durationSec: input.durationSec,
      resolution: input.resolution,
      ratePerSecondUsd,
      baseSubtotalUsd,
      referenceImageCount,
      includedReferenceImages: rates.includedReferenceImages,
      paidReferenceImages,
      referenceImageSurchargeUsd,
    },
  };
}
