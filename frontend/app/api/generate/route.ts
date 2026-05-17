export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { validateExtraInputValues } from './_lib/extra-input-values';
import { processGenerationAttachments } from './_lib/attachments';
import { deriveGenerationAttachmentReferences } from './_lib/attachment-references';
import { createGenerateMetricLogger } from './_lib/metric-logger';
import { buildFalRequestParts } from './_lib/fal-request';
import { buildGenerationSettingsSnapshot } from './_lib/settings-snapshot';
import { persistFinalVideoJobUpdate, recordFinalGenerateQueueLog } from './_lib/final-job-persistence';
import { persistFinalChargeReceipt, persistWalletFailureRefundReceipt } from './_lib/final-receipts';
import { buildInitialProviderMediaState, resolveProviderMediaState } from './_lib/provider-media';
import { buildFinalGenerateResponse } from './_lib/final-response';
import { resolveGenerateBillingPreflight } from './_lib/billing-preflight';
import { buildGenerateValidationPayload } from './_lib/validation-payload';
import { submitBytePlusGenerateTask } from './_lib/byteplus-submission';
import { buildGenerateRequestOptions } from './_lib/request-options';
import { resolveGenerateUserGate } from './_lib/auth-idempotency';
import { submitGenerateProviderTask } from './_lib/video-provider-submission';
import {
  buildResponseFromExistingVideoJob,
  createAtomicInitialVideoJob,
  VideoInitialJobError,
} from './_lib/initial-video-job';
import { rollbackPendingPayment } from './_lib/payment-rollback';
import { generateAndPersistJobKeyframes } from '@/server/video-keyframes';
import { ensureUserPreferredCurrency } from '@/lib/currency';
import { resolveGenerateRouteContext } from './_lib/route-context';

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

  const routeContext = await resolveGenerateRouteContext({ body, req });
  if (!routeContext.ok) {
    return NextResponse.json(routeContext.body, { status: routeContext.status });
  }
  const {
    engine,
    isBytePlusV1a,
    isPublicSeedanceBytePlus,
    jobId,
    mode,
    payment,
    providerKey,
    providerRoutingPlan,
  } = routeContext.context;
  metricState.engineId = engine.id;
  metricState.engineLabel = engine.label;
  metricState.jobId = jobId;
  metricState.mode = mode;

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
    endImageUrl,
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
        logMetricFn: logMetric,
      },
    });
    return NextResponse.json(
      bytePlusSubmission.body,
      bytePlusSubmission.ok ? undefined : { status: bytePlusSubmission.status }
    );
  }

  const providerSubmission = await submitGenerateProviderTask({
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
    durationSec,
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
  if (providerSubmission.kind === 'error_response') {
    return NextResponse.json(providerSubmission.body, { status: providerSubmission.status });
  }
  if (providerSubmission.kind === 'accepted_response') {
    return NextResponse.json(providerSubmission.body);
  }
  const { generationResult } = providerSubmission;

  if (!generationResult) {
    throw new Error('Video provider generation did not return a result.');
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
