import type { TimelineExportEstimateInput, TimelineExportPriceEstimate, TimelineExportQuota } from './contracts';

export const MAX_FREE_TIMELINE_SERVER_EXPORTS = 2;

const QUALITY_CENTS_PER_SECOND = {
  draft: 2,
  standard: 4,
  high: 7,
} as const;

function resolutionMultiplier(resolution: string | null | undefined): number {
  const normalized = String(resolution ?? '').toLowerCase();
  if (normalized.includes('2160') || normalized.includes('4k')) return 3;
  if (normalized.includes('1080')) return 1.5;
  return 1;
}

function fpsMultiplier(fps: number | null | undefined): number {
  if (!fps || fps <= 30) return 1;
  if (fps <= 60) return 1.35;
  return 1.6;
}

export function resolveTimelineExportQuota(params: { usedFreeExports: number }): TimelineExportQuota {
  const usedFreeExports = Math.max(0, Math.min(MAX_FREE_TIMELINE_SERVER_EXPORTS, params.usedFreeExports));
  const freeExportsRemaining = Math.max(0, MAX_FREE_TIMELINE_SERVER_EXPORTS - usedFreeExports);
  return {
    freeLimit: MAX_FREE_TIMELINE_SERVER_EXPORTS,
    usedFreeExports,
    freeExportsRemaining,
    billingKind: freeExportsRemaining > 0 ? 'free' : 'paid',
  };
}

export function estimateTimelineExportPrice(input: TimelineExportEstimateInput): TimelineExportPriceEstimate {
  const unitCentsPerSecond = QUALITY_CENTS_PER_SECOND[input.qualityPreset];
  const multiplier = resolutionMultiplier(input.resolution) * fpsMultiplier(input.fps);
  const durationSec = Math.max(1, Math.ceil(input.durationSec));
  const paidAmountCents = Math.max(15, Math.round(durationSec * unitCentsPerSecond * multiplier));
  const billingKind = input.freeExportsRemaining > 0 ? 'free' : 'paid';
  return {
    billingKind,
    amountCents: billingKind === 'free' ? 0 : paidAmountCents,
    currency: 'USD',
    freeExportsRemaining: input.freeExportsRemaining,
    unitCentsPerSecond,
    multiplier,
  };
}
