import {
  projectCanonicalQuoteToSnapshot,
  quoteCanonicalPricing,
  type PricingCompatibilityProfile,
  type PricingSnapshot,
} from '@maxvideoai/pricing';
import { getPricingDetails } from '@/lib/fal-catalog';
import { buildAudioPricingPresentation, type AudioPricingInput } from '@/lib/audio-generation';
import { LIVE_MEMBERSHIP_POLICY, LIVE_MEMBERSHIP_DISCOUNTS } from '@/lib/membership-policy';
import { buildBillingPricingFacts } from '@/lib/pricing-billing-facts';
import { getVersionedPricingPolicy, resolveLiveAudioPricingProfile } from '@/lib/pricing-policy-defaults';
import type { PricingContext } from '@/lib/pricing-context';
import {
  buildStoryboardPricingProjection,
  STORYBOARD_BILLING_ENGINE_ID,
  type StoryboardPricingOperation,
  type StoryboardTier,
} from '@/lib/storyboard-pricing';

import {
  resolveServerBillingPolicy,
  type ResolveServerPricingPolicyDependencies,
} from './resolve-pricing-policy';

/** Finishing tools supply vendor facts; the canonical kernel owns all customer rounding and margins. */
export async function computeCanonicalFinishingBillingSnapshot(input: { toolId: string; quality: string; vendorBudgetUsd: number; durationSec: number; profileId: string; pricingSource: string }): Promise<PricingSnapshot> {
  if (!Number.isFinite(input.vendorBudgetUsd) || input.vendorBudgetUsd <= 0) throw new Error('Invalid tool vendor budget.');
  const engineId = 'toolbox-finishing';
  const { policy, vendorAccountId } = await resolveServerBillingPolicy({ engineId, mode: `${input.toolId}:${input.quality}`, resolution: 'video' });
  // A database-wide legacy default must not silently replace this product's policy.
  if (policy.rule.engineId !== engineId) throw new Error('TOOL_PRICING_UNAVAILABLE');
  if (policy.rule.currency !== 'USD') throw new Error('Tool pricing currency is unsupported.');
  const compatibilityProfile = getVersionedPricingPolicy().compatibilityProfiles.find(profile => profile.id === 'standard');
  if (!compatibilityProfile) throw new Error('Missing standard pricing profile.');
  const quote = quoteCanonicalPricing({
    facts: { engineId, currency: 'USD', vendorSubtotalExactCents: input.vendorBudgetUsd * 100, unit: 'video', quantity: 1 },
    scenario: { id: `billing:tool:${input.toolId}:${input.quality}`, engineId, mode: `${input.toolId}:${input.quality}`, membershipTier: LIVE_MEMBERSHIP_POLICY.tier, discountPercent: 0 },
    policy, compatibilityProfile,
  });
  return projectCanonicalQuoteToSnapshot({ quote, base: { seconds: input.durationSec, rate: input.vendorBudgetUsd, unit: 'video', amountCents: input.vendorBudgetUsd * 100 }, addons: [], vendorAccountId,
    meta: { surface: 'tool', toolId: input.toolId, quality: input.quality, profileId: input.profileId, providerCostSource: input.pricingSource, providerCostKind: 'conservative-budget', vendorBudgetUsd: input.vendorBudgetUsd, ruleId: policy.sourceRuleId } });
}

export async function computeCanonicalBillingSnapshot(
  context: PricingContext,
  dependencies: {
    pricingPolicy?: ResolveServerPricingPolicyDependencies;
    membershipDiscounts?: Record<string, number>;
  } = {}
): Promise<PricingSnapshot> {
  const pricingDetails = context.engine.pricingDetails ?? (await getPricingDetails(context.engine.id));
  const { policy, vendorAccountId } = await resolveServerBillingPolicy(
    {
      engineId: context.engine.id,
      ...(context.mode ? { mode: context.mode } : {}),
      ...(context.resolution ? { resolution: context.resolution } : {}),
    },
    context.engine.vendorAccountId,
    dependencies.pricingPolicy
  );
  const currency = (context.currency ?? policy.rule.currency ?? pricingDetails?.currency ?? context.engine.pricing?.currency ?? 'USD').toUpperCase();
  const memberTier = LIVE_MEMBERSHIP_POLICY.tier;
  const memberTierDiscounts = LIVE_MEMBERSHIP_DISCOUNTS;

  const billingFacts = buildBillingPricingFacts(context, pricingDetails, currency);
  const policyDocument = getVersionedPricingPolicy();
  const profileId = policy.rule.compatibilityProfile ?? billingFacts.compatibilityProfileId;
  const compatibilityProfile: PricingCompatibilityProfile | undefined = policyDocument.compatibilityProfiles.find(
    (profile) => profile.id === profileId
  );
  if (!compatibilityProfile) throw new Error(`Missing pricing compatibility profile ${profileId}`);
  const discountPercent = memberTierDiscounts[memberTier] ?? 0;
  const quote = quoteCanonicalPricing({
    facts: billingFacts.facts,
    scenario: {
      id: `billing:${context.engine.id}:${context.mode ?? 'default'}:${context.resolution}`,
      engineId: context.engine.id,
      ...(context.mode ? { mode: context.mode } : {}),
      resolution: context.resolution,
      membershipTier: memberTier,
      discountPercent,
    },
    policy,
    compatibilityProfile,
  });
  const snapshot = projectCanonicalQuoteToSnapshot({
    quote,
    base: billingFacts.base,
    addons: billingFacts.addons,
    vendorAccountId,
    meta: {
      ...billingFacts.meta,
      ruleId: policy.sourceRuleId,
      engineLabel: context.engine.label,
      engineVersion: context.engine.version,
      ruleCurrency: policy.rule.currency,
      membershipDiscounts: memberTierDiscounts,
    },
  });
  return snapshot;
}

export async function computeCanonicalAudioBillingSnapshot(input: AudioPricingInput, dependencies: { pricingPolicy?: ResolveServerPricingPolicyDependencies } = {}): Promise<PricingSnapshot> {
  const { policy, vendorAccountId } = await resolveServerBillingPolicy({
    engineId: 'audio-generation',
    mode: input.pack,
    resolution: 'audio',
  }, undefined, dependencies.pricingPolicy);
  const policyDocument = getVersionedPricingPolicy();
  const profileId = resolveLiveAudioPricingProfile(policy.rule);
  const compatibilityProfile = policyDocument.compatibilityProfiles.find((profile) => profile.id === profileId);
  if (!compatibilityProfile) throw new Error(`Missing pricing compatibility profile ${profileId}`);
  const presentation = buildAudioPricingPresentation(input);
  const quote = quoteCanonicalPricing({
    facts: {
      engineId: 'audio-generation',
      currency: policy.rule.currency,
      vendorSubtotalExactCents: presentation.vendorSubtotalCents,
      unit: presentation.base.unit ?? 'audio',
      quantity: presentation.durationSec,
    },
    scenario: {
      id: `billing:audio-generation:${input.pack}`,
      engineId: 'audio-generation',
      mode: input.pack,
      resolution: 'audio',
      membershipTier: 'member',
      discountPercent: 0,
    },
    policy,
    compatibilityProfile,
  });
  const snapshot = projectCanonicalQuoteToSnapshot({
    quote,
    base: presentation.base,
    addons: presentation.addons,
    vendorAccountId,
    meta: {
      ...presentation.meta,
      marginPercent: quote.breakdown.marginPercent,
    },
  });
  delete snapshot.margin.ruleId;
  return snapshot;
}

export type CanonicalStoryboardSnapshotInput = {
  snapshot: PricingSnapshot;
  operation: StoryboardPricingOperation;
  tier?: StoryboardTier;
};

export async function computeCanonicalStoryboardBillingSnapshot(
  input: CanonicalStoryboardSnapshotInput,
  dependencies: { pricingPolicy?: ResolveServerPricingPolicyDependencies } = {}
): Promise<PricingSnapshot> {
  const projection = buildStoryboardPricingProjection(input);
  const { policy, vendorAccountId } = await resolveServerBillingPolicy(
    {
      engineId: STORYBOARD_BILLING_ENGINE_ID,
      mode: input.operation,
      resolution: projection.resolution,
    },
    input.snapshot.vendorAccountId,
    dependencies.pricingPolicy
  );
  const policyDocument = getVersionedPricingPolicy();
  const profileId = policy.rule.compatibilityProfile ?? 'standard';
  const compatibilityProfile = policyDocument.compatibilityProfiles.find((profile) => profile.id === profileId);
  if (!compatibilityProfile) throw new Error(`Missing pricing compatibility profile ${profileId}`);
  const quote = quoteCanonicalPricing({
    facts: {
      ...projection.facts,
      currency: policy.rule.currency,
    },
    scenario: {
      id: `billing:${STORYBOARD_BILLING_ENGINE_ID}:${input.operation}:${projection.resolution}`,
      engineId: STORYBOARD_BILLING_ENGINE_ID,
      mode: input.operation,
      resolution: projection.resolution,
      membershipTier: LIVE_MEMBERSHIP_POLICY.tier,
      discountPercent: LIVE_MEMBERSHIP_POLICY.discountPercent,
    },
    policy,
    compatibilityProfile,
  });
  return projectCanonicalQuoteToSnapshot({
    quote,
    base: projection.base,
    addons: projection.addons,
    vendorAccountId,
    meta: projection.meta,
  });
}
