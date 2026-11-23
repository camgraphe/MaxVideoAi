import type { ManualTariffPrice, ManualTariffSelector } from '@maxvideoai/pricing';
import type { PricingContext } from '@/lib/pricing-context';
import {
  assertKlingImageV4OutputCount, assertKlingImageV4ReferenceCount, KLING_IMAGE_V4_ASPECT_RATIOS,
  KLING_IMAGE_V4_ID, KLING_IMAGE_V4_RESOLUTIONS,
} from './kling-image-v4';

export const KLING_IMAGE_V4_LIST_CHECKED_AT = '2026-11-23';

const outputListMilliUsd: Record<(typeof KLING_IMAGE_V4_RESOLUTIONS)[number], number> = {
  '2K': 63, '4K': 94, '8K': 157,
};
const referenceListMilliUsd = 3;

export function klingImageV4PricingUsage(context: Pick<PricingContext,
  'mode' | 'resolution' | 'durationSec' | 'inputImageCount' | 'aspectRatio'>) {
  const mode = context.mode;
  if (mode !== 't2i' && mode !== 'i2i') throw new Error('Unsupported Kling Image pricing mode.');
  const resolution = KLING_IMAGE_V4_RESOLUTIONS.find(value => value === context.resolution.toUpperCase());
  if (!resolution) throw new Error('Unsupported Kling Image resolution.');
  if (!KLING_IMAGE_V4_ASPECT_RATIOS.some(value => value === (context.aspectRatio ?? 'auto'))) {
    throw new Error('Unsupported Kling Image aspect ratio.');
  }
  const inputImages = context.inputImageCount ?? 0;
  const outputImages = context.durationSec;
  assertKlingImageV4ReferenceCount(mode, inputImages);
  assertKlingImageV4OutputCount(outputImages);
  return { mode, resolution, inputImages, outputImages };
}

export function klingImageV4SupplierCost(usage: ReturnType<typeof klingImageV4PricingUsage>) {
  const outputRate = outputListMilliUsd[usage.resolution];
  const cost = usage.outputImages * outputRate + usage.inputImages * referenceListMilliUsd;
  return { amountUsd: cost / 1000, exactCents: cost / 10, outputRateUsd: outputRate / 1000 };
}

export function klingImageV4ManualTariffScenario(context: PricingContext) {
  const { mode, resolution, inputImages, outputImages } = klingImageV4PricingUsage(context);
  return {
    selector: {
      engineId: KLING_IMAGE_V4_ID, mode, resolution, durationSec: String(outputImages),
      ...(mode === 'i2i' ? { inputImageCount: String(inputImages) } : {}),
    },
    quantities: { output_units: outputImages, input_images: inputImages },
  };
}

/** Six rate classes bound the validated output and input counts without a retail wildcard. */
export function klingImageV4QuantityTariffSelector(selector: ManualTariffSelector): ManualTariffSelector {
  if (Object.keys(selector).some(key => !['engineId', 'mode', 'resolution', 'durationSec', 'inputImageCount'].includes(key))
    || (selector.mode === 't2i' && selector.inputImageCount !== undefined)) {
    throw new Error('Unsupported Kling Image tariff identity.');
  }
  const usage = klingImageV4PricingUsage({
    mode: selector.mode as PricingContext['mode'], resolution: selector.resolution,
    durationSec: Number(selector.durationSec), inputImageCount: Number(selector.inputImageCount ?? 0),
  });
  return {
    engineId: KLING_IMAGE_V4_ID, mode: usage.mode, resolution: usage.resolution, durationSec: 'continuous',
    ...(usage.mode === 'i2i' ? { inputImageCount: 'continuous' } : {}),
  };
}

export function assertKlingImageV4QuantityPrice(selector: ManualTariffSelector, price: ManualTariffPrice): void {
  const required = selector.mode === 'i2i' ? ['output_units', 'input_images'] : ['output_units'];
  if (price.kind !== 'unit_terms' || price.rounding !== 'up' || price.terms.length !== required.length
    || new Set(price.terms.map(term => term.unit)).size !== required.length
    || price.terms.some(term => !required.includes(term.unit))
    || !price.terms.some(term => term.unit === 'output_units' && term.centsPerUnit > 0)) {
    throw new Error('Kling Image requires authored output rates and, for editing, a reference rate.');
  }
}
