import type { MinimaxH3MaxMode, MinimaxH3MaxResolution } from '@/lib/minimax-h3-max';

export type MinimaxH3MaxPricingInput = {
  mode: MinimaxH3MaxMode;
  durationSec: number;
  resolution: MinimaxH3MaxResolution;
  verifiedReferenceTokenCount?: number;
};

export type MinimaxH3MaxProviderCost = {
  mode: MinimaxH3MaxMode;
  durationSec: number;
  resolution: MinimaxH3MaxResolution;
  ratePerSecondUsd: number;
  outputSubtotalUsd: number;
  verifiedReferenceTokenCount: number;
  includedReferenceTokenCount: number;
  excessReferenceTokenCount: number;
  referenceTokenSubtotalUsd: number;
  providerCostUsd: number;
  providerCostExactCents: number;
  providerCostCents: number;
};

export const MINIMAX_H3_MAX_NORMAL_RATE_PER_SECOND_USD = {
  '480P': 0.05,
  '768P': 0.08,
} as const;
export const MINIMAX_H3_MAX_REFERENCE_RATE_PER_SECOND_USD = 0.08;
export const MINIMAX_H3_MAX_INCLUDED_REFERENCE_TOKENS = 4_096;
export const MINIMAX_H3_MAX_REFERENCE_USD_PER_1K_TOKENS = 0.02;
export const MINIMAX_H3_MAX_PRICING_SOURCE = 'minimax_h3_max_documented_pricing';

function precise(value: number, decimals = 8): number {
  return Number(value.toFixed(decimals));
}

export function calculateMinimaxH3MaxProviderCost(
  input: MinimaxH3MaxPricingInput,
): MinimaxH3MaxProviderCost {
  if (input.mode !== 't2v' && input.mode !== 'i2v' && input.mode !== 'ref2v') {
    throw new Error(`Unsupported MiniMax H3 Max mode: ${String(input.mode)}`);
  }
  if (!Number.isInteger(input.durationSec) || input.durationSec < 5 || input.durationSec > 15) {
    throw new Error('MiniMax H3 Max duration must be an integer from 5 through 15 seconds.');
  }
  if (input.resolution !== '480P' && input.resolution !== '768P') {
    throw new Error('MiniMax H3 Max resolution must be 480P or 768P.');
  }
  if (input.mode === 'ref2v' && (
    typeof input.verifiedReferenceTokenCount !== 'number'
    || !Number.isInteger(input.verifiedReferenceTokenCount)
    || input.verifiedReferenceTokenCount < 0
  )) {
    throw new Error('MiniMax H3 Max exact reference pricing requires a trusted reference token count.');
  }
  if (input.mode !== 'ref2v' && input.verifiedReferenceTokenCount !== undefined) {
    throw new Error('MiniMax H3 Max reference token count is only valid for reference-to-video pricing.');
  }

  const ratePerSecondUsd = input.mode === 'ref2v'
    ? MINIMAX_H3_MAX_REFERENCE_RATE_PER_SECOND_USD
    : MINIMAX_H3_MAX_NORMAL_RATE_PER_SECOND_USD[input.resolution];
  const verifiedReferenceTokenCount = input.mode === 'ref2v'
    ? input.verifiedReferenceTokenCount!
    : 0;
  const excessReferenceTokenCount = Math.max(
    0,
    verifiedReferenceTokenCount - MINIMAX_H3_MAX_INCLUDED_REFERENCE_TOKENS,
  );
  const outputSubtotalUsd = precise(ratePerSecondUsd * input.durationSec);
  const referenceTokenSubtotalUsd = precise(
    excessReferenceTokenCount * MINIMAX_H3_MAX_REFERENCE_USD_PER_1K_TOKENS / 1_000,
  );
  const providerCostUsd = precise(outputSubtotalUsd + referenceTokenSubtotalUsd);
  const providerCostExactCents = precise(providerCostUsd * 100, 6);

  return {
    mode: input.mode,
    durationSec: input.durationSec,
    resolution: input.resolution,
    ratePerSecondUsd,
    outputSubtotalUsd,
    verifiedReferenceTokenCount,
    includedReferenceTokenCount: MINIMAX_H3_MAX_INCLUDED_REFERENCE_TOKENS,
    excessReferenceTokenCount,
    referenceTokenSubtotalUsd,
    providerCostUsd,
    providerCostExactCents,
    providerCostCents: Math.round(providerCostExactCents),
  };
}

export function calculateMinimaxH3MaxProviderCostCents(input: MinimaxH3MaxPricingInput): number {
  return calculateMinimaxH3MaxProviderCost(input).providerCostCents;
}
