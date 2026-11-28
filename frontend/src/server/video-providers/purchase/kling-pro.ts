import { estimateKlingDirectCost } from '../kling-direct/cost';
import type { PurchaseOffer, PurchaseRequest } from './types';

function klingCoverage(r: PurchaseRequest): string | null {
  if (
    !Number.isInteger(r.durationSec) ||
    r.durationSec < 3 ||
    r.durationSec > 15 ||
    r.resolution.toLowerCase() !== '1080p' ||
    typeof r.audioEnabled !== 'boolean'
  ) {
    return 'Kling estimate requires 3–15 s in 1080p and an explicit audio setting';
  }
  if (r.aspectRatio && !['16:9', '9:16', '1:1'].includes(r.aspectRatio))
    return 'Aspect ratio outside reviewed scenarios';
  if (r.hasVideo || r.hasAudioReference || r.hasDocument || r.hasEndFrame || r.hasUnpricedOptions) {
    return 'Options outside reviewed Kling pricing';
  }
  if (
    r.engineId === 'kling-3-pro' &&
    ((r.mode === 't2v' && r.images === 0) || (r.mode === 'i2v' && r.images === 1))
  )
    return null;
  if (
    r.engineId === 'kling-o3-pro' &&
    r.mode === 'ref2v' &&
    Number.isInteger(r.images) &&
    r.images >= 1 &&
    r.images <= 4
  )
    return null;
  return 'Mode or media outside reviewed Kling pricing';
}

export const KLING_PRO_OFFERS: readonly PurchaseOffer[] = [
  {
    provider: 'kling_direct',
    tariff: 'Kling Direct · internal unit estimate',
    exclude: klingCoverage,
    quote: (r) => {
      if (klingCoverage(r)) return null;
      const usd = estimateKlingDirectCost(r).providerCostUsd;
      return usd == null ? null : Math.round(usd * 1e6);
    },
  },
  {
    provider: 'fal',
    terminal: true,
    tariff: 'Fal Kling Pro · endpoint LIST · 2026-11-27',
    exclude: (r) => klingCoverage(r) ?? (r.requiresDirectControls ? 'Controls require Kling Direct' : null),
    quote: (r) => {
      if (klingCoverage(r) || r.requiresDirectControls) return null;
      // O3 Pro reference-to-video has its own audio-on price. V3 text/image share a separate rate.
      const rate = !r.audioEnabled ? 112_000 : r.engineId === 'kling-o3-pro' ? 140_000 : 168_000;
      return r.durationSec * rate;
    },
  },
];
