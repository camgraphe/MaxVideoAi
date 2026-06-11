import type { ProviderCostEstimate, ProviderCostInput } from '../types';

type Resolution = '540p' | '720p' | '1080p';
type Duration = '5s' | '10s';

const LUMA_AGENTS_RAY_32_GENERATION_PRICE_USD: Record<Resolution, Record<Duration, number>> = {
  '540p': { '5s': 0.15, '10s': 0.45 },
  '720p': { '5s': 0.3, '10s': 0.9 },
  '1080p': { '5s': 1.2, '10s': 3.6 },
};

const LUMA_AGENTS_RAY_32_EDIT_PRICE_USD: Record<Resolution, Record<Duration, number>> = {
  '540p': { '5s': 0.72, '10s': 1.44 },
  '720p': { '5s': 1.08, '10s': 2.16 },
  '1080p': { '5s': 2.16, '10s': 4.32 },
};

const LUMA_AGENTS_RAY_32_REFRAME_PRICE_USD_PER_SECOND: Record<Resolution, number> = {
  '540p': 0.06,
  '720p': 0.12,
  '1080p': 0.36,
};

function normalizeResolution(value: string | null | undefined): Resolution {
  return value === '540p' || value === '1080p' || value === '720p' ? value : '720p';
}

function normalizeDuration(durationSec: number): Duration {
  return Math.trunc(durationSec) === 10 ? '10s' : '5s';
}

export function estimateLumaAgentsVideoCost(input: ProviderCostInput): ProviderCostEstimate {
  const resolution = normalizeResolution(input.resolution);
  const duration = normalizeDuration(input.durationSec);
  if (input.mode === 'v2v') {
    return {
      providerCostUnits: null,
      providerCostUsd: LUMA_AGENTS_RAY_32_EDIT_PRICE_USD[resolution][duration],
      source: 'luma_agents_video_edit_public_pricing_estimate',
    };
  }
  if (input.mode === 'reframe') {
    const seconds = Math.max(1, input.durationSec);
    return {
      providerCostUnits: seconds,
      providerCostUsd: Number((LUMA_AGENTS_RAY_32_REFRAME_PRICE_USD_PER_SECOND[resolution] * seconds).toFixed(4)),
      source: 'luma_agents_video_reframe_public_pricing_estimate',
    };
  }
  return {
    providerCostUnits: null,
    providerCostUsd: LUMA_AGENTS_RAY_32_GENERATION_PRICE_USD[resolution][duration],
    source: 'luma_agents_public_pricing_estimate',
  };
}
