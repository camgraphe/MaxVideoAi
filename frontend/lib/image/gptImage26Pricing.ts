import { normalizeGptImage26Settings, type GptImage26Settings } from './gptImage26';
import { validateGptImage2CustomImageSize } from './gptImage2';

export const GPT_IMAGE_26_PRICING_SOURCE = 'https://developers.openai.com/api/docs/guides/image-generation#calculating-costs';
/** Official 2.6 calculator, checked 2026-11-05. This is output only, not a request invoice. */
export function estimateGptImage26OutputTokens(input: { width: number; height: number; quality: GptImage26Settings['quality'] }): number {
  const validated = validateGptImage2CustomImageSize({ width: input.width, height: input.height });
  if (!validated.ok) throw new Error('Unsupported GPT Image 2.6 output dimensions.');
  const longGrid = ({ low: 16, medium: 24, high: 48, xhigh: 64, max: 96 } as const)[input.quality];
  if (!longGrid) throw new Error('Explicit GPT Image 2.6 quality is required.');
  const shorter = longGrid / (Math.max(input.width, input.height) / Math.min(input.width, input.height));
  const floor = Math.floor(shorter);
  const shortGrid = shorter - floor === 0.5 ? floor + floor % 2 : Math.round(shorter);
  const rendered = Math.ceil(longGrid * shortGrid * (2_000_000 + input.width * input.height) / 4_000_000);
  return Math.round(rendered * ({ low: 4.2, medium: 3.3, high: 1, xhigh: 1, max: 1 } as const)[input.quality]);
}

export function calculateGptImage26ListOutputComponents(input: { mode?: string; resolution: string; durationSec: number; quality?: string | null; complexity?: string | null; referenceImageCount?: number }, currency: string) {
  if (currency !== 'USD' || !['t2i', 'i2i'].includes(input.mode ?? '')) throw new Error('Unsupported GPT Image 2.6 pricing currency or mode.');
  const settings = normalizeGptImage26Settings({ resolution: input.resolution, numImages: input.durationSec, quality: input.quality ?? undefined, complexity: input.complexity ?? undefined } as Parameters<typeof normalizeGptImage26Settings>[0]);
  const refs = input.referenceImageCount ?? 0;
  if (!Number.isInteger(refs) || refs < (input.mode === 'i2i' ? 1 : 0) || refs > (input.mode === 'i2i' ? 16 : 0)) throw new Error('Verified GPT Image 2.6 reference count is required.');
  const [width, height] = settings.resolution.split('x').map(Number);
  const tokens = estimateGptImage26OutputTokens({ width, height, quality: settings.quality });
  const partialListUsd = tokens * settings.numImages * 30 / 1_000_000;
  return { partialListUsd, meta: {
    providerCostKind: 'partial-list-output-components', providerCostIncomplete: true,
    providerListImageComponentsUsd: partialListUsd, providerInvoiceCostUsd: null,
    providerOutputImageTokens: tokens * settings.numImages, providerInputImageTokens: null, providerInputTextTokens: null,
    providerBudgetStatus: 'unqualified_supplier_input_cost', providerCostSource: GPT_IMAGE_26_PRICING_SOURCE,
    providerRatesCheckedAt: '2026-11-05', effective_supplier_charge_verified: false,
    reference_image_count: refs, quality: settings.quality,
  } };
}
