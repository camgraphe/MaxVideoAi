import type { NextRequest } from 'next/server';
import { validateExtraInputValues } from '@/app/api/generate/_lib/extra-input-values';
import { processAndValidateGenerationAttachments } from '@/app/api/generate/_lib/generation-attachment-processing';
import { buildFalRequestParts } from '@/app/api/generate/_lib/fal-request';
import { buildGenerationSettingsSnapshot } from '@/app/api/generate/_lib/settings-snapshot';
import {
  resolveGenerateBillingPreflight,
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
import type {
  TrustedIncludedTrialBilling,
  TrustedQuotedBilling,
  WalletReservation,
} from '@/server/generations/initial-job-reservation';
import { executePreparedVideoGeneration } from './execute-prepared-video-generation';
import type { PreReservedVideoInitialState, VideoGenerationAdapters, VideoGenerationResponse } from './video-generation-contracts';
import {
  buildTrustedIncludedTrialVideoBilling,
  buildTrustedQuotedVideoBilling,
} from './trusted-video-billing';

export type { VideoGenerationAdapters, VideoGenerationResponse } from './video-generation-contracts';
export { executeVideoGenerationLifecycle } from './video-generation-lifecycle';

type VideoGenerationReservationOptions =
  | ({ walletReservation: WalletReservation } & {
      walletReservation: 'reserve';
      preReservedInitialState?: never;
      trustedQuotedBilling?: never;
      funding?: never;
      trustedIncludedTrialBilling?: never;
    })
  | ({ walletReservation: WalletReservation } & {
      walletReservation: 'already_reserved';
      preReservedInitialState: PreReservedVideoInitialState;
      trustedQuotedBilling: TrustedQuotedBilling;
      funding?: never;
      trustedIncludedTrialBilling?: never;
    })
  | {
      funding: {
        kind: 'mcp_trial';
        entitlementUserId: string;
        quoteId: string;
      };
      walletReservation?: never;
      preReservedInitialState: Extract<PreReservedVideoInitialState, { funding: unknown }>;
      trustedQuotedBilling?: never;
      trustedIncludedTrialBilling: TrustedIncludedTrialBilling;
    };

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
    trustedIncludedTrialBilling,
  } = params;
  const funding = 'funding' in params ? params.funding : undefined;
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
    iterationCount,
    rawExtraInputValues,
    numFrames,
    loop,
    soraRequest,
  } = requestOptions;
  let { aspectRatio } = requestOptions;
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

  const attachmentProcessing = await processAndValidateGenerationAttachments({
    rawInputs: body.inputs,
    userId,
    engineId: engine.id,
    mode,
    inputSchema: engine.inputSchema,
    soraImageUrl: soraRequest?.mode === 'i2v' ? soraRequest.image_url : undefined,
    imageUrl: body.imageUrl,
    image_url: body.image_url,
    referenceImages: body.referenceImages,
    reference_images: body.reference_images,
    rawAudioUrl,
    endImageUrl,
    isBytePlusV1a,
  });
  if (!attachmentProcessing.ok) {
    if (attachmentProcessing.metric) logMetric('rejected', attachmentProcessing.metric);
    return {
      body: attachmentProcessing.body,
      status: attachmentProcessing.status,
    };
  }
  const {
    attachments: processedAttachments,
    references: {
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
      referenceValuesByField,
      referenceMediaItems,
      referenceProvenanceIssues,
    },
  } = attachmentProcessing;
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
    supportsFps,
    fps: body.fps,
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
    inputSchema: engine.inputSchema,
    referenceValuesByField,
    referenceMediaItems,
    referenceProvenanceIssues,
    validatedExtraInputValues,
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
    sourceImageUrl: isBytePlusV1a ? initialImageUrl : null,
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
  if (dimensionValidation.sourceAspectRatio) {
    aspectRatio = dimensionValidation.sourceAspectRatio;
  }
  const billingPreflight = trustedIncludedTrialBilling
    ? buildTrustedIncludedTrialVideoBilling(trustedIncludedTrialBilling)
    : trustedQuotedBilling
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
    ...(funding ? { funding } : {}),
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
    inputSchema: engine.inputSchema,
    referenceValuesByField,
    placeholderThumb,
    falPayload,
    falInputSummary,
    settingsSnapshot,
  });
}
