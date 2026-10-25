import { NANO21_ENGINE_ID, NANO21_DEFAULT_MAX_OUTPUT_TOKENS } from '@/lib/nano-banana-2-1';
import { canonicalOperationSourceDuration } from './generation-operation-facts';
import { assertCanonicalLumaSourceTiming } from './generation-luma-source';
import { bytePlusInputVideoDurationSec, isBytePlusInputVideoPricingModel } from '@/server/byteplus-accounting';
import { resolveSeedance25ModelArkEditSource } from '@/server/seedance-edit-source';
import { seedanceSourcePricingAspectRatio } from '@/lib/seedance-option-pricing';
import {
  computeConfiguredPreflight,
  type ComputeConfiguredPreflightOptions,
  type TrustedPreflightMediaPricingFacts,
} from '@/server/engines';
import { computeCanonicalBillingSnapshot } from '@/server/pricing/quote-billing';
import type { TransactionQueryExecutor } from '@/lib/db';
import type { PricingContext } from '@/lib/pricing-context';
import { LIVE_MEMBERSHIP_POLICY } from '@/lib/membership-policy';
import { loadPricingPolicyOverridesWithExecutor } from '@/lib/pricing-rule-store';
import { applyEngineVariantPricing, buildEngineAddonInput } from '@/lib/pricing-addons';
import { getLumaRay2DurationInfo, isLumaRay2EngineId } from '@/lib/luma-ray2';
import { isLumaAgentsImageEngineId } from '@/lib/luma-agents';
import { isSeedreamEngineId } from '@/lib/image/seedream';
import { isMinimaxH3MaxEngineId } from '@/lib/minimax-h3-max';
import { calculateMinimaxH3MaxReferenceTokenBudget } from '@/lib/minimax-h3-max-pricing';
import { getWan3InputVideoDurationSec, isWan3EngineId } from '@/lib/wan3-pricing';
import {
  estimateImageGeneration,
  type ImageEstimateInput,
} from '@/server/images/estimate-image-generation';
import type { EngineCaps, PreflightRequest, PreflightResponse, PricingSnapshot } from '@/types/engines';
import type { ImageGenerationMode, ImageGenerationRequest } from '@/types/image-generation';
import {
  isGptImageFamilyEngineId,
  isGptImage25EngineId,
  resolveGptImage2AutoInputImageSize,
  type GptImage2ImageSize,
} from '@/lib/image/gptImage2';

import type { CanonicalGenerationRequest } from './generation-types';
import type { AgentPublicGenerationEngine } from './model-catalog';
import type { ResolvedReference } from './reference-types';
import type { AuthoritativeMembershipTier } from '../membership/user-membership-status';
import { toEngineGenerationMode } from './generation-mode-aliases';
import type { SeedanceWorkflowMediaFacts } from '@/server/seedance-workflow-facts';
import {canonicalOmniPricingFacts} from './generation-omni-pricing-facts';

export type GenerationPricingResult = {
  priceCents: number;
  currency: string;
  membershipTier: AuthoritativeMembershipTier;
  pricingSnapshot: Record<string, unknown>;
};

export type GenerationPricingDependencies = {
  computeVideoPreflight(
    request: PreflightRequest,
    options?: ComputeConfiguredPreflightOptions,
  ): Promise<PreflightResponse>;
  estimateImage(
    input: ImageEstimateInput,
  ): Promise<Awaited<ReturnType<typeof estimateImageGeneration>>>;
};

export type ExecutorGenerationPricingDependencies = {
  executor: TransactionQueryExecutor;
  candidate: AgentPublicGenerationEngine;
  resolvedReferences?: readonly ResolvedReference[];
  /** Server-only billing product adapter; ordinary generation uses the canonical model owner. */
  computeBillingSnapshot?: typeof computeCanonicalBillingSnapshot;
  seedanceFinalFacts?: SeedanceWorkflowMediaFacts;
  fluxDraftSource?: import('@/server/flux-draft-cache').QualifiedFluxDraftSource;
};

export type GenerationPricingReferenceContext = Readonly<{
  resolvedReferences?: readonly ResolvedReference[];
  resolvedEngine?: EngineCaps;
  seedanceFinalFacts?: SeedanceWorkflowMediaFacts;
  fluxDraftSource?: import('@/server/flux-draft-cache').QualifiedFluxDraftSource;
}>;

const defaultDependencies: GenerationPricingDependencies = {
  computeVideoPreflight: computeConfiguredPreflight,
  estimateImage: estimateImageGeneration,
};

function requiredString(
  settings: CanonicalGenerationRequest['settings'],
  key: string,
): string {
  const value = settings[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('Canonical pricing input is incomplete.');
  }
  return value;
}

function requiredPositiveInteger(
  settings: CanonicalGenerationRequest['settings'],
  key: string,
): number {
  const value = settings[key];
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    throw new Error('Canonical pricing input is incomplete.');
  }
  return value as number;
}

function optionalString(
  settings: CanonicalGenerationRequest['settings'],
  key: string,
): string | undefined {
  const value = settings[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function pricingRecord(snapshot: PricingSnapshot): Record<string, unknown> {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw new Error('Canonical pricing snapshot is unavailable.');
  }
  return snapshot as unknown as Record<string, unknown>;
}

function hasCanonicalVideoInput(
  request: CanonicalGenerationRequest,
  context: GenerationPricingReferenceContext,
): boolean {
  if (context.seedanceFinalFacts) return context.seedanceFinalFacts.hasVideoInput;
  if (request.surface !== 'video') return false;
  if (
    request.mode === 'v2v'
    || request.mode === 'r2v'
    || request.mode === 'extend'
    || request.mode === 'retake'
    || request.mode === 'reframe'
  ) return true;
  if (request.mode !== 'ref2v') return false;
  return request.references.some((reference) => {
    if (reference.role !== 'reference') return false;
    if (reference.kind === 'https') return reference.mediaKind === 'video';
    return context.resolvedReferences?.some((resolved) =>
      resolved.assetId === reference.assetId
      && resolved.role === reference.role
      && resolved.mediaKind === 'video') === true;
  });
}

function canonicalReferenceImageCount(
  request: CanonicalGenerationRequest,
  context: GenerationPricingReferenceContext,
): number {
  if (context.seedanceFinalFacts) return context.seedanceFinalFacts.attachments.filter(a => a.kind === 'image' && !['image_url', 'end_image_url'].includes(a.slotId ?? '')).length;
  return request.references.reduce((count, reference) => {
    if (reference.role !== 'reference') return count;
    if (reference.kind === 'https') {
      return count + (reference.mediaKind === 'image' ? 1 : 0);
    }
    const resolved = context.resolvedReferences?.find((candidate) =>
      candidate.assetId === reference.assetId
      && candidate.role === reference.role
      && candidate.slot === reference.slot);
    // Preparation resolves private assets before pricing. Keep the unresolved
    // fallback conservative so a non-standard caller can never underquote.
    return count + (!resolved || resolved.mediaKind === 'image' ? 1 : 0);
  }, 0);
}

function canonicalInputAudioDurationSec(
  request: CanonicalGenerationRequest,
  context: GenerationPricingReferenceContext,
): number | undefined {
  if (request.surface !== 'video' || request.mode !== 'a2v') return undefined;
  const resolved = context.resolvedReferences?.find((candidate) =>
    candidate.role === 'source'
    && candidate.mediaKind === 'audio'
    && request.references.some((reference) =>
      reference.role === 'source'
      && reference.kind === 'asset'
      && reference.assetId === candidate.assetId
      && reference.slot === candidate.slot));
  if (context.resolvedReferences !== undefined) {
    return typeof resolved?.durationSec === 'number' && Number.isFinite(resolved.durationSec) && resolved.durationSec > 0
      ? resolved.durationSec
      : undefined;
  }
  // Project budgets have declared roles but no resolved media. For A2V only,
  // durationSec is the caller's explicit intended source-audio/clip duration.
  return requiredPositiveInteger(request.settings, 'durationSec');
}

function canonicalInputVideoDurationSec(
  request: CanonicalGenerationRequest,
  context: GenerationPricingReferenceContext,
): number | undefined {
  if (context.seedanceFinalFacts) return context.seedanceFinalFacts.inputVideoDurationSec;
  const bytePlus = isBytePlusInputVideoPricingModel(request.engineId);
  if (!isWan3EngineId(request.engineId) && !bytePlus) return undefined;
  if (request.mode !== 'ref2v' && request.mode !== 'v2v' && request.mode !== 'extend') return bytePlus ? undefined : 0;
  // Unresolved media cannot establish supplier usage. Active proportional
  // tariffs require trusted source duration; caller declarations cannot supply it.
  if (bytePlus && (request.references.some(reference => reference.kind === 'https' && reference.mediaKind === 'video')
    || request.references.some(reference => reference.kind === 'asset' && !context.resolvedReferences?.some(resolved =>
      resolved.assetId === reference.assetId && resolved.role === reference.role && resolved.slot === reference.slot)))) return undefined;
  const references = request.references.flatMap((reference) => {
    if (reference.kind === 'https') {
      if (reference.mediaKind === 'video') throw new Error('Owned video metadata is required for reference pricing.');
      return [];
    }
    const matches = context.resolvedReferences?.filter((resolved) =>
      resolved.assetId === reference.assetId && resolved.role === reference.role && resolved.slot === reference.slot);
    if (matches?.length !== 1) throw new Error('Each reference must have one verified metadata record.');
    const resolved = matches[0]!;
    return [{ kind: resolved.mediaKind, url: resolved.storageUrl, durationSec: resolved.durationSec }];
  });
  const inputVideoDurationSec = bytePlus ? bytePlusInputVideoDurationSec(request.engineId, references)
    : getWan3InputVideoDurationSec(references);
  if ((request.mode === 'v2v' || request.mode === 'extend') && inputVideoDurationSec <= 0) {
    throw new Error('A trusted source video duration is required for reference pricing.');
  }
  return inputVideoDurationSec;
}

function canonicalSeedanceEditSource(request: CanonicalGenerationRequest, context: GenerationPricingReferenceContext) {
  if (context.seedanceFinalFacts) return context.seedanceFinalFacts.seedanceEditSource;
  return resolveSeedance25ModelArkEditSource(request.engineId, request.mode,
    (context.resolvedReferences ?? []).filter(reference => request.references.some(input => input.kind === 'asset'
      && input.assetId === reference.assetId && input.role === reference.role && input.slot === reference.slot))
      .map(reference => ({ kind: reference.mediaKind, durationSec: reference.durationSec, width: reference.width, height: reference.height,
        fieldId: reference.role === 'source' ? 'video_url' : 'video_urls' })), request.seedanceWorkflow ? 'modelark' : undefined);
}

function canonicalSeedanceSourceAspect(request: CanonicalGenerationRequest, context: GenerationPricingReferenceContext) {
  if (context.seedanceFinalFacts) return context.seedanceFinalFacts.seedanceSourceAspectRatio;
  const references = (context.resolvedReferences ?? []).filter(reference => request.references.some(input => input.kind === 'asset'
    && input.assetId === reference.assetId && input.role === reference.role && input.slot === reference.slot))
    .filter(reference => request.mode === 'i2v' || request.mode === 'i2v_standard'
      ? reference.role === 'first_frame' || reference.role === 'source'
      : reference.role === 'source');
  return seedanceSourcePricingAspectRatio({ engine: { id: request.engineId },
    mode: toEngineGenerationMode(request.engineId, request.mode), aspectRatio: optionalString(request.settings, 'aspectRatio') },
    references.map(reference => ({ kind: reference.mediaKind, width: reference.width, height: reference.height,
      fieldId: request.mode === 'i2v' || request.mode === 'i2v_standard' ? 'image_url'
        : request.mode === 'extend' ? 'extension_source_videos' : 'video_url' })));
}

function canonicalImageReferences(request: CanonicalGenerationRequest) {
  return request.references.filter((reference) => reference.role !== 'mask');
}

function canonicalImageReferenceSizes(
  request: CanonicalGenerationRequest,
  context: GenerationPricingReferenceContext,
): GptImage2ImageSize[] {
  const included = new Set(canonicalImageReferences(request)
    .filter((reference) => reference.kind === 'asset')
    .map((reference) => `${reference.assetId}\u0000${reference.role}\u0000${reference.slot ?? ''}`));
  return (context.resolvedReferences ?? []).flatMap((reference) => {
    const key = `${reference.assetId}\u0000${reference.role}\u0000${reference.slot ?? ''}`;
    return included.has(key)
      && typeof reference.width === 'number'
      && typeof reference.height === 'number'
      ? [{ width: reference.width, height: reference.height }]
      : [];
  });
}

function canonicalCustomImageSize(request: CanonicalGenerationRequest): GptImage2ImageSize | null {
  return typeof request.settings.imageWidth === 'number'
    && typeof request.settings.imageHeight === 'number'
    ? { width: request.settings.imageWidth, height: request.settings.imageHeight }
    : null;
}

function canonicalEffectiveCustomImageSize(
  request: CanonicalGenerationRequest,
  context: GenerationPricingReferenceContext,
): GptImage2ImageSize | null {
  const explicit = canonicalCustomImageSize(request);
  if (explicit) return explicit;
  if (
    !isGptImageFamilyEngineId(request.engineId)
    || request.mode !== 'i2i'
    || request.settings.resolution !== 'auto'
  ) return null;
  return resolveGptImage2AutoInputImageSize(canonicalImageReferenceSizes(request, context));
}

function canonicalVideoExtraInputValues(
  request: CanonicalGenerationRequest,
): Record<string, boolean> {
  return {
    ...(request.settings.hdr === true ? { hdr: true } : {}),
    ...(request.settings.exrExport === true ? { exr_export: true } : {}),
  };
}

function canonicalVideoTrustedMediaPricingFacts(
  request: CanonicalGenerationRequest,
  context: GenerationPricingReferenceContext,
): TrustedPreflightMediaPricingFacts {
  const inputAudioDurationSec = canonicalInputAudioDurationSec(request, context);
  const inputVideoDurationSec = canonicalInputVideoDurationSec(request, context);
  const referenceTokenBudget = canonicalReferenceTokenBudget(request, context);
  const seedanceEditSource = canonicalSeedanceEditSource(request, context);
  const seedanceSourceAspectRatio = seedanceEditSource ? undefined : canonicalSeedanceSourceAspect(request, context);
  return {
    referenceImageCount: canonicalReferenceImageCount(request, context),
    ...(seedanceEditSource ? { seedanceEditSource } : {}),
    ...(seedanceSourceAspectRatio ? { seedanceSourceAspectRatio } : {}),
    ...(inputAudioDurationSec !== undefined ? { inputAudioDurationSec } : {}),
    ...(inputVideoDurationSec !== undefined ? { inputVideoDurationSec } : {}),
    ...(referenceTokenBudget !== undefined ? { referenceTokenBudget } : {}),
    ...canonicalOmniPricingFacts(request,context.resolvedReferences),
  };
}

function canonicalReferenceTokenBudget(
  request: CanonicalGenerationRequest,
  context: GenerationPricingReferenceContext,
): number | undefined {
  if (!isMinimaxH3MaxEngineId(request.engineId) || request.mode !== 'ref2v') return undefined;
  if (!context.resolvedReferences || !request.references.length) {
    throw new Error('Owned reference metadata is required for the reference cost budget.');
  }
  const references = request.references.map((reference) => {
    if (reference.kind !== 'asset') {
      throw new Error('Owned reference metadata is required for the reference cost budget.');
    }
    const matches = context.resolvedReferences!.filter((resolved) =>
      resolved.assetId === reference.assetId && resolved.role === reference.role && resolved.slot === reference.slot);
    if (matches.length !== 1) throw new Error('Each reference must have one verified metadata record.');
    const resolved = matches[0]!;
    return {
      kind: resolved.mediaKind, url: resolved.storageUrl,
      width: resolved.width, height: resolved.height, durationSec: resolved.durationSec,
    };
  });
  return calculateMinimaxH3MaxReferenceTokenBudget({
    resolution: requiredString(request.settings, 'resolution'),
    durationSec: requiredPositiveInteger(request.settings, 'durationSec'),
    references,
  });
}

function validatePricingResult(
  snapshot: PricingSnapshot,
  membershipTier: AuthoritativeMembershipTier,
  expectedTotal?: number,
  expectedCurrency?: string,
): GenerationPricingResult {
  const priceCents = snapshot.totalCents;
  const currency = snapshot.currency;
  if (
    !Number.isSafeInteger(priceCents)
    || priceCents < 0
    || typeof currency !== 'string'
    || !/^[A-Z]{3}$/u.test(currency)
    || snapshot.membershipTier !== membershipTier
    || (expectedTotal !== undefined && expectedTotal !== priceCents)
    || (expectedCurrency !== undefined && expectedCurrency !== currency)
  ) {
    throw new Error('Canonical pricing result is inconsistent.');
  }
  return { priceCents, currency, membershipTier, pricingSnapshot: pricingRecord(snapshot) };
}

export async function priceCanonicalGeneration(
  request: CanonicalGenerationRequest,
  membershipTier: AuthoritativeMembershipTier,
  dependencies: GenerationPricingDependencies = defaultDependencies,
  referenceContext: GenerationPricingReferenceContext = {},
): Promise<GenerationPricingResult> {
  membershipTier = LIVE_MEMBERSHIP_POLICY.tier;
  if (request.surface === 'video') {
    const lumaModifyDurationSec = assertCanonicalLumaSourceTiming(request, referenceContext.resolvedReferences);
    if (referenceContext.resolvedEngine && referenceContext.resolvedEngine.id !== request.engineId) {
      throw new Error('Canonical pricing engine mismatch.');
    }
    const settings = request.settings;
    const engineMode = toEngineGenerationMode(request.engineId, request.mode);
    const aspectRatio = optionalString(settings, 'aspectRatio');
    const extraInputValues = canonicalVideoExtraInputValues(request);
    const result = await dependencies.computeVideoPreflight({
      engine: request.engineId,
      mode: engineMode,
      ...(request.operation ? { operation: request.operation } : {}),
      durationSec: canonicalOperationSourceDuration(request, referenceContext.resolvedReferences, referenceContext.fluxDraftSource) ?? lumaModifyDurationSec ?? requiredPositiveInteger(settings, 'durationSec'),
      ...(settings.durationOption === 'auto' ? { durationOption: 'auto' } : {}),
      resolution: requiredString(settings, 'resolution') as PreflightRequest['resolution'],
      ...(aspectRatio === undefined
        ? {}
        : { aspectRatio: aspectRatio as NonNullable<PreflightRequest['aspectRatio']> }),
      fps: typeof settings.fps === 'number' ? settings.fps : 24,
      ...(typeof settings.loop === 'boolean' ? { loop: settings.loop } : {}),
      ...(typeof settings.audio === 'boolean' ? { audio: settings.audio } : {}),
      hasVideoInput: hasCanonicalVideoInput(request, referenceContext),
      ...(Object.keys(extraInputValues).length ? { extraInputValues } : {}),
      user: { memberTier: membershipTier },
    }, {
      ...(request.seedanceWorkflow ? { seedanceWorkflowStep: request.seedanceWorkflow.step } : {}),
      trustedMediaPricingFacts: canonicalVideoTrustedMediaPricingFacts(request, referenceContext),
      ...(referenceContext.resolvedEngine ? { resolvedEngine: referenceContext.resolvedEngine } : {}),
    });
    if (!result.ok || !result.pricing || result.total === undefined || !result.currency) {
      throw new Error('Canonical video pricing is unavailable.');
    }
    return validatePricingResult(result.pricing, membershipTier, result.total, result.currency);
  }

  const settings = request.settings;
  const customImageSize = canonicalEffectiveCustomImageSize(request, referenceContext);
  const result = await dependencies.estimateImage({
    engineId: request.engineId,
    mode: request.mode as ImageGenerationMode,
    numImages: request.outputCount,
    resolution: requiredString(settings, 'resolution'),
    quality: optionalString(settings, 'quality') as ImageGenerationRequest['quality'],
    aspectRatio: optionalString(settings, 'aspectRatio'),
    referenceImageCount: canonicalImageReferences(request).length,
    referenceImageSizes: canonicalImageReferenceSizes(request, referenceContext),
    ...(customImageSize ? { customImageSize } : {}),
    enableWebSearch: request.settings.enableWebSearch === true,
    ...(request.engineId === NANO21_ENGINE_ID ? { thinkingLevel: optionalString(settings, 'thinkingLevel') as ImageGenerationRequest['thinkingLevel'],
      maxOutputTokens: Number(settings.maxOutputTokens ?? NANO21_DEFAULT_MAX_OUTPUT_TOKENS), systemInstruction: optionalString(settings, 'systemInstruction'), enableImageSearch: settings.enableImageSearch === true } : {}),
    membershipTier,
  });
  return validatePricingResult(result.pricing, membershipTier);
}

export async function priceCanonicalGenerationInExecutor(
  request: CanonicalGenerationRequest,
  membershipTier: AuthoritativeMembershipTier,
  dependencies: ExecutorGenerationPricingDependencies,
): Promise<GenerationPricingResult> {
  membershipTier = LIVE_MEMBERSHIP_POLICY.tier;
  if (
    dependencies.candidate.engine.id !== request.engineId
    || dependencies.candidate.surface !== request.surface
  ) {
    throw new Error('Canonical transaction pricing candidate mismatch.');
  }
  const overrideResult = await loadPricingPolicyOverridesWithExecutor(dependencies.executor, { lock: true });
  if (overrideResult.status !== 'loaded') {
    throw new Error('Canonical transaction pricing policy unavailable.');
  }
  const pricingPolicy = { loadOverrides: async () => overrideResult, warn: () => undefined };
  return priceCanonicalGenerationWithBilling(request, membershipTier, {
    ...dependencies, resolvedEngine: dependencies.candidate.engine,
  }, context => (dependencies.computeBillingSnapshot ?? computeCanonicalBillingSnapshot)(context, { pricingPolicy }));
}

/** Shared trusted-media normalization; the caller selects a server-owned billing product. */
export async function priceCanonicalGenerationWithBilling(
  request: CanonicalGenerationRequest,
  membershipTier: AuthoritativeMembershipTier,
  referenceContext: GenerationPricingReferenceContext & { resolvedEngine: EngineCaps },
  computeBillingSnapshot: (context: PricingContext) => Promise<PricingSnapshot>,
): Promise<GenerationPricingResult> {
  membershipTier = LIVE_MEMBERSHIP_POLICY.tier;
  const engine = referenceContext.resolvedEngine;
  if (engine.id !== request.engineId) throw new Error('Canonical pricing engine mismatch.');
  let snapshot: PricingSnapshot;
  if (request.surface === 'video') {
    const lumaModifyDurationSec = assertCanonicalLumaSourceTiming(request, referenceContext.resolvedReferences);
    const engineMode = toEngineGenerationMode(engine.id, request.mode);
    const pricingEngine = applyEngineVariantPricing(engine, engineMode);
    const durationSec = canonicalOperationSourceDuration(request, referenceContext.resolvedReferences, referenceContext.fluxDraftSource) ?? lumaModifyDurationSec ?? requiredPositiveInteger(request.settings, 'durationSec');
    const seedanceEditSource = canonicalSeedanceEditSource(request, referenceContext);
    const seedanceSourceAspectRatio = seedanceEditSource ? undefined : canonicalSeedanceSourceAspect(request, referenceContext);
    const resolution = requiredString(request.settings, 'resolution');
    const audioEnabled = typeof request.settings.audio === 'boolean'
      ? request.settings.audio
      : undefined;
    const baseAddons = buildEngineAddonInput(pricingEngine, { audioEnabled });
    const addons = {
      ...(baseAddons ?? {}),
      ...(request.settings.hdr === true ? { hdr: true } : {}),
      ...(request.settings.exrExport === true ? { exr_export: true } : {}),
    };
    snapshot = await computeBillingSnapshot({
      engine: pricingEngine,
      ...(request.operation ? { operation: request.operation } : {}),
      durationSec: seedanceEditSource?.billedDurationSec ?? durationSec,
      resolution,
      aspectRatio: seedanceEditSource?.pricingAspectRatio ?? optionalString(request.settings, 'aspectRatio'),
      mode: engineMode,
      ...(request.seedanceWorkflow ? { workflowStep: request.seedanceWorkflow.step } : {}),
      hasVideoInput: hasCanonicalVideoInput(request, referenceContext),
      referenceImageCount: canonicalReferenceImageCount(request, referenceContext),
      inputAudioDurationSec: canonicalInputAudioDurationSec(request, referenceContext),
      inputVideoDurationSec: canonicalInputVideoDurationSec(request, referenceContext),
      ...(seedanceEditSource ? { seedanceEditSource } : {}),
      ...(seedanceSourceAspectRatio ? { seedanceSourceAspectRatio } : {}),
      referenceTokenBudget: canonicalReferenceTokenBudget(request, referenceContext),
      ...canonicalOmniPricingFacts(request,referenceContext.resolvedReferences),
      membershipTier,
      loop: isLumaRay2EngineId(engine.id) && request.settings.loop === true,
      durationOption: request.settings.durationOption === 'auto' ? 'auto' : isLumaRay2EngineId(engine.id)
        ? getLumaRay2DurationInfo(durationSec)?.label
        : undefined,
      addons: Object.keys(addons).length ? addons : undefined,
    });
  } else {
    const imageReferences = canonicalImageReferences(request);
    const customImageSize = canonicalEffectiveCustomImageSize(request, referenceContext);
    const referenceImageCount = isLumaAgentsImageEngineId(engine.id)
      ? request.mode === 'i2i'
        ? Math.max(0, imageReferences.length - 1)
        : imageReferences.length
      : engine.id === NANO21_ENGINE_ID || isGptImage25EngineId(engine.id) && request.mode === 'i2i'
        ? imageReferences.length
        : undefined;
    snapshot = await computeBillingSnapshot({
      engine,
      durationSec: request.outputCount,
      ...(engine.id === NANO21_ENGINE_ID ? { thinkingLevel: optionalString(request.settings, 'thinkingLevel'),
        maxOutputTokens: Number(request.settings.maxOutputTokens ?? NANO21_DEFAULT_MAX_OUTPUT_TOKENS), systemInstruction: optionalString(request.settings, 'systemInstruction'),
        enableWebSearch: request.settings.enableWebSearch === true, enableImageSearch: request.settings.enableImageSearch === true } : {}),
      resolution: requiredString(request.settings, 'resolution'),
      aspectRatio: optionalString(request.settings, 'aspectRatio'),
      mode: request.mode as ImageGenerationMode,
      ...(customImageSize ? { customImageSize } : {}),
      quality: optionalString(request.settings, 'quality'),
      addons: request.settings.enableWebSearch === true
        ? { enable_web_search: true }
        : undefined,
      referenceImageCount,
      ...(isSeedreamEngineId(engine.id) ? { inputImageCount: request.mode === 'i2i' ? imageReferences.length : 0 } : {}),
      membershipTier,
      currency: engine.pricing?.currency ?? 'USD',
    });
  }
  return validatePricingResult(snapshot, membershipTier);
}
