import { projectCanonicalQuoteToSnapshot, quoteCanonicalPricing, type PricingSnapshot } from '@maxvideoai/pricing';
import { RECAST_PRICING_SELECTOR, RECAST_PRODUCT_ID, isValidRecastPricingRule } from '@/lib/character-recast-pricing';
import { buildBillingPricingFacts } from '@/lib/pricing-billing-facts';
import type { PricingContext } from '@/lib/pricing-context';
import { getVersionedPricingPolicy } from '@/lib/pricing-policy-defaults';
import { loadPricingPolicyOverrides } from '@/lib/pricing-rule-store';
import { resolveServerBillingPolicy, type ResolveServerPricingPolicyDependencies } from './resolve-pricing-policy';

export function buildRecastPricingFacts(context: PricingContext) {
  if (context.engine.id !== 'wan-3-prime' || !['i2v', 'ref2v', 'v2v'].includes(context.mode ?? '')
    || !['480p', '720p', '1080p'].includes(context.resolution)) throw new Error('RECAST_PRICING_UNAVAILABLE');
  const result = buildBillingPricingFacts(context, context.engine.pricingDetails, 'USD');
  if (!Number.isFinite(result.facts.vendorSubtotalExactCents) || result.facts.vendorSubtotalExactCents <= 0) {
    throw new Error('RECAST_PRICING_UNAVAILABLE');
  }
  return result;
}

/** One owner for public estimates, prepared quotes and transaction-locked charges. */
export async function computeCanonicalRecastBillingSnapshot(
  context: PricingContext,
  dependencies: { pricingPolicy?: ResolveServerPricingPolicyDependencies } = {},
): Promise<PricingSnapshot> {
  const facts = buildRecastPricingFacts(context);
  const loaded = await (dependencies.pricingPolicy?.loadOverrides ?? loadPricingPolicyOverrides)();
  if (loaded.status !== 'loaded') throw new Error('RECAST_PRICING_UNAVAILABLE');
  const policyDependencies = { ...dependencies.pricingPolicy, loadOverrides: async () => loaded };
  const { policy } = await resolveServerBillingPolicy(RECAST_PRICING_SELECTOR, null, policyDependencies);
  if (policy.source !== 'database' || policy.matchedBy !== 'precise' || !isValidRecastPricingRule(policy.rule)) {
    throw new Error('RECAST_PRICING_UNAVAILABLE');
  }
  // Supplier routing still belongs to the underlying model, independently of product markup.
  const { vendorAccountId } = await resolveServerBillingPolicy({ engineId: context.engine.id,
    mode: context.mode, resolution: context.resolution }, context.engine.vendorAccountId, policyDependencies);
  const compatibilityProfile = getVersionedPricingPolicy().compatibilityProfiles.find(profile => profile.id === 'standard');
  if (!compatibilityProfile) throw new Error('RECAST_PRICING_UNAVAILABLE');
  const quote = quoteCanonicalPricing({ facts: facts.facts, policy, compatibilityProfile,
    scenario: { id: `billing:${RECAST_PRODUCT_ID}:${context.engine.id}`, engineId: context.engine.id,
      mode: context.mode, resolution: context.resolution, membershipTier: 'member', discountPercent: 0 } });
  return projectCanonicalQuoteToSnapshot({ quote, base: facts.base, addons: facts.addons, vendorAccountId,
    meta: { ...facts.meta, engineLabel: context.engine.label, engineVersion: context.engine.version,
      customerProduct: RECAST_PRODUCT_ID, providerCostExactCents: facts.facts.vendorSubtotalExactCents,
      providerCostMultiplier: 1 + policy.rule.marginPercent, ruleId: policy.sourceRuleId } });
}
