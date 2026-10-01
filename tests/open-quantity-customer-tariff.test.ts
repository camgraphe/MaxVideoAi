import assert from 'node:assert/strict';
import test from 'node:test';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { buildManualTariffCoverageScenario } from '../frontend/lib/pricing-audit/manual-tariff-coverage';
import { compileCurrentContinuousTariffPrice, validateCurrentContinuousTariffDomain } from '../frontend/server/pricing/compile-current-continuous-tariff';
import { buildBillingPricingFacts } from '../frontend/src/lib/pricing-billing-facts';
import { buildManualTariffScenario, continuousInputTariffSelector } from '../frontend/src/lib/pricing-manual-scenario';
import { resolveCustomerTariffQuote } from '../frontend/server/pricing/resolve-customer-tariff';
import { computeCanonicalBillingSnapshot } from '../frontend/server/pricing/quote-billing';
import { evaluateManualTariffPrice, isValidManualTariffPrice } from '../packages/pricing/src/manual-tariff-price';
import { prepareContinuousInputTariffChange, continuousInputTariffDetail } from '../frontend/server/pricing-admin/continuous-input-tariff';
import { chooseCustomerTariffScenario } from '../frontend/server/pricing-admin/customer-tariff-service';
import { collectSellableManualTariffCoverage } from '../frontend/lib/pricing-audit/manual-tariff-coverage';
import { resolvePublicModelScenario } from '../frontend/server/pricing/quote-public-model-scenario';

const policy = { status: 'loaded' as const, rules: [{ id: 'default', currency: 'USD', marginPercent: .3,
  marginFlatCents: 0, surchargeAudioPercent: .2, surchargeUpscalePercent: .5 }] };

test('admin and public current quotes accept unseen supported output seconds and reference budgets', () => {
  const scenarios = collectSellableManualTariffCoverage().scenarios;
  for (const modelId of ['lumaRay2', 'minimax-h3-max']) {
    const tokens = modelId === 'minimax-h3-max';
    const mode = tokens ? 'ref2v' : 'v2v';
    const requested = { mode, resolution: tokens ? '768P' : '720p', ...(tokens ? { referenceTokenBudget: '9096' } : { durationSec: '131' }) };
    const selected = chooseCustomerTariffScenario(scenarios.filter(row => row.modelId === modelId), requested);
    assert.equal(selected.scenario.selector[tokens ? 'referenceTokenBudget' : 'durationSec'], tokens ? '9096' : '131');
    const publicScenario = resolvePublicModelScenario({ modelId, mode, resolution: requested.resolution,
      durationSec: tokens ? 5 : 131, ...(tokens ? { referenceTokenBudget: 9096 } : {}) });
    assert.ok(publicScenario);
    assert.equal(publicScenario.selector[tokens ? 'referenceTokenBudget' : 'durationSec'], tokens ? '9096' : '131');
  }
});

test('open Luma modify seconds resolve the same literal retail curve at unseen durations', async () => {
  for (const modelId of ['lumaRay2', 'lumaRay2_flash']) {
    const context = { engine: getFalEngineById(modelId)!.engine, mode: 'v2v' as const, durationSec: 5, resolution: '720p' };
    const scenario = buildManualTariffCoverageScenario(context, 'open');
    const price = await compileCurrentContinuousTariffPrice(scenario, policy);
    const selector = continuousInputTariffSelector(scenario.selector)!;
    assert.equal(selector.durationSec, 'continuous');
    assert.ok(isValidManualTariffPrice(price));
    assert.equal(evaluateManualTariffPrice(price, { output_seconds: 7 }).customerTotalCents, 110);
    assert.ok(validateCurrentContinuousTariffDomain({ context, price }).minimumGrossCents >= 0);
    const values = [1, 7, 31, 1000, 562949953421263];
    for (const seconds of values) {
      const selected = { ...context, durationSec: seconds };
      const facts = buildBillingPricingFacts(selected, context.engine.pricingDetails, 'USD').facts;
      const current = await computeCanonicalBillingSnapshot(selected, { pricingPolicy: { loadOverrides: async () => policy } });
      const manual = resolveCustomerTariffQuote({ context: selected, facts, at: '2026-10-01T00:00:00Z', state: {
        status: 'loaded', active: true, revision: 4, versionedCells: [], databaseCells: [{ id: modelId, selector,
          currency: 'USD', source: 'database', version: 1, effectiveFrom: '2026-09-30T00:00:00Z', price }],
      } });
      assert.equal(manual!.quote.customerTotalCents, current.totalCents, `${modelId}/${seconds}`);
    }
  }
});

test('admin edits literal output and excess-token rates and rejects below-cost curves across the open domain', async () => {
  const state = { status: 'loaded' as const, active: false, revision: 0, versionedCells: [], databaseCells: [] };
  for (const modelId of ['lumaRay2', 'minimax-h3-max']) {
    const tokens = modelId === 'minimax-h3-max';
    const context = { engine: getFalEngineById(modelId)!.engine, mode: tokens ? 'ref2v' as const : 'v2v' as const,
      durationSec: 5, resolution: tokens ? '768P' : '720p', ...(tokens ? { referenceTokenBudget: 9096 } : {}) };
    const scenario = buildManualTariffCoverageScenario(context, 'edit');
    const detail = await continuousInputTariffDetail(scenario, state, policy);
    assert.equal(detail!.kind, tokens ? 'tokens' : 'output');
    assert.equal(detail!.unbounded, true);
    const proposal = { operation: 'create' as const, scenarioId: scenario.id, scope: 'continuous_input' as const,
      price: { kind: 'linear_open' as const, outputCents: tokens ? 55 : 0, unitCents: tokens ? .003 : 17 } };
    const prepared = await prepareContinuousInputTariffChange({ proposal, scenario, state, policy });
    assert.equal(prepared.proposedCents, tokens ? 70 : 85);
    assert.ok(prepared.continuousInputRange!.minimumGrossCents >= 0);
    await assert.rejects(prepareContinuousInputTariffChange({ proposal: { ...proposal,
      price: { ...proposal.price, unitCents: 0 } }, scenario, state, policy }), /below.cost/i);
    const malformed = structuredClone(detail!.price);
    assert.equal(malformed.kind, 'unit_components');
    if (malformed.kind === 'unit_components') {
      const altered = { ...malformed, components: malformed.components.map(c => ({ ...c, precision: 0 })) };
      assert.throws(() => validateCurrentContinuousTariffDomain({ context, price: altered }), /rounding/i);
    }
  }
});

test('MiniMax includes 4096 tokens and preserves native rounding beyond sampled token budgets', async () => {
  const context = { engine: getFalEngineById('minimax-h3-max')!.engine, mode: 'ref2v' as const,
    durationSec: 5, resolution: '768P', referenceTokenBudget: 4096 };
  const scenario = buildManualTariffCoverageScenario(context, 'open');
  const price = await compileCurrentContinuousTariffPrice(scenario, policy);
  const selector = continuousInputTariffSelector(scenario.selector)!;
  assert.equal(selector.referenceTokenBudget, 'continuous');
  const values = [[0,52], [4096,52], [4097,53], [9096,65], [2251799813685250,5854679515623]];
  for (const [tokens, cents] of values) {
    const evaluated = evaluateManualTariffPrice(price, { reference_tokens: tokens });
    assert.equal(evaluated.customerTotalCents, cents);
    assert.equal(evaluated.units[0].billedQuantity, Math.max(0, tokens - 4096));
    const selected = { ...context, referenceTokenBudget: tokens };
    const facts = buildBillingPricingFacts(selected, context.engine.pricingDetails, 'USD').facts;
    assert.equal(buildManualTariffScenario(selected, facts).quantities.reference_tokens, tokens);
    const manual = resolveCustomerTariffQuote({ context: selected, facts, at: '2026-10-01T00:00:00Z', state: {
      status: 'loaded', active: true, revision: 4, versionedCells: [], databaseCells: [{ id: 'tokens', selector,
        currency: 'USD', source: 'database', version: 1, effectiveFrom: '2026-09-30T00:00:00Z', price }],
    } });
    assert.equal(manual!.quote.customerTotalCents, cents);
  }
  assert.ok(validateCurrentContinuousTariffDomain({ context, price }).minimumGrossCents >= 0);
  for (const tokens of [-1, .5, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => continuousInputTariffSelector({ ...scenario.selector, referenceTokenBudget: String(tokens) }));
  }
});
