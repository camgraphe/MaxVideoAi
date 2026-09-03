import type { ProviderCostEstimate, ProviderCostInput } from '../types';
import {
  calculateGoogleOmniProviderCost,
  GOOGLE_OMNI_PRICING_SOURCE,
  type GoogleOmniPricingInput,
} from '@/lib/google-omni-pricing';

function outputResolution(value: string | null | undefined): GoogleOmniPricingInput['outputResolution'] {
  return value === '360p' || value === '1080p' || value === '4k' ? value : '720p';
}

function inputImageCount(input: ProviderCostInput): number {
  if (typeof input.inputImageCount === 'number') return Math.max(0, Math.floor(input.inputImageCount));
  if (input.mode === 'i2v') return 1;
  if (input.mode === 'fl2v') return 2;
  return 0;
}

export function estimateGoogleVertexOmniCost(input: ProviderCostInput): ProviderCostEstimate {
  const seconds = Math.max(3, Math.min(10, Math.round(input.durationSec)));
  if ((input.mode === 'v2v' || input.mode === 'extend') && input.inputVideoDurationSec === undefined) {
    return {
      providerCostUnits: seconds,
      providerCostUsd: null,
      source: GOOGLE_OMNI_PRICING_SOURCE,
    };
  }
  const pricing = calculateGoogleOmniProviderCost({
    outputResolution: outputResolution(input.resolution),
    outputDurationSec: seconds,
    inputImageCount: inputImageCount(input),
    inputVideoDurationSec: Math.max(0, input.inputVideoDurationSec ?? 0),
  });
  return {
    providerCostUnits: seconds,
    providerCostUsd: pricing.providerCostUsd,
    source: GOOGLE_OMNI_PRICING_SOURCE,
  };
}
