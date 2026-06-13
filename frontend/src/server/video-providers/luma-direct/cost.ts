import type { ProviderCostEstimate, ProviderCostInput } from '../types';

const GENERATION_SDR_5S: Record<string, number> = {
  '540p': 0.15,
  '720p': 0.3,
  '1080p': 1.2,
};

const GENERATION_SDR_10S: Record<string, number> = {
  '540p': 0.45,
  '720p': 0.9,
  '1080p': 3.6,
};

const V2V_SDR_5S: Record<string, number> = {
  '540p': 0.72,
  '720p': 1.44,
  '1080p': 2.16,
};

const V2V_SDR_10S: Record<string, number> = {
  '540p': 1.08,
  '720p': 2.16,
  '1080p': 4.32,
};

const REFRAME_PER_SECOND: Record<string, number> = {
  '540p': 0.06,
  '720p': 0.12,
  '1080p': 0.36,
};

function resolutionKey(value: string | null | undefined): string {
  return value && value in GENERATION_SDR_5S ? value : '720p';
}

export function estimateLumaDirectCost(input: ProviderCostInput): ProviderCostEstimate {
  const resolution = resolutionKey(input.resolution);
  const duration = input.durationSec >= 10 ? 10 : 5;
  const table =
    input.mode === 'reframe'
      ? REFRAME_PER_SECOND
      : input.mode === 'v2v'
        ? duration >= 10
          ? V2V_SDR_10S
          : V2V_SDR_5S
        : duration >= 10
          ? GENERATION_SDR_10S
          : GENERATION_SDR_5S;
  const providerCostUsd =
    input.mode === 'reframe' ? (table[resolution] ?? table['720p']) * Math.max(1, input.durationSec) : table[resolution] ?? table['720p'];

  return {
    providerCostUnits: null,
    providerCostUsd,
    source: 'luma_ray_3_2_public_pricing_estimate',
  };
}
