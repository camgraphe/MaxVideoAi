import { getFalEngineById } from '@/config/falEngines';
import { listRuntimeModels } from '@/config/model-runtime';
import type { PricingContext } from '@/lib/pricing-context';
import type { Mode, PricingSnapshot } from '@/types/engines';
import type { ManualTariffSelector } from '@maxvideoai/pricing';

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

type PricingDimension = {
  selector: ManualTariffSelector;
  context: Partial<PricingContext>;
};

function mediaDimensions(modelId: string, mode: string, durationSec: number): PricingDimension[] {
  if ((modelId === 'wan-3' || modelId === 'wan-3-prime') && (mode === 'v2v' || mode === 'extend')) {
    return Array.from({ length: Math.max(0, Math.min(15, 30 - durationSec)) }, (_, index) => {
      const inputVideoDurationSec = index + 1;
      return { selector: { inputVideoDurationSec: String(inputVideoDurationSec) }, context: { inputVideoDurationSec } };
    });
  }
  if (modelId === 'gemini-omni-flash' && ['v2v', 'extend', 'retake'].includes(mode)) {
    return [3, 10].map((inputVideoDurationSec) => ({
      selector: { inputVideoDurationSec: String(inputVideoDurationSec),
        ...(['v2v', 'retake'].includes(mode) ? { inheritedDurationSec: String(durationSec) } : {}) },
      context: { inputVideoDurationSec,
        ...(['v2v', 'retake'].includes(mode) ? { inheritedDurationSec: durationSec } : {}) },
    }));
  }
  if (modelId === 'minimax-h3-max' && mode === 'ref2v') {
    return [4096, 4097].map((referenceTokenBudget) => ({
      selector: { referenceTokenBudget: String(referenceTokenBudget) }, context: { referenceTokenBudget },
    }));
  }
  if ((modelId === 'ltx-2-5-fast' || modelId === 'ltx-2-5-pro') && mode === 'a2v') {
    return [{ selector: { inputAudioDurationSec: '9' }, context: { inputAudioDurationSec: 9 } }];
  }
  return [{ selector: {}, context: {} }];
}

/** Every finite catalog combination is captured; unresolved controls remain explicit gaps. */
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
      const durations = isImage
        ? { values: [1], incomplete: false }
        : finiteDurations(modeConfig.ui.duration, entry.engine.maxDurationSec, entry.pricingHint?.durationSeconds);
      if (durations.incomplete) gaps.push({ modelId: model.id, reason: `${mode}: nonnumeric auto or open duration requires a reviewed mapping` });
      const rawResolutions = modeConfig.ui.resolution?.length ? modeConfig.ui.resolution : entry.engine.resolutions;
      const resolutions = rawResolutions.filter((resolution) => resolution !== 'auto' && resolution !== 'custom');
      if (resolutions.length !== rawResolutions.length) gaps.push({ modelId: model.id, reason: `${mode}: auto/custom resolution requires a reviewed mapping` });
      const aspectRatios = modeConfig.ui.aspectRatio?.length ? modeConfig.ui.aspectRatio : entry.engine.aspectRatios;
      const aspects = aspectRatios.length ? aspectRatios.filter((aspect) => aspect !== 'auto') : ['default'];
      if (aspects.length !== aspectRatios.length) gaps.push({ modelId: model.id, reason: `${mode}: auto aspect ratio depends on verified media metadata` });
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
      if (mode === 'ref2v' || mode === 'r2v') {
        gaps.push({ modelId: model.id, reason: `${mode}: reference image count and metadata need a reviewed bound` });
      }
      const audioOptions: Array<boolean | null> = modeConfig.ui.audioToggle ? [false, true] : [null];
      const qualityField = [...(entry.engine.inputSchema?.required ?? []), ...(entry.engine.inputSchema?.optional ?? [])]
        .find((field) => field.id === 'quality' && (!field.modes || field.modes.includes(mode)));
      const qualities = qualityField?.values?.length ? qualityField.values : [null];
      if (qualityField && !qualityField.values?.length) gaps.push({ modelId: model.id, reason: `${mode}: freeform quality requires a reviewed mapping` });
      for (const durationSec of durations.values) for (const resolution of resolutions) for (const aspectRatio of aspects)
        for (const audio of audioOptions) for (const quality of qualities)
          for (const media of mediaDimensions(model.id, mode, durationSec)) {
          const selector: ManualTariffSelector = {
            engineId: entry.id, mode, resolution, durationSec: String(durationSec), aspectRatio,
            ...(audio == null ? {} : { audio: String(audio) }),
            ...(quality == null ? {} : { quality }),
            ...media.selector,
          };
          const context: PricingContext = {
            engine: entry.engine, mode: mode as Mode, durationSec, resolution,
            aspectRatio: aspectRatio === 'default' ? null : aspectRatio,
            ...(quality == null ? {} : { quality }),
            ...(audio == null ? {} : { addons: { audio, ...(!audio ? { audio_off: true } : {}) } }),
            hasVideoInput: ['v2v', 'extend', 'retake', 'reframe'].includes(mode),
            referenceImageCount: mode === 'ref2v' || mode === 'r2v' ? 1 : 0,
            inputImageCount: mode === 'i2v' || mode === 'i2i' ? 1 : 0,
            ...media.context,
          };
          scenarios.push({ id: selectorId(selector), modelId: model.id, selector, quantities: {}, context,
            capabilityKey: `${entry.id}:${mode}:${resolution}` });
        }
    }
  }
  return { scenarios, gaps };
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
