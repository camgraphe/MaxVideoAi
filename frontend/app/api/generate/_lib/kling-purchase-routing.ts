import type { GeneratePayload } from '@/lib/fal';
import type { PricingSnapshot } from '@/types/engines';
import { isKlingDirectFalFallbackCompatible } from '@/server/video-providers/kling-direct/capabilities';
import type { KlingDirectPayload } from '@/server/video-providers/kling-direct/payload';
import {
  customerPurchaseCeiling,
  planVideoPurchase,
  usesPurchaseBaseline,
} from '@/server/video-providers/purchase-router';
import type { resolveKlingDirectSubmissionMediaInputs } from './kling-direct-submission';

/** Observe the commissioned model and actual input roles. Never substitute the engine behind another model's adapter. */
export function observeKlingPurchase(
  params: {
    engineId: string;
    mode: string;
    durationSec: number;
    aspectRatio: string | null;
    pricing: PricingSnapshot;
    falPayload: GeneratePayload;
    fallbackToFalEnabled: boolean;
    fallbackOnCreditsDepletedEnabled: boolean;
  },
  payload: KlingDirectPayload,
  media: ReturnType<typeof resolveKlingDirectSubmissionMediaInputs>
) {
  if (
    !usesPurchaseBaseline(params.engineId, 'kling_direct') ||
    params.falPayload.engineId !== params.engineId
  )
    return null;

  const fal = params.falPayload;
  const props = fal.extraInputValues ?? {};
  const audio = payload.body.sound === 'on';
  const hasExtraMediaOrControls = [
    'elements',
    'voice_ids',
    'voice_list',
    'multi_prompt',
    'video_url',
    'video_urls',
    'reference_video_urls',
    'audio_url',
    'end_image_url',
  ].some((key) => {
    const value = props[key];
    return Array.isArray(value) ? value.length > 0 : Boolean(value);
  });
  const fallbackReason = !params.fallbackToFalEnabled
    ? 'Fal fallback disabled'
    : !params.fallbackOnCreditsDepletedEnabled
      ? 'Fallback on credit refusal disabled'
      : null;
  return planVideoPurchase(
    {
      engineId: params.engineId,
      mode: params.mode,
      durationSec: params.durationSec,
      resolution: fal.resolution ?? '1080p',
      aspectRatio: params.aspectRatio ?? fal.aspectRatio ?? null,
      audioEnabled: audio,
      images: media.referenceImageUrls.length + Number(Boolean(media.startImageUrl)),
      hasVideo: Boolean(media.sourceVideoUrl || fal.inputs?.some((item) => item.kind === 'video')),
      inputVideoSeconds: null,
      hasEndFrame: Boolean(fal.endImageUrl),
      hasAudioReference: Boolean(fal.audioUrl || fal.inputs?.some((item) => item.kind === 'audio')),
      hasDocument: Boolean(props.file_url || props.web_url),
      requiresDirectControls: !isKlingDirectFalFallbackCompatible(fal),
      hasUnpricedOptions: Boolean(
        fal.elements?.length ||
          fal.voiceIds?.length ||
          fal.multiPrompt?.length ||
          hasExtraMediaOrControls ||
          props.element_list ||
          (fal.mode != null && fal.mode !== params.mode) ||
          (fal.durationSec != null && fal.durationSec !== params.durationSec) ||
          (params.aspectRatio && fal.aspectRatio && params.aspectRatio !== fal.aspectRatio) ||
          (fal.audio != null && fal.audio !== audio) ||
          (typeof props.generate_audio === 'boolean' && props.generate_audio !== audio) ||
          (params.mode === 'ref2v' && media.startImageUrl)
      ),
    },
    {
      ceilingMicros: customerPurchaseCeiling(params.pricing),
      unavailable: fallbackReason ? { fal: fallbackReason } : {},
    }
  );
}
