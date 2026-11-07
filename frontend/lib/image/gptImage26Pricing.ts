import { normalizeGptImage26Settings, type GptImage26Settings } from './gptImage26';
import { gptImage26PixelSize, validateGptImage26Dimensions, type GptImage26Dimensions } from './gptImage26Dimensions';

export const GPT_IMAGE_26_PRICING_SOURCE = 'https://developers.openai.com/api/docs/guides/image-generation#calculating-costs';
/** Official 2.6 calculator, checked 2026-11-05. This is output only, not a request invoice. */
export function estimateGptImage26OutputTokens(input: { width: number; height: number; quality: GptImage26Settings['quality'] }): number {
  if (!validateGptImage26Dimensions(input)) throw new Error('Unsupported GPT Image 2.6 output dimensions.');
  if (input.quality === 'auto') throw new Error('Explicit GPT Image 2.6 quality is required.');
  const longGrid = ({ low: 16, medium: 24, high: 48, xhigh: 64, max: 96 } as const)[input.quality];
  if (!longGrid) throw new Error('Explicit GPT Image 2.6 quality is required.');
  const shorter = longGrid / (Math.max(input.width, input.height) / Math.min(input.width, input.height));
  const floor = Math.floor(shorter);
  const shortGrid = shorter - floor === 0.5 ? floor + floor % 2 : Math.round(shorter);
  const rendered = Math.ceil(longGrid * shortGrid * (2_000_000 + input.width * input.height) / 4_000_000);
  return Math.round(rendered * ({ low: 4.2, medium: 3.3, high: 1, xhigh: 1, max: 1 } as const)[input.quality]);
}

export type GptImage26PricingInput = { mode?: string; resolution: string; durationSec: number; quality?: string | null;
  complexity?: string | null; referenceImageCount?: number; customImageSize?: GptImage26Dimensions | null };

/** Factual output quantities only. Automatic settings retain their actual provider values. */
export function gptImage26OutputPricingUsage(input: GptImage26PricingInput) {
  const settings = normalizeGptImage26Settings({ resolution: input.resolution, numImages: input.durationSec,
    quality: input.quality ?? undefined, complexity: input.complexity ?? undefined,
    customImageSize: input.customImageSize ?? undefined } as Parameters<typeof normalizeGptImage26Settings>[0]);
  const refs = input.referenceImageCount ?? 0;
  if (!['t2i', 'i2i'].includes(input.mode ?? '') || !Number.isInteger(refs)
    || refs < (input.mode === 'i2i' ? 1 : 0) || refs > (input.mode === 'i2i' ? 16 : 0)) {
    throw new Error('Verified GPT Image 2.6 mode and reference count are required.');
  }
  const requestedSize = gptImage26PixelSize(settings.resolution, settings.customImageSize);
  const conservative = !requestedSize || settings.quality === 'auto';
  // At fixed quality the calculator is bounded by the largest valid square:
  // both pixel area and short grid are maximal at 2880². This bounds output only.
  const pricingSize = requestedSize ?? { width: 2880, height: 2880 };
  const pricingQuality = settings.quality === 'auto' ? 'max' : settings.quality;
  const tokensPerOutput = estimateGptImage26OutputTokens({ ...pricingSize, quality: pricingQuality });
  return { settings, refs, requestedSize, pricingSize, pricingQuality, conservative, tokensPerOutput,
    outputTokens: tokensPerOutput * settings.numImages, referenceImageOutputs: refs * settings.numImages };
}

export function calculateGptImage26ListOutputComponents(input: GptImage26PricingInput, currency: string) {
  if (currency !== 'USD' || !['t2i', 'i2i'].includes(input.mode ?? '')) throw new Error('Unsupported GPT Image 2.6 pricing currency or mode.');
  const usage = gptImage26OutputPricingUsage(input);
  const partialListUsd = usage.outputTokens * 30 / 1_000_000;
  return { partialListUsd, meta: {
    providerCostKind: usage.conservative ? 'conservative-list-output-bound' : 'partial-list-output-components', providerCostIncomplete: true,
    providerListImageComponentsUsd: partialListUsd, providerInvoiceCostUsd: null,
    providerOutputImageTokens: usage.conservative ? null : usage.outputTokens,
    ...(usage.conservative ? { providerConservativeOutputImageTokens: usage.outputTokens,
      providerOutputEstimateBasis: { size: usage.pricingSize, quality: usage.pricingQuality },
      providerOutputEstimateIsBound: true } : {}),
    providerInputImageTokens: null, providerInputTextTokens: null,
    providerBudgetStatus: 'unqualified_supplier_input_cost', providerCostSource: GPT_IMAGE_26_PRICING_SOURCE,
    providerRatesCheckedAt: '2026-11-05', effective_supplier_charge_verified: false,
    reference_image_count: usage.refs, quality: usage.settings.quality,
  } };
}
