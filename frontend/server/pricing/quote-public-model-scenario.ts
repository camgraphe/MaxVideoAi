import { createHash } from 'node:crypto';

import type { PricingSnapshot } from '@maxvideoai/pricing';

import { getFalEngineById } from '@/config/falEngines';
import { getRuntimeModelById } from '@/config/model-runtime';
import { loadPricingPolicyOverrides, type PricingPolicyOverrideLoadResult } from '@/lib/pricing-rule-store';
import { collectSellableManualTariffCoverage, type ManualTariffCoverageScenario } from '@/lib/pricing-audit/manual-tariff-coverage';
import type { PublicModelQuote, PublicModelQuoteInput } from '@/lib/pricing-public-model-contract';
import { isLumaAgentsImageEngineId } from '@/lib/luma-agents';
import { isGptImageFamilyEngineId } from '@/lib/image/gptImage2';
import { resolvePublicGptImageQuoteSize } from '@/lib/image/gpt-image-quote-size';
import { supportsWan3TariffInputDuration, withWan3TariffInputDuration } from '@/lib/pricing-audit/wan3-tariff-scenario';

import { computeCanonicalPublicSnapshot } from './quote-public';

export async function quoteWithVerifiedPolicy(
  scenario: ManualTariffCoverageScenario,
  loadOverrides: () => Promise<PricingPolicyOverrideLoadResult> = loadPricingPolicyOverrides,
): Promise<PricingSnapshot> {
  const policy = await loadOverrides();
  if (policy.status !== 'loaded') throw new Error('CURRENT_PRICING_POLICY_UNAVAILABLE');
  return computeCanonicalPublicSnapshot(scenario.context, {
    pricingPolicy: { loadOverrides: async () => policy },
  });
}

let coverageByModel: Map<string, ManualTariffCoverageScenario[]> | null = null;

function supportedScenarios(modelId: string): readonly ManualTariffCoverageScenario[] {
  if (!coverageByModel) {
    coverageByModel = new Map();
    for (const scenario of collectSellableManualTariffCoverage().scenarios) {
      const bucket = coverageByModel.get(scenario.modelId) ?? [];
      bucket.push(scenario);
      coverageByModel.set(scenario.modelId, bucket);
    }
  }
  return coverageByModel.get(modelId) ?? [];
}

function catalogDefault(modelId: string, mode: string, fieldId: string): string | undefined {
  const engine = getFalEngineById(modelId)?.engine;
  const field = [...(engine?.inputSchema?.required ?? []), ...(engine?.inputSchema?.optional ?? [])]
    .find((candidate) => candidate.id === fieldId && (!candidate.modes || candidate.modes.some((value) => value === mode)));
  return typeof field?.default === 'string' ? field.default : undefined;
}

/** Public quoting accepts only catalog-supported exact scenarios and public model identities. */
export function resolvePublicModelScenario(input: PublicModelQuoteInput): ManualTariffCoverageScenario | null {
  const model = getRuntimeModelById(input.modelId);
  if (!model || !model.publication.app.published ||
      !(model.publication.pricing.published || model.publication.model.published) ||
      !Number.isInteger(input.durationSec) || input.durationSec < 1 || input.durationSec > 120 ||
      !input.mode || !input.resolution || (input.quantity ?? 1) !== 1) return null;
  if (input.referenceImageCount !== undefined && (!Number.isSafeInteger(input.referenceImageCount)
    || input.referenceImageCount < 0 || input.referenceImageCount > 32)) return null;
  const defaultReferences = isLumaAgentsImageEngineId(model.id) ? 0 : 1;
  const gptImage = isGptImageFamilyEngineId(model.id);
  const entry = getFalEngineById(model.id);
  const mode = entry?.modes.find(candidate => candidate.mode === input.mode);
  if (!mode || (!gptImage && input.customImageSize !== undefined)) return null;
  const size = gptImage ? resolvePublicGptImageQuoteSize(input.resolution, input.customImageSize) : null;
  if (gptImage && (!size || !(mode.ui.resolution ?? entry!.engine.resolutions)
      .some(value => value.toLowerCase() === input.resolution.toLowerCase()) ||
      (input.aspectRatio !== undefined && !(mode.ui.aspectRatio ?? entry!.engine.aspectRatios).includes(input.aspectRatio)))) return null;
  const resolution = size?.billingKey ?? input.resolution;
  const wanInputDuration = supportsWan3TariffInputDuration(model.id, input.mode);
  if (wanInputDuration && (typeof input.inputVideoDurationSec !== 'number'
    || !Number.isFinite(input.inputVideoDurationSec) || input.inputVideoDurationSec <= 0)) return null;
  const candidates = supportedScenarios(model.id).filter((scenario) =>
    scenario.selector.mode === input.mode &&
    scenario.selector.resolution.toLowerCase() === resolution.toLowerCase() &&
    scenario.selector.durationSec === String(input.durationSec) &&
    (scenario.context.referenceImageCount === undefined
      ? input.referenceImageCount === undefined || input.referenceImageCount === 1
      : scenario.context.referenceImageCount === (input.referenceImageCount ?? defaultReferences)) &&
    !scenario.context.loop &&
    (input.audio === undefined || scenario.selector.audio === undefined ||
      scenario.selector.audio === String(input.audio)) &&
    (gptImage || input.aspectRatio === undefined || scenario.selector.aspectRatio === input.aspectRatio) &&
    (input.quality === undefined || scenario.selector.quality === input.quality) &&
    (wanInputDuration || input.inputVideoDurationSec === undefined || scenario.selector.inputVideoDurationSec === String(input.inputVideoDurationSec)) &&
    (input.inputAudioDurationSec === undefined || scenario.selector.inputAudioDurationSec === String(input.inputAudioDurationSec)) &&
    (input.referenceTokenBudget === undefined || scenario.selector.referenceTokenBudget === String(input.referenceTokenBudget))
  );
  if (!candidates.length) return null;
  if (candidates.some((scenario) =>
    (scenario.selector.inputVideoDurationSec && input.inputVideoDurationSec === undefined) ||
    (scenario.selector.inputAudioDurationSec && input.inputAudioDurationSec === undefined) ||
    (scenario.selector.referenceTokenBudget && input.referenceTokenBudget === undefined))) return null;
  const defaultAspect = catalogDefault(model.id, input.mode, 'aspect_ratio') ?? '16:9';
  const defaultQuality = catalogDefault(model.id, input.mode, 'quality');
  const selected = candidates.sort((left, right) => {
    const score = (scenario: ManualTariffCoverageScenario) =>
      (input.aspectRatio === undefined && scenario.selector.aspectRatio !== defaultAspect ? 4 : 0) +
      (input.quality === undefined && defaultQuality && scenario.selector.quality !== defaultQuality ? 2 : 0) +
      (input.audio === undefined && scenario.selector.audio === 'true' ? 1 : 0);
    return score(left) - score(right) || left.id.localeCompare(right.id);
  })[0] ?? null;
  if (selected && wanInputDuration) {
    try { return withWan3TariffInputDuration(selected, input.inputVideoDurationSec!); }
    catch { return null; }
  }
  if (!selected || !size) return selected;
  return { ...selected, context: { ...selected.context, resolution: input.resolution,
    customImageSize: size.customImageSize, ...(input.aspectRatio !== undefined ? { aspectRatio: input.aspectRatio } : {}) } };
}

export async function quotePublicModelScenario(
  input: PublicModelQuoteInput,
  quote: (scenario: ManualTariffCoverageScenario) => Promise<PricingSnapshot> = quoteWithVerifiedPolicy,
): Promise<PublicModelQuote> {
  const scenario = resolvePublicModelScenario(input);
  if (!scenario) return { status: 'unavailable' };
  try {
    const snapshot = await quote(scenario);
    if (!Number.isSafeInteger(snapshot.totalCents) || snapshot.totalCents < 0 || !snapshot.currency) {
      return { status: 'unavailable' };
    }
    const revision = createHash('sha256').update(JSON.stringify({ scenarioId: scenario.id,
      amountCents: snapshot.totalCents, currency: snapshot.currency,
      tariffRevision: snapshot.meta?.customerTariffRevision ?? null,
      policy: snapshot.meta?.pricingPolicy ?? null })).digest('hex').slice(0, 20);
    const quantityLabel = getFalEngineById(input.modelId)?.category === 'image'
      ? `${input.durationSec} image${input.durationSec === 1 ? '' : 's'}` : `${input.durationSec}s`;
    const sourceLabel = supportsWan3TariffInputDuration(scenario.modelId, scenario.selector.mode)
      ? ` output + ${scenario.context.inputVideoDurationSec}s input` : '';
    return { status: 'exact', amountCents: snapshot.totalCents, currency: snapshot.currency,
      revision, scenarioLabel: `${input.mode} · ${quantityLabel}${sourceLabel} · ${input.resolution}` };
  } catch {
    return { status: 'unavailable' };
  }
}
