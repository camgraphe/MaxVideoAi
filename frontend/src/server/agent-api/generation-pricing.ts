import { computeConfiguredPreflight } from '@/server/engines';
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

import type { CanonicalGenerationRequest } from './generation-types';
import type { AgentPublicGenerationEngine } from './model-catalog';
import type { ResolvedReference } from './reference-types';
import type { AuthoritativeMembershipTier } from '../membership/user-membership-status';

export type GenerationPricingResult = {
  priceCents: number;
  currency: string;
  membershipTier: AuthoritativeMembershipTier;
  pricingSnapshot: Record<string, unknown>;
};

export type GenerationPricingDependencies = {
  computeVideoPreflight(request: PreflightRequest): Promise<PreflightResponse>;
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
  if (request.mode === 'v2v' || request.mode === 'extend') return true;
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
    const aspectRatio = optionalString(settings, 'aspectRatio');
    const result = await dependencies.computeVideoPreflight({
      engine: request.engineId,
      mode: request.mode,
      durationSec: requiredPositiveInteger(settings, 'durationSec'),
      resolution: requiredString(settings, 'resolution') as PreflightRequest['resolution'],
      ...(aspectRatio === undefined
        ? {}
        : { aspectRatio: aspectRatio as NonNullable<PreflightRequest['aspectRatio']> }),
      fps: typeof settings.fps === 'number' ? settings.fps : 24,
      ...(typeof settings.loop === 'boolean' ? { loop: settings.loop } : {}),
      ...(typeof settings.audio === 'boolean' ? { audio: settings.audio } : {}),
      hasVideoInput: hasCanonicalVideoInput(request, referenceContext),
      extraInputValues: { referenceImageCount: request.references.length },
      user: { memberTier: membershipTier },
    });
    if (!result.ok || !result.pricing || result.total === undefined || !result.currency) {
      throw new Error('Canonical video pricing is unavailable.');
    }
    return validatePricingResult(result.pricing, membershipTier, result.total, result.currency);
  }

  const settings = request.settings;
  const result = await dependencies.estimateImage({
    engineId: request.engineId,
    mode: request.mode as ImageGenerationMode,
    numImages: request.outputCount,
    resolution: requiredString(settings, 'resolution'),
    quality: optionalString(settings, 'quality') as ImageGenerationRequest['quality'],
    aspectRatio: optionalString(settings, 'aspectRatio'),
    referenceImageCount: request.references.length,
    referenceImageSizes: [],
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
    const pricingEngine = applyEngineVariantPricing(engine, request.mode);
    const durationSec = requiredPositiveInteger(request.settings, 'durationSec');
    const resolution = requiredString(request.settings, 'resolution');
    const audioEnabled = typeof request.settings.audio === 'boolean'
      ? request.settings.audio
      : undefined;
    snapshot = await computeBillingSnapshot({
      engine: pricingEngine,
      durationSec,
      resolution,
      aspectRatio: optionalString(request.settings, 'aspectRatio'),
      mode: request.mode,
      hasVideoInput: hasCanonicalVideoInput(request, dependencies),
      referenceImageCount: request.references.length,
      membershipTier,
      loop: isLumaRay2EngineId(engine.id) && request.settings.loop === true,
      durationOption: isLumaRay2EngineId(engine.id)
        ? getLumaRay2DurationInfo(durationSec)?.label
        : undefined,
      addons: buildEngineAddonInput(pricingEngine, { audioEnabled }),
    }, { pricingPolicy, membershipDiscounts });
  } else {
    const referenceImageCount = isLumaAgentsImageEngineId(engine.id)
      ? request.mode === 'i2i'
        ? Math.max(0, request.references.length - 1)
        : request.references.length
      : undefined;
    snapshot = await computeBillingSnapshot({
      engine,
      durationSec: request.outputCount,
      resolution: requiredString(request.settings, 'resolution'),
      aspectRatio: optionalString(request.settings, 'aspectRatio'),
      mode: request.mode,
      quality: optionalString(request.settings, 'quality'),
      referenceImageCount,
      membershipTier,
      currency: engine.pricing?.currency ?? 'USD',
    }, { pricingPolicy, membershipDiscounts });
  }
  return validatePricingResult(snapshot, membershipTier);
}
