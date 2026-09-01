import {
  computeConfiguredPreflight,
  type ComputeConfiguredPreflightOptions,
  type TrustedPreflightMediaPricingFacts,
} from '@/server/engines';
import { computeCanonicalBillingSnapshot } from '@/server/pricing/quote-billing';
import type { TransactionQueryExecutor } from '@/lib/db';
import { loadMembershipTiersWithExecutor } from '@/lib/membership';
import { loadPricingPolicyOverridesWithExecutor } from '@/lib/pricing-rule-store';
import { applyEngineVariantPricing, buildEngineAddonInput } from '@/lib/pricing-addons';
import { getLumaRay2DurationInfo, isLumaRay2EngineId } from '@/lib/luma-ray2';
import { isLumaAgentsImageEngineId } from '@/lib/luma-agents';
import {
  estimateImageGeneration,
  type ImageEstimateInput,
} from '@/server/images/estimate-image-generation';
import type { PreflightRequest, PreflightResponse, PricingSnapshot } from '@/types/engines';
import type { ImageGenerationMode, ImageGenerationRequest } from '@/types/image-generation';
import {
  resolveGptImage2AutoInputImageSize,
  type GptImage2ImageSize,
} from '@/lib/image/gptImage2';

import type { CanonicalGenerationRequest } from './generation-types';
import type { AgentPublicGenerationEngine } from './model-catalog';
import type { ResolvedReference } from './reference-types';
import type { AuthoritativeMembershipTier } from '../membership/user-membership-status';
import { toEngineGenerationMode } from './generation-mode-aliases';

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
  /** Test-only seam; production always uses the canonical billing snapshot. */
  computeBillingSnapshot?: typeof computeCanonicalBillingSnapshot;
};

export type GenerationPricingReferenceContext = Readonly<{
  resolvedReferences?: readonly ResolvedReference[];
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
    request.engineId !== 'gpt-image-2'
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
  return {
    referenceImageCount: canonicalReferenceImageCount(request, context),
    ...(inputAudioDurationSec !== undefined ? { inputAudioDurationSec } : {}),
  };
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
  if (request.surface === 'video') {
    const settings = request.settings;
    const engineMode = toEngineGenerationMode(request.engineId, request.mode);
    const aspectRatio = optionalString(settings, 'aspectRatio');
    const extraInputValues = canonicalVideoExtraInputValues(request);
    const result = await dependencies.computeVideoPreflight({
      engine: request.engineId,
      mode: engineMode,
      durationSec: requiredPositiveInteger(settings, 'durationSec'),
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
      trustedMediaPricingFacts: canonicalVideoTrustedMediaPricingFacts(request, referenceContext),
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
    membershipTier,
  });
  return validatePricingResult(result.pricing, membershipTier);
}

export async function priceCanonicalGenerationInExecutor(
  request: CanonicalGenerationRequest,
  membershipTier: AuthoritativeMembershipTier,
  dependencies: ExecutorGenerationPricingDependencies,
): Promise<GenerationPricingResult> {
  if (
    dependencies.candidate.engine.id !== request.engineId
    || dependencies.candidate.surface !== request.surface
  ) {
    throw new Error('Canonical transaction pricing candidate mismatch.');
  }
  const [overrideResult, tiers] = await Promise.all([
    loadPricingPolicyOverridesWithExecutor(dependencies.executor, { lock: true }),
    loadMembershipTiersWithExecutor(dependencies.executor, { lock: true }),
  ]);
  if (overrideResult.status !== 'loaded') {
    throw new Error('Canonical transaction pricing policy unavailable.');
  }
  const membershipDiscounts = Object.fromEntries(
    tiers.map((tier) => [tier.tier, tier.discountPercent]),
  );
  const pricingPolicy = { loadOverrides: async () => overrideResult, warn: () => undefined };
  const computeBillingSnapshot = dependencies.computeBillingSnapshot ?? computeCanonicalBillingSnapshot;
  const engine = dependencies.candidate.engine;
  let snapshot: PricingSnapshot;
  if (request.surface === 'video') {
    const engineMode = toEngineGenerationMode(engine.id, request.mode);
    const pricingEngine = applyEngineVariantPricing(engine, engineMode);
    const durationSec = requiredPositiveInteger(request.settings, 'durationSec');
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
      durationSec,
      resolution,
      aspectRatio: optionalString(request.settings, 'aspectRatio'),
      mode: engineMode,
      hasVideoInput: hasCanonicalVideoInput(request, dependencies),
      referenceImageCount: canonicalReferenceImageCount(request, dependencies),
      inputAudioDurationSec: canonicalInputAudioDurationSec(request, dependencies),
      membershipTier,
      loop: isLumaRay2EngineId(engine.id) && request.settings.loop === true,
      durationOption: isLumaRay2EngineId(engine.id)
        ? getLumaRay2DurationInfo(durationSec)?.label
        : undefined,
      addons: Object.keys(addons).length ? addons : undefined,
    }, { pricingPolicy, membershipDiscounts });
  } else {
    const imageReferences = canonicalImageReferences(request);
    const customImageSize = canonicalEffectiveCustomImageSize(request, dependencies);
    const referenceImageCount = isLumaAgentsImageEngineId(engine.id)
      ? request.mode === 'i2i'
        ? Math.max(0, imageReferences.length - 1)
        : imageReferences.length
      : undefined;
    snapshot = await computeBillingSnapshot({
      engine,
      durationSec: request.outputCount,
      resolution: requiredString(request.settings, 'resolution'),
      aspectRatio: optionalString(request.settings, 'aspectRatio'),
      mode: request.mode as ImageGenerationMode,
      ...(customImageSize ? { customImageSize } : {}),
      quality: optionalString(request.settings, 'quality'),
      addons: request.settings.enableWebSearch === true
        ? { enable_web_search: true }
        : undefined,
      referenceImageCount,
      membershipTier,
      currency: engine.pricing?.currency ?? 'USD',
    }, { pricingPolicy, membershipDiscounts });
  }
  return validatePricingResult(snapshot, membershipTier);
}
