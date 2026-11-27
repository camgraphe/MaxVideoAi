import { MINIMAX_H3_ASPECT_RATIOS, MINIMAX_H3_RESOLUTIONS } from '@/config/fal-engines/minimax-h3';
import { calculateMinimaxH3ProviderPrice } from '@/lib/minimax-h3-pricing';
import { getBytePlusVideoListRate } from '@/server/byteplus-list-tariff';
import type { PurchaseOffer, PurchaseRequest } from './types';

// Only the text and image-only profiles reviewed in the admin comparison.
function simpleMedia(r: PurchaseRequest, maxImages: number) {
  if (r.hasVideo || r.hasAudioReference || r.hasDocument || r.hasEndFrame || r.hasUnpricedOptions
    || r.requiresDirectControls || !Number.isInteger(r.images)) return false;
  if (r.mode === 'i2v') return r.hasStartFrame === true && r.images === 1;
  if (r.hasStartFrame) return false;
  return (r.mode === 't2v' && r.images === 0) || (r.mode === 'ref2v' && r.images > 0 && r.images <= maxImages);
}

export const H3_FAL_OFFER: PurchaseOffer = {
  provider: 'fal',
  tariff: 'Fal MiniMax H3 · endpoint LIST',
  terminal: true,
  exclude: (r) => simpleMedia(r, 9) ? null : 'Outside reviewed H3 media profiles',
  quote: (r) => {
    const resolution = MINIMAX_H3_RESOLUTIONS.find((value) => value === r.resolution.toUpperCase());
    if (!resolution || !MINIMAX_H3_ASPECT_RATIOS.some((value) => value === r.aspectRatio)
      || !Number.isInteger(r.durationSec) || r.durationSec < 5 || r.durationSec > 15) return null;
    const { subtotalUsd } = calculateMinimaxH3ProviderPrice({ resolution, durationSec: r.durationSec, referenceImageCount: r.images });
    return Math.round(subtotalUsd * 1e6);
  },
};

export const SEEDANCE_25_BYTEPLUS_OFFER: PurchaseOffer = {
  provider: 'byteplus_modelark',
  tariff: 'BytePlus LIST · observed generation tokens',
  exclude: (r) => simpleMedia(r, 9) ? null : 'Outside reviewed Seedance media profiles',
  quote: (r) => {
    const tokens = r.observedVideoTokens;
    if (tokens == null || !Number.isSafeInteger(tokens) || tokens <= 0
      || !['480p', '720p', '1080p'].includes(r.resolution) || !Number.isInteger(r.durationSec)
      || r.durationSec < 4 || r.durationSec > 30) return null;
    const rate = getBytePlusVideoListRate({ profile: 'seedance25', resolution: r.resolution, billingInputType: 'no_video_input' });
    return Math.round(tokens * rate.unitPriceUsdPer1kTokens * 1000);
  },
};
