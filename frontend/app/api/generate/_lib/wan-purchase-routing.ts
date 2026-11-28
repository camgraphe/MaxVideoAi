import type { PricingSnapshot } from '@/types/engines';
import type { GeneratePayload } from '@/lib/fal';
import type { WanPurchaseCanary } from '@/server/video-providers/router';
import { customerPurchaseCeiling, planWanPurchase, type PurchaseRequest } from '@/server/video-providers/purchase-router';
import { hasUnreviewedWanOptions } from '@/server/video-providers/apimart/wan-image-mode';
import type { resolveAlibabaSubmissionMediaInputs } from './alibaba-model-studio-submission';

export function buildWanPurchaseDecision(
  params: {
    engineId: string;
    mode: string;
    durationSec: number;
    aspectRatio: string | null;
    falPayload: GeneratePayload;
    fallbackToFalEnabled: boolean;
    purchaseCanary?: WanPurchaseCanary;
    pricing: PricingSnapshot;
  },
  resolution: string,
  media: ReturnType<typeof resolveAlibabaSubmissionMediaInputs>
) {
  const extras = params.falPayload.extraInputValues;
  const request: PurchaseRequest = {
    engineId: params.engineId,
    mode: params.mode,
    durationSec: params.durationSec,
    resolution,
    aspectRatio: params.aspectRatio ?? params.falPayload.aspectRatio ?? null,
    images: media.referenceImages.length + Number(Boolean(media.startImageUrl)),
    hasStartFrame: Boolean(media.startImageUrl),
    hasEndFrame: Boolean(media.endImageUrl),
    hasVideo: media.referenceVideos.length > 0,
    inputVideoSeconds: media.inputVideoDurationSec,
    hasAudioReference: media.referenceAudio.length > 0,
    hasUnpricedOptions: hasUnreviewedWanOptions(extras),
    hasDocument: Boolean(extras?.file_url || extras?.web_url),
  };
  const ceiling = params.engineId === 'wan-3-prime' ? process.env.WAN_PRIME_PURCHASE_CEILING_USD
    : params.purchaseCanary === 'alibaba-fal' ? process.env.WAN_STANDARD_PURCHASE_CEILING_USD : undefined;
  const configured = ceiling?.trim();
  const serverCap = configured ? Math.floor(Number(configured) * 1e6) : Number.MAX_SAFE_INTEGER;
  const cap = Math.min(serverCap, customerPurchaseCeiling(params.pricing));
  return planWanPurchase(request, {
    ceilingMicros: cap,
    unavailable: params.fallbackToFalEnabled ? {} : { fal: 'Fal fallback disabled' },
  }, params.purchaseCanary);
}
