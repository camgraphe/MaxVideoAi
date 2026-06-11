import type { GeneratePayload, GenerateResult } from '@/lib/fal';
import { query } from '@/lib/db';
import type { Mode, PricingSnapshot } from '@/types/engines';
import { getLumaAgentsClient } from '@/server/video-providers/luma-agents/client';
import { estimateLumaAgentsVideoCost } from '@/server/video-providers/luma-agents/cost';
import {
  classifyLumaAgentsError,
  LumaAgentsError,
  shouldFallbackFromLumaAgentsSubmit,
} from '@/server/video-providers/luma-agents/errors';
import {
  LUMA_AGENTS_DIRECT_PROVIDER,
  resolveLumaAgentsModelRoute,
  resolveLumaAgentsVideoSupport,
} from '@/server/video-providers/luma-agents/model-map';
import { buildLumaAgentsVideoPayload } from '@/server/video-providers/luma-agents/payload';
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
  event?: {
    jobId?: string;
    errorCode?: string;
    meta?: Record<string, unknown>;
    durationMs?: number;
  }
) => void;

type LumaAgentsSubmissionDeps = {
  getLumaAgentsClientFn?: typeof getLumaAgentsClient;
  submitFalGenerateTaskFn?: typeof submitFalGenerateTask;
  queryFn?: QueryFn;
  rollbackPendingPaymentFn?: typeof rollbackPendingPayment;
};

export type LumaAgentsGenerateSubmissionResult =
  | {
      ok: true;
      kind: 'accepted';
      body: Record<string, unknown>;
    }
  | {
      ok: true;
      kind: 'fal_result';
      generationResult: GenerateResult;
    }
  | {
      ok: false;
      status: number;
      body: Record<string, unknown>;
    };

function cleanUrl(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length ? value.trim() : null;
}

function addUniqueUrl(urls: string[], value: unknown) {
  const url = cleanUrl(value);
  if (url && !urls.includes(url)) urls.push(url);
}

function booleanValue(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
  return false;
}

function hasAdvancedDirectOnlyRequest(params: {
  mode: Mode | string;
  advancedDirectOnlyEnabled: boolean;
  falPayload: GeneratePayload;
}): boolean {
  if (params.mode === 'v2v' || params.mode === 'reframe' || params.mode === 'extend') return true;
  const extra = params.falPayload.extraInputValues ?? {};
  return booleanValue(extra.hdr) || booleanValue(extra.exr_export ?? extra.exrExport);
}

export function resolveLumaAgentsSubmissionMediaInputs(params: {
  imageUrl: string | null | undefined;
  falPayload: GeneratePayload;
}): {
  startImageUrl: string | null;
  endImageUrl: string | null;
  sourceVideoUrl: string | null;
  sourceVideoMimeType: string | null;
  referenceImageUrls: string[];
  keyframeUrls: string[];
} {
  const referenceImageUrls: string[] = [];
  const keyframeUrls: string[] = [];
  let startImageUrl = cleanUrl(params.imageUrl) ?? cleanUrl(params.falPayload.imageUrl);
  let endImageUrl = cleanUrl(params.falPayload.endImageUrl);
  let sourceVideoUrl = cleanUrl(params.falPayload.videoUrl);
  let sourceVideoMimeType: string | null = null;

  for (const url of params.falPayload.referenceImages ?? []) {
    addUniqueUrl(referenceImageUrls, url);
  }

  for (const input of params.falPayload.inputs ?? []) {
    const url = cleanUrl(input.url) ?? cleanUrl(input.dataUrl);
    if (!url) continue;
    const slotId = input.slotId?.trim();
    if (
      input.kind === 'image' &&
      !startImageUrl &&
      (slotId === 'image_url' || slotId === 'start_image_url' || slotId === 'first_frame_url')
    ) {
      startImageUrl = url;
      continue;
    }
    if (input.kind === 'image' && !endImageUrl && (slotId === 'end_image_url' || slotId === 'last_frame_url')) {
      endImageUrl = url;
      continue;
    }
    if (
      input.kind === 'image' &&
      (slotId === 'reference_image_urls' || slotId === 'reference_images' || slotId === 'image_urls')
    ) {
      addUniqueUrl(referenceImageUrls, url);
      continue;
    }
    if (input.kind === 'image' && slotId === 'edit_keyframe_urls') {
      addUniqueUrl(keyframeUrls, url);
      continue;
    }
    if (
      input.kind === 'video' &&
      !sourceVideoUrl &&
      (slotId === 'video_url' || slotId === 'source_video_url' || slotId === 'video_urls' || !slotId)
    ) {
      sourceVideoUrl = url;
      sourceVideoMimeType = cleanUrl(input.type);
    }
  }

  return {
    startImageUrl,
    endImageUrl,
    sourceVideoUrl,
    sourceVideoMimeType,
    referenceImageUrls,
    keyframeUrls,
  };
}

function userSafeLumaAgentsMessage(errorClass: string): string {
  if (errorClass === 'moderation') {
    return 'This request was blocked by safety checks. Try rephrasing it with safer, more neutral wording.';
  }
  if (errorClass === 'invalid_request' || errorClass === 'payload_too_large') {
    return 'This request is not supported with the selected inputs. Adjust the prompt, media, or settings and try again.';
  }
  if (errorClass === 'auth_error' || errorClass === 'billing_or_access') {
    return 'This render option is temporarily unavailable. Please retry later.';
  }
  return 'The render could not start. Please retry later.';
}

function statusForLumaAgentsError(errorClass: string): number {
  if (errorClass === 'invalid_request' || errorClass === 'moderation') return 400;
  if (errorClass === 'payload_too_large') return 413;
  return 503;
}

async function markJobFailedBeforeFallback(params: {
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
  const paymentStatusOverride =
    params.pendingReceipt && params.paymentMode === 'wallet'
      ? 'refunded_wallet'
      : params.pendingReceipt && params.paymentMode !== 'wallet'
        ? 'refunded'
        : null;
  await params.queryFn(
    `UPDATE app_jobs
        SET status = 'failed',
            progress = 0,
            message = $2,
            provisional = FALSE,
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

function falProviderJobIdFromResult(result: FalGenerateSubmissionResult, getLastProviderJobId: () => string | null): string | null {
  if (result.ok) {
    return result.generationResult.providerJobId ?? getLastProviderJobId() ?? null;
  }
  const bodyProviderJobId = result.body.providerJobId;
  return typeof bodyProviderJobId === 'string' && bodyProviderJobId.trim() ? bodyProviderJobId.trim() : getLastProviderJobId();
}

async function submitFalFromLumaAgents(params: {
  attemptIndex: number | null;
  fallbackFromAttemptId: number | null;
  fallbackReason?: string | null;
  fallbackErrorCode?: string | null;
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
}): Promise<LumaAgentsGenerateSubmissionResult> {
  const falAttempt =
    params.attemptIndex === null
      ? null
      : await createProviderAttempt({
          publicJobId: params.jobId,
          attemptIndex: params.attemptIndex,
          provider: 'fal',
          providerModel: params.falPayload.engineId,
          status: 'fallback_started',
          requestSnapshot: {
            fallbackFrom: LUMA_AGENTS_DIRECT_PROVIDER,
            fallbackReason: params.fallbackReason ?? null,
            fallbackErrorCode: params.fallbackErrorCode ?? null,
          },
          queryFn: params.queryFn,
        });
  if (falAttempt && params.fallbackFromAttemptId) {
    await linkProviderFallbackAttempt({
      fromAttemptId: params.fallbackFromAttemptId,
      toAttemptId: falAttempt.id,
      queryFn: params.queryFn,
    });
  }
  await params.queryFn(`UPDATE app_jobs SET provider = 'fal', updated_at = NOW() WHERE job_id = $1`, [params.jobId]);

  const falTracker = createProviderJobTracker({
    jobId: params.jobId,
    providerKey: 'fal',
    engineId: params.engineId,
    prompt: params.prompt,
    inputSummary: params.falInputSummary,
    queryFn: params.queryFn,
  });
  const falSubmission = await params.submitFalGenerateTaskFn({
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
    getLastProviderJobId: falTracker.getLastProviderJobId,
    setLastProviderJobId: falTracker.setLastProviderJobId,
    persistProviderJobId: falTracker.persistProviderJobId,
    logMetricFn: params.logMetricFn,
  });
  const falProviderJobId = falProviderJobIdFromResult(falSubmission, falTracker.getLastProviderJobId);
  if (falAttempt && falProviderJobId) {
    await markProviderAttemptAccepted({
      attemptId: falAttempt.id,
      providerJobId: falProviderJobId,
      responseSnapshot: falSubmission.ok ? falSubmission.generationResult : falSubmission.body,
      queryFn: params.queryFn,
    });
  }
  if (!falSubmission.ok) {
    if (falAttempt) {
      await markProviderAttemptFailed({
        attemptId: falAttempt.id,
        errorCode: typeof falSubmission.body.error === 'string' ? falSubmission.body.error : null,
        errorClass: 'fal_fallback_failed',
        fallbackEligible: false,
        responseSnapshot: falSubmission.body,
        queryFn: params.queryFn,
      });
    }
    return falSubmission;
  }
  if (falAttempt && falSubmission.generationResult.status === 'completed') {
    await markProviderAttemptFinished({
      attemptId: falAttempt.id,
      status: 'completed',
      responseSnapshot: falSubmission.generationResult,
      queryFn: params.queryFn,
    });
  }
  return {
    ok: true,
    kind: 'fal_result',
    generationResult: falSubmission.generationResult,
  };
}

export async function submitLumaAgentsGenerateTask(params: {
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
  advancedDirectOnlyEnabled: boolean;
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
  deps?: LumaAgentsSubmissionDeps;
}): Promise<LumaAgentsGenerateSubmissionResult> {
  const deps = params.deps ?? {};
  const getLumaAgentsClientFn = deps.getLumaAgentsClientFn ?? getLumaAgentsClient;
  const submitFalGenerateTaskFn = deps.submitFalGenerateTaskFn ?? submitFalGenerateTask;
  const queryFn = deps.queryFn ?? query;
  const rollbackPendingPaymentFn = deps.rollbackPendingPaymentFn ?? rollbackPendingPayment;
  const route = resolveLumaAgentsModelRoute({ engineId: params.engineId, mode: params.mode });
  const mediaInputs = resolveLumaAgentsSubmissionMediaInputs({
    imageUrl: params.imageUrl,
    falPayload: params.falPayload,
  });
  const advancedDirectOnlyRequest = hasAdvancedDirectOnlyRequest({
    mode: params.mode,
    advancedDirectOnlyEnabled: params.advancedDirectOnlyEnabled,
    falPayload: params.falPayload,
  });
  const support = resolveLumaAgentsVideoSupport({
    engineId: params.engineId,
    mode: params.mode,
    falPayload: params.falPayload,
    advancedDirectOnlyEnabled: params.advancedDirectOnlyEnabled,
  });
  if (!support.supported && support.fallbackCompatible) {
    console.info('[luma-agents] routing unsupported direct request to Fal', {
      jobId: params.jobId,
      engineId: params.engineId,
      mode: params.mode,
      reason: support.reason,
    });
    return submitFalFromLumaAgents({
      attemptIndex: null,
      fallbackFromAttemptId: null,
      fallbackReason: support.reason,
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
      submitFalGenerateTaskFn,
      logMetricFn: params.logMetricFn,
    });
  }

  const estimate = estimateLumaAgentsVideoCost({
    engineId: params.engineId,
    mode: params.mode,
    durationSec: params.durationSec,
    audioEnabled: params.audioEnabled,
    resolution: params.effectiveResolution ?? params.falPayload.resolution ?? null,
  });
  const lumaAttempt = await createProviderAttempt({
    publicJobId: params.jobId,
    attemptIndex: 1,
    provider: LUMA_AGENTS_DIRECT_PROVIDER,
    providerModel: route.providerModel,
    status: 'submit_started',
    requestSnapshot: {
      engineId: params.engineId,
      mode: params.mode,
      providerModel: route.providerModel,
      type: route.type,
      durationSec: params.durationSec,
      durationOption: params.falPayload.durationOption ?? null,
      aspectRatio: params.aspectRatio,
      resolution: params.effectiveResolution ?? params.falPayload.resolution ?? null,
      loop: params.falPayload.loop === true,
      hasImage: Boolean(mediaInputs.startImageUrl),
      hasEndImage: Boolean(mediaInputs.endImageUrl),
      hasSourceVideo: Boolean(mediaInputs.sourceVideoUrl),
      referenceImageCount: mediaInputs.referenceImageUrls.length,
      advancedDirectOnlyEnabled: params.advancedDirectOnlyEnabled,
      advancedDirectOnlyRequest,
      promptLength: params.prompt.length,
      estimatedProviderCostUsd: estimate.providerCostUsd,
    },
    queryFn,
  });

  let acceptedProviderJobId: string | null = null;
  try {
    const payload = buildLumaAgentsVideoPayload({
      engineId: params.engineId,
      mode: params.mode,
      prompt: params.prompt,
      durationSec: params.durationSec,
      durationOption: params.falPayload.durationOption ?? null,
      aspectRatio: params.aspectRatio ?? params.falPayload.aspectRatio ?? null,
      resolution: params.effectiveResolution ?? params.falPayload.resolution ?? null,
      loop: params.falPayload.loop ?? false,
      imageUrl: mediaInputs.startImageUrl,
      endImageUrl: mediaInputs.endImageUrl,
      videoUrl: mediaInputs.sourceVideoUrl,
      sourceVideoMimeType: mediaInputs.sourceVideoMimeType,
      keyframeUrls: mediaInputs.keyframeUrls,
      referenceImageUrls: mediaInputs.referenceImageUrls,
      extraInputValues: params.falPayload.extraInputValues ?? null,
      advancedDirectOnlyEnabled: params.advancedDirectOnlyEnabled,
    });
    const task = await getLumaAgentsClientFn().createGeneration(payload, { requestId: params.jobId });
    acceptedProviderJobId = task.providerJobId;
    if (!acceptedProviderJobId) {
      throw new LumaAgentsError('Luma Agents response did not include a generation id.', {
        code: 'LUMA_AGENTS_INVALID_RESPONSE',
        errorClass: 'invalid_response',
        body: task.raw,
      });
    }
    await markProviderAttemptAccepted({
      attemptId: lumaAttempt.id,
      providerJobId: acceptedProviderJobId,
      responseSnapshot: task.raw,
      queryFn,
    });
    const status = task.status === 'running' ? 'running' : 'queued';
    const progress = task.status === 'running' ? 30 : 10;
    await queryFn(
      `UPDATE app_jobs
          SET status = $2,
              progress = $3,
              message = $4,
              provider = $5,
              provider_job_id = $6,
              provisional = FALSE,
              updated_at = NOW()
        WHERE job_id = $1`,
      [params.jobId, status, progress, 'Render submitted.', LUMA_AGENTS_DIRECT_PROVIDER, acceptedProviderJobId]
    );
    params.logMetricFn('accepted', {
      jobId: params.jobId,
      meta: {
        provider: LUMA_AGENTS_DIRECT_PROVIDER,
        providerJobId: acceptedProviderJobId,
        providerModel: route.providerModel,
      },
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
        provider: LUMA_AGENTS_DIRECT_PROVIDER,
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
    const normalized = classifyLumaAgentsError(error);
    const fallbackEligible = shouldFallbackFromLumaAgentsSubmit({
      acceptedProviderJobId,
      error,
      fallbackToFalEnabled: params.fallbackToFalEnabled && !advancedDirectOnlyRequest,
    });
    await markProviderAttemptFailed({
      attemptId: lumaAttempt.id,
      errorCode: normalized.code,
      errorClass: normalized.errorClass,
      fallbackEligible,
      responseSnapshot: normalized.raw,
      queryFn,
    });

    if (!fallbackEligible) {
      const message = userSafeLumaAgentsMessage(normalized.errorClass);
      console.warn('[luma-agents] submit failed without fallback', {
        jobId: params.jobId,
        engineId: params.engineId,
        status: normalized.status,
        code: normalized.code,
        errorClass: normalized.errorClass,
      });
      await markJobFailedBeforeFallback({
        jobId: params.jobId,
        engineLabel: params.engineLabel,
        durationSec: params.durationSec,
        message,
        pendingReceipt: params.pendingReceipt,
        paymentMode: params.paymentMode,
        walletChargeReserved: params.walletChargeReserved,
        queryFn,
        rollbackPendingPaymentFn,
      });
      params.logMetricFn('failed', {
        jobId: params.jobId,
        errorCode: normalized.code ?? normalized.errorClass,
        meta: { provider: LUMA_AGENTS_DIRECT_PROVIDER, errorClass: normalized.errorClass },
      });
      return {
        ok: false,
        status: statusForLumaAgentsError(normalized.errorClass),
        body: {
          ok: false,
          error: normalized.code ?? 'LUMA_AGENTS_SUBMIT_FAILED',
          message,
        },
      };
    }

    return submitFalFromLumaAgents({
      attemptIndex: 2,
      fallbackFromAttemptId: lumaAttempt.id,
      fallbackReason: normalized.errorClass,
      fallbackErrorCode: normalized.code,
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
      submitFalGenerateTaskFn,
      logMetricFn: params.logMetricFn,
    });
  }
}
