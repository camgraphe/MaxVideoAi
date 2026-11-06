import type { PricingSnapshot } from '@maxvideoai/pricing';
import type { TransactionQueryExecutor } from '@/lib/db';
import { isTransactionQueryExecutor } from '@/lib/db';
import { loadPricingPolicyOverridesWithExecutor } from '@/lib/pricing-rule-store';
import { isValidRecastPricingRule, RECAST_PRICING_SELECTOR, RECAST_PRODUCT_ID } from '@/lib/character-recast-pricing';
import { resolveServerBillingPolicy } from './resolve-pricing-policy';
import { CustomerTariffRevisionError } from './customer-tariff-revision';

/** Only a trusted Recast reservation opts in. The quote was fully repriced in this same transaction. */
export async function lockQuotedRecastPolicy(executor: TransactionQueryExecutor, engineId: string, value: unknown) {
  if (!isTransactionQueryExecutor(executor)) throw new Error('Recast pricing requires an active charge transaction.');
  const snapshot = value as PricingSnapshot | null;
  const loaded = await loadPricingPolicyOverridesWithExecutor(executor, { lock: true });
  if (loaded.status !== 'loaded') throw new CustomerTariffRevisionError();
  const { policy } = await resolveServerBillingPolicy(RECAST_PRICING_SELECTOR, null, { loadOverrides: async () => loaded });
  const provenance = snapshot?.meta?.pricingPolicy as Record<string, unknown> | undefined;
  if (engineId !== 'wan-3-prime' || policy.source !== 'database' || policy.matchedBy !== 'precise'
    || !isValidRecastPricingRule(policy.rule) || snapshot?.currency !== 'USD'
    || snapshot.meta?.customerProduct !== RECAST_PRODUCT_ID
    || snapshot.meta.providerCostMultiplier !== 1 + policy.rule.marginPercent
    || snapshot.margin?.percentApplied !== policy.rule.marginPercent || snapshot.margin.flatCents !== 0
    || provenance?.source !== 'database' || provenance.matchedBy !== 'precise'
    || provenance.sourceRuleId !== policy.sourceRuleId || provenance.compatibilityProfile !== 'standard') {
    throw new CustomerTariffRevisionError();
  }
}
