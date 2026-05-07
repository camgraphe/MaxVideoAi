export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { isDatabaseConfigured, query } from '@/lib/db';
import { randomUUID } from 'crypto';
import { generateVideo, FalGenerationError } from '@/lib/fal';
import { getConfiguredEngine, getConfiguredEngineIncludingHidden } from '@/server/engines';
import { ensureBillingSchema } from '@/lib/schema';
import type { Mode } from '@/types/engines';
import {
  condenseFalErrorMessage,
  extractFalProviderMessage,
  FalTimeoutError,
  shouldDeferFalError,
  withFalTimeout,
} from './_lib/fal-error-handling';
import { validateExtraInputValues } from './_lib/extra-input-values';
import { processGenerationAttachments } from './_lib/attachments';
import { deriveGenerationAttachmentReferences } from './_lib/attachment-references';
import { createGenerateMetricLogger } from './_lib/metric-logger';
import { buildFalRequestParts } from './_lib/fal-request';
import { buildGenerationSettingsSnapshot } from './_lib/settings-snapshot';
import { createProviderJobTracker } from './_lib/provider-job-tracker';
import { persistFinalVideoJobUpdate, recordFinalGenerateQueueLog } from './_lib/final-job-persistence';
import { persistFinalChargeReceipt, persistWalletFailureRefundReceipt } from './_lib/final-receipts';
import { buildInitialProviderMediaState, resolveProviderMediaState } from './_lib/provider-media';
import { buildFinalGenerateResponse } from './_lib/final-response';
import { resolveGenerateBillingPreflight } from './_lib/billing-preflight';
import { buildGenerateValidationPayload } from './_lib/validation-payload';
import { submitBytePlusGenerateTask } from './_lib/byteplus-submission';
import { buildGenerateRequestOptions, isVideoMode } from './_lib/request-options';
import { resolveGenerateUserGate } from './_lib/auth-idempotency';
import {
  buildResponseFromExistingVideoJob,
  createAtomicInitialVideoJob,
  VideoInitialJobError,
  type PaymentMode,
} from './_lib/initial-video-job';
import { rollbackPendingPayment } from './_lib/payment-rollback';
import { generateAndPersistJobKeyframes } from '@/server/video-keyframes';
import { translateError, type ErrorTranslationInput } from '@/lib/error-messages';
import { LUMA_RAY2_ERROR_UNSUPPORTED } from '@/lib/luma-ray2';
import { ensureUserPreferredCurrency } from '@/lib/currency';
import { AdminAuthError, requireAdmin } from '@/server/admin';
import {
  BYTEPLUS_MODELARK_PROVIDER,
  isSeedanceBytePlusModeAllowed,
  isSeedanceFastBytePlusModeAllowed,
  isBytePlusModelArkEnabled,
  isBytePlusSeedanceFastEngine,
  seedanceBytePlusAdminOnly,
  seedanceFastBytePlusAdminOnly,
  shouldRoutePublicSeedanceToBytePlus,
  shouldRoutePublicSeedanceFastToBytePlus,
} from '@/server/video-providers/byteplus-modelark';

const LUMA_RAY2_TIMEOUT_MS = 180_000;
const FAL_RETRY_DELAYS_MS = [5_000, 15_000, 30_000];
const FAL_HARD_TIMEOUT_MS = 400_000;
const FAL_PROGRESS_FLOOR = 10;

async function markJobAwaitingFal(params: {
  jobId: string;
  engineId: string;
  providerJobId: string | null;
  message: string | null;
  statusLabel: string;
  attempt: number;
  context?: Record<string, unknown>;
  progressFloor?: number;
}): Promise<void> {
  const progressFloor = params.progressFloor ?? FAL_PROGRESS_FLOOR;
  const message = params.message ? condenseFalErrorMessage(params.message) : null;
  try {
    await query(
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
    await query(
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

export async function POST(req: NextRequest) {
  const requestStartedAt = Date.now();
  const { state: metricState, log: logMetric } = createGenerateMetricLogger({ requestStartedAt });

  const body = await req
    .json()
    .catch((error) => {
      console.error('[api/generate] invalid JSON', error);
      return null;
    });
  if (!body) return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });

  const requestedEngineId = String(body.engineId || '');
  const publicEngine = await getConfiguredEngine(requestedEngineId);
  const engine =
    publicEngine ??
    (isBytePlusSeedanceFastEngine(requestedEngineId)
      ? await getConfiguredEngineIncludingHidden(requestedEngineId)
      : undefined);
  if (!engine) {
    const disabledEngine = await getConfiguredEngine(requestedEngineId, true);
    if (disabledEngine) {
      console.info('[api/generate] runtime lock active; generation blocked', { engineId: requestedEngineId });
      return NextResponse.json({ ok: false, error: 'Engine unavailable' }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: 'Unknown engine' }, { status: 400 });
  }
  metricState.engineId = engine.id;
  metricState.engineLabel = engine.label;
  const isPublicSeedanceBytePlus = shouldRoutePublicSeedanceToBytePlus(engine.id);
  const isPublicSeedanceFastBytePlus = shouldRoutePublicSeedanceFastToBytePlus(engine.id);
  const isBytePlusV1a =
    isBytePlusSeedanceFastEngine(engine.id) || isPublicSeedanceFastBytePlus || isPublicSeedanceBytePlus;
  const providerKey = isBytePlusV1a ? BYTEPLUS_MODELARK_PROVIDER : 'fal';

  if (isBytePlusV1a && !isBytePlusModelArkEnabled()) {
    return NextResponse.json({ ok: false, error: 'Engine unavailable' }, { status: 404 });
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: 'Database unavailable' }, { status: 503 });
  }

  try {
    await ensureBillingSchema();
  } catch {
    return NextResponse.json({ ok: false, error: 'Database unavailable' }, { status: 503 });
  }

  const bytePlusRequiresAdmin = isBytePlusV1a && (isPublicSeedanceBytePlus ? seedanceBytePlusAdminOnly() : seedanceFastBytePlusAdminOnly());
  if (bytePlusRequiresAdmin) {
    try {
      await requireAdmin(req);
    } catch (error) {
      if (error instanceof AdminAuthError) {
        return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
      }
      console.error('[api/generate] failed to check BytePlus admin access', error);
      return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
    }
  }

  const requestedJobId = typeof body.jobId === 'string' && body.jobId.trim() ? String(body.jobId).trim() : null;
  const jobId = requestedJobId ?? `job_${randomUUID()}`;
  metricState.jobId = jobId;
  const rawMode = typeof body.mode === 'string' ? body.mode.trim().toLowerCase() : '';
  const mode: Mode = isVideoMode(rawMode)
    ? rawMode
    : engine.modes.includes('t2v')
      ? 't2v'
      : engine.modes[0] ?? 't2v';
  metricState.mode = mode;

  const bytePlusModeAllowed = isPublicSeedanceBytePlus
    ? isSeedanceBytePlusModeAllowed(mode)
    : isSeedanceFastBytePlusModeAllowed(mode);
  if (isBytePlusV1a && !bytePlusModeAllowed) {
    return NextResponse.json({ ok: false, error: 'This Seedance route only supports the configured modes.' }, { status: 400 });
  }

  const requestOptionsResult = buildGenerateRequestOptions({
    body,
    engine,
    mode,
    isBytePlusV1a,
  });
  if (!requestOptionsResult.ok) {
    if (requestOptionsResult.metric) {
      logMetric('rejected', requestOptionsResult.metric);
    }
    return NextResponse.json(requestOptionsResult.body, { status: requestOptionsResult.status });
  }

  const {
    prompt,
    multiPrompt,
    audioEnabled,
    isLumaRay2,
    supportsDuration,
    supportsResolution,
    supportsFps,
    supportsAspectRatio,
    rawDurationOption,
    rawDurationLabel,
    durationLabel,
    durationSec,
    lumaDurationInfo,
    shotType,
    seed,
    cameraFixed,
    safetyChecker,
    voiceIds,
    voiceControl,
    elements,
    endImageUrl,
    rawAudioUrl,
    aspectRatio,
    batchId,
    groupId,
    iterationIndex,
    iterationCount,
    renderIds,
    heroRenderId,
    etaSeconds,
    etaLabel,
    rawExtraInputValues,
    pricingResolution,
    effectiveResolution,
    numFrames,
    loop,
    soraRequest,
  } = requestOptionsResult.options;
  let { message } = requestOptionsResult.options;
  metricState.durationSec = durationSec;
  metricState.resolution = effectiveResolution;

  const payment: { mode?: PaymentMode; paymentIntentId?: string | null } =
    typeof body.payment === 'object' && body.payment
      ? { mode: body.payment.mode, paymentIntentId: body.payment.paymentIntentId }
      : {};
  const userGate = await resolveGenerateUserGate({ req, body });
  if (userGate.kind === 'response') {
    if (userGate.metric) {
      logMetric('rejected', userGate.metric);
    }
    return NextResponse.json(userGate.body, { status: userGate.status });
  }
  const { userId, localKey } = userGate;
  metricState.userId = userId;
  let walletChargeReserved = false;

  const extraInputValidation = validateExtraInputValues({ engine, mode, rawExtraInputValues });
  if (!extraInputValidation.ok) {
    return NextResponse.json(extraInputValidation.body, { status: extraInputValidation.status });
  }
  const validatedExtraInputValues = extraInputValidation.values;

  let generationResult: Awaited<ReturnType<typeof generateVideo>> | null = null;
  const attachmentProcessing = await processGenerationAttachments({ rawInputs: body.inputs, userId });
  if (!attachmentProcessing.ok) {
    return NextResponse.json(attachmentProcessing.body, { status: attachmentProcessing.status });
  }
  const processedAttachments = attachmentProcessing.attachments;

  const {
    maxUploadedBytes,
    lastFrameUrl,
    normalizedReferenceImages,
    videoUrls,
    audioUrls,
    resolvedAudioUrl,
    initialImageUrl,
    resolvedFirstFrameUrl,
    sourceInputVideoUrl,
  } = deriveGenerationAttachmentReferences({
    attachments: processedAttachments,
    engineId: engine.id,
    mode,
    soraImageUrl: soraRequest?.mode === 'i2v' ? soraRequest.image_url : undefined,
    imageUrl: body.imageUrl,
    image_url: body.image_url,
    referenceImages: body.referenceImages,
    reference_images: body.reference_images,
    rawAudioUrl,
  });
  const validationPayloadResult = buildGenerateValidationPayload({
    engineId: engine.id,
    mode,
    prompt,
    multiPrompt,
    supportsResolution,
    effectiveResolution,
    supportsAspectRatio,
    aspectRatio,
    audioEnabled,
    isBytePlusV1a,
    supportsDuration,
    numFrames,
    validationDuration: lumaDurationInfo?.label ?? (Number.isFinite(durationSec) ? durationSec : null),
    maxUploadedBytes,
    resolvedFirstFrameUrl,
    lastFrameUrl,
    normalizedReferenceImages,
    videoUrls,
    audioUrls,
    resolvedAudioUrl,
    sourceInputVideoUrl,
    elements,
    isLumaRay2,
    initialImageUrl,
  });
  if (!validationPayloadResult.ok) {
    logMetric('rejected', validationPayloadResult.metric);
    return NextResponse.json(validationPayloadResult.body, { status: validationPayloadResult.status });
  }
  const { needsImage, needsFirstLastFrames } = validationPayloadResult;

  const billingPreflight = await resolveGenerateBillingPreflight({
    req,
    engine,
    mode,
    userId,
    payment,
    jobId,
    durationSec,
    durationLabel,
    pricingResolution,
    effectiveResolution,
    aspectRatio,
    membershipTier: body.membershipTier,
    soraVariant: soraRequest?.variant,
    isLumaRay2,
    loop,
    rawDurationOption,
    lumaDurationLabel: lumaDurationInfo?.label ?? null,
    audioEnabled,
    voiceControl,
  });
  if (!billingPreflight.ok) {
    if (billingPreflight.metric) {
      logMetric('rejected', billingPreflight.metric);
    }
    return NextResponse.json(billingPreflight.body, { status: billingPreflight.status });
  }

  const billing = billingPreflight.preflight;
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

  const placeholderThumb =
    aspectRatio === '9:16'
      ? '/assets/frames/thumb-9x16.svg'
      : aspectRatio === '1:1'
        ? '/assets/frames/thumb-1x1.svg'
        : '/assets/frames/thumb-16x9.svg';

  const {
    falInputs,
    falInputSummary,
    falDurationOption,
    clampedFps,
    falPayload,
  } = buildFalRequestParts({
    attachments: processedAttachments,
    engineId: engine.id,
    prompt,
    mode,
    apiKey: body.apiKey,
    jobId,
    localKey,
    needsImage,
    needsFirstLastFrames,
    initialImageUrl,
    resolvedFirstFrameUrl,
    lastFrameUrl,
    resolvedAudioUrl,
    normalizedReferenceImages,
    videoUrls,
    audioUrls,
    soraRequest,
    isLumaRay2,
    loop,
    multiPrompt,
    shotType,
    seed,
    cameraFixed,
    safetyChecker,
    voiceIds,
    elements,
    endImageUrl,
    extraInputValues: validatedExtraInputValues,
    supportsDuration,
    durationSec,
    durationOption: lumaDurationInfo?.label ?? rawDurationLabel ?? rawDurationOption ?? null,
    numFrames,
    supportsAspectRatio,
    aspectRatio,
    supportsResolution,
    resolution: effectiveResolution,
    audioEnabled,
    supportsFps,
    fps: body.fps,
    cfgScale: body.cfgScale,
  });

  const settingsSnapshot = buildGenerationSettingsSnapshot({
    engineId: engine.id,
    engineLabel: engine.label,
    mode,
    prompt,
    negativePrompt: body.negativePrompt,
    membershipTier: body.membershipTier,
    durationSec,
    durationOption: falDurationOption,
    numFrames,
    aspectRatio,
    resolution: effectiveResolution,
    clampedFps,
    rawFps: body.fps,
    iterationCount,
    audioEnabled,
    cfgScale: body.cfgScale,
    isLumaRay2,
    loop,
    shotType,
    seed,
    cameraFixed,
    safetyChecker,
    voiceIds,
    voiceControl,
    multiPrompt,
    extraInputValues: validatedExtraInputValues,
    initialImageUrl,
    resolvedFirstFrameUrl,
    resolvedAudioUrl,
    normalizedReferenceImages,
    videoUrls,
    lastFrameUrl,
    endImageUrl,
    elements,
    falInputs,
  });
  let settingsSnapshotJson = JSON.stringify(settingsSnapshot);

  const providerJobTracker = createProviderJobTracker({
    jobId,
    providerKey,
    engineId: engine.id,
    prompt,
    inputSummary: falInputSummary,
  });
  const { getLastProviderJobId, persistProviderJobId, setLastProviderJobId } = providerJobTracker;

  try {
    const initialJobState = await createAtomicInitialVideoJob({
      jobId,
      userId,
      paymentMode,
      pendingReceipt,
      preferredCurrency,
      resolvedCurrencyLower,
      jobInsert: {
        jobId,
        userId,
        engineId: engine.id,
        engineLabel: engine.label,
        durationSec,
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
    });

    if (initialJobState.kind === 'existing_job') {
      return NextResponse.json(buildResponseFromExistingVideoJob(initialJobState.job, localKey));
    }

    walletChargeReserved = initialJobState.walletChargeReserved;
    if (paymentMode === 'wallet' && !preferredCurrency) {
      await ensureUserPreferredCurrency(String(userId), resolvedCurrencyLower);
      preferredCurrency = resolvedCurrencyLower;
    }

    logMetric('accepted', {
      jobId,
      durationMs: Date.now() - requestStartedAt,
      meta: { paymentMode, inputSummary: falInputSummary },
    });
  } catch (error) {
    if (error instanceof VideoInitialJobError) {
      if (pendingReceipt && paymentMode !== 'wallet') {
        await rollbackPendingPayment({
          pendingReceipt,
          walletChargeReserved,
          refundDescription: `Refund ${engine.label} - ${durationSec}s`,
        });
      }
      logMetric(error.metricKind, {
        errorCode: error.metricCode,
        meta: error.metricMeta,
      });
      return NextResponse.json(error.body, { status: error.status });
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
        refundDescription: `Refund ${engine.label} - ${durationSec}s`,
      });
    }
    return NextResponse.json({ ok: false, error: 'Failed to persist job record' }, { status: 500 });
  }

  if (isBytePlusV1a) {
    const bytePlusSubmission = await submitBytePlusGenerateTask({
      jobId,
      userId,
      engineId: engine.id,
      engineLabel: engine.label,
      isPublicSeedanceBytePlus,
      prompt,
      durationSec,
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
      deps: {
        persistProviderJobIdFn: persistProviderJobId,
        logMetricFn: logMetric,
      },
    });
    return NextResponse.json(
      bytePlusSubmission.body,
      bytePlusSubmission.ok ? undefined : { status: bytePlusSubmission.status }
    );
  }

  try {
    const promise = generateVideo(
      { ...falPayload },
      {
        onRequestId: (requestId) => {
          console.info('[fal] request id received', { jobId, engineId: engine.id, requestId });
          persistProviderJobId(requestId);
        },
        onQueueUpdate: (status) => {
          if (!status) return;
          const requestId =
            (status as { request_id?: string }).request_id ?? getLastProviderJobId() ?? null;
          setLastProviderJobId(requestId);
        },
      }
    );
    generationResult = await withFalTimeout(
      promise,
      isLumaRay2 ? LUMA_RAY2_TIMEOUT_MS : FAL_HARD_TIMEOUT_MS
    );
  } catch (error) {
    const rawStatus =
      error && typeof error === 'object' && 'status' in error ? (error as { status?: number }).status : undefined;
    const metadataStatus =
      error && typeof error === 'object' && '$metadata' in error
        ? ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode)
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
      status === 429 ||
      (typeof providerMessage === 'string' && providerMessage.toLowerCase().includes('quota'));
    const fallbackMessage = isTimeoutError
      ? 'Generation timed out'
      : isQuotaError
        ? 'Provider is rate limiting'
        : 'Fal request failed';
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
    const failureMessage = translation.message;
    const errorCode = translation.code;
    const providerJobId: string | null =
      error instanceof FalGenerationError && error.providerJobId
        ? error.providerJobId
        : typeof (error as { providerJobId?: string } | undefined)?.providerJobId === 'string'
          ? (error as { providerJobId?: string }).providerJobId!
          : getLastProviderJobId() ?? batchId ?? null;
  const paymentStatusOverride =
      pendingReceipt && paymentMode === 'wallet'
        ? 'refunded_wallet'
        : pendingReceipt && paymentMode !== 'wallet'
          ? 'refunded'
          : null;
    const baseRefundDescription = `Refund ${engine.label} - ${durationSec}s`;
    const refundNote = failureMessage ?? null;
    const refundDescription = refundNote ? `${baseRefundDescription} - ${refundNote}` : baseRefundDescription;

    if (error instanceof FalGenerationError) {
      (error as { code?: string }).code = errorCode;
      (error as { userMessage?: string }).userMessage = failureMessage;
    }

    console.error(
      '[api/generate] Fal generation failed',
      {
        jobId,
        engineId: engine.id,
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
        effectiveProviderMessage && effectiveProviderMessage !== fallbackMessage
          ? `Still processing: ${effectiveProviderMessage}. Your request is in progress; we will update you shortly.`
          : 'Rendering in progress; awaiting provider after timeout. We will refresh as soon as the next status arrives.';

      if (providerJobId) {
        await markJobAwaitingFal({
          jobId,
          engineId: engine.id,
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
        });
      } else {
        await query(
          `UPDATE app_jobs
             SET status = 'running',
                 progress = $2,
                 message = $3,
                 provisional = FALSE,
                 updated_at = NOW()
           WHERE job_id = $1`,
          [jobId, progressFloor, waitingMessage]
        ).catch((updateError) => {
          console.error('[api/generate] failed to mark timeout job awaiting provider', updateError);
        });
      }

      return NextResponse.json(
        {
          ok: true,
          jobId,
          status: 'running',
          progress: progressFloor,
          providerJobId,
          deferred: true,
          message: waitingMessage,
        },
        { status: 202 }
      );
    }

    if (deferable && providerJobId) {
      const progressFloor = Math.min(95, FAL_PROGRESS_FLOOR + FAL_RETRY_DELAYS_MS.length * 5);
      const waitingMessage =
        effectiveProviderMessage && effectiveProviderMessage !== fallbackMessage
          ? `Still processing: ${effectiveProviderMessage}. Your request is in progress; we will update you shortly.`
          : 'Rendering in progress; next update imminent. No action needed while we wait for the next status update.';

      await markJobAwaitingFal({
        jobId,
        engineId: engine.id,
        providerJobId,
        message: waitingMessage,
        statusLabel: 'deferred',
        attempt: FAL_RETRY_DELAYS_MS.length + 1,
        context: {
          status,
          deferred: true,
        },
        progressFloor,
      });

      return NextResponse.json(
        {
          ok: true,
          jobId,
          status: 'running',
          progress: progressFloor,
          providerJobId,
          deferred: true,
          message: waitingMessage,
        },
        { status: 202 }
      );
    }

    try {
      await query(
        `UPDATE app_jobs
         SET status = 'failed',
             progress = 0,
             message = $2,
             provisional = FALSE,
             provider_job_id = COALESCE($3, provider_job_id),
             payment_status = CASE WHEN $4::text IS NOT NULL THEN $4 ELSE payment_status END,
             updated_at = NOW()
         WHERE job_id = $1`,
        [jobId, failureMessage, providerJobId, paymentStatusOverride]
      );
    } catch (updateError) {
      console.error('[api/generate] failed to update provisional job after Fal error', updateError);
    }

    if (pendingReceipt && !isTimeoutError) {
      await rollbackPendingPayment({
        pendingReceipt,
        walletChargeReserved,
        refundDescription,
      });
    }

    if (status === 422) {
      console.error('[generate] fal returned 422', providerMessage ?? '<no-provider-message>');

      let translatedErrorCode: string | null = null;
      let translatedMessage: string | null = null;
      let translatedProviderMessage: string | null = null;

      const resolveTranslation = (input: ErrorTranslationInput) => {
        const translation = translateError(input);
        translatedErrorCode = translation.code;
        translatedMessage = translation.message;
        translatedProviderMessage = translation.providerMessage ?? translation.originalMessage ?? null;
      };

      if (detail && Array.isArray(detail) && detail.length) {
        const firstDetail = detail[0] as Record<string, unknown>;
        const detailCode = typeof firstDetail.type === 'string' ? firstDetail.type : undefined;
        const detailMessage = typeof firstDetail.msg === 'string' ? firstDetail.msg : undefined;
        resolveTranslation({
          code: detailCode ?? 'FAL_UNPROCESSABLE_ENTITY',
          status,
          message: detailMessage ?? effectiveProviderMessage ?? providerMessage ?? null,
          providerMessage: detailMessage ?? effectiveProviderMessage ?? providerMessage ?? null,
        });
      } else if (detail && typeof detail === 'object' && detail !== null) {
        const detailRecord = detail as Record<string, unknown>;
        const detailCode = typeof detailRecord.code === 'string' ? detailRecord.code : undefined;
        const detailMessage = typeof detailRecord.message === 'string' ? detailRecord.message : undefined;
        resolveTranslation({
          code: detailCode ?? 'FAL_UNPROCESSABLE_ENTITY',
          status,
          message: detailMessage ?? effectiveProviderMessage ?? providerMessage ?? null,
          providerMessage: detailMessage ?? effectiveProviderMessage ?? providerMessage ?? null,
        });
      } else {
        resolveTranslation({
          code: 'FAL_UNPROCESSABLE_ENTITY',
          status,
          message: effectiveProviderMessage ?? providerMessage ?? null,
          providerMessage: effectiveProviderMessage ?? providerMessage ?? null,
        });
      }

      const userMessage = isLumaRay2
        ? LUMA_RAY2_ERROR_UNSUPPORTED
        : translatedMessage ?? 'This request cannot be processed for this engine. Please adjust your inputs and try again.';

      logMetric('failed', {
        errorCode: translatedErrorCode ?? 'FAL_UNPROCESSABLE_ENTITY',
        meta: { stage: 'provider_422', providerJobId },
      });
      return NextResponse.json(
        {
          ok: false,
          error: translatedErrorCode ?? 'FAL_UNPROCESSABLE_ENTITY',
          message: userMessage,
          providerMessage: translatedProviderMessage ?? effectiveProviderMessage ?? providerMessage ?? null,
          detail: detail ?? providerMessage,
        },
        { status: 422 }
      );
    }

    logMetric('failed', {
      errorCode,
      meta: {
        stage: 'provider_error',
        providerJobId,
        providerStatus: status ?? metadataStatus ?? null,
      },
    });
    return NextResponse.json(
      {
        ok: false,
        error: errorCode,
        message: failureMessage,
        providerMessage: effectiveProviderMessage ?? providerMessage ?? null,
        detail,
      },
      { status: isTimeoutError ? 504 : isQuotaError ? 429 : status ?? 500 }
    );
  }

  if (!generationResult) {
    throw new Error('Fal generation did not return a result.');
  }

  const initialMediaState = buildInitialProviderMediaState({
    generationResult,
    batchId,
    placeholderThumb,
  });
  let {
    thumb,
    previewFrame,
    video,
    videoAsset,
    providerMode,
    status,
    progress,
    providerJobId,
  } = initialMediaState;

  // Safety net: if Fal didn’t return a provider job id and we have no video result, treat as failed and refund.
  if (!providerJobId && !video) {
    const failureMessage = 'We could not start your render. Please retry.';
    console.error('[api/generate] missing provider_job_id and no result', { jobId, engineId: engine.id, generationResult });
    logMetric('failed', {
      errorCode: 'FAL_NO_PROVIDER_JOB_ID',
      meta: { stage: 'provider_missing_id' },
    });
    try {
      await query(
        `UPDATE app_jobs
         SET status = 'failed',
             progress = 0,
             message = $2,
             provisional = FALSE,
             updated_at = NOW()
         WHERE job_id = $1`,
        [jobId, failureMessage]
      );
    } catch (updateError) {
      console.error('[api/generate] failed to mark job as failed after missing provider_job_id', updateError);
    }

    if (pendingReceipt) {
      const refundDescription = `Refund ${engine.label} - ${durationSec}s - missing provider_job_id`;
      await rollbackPendingPayment({
        pendingReceipt,
        walletChargeReserved,
        refundDescription,
      });
    }

    return NextResponse.json(
      {
        ok: false,
        error: 'FAL_NO_PROVIDER_JOB_ID',
        message: failureMessage,
      },
      { status: 502 }
    );
  }

  const mediaState = await resolveProviderMediaState({
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
  ({
    thumb,
    previewFrame,
    video,
    videoAsset,
    providerMode,
    status,
    progress,
    providerJobId,
    settingsSnapshotJson,
    message,
  } = mediaState);

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
        refundDescription: `Refund ${engine.label} - ${durationSec}s`,
      });
    }
    return NextResponse.json({ ok: false, error: 'Failed to update job record' }, { status: 500 });
  }

  await persistFinalChargeReceipt({ pendingReceipt, walletChargeReserved });

  await recordFinalGenerateQueueLog({
    jobId,
    provider: providerMode,
    providerJobId,
    engineId: engine.id,
    status,
    durationSec,
    durationLabel,
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
      durationSec,
    });
  }

  await persistWalletFailureRefundReceipt({
    status,
    pendingReceipt,
    paymentMode,
    engineLabel: engine.label,
    durationSec,
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

  return NextResponse.json(finalResponse);
}
