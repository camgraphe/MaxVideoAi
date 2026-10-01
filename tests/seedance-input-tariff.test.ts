import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateManualTariffPrice } from '../packages/pricing/src/manual-tariff-price';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { normalBytePlusSupplierCost } from '../frontend/server/byteplus-normal-cost';
import { prepareSeedanceInputTariffPrice, validateSeedanceInputTariffDomain } from '../frontend/server/pricing/seedance-input-tariff';
import { buildBillingPricingFacts } from '../frontend/src/lib/pricing-billing-facts';
import { buildManualTariffScenario, continuousInputTariffSelector } from '../frontend/src/lib/pricing-manual-scenario';
import { resolveCustomerTariffQuote } from '../frontend/server/pricing/resolve-customer-tariff';
import type { PricingContext } from '../frontend/src/lib/pricing-context';
import { chooseCustomerTariffScenario } from '../frontend/server/pricing-admin/customer-tariff-service';
import { collectSellableManualTariffCoverage } from '../frontend/lib/pricing-audit/manual-tariff-coverage';
import { resolvePublicModelScenario } from '../frontend/server/pricing/quote-public-model-scenario';

const at = '2026-10-01T12:00:00Z';
function context(engineId = 'seedance-2-0', extra: Partial<PricingContext> = {}): PricingContext {
  const engine = getFalEngineById(engineId)!.engine;
  return { engine: { ...engine, providerMeta: { ...engine.providerMeta, provider: 'byteplus_modelark' } },
    mode: 'ref2v', resolution: '480p', aspectRatio: '16:9', durationSec: 4, hasVideoInput: true,
    inputVideoDurationSec: 2, ...extra };
}

test('video-reference customer cents preserve positive minimum margin throughout the source range', () => {
  const ctx = context();
  const prepared = prepareSeedanceInputTariffPrice({ context: ctx, currentCustomerCents: 68, at });
  assert.equal(prepared.minimumCustomerCents, 68);
  assert.equal(prepared.includedInputSeconds, 3);
  const baselineCost = normalBytePlusSupplierCost(ctx, at)!.amountUsd;
  for (const seconds of [Number.MIN_VALUE, 2, 3, 3.00001, 3.25, 8.5, 15]) {
    const customer = evaluateManualTariffPrice(prepared.price, { input_video_seconds: seconds });
    const cost = normalBytePlusSupplierCost({ ...ctx, inputVideoDurationSec: seconds }, at)!.amountUsd;
    assert.ok(Math.abs(customer.exactCustomerCents / (cost * 100) - 68 / (baselineCost * 100)) < 0.00003);
    assert.ok(customer.customerTotalCents >= cost * 100);
  }
  assert.equal(evaluateManualTariffPrice(prepared.price, { input_video_seconds: 2 }).customerTotalCents, 68);
  assert.equal(evaluateManualTariffPrice(prepared.price, { input_video_seconds: 15 }).customerTotalCents, 185);
  assert.ok(validateSeedanceInputTariffDomain({ context: ctx, price: prepared.price, at }).checkedBoundaries > 50);
});

test('an unprofitable minimum uses the same variant without video as a positive margin anchor', () => {
  const ctx = context('seedance-2-5', { aspectRatio: '1:1' });
  const prepared = prepareSeedanceInputTariffPrice({ context: ctx, currentCustomerCents: 35,
    noVideoCustomerCents: 58, at });
  assert.equal(prepared.minimumCustomerCents, 61);
  assert.equal(prepared.marginSource, 'no_video_variant');
  assert.equal(evaluateManualTariffPrice(prepared.price, { input_video_seconds: 30 }).customerTotalCents, 297);
  assert.throws(() => prepareSeedanceInputTariffPrice({ context: ctx, currentCustomerCents: 35, at }), /positive.*margin/i);
});

test('confirmation and rollback reject rates that break proportional minimum pricing', () => {
  const ctx = context();
  const price = prepareSeedanceInputTariffPrice({ context: ctx, currentCustomerCents: 68, at }).price;
  assert.equal(price.kind, 'unit_components');
  if (price.kind !== 'unit_components') return;
  assert.throws(() => validateSeedanceInputTariffDomain({ context: ctx, at,
    price: { ...price, components: [{ ...price.components[0], flatCents: 100 }] } }), /proportional/i);
  assert.throws(() => validateSeedanceInputTariffDomain({ context: ctx, at, price: { ...price,
    components: [{ ...price.components[0], terms: [{ ...price.components[0].terms[0], includedUnits: 0 }] }] } }), /proportional/i);
});

test('billing resolves the same literal continuous tariff and rejects unknown source duration', () => {
  const base = context();
  const prepared = prepareSeedanceInputTariffPrice({ context: base, currentCustomerCents: 68, at });
  const initial = buildManualTariffScenario(base, buildBillingPricingFacts(base, base.engine.pricingDetails, 'USD').facts);
  assert.equal(initial.selector.inputVideoDurationSec, '2');
  const selector = continuousInputTariffSelector(initial.selector)!;
  assert.equal(selector.inputVideoDurationSec, 'continuous');
  const state = { status: 'loaded' as const, active: true, revision: 329, databaseCells: [], versionedCells: [{
    id: 'authored-input-tariff', source: 'versioned' as const, version: 1, currency: 'USD',
    selector, price: prepared.price, effectiveFrom: '2026-10-01T00:00:00Z',
  }] };
  for (const [seconds, expected] of [[2, 68], [15, 185]] as const) {
    const ctx = { ...base, inputVideoDurationSec: seconds };
    const facts = buildBillingPricingFacts(ctx, ctx.engine.pricingDetails, 'USD').facts;
    const quote = resolveCustomerTariffQuote({ context: ctx, facts, state, at })!;
    assert.equal(quote.quote.customerTotalCents, expected);
    assert.equal(quote.quote.manualTariff.units[0].quantity, seconds);
  }
  const unknown = { ...base, inputVideoDurationSec: undefined };
  assert.throws(() => resolveCustomerTariffQuote({ context: unknown,
    facts: buildBillingPricingFacts(unknown, unknown.engine.pricingDetails, 'USD').facts, state, at }), /duration/i);
});

test('admin and public Seedance scenarios quote the actual fractional source duration and 2.5 limit', () => {
  const options = collectSellableManualTariffCoverage().scenarios.filter(s => s.modelId === 'seedance-2-5');
  const requested = { mode: 'ref2v', resolution: '480p', durationSec: '4', aspectRatio: '1:1',
    billingInputType: 'video_input', inputVideoDurationSec: '28.25' };
  const selected = chooseCustomerTariffScenario(options, requested);
  assert.equal(selected.scenario.context.inputVideoDurationSec, 28.25);
  assert.deepEqual(selected.choices.find(choice => choice.key === 'inputVideoDurationSec')?.range, { minExclusive: 0, max: 30 });
  const publicInput = { modelId: 'seedance-2-5', mode: 'ref2v', resolution: '480p', durationSec: 4,
    aspectRatio: '1:1', hasVideoInput: true, inputVideoDurationSec: 28.25 };
  assert.equal(resolvePublicModelScenario(publicInput)?.selector.inputVideoDurationSec, '28.25');
  assert.equal(resolvePublicModelScenario({ ...publicInput, inputVideoDurationSec: undefined }), null);
  assert.equal(resolvePublicModelScenario({ ...publicInput, inputVideoDurationSec: 30.01 }), null);
  assert.equal(resolvePublicModelScenario({ ...publicInput, modelId: 'seedance-2-0', inputVideoDurationSec: 15.01 }), null);
});
