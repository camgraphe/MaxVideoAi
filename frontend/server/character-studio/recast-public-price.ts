import { quotePublicModelScenario, resolvePublicModelScenario } from '@/server/pricing/quote-public-model-scenario';
import type { PublicModelQuoteInput, PublicModelQuote } from '@/lib/pricing-public-model-contract';
import { buildRecastPricingFacts, computeCanonicalRecastBillingSnapshot } from '@/server/pricing/quote-recast';
import type { ResolveServerPricingPolicyDependencies } from '@/server/pricing/resolve-pricing-policy';

export function resolveRecastPricingContext(input: PublicModelQuoteInput) {
  if (input.modelId !== 'wan-3-prime' || !['i2v', 'ref2v', 'v2v'].includes(input.mode)) return null;
  return resolvePublicModelScenario(input)?.context ?? null;
}

export function buildRecastPublicPricingFacts(input: PublicModelQuoteInput) {
  const context = resolveRecastPricingContext(input);
  return context ? buildRecastPricingFacts(context) : null;
}

/** Price facts only. Never send the account, prompt, media IDs, names or URLs to the public rate reader. */
export async function readRecastPublicPrice(input: PublicModelQuoteInput,
  dependencies: { pricingPolicy?: ResolveServerPricingPolicyDependencies } = {}): Promise<PublicModelQuote> {
  if (!resolveRecastPricingContext(input)) return { status: 'unavailable' };
  return quotePublicModelScenario(input, scenario => computeCanonicalRecastBillingSnapshot(scenario.context, dependencies));
}
