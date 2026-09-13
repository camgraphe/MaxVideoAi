import type { ProviderCostEstimate, ProviderCostInput } from '../types';
import { resolveAlibabaModelRoute } from './model-map';

const SOURCE = 'alibaba_singapore_2026-09-12';

const RATES_BY_ENGINE: Record<string, Record<string, number>> = {
  'wan-3': { '480p': 0.05, '720p': 0.1, '1080p': 0.2 },
  'wan-3-prime': { '480p': 0.068, '720p': 0.14, '1080p': 0.28 },
  'happy-horse-1-1': { '480p': 0.07, '720p': 0.14, '1080p': 0.18 },
};

function roundUsd(value: number): number {
  return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
}

export function estimateAlibabaProviderCost(input: ProviderCostInput): ProviderCostEstimate {
  const mode = input.mode ?? 't2v';
  if (!resolveAlibabaModelRoute(input.engineId, mode)) {
    throw new Error(`${input.engineId}/${mode} is not mapped to Alibaba Model Studio.`);
  }

  const resolution = (input.resolution ?? '1080p').toLowerCase();
  const rate = RATES_BY_ENGINE[input.engineId]?.[resolution];
  if (rate === undefined) {
    throw new Error(`Unsupported Alibaba resolution: ${input.resolution ?? 'null'}.`);
  }

  const outputSeconds = Math.max(0, input.durationSec);
  const inputSeconds = input.engineId.startsWith('wan-3')
    ? Math.max(0, input.inputVideoDurationSec ?? 0)
    : 0;
  const billableSeconds = outputSeconds + inputSeconds;

  return {
    providerCostUnits: billableSeconds,
    providerCostUsd: roundUsd(billableSeconds * rate),
    source: SOURCE,
  };
}
