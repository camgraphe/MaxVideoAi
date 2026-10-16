import { projectCanonicalQuoteToSnapshot, quoteCanonicalPricing } from '@maxvideoai/pricing';
import type { PricingContext } from '@/lib/pricing-context';
import type { PricingPolicyOverrideLoadResult } from '@/lib/pricing-rule-store';
import { buildBillingPricingFacts } from '@/lib/pricing-billing-facts';
import { getVersionedPricingPolicy } from '@/lib/pricing-policy-defaults';
import { isSeedance25LasInputPricing } from '@/server/byteplus-las-tariff';
import { computeCanonicalBillingSnapshot } from './quote-billing';
import { resolveServerBillingPolicy } from './resolve-pricing-policy';

/** Initial maintenance capture of the archived token-era customer basis only.
 * This private reconstruction cannot authorize a current LAS quote or charge. */
export async function computeCustomerTariffInitializationBaseline(context: PricingContext, policyInput: PricingPolicyOverrideLoadResult) {
  if (!isSeedance25LasInputPricing(context.engine.id, context.mode)) {
    return computeCanonicalBillingSnapshot(context, { pricingPolicy: { loadOverrides: async () => policyInput },
      loadCustomerTariffState: async () => ({ status: 'loaded', active: false, revision: 0, databaseCells: [], versionedCells: [] }) });
  }
  const billing = buildBillingPricingFacts(context, context.engine.pricingDetails, 'USD');
  const { policy, vendorAccountId } = await resolveServerBillingPolicy({ engineId: context.engine.id,
    mode: context.mode, resolution: context.resolution }, context.engine.vendorAccountId, { loadOverrides: async () => policyInput });
  const compatibilityProfile = getVersionedPricingPolicy().compatibilityProfiles.find(profile =>
    profile.id === (policy.rule.compatibilityProfile ?? billing.compatibilityProfileId));
  if (!compatibilityProfile) throw new Error('Historical initialization rounding is unavailable.');
  const quote = quoteCanonicalPricing({ facts: billing.facts, policy, compatibilityProfile,
    scenario: { id: `historical-initialization:${context.engine.id}:${context.resolution}`, engineId: context.engine.id,
      mode: context.mode, resolution: context.resolution, membershipTier: 'member', discountPercent: 0 } });
  return projectCanonicalQuoteToSnapshot({ quote, base: billing.base, addons: billing.addons, vendorAccountId,
    meta: { ...billing.meta, historicalReconstruction: true, quoteRequired: true } });
}
