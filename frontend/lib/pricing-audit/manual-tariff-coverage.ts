import { getFalEngineById } from '@/config/falEngines';
import { listRuntimeModels } from '@/config/model-runtime';
import type { PricingContext } from '@/lib/pricing-context';
import type { Mode, PricingSnapshot } from '@/types/engines';
import type { ManualTariffSelector } from '@maxvideoai/pricing';
import { buildBillingPricingFacts } from '@/lib/pricing-billing-facts';
import { buildManualTariffScenario } from '@/lib/pricing-manual-scenario';
import { GPT_IMAGE_2_CANONICAL_SIZE_VALUES, isGptImageFamilyEngineId, parseGptImage2SizeKey, resolveGptImage2PricingTier } from '@/lib/image/gptImage2';
import { manualTariffImageOutputCounts, manualTariffLoopValues, manualTariffReferenceCounts } from './manual-tariff-dimensions';

export type ManualTariffCoverageScenario = {
  id: string;
  modelId: string;
  selector: ManualTariffSelector;
  quantities: Record<string, number>;
  context: PricingContext;
  capabilityKey: string;
};

export type ManualTariffCoverage = {
  scenarios: ManualTariffCoverageScenario[];
  gaps: Array<{ modelId: string; reason: string }>;
};

export type EffectiveCustomerTariffBaseline = {
  at: string;
  registryHash: string;
  databaseIdentity: string | null;
  rows: Array<{ scenarioId: string; customerCents: number; currency: string; policySource: string; ruleId: string }>;
  gaps: string[];
};

function numericDuration(value: number | string): number | null {
  const parsed = typeof value === 'number' ? value : Number(value.replace(/s$/i, ''));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function finiteDurations(
  duration: { options: Array<number | string>; default?: number | string } | { min: number; default: number } | undefined,
  maxDuration: number,
  fallback: number | undefined,
): { values: number[]; incomplete: boolean } {
  if (duration && 'options' in duration) {
    const values = [...new Set(duration.options.map(numericDuration).filter((value): value is number => value != null))];
    return { values, incomplete: values.length !== duration.options.length };
  }
  if (duration && 'min' in duration && Number.isInteger(duration.min) && Number.isInteger(maxDuration)
      && maxDuration >= duration.min && maxDuration - duration.min <= 60) {
    return { values: Array.from({ length: maxDuration - duration.min + 1 }, (_, index) => duration.min + index), incomplete: false };
  }
  const selected = numericDuration(fallback ?? maxDuration);
  return { values: selected ? [selected] : [], incomplete: true };
}

function selectorId(selector: ManualTariffSelector): string {
  return Object.entries(selector).map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('|');
}

/** Uses the same facts and exact dimensions as charging, including validated decimal media durations. */
export function buildManualTariffCoverageScenario(context: PricingContext, capabilityKey: string): ManualTariffCoverageScenario {
  const facts = buildBillingPricingFacts(context, context.engine.pricingDetails, 'USD').facts;
  const { selector, quantities } = buildManualTariffScenario(context, facts);
  return { id: selectorId(selector), modelId: context.engine.id, selector, quantities, context, capabilityKey };
}

type PricingDimension = {
  context: Partial<PricingContext>;
};

function mediaDimensions(modelId: string, mode: string, durationSec: number): PricingDimension[] {
  if ((modelId === 'wan-3' || modelId === 'wan-3-prime') && (mode === 'v2v' || mode === 'extend')) {
    return Array.from({ length: Math.max(0, Math.min(15, 30 - durationSec)) }, (_, index) => {
      const inputVideoDurationSec = index + 1;
      return { context: { inputVideoDurationSec } };
    });
  }
  if (modelId === 'gemini-omni-flash' && ['v2v', 'extend', 'retake'].includes(mode)) {
    return [3, 10].map((inputVideoDurationSec) => ({
      context: { inputVideoDurationSec,
        ...(['v2v', 'retake'].includes(mode) ? { inheritedDurationSec: durationSec } : {}) },
    }));
  }
  if (modelId === 'minimax-h3-max' && mode === 'ref2v') {
    return [4096, 4097].map((referenceTokenBudget) => ({
      context: { referenceTokenBudget },
    }));
  }
  if ((modelId === 'ltx-2-5-fast' || modelId === 'ltx-2-5-pro') && mode === 'a2v') {
    return [{ context: { inputAudioDurationSec: 9 } }];
  }
  return [{ context: {} }];
}

/** Reviewed finite catalog combinations are captured; unresolved controls remain explicit gaps. */
export function collectSellableManualTariffCoverage(): ManualTariffCoverage {
  const scenarios: ManualTariffCoverageScenario[] = [];
  const gaps: ManualTariffCoverage['gaps'] = [];
  for (const model of listRuntimeModels().filter((entry) => entry.publication.app.published)) {
    const entry = getFalEngineById(model.id);
    if (!entry) {
      gaps.push({ modelId: model.id, reason: 'No executable engine catalog entry' });
      continue;
    }
    for (const modeConfig of entry.modes) {
      const mode = modeConfig.mode;
      const isImage = entry.category === 'image';
      const gptImage = isImage && isGptImageFamilyEngineId(model.id);
      const outputs = isImage ? manualTariffImageOutputCounts(entry, mode) : null;
      const durations = isImage
        ? { values: outputs ?? [1], incomplete: !outputs }
        : finiteDurations(modeConfig.ui.duration, entry.engine.maxDurationSec, entry.pricingHint?.durationSeconds);
      if (durations.incomplete) gaps.push({ modelId: model.id, reason: `${mode}: nonnumeric auto or open duration requires a reviewed mapping` });
      const rawResolutions = modeConfig.ui.resolution?.length ? modeConfig.ui.resolution : entry.engine.resolutions;
      const resolutions = gptImage ? [...GPT_IMAGE_2_CANONICAL_SIZE_VALUES]
        : rawResolutions.filter((resolution) => resolution !== 'auto' && resolution !== 'custom');
      if (!gptImage && resolutions.length !== rawResolutions.length) gaps.push({ modelId: model.id, reason: `${mode}: auto/custom resolution requires a reviewed mapping` });
      const aspectRatios = modeConfig.ui.aspectRatio?.length ? modeConfig.ui.aspectRatio : entry.engine.aspectRatios;
      const aspects = gptImage ? ['default'] : aspectRatios.length ? [...aspectRatios] : ['default'];
      if ((model.id === 'wan-3' || model.id === 'wan-3-prime') && ['v2v', 'extend'].includes(mode)) {
        gaps.push({ modelId: model.id, reason: `${mode}: fractional input video duration needs a continuous unit tariff` });
      }
      if (model.id === 'gemini-omni-flash' && ['v2v', 'extend', 'retake'].includes(mode)) {
        gaps.push({ modelId: model.id, reason: `${mode}: open input video duration needs a continuous unit tariff` });
      }
      if (model.id === 'minimax-h3-max' && mode === 'ref2v') {
        gaps.push({ modelId: model.id, reason: `${mode}: unbounded reference token budget needs a continuous unit tariff` });
      }
      if ((model.id === 'ltx-2-5-fast' || model.id === 'ltx-2-5-pro') && mode === 'a2v') {
        gaps.push({ modelId: model.id, reason: `${mode}: open input audio duration needs a continuous unit tariff` });
      }
      const references = manualTariffReferenceCounts(entry, mode);
      if (!references.complete) {
        gaps.push({ modelId: model.id, reason: `${mode}: reference image count and metadata need a reviewed bound` });
      }
      if (model.id === 'luma-ray-3-2' && ['t2v', 'i2v', 'v2v'].includes(mode)) {
        gaps.push({ modelId: model.id, reason: `${mode}: HDR/EXR controls require reviewed generation-to-pricing projection` });
      }
      const audioOptions: Array<boolean | null> = modeConfig.ui.audioToggle ? [false, true] : [null];
      const fields = [...(entry.engine.inputSchema?.required ?? []), ...(entry.engine.inputSchema?.optional ?? [])];
      const resolutionField = fields.find(field => field.id === 'resolution' && (!field.modes || field.modes.includes(mode)));
      const defaultResolution = gptImage && typeof resolutionField?.default === 'string'
        && !['auto', 'custom'].includes(resolutionField.default) && rawResolutions.includes(resolutionField.default)
        ? resolutionField.default : null;
      const defaultSizeTier = defaultResolution ? resolveGptImage2PricingTier(defaultResolution).billingKey : null;
      const qualityField = fields
        .find((field) => field.id === 'quality' && (!field.modes || field.modes.includes(mode)));
      const qualities = qualityField?.values?.length ? qualityField.values : [null];
      if (qualityField && !qualityField.values?.length) gaps.push({ modelId: model.id, reason: `${mode}: freeform quality requires a reviewed mapping` });
      for (const durationSec of durations.values) for (const resolution of resolutions) for (const aspectRatio of aspects)
        for (const audio of audioOptions) for (const quality of qualities)
          for (const referenceImageCount of references.values) for (const loop of manualTariffLoopValues(entry, mode))
          for (const media of mediaDimensions(model.id, mode, durationSec)) {
          // A canonical identity must not erase the preset's current legacy policy.
          const requestedResolution = defaultSizeTier === resolution ? defaultResolution! : resolution;
          const context: PricingContext = {
            engine: entry.engine, mode: mode as Mode, durationSec, resolution: requestedResolution,
            aspectRatio: aspectRatio === 'default' ? null : aspectRatio,
            ...(quality == null ? {} : { quality }),
            ...(audio == null ? {} : { addons: { audio, ...(!audio ? { audio_off: true } : {}) } }),
            hasVideoInput: ['v2v', 'extend', 'retake', 'reframe'].includes(mode),
            ...(referenceImageCount === undefined ? {} : { referenceImageCount }),
            ...(loop === undefined ? {} : { loop }),
            ...(mode === 'i2v' ? { inputImageCount: 1 } : {}),
            ...(mode === 'fl2v' ? { inputImageCount: 2 } : {}),
            ...(mode === 'ref2v' ? { inputImageCount: referenceImageCount } : {}),
            ...(isImage && isGptImageFamilyEngineId(model.id)
              ? { customImageSize: parseGptImage2SizeKey(requestedResolution) } : {}),
            ...media.context,
          };
          scenarios.push(buildManualTariffCoverageScenario(context, `${entry.id}:${mode}:${resolution}`));
        }
    }
  }
  // Requested orientations are retained in quote context; only factual price dimensions author cells.
  const unique = new Map<string, ManualTariffCoverageScenario>();
  for (const scenario of scenarios) {
    const previous = unique.get(scenario.id);
    if (!previous || (previous.context.aspectRatio === 'auto' && scenario.context.aspectRatio !== 'auto')) unique.set(scenario.id, scenario);
  }
  return { scenarios: [...unique.values()], gaps };
}

export function collectSellableManualTariffScenarios(): ManualTariffCoverageScenario[] {
  return collectSellableManualTariffCoverage().scenarios;
}

export async function collectEffectiveCustomerTariffBaseline(input: {
  at: string;
  registryHash: string;
  databaseIdentity: string | null;
  scenarios: readonly ManualTariffCoverageScenario[];
  quote: (scenario: ManualTariffCoverageScenario) => Promise<PricingSnapshot>;
}): Promise<EffectiveCustomerTariffBaseline> {
  const rows: EffectiveCustomerTariffBaseline['rows'] = [];
  const gaps: string[] = [];
  for (const scenario of input.scenarios) {
    try {
      const snapshot = await input.quote(scenario);
      const provenance = snapshot.meta?.pricingPolicy as { source?: unknown; sourceRuleId?: unknown } | undefined;
      if (!Number.isSafeInteger(snapshot.totalCents) || snapshot.totalCents < 0 ||
          !snapshot.currency?.trim() ||
          (provenance?.source !== 'database' && provenance?.source !== 'versioned') ||
          typeof provenance.sourceRuleId !== 'string') {
        gaps.push(scenario.id);
        continue;
      }
      rows.push({ scenarioId: scenario.id, customerCents: snapshot.totalCents, currency: snapshot.currency,
        policySource: provenance.source, ruleId: provenance.sourceRuleId });
    } catch {
      gaps.push(scenario.id);
    }
  }
  return { at: input.at, registryHash: input.registryHash, databaseIdentity: input.databaseIdentity, rows, gaps };
}
