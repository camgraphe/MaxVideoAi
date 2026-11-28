import { getWanSubmissionClient, isWanDirectProvider, wanTransports, type WanDirectProvider } from '@/server/video-providers/wan-transports';
import type { createVideoRouterClient } from '@/server/video-providers/videorouter/wan-prime';
import type { createApimartClient } from '@/server/video-providers/apimart/wan-prime';
import type { WanPurchaseCanary } from '@/server/video-providers/router';
import { nextPurchaseProvider, purchaseRoutingSnapshot, type PurchaseDecision } from '@/lib/video-purchase-decision';
export { resolveWanMediaInputs as resolveAlibabaSubmissionMediaInputs } from '@/lib/video-routing/wan-media';
import { wanRequestFacts, type WanRequestFacts } from '@/lib/video-routing/wan-request';
import { buildWanPurchaseDecision } from './wan-purchase-routing';
import type { GeneratePayload, GenerateResult } from '@/lib/fal';
import { query } from '@/lib/db';
import type { NormalizedVideoProviderTask, VideoProviderKey } from '@/server/video-providers/types';
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
import { resolveWanMediaInputs } from '@/lib/video-routing/wan-media';
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
import { withWalletFailureSettlement } from '@/server/fal-webhook-refunds';
import { stopWanPilotWalletJob } from '@/server/wan-pilot-refunds';
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
  getVideoRouterClientFn?: typeof createVideoRouterClient;
  getApimartClientFn?: typeof createApimartClient;
  createOwnedMediaReadUrlFn?: typeof createOwnedMediaReadUrl;
  getAlibabaModelStudioClientFn?: () => AlibabaSubmissionClient;
  submitFalGenerateTaskFn?: typeof submitFalGenerateTask;
  queryFn?: QueryFn;
  rollbackPendingPaymentFn?: typeof rollbackPendingPayment;
  withFailureSettlementFn?: typeof withWalletFailureSettlement;
  stopWanPilotWalletJobFn?: typeof stopWanPilotWalletJob;
};

export type AlibabaModelStudioGenerateSubmissionResult =
  | { ok: true; kind: 'accepted'; body: Record<string, unknown> }
  | { ok: true; kind: 'fal_result'; generationResult: GenerateResult }
  | { ok: false; status: number; body: Record<string, unknown> };

function cleanUrl(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
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
  withFailureSettlementFn?: typeof withWalletFailureSettlement;
}) {
  const persistFailure = (execute: QueryFn) => execute(
    `UPDATE app_jobs
        SET status = 'failed', progress = 0, message = $2, provisional = FALSE, updated_at = NOW()
      WHERE job_id = $1 AND provider_job_id IS NULL
        AND (status IN ('queued','pending','running','processing','in_progress') OR (status = 'failed' AND message = $2))
        ${params.onlyBeforeSubmission ? 'AND NOT EXISTS (SELECT 1 FROM provider_attempts a WHERE a.job_id = app_jobs.id)' : ''}
      RETURNING job_id`,
    [params.jobId, params.message]
  );
  if (params.paymentMode === 'wallet' && params.walletChargeReserved) {
    const settle = params.withFailureSettlementFn ?? withWalletFailureSettlement;
    const staleFailure = new Error('Job no longer qualifies for this failure settlement.');
    try {
      await settle(params.jobId, {
        engineLabel: params.engineLabel, failureMessage: params.message, failureOrigin: 'submission_rejected',
      }, async executor => {
        const rows = await persistFailure((sql, values) => executor.query(sql, values));
        if (!rows.length) throw staleFailure;
      });
      return true;
    } catch (error) {
      if (error === staleFailure) return false;
      throw error;
    }
  }
  const rows = await persistFailure(params.queryFn);
  if (!rows.length) return false;
  const receipt = params.pendingReceipt;
  if (receipt && params.paymentMode !== 'wallet') {
    await params.rollbackPendingPaymentFn({
      pendingReceipt: receipt, walletChargeReserved: false,
      refundDescription: buildUserFacingRefundDescription({
        engineLabel: params.engineLabel, durationSec: params.durationSec, reason: params.message,
      }),
    });
    // A card refund is confirmed only by a matching receipt with a Stripe refund ID.
    await params.queryFn(
      `UPDATE app_jobs j SET payment_status = 'refunded', updated_at = NOW()
        WHERE j.job_id = $1 AND j.user_id = $2 AND j.status = 'failed'
          AND EXISTS (SELECT 1 FROM app_receipts r WHERE r.job_id = j.job_id AND r.user_id = j.user_id
                      AND r.type = 'refund' AND r.amount_cents = $3 AND UPPER(r.currency) = UPPER($4)
                      AND r.stripe_refund_id IS NOT NULL)`,
      [params.jobId, receipt.userId, receipt.amountCents, receipt.currency],
    );
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
  decision?: PurchaseDecision<VideoProviderKey>;
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
    requestSnapshot: params.directAttemptId === null && params.decision ? { purchaseRouting: purchaseRoutingSnapshot(params.decision, 'canary') } : {
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
  purchaseCanary?: WanPurchaseCanary;
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
  const media = resolveWanMediaInputs({ imageUrl: params.imageUrl, falPayload: params.falPayload });
  const resolution = params.effectiveResolution ?? params.falPayload.resolution ?? '720p';
  const estimate = estimateAlibabaProviderCost({
    engineId: params.engineId,
    mode: params.mode,
    durationSec: params.durationSec,
    inputVideoDurationSec: media.inputVideoDurationSec ?? undefined,
    resolution,
  });
  // Resolve once using the original job settings, before choosing a supplier or handing off.
  const wanPayload = {
    ...params.falPayload, engineId: params.engineId, mode: params.mode, prompt: params.prompt,
    durationSec: params.durationSec, resolution, aspectRatio: params.aspectRatio ?? params.falPayload.aspectRatio,
    audio: params.audioEnabled ?? params.falPayload.audio ?? false,
    imageUrl: media.startImageUrl ?? undefined, endImageUrl: media.endImageUrl ?? undefined,
  };
  const facts = route.family === 'wan3' ? wanRequestFacts(wanPayload, media, params.negativePrompt) : null;
  const decision = facts ? buildWanPurchaseDecision(params, facts) : null;
  const active = Boolean(params.purchaseCanary && decision?.canaryEligible);
  if (params.purchaseCanary === 'with-videorouter' && !active) params = { ...params, purchaseCanary: undefined };
  if (active) params = { ...params, audioEnabled: wanPayload.audio, falPayload: { ...wanPayload, reviewedWanPilot: true } };
  const selected = active ? decision?.order[0] : ALIBABA_MODEL_STUDIO_PROVIDER;
  const stopPilot = deps.stopWanPilotWalletJobFn ?? stopWanPilotWalletJob;
  if (!selected) {
    const message = 'No compatible provider fits the purchase ceiling.';
    const stopped = active && params.paymentMode === 'wallet' && params.walletChargeReserved
      ? await stopPilot({jobId: params.jobId, userId: params.userId, message, attemptId: null})
      : await failJobAndRollback({ ...params, message, queryFn, onlyBeforeSubmission: true,
      withFailureSettlementFn: deps.withFailureSettlementFn,
      rollbackPendingPaymentFn: deps.rollbackPendingPaymentFn ?? rollbackPendingPayment });
    if (!stopped) return deferred(params.jobId);
    return { ok: false, status: 503, body: { ok: false, error: 'NO_ELIGIBLE_VIDEO_PROVIDER', message } };
  }
  const context = { params, route, media, resolution, estimate, active, facts, plan: decision, deps, queryFn };
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
  media: ReturnType<typeof resolveWanMediaInputs>;
  resolution: string;
  estimate: ReturnType<typeof estimateAlibabaProviderCost>;
  active: boolean;
  facts: WanRequestFacts | null;
  plan: PurchaseDecision<VideoProviderKey> | null;
  deps: AlibabaSubmissionDeps;
  queryFn: QueryFn;
};

async function submitWanAttempt(
  context: WanAttemptContext, provider: WanDirectProvider, attemptIndex: number, previousAttemptId: number | null,
): Promise<AlibabaModelStudioGenerateSubmissionResult> {
  const { params, route, media, resolution, estimate, active, plan, deps, queryFn } = context;
  const providerModel = wanTransports[provider].modelId(route);
  const costMicros = plan?.candidates.find(candidate => candidate.provider === provider)?.costMicros;
  const attempt = await createProviderAttempt({
    publicJobId: params.jobId,
    attemptIndex,
    claimOnce: active,
    provider,
    providerModel,
    requestSnapshot: {
      engineId: params.engineId,
      mode: params.mode,
      providerModel,
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
      ...(context.facts ? { trimmedPromptLength: context.facts.promptCharacters,
        unreviewedWanOptions: context.facts.hasUnpricedOptions } : {}),
      estimatedProviderCostUsd: costMicros == null ? estimate.providerCostUsd : costMicros / 1e6,
      ...(plan ? { purchaseRouting: purchaseRoutingSnapshot(plan, active ? 'canary' : 'shadow') } : {}),
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
    if (!providerModel) throw new Error('No reviewed provider model for this route');
    const transport = await createWanMediaTransport({ payload, userId: params.userId }, { read: deps.createOwnedMediaReadUrlFn });
    sanitizeDiagnostics = transport.sanitize;
    const client = getWanSubmissionClient(provider, {
      videorouter: deps.getVideoRouterClientFn, apimart: deps.getApimartClientFn, alibaba_model_studio: deps.getAlibabaModelStudioClientFn,
    });
    sent = true;
    const task = await client.createVideo(transport.payload);
    acceptedProviderJobId = task.providerJobId;
    acceptedTask = task;
  } catch (error) {
    const normalized = classifyAlibabaModelStudioError(error);
    const failure = sent ? wanTransports[provider].classifyFailure(error) : { outcome: 'invalid' as const, code: normalized.code ?? normalized.errorClass };
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
    const fallbackEligible = active ? next === 'fal' || isWanDirectProvider(next) : !params.purchaseCanary && route.fallbackCompatible && shouldFallbackFromAlibabaSubmit({
      acceptedProviderJobId,
      error,
      fallbackToFalEnabled: params.fallbackToFalEnabled,
    });
    const persistRejection = (execute: QueryFn) => markProviderAttemptFailed({
      attemptId: attempt.id, errorCode: active ? failure.code : normalized.code,
      errorClass: active ? failure.outcome : normalized.errorClass, fallbackEligible,
      responseSnapshot: sanitizeDiagnostics(normalized.raw), queryFn: execute,
    });
    const terminalWalletStop = active && !fallbackEligible && !acceptedProviderJobId &&
      params.paymentMode === 'wallet' && params.walletChargeReserved;
    if (!terminalWalletStop) {
      try { await persistRejection(queryFn); }
      catch { /* Submission ownership remains authoritative if diagnostics cannot be saved. */ }
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

    const message = provider !== ALIBABA_MODEL_STUDIO_PROVIDER && sent
      ? 'The provider declined this generation. Review the request or try again later.'
      : userSafeAlibabaMessage(normalized.errorClass, normalized.code);
    if (terminalWalletStop) {
      const stopped = await (deps.stopWanPilotWalletJobFn ?? stopWanPilotWalletJob)({
        jobId: params.jobId, userId: params.userId, attemptId: attempt.id, message,
        persistRejection: tx => persistRejection((sql, values) => tx.query(sql, values)),
      });
      if (!stopped) return deferred(params.jobId);
    } else if (!acceptedProviderJobId) {
      await failJobAndRollback({
        jobId: params.jobId,
        engineLabel: params.engineLabel,
        durationSec: params.durationSec,
        message,
        pendingReceipt: params.pendingReceipt,
        paymentMode: params.paymentMode,
        walletChargeReserved: params.walletChargeReserved,
        queryFn,
        withFailureSettlementFn: deps.withFailureSettlementFn,
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
      meta: { provider, providerJobId: acceptedTask.providerJobId, providerModel } }),
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
