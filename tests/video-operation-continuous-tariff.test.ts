import assert from 'node:assert/strict';
import test from 'node:test';
import { quoteCanonicalManualTariff } from '@maxvideoai/pricing';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { buildManualTariffScenario } from '../frontend/src/lib/pricing-manual-scenario';
import { buildBillingPricingFacts } from '../frontend/src/lib/pricing-billing-facts';
import { resolveCustomerTariffQuote } from '../frontend/server/pricing/resolve-customer-tariff';
import { usesOperationReferenceSettlement } from '../frontend/lib/video-operation';
import { evaluateManualTariffPrice } from '@maxvideoai/pricing/src/manual-tariff-price';
import { videoOperationTariffContexts } from '../frontend/lib/pricing-audit/video-operation-tariff-inventory';
import { buildManualTariffCoverageScenario } from '../frontend/lib/pricing-audit/manual-tariff-coverage';
import { compileCurrentContinuousTariffPrice } from '../frontend/server/pricing/compile-current-continuous-tariff';
import { computeCustomerTariffInitializationBaseline } from '../frontend/server/pricing/customer-tariff-initialization-baseline';
import { computeCanonicalBillingSnapshot } from '../frontend/server/pricing/quote-billing';
import { adjacentNonnegativeDouble } from '../frontend/server/pricing/pricing-number-boundaries';
import { continuousInputTariffSelector } from '../frontend/src/lib/pricing-manual-scenario';
import { operationContinuousTariffBounds } from '../frontend/server/pricing/video-operation-continuous-tariff';

const policy = { status: 'loaded' as const, rules: [{ id: 'default', marginPercent: .3, marginFlatCents: 0,
  surchargeAudioPercent: 0, surchargeUpscalePercent: 0, currency: 'USD' }] };
const empty = { status: 'loaded' as const, active: true, revision: 1798, databaseCells: [], versionedCells: [] };

test('thirteen source classes freeze every canonical cent transition and adjacent double', async () => {
  let classes = 0;
  for (const context of videoOperationTariffContexts()) {
    const scenario = buildManualTariffCoverageScenario(context, 'test');
    const selector = continuousInputTariffSelector(scenario.selector);
    if (!selector) continue;
    classes++;
    const price = await compileCurrentContinuousTariffPrice(scenario, policy);
    assert.equal(price.kind, 'unit_bands');
    if (price.kind !== 'unit_bands') throw new Error('Expected frozen bands');
    assert.deepEqual(price.terms, [{ unit: 'input_video_seconds', centsPerUnit: 1 }]);
    const cell = { id: `operation-${classes}`, selector, price, currency: 'USD', source: 'database' as const,
      version: 1, effectiveFrom: '2026-01-01T00:00:00Z' };
    const bounds = operationContinuousTariffBounds(context);
    const seconds = new Set([bounds.minimum, bounds.maximum, 5, 5.558333, 10.041667, 20 + 1 / 24, 20.04, 241 / 24]);
    for (const band of price.bands) for (const value of [adjacentNonnegativeDouble(band.minUnits, 'previous'),
      band.minUnits, adjacentNonnegativeDouble(band.minUnits, 'next')]) seconds.add(value);
    for (const durationSec of seconds) {
      if (durationSec < bounds.minimum || durationSec > bounds.maximum) continue;
      const ctx = { ...context, durationSec, inputVideoDurationSec: durationSec };
      const authored = await computeCustomerTariffInitializationBaseline(ctx, policy);
      const facts = buildBillingPricingFacts(ctx, ctx.engine.pricingDetails, 'USD').facts;
      const resolved = resolveCustomerTariffQuote({ context: ctx, facts, at: '2026-10-24T00:00:00Z',
        state: { ...empty, databaseCells: [cell] } })!.quote;
      assert.equal(resolved.customerTotalCents, authored.totalCents);
      assert.equal(resolved.vendorSubtotalCents, Math.round(facts.vendorSubtotalExactCents));
      assert.equal(resolved.breakdown.vendorSubtotalExactCents, facts.vendorSubtotalExactCents);
      assert.equal(evaluateManualTariffPrice(price, { input_video_seconds: durationSec }).customerTotalCents,
        authored.totalCents, `${context.operation}:${context.resolution}:${durationSec}`);
    }
    for (const active of [false, true]) await assert.rejects(computeCanonicalBillingSnapshot(context,
      { pricingPolicy: { loadOverrides: async () => policy }, loadCustomerTariffState: async () => ({ ...empty, active }) }));
    const quote = await computeCanonicalBillingSnapshot(context, { pricingPolicy: { loadOverrides: async () => policy },
      loadCustomerTariffState: async () => ({ ...empty, databaseCells: [cell] }) });
    assert.equal(quote.meta?.customerTariffCellId, cell.id);
    assert.equal(quote.totalCents, (await computeCustomerTariffInitializationBaseline(context, policy)).totalCents);
  }
  assert.equal(classes, 13);
});


test('reference normalization is explicit, operation scoped and keeps historical manual defaults', () => {
  assert.equal(usesOperationReferenceSettlement('ltx-2-3','reframe'),true);
  assert.equal(usesOperationReferenceSettlement('kling-o3-standard','v2v','kling-reference'),false);
  assert.throws(() => usesOperationReferenceSettlement('kling-o3-standard','v2v','flux-fast-edit'));
  const context = videoOperationTariffContexts().find(c => c.operation === 'flux-fast-edit')!;
  const facts = buildBillingPricingFacts({ ...context, durationSec: 1.1111111111111113e-9,
    inputVideoDurationSec: 1.1111111111111113e-9 },context.engine.pricingDetails,'USD').facts;
  const selector = {engineId: facts.engineId};
  const input = {facts,scenarioId:'rounding-default',selector,quantities:{},at:'2026-10-24T00:00:00Z',versionedCells:[],
    databaseCells:[{id:'historical',selector,source:'database' as const,version:1,currency:'USD',effectiveFrom:'2026-01-01',
      price:{kind:'fixed' as const,customerCents:1}}]};
  assert.equal(quoteCanonicalManualTariff(input).vendorSubtotalCents,1);
  assert.equal(quoteCanonicalManualTariff({...input, referenceSubtotalRounding:'nearest'}).vendorSubtotalCents,0);
  const historicalContext = { ...context, engine: getFalEngineById('kling-o3-standard')!.engine,
    operation: 'kling-reference' as const, durationSec: 5, inputVideoDurationSec: 5 };
  const historicalFacts = { ...buildBillingPricingFacts(historicalContext,historicalContext.engine.pricingDetails,'USD').facts,
    vendorSubtotalExactCents:10.01,metadata:{ supplierReferenceSettlementRounding:'nearest',videoOperation:{operation:'flux-fast-edit'} } };
  const historicalSelector = buildManualTariffScenario(historicalContext,historicalFacts).selector;
  const resolvedHistorical = resolveCustomerTariffQuote({context:historicalContext,facts:historicalFacts,at:input.at,
    state:{...empty,databaseCells:[{...input.databaseCells[0],selector:historicalSelector,price:{kind:'fixed',customerCents:20}}]}})!;
  assert.equal(resolvedHistorical.quote.vendorSubtotalCents,11,'untrusted factual metadata cannot change historical settlement');
  const zero = {...input,databaseCells:[{...input.databaseCells[0],price:{kind:'fixed' as const,customerCents:0}}]};
  assert.throws(() => quoteCanonicalManualTariff(zero), /below/i);
  assert.equal(quoteCanonicalManualTariff({...zero,referenceSubtotalRounding:'nearest'}).customerTotalCents,0);
});
