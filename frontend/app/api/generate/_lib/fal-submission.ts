import { query } from '@/lib/db';
import { translateError, type ErrorTranslationInput } from '@/lib/error-messages';
import { FalGenerationError, generateVideo, type GeneratePayload, type GenerateResult } from '@/lib/fal';
import { LUMA_RAY2_ERROR_UNSUPPORTED } from '@/lib/luma-ray2';
import { rollbackPendingPayment } from './payment-rollback';
import type { PaymentMode, PendingReceipt } from './initial-video-job';
import {
  buildUserFacingRefundDescription,
  toUserFacingFailureMessage,
} from '@/server/user-facing-failure-messages';
import {
  condenseFalErrorMessage,
  extractFalProviderMessage,
  FalTimeoutError,
  shouldDeferFalError,
  withFalTimeout,
} from './fal-error-handling';

const LUMA_RAY2_TIMEOUT_MS = 180_000;
const FAL_RETRY_DELAYS_MS = [5_000, 15_000, 30_000];
const FAL_HARD_TIMEOUT_MS = 400_000;
const FAL_PROGRESS_FLOOR = 10;

type QueryFn = <T = unknown>(sql: string, params?: unknown[]) => Promise<T[]>;

type LogMetricFn = (
  kind: 'failed' | 'rejected' | 'accepted' | 'completed',
  event?: {
    jobId?: string;
    errorCode?: string;
    meta?: Record<string, unknown>;
    durationMs?: number;
  }
) => void;

type SubmitFalGenerateTaskDeps = {
  generateVideoFn?: typeof generateVideo;
  withFalTimeoutFn?: <T>(promise: Promise<T>, timeoutMs: number) => Promise<T>;
  queryFn?: QueryFn;
  rollbackPendingPaymentFn?: typeof rollbackPendingPayment;
  markJobAwaitingFalFn?: typeof markJobAwaitingFal;
};

export type FalGenerateSubmissionResult =
  | {
      ok: true;
      generationResult: GenerateResult;
    }
  | {
      ok: false;
      status: number;
      body: Record<string, unknown>;
    };

export async function markJobAwaitingFal(params: {
  jobId: string;
  engineId: string;
  providerJobId: string | null;
  message: string | null;
  statusLabel: string;
  attempt: number;
  context?: Record<string, unknown>;
  progressFloor?: number;
  deps?: {
    queryFn?: QueryFn;
  };
}): Promise<void> {
  const queryFn = params.deps?.queryFn ?? query;
  const progressFloor = params.progressFloor ?? FAL_PROGRESS_FLOOR;
  const message = params.message ? condenseFalErrorMessage(params.message) : null;
  try {
    await queryFn(
      `UPDATE app_jobs
       SET status = 'running',
           progress = GREATEST(progress, $2),
           message = CASE WHEN $3 IS NOT NULL THEN $3::text ELSE message END,
           provider_job_id = COALESCE($4, provider_job_id),
           provisional = FALSE,
           updated_at = NOW()
       WHERE job_id = $1`,
      [params.jobId, progressFloor, message, params.providerJobId]
    );
  } catch (error) {
    console.warn('[api/generate] failed to mark job awaiting Fal', { jobId: params.jobId }, error);
  }

  if (!params.providerJobId) {
    return;
  }

  try {
    await queryFn(
      `INSERT INTO fal_queue_log (job_id, provider, provider_job_id, engine_id, status, payload)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
      [
        params.jobId,
        'fal',
        params.providerJobId,
        params.engineId,
        params.statusLabel,
        JSON.stringify({
          attempt: params.attempt,
          at: new Date().toISOString(),
          message,
          context: params.context ?? null,
        }),
      ]
    );
  } catch (error) {
    console.warn('[queue-log] failed to record transient Fal event', error);
  }
}

export async function submitFalGenerateTask(params: {
  falPayload: GeneratePayload;
  jobId: string;
  engineId: string;
  engineLabel: string;
  isLumaRay2: boolean;
  batchId: string | null;
  durationSec: number;
  pendingReceipt: PendingReceipt | null;
  paymentMode: PaymentMode;
  walletChargeReserved: boolean;
  getLastProviderJobId: () => string | null | undefined;
  setLastProviderJobId: (providerJobId: string | null) => void;
  persistProviderJobId: (providerJobId: string) => void | Promise<void>;
  logMetricFn: LogMetricFn;
  deps?: SubmitFalGenerateTaskDeps;
}): Promise<FalGenerateSubmissionResult> {
  const generateVideoFn = params.deps?.generateVideoFn ?? generateVideo;
  const withFalTimeoutFn = params.deps?.withFalTimeoutFn ?? withFalTimeout;
  const queryFn = params.deps?.queryFn ?? query;
  const rollbackPendingPaymentFn = params.deps?.rollbackPendingPaymentFn ?? rollbackPendingPayment;
  const markJobAwaitingFalFn = params.deps?.markJobAwaitingFalFn ?? markJobAwaitingFal;

  try {
    const promise = generateVideoFn(
      { ...params.falPayload },
      {
        onRequestId: (requestId) => {
          console.info('[fal] request id received', {
            jobId: params.jobId,
            engineId: params.engineId,
            requestId,
          });
          params.persistProviderJobId(requestId);
        },
        onQueueUpdate: (status) => {
          if (!status) return;
          const requestId =
            (status as { request_id?: string }).request_id ?? params.getLastProviderJobId() ?? null;
          params.setLastProviderJobId(requestId);
        },
      }
    );
    const generationResult = await withFalTimeoutFn(
      promise,
      params.isLumaRay2 ? LUMA_RAY2_TIMEOUT_MS : FAL_HARD_TIMEOUT_MS
    );
    return { ok: true, generationResult };
  } catch (error) {
    const rawStatus =
      error && typeof error === 'object' && 'status' in error ? (error as { status?: number }).status : undefined;
    const metadataStatus =
      error && typeof error === 'object' && '$metadata' in error
        ? (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
        : undefined;
    const status = rawStatus ?? metadataStatus;
    const detail =
      error && typeof error === 'object' && 'body' in error ? (error as { body?: unknown }).body ?? null : null;
    const providerMessageRaw =
      extractFalProviderMessage(detail) ??
      (error instanceof FalGenerationError && error.body ? extractFalProviderMessage(error.body) : null) ??
      (error && typeof error === 'object' && 'response' in error
        ? extractFalProviderMessage((error as { response?: unknown }).response)
        : null) ??
      extractFalProviderMessage(error) ??
      (error instanceof Error ? error.message : null);
    const providerMessage = condenseFalErrorMessage(providerMessageRaw);
    const effectiveProviderMessage =
      providerMessage && providerMessage.toLowerCase() === 'fal request failed' ? null : providerMessage;
    const isTimeoutError = error instanceof FalTimeoutError;
    const isQuotaError =
      status === 429 || (typeof providerMessage === 'string' && providerMessage.toLowerCase().includes('quota'));
    const fallbackMessage = isTimeoutError
      ? 'Generation timed out'
      : isQuotaError
        ? 'Render queue is temporarily busy'
        : 'Render request failed';
    const rawErrorCode =
      typeof (error as { code?: string } | undefined)?.code === 'string'
        ? (error as { code?: string }).code
        : null;
    const translation = translateError({
      code: isTimeoutError ? 'PROVIDER_BUSY' : isQuotaError ? 'RATE_LIMITED' : rawErrorCode,
      status,
      message: effectiveProviderMessage ?? providerMessage ?? fallbackMessage,
      providerMessage: effectiveProviderMessage ?? providerMessage ?? null,
    });
    const failureMessage = toUserFacingFailureMessage(translation.message);
    const errorCode = translation.code;
    const providerJobId: string | null =
      error instanceof FalGenerationError && error.providerJobId
        ? error.providerJobId
        : typeof (error as { providerJobId?: string } | undefined)?.providerJobId === 'string'
          ? (error as { providerJobId?: string }).providerJobId!
          : params.getLastProviderJobId() ?? params.batchId ?? null;
    const paymentStatusOverride =
      params.pendingReceipt && params.paymentMode === 'wallet'
        ? 'refunded_wallet'
        : params.pendingReceipt && params.paymentMode !== 'wallet'
          ? 'refunded'
          : null;
    const refundDescription = buildUserFacingRefundDescription({
      engineLabel: params.engineLabel,
      durationSec: params.durationSec,
      reason: failureMessage,
    });

    if (error instanceof FalGenerationError) {
      (error as { code?: string }).code = errorCode;
      (error as { userMessage?: string }).userMessage = failureMessage;
    }

    console.error(
      '[api/generate] Fal generation failed',
      {
        jobId: params.jobId,
        engineId: params.engineId,
        status,
        providerJobId,
        providerMessage: effectiveProviderMessage ?? providerMessage ?? null,
        detail: detail ?? null,
      },
      error
    );

    const deferable =
      !isQuotaError &&
      shouldDeferFalError({
        error,
        status,
        detail,
        providerMessage: effectiveProviderMessage ?? providerMessage ?? fallbackMessage,
        providerJobId,
      });

    if (isTimeoutError) {
      const progressFloor = Math.min(95, FAL_PROGRESS_FLOOR + FAL_RETRY_DELAYS_MS.length * 5);
      const waitingMessage =
        'Rendering is still in progress. We will refresh as soon as the next status arrives.';

      if (providerJobId) {
        await markJobAwaitingFalFn({
          jobId: params.jobId,
          engineId: params.engineId,
          providerJobId,
          message: waitingMessage,
          statusLabel: 'deferred',
          attempt: FAL_RETRY_DELAYS_MS.length + 1,
          context: {
            status,
            deferred: true,
            timeout: true,
          },
          progressFloor,
          deps: { queryFn },
        });
      } else {
        await queryFn(
          `UPDATE app_jobs
             SET status = 'running',
                 progress = $2,
                 message = $3,
                 provisional = FALSE,
                 updated_at = NOW()
           WHERE job_id = $1`,
          [params.jobId, progressFloor, waitingMessage]
        ).catch((updateError) => {
          console.error('[api/generate] failed to mark timeout job awaiting status refresh', updateError);
        });
      }

      return buildDeferredFalResponse(params.jobId, providerJobId, progressFloor, waitingMessage);
    }

    if (deferable && providerJobId) {
      const progressFloor = Math.min(95, FAL_PROGRESS_FLOOR + FAL_RETRY_DELAYS_MS.length * 5);
      const waitingMessage =
        'Rendering is still in progress. No action is needed while we wait for the next status update.';

      await markJobAwaitingFalFn({
        jobId: params.jobId,
        engineId: params.engineId,
        providerJobId,
        message: waitingMessage,
        statusLabel: 'deferred',
        attempt: FAL_RETRY_DELAYS_MS.length + 1,
        context: {
          status,
          deferred: true,
        },
        progressFloor,
        deps: { queryFn },
      });

      return buildDeferredFalResponse(params.jobId, providerJobId, progressFloor, waitingMessage);
    }

    try {
      await queryFn(
        `UPDATE app_jobs
         SET status = 'failed',
             progress = 0,
             message = $2,
             provisional = FALSE,
             provider_job_id = COALESCE($3, provider_job_id),
             payment_status = CASE WHEN $4::text IS NOT NULL THEN $4 ELSE payment_status END,
             updated_at = NOW()
         WHERE job_id = $1`,
        [params.jobId, failureMessage, providerJobId, paymentStatusOverride]
      );
    } catch (updateError) {
      console.error('[api/generate] failed to update provisional job after Fal error', updateError);
    }

    if (params.pendingReceipt && !isTimeoutError) {
      await rollbackPendingPaymentFn({
        pendingReceipt: params.pendingReceipt,
        walletChargeReserved: params.walletChargeReserved,
        refundDescription,
      });
    }

    if (status === 422) {
      console.error('[generate] fal returned 422', providerMessage ?? '<no-provider-message>');
      const translated = translateFalUnprocessableEntity({
        status,
        detail,
        effectiveProviderMessage,
        providerMessage,
        isLumaRay2: params.isLumaRay2,
      });
      const userMessage = toUserFacingFailureMessage(translated.userMessage);

      params.logMetricFn('failed', {
        errorCode: translated.errorCode,
        meta: { stage: 'provider_422', providerJobId },
      });
      return {
        ok: false,
        status: 422,
        body: {
          ok: false,
          error: translated.errorCode,
          message: userMessage,
          providerMessage: null,
          detail: null,
        },
      };
    }

    params.logMetricFn('failed', {
      errorCode,
      meta: {
        stage: 'provider_error',
        providerJobId,
        providerStatus: status ?? metadataStatus ?? null,
      },
    });
    return {
      ok: false,
      status: isTimeoutError ? 504 : isQuotaError ? 429 : status ?? 500,
      body: {
        ok: false,
        error: errorCode,
        message: failureMessage,
        providerMessage: null,
        detail: null,
      },
    };
  }
}

function buildDeferredFalResponse(
  jobId: string,
  providerJobId: string | null,
  progress: number,
  message: string
): FalGenerateSubmissionResult {
  return {
    ok: false,
    status: 202,
    body: {
      ok: true,
      jobId,
      status: 'running',
      progress,
      providerJobId,
      deferred: true,
      message,
    },
  };
}

function translateFalUnprocessableEntity(params: {
  status: number;
  detail: unknown;
  effectiveProviderMessage: string | null;
  providerMessage: string | null;
  isLumaRay2: boolean;
}) {
  let translatedErrorCode: string | null = null;
  let translatedMessage: string | null = null;
  let translatedProviderMessage: string | null = null;

  const resolveTranslation = (input: ErrorTranslationInput) => {
    const translation = translateError(input);
    translatedErrorCode = translation.code;
    translatedMessage = translation.message;
    translatedProviderMessage = translation.providerMessage ?? translation.originalMessage ?? null;
  };

  if (params.detail && Array.isArray(params.detail) && params.detail.length) {
    const firstDetail = params.detail[0] as Record<string, unknown>;
    const detailCode = typeof firstDetail.type === 'string' ? firstDetail.type : undefined;
    const detailMessage = typeof firstDetail.msg === 'string' ? firstDetail.msg : undefined;
    resolveTranslation({
      code: detailCode ?? 'FAL_UNPROCESSABLE_ENTITY',
      status: params.status,
      message: detailMessage ?? params.effectiveProviderMessage ?? params.providerMessage ?? null,
      providerMessage: detailMessage ?? params.effectiveProviderMessage ?? params.providerMessage ?? null,
    });
  } else if (params.detail && typeof params.detail === 'object') {
    const detailRecord = params.detail as Record<string, unknown>;
    const detailCode = typeof detailRecord.code === 'string' ? detailRecord.code : undefined;
    const detailMessage = typeof detailRecord.message === 'string' ? detailRecord.message : undefined;
    resolveTranslation({
      code: detailCode ?? 'FAL_UNPROCESSABLE_ENTITY',
      status: params.status,
      message: detailMessage ?? params.effectiveProviderMessage ?? params.providerMessage ?? null,
      providerMessage: detailMessage ?? params.effectiveProviderMessage ?? params.providerMessage ?? null,
    });
  } else {
    resolveTranslation({
      code: 'FAL_UNPROCESSABLE_ENTITY',
      status: params.status,
      message: params.effectiveProviderMessage ?? params.providerMessage ?? null,
      providerMessage: params.effectiveProviderMessage ?? params.providerMessage ?? null,
    });
  }

  const errorCode = translatedErrorCode ?? 'FAL_UNPROCESSABLE_ENTITY';
  return {
    errorCode,
    userMessage: params.isLumaRay2
      ? LUMA_RAY2_ERROR_UNSUPPORTED
      : translatedMessage ?? 'This request cannot be processed for this engine. Please adjust your inputs and try again.',
    providerMessage: translatedProviderMessage ?? params.effectiveProviderMessage ?? params.providerMessage ?? null,
  };
}
