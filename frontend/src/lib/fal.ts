import type { FalQueueReceipt } from '@/lib/fal-queue-receipt';
import {nativeFluxDraftSubmission} from '@/server/flux-draft-provenance';
import type { QueueStatus } from '@fal-ai/client';
import { ENV } from '@/lib/env';
import { getResultProviderMode } from '@/lib/result-provider';
import type { ResultProviderMode } from '@/types/providers';
import { resolveFalModelId } from '@/lib/fal-catalog';
import { getFalClient } from '@/lib/fal-client';
import { FalGenerationError } from '@/lib/fal-error';
import { resolveFalModelSlug } from '@/lib/fal-model-helpers';
import { buildFalGenerationRequest } from '@/lib/fal-request-body';
import {
  ensureAssetShape,
  extractVideoAsset,
  getThumbForAspectRatio,
  normalizePendingProgress,
  normalizePendingStatus,
  unwrapFalResponse,
} from '@/lib/fal-response';
import { getFalWebhookUrl } from '@/lib/fal-webhook-url';
import { submitFalQueueOnce } from '@/lib/fal-queue-submit';
import type { GenerateHooks, GeneratePayload, GenerateResult } from '@/lib/fal-types';
import { assertKlingV4ReleaseReady } from '@/server/video-generation/kling-v4-release-policy';
import { createFalTransportError } from '@/lib/fal-error-provenance';

export { FalGenerationError } from '@/lib/fal-error';
export {
  normalizeFalDurationValueForModel,
  resolveFalModelSlug,
  resolveFalVideoResolutionInput,
} from '@/lib/fal-model-helpers';
export type { GenerateAttachment, GenerateHooks, GeneratePayload, GenerateResult } from '@/lib/fal-types';

let warnedMissingWebhookUrl = false;

export async function generateVideo(payload: GeneratePayload, hooks?: GenerateHooks): Promise<GenerateResult> {
  let provider: ResultProviderMode;
  let modelSlug: string;
  try {
    assertKlingV4ReleaseReady(payload.engineId);
    provider = getResultProviderMode();
    if (!ENV.FAL_API_KEY) throw new Error('FAL_API_KEY is missing');
    const resolvedFallback = await resolveFalModelId(payload.engineId);
    const resolvedModelSlug = resolveFalModelSlug(payload, resolvedFallback);
    if (!resolvedModelSlug && !payload.soraRequest) throw new Error('Unable to resolve FAL model for requested engine');
    modelSlug = resolvedModelSlug ?? '';
  } catch (error) {
    const source = error as { status?: number; code?: string } | null;
    throw new FalGenerationError(error instanceof Error ? error.message : 'Generation preparation failed', {
      phase: 'pre_submission', status: source?.status, code: source?.code, cause: error,
    });
  }
  return generateViaFal(payload, provider, modelSlug, hooks);
}

async function generateViaFal(
  payload: GeneratePayload,
  provider: ResultProviderMode,
  defaultModel: string,
  hooks?: GenerateHooks
): Promise<GenerateResult> {
  const fallbackThumb = getThumbForAspectRatio(payload.aspectRatio);
  const falClient = getFalClient();
  const { model, requestBody, submissionProof } = (() => {
    try {
      const request = buildFalGenerationRequest(payload, defaultModel);
      return { ...request, submissionProof: nativeFluxDraftSubmission(payload.engineId, payload.mode, request.model, request.requestBody) };
    } catch (error) {
      const source = error as { status?: number; code?: string } | null;
      throw new FalGenerationError(error instanceof Error ? error.message : 'Generation request preparation failed', {
        phase: 'pre_submission', status: source?.status, code: source?.code, cause: error,
      });
    }
  })();
  let latestQueueStatus: QueueStatus | null = null;
  const webhookUrl = getFalWebhookUrl() ?? undefined;
  if (!webhookUrl && !warnedMissingWebhookUrl) {
    warnedMissingWebhookUrl = true;
    console.warn('[fal] No webhook URL configured; relying on polling only.');
  }
  let enqueuedRequestId: string | undefined;
  let resultReadQualified = false;
  let queueReceipt: FalQueueReceipt | undefined;
  let result: Awaited<ReturnType<typeof falClient.subscribe>>;
  try {
    if (payload.submissionMode === 'enqueue' || payload.engineId === 'kling-v4') {
      enqueuedRequestId = await submitFalQueueOnce(model, requestBody, payload.jobId, fetch,
        async (requestId, receipt) => {
          // Preserve the accepted identity before persistence can fail. Never resubmit it.
          enqueuedRequestId = requestId;
          queueReceipt = payload.engineId === 'kling-v4' ? receipt : undefined;
          await hooks?.onRequestId?.(requestId, submissionProof, queueReceipt);
        });
      if (!enqueuedRequestId) throw new Error('FAL queue response did not contain a request ID');
      return {
        provider,
        thumbUrl: fallbackThumb,
        providerJobId: enqueuedRequestId,
        status: 'queued',
        progress: 0,
      };
    }
    result = await falClient.subscribe(model, {
      input: requestBody,
      webhookUrl,
      mode: 'polling',
      onEnqueue(requestId) {
        if (typeof requestId === 'string' && requestId.trim()) {
          enqueuedRequestId = requestId.trim();
          if (hooks?.onRequestId) {
            Promise.resolve(hooks.onRequestId(enqueuedRequestId, submissionProof)).catch((error) => {
              console.warn('[fal] onRequestId hook failed', error);
            });
          }
        }
      },
      onQueueUpdate(update) {
        latestQueueStatus = update;
        if (hooks?.onQueueUpdate) {
          Promise.resolve(hooks.onQueueUpdate(update)).catch((error) => {
            console.warn('[fal] onQueueUpdate hook failed', error);
          });
        }
        // SDK 1.7.0 calls this before resolving subscribeToStatus and starting result GET.
        // A synchronous local hook exception above must never qualify a provider result.
        if (enqueuedRequestId && update.status === 'COMPLETED'
          && (!('request_id' in update) || update.request_id === enqueuedRequestId)) {
          resultReadQualified = true;
        }
      },
    });
  } catch (error) {
    const falError = createFalTransportError(error, {
      acceptedRequestId: enqueuedRequestId,
      resultReadQualified,
      singlePost: payload.submissionMode === 'enqueue' || payload.engineId === 'kling-v4',
    });
    if (enqueuedRequestId && hooks?.onRequestId) {
      Promise.resolve().then(() => hooks.onRequestId?.(enqueuedRequestId!, submissionProof, queueReceipt)).catch((hookError) => {
        console.warn('[fal] onRequestId hook failed after error', hookError);
      });
    }
    throw falError;
  }

  try {
    const json = unwrapFalResponse(result.data);
    const queueRequestId = (latestQueueStatus as { request_id?: string } | null)?.request_id;
    const providerJobId: string | undefined =
      enqueuedRequestId ??
      result.requestId ??
      json?.request_id ??
      json?.id ??
      queueRequestId;
    const immediateAsset = extractVideoAsset(json);
    if (immediateAsset) {
      const asset = ensureAssetShape(immediateAsset);
      const thumbUrl = asset.thumbnailUrl ?? fallbackThumb;
      if (providerJobId && hooks?.onRequestId) {
        Promise.resolve(hooks.onRequestId(providerJobId, submissionProof)).catch((error) => {
          console.warn('[fal] onRequestId hook failed after immediate result', error);
        });
      }
      return {
        provider,
        thumbUrl,
        providerJobId,
        videoUrl: asset.url,
        video: asset,
        status: 'completed',
        progress: 100,
      };
    }

    const fallbackStatus = normalizePendingStatus(latestQueueStatus, json);
    const fallbackProgress = normalizePendingProgress(latestQueueStatus, json);

    if (!providerJobId && !fallbackStatus.providerJobIdFallback) {
      throw new Error('FAL response did not contain a video asset');
    }

    const resolvedProviderJobId = providerJobId ?? fallbackStatus.providerJobIdFallback ?? undefined;
    if (resolvedProviderJobId && hooks?.onRequestId) {
      Promise.resolve(hooks.onRequestId(resolvedProviderJobId, submissionProof)).catch((error) => {
        console.warn('[fal] onRequestId hook failed after pending result', error);
      });
    }
    return {
      provider,
      thumbUrl: fallbackThumb,
      providerJobId: resolvedProviderJobId,
      status: fallbackStatus.status,
      progress: fallbackProgress,
    };
  } catch (error) {
    const source = error as { status?: number; body?: unknown; code?: string } | null;
    throw new FalGenerationError(error instanceof Error ? error.message : 'Accepted result processing failed', {
      phase: enqueuedRequestId ? 'accepted' : 'submission_unknown', providerJobId: enqueuedRequestId,
      status: source?.status, body: source?.body, code: source?.code, cause: error,
    });
  }

}
