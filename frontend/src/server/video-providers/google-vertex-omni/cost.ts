import type { ProviderCostEstimate, ProviderCostInput } from '../types';

export function estimateGoogleVertexOmniCost({}: ProviderCostInput): ProviderCostEstimate {
  return {
    providerCostUnits: null,
    providerCostUsd: null,
    source: 'google_vertex_omni_preview_unpriced',
  };
}
