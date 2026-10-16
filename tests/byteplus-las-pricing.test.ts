import assert from 'node:assert/strict';
import test from 'node:test';
import { ManualTariffError } from '@maxvideoai/pricing';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import type { PricingContext } from '../frontend/src/lib/pricing-context';
import { normalBytePlusSupplierCost } from '../frontend/server/byteplus-normal-cost';
import { buildBytePlusListCostBreakdown } from '../frontend/server/byteplus-accounting';
import { buildBillingPricingFacts } from '../frontend/src/lib/pricing-billing-facts';
import { buildManualTariffScenario, continuousInputTariffSelector } from '../frontend/src/lib/pricing-manual-scenario';
import { resolveCustomerTariffQuote } from '../frontend/server/pricing/resolve-customer-tariff';
import { seedanceInputTariffBasis, seedanceInputTariffPriceFromRate, validateSeedanceInputTariffDomain } from '../frontend/server/pricing/seedance-input-tariff';
import { evaluateManualTariffPrice } from '../packages/pricing/src/manual-tariff-price';
import { computeCanonicalBillingSnapshot } from '../frontend/server/pricing/quote-billing';
import { providerComparisonInputFromScenario, buildProviderCostComparisonRows } from '../frontend/server/pricing-admin/provider-cost-comparison';

const at = '2026-10-13T12:00:00Z';
function context(extra: Partial<PricingContext> = {}): PricingContext {
  const entry = getFalEngineById('seedance-2-5')!.engine;
  return { engine: { ...entry, providerMeta: { ...entry.providerMeta, provider: 'byteplus_modelark' } },
    mode: 'v2v', durationSec: 4, resolution: '480p', aspectRatio: '16:9',
    hasVideoInput: true, inputVideoDurationSec: 4, ...extra };
}
function tariff(ctx: PricingContext, customerCents: number) {
  const facts = buildBillingPricingFacts(ctx, ctx.engine.pricingDetails, 'USD').facts;
  return { facts, state: { status: 'loaded' as const, active: true, revision: 4, databaseCells: [], versionedCells: [{
    id: 'approved-edit', source: 'versioned' as const, version: 1, currency: 'USD',
    selector: buildManualTariffScenario(ctx, facts).selector,
    effectiveFrom: '2026-10-01T00:00:00Z', price: { kind: 'unit_components' as const, rounding: 'up' as const,
      components: [{ id: 'retail', rounding: 'none' as const,
        flatCents: customerCents / (ctx.durationSec + (ctx.inputVideoDurationSec ?? 4)) * ctx.durationSec,
        terms: [{ unit: 'input_video_seconds', centsPerUnit: customerCents / (ctx.durationSec + (ctx.inputVideoDurationSec ?? 4)), includedUnits: 0 }] }] },
  }] } };
}

test('LAS Edit charges factual input plus output seconds without the ModelArk discount or token minimum', () => {
  for (const [resolution, inputVideoDurationSec, expected] of [
    ['480p', 4, 0.984144], ['720p', 4, 2.2119], ['480p', 0.5, 0.553581], ['720p', 28.25, 8.916721875],
  ] as const) {
    const cost = normalBytePlusSupplierCost(context({ resolution, inputVideoDurationSec }), at)!;
    assert.equal(cost.amountUsd, expected);
    assert.equal(cost.listAmountUsd, expected);
    assert.equal(cost.kind, 'published_list_estimate');
    assert.equal(cost.contract, undefined);
    assert.equal(cost.sourceUrl, 'https://docs.byteplus.com/en/docs/byteplus_las/video_gen_enhanced');
  }
  for (const inputVideoDurationSec of [undefined, 0, -1, Infinity, 30.01]) {
    assert.equal(normalBytePlusSupplierCost(context({ inputVideoDurationSec }), at), null);
  }
  assert.equal(normalBytePlusSupplierCost(context({ resolution: '1080p' }), at), null);
});

test('active Edit customer cents stay authored while the factual LAS below-cost guard rejects undercharges', () => {
  const ctx = context();
  const { facts, state } = tariff(ctx, 247);
  const resolved = resolveCustomerTariffQuote({ context: ctx, facts, state, at })!;
  assert.equal(resolved.quote.customerTotalCents, 247);
  assert.equal(resolved.quote.breakdown.vendorSubtotalExactCents, 98.4144);
  const below = tariff(ctx, 70);
  assert.throws(() => resolveCustomerTariffQuote({ context: ctx, ...below, at }),
    error => error instanceof ManualTariffError && error.code === 'below_cost');
});

test('LAS canonical billing requires an active reviewed tariff', async () => {
  const ctx = context();
  const { state } = tariff(ctx, 247);
  await assert.rejects(computeCanonicalBillingSnapshot(ctx, {
    pricingPolicy: { loadOverrides: async () => ({ status: 'loaded', rules: [] }) },
    loadCustomerTariffState: async () => ({ ...state, active: false }),
  }), /LAS.*tariff/i);
});

test('LAS current tariffs refuse an unavailable supplier cost instead of using the legacy retail basis', () => {
  const unsupported = context({ resolution: '1080p' });
  const selected = tariff(unsupported, 1000);
  assert.throws(() => resolveCustomerTariffQuote({ context: unsupported, ...selected, at }), /LAS.*cost/i);
});

test('new LAS quotes reject old ModelArk-shaped cells even when a tiny source leaves them above cost', () => {
  const ctx = context({ inputVideoDurationSec: 0.5 });
  const selected = tariff(ctx, 247);
  const cell = selected.state.versionedCells[0]!;
  for (const price of [
    { kind: 'fixed' as const, customerCents: 247 },
    { kind: 'unit_components' as const, rounding: 'up' as const,
      components: [{ id: 'retail', rounding: 'none' as const, flatCents: 62,
        terms: [{ unit: 'input_video_seconds', centsPerUnit: 8.857077007717129, includedUnits: 3.0000520426749935 }] }] },
  ]) {
    const state = { ...selected.state, versionedCells: [{ ...cell, price }] };
    assert.throws(() => resolveCustomerTariffQuote({ context: ctx, facts: selected.facts, state, at }), /LAS.*tariff/i);
  }
});

test('LAS completion ignores reported tokens as a cost unit and uses the stored trusted input duration', () => {
  const job = { engine_id: 'seedance-2-5', duration_sec: 4, has_audio: false,
    settings_snapshot: { byteplusTransport: 'las', byteplusInputVideoDurationSec: 4,
      inputMode: 'v2v', core: { resolution: '480p', aspectRatio: '16:9' } } } as never;
  const input = { job, model: 'seedance25', resolution: '480p', aspectRatio: '16:9',
    usage: { totalTokens: 999999, completionTokens: 888888 } };
  const result = buildBytePlusListCostBreakdown(input);
  assert.equal(result.provider_cost_usd_list, 0.984144);
  assert.equal(result.unit_price_usd_per_1k_tokens, null);
  assert.equal(result.total_tokens, 999999);
  assert.equal(result.provider_cost_usd_effective, null);
  assert.equal(result.provider_cost_usd_observed, null);
  const missing = buildBytePlusListCostBreakdown({ ...input, job: { ...job,
    settings_snapshot: { byteplusTransport: 'las', inputMode: 'v2v' } } as never });
  assert.equal(missing.provider_cost_usd_list, null);
  const reported = buildBytePlusListCostBreakdown({ ...input,
    providerTask: { data: { duration: 5, resolution: '720p' } } });
  assert.equal(reported.provider_cost_usd_list, 2.4883875);
  assert.equal(reported.provider_cost_status, 'list_estimate_from_provider_duration');
  const invalid = buildBytePlusListCostBreakdown({ ...input, providerTask: { duration: 31, resolution: '480p' } });
  assert.equal(invalid.provider_cost_usd_list, null);
  for (const providerTask of [{ duration: '4', resolution: '480p' }, { duration: 4, resolution: null }]) {
    assert.equal(buildBytePlusListCostBreakdown({ ...input, providerTask }).provider_cost_usd_list, null);
  }
  const historical = buildBytePlusListCostBreakdown({ ...input, job: { ...job,
    settings_snapshot: { byteplusTransport: 'modelark', byteplusInputVideoDurationSec: 4, inputMode: 'v2v' } } as never });
  assert.equal(historical.provider_cost_usd_list, 6.399994);
});

test('LAS authoring supports the reviewed literal rate for every fractional source length without a token plateau', () => {
  const ctx = context();
  assert.deepEqual(seedanceInputTariffBasis(ctx), { maximum: 30, minimumBillableSeconds: 4, includedInputSeconds: 0 });
  const price = seedanceInputTariffPriceFromRate(ctx, 30.7545);
  for (const [source, expected] of [[0.5, 139], [4, 247], [28.25, 992], [30, 1046]] as const) {
    assert.equal(evaluateManualTariffPrice(price, { input_video_seconds: source }).customerTotalCents, expected);
  }
  assert.ok(validateSeedanceInputTariffDomain({ context: ctx, price, at }).checkedBoundaries > 100);
  const facts = buildBillingPricingFacts(ctx, ctx.engine.pricingDetails, 'USD').facts;
  const selector = continuousInputTariffSelector(buildManualTariffScenario(ctx, facts).selector)!;
  const state = { status: 'loaded' as const, active: true, revision: 5, databaseCells: [], versionedCells: [{
    id: 'reviewed-continuous-edit', source: 'versioned' as const, version: 1, currency: 'USD', selector,
    effectiveFrom: '2026-10-01T00:00:00Z', price,
  }] };
  const resolved = resolveCustomerTariffQuote({ context: ctx, facts, state, at })!;
  assert.equal(resolved.quote.customerTotalCents, 247);
});

test('ModelArk extension retains its token accounting and authored minimum', () => {
  const ctx = context({ mode: 'extend' });
  assert.equal(normalBytePlusSupplierCost(ctx, at)!.amountUsd, 0.491904);
  assert.ok(Math.abs(seedanceInputTariffBasis(ctx).includedInputSeconds - 3) < 0.0001);
});

test('the admin projects LAS duration costs with source provenance and no ModelArk contract evidence', () => {
  const ctx = context({ resolution: '720p', inputVideoDurationSec: 4.5 });
  const input = providerComparisonInputFromScenario({ engine: ctx.engine, context: ctx,
    executionProvider: 'byteplus_modelark', brandId: 'bytedance', quote: null,
    scenario: { id: 'las-edit', engineId: ctx.engine.id, mode: 'v2v', durationSec: 4,
      resolution: '720p', surface: 'billing', input: { aspectRatio: '16:9' } } });
  input.accountContractRegion = 'ap-southeast-1';
  const row = buildProviderCostComparisonRows([input], at)[0]!;
  assert.equal(row.supplierList.amountUsd, 2.35014375);
  assert.equal(row.supplierList.sourceLabel, 'BytePlus LAS Enhanced published LIST');
  assert.equal(row.supplierList.unitPriceUsdPer1kTokens, null);
  assert.equal(row.supplierEffective.amountUsd, null);
  assert.equal(row.supplierObserved.amountUsd, null);
  assert.equal(row.supplierList.rateBreakdown?.[0]?.unit, 'second');
});

test('LAS tariff domain review covers all 324 supported output selectors and rejects ModelArk-shaped prices', () => {
  for (const [resolution, rate] of [['480p', 30.7545], ['720p', 69.121875]] as const) {
    for (let durationSec = 4; durationSec <= 30; durationSec += 1) {
      for (const aspectRatio of ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16']) {
        const ctx = context({ resolution, durationSec, aspectRatio });
        const price = seedanceInputTariffPriceFromRate(ctx, rate);
        assert.ok(validateSeedanceInputTariffDomain({ context: ctx, price, at }).checkedBoundaries > 100);
        assert.equal(evaluateManualTariffPrice(price, { input_video_seconds: 30 }).customerTotalCents,
          Math.ceil((durationSec + 30) * rate - 1e-9));
      }
    }
  }
  const ctx = context();
  assert.throws(() => validateSeedanceInputTariffDomain({ context: ctx, at, price: {
    kind: 'unit_components', rounding: 'up', components: [{ id: 'retail', rounding: 'none', flatCents: 62,
      terms: [{ unit: 'input_video_seconds', centsPerUnit: 8.857077007717129, includedUnits: 3.0000520426749935 }] }],
  } }), /proportional/i);
});
