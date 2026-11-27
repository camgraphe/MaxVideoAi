import type { SubmitOutcome } from '@/lib/video-purchase-decision';
import type { PricingSnapshot } from '@/types/engines';
import type { GeneratePayload } from '@/lib/fal';
import type { VideoProviderKey } from '@/server/video-providers/types';
import type { WanPrimeCanary } from '@/server/video-providers/router';
import { ApimartSubmitError } from '@/server/video-providers/apimart/wan-prime';
import { classifyAlibabaModelStudioError } from '@/server/video-providers/alibaba-model-studio/errors';
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
    purchaseCanary?: WanPrimeCanary;
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
  const configured = params.engineId === 'wan-3-prime' ? process.env.WAN_PRIME_PURCHASE_CEILING_USD?.trim() : undefined;
  const serverCap = configured ? Math.floor(Number(configured) * 1e6) : Number.MAX_SAFE_INTEGER;
  const cap = Math.min(serverCap, customerPurchaseCeiling(params.pricing));
  return planWanPurchase(request, {
    ceilingMicros: cap,
    unavailable: {
      ...(params.purchaseCanary === 'alibaba-fal' ? { apimart: 'Outside the Alibaba and Fal pilot' } : {}),
      ...(!params.fallbackToFalEnabled ? { fal: 'Fal fallback disabled' } : {}),
    },
  });
}
export function classifyWanPurchaseFailure(
  provider: VideoProviderKey,
  error: unknown
): {
  outcome: Exclude<SubmitOutcome, 'accepted'>;
  code: string;
} {
  if (provider === 'apimart')
    return error instanceof ApimartSubmitError
      ? error
      : { outcome: 'uncertain', code: 'SUBMISSION_UNCONFIRMED' };
  const failure = classifyAlibabaModelStudioError(error);
  const code = failure.code ?? failure.errorClass;
  if (
    failure.status === 429 ||
    (failure.status != null &&
      [400, 402, 403].includes(failure.status) &&
      ['Arrearage', 'PrepaidBillOverdue', 'InsufficientBalance'].includes(code))
  )
    return { outcome: 'refused', code };
  if (failure.status != null && [400, 401, 403, 413, 422].includes(failure.status))
    return { outcome: 'invalid', code };
  return { outcome: 'uncertain', code };
}
