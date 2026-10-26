import { isFluxLtxSourceOperation, fluxLtxDurationBounds } from '../../lib/flux-ltx-operations';
import { isH3SourceOperation } from '../../lib/h3-source-operations';
import { videoOperationTariffIdentity } from '@/lib/video-operation';
import type { ManualTariffSelector, PricingFacts } from '@maxvideoai/pricing';

import type { PricingContext } from '@/lib/pricing-context';
import { assertSeedanceWorkflowPricing } from '@/lib/seedance-workflow-pricing';
import type { ManualTariffMedia } from '@/lib/pricing-manual-media';
import { isGptImage25EngineId, isGptImageFamilyEngineId, normalizeGptImageQuality, resolveGptImage2PricingTier } from '@/lib/image/gptImage2';
import { isLumaAgentsImageEngineId } from '@/lib/luma-agents';
import { isMinimaxH3EngineId } from '@/lib/minimax-h3';
import { isWan3EngineId, validateWan3PricingDuration } from '@/lib/wan3-pricing';
import { ltx25AudioTariffBounds, validateLtx25AudioTariffDuration } from '@/lib/ltx25-audio-tariff';
import { supportsSeedanceInputTariff, validateSeedanceInputTariffDuration } from '@/lib/seedance-input-tariff';

/** A reviewed quantity-priced class; all other options still match exactly. */
export function continuousWan3TariffSelector(selector: ManualTariffSelector): ManualTariffSelector | null {
  if (!isWan3EngineId(selector.engineId) || !['ref2v', 'v2v', 'extend'].includes(selector.mode)) return null;
  const seconds = Number(selector.inputVideoDurationSec ?? 0);
  validateWan3PricingDuration({ mode: selector.mode, durationSec: Number(selector.durationSec),
    inputVideoDurationSec: seconds, hasVideoInput: selector.mode !== 'ref2v' || seconds > 0 });
  return { ...selector, inputVideoDurationSec: 'continuous' };
}

/** Reviewed continuous classes only; every other model keeps exact matching. */
export function continuousInputTariffSelector(selector: ManualTariffSelector): ManualTariffSelector | null {
  if (selector.engineId === 'kling-v4' && selector.billingInputType === 'video_input') {
    const input = Number(selector.inputVideoDurationSec), output = Number(selector.durationSec);
    if (!['ref2v','v2v'].includes(selector.mode) || !Number.isFinite(input) || input < 3 || input > (selector.mode === 'v2v' ? 30.05 : 30)
      || !Number.isFinite(output) || output < 3 || output > 30.05) throw new Error('Invalid Kling V4 source/output timing.');
    return {...selector,inputVideoDurationSec:'continuous',...(selector.mode === 'v2v' ? {durationSec:'continuous'} : {})};
  }
  if (isFluxLtxSourceOperation(selector.operation)) {
    const identity=videoOperationTariffIdentity(selector.engineId,selector.mode,selector.operation), bounds=fluxLtxDurationBounds(selector.operation),seconds=Number(selector.durationSec);
    if (!identity||identity.endpoint!==selector.endpoint||identity.transport!==selector.transport||!Number.isFinite(seconds)||seconds<=0||(bounds.maxExclusive?seconds>=bounds.max:seconds>bounds.max)) throw new Error('Invalid source operation tariff identity or duration.');
    return {...selector,durationSec:'continuous'};
  }
  if (isH3SourceOperation(selector.operation)) {
    const identity = videoOperationTariffIdentity(selector.engineId,selector.mode,selector.operation);
    const seconds=Number(selector.durationSec), min=selector.operation==='h3-recast'?5:56/24, max=selector.operation==='h3-recast'?30:15;
    if (!identity || selector.transport!==identity.transport || selector.endpoint!==identity.endpoint || !Number.isFinite(seconds) || seconds<min || seconds>max) throw new Error('Invalid H3 operation tariff identity or duration.');
    return {...selector,durationSec:'continuous'};
  }
  if (selector.operation === 'kling-edit') {
    const identity = videoOperationTariffIdentity(selector.engineId, selector.mode, selector.operation);
    const seconds = Number(selector.durationSec);
    if (!identity || selector.transport !== identity.transport || selector.endpoint !== identity.endpoint
      || !Number.isFinite(seconds) || seconds < 3 || seconds > 15) throw new Error('Invalid Kling Edit tariff identity or duration.');
    return { ...selector, durationSec: 'continuous' };
  }
  if (supportsSeedanceInputTariff(selector.engineId, selector.mode, selector.billingInputType)) {
    if (selector.inputVideoDurationSec === undefined) return null;
    validateSeedanceInputTariffDuration(selector.engineId, Number(selector.inputVideoDurationSec));
    return { ...selector, inputVideoDurationSec: 'continuous' };
  }
  if (['lumaRay2', 'lumaRay2_flash'].includes(selector.engineId) && selector.mode === 'v2v') {
    if (!Number.isSafeInteger(Number(selector.durationSec)) || Number(selector.durationSec) < 1) throw new Error('Invalid billed Luma duration.');
    return { ...selector, durationSec: 'continuous' };
  }
  if (selector.engineId === 'minimax-h3-max' && selector.mode === 'ref2v') {
    if (!Number.isSafeInteger(Number(selector.referenceTokenBudget)) || Number(selector.referenceTokenBudget) < 0) throw new Error('Invalid trusted reference token budget.');
    return { ...selector, referenceTokenBudget: 'continuous' };
  }
  if (selector.engineId === 'gemini-omni-flash' && ['v2v', 'retake', 'extend'].includes(selector.mode)) {
    const output = Number(selector.durationSec);
    const source = Number(selector.inputVideoDurationSec ?? 0);
    const inherits = selector.mode !== 'extend';
    if (!Number.isFinite(source) || source < 0 || source > 10 || (selector.mode !== 'retake' && source <= 0)
      || (selector.mode === 'retake' && source !== 0) || (selector.mode === 'v2v' && source !== output)
      || !Number.isFinite(output) || output < 3 || output > 10
      || (inherits ? selector.inheritedDurationSec !== String(output) : !Number.isInteger(output))) {
      throw new Error('Unsupported Omni source or inherited duration.');
    }
    return { ...selector, inputVideoDurationSec: 'continuous',
      ...(inherits ? { durationSec: 'continuous', inheritedDurationSec: 'continuous' } : {}) };
  }
  if (ltx25AudioTariffBounds(selector.engineId, selector.mode)) {
    const seconds = Number(selector.inputAudioDurationSec);
    validateLtx25AudioTariffDuration(selector.engineId, selector.mode, seconds);
    if (selector.durationSec !== String(seconds)) throw new Error('Audio and billed duration disagree.');
    return { ...selector, durationSec: 'continuous', inputAudioDurationSec: 'continuous' };
  }
  return continuousWan3TariffSelector(selector);
}

function option(value: number | string | boolean | null | undefined): string | undefined {
  return value == null ? undefined : String(value);
}

/** Exact customer-price dimensions shared by billing and read-only quotes. */
export function buildManualTariffScenario(context: PricingContext, facts: PricingFacts): {
  selector: ManualTariffSelector;
  quantities: Record<string, number>;
} {
  if (facts.engineId !== context.engine.id) throw new Error('Manual tariff engine and facts disagree');
  assertSeedanceWorkflowPricing(context);
  // GPT billing already maps arbitrary sizes/orientations to six factual tiers.
  // Keep the requested pixels in the quote context, never as separately authored prices.
  const gptImage = isGptImageFamilyEngineId(facts.engineId);
  // These new endpoint rates depend only on tier/output seconds. Reference orientation
  // and guidance/Element member counts remain request facts, not separate tariff classes.
  const operationIdentity = videoOperationTariffIdentity(facts.engineId, context.mode ?? 't2v', context.operation);
  const factualAspect = operationIdentity ? null : facts.metadata?.manualTariffAspectRatio;
  const pricedAspect = factualAspect === null ? null
    : typeof factualAspect === 'string' ? factualAspect : context.aspectRatio ?? 'default';
  // These factual owners price 0/1 references differently; neither count can alias a default cell.
  const pricedReferences = (isGptImage25EngineId(facts.engineId) && context.mode === 'i2i')
    || isLumaAgentsImageEngineId(facts.engineId)
    || (isMinimaxH3EngineId(facts.engineId) && context.mode === 'ref2v');
  const projectedMedia = operationIdentity ? {} : facts.metadata?.manualTariffMedia as ManualTariffMedia | undefined;
  const media = projectedMedia ?? context;
  const factualAudio = facts.metadata?.manualTariffAudio;
  const audio = factualAudio === null ? undefined : typeof factualAudio === 'boolean' ? factualAudio : context.addons?.audio;
  const billedDuration = typeof facts.metadata?.manualTariffDurationSec === 'number'
    ? facts.metadata.manualTariffDurationSec : context.durationSec;
  const selector: ManualTariffSelector = {
    engineId: facts.engineId,
    mode: context.mode ?? 't2v',
    ...operationIdentity,
    resolution: gptImage ? resolveGptImage2PricingTier(context.resolution, context.customImageSize).billingKey : context.resolution,
    durationSec: String(billedDuration),
    ...(context.workflowStep ? { workflowStep: context.workflowStep } : {}),
    ...(!gptImage && pricedAspect !== null ? { aspectRatio: pricedAspect } : {}),
    ...(option(audio) !== undefined ? { audio: option(audio)! } : {}),
    ...(gptImage ? { quality: normalizeGptImageQuality(context.quality, facts.engineId) }
      : context.quality ? { quality: context.quality } : {}),
    ...(option(media.inputVideoDurationSec) ? { inputVideoDurationSec: option(media.inputVideoDurationSec)! } : {}),
    ...(option(media.inputAudioDurationSec) ? { inputAudioDurationSec: option(media.inputAudioDurationSec)! } : {}),
    ...(option(media.inheritedDurationSec) ? { inheritedDurationSec: option(media.inheritedDurationSec)! } : {}),
    ...(option(media.referenceTokenBudget) ? { referenceTokenBudget: option(media.referenceTokenBudget)! } : {}),
    ...(option(media.verifiedReferenceTokenCount) ? { verifiedReferenceTokenCount: option(media.verifiedReferenceTokenCount)! } : {}),
    ...(projectedMedia ? media.referenceImageCount !== undefined ? { referenceImageCount: String(media.referenceImageCount) } : {}
      : pricedReferences ? { referenceImageCount: String(context.referenceImageCount ?? 0) }
      : context.referenceImageCount && context.referenceImageCount !== 1
      ? { referenceImageCount: String(context.referenceImageCount) } : {}),
    ...(projectedMedia ? media.inputImageCount !== undefined ? { inputImageCount: String(media.inputImageCount) } : {}
      : context.inputImageCount && context.inputImageCount !== 1
      ? { inputImageCount: String(context.inputImageCount) } : {}),
    ...(projectedMedia?.billingInputType ? { billingInputType: projectedMedia.billingInputType } : {}),
    ...(facts.metadata?.manualTariffVoiceControl === true ? { voiceControl: 'true' } : {}),
    ...(!gptImage && context.customImageSize ? { customImageSize: JSON.stringify(context.customImageSize) } : {}),
    ...(context.loop ? { loop: 'true' } : {}),
    ...(facts.metadata?.manualTariffDynamicRange === 'hdr' || facts.metadata?.manualTariffDynamicRange === 'hdr_exr' ? { hdr: 'true' } : {}),
    ...(facts.metadata?.manualTariffDynamicRange === 'hdr_exr' ? { exrExport: 'true' } : {}),
  };
  const quantities: Record<string, number> = {
    output_seconds: billedDuration,
    ...(facts.engineId === 'kling-v4' ? {billable_seconds:Number(facts.metadata?.billable_seconds ?? (context.hasVideoInput ? Math.max((context.inputVideoDurationSec ?? 0)+billedDuration,2*billedDuration) : billedDuration))} : {}),
    ...(operationIdentity?.operation === 'kling-edit' || isH3SourceOperation(operationIdentity?.operation) || isFluxLtxSourceOperation(operationIdentity?.operation)
      ? {input_video_seconds:billedDuration} : {}),
    output_units: facts.quantity,
    ...(media.inputVideoDurationSec !== undefined || (isWan3EngineId(facts.engineId) && context.mode === 'ref2v')
      ? { input_video_seconds: media.inputVideoDurationSec ?? 0 } : {}),
    ...(media.inputAudioDurationSec !== undefined ? { input_audio_seconds: media.inputAudioDurationSec } : {}),
    ...(media.referenceTokenBudget !== undefined ? { reference_tokens: media.referenceTokenBudget } : {}),
    ...(media.referenceImageCount !== undefined ? { reference_images: media.referenceImageCount } : {}),
    ...(media.inputImageCount !== undefined ? { input_images: media.inputImageCount } : {}),
    ...(facts.engineId === 'gemini-omni-flash' ? {
      input_video_seconds: media.inputVideoDurationSec ?? 0,
      output_tokens: Number(facts.metadata?.manualTariffOutputTokens), input_tokens: Number(facts.metadata?.manualTariffInputTokens),
    } : {}),
  };
  return { selector, quantities };
}
