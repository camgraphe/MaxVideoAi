import { validateNormalizedGenerationAttachments } from '@/app/api/generate/_lib/normalized-generation-attachment-validation';
import {
  computeConfiguredPreflight,
  getConfiguredEngine,
  getConfiguredEngineIncludingHidden,
  type ComputeConfiguredPreflightOptions,
  type TrustedPreflightMediaPricingFacts,
} from '@/server/engines';
import type { EngineCaps, PreflightRequest, PreflightResponse } from '@/types/engines';
import { parsePreflightRequestPayload } from './preflight-request';
import type { LaunchCanaryRequestContext } from '@/server/model-launch-canary-request';
import { resolveAgentGenerationModeExecutability } from '@/server/agent-runtime/model-executability';
import { validateRuntimeRequestSettings } from '@/app/api/generate/_lib/runtime-schema-options';
import { resolveRuntimeResolutionPolicy } from '@/server/video-generation/runtime-resolution';

type MediaConstraintDependencies = Parameters<
  typeof validateNormalizedGenerationAttachments
>[0]['mediaConstraintDeps'];

export type MediaAwarePreflightDependencies = {
  getConfiguredEngineFn?: typeof getConfiguredEngine;
  getConfiguredEngineIncludingHiddenFn?: typeof getConfiguredEngineIncludingHidden;
  computeConfiguredPreflightFn?: (
    request: PreflightRequest,
    options?: ComputeConfiguredPreflightOptions,
  ) => Promise<PreflightResponse>;
  processAttachmentsFn?: typeof validateNormalizedGenerationAttachments;
  mediaConstraintDeps?: MediaConstraintDependencies;
};

function mediaPricingFailure(
  code: string,
  message: string,
): PreflightResponse {
  return {
    ok: false,
    messages: [message],
    error: { code, message },
  };
}

function hasClientDeclaredMediaPricingFacts(request: PreflightRequest): boolean {
  const extra = request.extraInputValues;
  return Boolean(
    extra
    && typeof extra === 'object'
    && !Array.isArray(extra)
    && (
      Object.prototype.hasOwnProperty.call(extra, 'referenceImageCount')
      || Object.prototype.hasOwnProperty.call(extra, 'inputAudioDurationSec')
      || Object.prototype.hasOwnProperty.call(extra, 'verifiedReferenceTokenCount')
    )
  );
}

function requiresReferenceImageCount(engine: EngineCaps, request: PreflightRequest): boolean {
  return engine.pricingDetails?.referenceImages?.modes.includes(request.mode) === true;
}

function requiresInputAudioDuration(engine: EngineCaps, request: PreflightRequest): boolean {
  return engine.pricingDetails?.byMode?.[request.mode]?.durationBasis === 'input_audio';
}

function requiresTrustedOwnedMedia(engine: EngineCaps, request: PreflightRequest): boolean {
  return engine.inputSchema?.constraints?.ownedAssetModes?.includes(request.mode) === true;
}

function hasValidPersistedReferenceRoles(engine: EngineCaps, request: PreflightRequest): boolean {
  if (!request.inputs?.length) return true;
  const activeMediaFields = new Map(
    [
      ...(engine.inputSchema?.required ?? []),
      ...(engine.inputSchema?.optional ?? []),
    ]
      .filter((field) =>
        (field.type === 'image' || field.type === 'video' || field.type === 'audio')
        && (!field.modes?.length || field.modes.includes(request.mode))
      )
      .map((field) => [field.id, field.type]),
  );
  return request.inputs.every((reference) => activeMediaFields.get(reference.slotId) === reference.kind);
}

export async function resolveMediaAwarePreflight(
  input: {
    request: PreflightRequest;
    userId?: string | null;
    resolveUserId?: () => Promise<string | null>;
    launchCanaryContext?: LaunchCanaryRequestContext | null;
  },
  dependencies: MediaAwarePreflightDependencies = {},
): Promise<PreflightResponse> {
  const parsedRequest = parsePreflightRequestPayload(input.request);
  if (!parsedRequest.ok) return parsedRequest.response;
  const request = parsedRequest.request;
  const getConfiguredEngineFn = dependencies.getConfiguredEngineFn ?? getConfiguredEngine;
  const getConfiguredEngineIncludingHiddenFn =
    dependencies.getConfiguredEngineIncludingHiddenFn ?? getConfiguredEngineIncludingHidden;
  const computeConfiguredPreflightFn =
    dependencies.computeConfiguredPreflightFn ?? computeConfiguredPreflight;
  const publicEngine = await getConfiguredEngineFn(request.engine);
  const canAccessPrivate = input.launchCanaryContext?.access.allowedModelIds.has(request.engine) === true;
  const privateEngine = !publicEngine && canAccessPrivate
    ? await getConfiguredEngineIncludingHiddenFn(request.engine)
    : undefined;
  const engine = publicEngine ?? privateEngine;
  if (!engine) return computeConfiguredPreflightFn(request);
  if (
    privateEngine
    && !resolveAgentGenerationModeExecutability(
      engine,
      request.mode,
      input.launchCanaryContext!.generationEnvironment,
    ).executable
  ) {
    return computeConfiguredPreflightFn(request);
  }
  if (privateEngine || resolveRuntimeResolutionPolicy(engine, request.mode).usesSchemaDefaults) {
    const settingsValidation = validateRuntimeRequestSettings({
      engine,
      mode: request.mode,
      durationSec: request.durationSec,
      resolution: request.resolution,
      aspectRatio: request.aspectRatio,
      fps: request.fps,
    });
    if (!settingsValidation.ok) {
      return mediaPricingFailure(
        settingsValidation.error.code,
        settingsValidation.error.message,
      );
    }
  }

  if (hasClientDeclaredMediaPricingFacts(request)) {
    return mediaPricingFailure(
      'PRICING_MEDIA_FACTS_UNTRUSTED',
      'Client-declared media pricing facts are not accepted.',
    );
  }

  if (!hasValidPersistedReferenceRoles(engine, request)) {
    return mediaPricingFailure(
      'PREFLIGHT_REQUEST_INVALID',
      'Invalid preflight request.',
    );
  }

  const needsReferenceImageCount = requiresReferenceImageCount(engine, request);
  const needsInputAudioDuration = requiresInputAudioDuration(engine, request);
  const needsTrustedOwnedMedia = requiresTrustedOwnedMedia(engine, request);
  if (!needsReferenceImageCount && !needsInputAudioDuration && !needsTrustedOwnedMedia) {
    return computeConfiguredPreflightFn(request, { resolvedEngine: engine });
  }
  const userId = input.userId === undefined
    ? await input.resolveUserId?.() ?? null
    : input.userId;
  if (!userId) {
    return mediaPricingFailure(
      'PRICING_MEDIA_FACTS_UNVERIFIED',
      'Sign in so media pricing facts can be verified.',
    );
  }

  const processAttachmentsFn =
    dependencies.processAttachmentsFn ?? validateNormalizedGenerationAttachments;
  const processed = await processAttachmentsFn({
    attachments: (request.inputs ?? []).map((reference) => ({
      name: 'persisted-reference',
      type: 'application/octet-stream',
      size: 0,
      ...reference,
    })),
    userId,
    engineId: engine.id,
    mode: request.mode,
    inputSchema: engine.inputSchema,
    mediaConstraintDeps: dependencies.mediaConstraintDeps,
  });
  if (!processed.ok) {
    const body = processed.body as { error?: unknown; message?: unknown };
    const code = typeof body.error === 'string' ? body.error : 'PRICING_MEDIA_FACTS_UNVERIFIED';
    const message = typeof body.message === 'string'
      ? body.message
      : 'Required media pricing facts could not be verified.';
    return mediaPricingFailure(code, message);
  }

  const trustedMediaPricingFacts: TrustedPreflightMediaPricingFacts = {
    ...(needsReferenceImageCount
      ? { referenceImageCount: processed.references.normalizedReferenceImages.length }
      : {}),
    ...(needsInputAudioDuration
      && typeof processed.trustedDurationSecByField.audio_url?.[0] === 'number'
      ? { inputAudioDurationSec: processed.trustedDurationSecByField.audio_url[0] }
      : {}),
  };
  if (
    needsInputAudioDuration
    && typeof trustedMediaPricingFacts.inputAudioDurationSec !== 'number'
  ) {
    return mediaPricingFailure(
      'PRICING_MEDIA_FACTS_UNVERIFIED',
      'Trusted input-audio duration is required to compute this price.',
    );
  }

  return computeConfiguredPreflightFn(request, {
    resolvedEngine: engine,
    trustedMediaPricingFacts,
  });
}
