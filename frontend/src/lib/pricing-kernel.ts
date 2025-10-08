import { createPricingKernel, buildPricingDefinitionsFromFixtures } from '@maxvideoai/pricing';

const PRICING_DEFINITIONS = buildPricingDefinitionsFromFixtures();
const PRICING_KERNEL = createPricingKernel(PRICING_DEFINITIONS);

export function getPricingKernel() {
  return PRICING_KERNEL;
}

export function listPricingDefinitions() {
  return PRICING_DEFINITIONS;
}
