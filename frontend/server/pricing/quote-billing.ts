import {
  projectCanonicalQuoteToSnapshot,
  quoteCanonicalPricing,
  type PricingCompatibilityProfile,
  type PricingEngineDefinition,
  type PricingSnapshot,
} from '@maxvideoai/pricing';
import { getPricingDetails } from '@/lib/fal-catalog';
import { buildAudioPricingPresentation, type AudioPricingInput } from '@/lib/audio-generation';
import { getMembershipDiscountMap } from '@/lib/membership';
import { buildBillingPricingFacts } from '@/lib/pricing-billing-facts';
import { getVersionedPricingPolicy } from '@/lib/pricing-policy-defaults';
import type { PricingContext } from '@/lib/pricing';

import {
  resolveServerBillingPolicy,
  type ResolveServerPricingPolicyDependencies,
} from './resolve-pricing-policy';

function normalizeMembershipTier(value: string | null | undefined): 'member' | 'plus' | 'pro' {
  const normalized = value?.trim().toLowerCase();
  return normalized === 'plus' || normalized === 'pro' ? normalized : 'member';
}

export async function computeCanonicalBillingSnapshot(
  context: PricingContext,
  dependencies: { pricingPolicy?: ResolveServerPricingPolicyDependencies } = {}
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
  const memberTier = normalizeMembershipTier(context.membershipTier);
  const membershipDiscounts = await getMembershipDiscountMap();
  const memberTierDiscounts: PricingEngineDefinition['memberTierDiscounts'] = {
    member: 0,
    plus: 0.05,
    pro: 0.1,
  };
  (Object.keys(memberTierDiscounts) as Array<keyof typeof memberTierDiscounts>).forEach((tier) => {
    const override = membershipDiscounts[tier];
    if (typeof override === 'number' && Number.isFinite(override)) {
      memberTierDiscounts[tier] = Math.max(0, override);
    }
  });

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

export async function computeCanonicalAudioBillingSnapshot(input: AudioPricingInput): Promise<PricingSnapshot> {
  const { policy, vendorAccountId } = await resolveServerBillingPolicy({
    engineId: 'audio-generation',
    mode: input.pack,
    resolution: 'audio',
  });
  const policyDocument = getVersionedPricingPolicy();
  const profileId = policy.rule.compatibilityProfile ?? 'audio-current';
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
    meta: presentation.meta,
  });
  delete snapshot.margin.ruleId;
  return snapshot;
}
