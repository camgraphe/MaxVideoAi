import assert from 'node:assert/strict';
import test from 'node:test';
import { computeCanonicalBillingSnapshot } from '../frontend/server/pricing/quote-billing';
import { computeCanonicalPublicSnapshot } from '../frontend/server/pricing/quote-public';
import { MINIMAX_H3_ENGINE } from '../frontend/src/config/fal-engines/minimax-h3';
import { MINIMAX_H3_MAX_ENGINE } from '../frontend/src/config/fal-engines/minimax-h3-max';
import { MINIMAX_H3_FAL_RATES } from '../frontend/src/lib/minimax-h3-pricing';
import { MINIMAX_H3_MAX_FAL_RATES } from '../frontend/src/lib/minimax-h3-max-pricing';
import { buildBillingPricingFacts } from '../frontend/src/lib/pricing-billing-facts';
import { buildManualTariffScenario } from '../frontend/src/lib/pricing-manual-scenario';
import { buildPublicPricingFacts } from '../frontend/src/lib/pricing-public-facts';
import { quotePublicPricing } from '../frontend/src/lib/pricing-public-quote';

const profiles = [
  { engine: MINIMAX_H3_ENGINE, durationSec: 10, resolution: '480P', mode: 'ref2v' as const, referenceImageCount: 6 },
  { engine: MINIMAX_H3_MAX_ENGINE, durationSec: 10, resolution: '480P', mode: 'ref2v' as const, verifiedReferenceTokenCount: 6_096 },
];
const listCosts = [58, 54];

for (const [index, context] of profiles.entries()) {
  test(context.engine.id + ' supplier output and reference pricing vary independently of the next customer quote', async t => {
    const card = index === 0 ? MINIMAX_H3_FAL_RATES : MINIMAX_H3_MAX_FAL_RATES;
    const saved = { ...card };
    t.after(() => { Object.assign(card, saved); });
    const retailSelector = buildManualTariffScenario(context,
      buildBillingPricingFacts(context, context.engine.pricingDetails, 'USD').facts).selector;
    function dependencies(active: boolean) {
      return {
        pricingPolicy: { loadOverrides: async () => ({ status: 'loaded' as const, rules: [] }) },
        loadCustomerTariffState: async () => ({ status: 'loaded' as const, active, revision: 3, databaseCells: [], versionedCells: [
          { id: 'approved', source: 'versioned' as const, version: 1, selector: retailSelector,
            effectiveFrom: '2026-01-01T00:00:00Z', currency: 'USD', price: { kind: 'fixed' as const, customerCents: 200 } },
        ] }),
      };
    }
    function staticPublicQuote() {
      const { facts, compatibilityProfileId } = buildPublicPricingFacts(context);
      return quotePublicPricing({ facts, compatibilityProfileId, scenario: { id: 'public-example', engineId: context.engine.id } });
    }
    const original = await computeCanonicalBillingSnapshot(context, dependencies(false));
    assert.equal(original.vendorShareCents, listCosts[index]);
    const originalPublic = staticPublicQuote().customerTotalCents;

    Object.assign(card, {
      perSecondUsd: { ...card.perSecondUsd, '480P': 0.03 },
      ...(index === 0 ? { extraReferenceUsd: 0.02 } : { extraReferenceUsdPer1k: 0.01 }),
    });
    const cheaper = await computeCanonicalBillingSnapshot(context, dependencies(false));
    const publicSnapshot = await computeCanonicalPublicSnapshot(context, dependencies(false));
    const publicExample = staticPublicQuote();
    assert.equal(cheaper.totalCents, original.totalCents);
    assert.equal(cheaper.vendorShareCents, 32);
    assert.equal(cheaper.platformFeeCents, cheaper.totalCents - 32);
    assert.equal(publicSnapshot.totalCents, original.totalCents);
    assert.equal(publicExample.customerTotalCents, originalPublic);
    assert.equal(publicExample.vendorSubtotalCents, 32);
    const fixed = await computeCanonicalBillingSnapshot(context, dependencies(true));
    assert.equal(fixed.totalCents, 200);
    assert.equal(fixed.vendorShareCents, 32);

    Object.assign(card, { perSecondUsd: { ...card.perSecondUsd, '480P': 0.06 } });
    const higher = await computeCanonicalBillingSnapshot(context, dependencies(false));
    assert.equal(higher.totalCents, original.totalCents);
    assert.equal(higher.vendorShareCents, 62);

    Object.assign(card, { perSecondUsd: { ...card.perSecondUsd, '480P': 0.25 } });
    await assert.rejects(computeCanonicalBillingSnapshot(context, dependencies(false)), /no longer covers the supplier cost/);
    assert.throws(staticPublicQuote, /no longer covers the supplier cost/);
    await assert.rejects(computeCanonicalBillingSnapshot(context, dependencies(true)), /below-cost/);
  });
}
