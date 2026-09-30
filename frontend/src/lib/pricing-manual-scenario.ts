import type { ManualTariffSelector, PricingFacts } from '@maxvideoai/pricing';

import type { PricingContext } from '@/lib/pricing-context';
import type { ManualTariffMedia } from '@/lib/pricing-manual-media';
import { isGptImage25EngineId, isGptImageFamilyEngineId, normalizeGptImageQuality, resolveGptImage2PricingTier } from '@/lib/image/gptImage2';
import { isLumaAgentsImageEngineId } from '@/lib/luma-agents';
import { isMinimaxH3EngineId } from '@/lib/minimax-h3';
import { isWan3EngineId, validateWan3PricingDuration } from '@/lib/wan3-pricing';
import { ltx25AudioTariffBounds, validateLtx25AudioTariffDuration } from '@/lib/ltx25-audio-tariff';

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
  // GPT billing already maps arbitrary sizes/orientations to six factual tiers.
  // Keep the requested pixels in the quote context, never as separately authored prices.
  const gptImage = isGptImageFamilyEngineId(facts.engineId);
  const factualAspect = facts.metadata?.manualTariffAspectRatio;
  const pricedAspect = factualAspect === null ? null
    : typeof factualAspect === 'string' ? factualAspect : context.aspectRatio ?? 'default';
  // These factual owners price 0/1 references differently; neither count can alias a default cell.
  const pricedReferences = (isGptImage25EngineId(facts.engineId) && context.mode === 'i2i')
    || isLumaAgentsImageEngineId(facts.engineId)
    || (isMinimaxH3EngineId(facts.engineId) && context.mode === 'ref2v');
  const projectedMedia = facts.metadata?.manualTariffMedia as ManualTariffMedia | undefined;
  const media = projectedMedia ?? context;
  const factualAudio = facts.metadata?.manualTariffAudio;
  const audio = factualAudio === null ? undefined : typeof factualAudio === 'boolean' ? factualAudio : context.addons?.audio;
  const billedDuration = typeof facts.metadata?.manualTariffDurationSec === 'number'
    ? facts.metadata.manualTariffDurationSec : context.durationSec;
  const selector: ManualTariffSelector = {
    engineId: facts.engineId,
    mode: context.mode ?? 't2v',
    resolution: gptImage ? resolveGptImage2PricingTier(context.resolution, context.customImageSize).billingKey : context.resolution,
    durationSec: String(billedDuration),
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
    output_units: facts.quantity,
    ...(media.inputVideoDurationSec !== undefined || (isWan3EngineId(facts.engineId) && context.mode === 'ref2v')
      ? { input_video_seconds: media.inputVideoDurationSec ?? 0 } : {}),
    ...(media.inputAudioDurationSec !== undefined ? { input_audio_seconds: media.inputAudioDurationSec } : {}),
    ...(media.referenceTokenBudget !== undefined ? { reference_tokens: media.referenceTokenBudget } : {}),
    ...(media.referenceImageCount !== undefined ? { reference_images: media.referenceImageCount } : {}),
    ...(media.inputImageCount !== undefined ? { input_images: media.inputImageCount } : {}),
  };
  return { selector, quantities };
}
