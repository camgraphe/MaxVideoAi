import { createHash } from 'node:crypto';
import { quoteCanonicalPricing } from '@maxvideoai/pricing';
import { getFalEngineById } from '@/config/falEngines';
import { buildBillingPricingFacts } from '@/lib/pricing-billing-facts';
import { buildManualTariffScenario } from '@/lib/pricing-manual-scenario';
import { getVersionedPricingPolicy } from '@/lib/pricing-policy-defaults';
import type { PricingPolicyOverrideLoadResult } from '@/lib/pricing-rule-store';
import { resolveServerBillingPolicy } from './resolve-pricing-policy';
import type { EffectiveCustomerTariffState } from './customer-tariff-store';

/** Maintenance preparation only. No writer and no live quotation fallback. */
export async function prepareLumaExtendTariffProposal(input: {
  state: EffectiveCustomerTariffState; policy: PricingPolicyOverrideLoadResult;
}) {
  if (input.state.status !== 'loaded' || !input.state.active || input.policy.status !== 'loaded') {
    throw new Error('Current active tariffs and loaded effective pricing policy are required.');
  }
  const engine = getFalEngineById('luma-ray-3-2')!.engine;
  const compatibilityProfile = getVersionedPricingPolicy().compatibilityProfiles.find(profile => profile.id === 'standard');
  if (!compatibilityProfile) throw new Error('Standard canonical pricing profile is required.');
  const proposals = [];
  for (const resolution of ['540p', '720p', '1080p']) {
    const context = { engine, mode: 'extend' as const, operation: 'luma-extend' as const, durationSec: 5, resolution };
    const facts = buildBillingPricingFacts(context, engine.pricingDetails, 'USD');
    const selector = buildManualTariffScenario(context, facts.facts).selector;
    const stable = (value: object) => JSON.stringify(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
    if ([...input.state.databaseCells, ...input.state.versionedCells].some(cell => stable(cell.selector) === stable(selector))) {
      throw new Error('An existing Extend selector requires review in tariff maintenance.');
    }
    const { policy } = await resolveServerBillingPolicy({ engineId: engine.id, mode: 'extend', resolution }, undefined,
      { loadOverrides: async () => input.policy });
    const quote = quoteCanonicalPricing({ facts: facts.facts, policy, compatibilityProfile,
      scenario: { id: `luma-extend:${resolution}`, engineId: engine.id, mode: 'extend', resolution, membershipTier: 'member', discountPercent: 0 } });
    proposals.push({ selector, currency: 'USD', price: { kind: 'fixed' as const, customerCents: quote.customerTotalCents },
      supplierReferenceCents: facts.facts.vendorSubtotalExactCents, quantity: 'one_five_second_extension',
      outputAssembly: 'unverified', activationReady: false as const });
  }
  return { sourceRevision: input.state.revision, proposals, writes: false as const, activationReady: false as const,
    fingerprint: createHash('sha256').update(JSON.stringify({ state: input.state, policy: input.policy, proposals })).digest('hex') };
}
