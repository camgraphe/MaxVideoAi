import type { PricingContext } from '@/lib/pricing-context';
import type { EnginePricingDetails, Resolution } from '@/types/engines';
import { isGptImage25EngineId } from '@/lib/image/gptImage2';
import { isLumaAgentsImageEngineId } from '@/lib/luma-agents';
import { isMinimaxH3EngineId } from '@/lib/minimax-h3';
import { isMinimaxH3MaxEngineId } from '@/lib/minimax-h3-max';
import { isWan3EngineId } from '@/lib/wan3-pricing';
import { isSeedance2TokenPricing, resolveSeedance2UnitPriceUsdPer1kTokens } from '@/lib/seedance-2-pricing';

export type ManualTariffMedia = Pick<PricingContext, 'inputVideoDurationSec' | 'inputAudioDurationSec'
  | 'inheritedDurationSec' | 'referenceTokenBudget' | 'verifiedReferenceTokenCount' | 'referenceImageCount' | 'inputImageCount'>
  & { billingInputType?: 'no_video_input' | 'video_input' | 'legacy_default' };

/** Projects quantities consumed by the factual owner, keeping unused request/media metadata out of price identities. */
export function projectManualTariffMedia(context: PricingContext, details: EnginePricingDetails | undefined,
  meta: Record<string, unknown>): ManualTariffMedia {
  const media: ManualTariffMedia = {};
  const id = context.engine.id;
  if (isWan3EngineId(id) || id === 'gemini-omni-flash') {
    const seconds = Number(meta.input_video_duration_sec);
    if (seconds > 0) media.inputVideoDurationSec = seconds;
  }
  if (id === 'gemini-omni-flash') {
    media.inputImageCount = Number(meta.input_image_count);
    if (context.mode === 'v2v' || context.mode === 'retake') media.inheritedDurationSec = Number(meta.output_duration_sec);
  }
  if (meta.durationBasis === 'input_audio') media.inputAudioDurationSec = Number(meta.inputAudioDurationSec);
  if (isMinimaxH3MaxEngineId(id) && context.mode === 'ref2v') {
    media.referenceTokenBudget = context.referenceTokenBudget ?? context.verifiedReferenceTokenCount;
  }
  if (isMinimaxH3EngineId(id)) media.referenceImageCount = Number(meta.reference_image_count);
  else if (isGptImage25EngineId(id) && context.mode === 'i2i') media.referenceImageCount = Number(meta.provider_reference_image_count);
  else if (isLumaAgentsImageEngineId(id)) media.referenceImageCount = Number(meta.source_or_reference_image_count)
    - (context.mode === 'i2i' ? 1 : 0);
  else if (meta.manualTariffReferenceImageCount !== undefined) {
    media.referenceImageCount = Number(meta.manualTariffReferenceImageCount);
  }
  if (isSeedance2TokenPricing(details)) {
    const actualRate = Number(meta.legacy_retail_unit_price_usd_per_1k_tokens);
    const noVideoRate = resolveSeedance2UnitPriceUsdPer1kTokens({ tokenPricing: details.tokenPricing,
      resolution: context.resolution as Resolution, billingInputType: 'no_video_input' });
    media.billingInputType = context.hasVideoInput === true ? 'video_input'
      : context.hasVideoInput === false || actualRate === noVideoRate ? 'no_video_input' : 'legacy_default';
  }
  return media;
}

/** Special factual owners ignore generic audio addons; standard owners use the same flags as generation. */
export function projectManualTariffAudio(context: PricingContext, meta: Record<string, unknown>): boolean | null {
  if (meta.pricing_model && !isWan3EngineId(context.engine.id)) return null;
  const key = meta.manualTariffAudioKey;
  return key === 'audio_off' ? !Boolean(context.addons?.audio_off)
    : key === 'audio' ? Boolean(context.addons?.audio) : null;
}
