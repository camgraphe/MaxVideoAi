import { getWanSubmissionClient, isWanDirectProvider, type WanDirectProvider } from '@/server/video-providers/wan-transports';
import type { createApimartClient } from '@/server/video-providers/apimart/wan-prime';
import { nextPurchaseProvider, type PurchaseDecision } from '@/lib/video-purchase-decision';
import { buildWanPurchaseDecision, classifyWanPurchaseFailure } from './wan-purchase-routing';
import type { GeneratePayload, GenerateResult } from '@/lib/fal';
import { query } from '@/lib/db';
import type { NormalizedVideoProviderTask } from '@/server/video-providers/types';
import { persistDirectProviderAcceptance } from './direct-provider-acceptance';
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
import { createWanMediaTransport } from '@/server/video-providers/alibaba-model-studio/media-access';
import type { createOwnedMediaReadUrl } from '@/server/owned-media-read-access';
import { sanitizeProviderMediaDiagnostics } from '@/server/provider-media-diagnostics';
import type { AlibabaReferenceAsset } from '@/server/video-providers/alibaba-model-studio/types';
import {
  createProviderAttempt, ProviderAttemptAlreadyClaimed,
  linkProviderFallbackAttempt,
  markProviderAttemptAccepted,
  markProviderAttemptFailed,
  markProviderAttemptFinished,
} from '@/server/video-providers/provider-attempts';
import { buildUserFacingRefundDescription } from '@/server/user-facing-failure-messages';
import { createProviderJobTracker } from './provider-job-tracker';
import { rollbackPendingPayment } from './payment-rollback';
import { isDeferredFalSubmission, submitFalGenerateTask, type FalGenerateSubmissionResult } from './fal-submission';
import { reconcileFalFallbackTerminalResponse } from './fal-fallback-outcome';
import type { FalInputSummary } from './fal-request';
import type { PaymentMode, PendingReceipt } from './initial-video-job';

type QueryFn = <T = unknown>(sql: string, params?: unknown[]) => Promise<T[]>;
type LogMetricFn = (
  kind: 'accepted' | 'failed' | 'rejected' | 'completed',
  event?: { jobId?: string; errorCode?: string; meta?: Record<string, unknown>; durationMs?: number }
) => void;

type AlibabaSubmissionClient = Pick<ReturnType<typeof getAlibabaModelStudioClient>, 'createVideo' | 'getTask'>;
type AlibabaSubmissionDeps = {
  getApimartClientFn?: typeof createApimartClient;
  createOwnedMediaReadUrlFn?: typeof createOwnedMediaReadUrl;
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
  if (errorCode === 'REFERENCE_INVALID' || errorCode === 'REFERENCE_ACCESS_FAILED') {
    return 'Reference media could not be read. Select it again from your library or import it again.';
  }
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
  onlyBeforeSubmission?: boolean;
}) {
  const paymentStatusOverride = params.pendingReceipt
    ? params.paymentMode === 'wallet' ? 'refunded_wallet' : 'refunded'
    : null;
  const rows = await params.queryFn(
    `UPDATE app_jobs
        SET status = 'failed', progress = 0, message = $2, provisional = FALSE,
            payment_status = CASE WHEN $3::text IS NOT NULL THEN $3 ELSE payment_status END,
            updated_at = NOW()
      WHERE job_id = $1
        ${params.onlyBeforeSubmission ? `AND provider_job_id IS NULL AND status IN ('queued','pending')
          AND NOT EXISTS (SELECT 1 FROM provider_attempts a WHERE a.job_id = app_jobs.id)
          RETURNING job_id` : ''}`,
    [params.jobId, params.message, paymentStatusOverride]
  );
  if (params.onlyBeforeSubmission && !rows.length) return false;
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
  return true;
}

function falProviderJobId(result: FalGenerateSubmissionResult, getLastProviderJobId: () => string | null): string | null {
  if (result.ok) return result.generationResult.providerJobId ?? getLastProviderJobId();
  return typeof result.body.providerJobId === 'string' ? result.body.providerJobId : getLastProviderJobId();
}

async function submitFalFallback(params: {
  userId: string;
  directAttemptId: number | null;
  decision?: PurchaseDecision;
  attemptIndex?: number;
  claimOnce?: boolean;
  fallbackFrom?: string;
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
    attemptIndex: params.attemptIndex ?? 2,
    claimOnce: params.claimOnce,
    provider: 'fal',
    providerModel: params.falPayload.engineId,
    status: params.directAttemptId === null ? 'submit_started' : 'fallback_started',
    requestSnapshot: params.directAttemptId === null ? { purchaseRouting: { ...params.decision, version: 1, mode: 'canary' } } : {
      fallbackFrom: params.fallbackFrom ?? ALIBABA_MODEL_STUDIO_PROVIDER,
      fallbackReason: params.reason,
      fallbackErrorCode: params.errorCode,
    },
    queryFn: params.queryFn,
  });
  if (params.directAttemptId !== null) await linkProviderFallbackAttempt({
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
    userId: params.userId,
    falPayload: { ...params.falPayload, submissionMode: 'enqueue' },
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
  const recovered = await reconcileFalFallbackTerminalResponse({ jobId: params.jobId, result,
    attemptId: attempt.id, acceptedProviderJobId: tracker.getLastProviderJobId(), queryFn: params.queryFn });
  if (recovered) return recovered;
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
    if (isDeferredFalSubmission(result)) return result;
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

type WanSubmissionParams = {
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
  purchaseCanary?: boolean;
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
};

export async function submitAlibabaModelStudioGenerateTask(params: WanSubmissionParams): Promise<AlibabaModelStudioGenerateSubmissionResult> {
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
  const decision = params.engineId === 'wan-3-prime' ? buildWanPurchaseDecision(params, resolution, media) : null;
  // An unsupported request always retains its established provider contract.
  const active = Boolean(params.purchaseCanary && decision?.canaryEligible);
  const selected = active ? decision?.order[0] : ALIBABA_MODEL_STUDIO_PROVIDER;
  if (!selected) {
    const message = 'No compatible provider fits the purchase ceiling.';
    const stopped = await failJobAndRollback({ ...params, message, queryFn, onlyBeforeSubmission: true,
      rollbackPendingPaymentFn: deps.rollbackPendingPaymentFn ?? rollbackPendingPayment });
    if (!stopped) return deferred(params.jobId);
    return { ok: false, status: 503, body: { ok: false, error: 'NO_ELIGIBLE_VIDEO_PROVIDER', message } };
  }
  const context = { params, route, media, resolution, estimate, active, plan: decision, deps, queryFn };
  try {
    if (selected === 'fal') {
      return await submitFalFallback({ ...params, directAttemptId: null, attemptIndex: 1, decision: decision ?? undefined,
        claimOnce: true, reason: 'lowest_cost', errorCode: null, queryFn,
        submitFalGenerateTaskFn: deps.submitFalGenerateTaskFn ?? submitFalGenerateTask });
    }
    if (!isWanDirectProvider(selected)) throw new Error('Unsupported primary Wan transport');
    return await submitWanAttempt(context, selected, 1, null);
  } catch (error) {
    if (error instanceof ProviderAttemptAlreadyClaimed) return deferred(params.jobId);
    throw error;
  }
}

function deferred(jobId: string): AlibabaModelStudioGenerateSubmissionResult {
  return { ok: true, kind: 'accepted', body: {
    ok: true, jobId, status: 'running', deferred: true, message: 'Submission is being reconciled. Do not submit again.',
  } };
}

type WanAttemptContext = {
  params: WanSubmissionParams;
  route: NonNullable<ReturnType<typeof resolveAlibabaModelRoute>>;
  media: ReturnType<typeof resolveAlibabaSubmissionMediaInputs>;
  resolution: string;
  estimate: ReturnType<typeof estimateAlibabaProviderCost>;
  active: boolean;
  plan: PurchaseDecision | null;
  deps: AlibabaSubmissionDeps;
  queryFn: QueryFn;
};

async function submitWanAttempt(
  context: WanAttemptContext, provider: WanDirectProvider, attemptIndex: number, previousAttemptId: number | null,
): Promise<AlibabaModelStudioGenerateSubmissionResult> {
  const { params, route, media, resolution, estimate, active, plan, deps, queryFn } = context;
  const costMicros = plan?.candidates.find(candidate => candidate.provider === provider)?.costMicros;
  const attempt = await createProviderAttempt({
    publicJobId: params.jobId,
    attemptIndex,
    claimOnce: active,
    provider,
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
      estimatedProviderCostUsd: costMicros == null ? estimate.providerCostUsd : costMicros / 1e6,
      ...(plan ? { purchaseRouting: { ...plan, version: 1, mode: active ? 'canary' : 'shadow' } } : {}),
    },
    queryFn,
  });

  if (previousAttemptId != null) await linkProviderFallbackAttempt({ fromAttemptId: previousAttemptId, toAttemptId: attempt.id, queryFn });
  let sent = false;
  let acceptedTask: NormalizedVideoProviderTask;
  let acceptedProviderJobId: string | null = null;
  let sanitizeDiagnostics: (value: unknown) => unknown = route.family === 'wan3'
    ? sanitizeProviderMediaDiagnostics : value => value;
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
    const transport = await createWanMediaTransport({ payload, userId: params.userId }, { read: deps.createOwnedMediaReadUrlFn });
    sanitizeDiagnostics = transport.sanitize;
    const client = getWanSubmissionClient(provider, {
      apimart: deps.getApimartClientFn, alibaba_model_studio: deps.getAlibabaModelStudioClientFn,
    });
    sent = true;
    const task = await client.createVideo(transport.payload);
    acceptedProviderJobId = task.providerJobId;
    acceptedTask = task;
  } catch (error) {
    const normalized = classifyAlibabaModelStudioError(error);
    const failure = sent ? classifyWanPurchaseFailure(provider, error) : { outcome: 'invalid' as const, code: normalized.code ?? normalized.errorClass };
    const next = active && plan ? nextPurchaseProvider(plan.order, provider, failure.outcome) : null;
    if (active && failure.outcome === 'uncertain') {
      // No ACK: preserve the original reservation and leave the operator a durable reconciliation record.
      const message = 'Provider acceptance is unknown. Reconcile this submission before retrying.';
      await queryFn(`UPDATE app_jobs SET provider = $2, status = 'provider_polling_stalled', message = $3,
          provisional = FALSE, updated_at = NOW() WHERE job_id = $1 AND provider_job_id IS NULL
          AND status IN ('pending','queued','running')`, [params.jobId, provider, message])
        .catch(() => console.warn('[wan-purchase] job reconciliation write deferred', { jobId: params.jobId }));
      await markProviderAttemptFinished({ attemptId: attempt.id, status: 'polling_stalled',
        responseSnapshot: { reason: failure.code }, queryFn }).catch(() =>
        console.warn('[wan-purchase] attempt reconciliation write deferred', { jobId: params.jobId }));
      return deferred(params.jobId);
    }
    const fallbackEligible = active ? next !== null : route.fallbackCompatible && shouldFallbackFromAlibabaSubmit({
      acceptedProviderJobId,
      error,
      fallbackToFalEnabled: params.fallbackToFalEnabled,
    });
    try {
      await markProviderAttemptFailed({
        attemptId: attempt.id,
        errorCode: active ? failure.code : normalized.code,
        errorClass: active ? failure.outcome : normalized.errorClass,
        fallbackEligible,
        responseSnapshot: sanitizeDiagnostics(normalized.raw),
        queryFn,
      });
    } catch {
      // The accepted task identity remains authoritative even if local persistence is degraded.
    }

    if (isWanDirectProvider(next)) {
      return submitWanAttempt(context, next, attemptIndex + 1, attempt.id);
    }
    if (fallbackEligible) {
      return submitFalFallback({
        attemptIndex: attemptIndex + 1, fallbackFrom: provider, claimOnce: active,
        userId: params.userId,
        directAttemptId: attempt.id,
        reason: active ? failure.outcome : normalized.errorClass,
        errorCode: active ? failure.code : normalized.code,
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

    const message = provider === 'apimart' && sent
      ? 'The provider declined this generation. Review the request or try again later.'
      : userSafeAlibabaMessage(normalized.errorClass, normalized.code);
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
      meta: { provider, errorClass: normalized.errorClass, accepted: Boolean(acceptedProviderJobId) },
    });
    return {
      ok: false,
      status: statusForAlibabaError(normalized.errorClass),
      body: {
        ok: false,
        error: active ? failure.code : normalized.code ?? 'ALIBABA_MODEL_STUDIO_SUBMIT_FAILED',
        message,
        ...(acceptedProviderJobId ? { jobId: params.jobId, providerJobId: acceptedProviderJobId } : {}),
      },
    };
  }
  let responseSnapshot: unknown = null;
  try {
    responseSnapshot = sanitizeDiagnostics(acceptedTask.raw);
  } catch {
    console.warn('[alibaba-model-studio] accepted diagnostics unavailable', { jobId: params.jobId });
  }
  const status = acceptedTask.status === 'running' ? 'running' : 'queued';
  const progress = acceptedTask.status === 'running' ? 30 : 10;
  return { ok: true, kind: 'accepted', body: await persistDirectProviderAcceptance({
    jobId: params.jobId, provider, providerJobId: acceptedTask.providerJobId,
    attemptId: attempt.id, responseSnapshot, status, progress,
    localKey: params.localKey, queryFn,
    logAccepted: () => params.logMetricFn('accepted', { jobId: params.jobId,
      meta: { provider, providerJobId: acceptedTask.providerJobId, providerModel: route.model } }),
    acceptedBody: {
      ok: true,
      jobId: params.jobId,
      videoUrl: null,
      video: null,
      thumbUrl: params.placeholderThumb,
      status,
      progress,
      pricing: params.pricing,
      paymentStatus: params.paymentStatus,
      provider,
      providerJobId: acceptedTask.providerJobId,
      batchId: params.batchId,
      groupId: params.groupId,
      iterationIndex: params.iterationIndex,
      iterationCount: params.iterationCount,
      renderIds: params.renderIds,
      heroRenderId: params.heroRenderId,
      localKey: params.localKey,
    },
  }) };
}
