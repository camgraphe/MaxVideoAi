import { WAN_3_PRIME_FAL_USD_PER_SECOND } from '@/lib/wan3-prime-fal-rates';
import { validateWan3PricingDuration } from '@/lib/wan3-pricing';
import { estimateAlibabaProviderCost } from './alibaba-model-studio/cost';
import { isAlibabaFalFallbackCompatible } from './alibaba-model-studio/model-map';
import type { VideoProviderKey } from './types';

import { rankQuotedOffers, type PurchaseLimits } from '@/lib/video-purchase-decision';

export type PurchaseRequest = {
  engineId: string;
  mode: string;
  durationSec: number;
  resolution: string;
  aspectRatio: string | null;
  images: number;
  hasVideo: boolean;
  inputVideoSeconds: number | null;
  hasAudioReference: boolean;
  hasDocument: boolean;
  hasEndFrame: boolean;
};
export type PurchaseOffer = {
  provider: VideoProviderKey;
  tariff: string;
  /** Declared in preference order for equal costs. All estimates are integer microdollars. */
  quote: (request: PurchaseRequest) => number | null;
  exclude: (request: PurchaseRequest) => string | null;
};
export function rankPurchaseOffers(
  request: PurchaseRequest,
  offers: readonly PurchaseOffer[],
  limits: PurchaseLimits
) {
  return rankQuotedOffers(
    offers.map((offer) => ({
      provider: offer.provider,
      tariff: offer.tariff,
      costMicros: offer.quote(request),
      excluded: offer.exclude(request),
    })),
    limits
  );
}

export const APIMART_PRIME_MICROS_PER_SECOND: Readonly<Record<string, number>> = {
  '480p': 51_430,
  '720p': 102_860,
  '1080p': 205_710,
};
function primeRequestIsPriced(r: PurchaseRequest) {
  return (
    r.engineId === 'wan-3-prime' &&
    Number.isInteger(r.durationSec) &&
    r.durationSec >= 2 &&
    r.durationSec <= 30 &&
    Object.hasOwn(APIMART_PRIME_MICROS_PER_SECOND, r.resolution.toLowerCase())
  );
}
function billableSeconds(r: PurchaseRequest) {
  if (!primeRequestIsPriced(r) || (r.hasVideo && (r.inputVideoSeconds === null || r.inputVideoSeconds <= 0)))
    return null;
  try {
    return validateWan3PricingDuration({
      mode: r.mode,
      durationSec: r.durationSec,
      inputVideoDurationSec: r.inputVideoSeconds ?? 0,
      hasVideoInput: r.hasVideo,
    }).billableDurationSec;
  } catch {
    return null;
  }
}
function listCost(r: PurchaseRequest) {
  if (billableSeconds(r) == null) return null;
  const { providerCostUsd } = estimateAlibabaProviderCost({
    ...r,
    inputVideoDurationSec: r.inputVideoSeconds ?? 0,
  });
  return providerCostUsd == null ? null : Math.round(providerCostUsd * 1_000_000);
}
export const WAN_PRIME_OFFERS: readonly PurchaseOffer[] = [
  { provider: 'alibaba_model_studio', tariff: 'Alibaba Singapore LIST', quote: listCost, exclude: () => null },
  {
    provider: 'fal',
    tariff: 'Fal Wan Prime LIST',
    quote: r => {
      const seconds = billableSeconds(r);
      const rates: Readonly<Record<string, number>> = WAN_3_PRIME_FAL_USD_PER_SECOND;
      return seconds == null ? null : Math.round(seconds * rates[r.resolution.toLowerCase()] * 1e6);
    },
    exclude: (r) =>
      isAlibabaFalFallbackCompatible(r.engineId, r.mode) && !r.hasDocument
        ? null
        : 'Direct-only inputs or operation',
  },
  {
    provider: 'apimart',
    tariff: 'APIMart Gold · 2026-11-27',
    quote: (r) =>
      primeRequestIsPriced(r) && !r.hasVideo
        ? r.durationSec * APIMART_PRIME_MICROS_PER_SECOND[r.resolution.toLowerCase()]
        : null,
    exclude: (r) => {
      if (r.hasVideo || r.hasAudioReference || r.hasDocument || r.hasEndFrame)
        return 'Media outside pilot coverage';
      if (
        r.aspectRatio &&
        !['adaptive', 'auto', '16:9', '9:16', '4:3', '3:4', '1:1', '21:9'].includes(r.aspectRatio)
      )
        return 'Aspect ratio outside pilot coverage';
      if (r.mode === 't2v' && r.images === 0) return null;
      if (r.mode === 'ref2v' && r.images === 1) return null;
      return 'Pilot covers text or one reference image';
    },
  },
];
export function planWanPrimePurchase(request: PurchaseRequest, limits?: Partial<PurchaseLimits>) {
  const baseline = listCost(request) ?? -1;
  const ceilingMicros = Math.min(limits?.ceilingMicros ?? baseline, baseline);
  const plan = rankPurchaseOffers(request, WAN_PRIME_OFFERS, { ...limits, ceilingMicros });
  const pilot = WAN_PRIME_OFFERS.find(offer => offer.provider === 'apimart')!;
  return { ...plan, canaryEligible: pilot.exclude(request) === null && pilot.quote(request) !== null };
}
