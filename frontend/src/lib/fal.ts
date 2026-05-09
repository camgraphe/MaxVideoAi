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
import type { GenerateHooks, GeneratePayload, GenerateResult } from '@/lib/fal-types';

export { FalGenerationError } from '@/lib/fal-error';
export {
  normalizeFalDurationValueForModel,
  resolveFalModelSlug,
  resolveFalVideoResolutionInput,
} from '@/lib/fal-model-helpers';
export type { GenerateAttachment, GenerateHooks, GeneratePayload, GenerateResult } from '@/lib/fal-types';

let warnedMissingWebhookUrl = false;

export async function generateVideo(payload: GeneratePayload, hooks?: GenerateHooks): Promise<GenerateResult> {
  const provider = getResultProviderMode();
  if (!ENV.FAL_API_KEY) {
    throw new Error('FAL_API_KEY is missing');
  }
  const resolvedFallback = await resolveFalModelId(payload.engineId);
  const resolvedModelSlug = resolveFalModelSlug(payload, resolvedFallback);
  if (!resolvedModelSlug && !payload.soraRequest) {
    throw new Error('Unable to resolve FAL model for requested engine');
  }

  return generateViaFal(payload, provider, resolvedModelSlug ?? '', hooks);
}

async function generateViaFal(
  payload: GeneratePayload,
  provider: ResultProviderMode,
  defaultModel: string,
  hooks?: GenerateHooks
): Promise<GenerateResult> {
  const fallbackThumb = getThumbForAspectRatio(payload.aspectRatio);
  const falClient = getFalClient();
  const { model, requestBody } = buildFalGenerationRequest(payload, defaultModel);

  let latestQueueStatus: QueueStatus | null = null;
  const webhookUrl = getFalWebhookUrl() ?? undefined;
  if (!webhookUrl && !warnedMissingWebhookUrl) {
    warnedMissingWebhookUrl = true;
    console.warn('[fal] No webhook URL configured; relying on polling only.');
  }
  let enqueuedRequestId: string | undefined;
  let result: Awaited<ReturnType<typeof falClient.subscribe>>;
  try {
    result = await falClient.subscribe(model, {
      input: requestBody,
      webhookUrl,
      mode: 'polling',
      onEnqueue(requestId) {
        if (typeof requestId === 'string') {
          enqueuedRequestId = requestId;
          if (hooks?.onRequestId) {
            Promise.resolve(hooks.onRequestId(requestId)).catch((error) => {
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
      },
    });
  } catch (error) {
    const metadataStatus =
      typeof (error as { $metadata?: { httpStatusCode?: number } } | undefined)?.$metadata?.httpStatusCode === 'number'
        ? (error as { $metadata?: { httpStatusCode?: number } }).$metadata!.httpStatusCode
        : undefined;
    const statusCandidate =
      typeof (error as { status?: number } | undefined)?.status === 'number'
        ? (error as { status?: number }).status
        : metadataStatus;
    const queueRequestId = (latestQueueStatus as { request_id?: string } | null)?.request_id;
    const fallbackProviderJobId =
      enqueuedRequestId ??
      queueRequestId ??
      (error as { providerJobId?: string } | undefined)?.providerJobId ??
      (error as { requestId?: string } | undefined)?.requestId ??
      (error as { request_id?: string } | undefined)?.request_id ??
      (error as { response?: { request_id?: string; id?: string } } | undefined)?.response?.request_id ??
      (error as { response?: { request_id?: string; id?: string } } | undefined)?.response?.id ??
      undefined;
    const bodyCandidate =
      (error as { body?: unknown } | undefined)?.body ??
      (error as { response?: unknown } | undefined)?.response ??
      (error as { data?: unknown } | undefined)?.data ??
      null;
    const message = error instanceof Error ? error.message : 'Fal request failed';
    const falError = new FalGenerationError(message, {
      status: statusCandidate,
      body: bodyCandidate,
      providerJobId: fallbackProviderJobId,
      cause: error,
    });
    if ((error as { $metadata?: unknown } | undefined)?.$metadata) {
      (falError as { $metadata?: unknown }).$metadata = (error as { $metadata?: unknown }).$metadata;
    }
    (falError as { originalError?: unknown }).originalError = error;
    if (fallbackProviderJobId && hooks?.onRequestId) {
      Promise.resolve(hooks.onRequestId(fallbackProviderJobId)).catch((hookError) => {
        console.warn('[fal] onRequestId hook failed after error', hookError);
      });
    }
    throw falError;
  }

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
      Promise.resolve(hooks.onRequestId(providerJobId)).catch((error) => {
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
    Promise.resolve(hooks.onRequestId(resolvedProviderJobId)).catch((error) => {
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
}
