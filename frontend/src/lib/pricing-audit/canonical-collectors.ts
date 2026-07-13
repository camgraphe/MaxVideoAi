import {
  quoteCanonicalAdminScenarios,
  resolveCanonicalAdminScenarioPolicy,
} from '@/server/pricing-admin/canonical-scenarios';

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

export function collectCanonicalPricingOutputs(
  baselineRows: FrozenPricingOutput[]
): CanonicalPricingAuditOutput[] {
  const scenarios = buildPricingAuditScenarios();
  const baselineById = new Map(baselineRows.map((row) => [row.scenarioId, row]));
  const canonicalById = new Map(
    quoteCanonicalAdminScenarios({ databaseRules: [], scenarios }).map((outcome) => [outcome.scenarioId, outcome])
  );

  return scenarios
    .map((scenario): CanonicalPricingAuditOutput => {
      const outcome = canonicalById.get(scenario.id);
      const baseline = baselineById.get(scenario.id);
      if (!outcome || outcome.status === 'unsupported') {
        if (!baseline) throw new Error(`Missing unsupported frozen pricing row ${scenario.id}`);
        const resolved = resolveCanonicalAdminScenarioPolicy({ databaseRules: [], scenario });
        return {
          ...baseline,
          engineId: scenario.engineId,
          policySource: resolved.source,
          policyRuleId: resolved.sourceRuleId,
        };
      }
      const quote = outcome;
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
        policySource: quote.policyProvenance.source,
        policyRuleId: quote.policyProvenance.sourceRuleId,
        ...(displayedAmount ? { displayedAmount } : {}),
        ...(structuredDataAmount ? { structuredDataAmount } : {}),
        ...(scenario.equivalenceKey ? { equivalenceKey: scenario.equivalenceKey } : {}),
        ...(scenario.compatibilityProfile ? { compatibilityProfile: scenario.compatibilityProfile } : {}),
      };
      return row;
    })
    .sort((left, right) => left.scenarioId.localeCompare(right.scenarioId));
}
