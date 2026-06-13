import type { GeneratePayload, GenerateResult } from '@/lib/fal';
import { query } from '@/lib/db';
import type { Mode, PricingSnapshot } from '@/types/engines';
import { getLumaDirectClient } from '@/server/video-providers/luma-direct/client';
import { estimateLumaDirectCost } from '@/server/video-providers/luma-direct/cost';
import {
  classifyLumaDirectError,
  shouldFallbackFromLumaDirectSubmit,
} from '@/server/video-providers/luma-direct/errors';
import { LUMA_DIRECT_PROVIDER } from '@/server/video-providers/luma-direct/model-map';
import { buildLumaDirectPayload } from '@/server/video-providers/luma-direct/payload';
import { rollbackPendingPayment } from './payment-rollback';
import { buildUserFacingRefundDescription } from '@/server/user-facing-failure-messages';
import { createProviderJobTracker } from './provider-job-tracker';
import { submitFalGenerateTask } from './fal-submission';
import type { FalInputSummary } from './fal-request';
import type { PaymentMode, PendingReceipt } from './initial-video-job';

type QueryFn = <T = unknown>(sql: string, params?: unknown[]) => Promise<T[]>;

type LogMetricFn = Parameters<typeof submitFalGenerateTask>[0]['logMetricFn'];

type LumaDirectSubmissionDeps = {
  getLumaDirectClientFn?: typeof getLumaDirectClient;
  submitFalGenerateTaskFn?: typeof submitFalGenerateTask;
  queryFn?: QueryFn;
  rollbackPendingPaymentFn?: typeof rollbackPendingPayment;
};

export type LumaDirectGenerateSubmissionResult =
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

function userSafeLumaDirectMessage(errorClass: string): string {
  if (errorClass === 'moderation') {
    return 'This request was blocked by safety checks. Try rephrasing it with safer, more neutral wording.';
  }
  if (errorClass === 'invalid_request') {
    return 'This request is not supported with the selected inputs. Adjust the prompt, media, or settings and try again.';
  }
  if (errorClass === 'auth_error' || errorClass === 'rate_limited' || errorClass === 'provider_unavailable') {
    return 'Luma Ray 3.2 is temporarily unavailable. Please retry later.';
  }
  return 'The render could not start. Please retry later.';
}

async function markJobFailed(params: {
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

async function submitFalFromLumaDirect(params: {
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
}): Promise<LumaDirectGenerateSubmissionResult> {
  await params.queryFn(
    `UPDATE app_jobs
        SET provider = 'fal',
            message = $2,
            updated_at = NOW()
      WHERE job_id = $1`,
    [
      params.jobId,
      params.fallbackErrorCode
        ? `Retrying with fallback provider (${params.fallbackErrorCode}).`
        : 'Retrying with fallback provider.',
    ]
  );

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
  if (!falSubmission.ok) {
    return falSubmission;
  }
  return {
    ok: true,
    kind: 'fal_result',
    generationResult: falSubmission.generationResult,
  };
}

export async function submitLumaDirectGenerateTask(params: {
  jobId: string;
  userId: string;
  engineId: string;
  engineLabel: string;
  mode: Mode;
  prompt: string;
  durationSec: number;
  aspectRatio: string | null;
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
  deps?: LumaDirectSubmissionDeps;
}): Promise<LumaDirectGenerateSubmissionResult> {
  const deps = params.deps ?? {};
  const getLumaDirectClientFn = deps.getLumaDirectClientFn ?? getLumaDirectClient;
  const submitFalGenerateTaskFn = deps.submitFalGenerateTaskFn ?? submitFalGenerateTask;
  const queryFn = deps.queryFn ?? query;
  const rollbackPendingPaymentFn = deps.rollbackPendingPaymentFn ?? rollbackPendingPayment;
  const estimate = estimateLumaDirectCost({
    engineId: params.engineId,
    mode: params.mode,
    durationSec: params.durationSec,
    resolution: params.effectiveResolution ?? params.falPayload.resolution ?? null,
  });

  try {
    const payload = buildLumaDirectPayload({
      engineId: params.engineId,
      mode: params.mode,
      prompt: params.prompt,
      durationSec: params.durationSec,
      aspectRatio: params.aspectRatio,
      resolution: params.effectiveResolution ?? params.falPayload.resolution ?? null,
      imageUrl: params.imageUrl,
      falPayload: params.falPayload,
    });
    const generation = await getLumaDirectClientFn().createGeneration(payload);
    const providerJobId = typeof generation.id === 'string' && generation.id.trim() ? generation.id.trim() : null;
    if (!providerJobId) {
      throw new Error('Luma direct response did not include a generation id.');
    }

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
      [params.jobId, 'Render submitted.', LUMA_DIRECT_PROVIDER, providerJobId]
    );
    params.logMetricFn('accepted', {
      jobId: params.jobId,
      meta: {
        provider: LUMA_DIRECT_PROVIDER,
        providerJobId,
        providerModel: payload.providerModel,
        estimatedProviderCostUsd: estimate.providerCostUsd,
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
        provider: LUMA_DIRECT_PROVIDER,
        providerJobId,
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
    const normalized = classifyLumaDirectError(error);
    const fallbackEligible = shouldFallbackFromLumaDirectSubmit({
      error,
      fallbackToFalEnabled: params.fallbackToFalEnabled,
    });
    if (fallbackEligible) {
      console.warn('[luma-direct] submit failed, using Fal fallback', {
        jobId: params.jobId,
        engineId: params.engineId,
        status: normalized.status,
        code: normalized.code,
        errorClass: normalized.errorClass,
      });
      return submitFalFromLumaDirect({
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

    const message = userSafeLumaDirectMessage(normalized.errorClass);
    await markJobFailed({
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
      meta: { provider: LUMA_DIRECT_PROVIDER, errorClass: normalized.errorClass },
    });
    return {
      ok: false,
      status: normalized.errorClass === 'invalid_request' || normalized.errorClass === 'moderation' ? 400 : 503,
      body: {
        ok: false,
        error: normalized.code ?? 'LUMA_DIRECT_SUBMIT_FAILED',
        message,
      },
    };
  }
}
