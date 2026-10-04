import assert from 'node:assert/strict';
import test from 'node:test';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { buildBillingPricingFacts } from '../frontend/src/lib/pricing-billing-facts';
import { buildManualTariffScenario, continuousInputTariffSelector } from '../frontend/src/lib/pricing-manual-scenario';
import { resolvePricingPolicy } from '@maxvideoai/pricing';
import { getVersionedPricingPolicy } from '../frontend/src/lib/pricing-policy-defaults';
import { compileOmniContinuousTariffPrice } from '../frontend/server/pricing/omni-continuous-tariff';
import { evaluateManualTariffPrice } from '../packages/pricing/src/manual-tariff-price';
import { adjacentNonnegativeDouble } from '../frontend/server/pricing/pricing-number-boundaries';
import { quoteCanonicalPricing } from '@maxvideoai/pricing';
import { computeCanonicalBillingSnapshot } from '../frontend/server/pricing/quote-billing';
import { buildManualTariffCoverageScenario } from '../frontend/lib/pricing-audit/manual-tariff-coverage';
import { prepareContinuousInputTariffChange } from '../frontend/server/pricing-admin/continuous-input-tariff';
import { collectSellableManualTariffCoverage } from '../frontend/lib/pricing-audit/manual-tariff-coverage';
import { chooseCustomerTariffScenario } from '../frontend/server/pricing-admin/customer-tariff-service';
import { resolvePublicModelScenario } from '../frontend/server/pricing/quote-public-model-scenario';

test('Omni media quantities retain literal output/input tokens and share one continuous class for inherited output timing', () => {
  const engine = getFalEngineById('gemini-omni-flash')!.engine;
  const project = (seconds: number) => {
    const context = { engine, mode: 'v2v' as const, resolution: '720p', durationSec: 10,
      inheritedDurationSec: seconds, inputVideoDurationSec: seconds };
    return buildManualTariffScenario(context, buildBillingPricingFacts(context, engine.pricingDetails, 'USD').facts);
  };
  const selected = project(3.25);
  assert.equal(selected.quantities.output_tokens, 5792 * 3.25);
  assert.equal(selected.quantities.input_tokens, 5792 * 3.25);
  assert.ok(continuousInputTariffSelector(selected.selector));
  assert.deepEqual(continuousInputTariffSelector(selected.selector), continuousInputTariffSelector(project(4.75).selector));
});

test('Omni decimal source/inherited output quotes are reachable from the compact admin and public quote', () => {
  const rows = collectSellableManualTariffCoverage().scenarios.filter(row => row.modelId === 'gemini-omni-flash');
  for (const mode of ['v2v', 'extend', 'retake'] as const) {
    const requested = { mode, resolution: '720p', durationSec: '5', inputVideoDurationSec: mode === 'retake' ? '0' : '3.25',
      inheritedDurationSec: mode === 'v2v' ? '3.25' : '4.75' };
    const admin = chooseCustomerTariffScenario(rows, requested);
    assert.equal(admin.scenario.context.inputVideoDurationSec, Number(requested.inputVideoDurationSec));
    assert.equal(admin.scenario.selector.durationSec, mode === 'extend' ? '5' : mode === 'v2v' ? '3.25' : '4.75');
    const quote = resolvePublicModelScenario({ modelId: 'gemini-omni-flash', mode, resolution: '720p', durationSec: 5,
      inputVideoDurationSec: Number(requested.inputVideoDurationSec), ...(mode === 'extend' ? {} : { inheritedDurationSec: Number(requested.inheritedDurationSec) }) });
    assert.ok(quote, mode);
    assert.deepEqual(quote.selector, admin.scenario.selector);
    if (mode !== 'extend') assert.ok(!admin.choices.some(choice => choice.key === 'durationSec'));
    if (mode === 'v2v') assert.ok(!admin.choices.some(choice => choice.key === 'inheritedDurationSec'));
    if (mode === 'retake') assert.ok(!admin.choices.some(choice => choice.key === 'inputVideoDurationSec'));
  }
  assert.equal(resolvePublicModelScenario({ modelId: 'gemini-omni-flash', mode: 'v2v', resolution: '720p', durationSec: 5,
    inputVideoDurationSec: 3.25, inheritedDurationSec: 4.75 }), null, 'owned source is also the inherited output timing');
  assert.equal(resolvePublicModelScenario({ modelId: 'gemini-omni-flash', mode: 'retake', resolution: '720p', durationSec: 5,
    inputVideoDurationSec: 3.25, inheritedDurationSec: 4.75 }), null, 'retake reuses an owned interaction without submitting a source clip');
});

test('Omni preservation and output/source unit changes share the guarded admin protocol', async () => {
  const engine = getFalEngineById('gemini-omni-flash')!.engine;
  const context = { engine, mode: 'v2v' as const, resolution: '720p', durationSec: 5,
    inheritedDurationSec: 3.25, inputVideoDurationSec: 3.25 };
  const scenario = buildManualTariffCoverageScenario(context, 'omni');
  const state = { status: 'loaded' as const, active: false, revision: 0, databaseCells: [], versionedCells: [] };
  const policy = { status: 'loaded' as const, rules: [] };
  const proposal = { operation: 'create' as const, scope: 'continuous_input' as const, scenarioId: scenario.id,
    price: { kind: 'preserve_current' as const } };
  const current = await computeCanonicalBillingSnapshot(context, { pricingPolicy: { loadOverrides: async () => policy } });
  const preserved = await prepareContinuousInputTariffChange({ proposal, scenario, state, policy });
  assert.equal(preserved.proposedCents, current.totalCents);
  assert.ok(preserved.continuousInputRange!.minimumGrossCents >= 0);
  const changed = await prepareContinuousInputTariffChange({ proposal: { ...proposal,
    price: { kind: 'linear_video', outputCentsPerSecond: 15, inputCentsPerSecond: 2 } } as never, scenario, state, policy });
  assert.equal(changed.proposedCents, 55);
  await assert.rejects(prepareContinuousInputTariffChange({ proposal: { ...proposal,
    price: { kind: 'linear_video', outputCentsPerSecond: 1, inputCentsPerSecond: 2 } } as never, scenario, state, policy }), /cost/i);
});

test('Omni frozen customer bands preserve every double at a price boundary and independent output/source amounts', async () => {
  const engine = getFalEngineById('gemini-omni-flash')!.engine;
  const document = getVersionedPricingPolicy();
  const profile = document.compatibilityProfiles.find(p => p.id === 'standard')!;
  for (const mode of ['v2v', 'extend', 'retake'] as const) for (const resolution of ['360p', '720p', '1080p', '4k']) {
    const context = { engine, mode, resolution, durationSec: 5, inheritedDurationSec: mode === 'extend' ? undefined : 3.25,
      inputVideoDurationSec: mode === 'retake' ? 0 : 3.25 };
    const policy = resolvePricingPolicy({ scenario: { engineId: engine.id, mode, resolution }, databaseRules: [], versionedRules: document.rules });
    const price = compileOmniContinuousTariffPrice({ context, policy, compatibilityProfile: profile });
    assert.equal(price.kind, 'unit_bands');
    if (price.kind !== 'unit_bands') throw new Error('Expected frozen unit bands');
    assert.ok(!JSON.stringify(price).includes('marginPercent'));
    const currentCents = (basis: number) => quoteCanonicalPricing({
      facts: { engineId: engine.id, currency: 'USD', unit: 'sec', quantity: 1, vendorSubtotalExactCents: basis },
      scenario: { id: 'legacy', engineId: engine.id, membershipTier: 'member', discountPercent: 0 }, policy, compatibilityProfile: profile,
    }).customerTotalCents;
    // A synthetic literal basis is encoded with the same authored token expression.
    // Reachable media contexts are separately checked below; no caller supplies cost as a quantity.
    for (const band of price.bands.slice(1)) for (const basis of [adjacentNonnegativeDouble(band.minUnits, 'previous'), band.minUnits]) {
      const quantity = { output_tokens: 0, input_tokens: basis * 10000 / 1.5 };
      const evaluatedBasis = (quantity.output_tokens * 17.5 + quantity.input_tokens * 1.5) / 10000;
      assert.equal(evaluateManualTariffPrice(price, quantity).customerTotalCents, currentCents(evaluatedBasis));
    }
    for (const output of [3, 3.25, 4.75, 10]) for (const source of mode === 'retake' ? [0] : mode === 'v2v' ? [output] : [Number.MIN_VALUE, 3.25, 10]) {
      const c = { ...context, durationSec: mode === 'extend' ? 5 : 10, inputVideoDurationSec: source,
        inheritedDurationSec: mode === 'extend' ? undefined : output };
      const facts = buildBillingPricingFacts(c, engine.pricingDetails, 'USD').facts;
      const quantities = buildManualTariffScenario(c, facts).quantities;
      const old = await computeCanonicalBillingSnapshot(c, { pricingPolicy: { loadOverrides: async () => ({ status: 'loaded', rules: [] }) } });
      assert.equal(evaluateManualTariffPrice(price, quantities).customerTotalCents, old.totalCents, `${mode}/${resolution}/${output}/${source}`);
    }
  }
});
