import {
  quoteCanonicalPricing,
  resolvePricingPolicy,
  type PricingCompatibilityProfile,
} from '@maxvideoai/pricing';
import { getVersionedPricingPolicy } from '@/lib/pricing-policy-defaults';

import { buildCanonicalPricingFacts } from './canonical-facts';
import { collectLegacyPricingOutputs } from './legacy-collectors';
import { buildPricingAuditScenarios } from './scenarios';
import type { FrozenPricingOutput } from './types';

export type CanonicalPricingAuditOutput = FrozenPricingOutput & {
  engineId: string;
  policySource: 'database' | 'versioned';
  policyRuleId: string;
};

function formatUsd(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export async function collectCanonicalPricingOutputs(): Promise<CanonicalPricingAuditOutput[]> {
  const policyDocument = getVersionedPricingPolicy();
  const profiles = new Map(policyDocument.compatibilityProfiles.map((profile) => [profile.id, profile]));
  const standardProfile = profiles.get('standard');
  if (!standardProfile) throw new Error('Missing standard pricing compatibility profile');
  const currentById = new Map((await collectLegacyPricingOutputs()).map((row) => [row.scenarioId, row]));

  return buildPricingAuditScenarios()
    .map((scenario): CanonicalPricingAuditOutput => {
      const resolved = resolvePricingPolicy({
        scenario: { engineId: scenario.engineId, mode: scenario.mode, resolution: scenario.resolution },
        databaseRules: [],
        versionedRules: policyDocument.rules,
      });
      const profileId = scenario.compatibilityProfile ?? resolved.rule.compatibilityProfile ?? 'standard';
      const compatibilityProfile: PricingCompatibilityProfile | undefined = profiles.get(profileId);
      if (!compatibilityProfile) throw new Error(`Missing pricing compatibility profile ${profileId}`);
      const facts = buildCanonicalPricingFacts(scenario);
      const current = currentById.get(scenario.id);
      if (!facts) {
        if (!current) throw new Error(`Missing unsupported legacy pricing row ${scenario.id}`);
        return {
          ...current,
          engineId: scenario.engineId,
          policySource: resolved.source,
          policyRuleId: resolved.sourceRuleId,
        };
      }
      const discountPercent = scenario.membershipTier === 'plus' ? 0.05 : scenario.membershipTier === 'pro' ? 0.1 : 0;
      const quote = quoteCanonicalPricing({
        facts,
        scenario: {
          id: scenario.id,
          engineId: scenario.engineId,
          mode: scenario.mode,
          resolution: scenario.resolution,
          membershipTier: scenario.membershipTier ?? 'member',
          discountPercent,
        },
        policy: resolved,
        compatibilityProfile,
      });
      const displayedAmount =
        scenario.surface === 'pricing-hub' ||
        scenario.surface === 'model-page' ||
        scenario.surface === 'estimator' ||
        scenario.surface === 'price-chip'
          ? formatUsd(quote.customerTotalCents)
          : undefined;
      const structuredDataAmount = scenario.surface === 'json-ld' ? (quote.customerTotalCents / 100).toFixed(2) : undefined;
      const row: CanonicalPricingAuditOutput = {
        scenarioId: scenario.id,
        surface: scenario.surface,
        engineId: scenario.engineId,
        currency: quote.currency,
        vendorSubtotalCents: quote.vendorSubtotalCents,
        marginCents: quote.marginCents,
        surchargeCents: quote.surchargeCents,
        customerTotalCents: quote.customerTotalCents,
        unit: quote.unit,
        quantity: quote.quantity,
        policySource: resolved.source,
        policyRuleId: resolved.sourceRuleId,
        ...(displayedAmount ? { displayedAmount } : {}),
        ...(structuredDataAmount ? { structuredDataAmount } : {}),
        ...(scenario.equivalenceKey ? { equivalenceKey: scenario.equivalenceKey } : {}),
        ...(scenario.compatibilityProfile ? { compatibilityProfile: scenario.compatibilityProfile } : {}),
      };
      return row;
    })
    .sort((left, right) => left.scenarioId.localeCompare(right.scenarioId));
}
