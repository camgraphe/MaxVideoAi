import assert from 'node:assert/strict';
import test from 'node:test';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { buildBillingPricingFacts } from '../frontend/src/lib/pricing-billing-facts';
import { buildManualTariffScenario } from '../frontend/src/lib/pricing-manual-scenario';
import { collectSellableManualTariffCoverage } from '../frontend/lib/pricing-audit/manual-tariff-coverage';
import { chooseCustomerTariffScenario } from '../frontend/server/pricing-admin/customer-tariff-service';
import { resolvePublicModelScenario } from '../frontend/server/pricing/quote-public-model-scenario';
import { resolveCustomerTariffQuote } from '../frontend/server/pricing/resolve-customer-tariff';
import { buildManualTariffCoverageScenario } from '../frontend/lib/pricing-audit/manual-tariff-coverage';
import { prepareContinuousWanTariffChange } from '../frontend/server/pricing-admin/continuous-wan-tariff';
import { computeCanonicalBillingSnapshot } from '../frontend/server/pricing/quote-billing';
import { evaluateManualTariffPrice } from '../packages/pricing/src/manual-tariff-price';
import { providerComparisonForTariffScenario } from '../frontend/server/pricing-admin/tariff-provider-comparison';

test('LTX audio-second decimal selection shares one price identity across admin, public and charging', () => {
  const coverage = collectSellableManualTariffCoverage();
  for (const modelId of ['ltx-2-5-fast', 'ltx-2-5-pro']) {
    const engine = getFalEngineById(modelId)!.engine;
    const rows = coverage.scenarios.filter(row => row.modelId === modelId);
    const admin = chooseCustomerTariffScenario(rows, { mode: 'a2v', resolution: '1080p', inputAudioDurationSec: '9.25' });
    assert.equal(admin.scenario.context.inputAudioDurationSec, 9.25);
    assert.equal(admin.scenario.selector.durationSec, '9.25');
    assert.deepEqual(admin.choices.find(choice => choice.key === 'inputAudioDurationSec')?.range,
      { minInclusive: 2, max: modelId.endsWith('fast') ? 20 : 10 });
    assert.ok(!admin.choices.some(choice => choice.key === 'durationSec'), 'output duration is inherited, not an independent priced control');
    const publicScenario = resolvePublicModelScenario({ modelId, mode: 'a2v', durationSec: 5,
      resolution: '1080p', inputAudioDurationSec: 9.25 });
    assert.ok(publicScenario);
    assert.deepEqual(publicScenario.selector, admin.scenario.selector);
    assert.deepEqual(resolvePublicModelScenario({ modelId, mode: 'a2v', durationSec: 9.25,
      resolution: '1080p', inputAudioDurationSec: 9.25 })?.selector, admin.scenario.selector);
    assert.equal(providerComparisonForTariffScenario(admin.scenario).durationSec, 9.25);
    const context = { engine, mode: 'a2v' as const, durationSec: 5, resolution: '1080p', inputAudioDurationSec: 9.25 };
    const facts = buildBillingPricingFacts(context, engine.pricingDetails, 'USD').facts;
    const exact = buildManualTariffScenario(context, facts);
    const selector = { ...exact.selector, durationSec: 'continuous', inputAudioDurationSec: 'continuous' };
    const result = resolveCustomerTariffQuote({ context, facts, at: '2026-09-30T12:00:00Z', state: {
      status: 'loaded', active: true, revision: 1, versionedCells: [], databaseCells: [{
        id: 'audio', selector, currency: 'USD', source: 'database', version: 1, effectiveFrom: '2026-09-29T00:00:00Z',
        price: { kind: 'unit_terms', rounding: 'nearest', terms: [{ unit: 'input_audio_seconds', centsPerUnit: 30 }] },
      }],
    } });
    assert.equal(result?.quote.customerTotalCents, 278);
    for (const seconds of [0, 1.99, Infinity, NaN, modelId.endsWith('fast') ? 20.01 : 10.01]) {
      assert.equal(resolvePublicModelScenario({ modelId, mode: 'a2v', durationSec: 5, resolution: '1080p', inputAudioDurationSec: seconds }), null);
      assert.throws(() => chooseCustomerTariffScenario(rows, { mode: 'a2v', resolution: '1080p', inputAudioDurationSec: String(seconds) }), /audio|duration/i);
    }
  }
});

test('preserving LTX audio prices freezes absolute amounts and rejects a rate losing money elsewhere in the range', async () => {
  const state = { status: 'loaded' as const, active: false, revision: 0, databaseCells: [], versionedCells: [] };
  for (const modelId of ['ltx-2-5-fast', 'ltx-2-5-pro']) for (const marginPercent of [0, 0.17, 0.3, 2.49]) {
    const engine = getFalEngineById(modelId)!.engine;
    const context = { engine, mode: 'a2v' as const, durationSec: 5, resolution: '1080p', inputAudioDurationSec: 9.25 };
    const scenario = buildManualTariffCoverageScenario(context, 'audio');
    const rules = [{ id: 'effective', engineId: modelId, mode: 'a2v', resolution: '1080p', currency: 'USD',
      marginPercent, marginFlatCents: 3, surchargeAudioPercent: 0.2, surchargeUpscalePercent: 0.5 }];
    const policy = { status: 'loaded' as const, rules };
    const proposal = { operation: 'create' as const, scope: 'continuous_input' as const, scenarioId: scenario.id,
      price: { kind: 'preserve_current' as const } };
    const prepared = await prepareContinuousWanTariffChange({ proposal, scenario, state, policy });
    assert.ok(prepared.proposedCell);
    assert.equal(prepared.proposedCell.selector.inputAudioDurationSec, 'continuous');
    assert.ok(!JSON.stringify(prepared.proposedCell.price).includes('marginPercent'));
    assert.ok(prepared.continuousInputRange!.checkedBoundaries > 100);
    const maximum = modelId.endsWith('fast') ? 20 : 10;
    const rate = modelId.endsWith('fast') ? 13 : 17;
    const values = [2, 2.000001, 3.25, 9.25, maximum];
    for (let c = 2 * rate; c <= maximum * rate; c++) {
      values.push(c / rate, (c - 0.0005) / rate, (c + 0.0005) / rate);
    }
    for (const seconds of values.filter(q => q >= 2 && q <= maximum)) {
      const current = await computeCanonicalBillingSnapshot({ ...context, inputAudioDurationSec: seconds }, {
        pricingPolicy: { loadOverrides: async () => policy },
      });
      assert.equal(evaluateManualTariffPrice(prepared.proposedCell.price, { input_audio_seconds: seconds }).customerTotalCents,
        current.totalCents, `${modelId}/${marginPercent}/${seconds}`);
    }
    await assert.rejects(prepareContinuousWanTariffChange({ proposal: { ...proposal,
      price: { kind: 'linear_input', outputCents: 0, inputCentsPerSecond: rate } }, scenario, state, policy }), /below.cost/i);
    await assert.rejects(prepareContinuousWanTariffChange({ proposal: { ...proposal,
      price: { kind: 'linear_input', outputCents: 1, inputCentsPerSecond: 30 } }, scenario, state, policy }), /audio|output|amount/i);
  }
});
