import type { PricingContext } from '@/lib/pricing-context';
import { resolveSeedreamProviderSize, seedreamPricingInputCount, SEEDREAM_ASPECT_RATIO_VALUES } from './seedream';

/** Public direct ModelArk LIST, separate from account discounts and customer tariffs. */
export const SEEDREAM_NOVEMBER_LIST_SOURCE = {
  url: 'https://ai.byteplus.com/ark/region:ap-southeast-1/docs/model-pricing',
  checkedAt: '2026-11-13',
  currency: 'USD',
} as const;

export type SeedreamListModel = 'lite' | 'pro' | 'flash' | '5.5';
export type NewSeedreamEngineId = 'seedream-5-5' | 'seedream-5-0-flash';

export function isNewSeedreamEngineId(id: string): id is NewSeedreamEngineId {
  return id === 'seedream-5-5' || id === 'seedream-5-0-flash';
}

export function seedreamListModelForEngine(id: string): SeedreamListModel | null {
  return ({ seedream: 'lite', 'seedream-5-0-pro': 'pro', 'seedream-5-0-flash': 'flash',
    'seedream-5-5': '5.5' } as const)[id as 'seedream' | 'seedream-5-0-pro' | NewSeedreamEngineId] ?? null;
}

/** The 5.5 tier boundary is 1536² × 1.05²; it is distinct from Pro's 2.61M boundary. */
export function quoteNewSeedreamListCost(input: {
  model: 'flash' | '5.5'; outputPixels: number[]; inputImages: number;
}) {
  if (!Number.isSafeInteger(input.inputImages) || input.inputImages < 0 || input.inputImages > 10
    || input.outputPixels.length > 1 || input.outputPixels.some(pixels => !Number.isSafeInteger(pixels)
      || pixels < 921_600 || pixels > 4_624_220)) throw new Error('Invalid Seedream single-image usage.');
  const outputUsd = input.outputPixels.reduce((sum, pixels) => sum + (input.model === 'flash'
    ? 0.018 : pixels <= 2_601_123.84 ? 0.020 : 0.035), 0);
  const inputUsd = input.model === '5.5' && input.outputPixels.length ? input.inputImages * 0.008 : 0;
  return { outputUsd: Number(outputUsd.toFixed(6)), inputUsd: Number(inputUsd.toFixed(6)),
    totalUsd: Number((outputUsd + inputUsd).toFixed(6)), effectiveUsd: null,
    status: 'published_list' as const, source: SEEDREAM_NOVEMBER_LIST_SOURCE };
}

type SeedreamPricingContext = Pick<PricingContext, 'engine' | 'mode' | 'durationSec' | 'resolution'
  | 'aspectRatio' | 'inputImageCount' | 'referenceImageCount'>;

/** Exact supported new-model domain used by billing, public facts and tariff selectors. */
export function seedreamNewModelPricingUsage(context: SeedreamPricingContext, currency = 'USD') {
  const id = context.engine.id;
  const mode = context.mode ?? 't2i';
  const resolution = context.resolution.trim().toUpperCase();
  const aspectRatio = context.aspectRatio == null || context.aspectRatio === 'auto' ? '1:1' : context.aspectRatio;
  if (!isNewSeedreamEngineId(id) || currency !== 'USD' || !['t2i', 'i2i'].includes(mode)
    || context.durationSec !== 1 || !['1K', '1.5K', '2K'].includes(resolution)
    || !SEEDREAM_ASPECT_RATIO_VALUES.includes(aspectRatio as (typeof SEEDREAM_ASPECT_RATIO_VALUES)[number])
    || [context.inputImageCount, context.referenceImageCount].some(count => count !== undefined
      && (!Number.isSafeInteger(count) || count < 0))
    || (mode === 't2i' && ((context.inputImageCount ?? 0) !== 0 || (context.referenceImageCount ?? 0) !== 0))) {
    throw new Error('Unsupported Seedream single-image pricing scenario.');
  }
  const inputImages = seedreamPricingInputCount({ ...context, mode });
  const dimensions = /^(\d+)x(\d+)$/.exec(resolveSeedreamProviderSize(resolution, aspectRatio, id));
  if (!dimensions) throw new Error('Unsupported Seedream image resolution.');
  const outputPixels = Number(dimensions[1]) * Number(dimensions[2]);
  const list = quoteNewSeedreamListCost({ model: id === 'seedream-5-5' ? '5.5' : 'flash',
    inputImages, outputPixels: [outputPixels] });
  return { ...list, engineId: id, mode, resolution, inputImages, outputPixels,
    meta: { pricing_model: 'seedream_direct_list_2026_11_13',
      provider_cost_source: SEEDREAM_NOVEMBER_LIST_SOURCE.url, provider_cost_checked_at: SEEDREAM_NOVEMBER_LIST_SOURCE.checkedAt,
      effective_supplier_charge_verified: false, provider_input_image_count: inputImages,
      provider_output_pixels: outputPixels, provider_output_usd: list.outputUsd, provider_input_usd: list.inputUsd } };
}
