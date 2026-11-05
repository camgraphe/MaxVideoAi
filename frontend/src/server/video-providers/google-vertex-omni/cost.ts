import type { ProviderCostEstimate, ProviderCostInput } from '../types';
import {
  calculateGoogleOmniProviderCost,
  GOOGLE_OMNI_PRICING_SOURCE,
  type GoogleOmniPricingInput,
} from '@/lib/google-omni-pricing';
import { GOOGLE_VERTEX_OMNI_MODEL_ID } from './model-map';

function outputResolution(value: string | null | undefined): GoogleOmniPricingInput['outputResolution'] {
  return value === '360p' || value === '1080p' || value === '4k' ? value : '720p';
}

function inputImageCount(input: ProviderCostInput): number {
  if (typeof input.inputImageCount === 'number') return Math.max(0, Math.floor(input.inputImageCount));
  if (input.mode === 'i2v') return 1;
  if (input.mode === 'fl2v') return 2;
  return 0;
}

export function estimateGoogleVertexOmniCost(input: ProviderCostInput & { providerModel?: string | null }): ProviderCostEstimate {
  // New submissions default to the current model. Polling supplies the stored
  // model explicitly, including null when historical provenance is missing.
  const model = input.providerModel === undefined ? GOOGLE_VERTEX_OMNI_MODEL_ID : input.providerModel;
  const pricingVersion = model === GOOGLE_VERTEX_OMNI_MODEL_ID ? '1.2'
    : model === 'gemini-omni-1.1-flash-preview' ? '1.1' : null;
  const source = pricingVersion === '1.2' ? GOOGLE_OMNI_PRICING_SOURCE
    : pricingVersion === '1.1' ? 'google_omni_1_1_token_pricing' : 'google_omni_unknown_model';
  const inheritsOutputTiming = input.mode === 'v2v' || input.mode === 'retake';
  const seconds = Math.max(
    3,
    Math.min(10, inheritsOutputTiming ? input.durationSec : Math.round(input.durationSec))
  );
  if (!pricingVersion || ((input.mode === 'v2v' || input.mode === 'extend') && input.inputVideoDurationSec === undefined)) {
    return {
      providerCostUnits: seconds,
      providerCostUsd: null,
      source,
    };
  }
  const pricing = calculateGoogleOmniProviderCost({
    pricingVersion,
    outputResolution: outputResolution(input.resolution),
    outputDurationSec: seconds,
    inputImageCount: inputImageCount(input),
    inputVideoDurationSec: Math.max(0, input.inputVideoDurationSec ?? 0),
  });
  return {
    providerCostUnits: seconds,
    providerCostUsd: pricing.providerCostUsd,
    source,
  };
}
