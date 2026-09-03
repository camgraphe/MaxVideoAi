import assert from 'node:assert/strict';
import test from 'node:test';

import { MINIMAX_H3_MAX_ENGINE } from '../frontend/src/config/fal-engines/minimax-h3-max';
import {
  calculateMinimaxH3MaxProviderCost,
  calculateMinimaxH3MaxProviderCostCents,
} from '../frontend/src/lib/minimax-h3-max-pricing';
import { buildBillingPricingFacts } from '../frontend/src/lib/pricing-billing-facts';
import { buildPublicPricingFacts } from '../frontend/src/lib/pricing-public-facts';

test('MiniMax H3 Max uses durable post-promotion output rates for normal modes', () => {
  assert.equal(calculateMinimaxH3MaxProviderCostCents({
    mode: 't2v', durationSec: 5, resolution: '480P',
  }), 25);
  assert.equal(calculateMinimaxH3MaxProviderCostCents({
    mode: 'i2v', durationSec: 15, resolution: '768P',
  }), 120);
});

test('MiniMax H3 Max reference pricing includes 4096 pooled tokens before charging excess tokens', () => {
  assert.equal(calculateMinimaxH3MaxProviderCostCents({
    mode: 'ref2v', durationSec: 5, resolution: '480P', verifiedReferenceTokenCount: 4_096,
  }), 40);

  const fractional = calculateMinimaxH3MaxProviderCost({
    mode: 'ref2v',
    durationSec: 5,
    resolution: '768P',
    verifiedReferenceTokenCount: 4_597,
  });
  assert.deepEqual(fractional, {
    mode: 'ref2v',
    durationSec: 5,
    resolution: '768P',
    ratePerSecondUsd: 0.08,
    outputSubtotalUsd: 0.4,
    verifiedReferenceTokenCount: 4_597,
    includedReferenceTokenCount: 4_096,
    excessReferenceTokenCount: 501,
    referenceTokenSubtotalUsd: 0.01002,
    providerCostUsd: 0.41002,
    providerCostExactCents: 41.002,
    providerCostCents: 41,
  });
});

test('MiniMax H3 Max rejects fractional trusted reference-token counts', () => {
  assert.throws(() => calculateMinimaxH3MaxProviderCost({
    mode: 'ref2v',
    durationSec: 5,
    resolution: '768P',
    verifiedReferenceTokenCount: 4_096.5,
  }), /trusted reference token count/i);
});

test('MiniMax H3 Max billing and public facts preserve the same fractional reference cost', () => {
  const context = {
    engine: MINIMAX_H3_MAX_ENGINE,
    durationSec: 5,
    resolution: '768P',
    mode: 'ref2v' as const,
    verifiedReferenceTokenCount: 4_597,
  };
  const billing = buildBillingPricingFacts(context, MINIMAX_H3_MAX_ENGINE.pricingDetails, 'USD');
  const publicFacts = buildPublicPricingFacts(context);

  assert.equal(billing.facts.vendorSubtotalExactCents, 41.002);
  assert.equal(publicFacts.facts.vendorSubtotalExactCents, 41.002);
  assert.deepEqual(billing.meta.cost_breakdown_usd, publicFacts.meta.cost_breakdown_usd);
  assert.equal(billing.meta.public_provider, 'MiniMax');
  assert.equal(publicFacts.meta.public_family, 'Hailuo');
});
