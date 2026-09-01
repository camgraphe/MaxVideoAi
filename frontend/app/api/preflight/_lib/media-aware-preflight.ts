import { processAndValidateGenerationAttachments } from '@/app/api/generate/_lib/generation-attachment-processing';
import {
  computeConfiguredPreflight,
  getConfiguredEngine,
  type ComputeConfiguredPreflightOptions,
  type TrustedPreflightMediaPricingFacts,
} from '@/server/engines';
import type { EngineCaps, PreflightRequest, PreflightResponse } from '@/types/engines';

type MediaConstraintDependencies = Parameters<
  typeof processAndValidateGenerationAttachments
>[0]['mediaConstraintDeps'];

type MediaAwarePreflightDependencies = {
  getConfiguredEngineFn?: typeof getConfiguredEngine;
  computeConfiguredPreflightFn?: (
    request: PreflightRequest,
    options?: ComputeConfiguredPreflightOptions,
  ) => Promise<PreflightResponse>;
  processAttachmentsFn?: typeof processAndValidateGenerationAttachments;
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
    )
  );
}

function requiresReferenceImageCount(engine: EngineCaps, request: PreflightRequest): boolean {
  return engine.pricingDetails?.referenceImages?.modes.includes(request.mode) === true;
}

function requiresInputAudioDuration(engine: EngineCaps, request: PreflightRequest): boolean {
  return engine.pricingDetails?.byMode?.[request.mode]?.durationBasis === 'input_audio';
}

export async function resolveMediaAwarePreflight(
  input: {
    request: PreflightRequest;
    userId?: string | null;
    resolveUserId?: () => Promise<string | null>;
  },
  dependencies: MediaAwarePreflightDependencies = {},
): Promise<PreflightResponse> {
  const getConfiguredEngineFn = dependencies.getConfiguredEngineFn ?? getConfiguredEngine;
  const computeConfiguredPreflightFn =
    dependencies.computeConfiguredPreflightFn ?? computeConfiguredPreflight;
  const engine = await getConfiguredEngineFn(input.request.engine);
  if (!engine) return computeConfiguredPreflightFn(input.request);

  if (hasClientDeclaredMediaPricingFacts(input.request)) {
    return mediaPricingFailure(
      'PRICING_MEDIA_FACTS_UNTRUSTED',
      'Client-declared media pricing facts are not accepted.',
    );
  }

  const needsReferenceImageCount = requiresReferenceImageCount(engine, input.request);
  const needsInputAudioDuration = requiresInputAudioDuration(engine, input.request);
  if (!needsReferenceImageCount && !needsInputAudioDuration) {
    return computeConfiguredPreflightFn(input.request, { resolvedEngine: engine });
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
    dependencies.processAttachmentsFn ?? processAndValidateGenerationAttachments;
  const processed = await processAttachmentsFn({
    rawInputs: input.request.inputs,
    userId,
    engineId: engine.id,
    mode: input.request.mode,
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

  return computeConfiguredPreflightFn(input.request, {
    resolvedEngine: engine,
    trustedMediaPricingFacts,
  });
}
