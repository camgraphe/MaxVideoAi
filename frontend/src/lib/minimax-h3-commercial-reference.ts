import { calculateMinimaxH3ProviderPrice, type MinimaxH3PricingInput, type MinimaxH3RateCard } from './minimax-h3-pricing';
import { calculateMinimaxH3MaxProviderCost, type MinimaxH3MaxPricingInput, type MinimaxH3MaxRateCard } from './minimax-h3-max-pricing';

// These are the commercial references for percentage-based customer quotes. Supplier rate revisions are independent.
const H3_COMMERCIAL_REFERENCE: MinimaxH3RateCard = {
  perSecondUsd: { '480P': 0.05, '768P': 0.06, '2K': 0.13, '4K': 0.16 },
  includedReferenceImages: 5,
  extraReferenceUsd: 0.08,
};
const H3_MAX_COMMERCIAL_REFERENCE: MinimaxH3MaxRateCard = {
  perSecondUsd: { '480P': 0.05, '768P': 0.08, '1080P': 0.16 },
  includedReferenceTokens: 4_096,
  extraReferenceUsdPer1k: 0.02,
};

export function h3QuoteReferences(input: MinimaxH3PricingInput) {
  const reference = calculateMinimaxH3ProviderPrice(input);
  const retail = calculateMinimaxH3ProviderPrice(input, H3_COMMERCIAL_REFERENCE);
  return { reference, legacyRetailBasisExactCents: Math.round(retail.subtotalUsd * 100) };
}

export function h3MaxQuoteReferences(input: MinimaxH3MaxPricingInput) {
  const reference = calculateMinimaxH3MaxProviderCost(input);
  const retail = calculateMinimaxH3MaxProviderCost(input, H3_MAX_COMMERCIAL_REFERENCE);
  return { reference, legacyRetailBasisExactCents: retail.providerCostExactCents };
}
