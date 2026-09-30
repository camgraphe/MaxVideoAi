import assert from 'node:assert/strict';
import test from 'node:test';

import { collectSellableManualTariffCoverage } from '../frontend/lib/pricing-audit/manual-tariff-coverage';
import { chooseCustomerTariffScenario } from '../frontend/server/pricing-admin/customer-tariff-service';
import { resolvePublicModelScenario } from '../frontend/server/pricing/quote-public-model-scenario';
import { computeCanonicalBillingSnapshot } from '../frontend/server/pricing/quote-billing';
import { computeCanonicalPublicSnapshot } from '../frontend/server/pricing/quote-public';
import { buildBillingPricingFacts } from '../frontend/src/lib/pricing-billing-facts';
import { buildManualTariffScenario } from '../frontend/src/lib/pricing-manual-scenario';

const coverage = collectSellableManualTariffCoverage();

for (const modelId of ['wan-3', 'wan-3-prime']) for (const mode of ['v2v', 'extend']) {
  test(`${modelId}/${mode}: decimal source duration shares exact admin, public and charging identity`, async () => {
    const input = { modelId, mode, durationSec: 5, resolution: '720p', aspectRatio: '16:9', inputVideoDurationSec: 3.25 };
    const publicScenario = resolvePublicModelScenario(input);
    assert.ok(publicScenario, 'a valid decimal source duration must have a quote');
    const admin = chooseCustomerTariffScenario(coverage.scenarios.filter(s => s.modelId === modelId), {
      mode, durationSec: '5', resolution: '720p', aspectRatio: '16:9', inputVideoDurationSec: '3.25',
    });
    assert.equal(admin.scenario.id, publicScenario.id);
    assert.equal(admin.scenario.context.inputVideoDurationSec, 3.25);
    assert.equal(admin.scenario.quantities.input_video_seconds, 3.25);
    const source = admin.choices.find(c => c.key === 'inputVideoDurationSec');
    assert.equal(source?.value, '3.25');
    assert.deepEqual((source as unknown as { range: unknown })?.range, { minExclusive: 0, max: 15 });
    const facts = buildBillingPricingFacts(publicScenario.context, publicScenario.context.engine.pricingDetails, 'USD');
    const generationScenario = buildManualTariffScenario(publicScenario.context, facts.facts);
    assert.deepEqual(generationScenario.selector, admin.scenario.selector);
    const dependencies = { pricingPolicy: { loadOverrides: async () => ({ status: 'loaded' as const, rules: [] }) } };
    const billing = await computeCanonicalBillingSnapshot(publicScenario.context, dependencies);
    const publicQuote = await computeCanonicalPublicSnapshot(publicScenario.context, dependencies);
    assert.equal(billing.totalCents, publicQuote.totalCents);
    assert.equal(billing.totalCents, modelId === 'wan-3' ? 108 : 151, 'preserve the existing two-stage rounding');
    assert.equal(facts.facts.vendorSubtotalExactCents, modelId === 'wan-3' ? 82.5 : 115.5);
    const neighboring = resolvePublicModelScenario({ ...input, inputVideoDurationSec: 3.2501 });
    assert.ok(neighboring);
    assert.notEqual(neighboring.id, publicScenario.id, 'a fixed exact price cannot silently cover another source duration');
  });
}

test('decimal source controls enforce factual source/output limits and reject invalid or missing facts', () => {
  const options = coverage.scenarios.filter(s => s.modelId === 'wan-3');
  const input = { modelId: 'wan-3', mode: 'v2v', durationSec: 29, resolution: '720p', aspectRatio: '16:9' };
  const selection = { mode: 'v2v', durationSec: '29', resolution: '720p', aspectRatio: '16:9' };
  const supported = chooseCustomerTariffScenario(options, { ...selection, inputVideoDurationSec: '0.75' });
  assert.deepEqual((supported.choices.find(c => c.key === 'inputVideoDurationSec') as unknown as { range: unknown }).range,
    { minExclusive: 0, max: 1 });
  assert.ok(resolvePublicModelScenario({ ...input, inputVideoDurationSec: 0.75 }));
  assert.equal(resolvePublicModelScenario(input), null);
  for (const inputVideoDurationSec of [0, -1, 1.01, 15.1, NaN, Infinity, '0.75', null, {}]) {
    assert.equal(resolvePublicModelScenario({ ...input, inputVideoDurationSec: inputVideoDurationSec as never }), null);
  }
  for (const value of ['', '0', '-1', '1.01', 'NaN', 'Infinity', 'bogus']) {
    assert.throws(() => chooseCustomerTariffScenario(options, { ...selection, inputVideoDurationSec: value }), /input.video|duration/i);
  }
  assert.equal(resolvePublicModelScenario({ ...input, modelId: 'gemini-omni-flash', inputVideoDurationSec: 0.75 }), null,
    'this reviewed decimal mapping must not loosen other models');
  assert.equal(coverage.gaps.filter(g => /fractional input video/.test(g.reason)).length, 4,
    'editable exact samples do not establish continuous manual tariff coverage');
});
