import { calculateMinimaxH3MaxReferenceTokenBudget } from '@/lib/minimax-h3-max-pricing';
import { getWan3InputVideoDurationSec } from '@/lib/wan3-pricing';
import { isArchivedGenerationModel } from '@/lib/model-generation-policy';
import { validateNormalizedGenerationAttachments } from '@/app/api/generate/_lib/normalized-generation-attachment-validation';
import {
  computeConfiguredPreflight,
  type ComputeConfiguredPreflightOptions,
  type TrustedPreflightMediaPricingFacts,
} from '@/server/engines';
import {
  getReadOnlyConfiguredEngine,
  getReadOnlyConfiguredEngineIncludingRuntimePrivate,
} from '@/server/agent-api/read-only-engine-catalog';
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
  getConfiguredEngineFn?: typeof getReadOnlyConfiguredEngine;
  getConfiguredEngineIncludingHiddenFn?: typeof getReadOnlyConfiguredEngineIncludingRuntimePrivate;
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
      || Object.prototype.hasOwnProperty.call(extra, 'inputVideoDurationSec')
      || Object.prototype.hasOwnProperty.call(extra, 'verifiedReferenceTokenCount')
      || Object.prototype.hasOwnProperty.call(extra, 'referenceTokenBudget')
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
  if (isArchivedGenerationModel(request.engine)) {
    return { ok: false, messages: ['This model is no longer available. Choose another model.'], error: { code: 'ENGINE_RETIRED', message: 'This model is no longer available.' } };
  }
  const getConfiguredEngineFn = dependencies.getConfiguredEngineFn ?? getReadOnlyConfiguredEngine;
  const getConfiguredEngineIncludingHiddenFn =
    dependencies.getConfiguredEngineIncludingHiddenFn ?? getReadOnlyConfiguredEngineIncludingRuntimePrivate;
  const computeConfiguredPreflightFn =
    dependencies.computeConfiguredPreflightFn ?? computeConfiguredPreflight;
  const publicEngine = await getConfiguredEngineFn(request.engine);
  const canAccessPrivate = input.launchCanaryContext?.access.allowedModelIds.has(request.engine) === true;
  const privateEngine = !publicEngine && canAccessPrivate
    ? await getConfiguredEngineIncludingHiddenFn(request.engine)
    : undefined;
  const engine = publicEngine ?? privateEngine;
  if (!engine) return computeConfiguredPreflightFn(request, { bootstrap: false });
  if (
    privateEngine
    && !resolveAgentGenerationModeExecutability(
      engine,
      request.mode,
      input.launchCanaryContext!.generationEnvironment,
    ).executable
  ) {
    return computeConfiguredPreflightFn(request, { bootstrap: false });
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

  const needsReferenceTokenBudget = engine.id === 'minimax-h3-max' && request.mode === 'ref2v';
  const needsWanVideoDuration = (engine.id === 'wan-3' || engine.id === 'wan-3-prime')
    && (request.mode === 'v2v' || request.mode === 'extend' || request.inputs?.some((reference) => reference.kind === 'video') === true);
  const needsReferenceImageCount = requiresReferenceImageCount(engine, request);
  const needsInputAudioDuration = requiresInputAudioDuration(engine, request);
  const needsTrustedOwnedMedia = requiresTrustedOwnedMedia(engine, request) && Boolean(request.inputs?.length || request.mode !== 't2v');
  if (!needsReferenceTokenBudget && !needsReferenceImageCount && !needsInputAudioDuration && !needsTrustedOwnedMedia && !needsWanVideoDuration) {
    return computeConfiguredPreflightFn(request, { resolvedEngine: engine, bootstrap: false });
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

  let referenceTokenBudget: number | undefined;
  let inputVideoDurationSec: number | undefined;
  if (needsWanVideoDuration) {
    try {
      inputVideoDurationSec = getWan3InputVideoDurationSec(processed.trustedMediaReferences ?? []);
      if (inputVideoDurationSec <= 0) throw new Error('Missing owned video metadata.');
    } catch {
      return mediaPricingFailure('PRICING_MEDIA_FACTS_UNVERIFIED', 'Verified video duration is required to calculate this price.');
    }
  }
  if (needsReferenceTokenBudget) {
    if (!processed.trustedMediaReferences?.length) return mediaPricingFailure('PRICING_MEDIA_FACTS_UNVERIFIED', 'Add owned references to calculate this price.');
    try {
      referenceTokenBudget = calculateMinimaxH3MaxReferenceTokenBudget({ resolution: request.resolution ?? '768P', durationSec: request.durationSec, references: processed.trustedMediaReferences });
    } catch {
      return mediaPricingFailure('PRICING_MEDIA_FACTS_UNVERIFIED', 'Reference metadata is required to calculate this price.');
    }
  }
  const trustedMediaPricingFacts: TrustedPreflightMediaPricingFacts = {
    ...(inputVideoDurationSec !== undefined ? { inputVideoDurationSec } : {}),
    ...(referenceTokenBudget !== undefined ? { referenceTokenBudget } : {}),
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
    bootstrap: false,
  });
}
