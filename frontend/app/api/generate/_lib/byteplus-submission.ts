import type { Mode, PricingSnapshot } from '@/types/engines';
import { query } from '@/lib/db';
import {
  BYTEPLUS_MODELARK_PROVIDER,
  buildBytePlusSeedancePayload,
  BytePlusModelArkError,
  getBytePlusArkConfig,
  getBytePlusModelArkClient,
  getBytePlusSeedanceAllowedResolutions,
  getBytePlusUserSafeErrorMessage,
  scrubBytePlusError,
} from '@/server/video-providers/byteplus-modelark';
import { rollbackPendingPayment } from './payment-rollback';
import type { PaymentMode, PendingReceipt } from './initial-video-job';

type QueryFn = (sql: string, params?: unknown[]) => Promise<unknown>;
type LogMetricFn = (
  kind: 'accepted' | 'failed',
  options: { jobId?: string; errorCode?: string; meta?: Record<string, unknown> }
) => void;

type BytePlusSubmissionDeps = {
  getBytePlusArkConfigFn?: typeof getBytePlusArkConfig;
  buildBytePlusSeedancePayloadFn?: typeof buildBytePlusSeedancePayload;
  getBytePlusModelArkClientFn?: typeof getBytePlusModelArkClient;
  getBytePlusSeedanceAllowedResolutionsFn?: typeof getBytePlusSeedanceAllowedResolutions;
  getBytePlusUserSafeErrorMessageFn?: typeof getBytePlusUserSafeErrorMessage;
  scrubBytePlusErrorFn?: typeof scrubBytePlusError;
  queryFn?: QueryFn;
  rollbackPendingPaymentFn?: typeof rollbackPendingPayment;
  persistProviderJobIdFn?: (providerJobId: string) => Promise<void>;
  logMetricFn?: LogMetricFn;
};

export type BytePlusSubmissionResult =
  | {
      ok: true;
      body: Record<string, unknown>;
    }
  | {
      ok: false;
      body: Record<string, unknown>;
      status: number;
    };

export async function submitBytePlusGenerateTask(params: {
  jobId: string;
  userId: string;
  engineId: string;
  engineLabel: string;
  isPublicSeedanceBytePlus: boolean;
  prompt: string;
  durationSec: number;
  mode: Mode;
  initialImageUrl: string | null | undefined;
  endImageUrl: string | null;
  normalizedReferenceImages: string[];
  videoUrls: string[];
  resolvedAudioUrl: string | null | undefined;
  audioUrls: string[];
  effectiveResolution: string;
  aspectRatio: string | null;
  audioEnabled: boolean | undefined;
  placeholderThumb: string;
  pricing: PricingSnapshot;
  paymentStatus: string;
  pendingReceipt: PendingReceipt | null;
  paymentMode: PaymentMode;
  walletChargeReserved: boolean;
  batchId: string | null;
  groupId: string | null;
  iterationIndex: number | null;
  iterationCount: number | null;
  renderIds: Array<string | null> | null;
  heroRenderId: string | null;
  localKey: string | null;
  deps?: BytePlusSubmissionDeps;
}): Promise<BytePlusSubmissionResult> {
  const deps = params.deps ?? {};
  const getBytePlusArkConfigFn = deps.getBytePlusArkConfigFn ?? getBytePlusArkConfig;
  const buildBytePlusSeedancePayloadFn = deps.buildBytePlusSeedancePayloadFn ?? buildBytePlusSeedancePayload;
  const getBytePlusModelArkClientFn = deps.getBytePlusModelArkClientFn ?? getBytePlusModelArkClient;
  const getBytePlusSeedanceAllowedResolutionsFn =
    deps.getBytePlusSeedanceAllowedResolutionsFn ?? getBytePlusSeedanceAllowedResolutions;
  const getBytePlusUserSafeErrorMessageFn = deps.getBytePlusUserSafeErrorMessageFn ?? getBytePlusUserSafeErrorMessage;
  const scrubBytePlusErrorFn = deps.scrubBytePlusErrorFn ?? scrubBytePlusError;
  const queryFn = deps.queryFn ?? query;
  const rollbackPendingPaymentFn = deps.rollbackPendingPaymentFn ?? rollbackPendingPayment;
  const persistProviderJobIdFn = deps.persistProviderJobIdFn;
  const logMetricFn = deps.logMetricFn;

  try {
    const config = getBytePlusArkConfigFn();
    const payload = buildBytePlusSeedancePayloadFn({
      modelId: params.isPublicSeedanceBytePlus ? config.seedanceModelId : config.seedanceFastModelId,
      prompt: params.prompt,
      durationSec: params.durationSec,
      mode: toBytePlusMode(params.mode),
      imageUrl: params.mode === 'i2v' ? params.initialImageUrl : null,
      endImageUrl: params.mode === 'i2v' ? params.endImageUrl : null,
      referenceImageUrls: params.mode === 'ref2v' || params.mode === 'v2v' ? params.normalizedReferenceImages : undefined,
      referenceVideoUrls:
        params.mode === 'ref2v' || params.mode === 'v2v' || params.mode === 'extend' ? params.videoUrls : undefined,
      referenceAudioUrls:
        params.mode === 'ref2v' || params.mode === 'v2v' || params.mode === 'extend'
          ? Array.from(new Set([...(params.resolvedAudioUrl ? [params.resolvedAudioUrl] : []), ...params.audioUrls]))
          : undefined,
      resolution: params.effectiveResolution,
      ratio: params.aspectRatio,
      generateAudio: params.audioEnabled !== false,
      allowedResolutions: getBytePlusSeedanceAllowedResolutionsFn(params.engineId),
    });
    const providerTask = await getBytePlusModelArkClientFn().createSeedanceFastTask(payload);
    const providerJobId = providerTask.providerJobId;
    await persistProviderJobIdFn?.(providerJobId);
    const status = providerTask.status === 'running' ? 'running' : 'queued';
    const progress = providerTask.status === 'running' ? 30 : 10;

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
      [params.jobId, status, progress, 'Render submitted.', BYTEPLUS_MODELARK_PROVIDER, providerJobId]
    );
    logMetricFn?.('accepted', {
      jobId: params.jobId,
      meta: {
        providerJobId,
        provider: BYTEPLUS_MODELARK_PROVIDER,
        inputSummary: {
          mode: params.mode,
          promptLength: params.prompt.length,
          durationSec: params.durationSec,
          resolution: params.effectiveResolution,
          aspectRatio: params.aspectRatio,
          generateAudio: params.audioEnabled !== false,
          hasImage: Boolean(params.mode === 'i2v' && params.initialImageUrl),
          hasEndImage: Boolean(params.mode === 'i2v' && params.endImageUrl),
          referenceImageCount: params.mode === 'ref2v' || params.mode === 'v2v' ? params.normalizedReferenceImages.length : 0,
          referenceVideoCount:
            params.mode === 'ref2v' || params.mode === 'v2v' || params.mode === 'extend' ? params.videoUrls.length : 0,
          referenceAudioCount:
            params.mode === 'ref2v' || params.mode === 'v2v' || params.mode === 'extend' ? params.audioUrls.length : 0,
        },
      },
    });

    return {
      ok: true,
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
        provider: BYTEPLUS_MODELARK_PROVIDER,
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
    const providerMessage = scrubBytePlusErrorFn(error);
    const providerStatus = error instanceof BytePlusModelArkError ? error.status : null;
    const errorCode = error instanceof BytePlusModelArkError && error.code ? error.code : 'BYTEPLUS_PROVIDER_ERROR';
    const failureMessage = getBytePlusUserSafeErrorMessageFn(providerMessage);
    console.warn('[byteplus] task submission failed', {
      jobId: params.jobId,
      engineId: params.engineId,
      status: providerStatus,
      code: errorCode,
      message: providerMessage,
    });
    try {
      await queryFn(
        `UPDATE app_jobs
         SET status = 'failed',
             progress = 0,
             message = $2,
             provider = $3,
             provisional = FALSE,
             payment_status = CASE WHEN $4::text IS NOT NULL THEN $4 ELSE payment_status END,
             updated_at = NOW()
         WHERE job_id = $1`,
        [
          params.jobId,
          failureMessage,
          BYTEPLUS_MODELARK_PROVIDER,
          params.pendingReceipt ? (params.paymentMode === 'wallet' ? 'refunded_wallet' : 'refunded') : null,
        ]
      );
    } catch (updateError) {
      console.warn('[byteplus] failed to mark submission failure', { jobId: params.jobId }, updateError);
    }
    if (params.pendingReceipt) {
      await rollbackPendingPaymentFn({
        pendingReceipt: params.pendingReceipt,
        walletChargeReserved: params.walletChargeReserved,
        refundDescription: `Refund ${params.engineLabel} - ${params.durationSec}s - BytePlus start failed`,
      });
    }
    logMetricFn?.('failed', {
      jobId: params.jobId,
      errorCode,
      meta: { provider: BYTEPLUS_MODELARK_PROVIDER, providerStatus },
    });

    return {
      ok: false,
      status: providerStatus && providerStatus >= 400 && providerStatus < 500 ? 502 : 503,
      body: {
        ok: false,
        error: errorCode,
        message: failureMessage,
      },
    };
  }
}

function toBytePlusMode(mode: Mode): 't2v' | 'i2v' | 'ref2v' | 'v2v' | 'extend' {
  return mode === 'i2v'
    ? 'i2v'
    : mode === 'ref2v'
      ? 'ref2v'
      : mode === 'v2v'
        ? 'v2v'
        : mode === 'extend'
          ? 'extend'
          : 't2v';
}
