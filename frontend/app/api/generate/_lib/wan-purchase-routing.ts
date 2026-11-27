import type { SubmitOutcome } from '@/lib/video-purchase-decision';
import type { PricingSnapshot } from '@/types/engines';
import type { GeneratePayload } from '@/lib/fal';
import type { VideoProviderKey } from '@/server/video-providers/types';
import { ApimartSubmitError } from '@/server/video-providers/apimart/wan-prime';
import { classifyAlibabaModelStudioError } from '@/server/video-providers/alibaba-model-studio/errors';
import { planWanPrimePurchase, type PurchaseRequest } from '@/server/video-providers/purchase-router';
import type { resolveAlibabaSubmissionMediaInputs } from './alibaba-model-studio-submission';

export function buildWanPurchaseDecision(
  params: {
    engineId: string;
    mode: string;
    durationSec: number;
    aspectRatio: string | null;
    falPayload: GeneratePayload;
    fallbackToFalEnabled: boolean;
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
    hasEndFrame: Boolean(media.endImageUrl) || (params.mode === 'ref2v' && Boolean(media.startImageUrl)),
    hasVideo: media.referenceVideos.length > 0,
    inputVideoSeconds: media.inputVideoDurationSec,
    hasAudioReference: media.referenceAudio.length > 0,
    hasDocument: Boolean(extras?.file_url || extras?.web_url),
  };
  const configured = process.env.WAN_PRIME_PURCHASE_CEILING_USD?.trim();
  const serverCap = configured ? Math.floor(Number(configured) * 1e6) : Number.MAX_SAFE_INTEGER;
  const quotedUsdMicros =
    params.pricing.currency?.toUpperCase() === 'USD' && Number.isSafeInteger(params.pricing.totalCents)
      ? params.pricing.totalCents * 10_000
      : -1;
  const cap = Math.min(serverCap, quotedUsdMicros);
  return planWanPrimePurchase(request, {
    ceilingMicros: cap,
    unavailable: params.fallbackToFalEnabled ? {} : { fal: 'Fal fallback disabled' },
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
