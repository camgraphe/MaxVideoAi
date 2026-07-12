import {
  projectCanonicalQuoteToSnapshot,
  quoteCanonicalPricing,
  resolvePricingPolicy,
  scaleCanonicalPricingQuote,
  type CanonicalPricingQuote,
  type PricingFacts,
  type PricingPolicyRule,
  type PricingSnapshot,
} from '@maxvideoai/pricing';
import { getVersionedPricingPolicy } from '@/lib/pricing-policy-defaults';
import { selectPricingRule, type PricingRuleLite } from '@/lib/pricing-rules';

export type PublicPricingMembershipTier = 'member' | 'plus' | 'pro';

export type PublicPricingScenarioInput = {
  id: string;
  engineId: string;
  mode?: string;
  resolution?: string;
  membershipTier?: PublicPricingMembershipTier | string;
  discountPercent?: number;
  surcharge?: 'audio' | 'upscale';
};

export type QuotePublicPricingInput = {
  facts: PricingFacts;
  scenario: PublicPricingScenarioInput;
  compatibilityProfileId?: string;
  pricingRules?: PricingRuleLite[];
};

function normalizeMembershipTier(value: string | null | undefined): PublicPricingMembershipTier {
  const normalized = value?.trim().toLowerCase();
  return normalized === 'plus' || normalized === 'pro' ? normalized : 'member';
}

function defaultDiscountPercent(tier: PublicPricingMembershipTier): number {
  if (tier === 'plus') return 0.05;
  if (tier === 'pro') return 0.1;
  return 0;
}

function buildEffectiveDatabaseRule(
  selected: PricingRuleLite | null,
  fallback: PricingPolicyRule
): PricingPolicyRule[] {
  if (!selected) return [];
  return [
    {
      id: selected.id?.trim() || `public-override:${selected.engineId ?? '*'}:${selected.resolution ?? '*'}`,
      ...(selected.engineId?.trim() ? { engineId: selected.engineId.trim() } : {}),
      ...(selected.resolution?.trim() ? { resolution: selected.resolution.trim() } : {}),
      marginPercent: selected.marginPercent ?? fallback.marginPercent,
      marginFlatCents: selected.marginFlatCents ?? fallback.marginFlatCents,
      surchargeAudioPercent: fallback.surchargeAudioPercent,
      surchargeUpscalePercent: fallback.surchargeUpscalePercent,
      currency: selected.currency?.trim().toUpperCase() || fallback.currency,
      ...(fallback.compatibilityProfile ? { compatibilityProfile: fallback.compatibilityProfile } : {}),
    },
  ];
}

export function quotePublicPricing(input: QuotePublicPricingInput): CanonicalPricingQuote {
  const policyDocument = getVersionedPricingPolicy();
  const policyScenario = {
    engineId: input.scenario.engineId,
    ...(input.scenario.mode ? { mode: input.scenario.mode } : {}),
    ...(input.scenario.resolution ? { resolution: input.scenario.resolution } : {}),
  };
  const versionedPolicy = resolvePricingPolicy({
    scenario: policyScenario,
    databaseRules: [],
    versionedRules: policyDocument.rules,
  });
  const selectedRule = selectPricingRule(
    input.pricingRules,
    input.scenario.engineId,
    input.scenario.resolution
  );
  const policy = resolvePricingPolicy({
    scenario: policyScenario,
    databaseRules: buildEffectiveDatabaseRule(selectedRule, versionedPolicy.rule),
    versionedRules: policyDocument.rules,
  });
  const profileId =
    input.compatibilityProfileId ?? policy.rule.compatibilityProfile ?? 'standard';
  const compatibilityProfile = policyDocument.compatibilityProfiles.find(
    (candidate) => candidate.id === profileId
  );
  if (!compatibilityProfile) {
    throw new Error(`Missing pricing compatibility profile ${profileId}`);
  }
  const membershipTier = normalizeMembershipTier(input.scenario.membershipTier);
  const discountPercent = input.scenario.discountPercent ?? defaultDiscountPercent(membershipTier);

  return quoteCanonicalPricing({
    facts: {
      ...input.facts,
      currency: policy.rule.currency,
    },
    scenario: {
      id: input.scenario.id,
      engineId: input.scenario.engineId,
      ...(input.scenario.mode ? { mode: input.scenario.mode } : {}),
      ...(input.scenario.resolution ? { resolution: input.scenario.resolution } : {}),
      membershipTier,
      discountPercent,
      ...(input.scenario.surcharge ? { surcharge: input.scenario.surcharge } : {}),
    },
    policy,
    compatibilityProfile,
  });
}

export function projectPublicPricingSnapshot(input: {
  quote: CanonicalPricingQuote;
  base: PricingSnapshot['base'];
  addons: PricingSnapshot['addons'];
  meta?: Record<string, unknown>;
}): PricingSnapshot {
  return projectCanonicalQuoteToSnapshot({
    quote: input.quote,
    base: input.base,
    addons: input.addons,
    meta: input.meta,
  });
}

export function scalePublicPricingQuote(
  quote: CanonicalPricingQuote,
  factor: number
): CanonicalPricingQuote {
  return scaleCanonicalPricingQuote(quote, factor);
}
