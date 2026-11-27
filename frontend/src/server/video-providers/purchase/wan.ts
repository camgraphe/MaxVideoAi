import { WAN_3_PRIME_FAL_USD_PER_SECOND } from '@/lib/wan3-prime-fal-rates';
import { wanImageMode } from '../apimart/wan-image-mode';
import { isWan3EngineId, validateWan3PricingDuration } from '@/lib/wan3-pricing';
import { estimateAlibabaProviderCost } from '../alibaba-model-studio/cost';
import { isAlibabaFalFallbackCompatible } from '../alibaba-model-studio/model-map';
import type { PurchaseOffer, PurchaseRequest } from './types';

export const APIMART_PRIME_MICROS_PER_SECOND: Readonly<Record<string, number>> = {
  '480p': 51_430,
  '720p': 102_860,
  '1080p': 205_710,
};
const STANDARD_GOLD_MICROS: Readonly<Record<string, number>> = { '480p': 32_880, '720p': 65_750, '1080p': 131_500 };
const STANDARD_FAL_USD: Readonly<Record<string, number>> = { '480p': 0.05, '720p': 0.1, '1080p': 0.2 };

function requestIsPriced(r: PurchaseRequest) {
  return (
    isWan3EngineId(r.engineId) &&
    Number.isInteger(r.durationSec) &&
    r.durationSec >= 2 &&
    r.durationSec <= 30 &&
    Object.hasOwn(APIMART_PRIME_MICROS_PER_SECOND, r.resolution.toLowerCase())
  );
}
function billableSeconds(r: PurchaseRequest) {
  if (!requestIsPriced(r) || (r.hasVideo && (r.inputVideoSeconds === null || r.inputVideoSeconds <= 0)))
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
// Both installed-supplier pilots and the optional APIMart transport share these reviewed input roles.
function wanPilotExclusion(r: PurchaseRequest): string | null {
  if (r.hasVideo || r.hasAudioReference || r.hasDocument || r.hasUnpricedOptions)
    return 'Media or options outside pilot coverage';
  if (r.aspectRatio && !['adaptive', 'auto', '16:9', '9:16', '4:3', '3:4', '1:1'].includes(r.aspectRatio))
    return 'Aspect ratio outside pilot coverage';
  return wanImageMode(r.mode, r.images, r.hasStartFrame === true, r.hasEndFrame)
    ? null : 'Unsupported combination of frames and references';
}

export function isReviewedWanPilotRequest(request: PurchaseRequest): boolean {
  return requestIsPriced(request) && wanPilotExclusion(request) === null;
}

export const WAN_OFFERS: readonly PurchaseOffer[] = [
  { provider: 'alibaba_model_studio', tariff: 'Alibaba Singapore LIST', quote: listCost, exclude: () => null },
  {
    provider: 'fal',
    terminal: true,
    tariff: 'Fal Wan LIST',
    quote: r => {
      const seconds = billableSeconds(r);
      const rates: Readonly<Record<string, number>> = r.engineId === 'wan-3' ? STANDARD_FAL_USD : WAN_3_PRIME_FAL_USD_PER_SECOND;
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
    quote: (r) => {
      const rates = r.engineId === 'wan-3' ? STANDARD_GOLD_MICROS : APIMART_PRIME_MICROS_PER_SECOND;
      return requestIsPriced(r) && !r.hasVideo ? r.durationSec * rates[r.resolution.toLowerCase()] : null;
    },
    exclude: wanPilotExclusion,
  },
];
