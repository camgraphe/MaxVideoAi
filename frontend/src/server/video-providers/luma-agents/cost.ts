import type { ProviderCostEstimate, ProviderCostInput } from '../types';

type Resolution = '540p' | '720p' | '1080p';
type Duration = '5s' | '10s';

const LUMA_AGENTS_RAY_32_DIRECT_PRICE_USD: Record<Resolution, Record<Duration, number>> = {
  '540p': { '5s': 0.15, '10s': 0.45 },
  '720p': { '5s': 0.3, '10s': 0.9 },
  '1080p': { '5s': 1.2, '10s': 3.6 },
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
  return {
    providerCostUnits: null,
    providerCostUsd: LUMA_AGENTS_RAY_32_DIRECT_PRICE_USD[resolution][duration],
    source: 'luma_agents_public_pricing_estimate',
  };
}
