import type { ProviderCostEstimate, ProviderCostInput } from '../types';

type Resolution = '720p' | '1080p' | '4k';

const GOOGLE_VERTEX_VEO_PRICE_USD_PER_SECOND: Record<
  string,
  {
    audio: Partial<Record<Resolution, number>>;
    video: Partial<Record<Resolution, number>>;
  }
> = {
  'veo-3-1': {
    audio: { '720p': 0.4, '1080p': 0.4, '4k': 0.6 },
    video: { '720p': 0.2, '1080p': 0.2, '4k': 0.4 },
  },
  'veo-3-1-fast': {
    audio: { '720p': 0.1, '1080p': 0.12, '4k': 0.3 },
    video: { '720p': 0.08, '1080p': 0.1, '4k': 0.25 },
  },
  'veo-3-1-lite': {
    audio: { '720p': 0.05, '1080p': 0.08 },
    video: { '720p': 0.03, '1080p': 0.05 },
  },
};

function normalizeResolution(resolution: string | null | undefined): Resolution {
  return resolution === '4k' || resolution === '1080p' || resolution === '720p' ? resolution : '720p';
}

export function estimateGoogleVertexVeoCost(input: ProviderCostInput): ProviderCostEstimate {
  const resolution = normalizeResolution(input.resolution);
  const priceTable = GOOGLE_VERTEX_VEO_PRICE_USD_PER_SECOND[input.engineId];
  const audioEnabled = input.audioEnabled !== false;
  const pricePerSecond =
    (audioEnabled ? priceTable?.audio[resolution] : priceTable?.video[resolution]) ??
    priceTable?.audio['720p'] ??
    priceTable?.video['720p'] ??
    null;

  return {
    providerCostUnits: null,
    providerCostUsd:
      typeof pricePerSecond === 'number'
        ? Number((Math.max(1, input.durationSec) * pricePerSecond).toFixed(6))
        : null,
    source: 'google_vertex_veo_public_pricing_estimate',
  };
}

