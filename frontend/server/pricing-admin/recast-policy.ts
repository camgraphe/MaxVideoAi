import type { PricingPolicyRule } from '@maxvideoai/pricing';
import { RECAST_PRICING_SELECTOR, isValidRecastPricingRule } from '@/lib/character-recast-pricing';
import type { AdminCanonicalScenarioOutcome, PricingChangePreviewRow } from './canonical-scenarios';
import { PricingAdminError } from './errors';

export function isRecastPolicySelector(rule: Pick<PricingPolicyRule, 'engineId' | 'mode' | 'resolution'>): boolean {
  return rule.engineId === RECAST_PRICING_SELECTOR.engineId && rule.mode === RECAST_PRICING_SELECTOR.mode
    && rule.resolution === RECAST_PRICING_SELECTOR.resolution;
}

export function validateRecastPolicyRule(rule: Record<string, unknown>): void {
  if (rule.engineId !== RECAST_PRICING_SELECTOR.engineId) return;
  const allowed = new Set(['id', 'engineId', 'mode', 'resolution', 'marginPercent', 'marginFlatCents',
    'surchargeAudioPercent', 'surchargeUpscalePercent', 'currency', 'compatibilityProfile']);
  if (Object.keys(rule).some(key => !allowed.has(key)) || !isValidRecastPricingRule(rule as PricingPolicyRule)) {
    throw new PricingAdminError('invalid_payload', 'Recast requires its exact scope, USD, standard billing, a supplier cost coefficient from ×1 to ×10, and zero extras.');
  }
}

export function assertRecastPolicyRetained(current: PricingPolicyRule | null, proposed: PricingPolicyRule | null): void {
  if (current?.engineId === RECAST_PRICING_SELECTOR.engineId && (!proposed || !isRecastPolicySelector(proposed))) {
    throw new PricingAdminError('invalid_payload', 'Recast pricing is required; remove neither its active rule nor its exact scope. Restore a previous coefficient instead.');
  }
}

/** First configuration has no customer baseline. Never present a global fallback or zero as its current price. */
export function compareInitialRecastScenarios(current: AdminCanonicalScenarioOutcome[], proposed: AdminCanonicalScenarioOutcome[]): PricingChangePreviewRow[] {
  const currentById = new Map(current.map(outcome => [outcome.scenarioId, outcome]));
  return proposed.map(outcome => {
    const previous = currentById.get(outcome.scenarioId);
    if (!previous || previous.status !== 'unsupported' || previous.reason !== 'product_policy_not_authoritative'
      || outcome.status !== 'quoted' || outcome.engineId !== RECAST_PRICING_SELECTOR.engineId) {
      throw new PricingAdminError('unsupported_scenario', 'Recast requires qualified supplier facts and an exact scoped pricing rule.');
    }
    return { scenarioId: outcome.scenarioId, scenarioLabel: outcome.scenarioLabel, engineId: outcome.engineId,
      surface: outcome.surface, currentTotalCents: null, proposedTotalCents: outcome.customerTotalCents,
      deltaCents: null, deltaPercent: null, currentProvenance: null, proposedProvenance: outcome.policyProvenance,
      compatibilityProfile: outcome.policyProvenance.compatibilityProfile };
  });
}
