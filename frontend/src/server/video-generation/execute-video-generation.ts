import type { NextRequest } from 'next/server';
import { getPlatformFeeCents } from '@maxvideoai/pricing';
import { validateExtraInputValues } from '@/app/api/generate/_lib/extra-input-values';
import { processGenerationAttachments } from '@/app/api/generate/_lib/attachments';
import { deriveGenerationAttachmentReferences } from '@/app/api/generate/_lib/attachment-references';
import { buildFalRequestParts } from '@/app/api/generate/_lib/fal-request';
import { buildGenerationSettingsSnapshot } from '@/app/api/generate/_lib/settings-snapshot';
import {
  resolveGenerateBillingPreflight,
  type GenerateBillingPreflightResult,
} from '@/app/api/generate/_lib/billing-preflight';
import { buildGenerateValidationPayload } from '@/app/api/generate/_lib/validation-payload';
import { validateGenerationImageDimensions } from '@/app/api/generate/_lib/generation-image-dimensions';
import { resolveGenerateSourceVideoContext } from '@/app/api/generate/_lib/source-video-context';
import type { GenerateRouteContext } from '@/app/api/generate/_lib/route-context';
import type { GenerateRequestOptions } from '@/app/api/generate/_lib/request-options';
import type {
  GenerateRouteMetricOptions,
  GenerateRouteMetricState,
  GenerateRouteMetricStatus,
} from '@/app/api/generate/_lib/metric-logger';
import { normalizeCurrencyCode } from '@/lib/currency';
import type {
  TrustedQuotedBilling,
  WalletReservation,
} from '@/server/generations/initial-job-reservation';
import { executePreparedVideoGeneration } from './execute-prepared-video-generation';
import type { PreReservedVideoInitialState, VideoGenerationAdapters, VideoGenerationResponse } from './video-generation-contracts';

export type { VideoGenerationAdapters, VideoGenerationResponse } from './video-generation-contracts';
export { executeVideoGenerationLifecycle } from './video-generation-lifecycle';

type VideoGenerationReservationOptions =
  | ({ walletReservation: WalletReservation } & {
      walletReservation: 'reserve';
      preReservedInitialState?: never;
      trustedQuotedBilling?: never;
    })
  | ({ walletReservation: WalletReservation } & {
      walletReservation: 'already_reserved';
      preReservedInitialState: PreReservedVideoInitialState;
      trustedQuotedBilling: TrustedQuotedBilling;
    });

export type ExecuteVideoGenerationOptions = {
  req: NextRequest;
  body: Record<string, unknown>;
  routeContext: GenerateRouteContext;
  requestOptions: GenerateRequestOptions;
  userId: string;
  localKey: string | null;
  requestStartedAt: number;
  metricState: GenerateRouteMetricState;
  logMetric: (status: GenerateRouteMetricStatus, options?: GenerateRouteMetricOptions) => void;
  adapters: VideoGenerationAdapters;
} & VideoGenerationReservationOptions;

function buildTrustedQuotedVideoBilling(params: {
  trustedQuotedBilling: TrustedQuotedBilling;
  engineLabel: string;
  userId: string;
  jobId: string;
  durationSec: number;
}): GenerateBillingPreflightResult {
  const source = params.trustedQuotedBilling.pricing;
  const pricing = JSON.parse(JSON.stringify(source)) as typeof source;
  const currency = typeof pricing.currency === 'string' ? pricing.currency.toUpperCase() : '';
  const resolvedCurrencyLower = normalizeCurrencyCode(currency);
  if (
    !Number.isSafeInteger(pricing.totalCents)
    || pricing.totalCents < 0
    || !resolvedCurrencyLower
    || pricing.membershipTier !== params.trustedQuotedBilling.membershipTier
  ) {
    throw new Error('Invalid trusted quoted video billing.');
  }
  const applicationFeeCents = getPlatformFeeCents(pricing);
  const vendorAccountId = typeof pricing.vendorAccountId === 'string'
    ? pricing.vendorAccountId
    : null;
  const pricingSnapshotJson = JSON.stringify(pricing);
  return {
    ok: true,
    preflight: {
      preferredCurrency: resolvedCurrencyLower,
      resolvedCurrencyLower,
      resolvedCurrencyUpper: currency,
      pricing,
      priceOnlyReceipts: false,
      costBreakdownUsd: null,
      receiptSnapshot: pricing,
      pricingSnapshotJson,
      costBreakdownJson: null,
      vendorAccountId,
      applicationFeeCents,
      visibility: 'private',
      indexable: false,
      paymentMode: 'wallet',
      pendingReceipt: {
        userId: params.userId,
        amountCents: pricing.totalCents,
        currency,
        description: `MCP ${params.engineLabel} - ${params.durationSec}s`,
        jobId: params.jobId,
        snapshot: pricing,
        applicationFeeCents,
        vendorAccountId,
      },
      paymentStatus: 'paid_wallet',
      stripePaymentIntentId: null,
      stripeChargeId: null,
    },
  };
}

export async function executeVideoGeneration(params: ExecuteVideoGenerationOptions): Promise<VideoGenerationResponse> {
  const {
    req,
    body,
    routeContext,
    requestOptions,
    userId,
    localKey,
    requestStartedAt,
    metricState,
    logMetric,
    walletReservation,
    preReservedInitialState,
    trustedQuotedBilling,
  } = params;
  const { engine, isBytePlusV1a, jobId, mode, payment } = routeContext;

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
    iterationCount,
    rawExtraInputValues,
    numFrames,
    loop,
    soraRequest,
  } = requestOptions;
  const { pricingResolution, effectiveResolution } = requestOptions;

  const extraInputValidation = validateExtraInputValues({
    engine,
    mode,
    rawExtraInputValues,
  });
  if (!extraInputValidation.ok) {
    return {
      body: extraInputValidation.body,
      status: extraInputValidation.status,
    };
  }
  const validatedExtraInputValues = extraInputValidation.values;

  const attachmentProcessing = await processGenerationAttachments({
    rawInputs: body.inputs,
    userId,
  });
  if (!attachmentProcessing.ok) {
    return {
      body: attachmentProcessing.body,
      status: attachmentProcessing.status,
    };
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
    startImageUrl,
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
  const sourceVideoContext = resolveGenerateSourceVideoContext({
    mode,
    attachments: processedAttachments,
    sourceInputVideoUrl,
    videoUrls,
    fallbackDurationSec: durationSec,
    fallbackDurationLabel: durationLabel,
    maxDurationSec: engine.inputLimits?.videoMaxDurationSec ?? engine.maxDurationSec ?? null,
    engineLabel: engine.label,
  });
  if (!sourceVideoContext.ok) {
    logMetric('rejected', sourceVideoContext.metric);
    return { body: sourceVideoContext.body, status: sourceVideoContext.status };
  }
  const { durationSec: effectiveDurationSec, durationLabel: effectiveDurationLabel, hasVideoInput } = sourceVideoContext;
  metricState.durationSec = effectiveDurationSec;
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
    validationDuration: lumaDurationInfo?.label ?? (Number.isFinite(effectiveDurationSec) ? effectiveDurationSec : null),
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
    startImageUrl,
    isLumaRay2,
    initialImageUrl,
    loop,
    seed,
    safetyChecker,
  });
  if (!validationPayloadResult.ok) {
    logMetric('rejected', validationPayloadResult.metric);
    return {
      body: validationPayloadResult.body,
      status: validationPayloadResult.status,
    };
  }
  const { needsImage, needsFirstLastFrames } = validationPayloadResult;

  const dimensionValidation = await validateGenerationImageDimensions({
    engineId: engine.id,
    userId: String(userId),
    attachments: processedAttachments,
    imageUrls: [initialImageUrl, resolvedFirstFrameUrl, lastFrameUrl, ...normalizedReferenceImages, startImageUrl, endImageUrl],
    elements,
  });
  if (!dimensionValidation.ok) {
    logMetric('rejected', dimensionValidation.metric);
    return {
      body: dimensionValidation.body,
      status: dimensionValidation.status,
    };
  }
  const billingPreflight = trustedQuotedBilling
    ? buildTrustedQuotedVideoBilling({
        trustedQuotedBilling,
        engineLabel: engine.label,
        userId,
        jobId,
        durationSec: effectiveDurationSec,
      })
    : await resolveGenerateBillingPreflight({
    req,
    engine,
    mode,
    userId,
    payment,
    jobId,
    durationSec: effectiveDurationSec,
    durationLabel: effectiveDurationLabel,
    pricingResolution,
    effectiveResolution,
    aspectRatio,
    membershipTier: typeof body.membershipTier === 'string' ? body.membershipTier : undefined,
    soraVariant: soraRequest?.variant,
    isLumaRay2,
    loop,
    hasVideoInput,
    rawDurationOption,
    lumaDurationLabel: lumaDurationInfo?.label ?? null,
    audioEnabled,
    voiceControl,
      });
  if (!billingPreflight.ok) {
    if (billingPreflight.metric) {
      logMetric('rejected', billingPreflight.metric);
    }
    return { body: billingPreflight.body, status: billingPreflight.status };
  }

  const billing = billingPreflight.preflight;

  const placeholderThumb =
    aspectRatio === '9:16'
      ? '/assets/frames/thumb-9x16.svg'
      : aspectRatio === '1:1'
        ? '/assets/frames/thumb-1x1.svg'
        : '/assets/frames/thumb-16x9.svg';

  const { falInputs, falInputSummary, falDurationOption, clampedFps, falPayload } = buildFalRequestParts({
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
    durationSec: effectiveDurationSec,
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
    durationSec: effectiveDurationSec,
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

  return executePreparedVideoGeneration({
    body,
    routeContext,
    requestOptions,
    userId,
    localKey,
    requestStartedAt,
    logMetric,
    walletReservation,
    preReservedInitialState,
    adapters: params.adapters,
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
    placeholderThumb,
    falPayload,
    falInputSummary,
    settingsSnapshot,
  });
}
