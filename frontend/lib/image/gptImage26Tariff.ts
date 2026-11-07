import type { ManualTariffPrice, ManualTariffSelector } from '@maxvideoai/pricing';
import { GPT_IMAGE_26_QUALITIES, isGptImage26EngineId } from './gptImage26';
import { gptImage26PixelSize } from './gptImage26Dimensions';
import { gptImage26OutputPricingUsage, type GptImage26PricingInput } from './gptImage26Pricing';

/** Exact selectors preserve the launch grid; custom and preset pixels share an identity. */
export function gptImage26ManualTariffScenario(engineId: string, input: GptImage26PricingInput) {
  const usage = gptImage26OutputPricingUsage(input);
  return { selector: { engineId, mode: input.mode!,
    resolution: usage.requestedSize ? `${usage.requestedSize.width}x${usage.requestedSize.height}` : 'auto',
    durationSec: String(usage.settings.numImages), quality: usage.settings.quality,
    ...(input.mode === 'i2i' ? { referenceImageCount: String(usage.refs) } : {}) },
  quantities: { [usage.conservative ? 'conservative_output_image_tokens' : 'output_image_tokens']: usage.outputTokens,
    output_units: usage.settings.numImages, reference_image_outputs: usage.referenceImageOutputs,
    reference_images: usage.refs } };
}

/** Selected-state readers fetch this single alternative after the exact identity. */
export function gptImage26ContinuousTariffSelector(selector: ManualTariffSelector): ManualTariffSelector | null {
  if (!isGptImage26EngineId(selector.engineId)) return null;
  const count = Number(selector.durationSec), refs = Number(selector.referenceImageCount ?? 0);
  if (Object.keys(selector).some(key => !['engineId', 'mode', 'resolution', 'durationSec', 'quality', 'referenceImageCount'].includes(key))
    || !['t2i', 'i2i'].includes(selector.mode) || !GPT_IMAGE_26_QUALITIES.some(q => q === selector.quality)
    || !Number.isSafeInteger(count) || count < 1 || count > 10 || !Number.isSafeInteger(refs)
    || refs < (selector.mode === 'i2i' ? 1 : 0) || refs > (selector.mode === 'i2i' ? 16 : 0)
    || (selector.mode === 't2i' && selector.referenceImageCount !== undefined)) throw new Error('Unsupported GPT Image 2.6 tariff identity.');
  gptImage26PixelSize(selector.resolution);
  return { ...selector, resolution: selector.resolution === 'auto' ? 'auto' : 'continuous', durationSec: 'continuous',
    ...(selector.mode === 'i2i' ? { referenceImageCount: 'continuous' } : {}) };
}

export function gptImage26TariffTokenUnit(selector: ManualTariffSelector) {
  return selector.resolution === 'auto' || selector.quality === 'auto' ? 'conservative_output_image_tokens' : 'output_image_tokens';
}

/** Runtime validates literal authored units, never computes a retail rate from supplier cost. */
export function assertGptImage26RasterTariffPrice(selector: ManualTariffSelector, price: ManualTariffPrice): asserts price is Extract<ManualTariffPrice, {kind: 'unit_terms'}> {
  const units = [gptImage26TariffTokenUnit(selector), 'output_units', 'reference_image_outputs'];
  if (price.kind !== 'unit_terms' || price.rounding !== 'up' || price.terms.length !== units.length
    || new Set(price.terms.map(term => term.unit)).size !== units.length
    || price.terms.some(term => !units.includes(term.unit) || !Number.isFinite(term.centsPerUnit) || term.centsPerUnit < 0)) {
    throw new Error('GPT Image 2.6 raster pricing requires exact authored output-token, output and reference-output units.');
  }
}
