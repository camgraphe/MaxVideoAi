import type { GeneratePayload, GenerateResult } from '@/lib/fal';
import type { Mode, PricingSnapshot } from '@/types/engines';
import { query } from '@/lib/db';
import { getKlingDirectClient } from '@/server/video-providers/kling-direct/client';
import {
  isKlingDirectFalFallbackCompatible,
  sanitizeKlingDirectFalFallbackPayload,
} from '@/server/video-providers/kling-direct/capabilities';
import { estimateKlingDirectCost } from '@/server/video-providers/kling-direct/cost';
import { ensureKlingDirectElementsForPayload } from '@/server/video-providers/kling-direct/elements';
import {
  classifyKlingDirectError,
  KlingDirectError,
  shouldFallbackFromKlingDirectSubmit,
} from '@/server/video-providers/kling-direct/errors';
import { resolveKlingDirectModelRoute } from '@/server/video-providers/kling-direct/model-map';
import { buildKlingDirectPayload } from '@/server/video-providers/kling-direct/payload';
import {
  createProviderAttempt,
  linkProviderFallbackAttempt,
  markProviderAttemptAccepted,
  markProviderAttemptFailed,
  markProviderAttemptFinished,
} from '@/server/video-providers/provider-attempts';
import { rollbackPendingPayment } from './payment-rollback';
import { createProviderJobTracker } from './provider-job-tracker';
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

type KlingDirectSubmissionDeps = {
  getKlingDirectClientFn?: typeof getKlingDirectClient;
  submitFalGenerateTaskFn?: typeof submitFalGenerateTask;
  queryFn?: QueryFn;
  rollbackPendingPaymentFn?: typeof rollbackPendingPayment;
};

export type KlingDirectGenerateSubmissionResult =
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

function userSafeKlingDirectMessage(errorClass: string): string {
  if (errorClass === 'moderation') {
    return 'The render service rejected this request. Adjust the prompt or inputs and try again.';
  }
  if (errorClass === 'invalid_request') {
    return 'This Kling request is not supported with the selected inputs.';
  }
  if (errorClass === 'auth_error' || errorClass === 'insufficient_provider_credits' || errorClass === 'provider_access_denied') {
    return 'Kling direct is temporarily unavailable. Please retry later.';
  }
  return 'The render could not start. Please retry later.';
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
      refundDescription: `Refund ${params.engineLabel} - ${params.durationSec}s - Kling direct start failed`,
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

export async function submitKlingDirectGenerateTask(params: {
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
  imageUrl: string | null | undefined;
  cfgScale: unknown;
  placeholderThumb: string;
  pricing: PricingSnapshot;
  paymentStatus: string;
  pendingReceipt: PendingReceipt | null;
  paymentMode: PaymentMode;
  walletChargeReserved: boolean;
  fallbackToFalEnabled: boolean;
  fallbackOnCreditsDepletedEnabled: boolean;
  elementRegistrationEnabled: boolean;
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
  deps?: KlingDirectSubmissionDeps;
}): Promise<KlingDirectGenerateSubmissionResult> {
  const deps = params.deps ?? {};
  const getKlingDirectClientFn = deps.getKlingDirectClientFn ?? getKlingDirectClient;
  const submitFalGenerateTaskFn = deps.submitFalGenerateTaskFn ?? submitFalGenerateTask;
  const queryFn = deps.queryFn ?? query;
  const rollbackPendingPaymentFn = deps.rollbackPendingPaymentFn ?? rollbackPendingPayment;
  const route = resolveKlingDirectModelRoute(params.engineId);
  const basePayload = buildKlingDirectPayload({
    engineId: params.engineId,
    jobId: params.jobId,
    mode: params.mode,
    prompt: params.prompt,
    negativePrompt: params.negativePrompt,
    multiPrompt: params.falPayload.multiPrompt ?? null,
    shotType: params.falPayload.shotType ?? null,
    voiceIds: params.falPayload.voiceIds ?? null,
    durationSec: params.durationSec,
    aspectRatio: params.aspectRatio,
    audioEnabled: params.audioEnabled,
    imageUrl: params.imageUrl,
    endImageUrl: params.falPayload.endImageUrl ?? null,
    cfgScale: typeof params.cfgScale === 'number' ? params.cfgScale : null,
    extraInputValues: params.falPayload.extraInputValues ?? null,
  });
  const estimate = estimateKlingDirectCost({
    engineId: params.engineId,
    durationSec: params.durationSec,
    audioEnabled: params.audioEnabled,
  });
  const klingAttempt = await createProviderAttempt({
    publicJobId: params.jobId,
    attemptIndex: 1,
    provider: 'kling_direct',
    providerModel: route.providerModel,
    status: 'submit_started',
    requestSnapshot: {
      engineId: params.engineId,
      mode: params.mode,
      providerModel: route.providerModel,
      endpointFamily: route.endpointFamily,
      createPath: basePayload.createPath,
      pollPathPrefix: basePayload.pollPathPrefix,
      durationSec: params.durationSec,
      aspectRatio: params.aspectRatio,
      audioEnabled: params.audioEnabled === true,
      hasImage: Boolean(params.imageUrl),
      hasEndImage: Boolean(params.falPayload.endImageUrl),
      multiPromptCount: params.falPayload.multiPrompt?.length ?? 0,
      voiceCount: params.falPayload.voiceIds?.length ?? 0,
      hasCameraControl: Boolean(params.falPayload.extraInputValues?.camera_control),
      hasElementList: Boolean(
        params.falPayload.elements?.some((element) => element.providerElementId) ||
          params.falPayload.extraInputValues?.element_list
      ),
      elementCount: params.falPayload.elements?.length ?? 0,
      requiresElementRegistration: Boolean(
        params.falPayload.elements?.some((element) => element.providerElementId === undefined)
      ),
      elementRegistrationEnabled: params.elementRegistrationEnabled,
      promptLength: params.prompt.length,
      estimatedProviderCostUnits: estimate.providerCostUnits,
      estimatedProviderCostUsd: estimate.providerCostUsd,
    },
  });

  try {
    if ((params.falPayload.elements?.length ?? 0) > 0 && !params.elementRegistrationEnabled) {
      throw new KlingDirectError('Kling direct subject reference registration is disabled.', {
        code: 'KLING_ELEMENT_REGISTRATION_DISABLED',
      });
    }
    const client = getKlingDirectClientFn();
    const elementRegistration = await ensureKlingDirectElementsForPayload({
      elements: params.falPayload.elements ?? null,
      userId: params.userId,
      jobId: params.jobId,
      client,
      queryFn,
    });
    const payload = buildKlingDirectPayload({
      engineId: params.engineId,
      jobId: params.jobId,
      mode: params.mode,
      prompt: params.prompt,
      negativePrompt: params.negativePrompt,
      multiPrompt: params.falPayload.multiPrompt ?? null,
      shotType: params.falPayload.shotType ?? null,
      voiceIds: params.falPayload.voiceIds ?? null,
      durationSec: params.durationSec,
      aspectRatio: params.aspectRatio,
      audioEnabled: params.audioEnabled,
      imageUrl: params.imageUrl,
      endImageUrl: params.falPayload.endImageUrl ?? null,
      elements: elementRegistration.elements ?? null,
      cfgScale: typeof params.cfgScale === 'number' ? params.cfgScale : null,
      extraInputValues: params.falPayload.extraInputValues ?? null,
    });
    const task = await client.createTask(payload);
    await markProviderAttemptAccepted({
      attemptId: klingAttempt.id,
      providerJobId: task.providerJobId,
      responseSnapshot: task.raw,
    });
    const status = task.status === 'running' ? 'running' : 'queued';
    const progress = task.status === 'running' ? 30 : 10;
    await queryFn(
      `UPDATE app_jobs
          SET status = $2,
              progress = $3,
              message = $4,
              provider = 'kling_direct',
              provider_job_id = $5,
              provisional = FALSE,
              updated_at = NOW()
        WHERE job_id = $1`,
      [params.jobId, status, progress, 'Render submitted.', task.providerJobId]
    );
    params.logMetricFn('accepted', {
      jobId: params.jobId,
      meta: {
        provider: 'kling_direct',
        providerJobId: task.providerJobId,
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
        provider: 'kling_direct',
        providerJobId: task.providerJobId,
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
    const normalized = classifyKlingDirectError(error);
    const fallbackEligible =
      shouldFallbackFromKlingDirectSubmit({
        acceptedProviderJobId: null,
        error,
        fallbackToFalEnabled: params.fallbackToFalEnabled,
        fallbackOnCreditsDepletedEnabled: params.fallbackOnCreditsDepletedEnabled,
      }) && isKlingDirectFalFallbackCompatible(params.falPayload);
    await markProviderAttemptFailed({
      attemptId: klingAttempt.id,
      errorCode: normalized.code,
      errorClass: normalized.errorClass,
      fallbackEligible,
      responseSnapshot: normalized.raw,
    });

    if (!fallbackEligible) {
      const message = userSafeKlingDirectMessage(normalized.errorClass);
      console.warn('[kling-direct] submit failed without fallback', {
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
        meta: { provider: 'kling_direct', errorClass: normalized.errorClass },
      });
      return {
        ok: false,
        status: normalized.errorClass === 'invalid_request' || normalized.errorClass === 'moderation' ? 400 : 503,
        body: {
          ok: false,
          error: normalized.code ?? 'KLING_DIRECT_SUBMIT_FAILED',
          message,
        },
      };
    }

    const falAttempt = await createProviderAttempt({
      publicJobId: params.jobId,
      attemptIndex: 2,
      provider: 'fal',
      providerModel: params.falPayload.engineId,
      status: 'fallback_started',
      requestSnapshot: {
        fallbackFrom: 'kling_direct',
        fallbackReason: normalized.errorClass,
        fallbackErrorCode: normalized.code,
      },
    });
    await linkProviderFallbackAttempt({ fromAttemptId: klingAttempt.id, toAttemptId: falAttempt.id });
    await queryFn(`UPDATE app_jobs SET provider = 'fal', updated_at = NOW() WHERE job_id = $1`, [params.jobId]);

    const falTracker = createProviderJobTracker({
      jobId: params.jobId,
      providerKey: 'fal',
      engineId: params.engineId,
      prompt: params.prompt,
      inputSummary: params.falInputSummary,
      queryFn,
    });
    const falSubmission = await submitFalGenerateTaskFn({
      falPayload: sanitizeKlingDirectFalFallbackPayload(params.falPayload),
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
    if (falProviderJobId) {
      await markProviderAttemptAccepted({
        attemptId: falAttempt.id,
        providerJobId: falProviderJobId,
        responseSnapshot: falSubmission.ok ? falSubmission.generationResult : falSubmission.body,
      });
    }
    if (!falSubmission.ok) {
      await markProviderAttemptFailed({
        attemptId: falAttempt.id,
        errorCode: typeof falSubmission.body.error === 'string' ? falSubmission.body.error : null,
        errorClass: 'fal_fallback_failed',
        fallbackEligible: false,
        responseSnapshot: falSubmission.body,
      });
      return falSubmission;
    }
    if (falSubmission.generationResult.status === 'completed') {
      await markProviderAttemptFinished({
        attemptId: falAttempt.id,
        status: 'completed',
        responseSnapshot: falSubmission.generationResult,
      });
    }
    return {
      ok: true,
      kind: 'fal_result',
      generationResult: falSubmission.generationResult,
    };
  }
}
