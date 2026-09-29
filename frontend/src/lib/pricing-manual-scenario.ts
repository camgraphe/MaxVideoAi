import type { ManualTariffSelector, PricingFacts } from '@maxvideoai/pricing';

import type { PricingContext } from '@/lib/pricing-context';

function option(value: number | string | boolean | null | undefined): string | undefined {
  return value == null ? undefined : String(value);
}

/** Exact customer-price dimensions shared by billing and read-only quotes. */
export function buildManualTariffScenario(context: PricingContext, facts: PricingFacts): {
  selector: ManualTariffSelector;
  quantities: Record<string, number>;
} {
  if (facts.engineId !== context.engine.id) throw new Error('Manual tariff engine and facts disagree');
  const selector: ManualTariffSelector = {
    engineId: facts.engineId,
    mode: context.mode ?? 't2v',
    resolution: context.resolution,
    durationSec: String(context.durationSec),
    aspectRatio: context.aspectRatio ?? 'default',
    ...(option(context.addons?.audio) !== undefined ? { audio: option(context.addons?.audio)! } : {}),
    ...(context.quality ? { quality: context.quality } : {}),
    ...(option(context.inputVideoDurationSec) ? { inputVideoDurationSec: option(context.inputVideoDurationSec)! } : {}),
    ...(option(context.inputAudioDurationSec) ? { inputAudioDurationSec: option(context.inputAudioDurationSec)! } : {}),
    ...(option(context.inheritedDurationSec) ? { inheritedDurationSec: option(context.inheritedDurationSec)! } : {}),
    ...(option(context.referenceTokenBudget) ? { referenceTokenBudget: option(context.referenceTokenBudget)! } : {}),
    ...(option(context.verifiedReferenceTokenCount) ? { verifiedReferenceTokenCount: option(context.verifiedReferenceTokenCount)! } : {}),
    ...(context.referenceImageCount && context.referenceImageCount !== 1
      ? { referenceImageCount: String(context.referenceImageCount) } : {}),
    ...(context.inputImageCount && context.inputImageCount !== 1
      ? { inputImageCount: String(context.inputImageCount) } : {}),
    ...(context.customImageSize ? { customImageSize: JSON.stringify(context.customImageSize) } : {}),
    ...(context.loop ? { loop: 'true' } : {}),
    ...(option(context.addons?.hdr) ? { hdr: option(context.addons?.hdr)! } : {}),
    ...(option(context.addons?.exr_export) ? { exrExport: option(context.addons?.exr_export)! } : {}),
  };
  const quantities: Record<string, number> = {
    output_seconds: context.durationSec,
    output_units: facts.quantity,
    ...(context.inputVideoDurationSec !== undefined ? { input_video_seconds: context.inputVideoDurationSec } : {}),
    ...(context.inputAudioDurationSec !== undefined ? { input_audio_seconds: context.inputAudioDurationSec } : {}),
    ...(context.referenceTokenBudget !== undefined ? { reference_tokens: context.referenceTokenBudget } : {}),
    ...(context.referenceImageCount !== undefined ? { reference_images: context.referenceImageCount } : {}),
    ...(context.inputImageCount !== undefined ? { input_images: context.inputImageCount } : {}),
  };
  return { selector, quantities };
}
