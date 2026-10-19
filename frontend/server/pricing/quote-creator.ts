import {
  projectCanonicalQuoteToSnapshot,
  quoteCanonicalPricing,
  type PricingFacts,
  type PricingSnapshot,
  type ResolvedPricingPolicy,
} from '@maxvideoai/pricing';
import { getPricingDetails } from '@/lib/fal-catalog';
import { buildBillingPricingFacts } from '@/lib/pricing-billing-facts';
import type { PricingContext } from '@/lib/pricing-context';
import { getVersionedPricingPolicy } from '@/lib/pricing-policy-defaults';
import { CREATOR_TOOL_IDS, type CreatorToolId } from '@/lib/toolbox/catalogue';
import { resolveServerBillingPolicy, type ResolveServerPricingPolicyDependencies } from './resolve-pricing-policy';

export const CREATOR_COMMERCIAL_POLICY_ID = 'creator-tools:provider-plus-120:v1';

/** This product policy replaces model retail policy; it never multiplies a customer quote. */
export function quoteCreatorProviderBillingSnapshot(input: {
  toolId: CreatorToolId;
  facts: PricingFacts;
  base: PricingSnapshot['base'];
  addons?: PricingSnapshot['addons'];
  vendorAccountId?: string | null;
  meta?: Record<string, unknown>;
}): PricingSnapshot {
  if (!CREATOR_TOOL_IDS.includes(input.toolId) || input.facts.currency !== 'USD'
    || !Number.isFinite(input.facts.vendorSubtotalExactCents) || input.facts.vendorSubtotalExactCents <= 0) {
    throw new Error('CREATOR_PRICING_UNAVAILABLE');
  }
  const compatibilityProfile = getVersionedPricingPolicy().compatibilityProfiles.find(profile => profile.id === 'standard');
  if (!compatibilityProfile) throw new Error('Missing standard pricing profile.');
  const policy: ResolvedPricingPolicy = {
    source: 'versioned', matchedBy: 'precise', sourceRuleId: CREATOR_COMMERCIAL_POLICY_ID,
    rule: { id: CREATOR_COMMERCIAL_POLICY_ID, engineId: input.facts.engineId, currency: 'USD',
      marginPercent: 1.2, marginFlatCents: 0, surchargeAudioPercent: 0, surchargeUpscalePercent: 0,
      compatibilityProfile: 'standard' },
  };
  const quote = quoteCanonicalPricing({
    facts: input.facts,
    scenario: { id: `billing:creator:${input.toolId}:${input.facts.engineId}`, engineId: input.facts.engineId,
      membershipTier: 'member', discountPercent: 0 },
    policy, compatibilityProfile,
  });
  return projectCanonicalQuoteToSnapshot({ quote, base: input.base, addons: input.addons ?? [],
    vendorAccountId: input.vendorAccountId ?? null,
    meta: { ...input.meta, surface: 'tool', toolId: input.toolId, creatorPricingPolicy: CREATOR_COMMERCIAL_POLICY_ID,
      providerCostExactCents: input.facts.vendorSubtotalExactCents,
      providerCostMultiplier: 2.2, ruleId: policy.sourceRuleId },
  });
}

const CANONICAL_CREATOR_ENGINES: Partial<Record<CreatorToolId, readonly string[]>> = {
  'product-photo-editor': ['nano-banana-2', 'gpt-image-2-5-flare'],
  'product-video-editor': ['wan-3'],
  'lip-sync': ['wan-3'],
  'motion-transfer': ['wan-3'],
};

/** Called only after the creator profile and owned source facts have been validated. */
export async function computeCanonicalCreatorBillingSnapshot(
  toolId: CreatorToolId,
  context: PricingContext,
  dependencies: { pricingPolicy?: ResolveServerPricingPolicyDependencies } = {},
): Promise<PricingSnapshot> {
  if (!CANONICAL_CREATOR_ENGINES[toolId]?.includes(context.engine.id)) throw new Error('CREATOR_PRICING_UNAVAILABLE');
  const pricingDetails = context.engine.pricingDetails ?? await getPricingDetails(context.engine.id);
  // Keep vendor routing with its existing owner. Generic model prices and manual customer
  // tariff cells do not define this distinct tool product's commercial policy.
  const { vendorAccountId } = await resolveServerBillingPolicy({ engineId: context.engine.id,
    ...(context.mode ? { mode: context.mode } : {}), resolution: context.resolution },
  context.engine.vendorAccountId, dependencies.pricingPolicy);
  const facts = buildBillingPricingFacts(context, pricingDetails, 'USD');
  return quoteCreatorProviderBillingSnapshot({ toolId, facts: facts.facts, base: facts.base,
    addons: facts.addons, vendorAccountId,
    meta: { ...facts.meta, engineLabel: context.engine.label, engineVersion: context.engine.version },
  });
}
