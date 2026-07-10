import type { GeneratePayload, GenerateResult } from '@/lib/fal';
import { query } from '@/lib/db';
import type { Mode, PricingSnapshot } from '@/types/engines';
import { buildGoogleVertexOmniPayload } from '@/server/video-providers/google-vertex-omni/payload';
import { getGoogleVertexOmniClient } from '@/server/video-providers/google-vertex-omni/client';
import { estimateGoogleVertexOmniCost } from '@/server/video-providers/google-vertex-omni/cost';
import {
  classifyGoogleVertexOmniError,
  GoogleVertexOmniError,
  shouldFallbackFromGoogleVertexOmniSubmit,
} from '@/server/video-providers/google-vertex-omni/errors';
import {
  GOOGLE_VERTEX_OMNI_PROVIDER,
  resolveGoogleVertexOmniSupport,
} from '@/server/video-providers/google-vertex-omni/model-map';
import {
  createProviderAttempt,
  linkProviderFallbackAttempt,
  markProviderAttemptAccepted,
  markProviderAttemptFailed,
  markProviderAttemptFinished,
} from '@/server/video-providers/provider-attempts';
import { rollbackPendingPayment } from './payment-rollback';
import { buildUserFacingRefundDescription } from '@/server/user-facing-failure-messages';
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

type GoogleVertexOmniSubmissionDeps = {
  getGoogleVertexOmniClientFn?: typeof getGoogleVertexOmniClient;
  submitFalGenerateTaskFn?: typeof submitFalGenerateTask;
  queryFn?: QueryFn;
  rollbackPendingPaymentFn?: typeof rollbackPendingPayment;
};

export type GoogleVertexOmniGenerateSubmissionResult =
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

function userSafeGoogleVertexOmniMessage(errorClass: string): string {
  if (errorClass === 'moderation') {
    return 'This request was blocked by safety checks. Try rephrasing it with safer, more neutral wording.';
  }
  if (errorClass === 'invalid_request' || errorClass === 'unsupported_params') {
    return 'This request is not supported with the selected inputs. Adjust the prompt, media, or settings and try again.';
  }
  if (errorClass === 'auth_error' || errorClass === 'billing_or_access') {
    return 'This render option is temporarily unavailable. Please retry later.';
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

async function submitFalFromGoogleOmni(params: {
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
}): Promise<GoogleVertexOmniGenerateSubmissionResult> {
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
            fallbackFrom: GOOGLE_VERTEX_OMNI_PROVIDER,
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

export async function submitGoogleVertexOmniGenerateTask(params: {
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
  deps?: GoogleVertexOmniSubmissionDeps;
}): Promise<GoogleVertexOmniGenerateSubmissionResult> {
  const deps = params.deps ?? {};
  const getGoogleVertexOmniClientFn = deps.getGoogleVertexOmniClientFn ?? getGoogleVertexOmniClient;
  const submitFalGenerateTaskFn = deps.submitFalGenerateTaskFn ?? submitFalGenerateTask;
  const queryFn = deps.queryFn ?? query;
  const rollbackPendingPaymentFn = deps.rollbackPendingPaymentFn ?? rollbackPendingPayment;

  const support = resolveGoogleVertexOmniSupport({
    engineId: params.engineId,
    mode: params.mode,
    aspectRatio: params.aspectRatio,
    negativePrompt: params.negativePrompt,
    falPayload: params.falPayload,
  });
  if (!support.supported) {
    if (!params.fallbackToFalEnabled) {
      const message = userSafeGoogleVertexOmniMessage('unsupported_params');
      console.warn('[google-vertex-omni] unsupported direct request failed without fallback', {
        jobId: params.jobId,
        engineId: params.engineId,
        mode: params.mode,
        reason: support.reason,
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
      params.logMetricFn('rejected', {
        jobId: params.jobId,
        errorCode: support.reason,
        meta: { provider: GOOGLE_VERTEX_OMNI_PROVIDER, errorClass: 'unsupported_params' },
      });
      return {
        ok: false,
        status: 400,
        body: {
          ok: false,
          error: support.reason,
          message,
        },
      };
    }
    console.info('[google-vertex-omni] routing unsupported direct request to Fal', {
      jobId: params.jobId,
      engineId: params.engineId,
      mode: params.mode,
      reason: support.reason,
    });
    return submitFalFromGoogleOmni({
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

  const route = support.route;
  const estimate = estimateGoogleVertexOmniCost({
    engineId: params.engineId,
    mode: params.mode,
    durationSec: params.durationSec,
    audioEnabled: params.audioEnabled,
  });
  const googleAttempt = await createProviderAttempt({
    publicJobId: params.jobId,
    attemptIndex: 1,
    provider: GOOGLE_VERTEX_OMNI_PROVIDER,
    providerModel: route.providerModel,
    status: 'submit_started',
    requestSnapshot: {
      engineId: params.engineId,
      mode: params.mode,
      providerModel: route.providerModel,
      launchStage: route.launchStage,
      location: (process.env.GOOGLE_VERTEX_OMNI_LOCATION ?? process.env.GOOGLE_VERTEX_LOCATION ?? 'global').trim() || 'global',
      durationSec: params.durationSec,
      aspectRatio: params.aspectRatio,
      audioEnabled: params.audioEnabled !== false,
      hasImage: Boolean(params.falPayload.imageUrl),
      hasVideo: Boolean(params.falPayload.videoUrl),
      referenceImageCount: params.falPayload.referenceImages?.length ?? 0,
      hasPreviousInteraction: Boolean(
        (params.falPayload.extraInputValues as Record<string, unknown> | undefined)?.previous_interaction_id ||
          (params.falPayload.extraInputValues as Record<string, unknown> | undefined)?.previousInteractionId
      ),
      promptLength: params.prompt.length,
      estimatedProviderCostUsd: estimate.providerCostUsd,
    },
    queryFn,
  });

  try {
    const payload = await buildGoogleVertexOmniPayload({
      engineId: params.engineId,
      mode: params.mode,
      prompt: params.prompt,
      negativePrompt: params.negativePrompt,
      aspectRatio: params.aspectRatio,
      falPayload: params.falPayload,
    });
    const interaction = await getGoogleVertexOmniClientFn().createInteraction(payload);
    const interactionId =
      typeof interaction.id === 'string' && interaction.id.trim()
        ? interaction.id.trim()
        : typeof interaction.name === 'string' && interaction.name.trim()
          ? interaction.name.trim()
          : null;
    if (!interactionId) {
      throw new GoogleVertexOmniError('Gemini Omni Flash response did not include an interaction id.', {
        code: 'GOOGLE_VERTEX_OMNI_NO_INTERACTION_ID',
        errorClass: 'invalid_response',
        raw: interaction,
      });
    }

    await markProviderAttemptAccepted({
      attemptId: googleAttempt.id,
      providerJobId: interactionId,
      responseSnapshot: interaction,
      queryFn,
    });
    await queryFn(
      `UPDATE app_jobs
          SET status = 'queued',
              progress = GREATEST(progress, 10),
              message = $2,
              provider = $3,
              provider_job_id = $4,
              provisional = FALSE,
              updated_at = NOW()
        WHERE job_id = $1`,
      [params.jobId, 'Render submitted.', GOOGLE_VERTEX_OMNI_PROVIDER, interactionId]
    );
    params.logMetricFn('accepted', {
      jobId: params.jobId,
      meta: {
        provider: GOOGLE_VERTEX_OMNI_PROVIDER,
        providerJobId: interactionId,
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
        status: 'queued',
        progress: 10,
        pricing: params.pricing,
        paymentStatus: params.paymentStatus,
        provider: GOOGLE_VERTEX_OMNI_PROVIDER,
        providerJobId: interactionId,
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
    const normalized = classifyGoogleVertexOmniError(error);
    const fallbackEligible = shouldFallbackFromGoogleVertexOmniSubmit({
      acceptedProviderJobId: null,
      error,
      fallbackToFalEnabled: params.fallbackToFalEnabled,
    });
    await markProviderAttemptFailed({
      attemptId: googleAttempt.id,
      errorCode: normalized.code,
      errorClass: normalized.errorClass,
      fallbackEligible,
      responseSnapshot: normalized.raw,
      queryFn,
    });

    if (!fallbackEligible) {
      const message = userSafeGoogleVertexOmniMessage(normalized.errorClass);
      console.warn('[google-vertex-omni] submit failed without fallback', {
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
        meta: { provider: GOOGLE_VERTEX_OMNI_PROVIDER, errorClass: normalized.errorClass },
      });
      return {
        ok: false,
        status:
          normalized.errorClass === 'invalid_request' ||
          normalized.errorClass === 'moderation' ||
          normalized.errorClass === 'unsupported_params'
            ? 400
            : 503,
        body: {
          ok: false,
          error: normalized.code ?? 'GOOGLE_VERTEX_OMNI_SUBMIT_FAILED',
          message,
        },
      };
    }

    return submitFalFromGoogleOmni({
      attemptIndex: 2,
      fallbackFromAttemptId: googleAttempt.id,
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
