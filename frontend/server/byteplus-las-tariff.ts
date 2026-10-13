import { resolveBytePlusTransport } from '@/server/video-providers/byteplus-modelark-transport';

/** LAS Enhanced supplier facts; ModelArk token tariffs and contracts are independent. */
export const BYTEPLUS_LAS_LIST_PRICE_SOURCE = {
  url: 'https://docs.byteplus.com/en/docs/byteplus_las/video_gen_enhanced',
  checkedAt: '2026-10-13',
  currency: 'USD',
} as const;

const ENHANCED_UNIT_PRICE_USD_PER_SECOND = 0.303;
const SEEDANCE25_VIDEO_INPUT_COEFFICIENTS = { '480p': 0.406, '720p': 0.9125 } as const;

export function isSeedance25EditInputPricing(engineId: string, mode: string | null | undefined): boolean {
  return engineId === 'seedance-2-5' && mode === 'v2v';
}

export function isSeedance25LasInputPricing(engineId: string, mode: string | null | undefined): boolean {
  return isSeedance25EditInputPricing(engineId, mode) && resolveBytePlusTransport(engineId, mode) === 'las';
}

/** Every source-video second is billed, with no ModelArk token minimum. */
export function quoteSeedance25LasListCost(input: {
  resolution: string; outputDurationSec: number; inputVideoDurationSec?: number;
}) {
  if (!Object.hasOwn(SEEDANCE25_VIDEO_INPUT_COEFFICIENTS, input.resolution)
    || !Number.isFinite(input.outputDurationSec) || input.outputDurationSec < 4 || input.outputDurationSec > 30
    || !Number.isFinite(input.inputVideoDurationSec) || !input.inputVideoDurationSec
    || input.inputVideoDurationSec < 0 || input.inputVideoDurationSec > 30) return null;
  const coefficient = SEEDANCE25_VIDEO_INPUT_COEFFICIENTS[input.resolution as keyof typeof SEEDANCE25_VIDEO_INPUT_COEFFICIENTS];
  const billableDurationSec = input.outputDurationSec + input.inputVideoDurationSec;
  const unitPriceUsdPerSecond = ENHANCED_UNIT_PRICE_USD_PER_SECOND * coefficient;
  return { amountUsd: Number((billableDurationSec * unitPriceUsdPerSecond).toFixed(9)),
    unitPriceUsdPer1kTokens: null, unitPriceUsdPerSecond, enhancedUnitPriceUsdPerSecond: ENHANCED_UNIT_PRICE_USD_PER_SECOND,
    coefficient, billableDurationSec, outputDurationSec: input.outputDurationSec,
    inputVideoDurationSec: input.inputVideoDurationSec,
    sourceUrl: BYTEPLUS_LAS_LIST_PRICE_SOURCE.url, checkedAt: BYTEPLUS_LAS_LIST_PRICE_SOURCE.checkedAt };
}
