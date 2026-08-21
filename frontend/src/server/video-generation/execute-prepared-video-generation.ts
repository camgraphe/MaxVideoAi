import type { GeneratePayload } from '@/lib/fal';
import { ensureUserPreferredCurrency } from '@/lib/currency';
import type { ReferenceBudgetValuesByField } from '@/lib/reference-budget';
import { generateAndPersistJobKeyframes } from '@/server/video-keyframes';
import {
  buildResponseFromExistingVideoJob,
  createAtomicInitialVideoJob,
  VideoInitialJobError,
  type ExistingVideoJobRow,
  type VideoInitialJobResult,
} from '@/app/api/generate/_lib/initial-video-job';
import { rollbackPendingPayment } from '@/app/api/generate/_lib/payment-rollback';
import { persistFinalVideoJobUpdate, recordFinalGenerateQueueLog } from '@/app/api/generate/_lib/final-job-persistence';
import { persistFinalChargeReceipt, persistWalletFailureRefundReceipt } from '@/app/api/generate/_lib/final-receipts';
import { buildFinalGenerateResponse } from '@/app/api/generate/_lib/final-response';
import type { GenerateBillingPreflight } from '@/app/api/generate/_lib/billing-preflight';
import type { FalInputSummary } from '@/app/api/generate/_lib/fal-request';
import type { GenerateRequestOptions } from '@/app/api/generate/_lib/request-options';
import type { GenerateRouteContext } from '@/app/api/generate/_lib/route-context';
import type { GenerateRouteMetricOptions, GenerateRouteMetricStatus } from '@/app/api/generate/_lib/metric-logger';
import type { WalletReservation } from '@/server/generations/initial-job-reservation';
import type { EngineInputSchema } from '@/types/engines';
import { executeVideoGenerationLifecycle } from './video-generation-lifecycle';
import type { PreReservedVideoInitialState, VideoGenerationAdapters, VideoGenerationResponse } from './video-generation-contracts';

export type ExecutePreparedVideoGenerationParams = {
  body: Record<string, unknown>;
  routeContext: GenerateRouteContext;
  requestOptions: GenerateRequestOptions;
  userId: string;
  localKey: string | null;
  requestStartedAt: number;
  logMetric: (status: GenerateRouteMetricStatus, options?: GenerateRouteMetricOptions) => void;
  walletReservation?: WalletReservation;
  funding?: {
    kind: 'mcp_trial';
    entitlementUserId: string;
    quoteId: string;
  };
  preReservedInitialState?: PreReservedVideoInitialState;
  adapters: VideoGenerationAdapters;
  billing: GenerateBillingPreflight;
  effectiveDurationSec: number;
  effectiveDurationLabel: string | undefined;
  initialImageUrl: string | null | undefined;
  resolvedFirstFrameUrl: string | null | undefined;
  endImageUrl: string | null;
  normalizedReferenceImages: string[];
  videoUrls: string[];
  resolvedAudioUrl: string | null | undefined;
  audioUrls: string[];
  inputSchema?: EngineInputSchema | null;
  referenceValuesByField?: ReferenceBudgetValuesByField<string>;
  placeholderThumb: string;
  falPayload: GeneratePayload;
  falInputSummary: FalInputSummary;
  settingsSnapshot: Record<string, unknown>;
};

export async function executePreparedVideoGeneration(params: ExecutePreparedVideoGenerationParams): Promise<VideoGenerationResponse> {
  const {
    body,
    routeContext,
    requestOptions,
    userId,
    localKey,
    requestStartedAt,
    logMetric,
    walletReservation,
    adapters,
    billing,
    effectiveDurationSec,
    effectiveDurationLabel,
    initialImageUrl,
    resolvedFirstFrameUrl,
    endImageUrl,
    normalizedReferenceImages,
    videoUrls,
    resolvedAudioUrl,
    audioUrls,
    inputSchema,
    referenceValuesByField,
    placeholderThumb,
    falPayload,
    falInputSummary,
    settingsSnapshot,
  } = params;
  const { engine, isBytePlusV1a, jobId, mode, providerKey, providerRoutingPlan } = routeContext;
  const {
    prompt,
    audioEnabled,
    aspectRatio,
    batchId,
    groupId,
    iterationIndex,
    iterationCount,
    renderIds,
    heroRenderId,
    etaSeconds,
    etaLabel,
    isLumaRay2,
    loop,
    effectiveResolution,
  } = requestOptions;
  let { message } = requestOptions;
  let { preferredCurrency } = billing;
  const {
    resolvedCurrencyLower,
    pricing,
    priceOnlyReceipts,
    costBreakdownUsd,
    pricingSnapshotJson,
    costBreakdownJson,
    vendorAccountId,
    visibility,
    indexable,
    paymentMode,
    pendingReceipt,
    paymentStatus,
    stripePaymentIntentId,
    stripeChargeId,
  } = billing;
  let walletChargeReserved = false;
  let settingsSnapshotJson = JSON.stringify(settingsSnapshot);

  const trialInitialState = params.preReservedInitialState
    && 'funding' in params.preReservedInitialState
    ? params.preReservedInitialState
    : null;
  const walletInitialState = params.preReservedInitialState
    && 'walletChargeReserved' in params.preReservedInitialState
    ? params.preReservedInitialState
    : null;
  if (trialInitialState
    ? !params.funding
      || walletReservation !== undefined
      || billing.paymentMode !== 'mcp_trial'
      || billing.pendingReceipt !== null
      || billing.paymentStatus !== 'included_mcp_trial'
      || trialInitialState.jobId !== jobId
      || trialInitialState.funding.entitlementUserId !== userId
      || trialInitialState.funding.quoteId !== jobId
      || JSON.stringify(trialInitialState.funding) !== JSON.stringify(params.funding)
    : (walletReservation === 'already_reserved' && !walletInitialState)
      || (walletInitialState
        && (walletReservation !== 'already_reserved'
          || walletInitialState.jobId !== jobId
          || walletInitialState.walletChargeReserved !== true))) {
    throw new Error('Invalid pre-reserved video initial state.');
  }

  return executeVideoGenerationLifecycle({
    trustedInitialState: params.preReservedInitialState,
    reserveInitialState: async (): Promise<VideoInitialJobResult> => {
      if (!walletReservation || paymentMode === 'mcp_trial') {
        throw new Error('Included trial jobs must be pre-reserved.');
      }
      const initialJobParams = {
        jobId,
        userId,
        pendingReceipt,
        preferredCurrency,
        resolvedCurrencyLower,
        jobInsert: {
          jobId,
          userId,
          engineId: engine.id,
          engineLabel: engine.label,
          durationSec: effectiveDurationSec,
          prompt,
          thumbUrl: placeholderThumb,
          aspectRatio,
          hasAudio: audioEnabled === true,
          canUpscale: Boolean(engine.upscale4k),
          previewFrame: placeholderThumb,
          batchId,
          groupId,
          iterationIndex,
          iterationCount,
          renderIdsJson: renderIds ? JSON.stringify(renderIds) : null,
          heroRenderId,
          localKey,
          message,
          etaSeconds,
          etaLabel,
          provider: providerKey,
          finalPriceCents: pricing.totalCents,
          pricingSnapshotJson,
          costBreakdownJson,
          settingsSnapshotJson,
          currency: pricing.currency,
          vendorAccountId,
          paymentStatus,
          stripePaymentIntentId,
          stripeChargeId,
          visibility,
          indexable,
        },
      };
      const initialJobState = await createAtomicInitialVideoJob(paymentMode === 'wallet'
        ? {
            ...initialJobParams,
            paymentMode,
            walletReservation,
            funding: { kind: 'wallet', reservation: walletReservation },
          }
        : { ...initialJobParams, paymentMode, walletReservation });
      if (initialJobState.kind === 'created' && 'walletChargeReserved' in initialJobState) {
        walletChargeReserved = initialJobState.walletChargeReserved;
        if (paymentMode === 'wallet' && !preferredCurrency && walletReservation === 'reserve') {
          await ensureUserPreferredCurrency(userId, resolvedCurrencyLower);
          preferredCurrency = resolvedCurrencyLower;
        }
        logMetric('accepted', {
          jobId,
          durationMs: Date.now() - requestStartedAt,
          meta: { paymentMode, inputSummary: falInputSummary },
        });
      }
      return initialJobState;
    },
    mapExisting: (job: ExistingVideoJobRow) => ({
      body: buildResponseFromExistingVideoJob(job, localKey),
    }),
    onReservationError: async (error) => {
      if (error instanceof VideoInitialJobError) {
        if (pendingReceipt && paymentMode !== 'wallet') {
          await rollbackPendingPayment({
            pendingReceipt,
            walletChargeReserved,
            refundDescription: `Refund ${engine.label} - ${effectiveDurationSec}s`,
          });
        }
        logMetric(error.metricKind, {
          errorCode: error.metricCode,
          meta: error.metricMeta,
        });
        return { body: error.body, status: error.status };
      }
      console.error('[api/generate] failed to persist provisional job record', error);
      logMetric('failed', {
        errorCode: 'JOB_PERSIST_FAILED',
        meta: { stage: 'persist_provisional' },
      });
      if (pendingReceipt && paymentMode !== 'wallet') {
        await rollbackPendingPayment({
          pendingReceipt,
          walletChargeReserved,
          refundDescription: `Refund ${engine.label} - ${effectiveDurationSec}s`,
        });
      }
      return {
        body: { ok: false, error: 'Failed to persist job record' },
        status: 500,
      };
    },
    submitProvider: async (created) => {
      walletChargeReserved = 'walletChargeReserved' in created
        ? created.walletChargeReserved
        : false;
      if (isBytePlusV1a) {
        const submission = await adapters.submitBytePlusGenerateTask({
          jobId,
          userId,
          engineId: engine.id,
          engineLabel: engine.label,
          prompt,
          durationSec: effectiveDurationSec,
          mode,
          initialImageUrl,
          endImageUrl,
          normalizedReferenceImages,
          videoUrls,
          resolvedAudioUrl,
          audioUrls,
          effectiveResolution,
          aspectRatio,
          audioEnabled,
          placeholderThumb,
          pricing,
          paymentStatus,
          pendingReceipt,
          paymentMode,
          walletChargeReserved,
          batchId,
          groupId,
          iterationIndex,
          iterationCount,
          renderIds,
          heroRenderId,
          localKey,
          inputSchema,
          referenceValuesByField,
          deps: { logMetricFn: logMetric },
        });
        return submission.ok
          ? { kind: 'accepted_response' as const, body: submission.body }
          : {
              kind: 'error_response' as const,
              status: submission.status,
              body: submission.body,
            };
      }
      return adapters.submitGenerateProviderTask({
        providerRoutingPlan,
        providerKey,
        falPayload,
        jobId,
        userId,
        engineId: engine.id,
        engineLabel: engine.label,
        mode,
        prompt,
        negativePrompt: body.negativePrompt,
        durationSec: effectiveDurationSec,
        aspectRatio,
        audioEnabled,
        effectiveResolution,
        imageUrl: initialImageUrl ?? resolvedFirstFrameUrl ?? null,
        cfgScale: body.cfgScale,
        placeholderThumb,
        pricing,
        paymentStatus,
        pendingReceipt,
        paymentMode,
        walletChargeReserved,
        falInputSummary,
        isLumaRay2,
        batchId,
        groupId,
        iterationIndex,
        iterationCount,
        renderIds,
        heroRenderId,
        localKey,
        logMetricFn: logMetric,
      });
    },
    completeDirect: async (generationResult) => {
      const initialMediaState = adapters.buildInitialProviderMediaState({
        generationResult,
        batchId,
        placeholderThumb,
      });
      let { thumb, previewFrame, video, videoAsset, providerMode, status, progress, providerJobId } = initialMediaState;

      if (!providerJobId && !video) {
        return adapters.buildMissingProviderJobIdResponse({
          jobId,
          userId,
          engineId: engine.id,
          engineLabel: engine.label,
          durationSec: effectiveDurationSec,
          generationResult,
          pendingReceipt,
          walletChargeReserved,
          logMetric,
        });
      }
      const mediaState = await adapters.resolveProviderMediaState({
        state: initialMediaState,
        generationResult,
        jobId,
        userId,
        isLumaRay2,
        aspectRatio,
        settingsSnapshot,
        settingsSnapshotJson,
        message,
      });
      ({ thumb, previewFrame, video, videoAsset, providerMode, status, progress, providerJobId, settingsSnapshotJson, message } =
        mediaState);

      try {
        await persistFinalVideoJobUpdate({
          jobId,
          thumb,
          aspectRatio,
          previewFrame,
          etaSeconds,
          etaLabel,
          video,
          status,
          progress,
          providerJobId,
          finalPriceCents: pricing.totalCents,
          pricingSnapshotJson,
          costBreakdownJson,
          currency: pricing.currency,
          vendorAccountId,
          paymentStatus,
          stripePaymentIntentId,
          stripeChargeId,
          visibility,
          indexable,
          message,
          settingsSnapshotJson,
        });
      } catch (error) {
        console.error('[api/generate] failed to update job record', error);
        if (pendingReceipt) {
          await rollbackPendingPayment({
            pendingReceipt,
            walletChargeReserved,
            refundDescription: `Refund ${engine.label} - ${effectiveDurationSec}s`,
          });
        }
        return {
          body: { ok: false, error: 'Failed to update job record' },
          status: 500,
        };
      }

      await persistFinalChargeReceipt({ pendingReceipt, walletChargeReserved });
      await recordFinalGenerateQueueLog({
        jobId,
        provider: providerMode,
        providerJobId,
        engineId: engine.id,
        status,
        durationSec: effectiveDurationSec,
        durationLabel: effectiveDurationLabel,
        aspectRatio,
        resolution: effectiveResolution,
        loop: isLumaRay2 ? loop : undefined,
        inputSummary: falInputSummary,
        totalCents: pricing.totalCents,
        currency: pricing.currency,
        costBreakdownUsd,
      });
      if (status === 'completed' && video) {
        await generateAndPersistJobKeyframes({
          jobId,
          userId,
          videoUrl: video,
          durationSec: effectiveDurationSec,
        });
      }
      await persistWalletFailureRefundReceipt({
        status,
        pendingReceipt,
        paymentMode,
        engineLabel: engine.label,
        durationSec: effectiveDurationSec,
        priceOnlyReceipts,
      });

      const finalResponse = buildFinalGenerateResponse({
        jobId,
        media: { video, videoAsset, thumb },
        completion: { status, progress, message, etaSeconds, etaLabel },
        pricing,
        payment: { pendingReceipt, paymentMode, paymentStatus },
        provider: { providerMode, providerJobId },
        batch: {
          batchId,
          groupId,
          iterationIndex,
          iterationCount,
          renderIds,
          heroRenderId,
          localKey,
        },
      });
      logMetric(status === 'failed' ? 'failed' : 'completed', {
        jobId,
        meta: {
          providerJobId,
          provider: providerMode,
          paymentStatus: finalResponse.paymentStatus,
          inputSummary: falInputSummary,
        },
      });
      return { body: finalResponse };
    },
  });
}
