import { resolveKlingDirectModelRoute } from './model-map';
import type { ProviderCostEstimate, ProviderCostInput } from '../types';

const KLING_UNIT_PRICE_USD = 0.14;

export function computeKlingDirectProviderCostUsd(units: number | null | undefined): number | null {
  if (typeof units !== 'number' || !Number.isFinite(units)) return null;
  return Number((units * KLING_UNIT_PRICE_USD).toFixed(6));
}

export function estimateKlingDirectCost(input: ProviderCostInput): ProviderCostEstimate {
  const route = resolveKlingDirectModelRoute(input.engineId);
  const duration = Math.max(0, Math.trunc(input.durationSec));
  let unitsPerSecond: number;
  if (route.mode === '4k') {
    unitsPerSecond = 3;
  } else if (input.mode === 'v2v' && route.endpointFamily === 'video-o3-omni') {
    unitsPerSecond = route.mode === 'pro' ? 1.2 : 0.9;
  } else if (route.mode === 'pro') {
    unitsPerSecond = input.audioEnabled === true ? 1.2 : 0.8;
  } else {
    unitsPerSecond = input.audioEnabled === true ? 0.9 : 0.6;
  }
  const providerCostUnits = Number((duration * unitsPerSecond).toFixed(6));
  return {
    providerCostUnits,
    providerCostUsd: computeKlingDirectProviderCostUsd(providerCostUnits),
    source: 'kling_visible_pricing_2026_05_14',
  };
}
