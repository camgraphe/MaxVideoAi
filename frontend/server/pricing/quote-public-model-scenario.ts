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
import { ltx25AudioTariffBounds, validateLtx25AudioTariffDuration } from '@/lib/ltx25-audio-tariff';
import { withLtx25AudioTariffDuration } from '@/lib/pricing-audit/ltx25-audio-tariff-scenario';
import { supportsOmniTariffMedia, withOmniTariffMedia } from '@/lib/pricing-audit/omni-tariff-scenario';
import { isSeedance2TokenPricing, resolveSeedance2TariffAspectRatio } from '@/lib/seedance-2-pricing';
import { manualTariffReferenceCounts } from '@/lib/pricing-audit/manual-tariff-dimensions';
import { applyEngineVariantPricing, buildEngineAddonInput } from '@/lib/pricing-addons';
import { numericTariffDuration } from '@/lib/pricing-audit/manual-tariff-durations';
import { buildBillingPricingFacts } from '@/lib/pricing-billing-facts';
import { openTariffQuantityKey, withOpenTariffQuantity } from '@/lib/pricing-audit/open-quantity-tariff-scenario';
import { seedanceInputTariffMaximum, supportsSeedanceInputTariff } from '@/lib/seedance-input-tariff';
import { withSeedanceTariffInputDuration } from '@/lib/pricing-audit/seedance-input-tariff-scenario';

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

/** One render owns its first successful policy; failed attempts remain retryable. */
export function createScopedPublicModelQuoter(
  loadOverrides: () => Promise<PricingPolicyOverrideLoadResult> = loadPricingPolicyOverrides,
): (input: PublicModelQuoteInput) => Promise<PublicModelQuote> {
  let loaded: Extract<PricingPolicyOverrideLoadResult, { status: 'loaded' }> | undefined;
  let pending: Promise<PricingPolicyOverrideLoadResult> | undefined;
  const loadScopedPolicy = () => {
    if (loaded) return Promise.resolve(loaded);
    if (!pending) {
      const attempt = Promise.resolve().then(loadOverrides).then((policy) => {
        if (policy.status === 'loaded') loaded = policy;
        return policy;
      }).finally(() => {
        if (pending === attempt) pending = undefined;
      });
      pending = attempt;
    }
    return pending;
  };
  return (input) => quotePublicModelScenario(input, (scenario) => quoteWithVerifiedPolicy(scenario, loadScopedPolicy));
}

const coverageByModel = new Map<string, Map<string, readonly ManualTariffCoverageScenario[]>>();

function supportedScenarios(modelId: string, mode: string): readonly ManualTariffCoverageScenario[] {
  let modes = coverageByModel.get(modelId);
  if (!modes) {
    modes = new Map();
    coverageByModel.set(modelId, modes);
  }
  let scenarios = modes.get(mode);
  if (!scenarios) {
    scenarios = collectSellableManualTariffCoverage({ modelId, mode }).scenarios;
    modes.set(mode, scenarios);
  }
  return scenarios;
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
      !Number.isFinite(input.durationSec) || (!ltx25AudioTariffBounds(input.modelId, input.mode)
        && !(supportsOmniTariffMedia(input.modelId, input.mode) && input.mode !== 'extend') && !Number.isInteger(input.durationSec))
      || input.durationSec < 1 || (openTariffQuantityKey(input.modelId, input.mode) === 'durationSec'
        ? !Number.isSafeInteger(input.durationSec) : input.durationSec > 120) ||
      !input.mode || !input.resolution || (input.quantity ?? 1) !== 1) return null;
  if (input.referenceImageCount !== undefined && (!Number.isSafeInteger(input.referenceImageCount)
    || input.referenceImageCount < 0 || input.referenceImageCount > 32)) return null;
  const defaultReferences = isLumaAgentsImageEngineId(model.id) || model.id === 'seedream-5-0-pro' ? 0 : 1;
  const gptImage = isGptImageFamilyEngineId(model.id);
  const entry = getFalEngineById(model.id);
  const mode = entry?.modes.find(candidate => candidate.mode === input.mode);
  if (!mode || (!gptImage && input.customImageSize !== undefined)) return null;
  const automaticDuration = mode.ui.duration && 'options' in mode.ui.duration && mode.ui.duration.options.includes('auto');
  if ([input.hdr, input.exrExport].some(value => value !== undefined && typeof value !== 'boolean')
    || (input.exrExport && !input.hdr)
    || ((input.hdr || input.exrExport) && (entry!.id !== 'luma-ray-3-2' || !['t2v', 'i2v', 'v2v'].includes(input.mode)))) return null;
  if (input.durationOption !== undefined && (input.durationOption !== 'auto' || !automaticDuration)) return null;
  if (automaticDuration && input.durationOption !== 'auto' && mode.ui.duration && 'options' in mode.ui.duration
    && !mode.ui.duration.options.some(value => numericTariffDuration(value) === input.durationSec)) return null;
  let billedDuration = input.durationSec;
  if (input.durationOption === 'auto') {
    try { billedDuration = buildBillingPricingFacts({ engine: entry!.engine, mode: mode.mode, durationSec: input.durationSec,
      resolution: input.resolution, aspectRatio: input.aspectRatio, hasVideoInput: input.hasVideoInput,
      durationOption: 'auto' }, entry!.engine.pricingDetails, 'USD').facts.quantity; }
    catch { return null; }
  }
  const aspects = mode.ui.aspectRatio?.length ? mode.ui.aspectRatio : entry!.engine.aspectRatios;
  if (input.aspectRatio !== undefined && !aspects.includes(input.aspectRatio)) return null;
  const tokenPricing = isSeedance2TokenPricing(entry!.engine.pricingDetails) ? entry!.engine.pricingDetails : null;
  if (input.voiceControl !== undefined && typeof input.voiceControl !== 'boolean') return null;
  const pricingEngine = applyEngineVariantPricing(entry!.engine, mode.mode);
  if (input.voiceControl && !pricingEngine.pricingDetails?.addons?.voice_control) return null;
  const audio = input.voiceControl ? true : input.audio;
  const references = manualTariffReferenceCounts(entry!, mode.mode);
  if (input.referenceImageCount !== undefined && !references.values.includes(input.referenceImageCount)
    && !(references.values.includes(undefined) && input.referenceImageCount === 1)) return null;
  if (input.hasVideoInput !== undefined && typeof input.hasVideoInput !== 'boolean') return null;
  const hasVideoInput = input.hasVideoInput ?? (['v2v', 'extend'].includes(input.mode) || (input.inputVideoDurationSec ?? 0) > 0);
  const videoAllowed = [...(entry!.engine.inputSchema?.required ?? []), ...(entry!.engine.inputSchema?.optional ?? [])]
    .some(field => field.type === 'video' && (!field.modes || field.modes.includes(mode.mode)));
  if (tokenPricing && hasVideoInput && !videoAllowed && !['v2v', 'extend'].includes(input.mode)) return null;
  if (tokenPricing && input.inputVideoDurationSec !== undefined && (!hasVideoInput
    || !Number.isFinite(input.inputVideoDurationSec) || input.inputVideoDurationSec <= 0
    || input.inputVideoDurationSec > (seedanceInputTariffMaximum(model.id) ?? 15))) return null;
  const seedanceInput = supportsSeedanceInputTariff(model.id, input.mode, hasVideoInput ? 'video_input' : undefined);
  if (seedanceInput && input.inputVideoDurationSec === undefined) return null;
  let requestedAspect = input.aspectRatio;
  try {
    if (tokenPricing && requestedAspect !== undefined) requestedAspect = resolveSeedance2TariffAspectRatio(tokenPricing, input.resolution, requestedAspect);
  } catch { return null; }
  const size = gptImage ? resolvePublicGptImageQuoteSize(input.resolution, input.customImageSize) : null;
  if (gptImage && (!size || !(mode.ui.resolution ?? entry!.engine.resolutions)
      .some(value => value.toLowerCase() === input.resolution.toLowerCase()) ||
      (input.aspectRatio !== undefined && !(mode.ui.aspectRatio ?? entry!.engine.aspectRatios).includes(input.aspectRatio)))) return null;
  const resolution = size?.billingKey ?? input.resolution;
  const wanInputDuration = supportsWan3TariffInputDuration(model.id, input.mode);
  const openKey = openTariffQuantityKey(model.id, input.mode);
  if (openKey === 'referenceTokenBudget' && (!Number.isSafeInteger(input.referenceTokenBudget) || input.referenceTokenBudget! < 0)) return null;
  const ltxAudioDuration = Boolean(ltx25AudioTariffBounds(model.id, input.mode));
  const omniMedia = supportsOmniTariffMedia(model.id, input.mode);
  const omniInherits = omniMedia && input.mode !== 'extend';
  const omniInherited = input.inheritedDurationSec ?? (input.mode === 'v2v' ? input.inputVideoDurationSec : undefined);
  if (input.inheritedDurationSec !== undefined && !omniInherits) return null;
  if (omniMedia && ((input.mode !== 'retake' && input.inputVideoDurationSec === undefined)
    || !Number.isFinite(input.inputVideoDurationSec ?? 0) || (input.inputVideoDurationSec ?? 0) < 0 || (input.inputVideoDurationSec ?? 0) > 10
    || (input.mode !== 'retake' && (input.inputVideoDurationSec ?? 0) <= 0)
    || (input.mode === 'retake' && (input.inputVideoDurationSec ?? 0) !== 0)
    || (input.mode === 'v2v' && omniInherited !== input.inputVideoDurationSec)
    || (omniInherits && (!Number.isFinite(omniInherited) || omniInherited! < 3 || omniInherited! > 10)))) return null;
  if (ltxAudioDuration) {
    try { validateLtx25AudioTariffDuration(model.id, input.mode, input.inputAudioDurationSec ?? NaN); }
    catch { return null; }
  }
  if (wanInputDuration && (typeof input.inputVideoDurationSec !== 'number'
    || !Number.isFinite(input.inputVideoDurationSec) || input.inputVideoDurationSec < 0
    || (input.mode !== 'ref2v' && input.inputVideoDurationSec === 0))) {
    if (!(input.mode === 'ref2v' && input.inputVideoDurationSec === undefined)) return null;
  }
  const candidates = supportedScenarios(model.id, input.mode).filter((scenario) =>
    scenario.selector.mode === input.mode &&
    scenario.selector.resolution.toLowerCase() === resolution.toLowerCase() &&
    (openKey === 'durationSec' || ltxAudioDuration || omniInherits || scenario.selector.durationSec === String(billedDuration)) &&
    (scenario.selector.referenceImageCount === undefined
      ? scenario.selector.inputImageCount === undefined || input.mode !== 'ref2v'
        || scenario.selector.inputImageCount === String(input.referenceImageCount ?? defaultReferences)
      : scenario.selector.referenceImageCount === String(input.referenceImageCount ?? defaultReferences)) &&
    (!tokenPricing || scenario.selector.billingInputType === (hasVideoInput ? 'video_input' : 'no_video_input')) &&
    !scenario.context.loop &&
    (audio === undefined || scenario.selector.audio === undefined || scenario.selector.audio === String(audio)) &&
    (scenario.selector.voiceControl === 'true') === Boolean(input.voiceControl) &&
    (scenario.selector.hdr === 'true') === Boolean(input.hdr) &&
    (scenario.selector.exrExport === 'true') === Boolean(input.exrExport) &&
    (gptImage || scenario.selector.aspectRatio === undefined || input.aspectRatio === undefined || scenario.selector.aspectRatio === requestedAspect) &&
    (input.quality === undefined || scenario.selector.quality === input.quality) &&
    (wanInputDuration || omniMedia || tokenPricing || input.inputVideoDurationSec === undefined || scenario.selector.inputVideoDurationSec === String(input.inputVideoDurationSec)) &&
    (ltxAudioDuration || input.inputAudioDurationSec === undefined || scenario.selector.inputAudioDurationSec === String(input.inputAudioDurationSec)) &&
    (openKey === 'referenceTokenBudget' || input.referenceTokenBudget === undefined || scenario.selector.referenceTokenBudget === String(input.referenceTokenBudget))
  );
  if (!candidates.length) return null;
  if (candidates.some((scenario) =>
    (scenario.selector.inputVideoDurationSec && input.inputVideoDurationSec === undefined && !((wanInputDuration && input.mode === 'ref2v') || (omniMedia && input.mode === 'retake'))) ||
    (scenario.selector.inputAudioDurationSec && input.inputAudioDurationSec === undefined) ||
    (scenario.selector.referenceTokenBudget && input.referenceTokenBudget === undefined))) return null;
  const defaultAspect = tokenPricing?.tokenPricing.defaultAspectRatio ?? catalogDefault(model.id, input.mode, 'aspect_ratio') ?? '16:9';
  const defaultQuality = catalogDefault(model.id, input.mode, 'quality');
  let selected = candidates.sort((left, right) => {
    const score = (scenario: ManualTariffCoverageScenario) =>
      (input.aspectRatio === undefined && scenario.selector.aspectRatio !== defaultAspect ? 4 : 0) +
      (input.quality === undefined && defaultQuality && scenario.selector.quality !== defaultQuality ? 2 : 0) +
      (input.audio === undefined && scenario.selector.audio === 'true' ? 1 : 0);
    return score(left) - score(right) || left.id.localeCompare(right.id);
  })[0] ?? null;
  if (selected && input.durationOption === 'auto') selected = { ...selected, context: { ...selected.context,
    durationSec: input.durationSec, durationOption: 'auto' } };
  if (selected && input.aspectRatio !== undefined) selected = { ...selected, context: { ...selected.context, aspectRatio: input.aspectRatio } };
  if (selected && audio !== undefined) {
    const addons = Object.fromEntries(Object.entries(selected.context.addons ?? {})
      .filter(([key]) => !['audio', 'audio_off', 'voice_control'].includes(key)));
    selected = { ...selected, context: { ...selected.context, addons: { ...addons, audio,
      ...buildEngineAddonInput(pricingEngine, { audioEnabled: audio, voiceControl: input.voiceControl }) } } };
  }
  if (selected && (input.referenceImageCount !== undefined || tokenPricing)) selected = { ...selected, context: { ...selected.context,
    ...(input.referenceImageCount !== undefined ? { referenceImageCount: input.referenceImageCount,
      ...(input.mode === 'ref2v' ? { inputImageCount: input.referenceImageCount } : {}) } : {}),
    ...(tokenPricing ? { hasVideoInput, ...(input.inputVideoDurationSec !== undefined ? { inputVideoDurationSec: input.inputVideoDurationSec } : {}) } : {}) } };
  if (selected && wanInputDuration) {
    try { return withWan3TariffInputDuration(selected, input.inputVideoDurationSec ?? 0); }
    catch { return null; }
  }
  if (selected && seedanceInput) {
    try { return withSeedanceTariffInputDuration(selected, input.inputVideoDurationSec!); }
    catch { return null; }
  }
  if (selected && openKey) {
    try { return withOpenTariffQuantity(selected, openKey === 'durationSec' ? input.durationSec : input.referenceTokenBudget!); }
    catch { return null; }
  }
  if (selected && ltxAudioDuration) {
    try { return withLtx25AudioTariffDuration(selected, input.inputAudioDurationSec!); }
    catch { return null; }
  }
  if (selected && omniMedia) {
    try { return withOmniTariffMedia(selected, { inputVideoDurationSec: input.inputVideoDurationSec ?? 0,
      ...(omniInherits ? { inheritedDurationSec: omniInherited } : {}) }); }
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
    const seconds = Number(scenario.selector.durationSec);
    const quantityLabel = getFalEngineById(input.modelId)?.category === 'image'
      ? `${seconds} image${seconds === 1 ? '' : 's'}` : `${seconds}s${ltx25AudioTariffBounds(input.modelId, input.mode) ? ' source audio' : ''}`;
    const sourceLabel = (supportsWan3TariffInputDuration(scenario.modelId, scenario.selector.mode)
      || supportsSeedanceInputTariff(scenario.modelId, scenario.selector.mode, scenario.selector.billingInputType))
      ? ` output + ${scenario.context.inputVideoDurationSec}s input` : '';
    return { status: 'exact', amountCents: snapshot.totalCents, currency: snapshot.currency,
      revision, scenarioLabel: `${input.mode} · ${quantityLabel}${sourceLabel} · ${input.resolution}` };
  } catch {
    return { status: 'unavailable' };
  }
}
