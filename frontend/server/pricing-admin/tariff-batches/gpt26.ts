import type { ManualTariffPrice, ManualTariffSelector } from '@maxvideoai/pricing';
import { GPT_IMAGE_2_6_ENGINE_REGISTRY } from '@/config/fal-engines/gpt-image-2-6';
import { GPT_IMAGE_26_EXPLICIT_QUALITIES, GPT_IMAGE_26_QUALITIES } from '@/lib/image/gptImage26';
import { GPT_IMAGE_26_SIZE_LIMITS, validateGptImage26Dimensions } from '@/lib/image/gptImage26Dimensions';
import { estimateGptImage26OutputTokens } from '@/lib/image/gptImage26Pricing';
import { assertGptImage26RasterTariffPrice, gptImage26ContinuousTariffSelector, gptImage26TariffTokenUnit } from '@/lib/image/gptImage26Tariff';
import { buildManualTariffCoverageScenario } from '@/lib/pricing-audit/manual-tariff-coverage';
import { customerTariffCellId } from '@/server/pricing/customer-tariff-seed';
import type { GptImageTariffBatchModelId, TariffBatchProposal } from './contract';
import type { KlingBatchClass } from './kling';

const selectorKey = (selector: ManualTariffSelector) => JSON.stringify(Object.entries(selector).sort(([a], [b]) => a.localeCompare(b)));

/** A bounded authored inventory, never an enumeration of raster/customer cells. */
export function gpt26RasterBatchClasses(modelId: GptImageTariffBatchModelId): KlingBatchClass[] {
  const engine = GPT_IMAGE_2_6_ENGINE_REGISTRY.find(entry => entry.id === modelId)!.engine;
  return ['t2i', 'i2i'].flatMap(mode => ['custom', 'auto'].flatMap(resolution => GPT_IMAGE_26_QUALITIES.map(quality => {
    const scenario = buildManualTariffCoverageScenario({ engine, mode: mode as 't2i' | 'i2i', resolution,
      ...(resolution === 'custom' ? { customImageSize: { width: 800, height: 832 } } : {}), quality,
      durationSec: 1, referenceImageCount: mode === 'i2i' ? 1 : 0 }, `${modelId}:${mode}:raster:${resolution}:${quality}`);
    const selector = gptImage26ContinuousTariffSelector(scenario.selector)!;
    const key = selectorKey(selector);
    return { selector, key, scenario, id: customerTariffCellId(`gpt26-raster:${key}`) };
  }))).sort((a, b) => a.key.localeCompare(b.key));
}

/** Authoring-only approved recipe. Runtime quotes read literal stored amounts. */
export function gpt26RasterProposal(modelId: GptImageTariffBatchModelId): TariffBatchProposal {
  return { schemaVersion: 1, modelId, intent: 'create_missing', reason: 'GPT Image 2.6 raster extension; explicit input reserves, conservative auto-output estimates',
    pricing: { kind: 'explicit' }, selections: gpt26RasterBatchClasses(modelId).map(row => ({ selector: row.selector,
      price: { kind: 'unit_terms', rounding: 'up', terms: [
        { unit: gptImage26TariffTokenUnit(row.selector), centsPerUnit: 0.0045 },
        { unit: 'output_units', centsPerUnit: 1.5 }, { unit: 'reference_image_outputs', centsPerUnit: 3 },
      ] } })) };
}

type ExplicitQuality = typeof GPT_IMAGE_26_EXPLICIT_QUALITIES[number];
let envelope: { checkedDimensions: number; tokens: Record<ExplicitQuality, { min: number; max: number; autoBound: number }> } | undefined;
/** Exhaustive finite geometry check (no database/provider request or tariff creation). */
export function gpt26RasterEnvelope() {
  if (envelope) return structuredClone(envelope);
  const tokens = Object.fromEntries(GPT_IMAGE_26_EXPLICIT_QUALITIES.map(quality => [quality, { min: Infinity, max: 0,
    autoBound: estimateGptImage26OutputTokens({ width: 2880, height: 2880, quality }) }])) as Record<ExplicitQuality, { min: number; max: number; autoBound: number }>;
  let checkedDimensions = 0;
  const { multipleOf, maxEdge } = GPT_IMAGE_26_SIZE_LIMITS;
  for (let width = multipleOf; width <= maxEdge; width += multipleOf) for (let height = multipleOf; height <= maxEdge; height += multipleOf) {
    if (!validateGptImage26Dimensions({ width, height })) continue;
    checkedDimensions++;
    const maximumQualityTokens = estimateGptImage26OutputTokens({ width, height, quality: 'max' });
    for (const quality of GPT_IMAGE_26_EXPLICIT_QUALITIES) {
      const count = estimateGptImage26OutputTokens({ width, height, quality });
      const range = tokens[quality];
      range.min = Math.min(range.min, count); range.max = Math.max(range.max, count);
      if (count > range.autoBound) throw new Error('GPT Image 2.6 automatic output bound is invalid.');
      if (count > maximumQualityTokens) throw new Error('GPT Image 2.6 automatic quality bound is invalid.');
    }
  }
  envelope = { checkedDimensions, tokens };
  return structuredClone(envelope);
}

/** Nonnegative literal terms are affine: extrema prove the entire n/ref/token domain. */
export function validateGpt26RasterTariffDomain(selector: ManualTariffSelector, price: ManualTariffPrice) {
  assertGptImage26RasterTariffPrice(selector, price);
  const domain = gpt26RasterEnvelope();
  const quality = selector.quality === 'auto' ? 'max' : selector.quality as ExplicitQuality;
  const range = domain.tokens[quality];
  if (!range) throw new Error('Unsupported GPT Image 2.6 tariff quality.');
  const minTokens = selector.resolution === 'auto' ? range.autoBound : range.min;
  const maxTokens = selector.resolution === 'auto' ? range.autoBound : range.max;
  const rates = Object.fromEntries(price.terms.map(term => [term.unit, term.centsPerUnit]));
  const delta = rates[gptImage26TariffTokenUnit(selector)] - 0.003;
  const minRefs = selector.mode === 'i2i' ? 1 : 0;
  const minimumPerOutput = delta * (delta < 0 ? maxTokens : minTokens) + rates.output_units + rates.reference_image_outputs * minRefs;
  if (minimumPerOutput < -1e-9) throw new Error('Raster price falls below the published output-only estimate within the valid domain.');
  return { checkedDimensions: domain.checkedDimensions, minTokensPerOutput: minTokens, maxTokensPerOutput: maxTokens,
    maxOutputCount: 10, maxReferenceCount: selector.mode === 'i2i' ? 16 : 0,
    minimumOutputOnlySurplusCents: minimumPerOutput, supplierCostIncomplete: true as const,
    conservativeOutput: selector.resolution === 'auto' || selector.quality === 'auto' };
}
