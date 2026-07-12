import { resolvePricingPolicy, type PricingPolicyScenario, type ResolvedPricingPolicy } from '@maxvideoai/pricing';
import { getVersionedPricingPolicy } from '@/lib/pricing-policy-defaults';
import {
  loadPricingPolicyOverrides,
  type PricingPolicyOverrideLoadResult,
} from '@/lib/pricing-rule-store';

export type PricingPolicyFallbackEvent = {
  event: 'pricing_policy_db_fallback';
  errorCode: 'pricing_rules_query_failed';
  engineId: string;
  mode?: string;
  resolution?: string;
};

type ResolveServerPricingPolicyDependencies = {
  loadOverrides?: () => Promise<PricingPolicyOverrideLoadResult>;
  warn?: (event: PricingPolicyFallbackEvent) => void;
};

function defaultWarningSink(event: PricingPolicyFallbackEvent): void {
  console.warn('[pricing-policy]', JSON.stringify(event));
}

export async function resolveServerPricingPolicy(
  scenario: PricingPolicyScenario,
  dependencies: ResolveServerPricingPolicyDependencies = {}
): Promise<ResolvedPricingPolicy> {
  const policy = getVersionedPricingPolicy();
  const loadOverrides = dependencies.loadOverrides ?? loadPricingPolicyOverrides;
  const result = await loadOverrides();
  if (result.status === 'unavailable') {
    (dependencies.warn ?? defaultWarningSink)({
      event: 'pricing_policy_db_fallback',
      errorCode: result.errorCode,
      engineId: scenario.engineId,
      ...(scenario.mode ? { mode: scenario.mode } : {}),
      ...(scenario.resolution ? { resolution: scenario.resolution } : {}),
    });
  }
  return resolvePricingPolicy({
    scenario,
    databaseRules: result.rules,
    versionedRules: policy.rules,
  });
}
