import type { GeneratePayload, GenerateResult } from '@/lib/fal';
import { query } from '@/lib/db';
import type { Mode, PricingSnapshot, ProviderClientErrorPolicy } from '@/types/engines';
import { getAlibabaModelStudioClient } from '@/server/video-providers/alibaba-model-studio/client';
import { estimateAlibabaProviderCost } from '@/server/video-providers/alibaba-model-studio/cost';
import {
  classifyAlibabaModelStudioError,
  shouldFallbackFromAlibabaSubmit,
} from '@/server/video-providers/alibaba-model-studio/errors';
import {
  ALIBABA_MODEL_STUDIO_PROVIDER,
  resolveAlibabaModelRoute,
} from '@/server/video-providers/alibaba-model-studio/model-map';
import { buildAlibabaVideoPayload } from '@/server/video-providers/alibaba-model-studio/payload';
import type { AlibabaReferenceAsset } from '@/server/video-providers/alibaba-model-studio/types';
import {
  createProviderAttempt,
  linkProviderFallbackAttempt,
  markProviderAttemptAccepted,
  markProviderAttemptFailed,
  markProviderAttemptFinished,
} from '@/server/video-providers/provider-attempts';
import { buildUserFacingRefundDescription } from '@/server/user-facing-failure-messages';
import { createProviderJobTracker } from './provider-job-tracker';
import { rollbackPendingPayment } from './payment-rollback';
import { submitFalGenerateTask, type FalGenerateSubmissionResult } from './fal-submission';
import type { FalInputSummary } from './fal-request';
import type { PaymentMode, PendingReceipt } from './initial-video-job';

type QueryFn = <T = unknown>(sql: string, params?: unknown[]) => Promise<T[]>;
type LogMetricFn = (
  kind: 'accepted' | 'failed' | 'rejected' | 'completed',
  event?: { jobId?: string; errorCode?: string; meta?: Record<string, unknown>; durationMs?: number }
) => void;

type AlibabaSubmissionClient = Pick<ReturnType<typeof getAlibabaModelStudioClient>, 'createVideo' | 'getTask'>;
type AlibabaSubmissionDeps = {
  getAlibabaModelStudioClientFn?: () => AlibabaSubmissionClient;
  submitFalGenerateTaskFn?: typeof submitFalGenerateTask;
  queryFn?: QueryFn;
  rollbackPendingPaymentFn?: typeof rollbackPendingPayment;
};

export type AlibabaModelStudioGenerateSubmissionResult =
  | { ok: true; kind: 'accepted'; body: Record<string, unknown> }
  | { ok: true; kind: 'fal_result'; generationResult: GenerateResult }
  | { ok: false; status: number; body: Record<string, unknown> };

function cleanUrl(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function addUniqueAsset(assets: AlibabaReferenceAsset[], value: unknown, metadata?: Partial<AlibabaReferenceAsset>) {
  const url = cleanUrl(value);
  if (!url) return;
  const existing = assets.find((asset) => asset.url === url);
  if (existing) {
    if (metadata?.mimeType) existing.mimeType = metadata.mimeType;
    if (typeof metadata?.durationSec === 'number') existing.durationSec = metadata.durationSec;
    return;
  }
  assets.push({ url, ...metadata });
}

export function resolveAlibabaSubmissionMediaInputs(params: {
  imageUrl: string | null | undefined;
  falPayload: GeneratePayload;
}): {
  startImageUrl: string | null;
  endImageUrl: string | null;
  referenceImages: AlibabaReferenceAsset[];
  referenceVideos: AlibabaReferenceAsset[];
  referenceAudio: AlibabaReferenceAsset[];
  inputVideoDurationSec: number | null;
} {
  let startImageUrl = cleanUrl(params.imageUrl) ?? cleanUrl(params.falPayload.imageUrl);
  let endImageUrl = cleanUrl(params.falPayload.endImageUrl);
  const referenceImages: AlibabaReferenceAsset[] = [];
  const referenceVideos: AlibabaReferenceAsset[] = [];
  const referenceAudio: AlibabaReferenceAsset[] = [];

  for (const url of params.falPayload.referenceImages ?? []) addUniqueAsset(referenceImages, url);
  addUniqueAsset(referenceVideos, params.falPayload.videoUrl);
  addUniqueAsset(referenceAudio, params.falPayload.audioUrl);

  for (const input of params.falPayload.inputs ?? []) {
    const url = cleanUrl(input.url) ?? cleanUrl(input.dataUrl);
    if (!url) continue;
    const slotId = input.slotId?.trim().toLowerCase() ?? '';
    const metadata = { mimeType: cleanUrl(input.type), durationSec: input.durationSec ?? null };
    if (input.kind === 'image' && ['image_url', 'start_image_url', 'first_frame_url'].includes(slotId)) {
      startImageUrl ??= url;
    } else if (input.kind === 'image' && ['end_image_url', 'last_frame_url'].includes(slotId)) {
      endImageUrl ??= url;
    } else if (input.kind === 'image') {
      addUniqueAsset(referenceImages, url, metadata);
    } else if (input.kind === 'video') {
      addUniqueAsset(referenceVideos, url, metadata);
    } else if (input.kind === 'audio') {
      addUniqueAsset(referenceAudio, url, metadata);
    }
  }

  const knownVideoDurations = referenceVideos
    .map((asset) => asset.durationSec)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  return {
    startImageUrl,
    endImageUrl,
    referenceImages,
    referenceVideos,
    referenceAudio,
    inputVideoDurationSec:
      referenceVideos.length > 0 && knownVideoDurations.length === referenceVideos.length
        ? knownVideoDurations.reduce((sum, duration) => sum + duration, 0)
        : null,
  };
}

function userSafeAlibabaMessage(errorClass: string, errorCode?: string | null): string {
  if (errorCode === 'ALIBABA_REFERENCE_AUDIO_UNSUPPORTED') {
    return 'Wan 3 reference audio must be an MP3 or WAV file. Convert the audio and try again.';
  }
  if (errorClass === 'moderation') {
    return 'This request was blocked by safety checks. Review the prompt and reference media before trying again.';
  }
  if (errorClass === 'invalid_request' || errorClass === 'payload_too_large') {
    return 'This request is not supported with the selected inputs. Adjust the prompt, media, or settings and try again.';
  }
  if (errorClass === 'auth_error' || errorClass === 'billing_or_access' || errorClass === 'region_mismatch') {
    return 'This render option is temporarily unavailable. Please retry later.';
  }
  return 'The render could not start. Please retry later.';
}

function statusForAlibabaError(errorClass: string): number {
  if (errorClass === 'invalid_request' || errorClass === 'moderation') return 400;
  if (errorClass === 'payload_too_large') return 413;
  return 503;
}

async function failJobAndRollback(params: {
  jobId: string;
  engineLabel: string;
  durationSec: number;
  message: string;
  pendingReceipt: PendingReceipt | null;
  paymentMode: PaymentMode;
  walletChargeReserved: boolean;
  queryFn: QueryFn;
  rollbackPendingPaymentFn: typeof rollbackPendingPayment;
}) {
  const paymentStatusOverride = params.pendingReceipt
    ? params.paymentMode === 'wallet' ? 'refunded_wallet' : 'refunded'
    : null;
  await params.queryFn(
    `UPDATE app_jobs
        SET status = 'failed', progress = 0, message = $2, provisional = FALSE,
            payment_status = CASE WHEN $3::text IS NOT NULL THEN $3 ELSE payment_status END,
            updated_at = NOW()
      WHERE job_id = $1`,
    [params.jobId, params.message, paymentStatusOverride]
  );
  if (params.pendingReceipt) {
    await params.rollbackPendingPaymentFn({
      pendingReceipt: params.pendingReceipt,
      walletChargeReserved: params.walletChargeReserved,
      refundDescription: buildUserFacingRefundDescription({
        engineLabel: params.engineLabel,
        durationSec: params.durationSec,
        reason: params.message,
      }),
    });
  }
}

function falProviderJobId(result: FalGenerateSubmissionResult, getLastProviderJobId: () => string | null): string | null {
  if (result.ok) return result.generationResult.providerJobId ?? getLastProviderJobId();
  return typeof result.body.providerJobId === 'string' ? result.body.providerJobId : getLastProviderJobId();
}

async function submitFalFallback(params: {
  directAttemptId: number;
  reason: string;
  errorCode: string | null;
  jobId: string;
  engineId: string;
  engineLabel: string;
  prompt: string;
  falPayload: GeneratePayload;
  falInputSummary: FalInputSummary;
  isLumaRay2: boolean;
  batchId: string | null;
  durationSec: number;
  pendingReceipt: PendingReceipt | null;
  paymentMode: PaymentMode;
  walletChargeReserved: boolean;
  queryFn: QueryFn;
  submitFalGenerateTaskFn: typeof submitFalGenerateTask;
  logMetricFn: LogMetricFn;
  clientErrorPolicy?: ProviderClientErrorPolicy;
}): Promise<AlibabaModelStudioGenerateSubmissionResult> {
  const attempt = await createProviderAttempt({
    publicJobId: params.jobId,
    attemptIndex: 2,
    provider: 'fal',
    providerModel: params.falPayload.engineId,
    status: 'fallback_started',
    requestSnapshot: {
      fallbackFrom: ALIBABA_MODEL_STUDIO_PROVIDER,
      fallbackReason: params.reason,
      fallbackErrorCode: params.errorCode,
    },
    queryFn: params.queryFn,
  });
  await linkProviderFallbackAttempt({
    fromAttemptId: params.directAttemptId,
    toAttemptId: attempt.id,
    queryFn: params.queryFn,
  });
  await params.queryFn(`UPDATE app_jobs SET provider = 'fal', updated_at = NOW() WHERE job_id = $1`, [params.jobId]);
  const tracker = createProviderJobTracker({
    jobId: params.jobId,
    providerKey: 'fal',
    engineId: params.engineId,
    prompt: params.prompt,
    inputSummary: params.falInputSummary,
    queryFn: params.queryFn,
  });
  const result = await params.submitFalGenerateTaskFn({
    falPayload: params.falPayload,
    jobId: params.jobId,
    engineId: params.engineId,
    engineLabel: params.engineLabel,
    isLumaRay2: params.isLumaRay2,
    batchId: params.batchId,
    durationSec: params.durationSec,
    pendingReceipt: params.pendingReceipt,
    paymentMode: params.paymentMode,
    walletChargeReserved: params.walletChargeReserved,
    getLastProviderJobId: tracker.getLastProviderJobId,
    setLastProviderJobId: tracker.setLastProviderJobId,
    persistProviderJobId: tracker.persistProviderJobId,
    logMetricFn: params.logMetricFn,
    clientErrorPolicy: params.clientErrorPolicy,
  });
  const providerJobId = falProviderJobId(result, tracker.getLastProviderJobId);
  if (providerJobId) {
    await markProviderAttemptAccepted({
      attemptId: attempt.id,
      providerJobId,
      responseSnapshot: result.ok ? result.generationResult : result.body,
      queryFn: params.queryFn,
    });
  }
  if (!result.ok) {
    await markProviderAttemptFailed({
      attemptId: attempt.id,
      errorCode: typeof result.body.error === 'string' ? result.body.error : null,
      errorClass: 'fal_fallback_failed',
      fallbackEligible: false,
      responseSnapshot: result.body,
      queryFn: params.queryFn,
    });
    return result;
  }
  if (result.generationResult.status === 'completed') {
    await markProviderAttemptFinished({
      attemptId: attempt.id,
      status: 'completed',
      responseSnapshot: result.generationResult,
      queryFn: params.queryFn,
    });
  }
  return { ok: true, kind: 'fal_result', generationResult: result.generationResult };
}

export async function submitAlibabaModelStudioGenerateTask(params: {
  jobId: string;
  userId: string;
  engineId: string;
  engineLabel: string;
  mode: Mode;
  prompt: string;
  negativePrompt?: string | null;
  durationSec: number;
  aspectRatio: string | null;
  audioEnabled: boolean | undefined;
  effectiveResolution: string | null;
  imageUrl: string | null | undefined;
  placeholderThumb: string;
  pricing: PricingSnapshot;
  paymentStatus: string;
  pendingReceipt: PendingReceipt | null;
  paymentMode: PaymentMode;
  walletChargeReserved: boolean;
  fallbackToFalEnabled: boolean;
  falPayload: GeneratePayload;
  falInputSummary: FalInputSummary;
  isLumaRay2: boolean;
  batchId: string | null;
  groupId: string | null;
  iterationIndex: number | null;
  iterationCount: number | null;
  renderIds: Array<string | null> | null;
  heroRenderId: string | null;
  localKey: string | null;
  logMetricFn: LogMetricFn;
  clientErrorPolicy?: ProviderClientErrorPolicy;
  deps?: AlibabaSubmissionDeps;
}): Promise<AlibabaModelStudioGenerateSubmissionResult> {
  const deps = params.deps ?? {};
  const queryFn = deps.queryFn ?? query;
  const route = resolveAlibabaModelRoute(params.engineId, params.mode);
  if (!route) {
    return { ok: false, status: 400, body: { ok: false, error: 'ALIBABA_MODEL_MODE_UNSUPPORTED' } };
  }
  const media = resolveAlibabaSubmissionMediaInputs({ imageUrl: params.imageUrl, falPayload: params.falPayload });
  const resolution = params.effectiveResolution ?? params.falPayload.resolution ?? '720p';
  const estimate = estimateAlibabaProviderCost({
    engineId: params.engineId,
    mode: params.mode,
    durationSec: params.durationSec,
    inputVideoDurationSec: media.inputVideoDurationSec ?? undefined,
    resolution,
  });
  const attempt = await createProviderAttempt({
    publicJobId: params.jobId,
    attemptIndex: 1,
    provider: ALIBABA_MODEL_STUDIO_PROVIDER,
    providerModel: route.model,
    requestSnapshot: {
      engineId: params.engineId,
      mode: params.mode,
      providerModel: route.model,
      durationSec: params.durationSec,
      inputVideoDurationSec: media.inputVideoDurationSec,
      aspectRatio: params.aspectRatio,
      resolution,
      audioEnabled: params.audioEnabled === true,
      hasStartImage: Boolean(media.startImageUrl),
      hasEndImage: Boolean(media.endImageUrl),
      referenceImageCount: media.referenceImages.length,
      referenceVideoCount: media.referenceVideos.length,
      referenceAudioCount: media.referenceAudio.length,
      promptLength: params.prompt.length,
      estimatedProviderCostUsd: estimate.providerCostUsd,
    },
    queryFn,
  });

  let acceptedProviderJobId: string | null = null;
  try {
    const extraInputValues = params.falPayload.extraInputValues ?? {};
    const payload = buildAlibabaVideoPayload({
      engineId: params.engineId,
      mode: params.mode,
      prompt: params.prompt,
      durationSec: params.durationSec,
      resolution,
      aspectRatio: params.aspectRatio ?? params.falPayload.aspectRatio,
      audioEnabled: params.audioEnabled,
      startImageUrl: media.startImageUrl,
      endImageUrl: media.endImageUrl,
      referenceImageUrls: media.referenceImages,
      referenceVideoUrls: media.referenceVideos,
      referenceAudioUrls: media.referenceAudio,
      inputVideoDurationSec: media.inputVideoDurationSec,
      fileUrl: cleanUrl(extraInputValues.file_url),
      webUrl: cleanUrl(extraInputValues.web_url),
      promptExtend:
        typeof extraInputValues.enable_prompt_expansion === 'boolean'
          ? extraInputValues.enable_prompt_expansion
          : undefined,
      seed: params.falPayload.seed,
    });
    const task = await (deps.getAlibabaModelStudioClientFn ?? getAlibabaModelStudioClient)().createVideo(payload);
    acceptedProviderJobId = task.providerJobId;
    await markProviderAttemptAccepted({
      attemptId: attempt.id,
      providerJobId: acceptedProviderJobId,
      responseSnapshot: task.raw,
      queryFn,
    });
    const status = task.status === 'running' ? 'running' : 'queued';
    const progress = task.status === 'running' ? 30 : 10;
    await queryFn(
      `UPDATE app_jobs
          SET status = $2, progress = $3, message = $4, provider = $5,
              provider_job_id = $6, provisional = FALSE, updated_at = NOW()
        WHERE job_id = $1`,
      [params.jobId, status, progress, 'Render submitted.', ALIBABA_MODEL_STUDIO_PROVIDER, acceptedProviderJobId]
    );
    params.logMetricFn('accepted', {
      jobId: params.jobId,
      meta: { provider: ALIBABA_MODEL_STUDIO_PROVIDER, providerJobId: acceptedProviderJobId, providerModel: route.model },
    });
    return {
      ok: true,
      kind: 'accepted',
      body: {
        ok: true,
        jobId: params.jobId,
        videoUrl: null,
        video: null,
        thumbUrl: params.placeholderThumb,
        status,
        progress,
        pricing: params.pricing,
        paymentStatus: params.paymentStatus,
        provider: ALIBABA_MODEL_STUDIO_PROVIDER,
        providerJobId: acceptedProviderJobId,
        batchId: params.batchId,
        groupId: params.groupId,
        iterationIndex: params.iterationIndex,
        iterationCount: params.iterationCount,
        renderIds: params.renderIds,
        heroRenderId: params.heroRenderId,
        localKey: params.localKey,
      },
    };
  } catch (error) {
    const normalized = classifyAlibabaModelStudioError(error);
    const fallbackEligible = route.fallbackCompatible && shouldFallbackFromAlibabaSubmit({
      acceptedProviderJobId,
      error,
      fallbackToFalEnabled: params.fallbackToFalEnabled,
    });
    try {
      await markProviderAttemptFailed({
        attemptId: attempt.id,
        errorCode: normalized.code,
        errorClass: normalized.errorClass,
        fallbackEligible,
        responseSnapshot: normalized.raw,
        queryFn,
      });
    } catch {
      // The accepted task identity remains authoritative even if local persistence is degraded.
    }

    if (fallbackEligible) {
      return submitFalFallback({
        directAttemptId: attempt.id,
        reason: normalized.errorClass,
        errorCode: normalized.code,
        jobId: params.jobId,
        engineId: params.engineId,
        engineLabel: params.engineLabel,
        prompt: params.prompt,
        falPayload: params.falPayload,
        falInputSummary: params.falInputSummary,
        isLumaRay2: params.isLumaRay2,
        batchId: params.batchId,
        durationSec: params.durationSec,
        pendingReceipt: params.pendingReceipt,
        paymentMode: params.paymentMode,
        walletChargeReserved: params.walletChargeReserved,
        queryFn,
        submitFalGenerateTaskFn: deps.submitFalGenerateTaskFn ?? submitFalGenerateTask,
        logMetricFn: params.logMetricFn,
        clientErrorPolicy: params.clientErrorPolicy,
      });
    }

    const message = userSafeAlibabaMessage(normalized.errorClass, normalized.code);
    if (!acceptedProviderJobId) {
      await failJobAndRollback({
        jobId: params.jobId,
        engineLabel: params.engineLabel,
        durationSec: params.durationSec,
        message,
        pendingReceipt: params.pendingReceipt,
        paymentMode: params.paymentMode,
        walletChargeReserved: params.walletChargeReserved,
        queryFn,
        rollbackPendingPaymentFn: deps.rollbackPendingPaymentFn ?? rollbackPendingPayment,
      });
    }
    params.logMetricFn('failed', {
      jobId: params.jobId,
      errorCode: normalized.code ?? normalized.errorClass,
      meta: { provider: ALIBABA_MODEL_STUDIO_PROVIDER, errorClass: normalized.errorClass, accepted: Boolean(acceptedProviderJobId) },
    });
    return {
      ok: false,
      status: statusForAlibabaError(normalized.errorClass),
      body: {
        ok: false,
        error: normalized.code ?? 'ALIBABA_MODEL_STUDIO_SUBMIT_FAILED',
        message,
        ...(acceptedProviderJobId ? { jobId: params.jobId, providerJobId: acceptedProviderJobId } : {}),
      },
    };
  }
}
