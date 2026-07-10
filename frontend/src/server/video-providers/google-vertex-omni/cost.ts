import type { ProviderCostEstimate, ProviderCostInput } from '../types';

const GOOGLE_VERTEX_OMNI_VIDEO_OUTPUT_USD_PER_SECOND = 0.1;

export function estimateGoogleVertexOmniCost(input: ProviderCostInput): ProviderCostEstimate {
  const seconds = Math.max(1, input.durationSec);
  return {
    providerCostUnits: seconds,
    providerCostUsd: Number((seconds * GOOGLE_VERTEX_OMNI_VIDEO_OUTPUT_USD_PER_SECOND).toFixed(6)),
    source: 'google_vertex_omni_public_video_pricing_estimate',
  };
}
