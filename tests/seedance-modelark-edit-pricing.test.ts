import assert from 'node:assert/strict';
import test from 'node:test';
import { ENV } from '../frontend/src/lib/env';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import type { PricingContext } from '../frontend/src/lib/pricing-context';
import { buildBillingPricingFacts } from '../frontend/src/lib/pricing-billing-facts';
import { buildManualTariffScenario, continuousInputTariffSelector } from '../frontend/src/lib/pricing-manual-scenario';
import { normalBytePlusSupplierCost } from '../frontend/server/byteplus-normal-cost';
import { buildBytePlusListCostBreakdown } from '../frontend/server/byteplus-accounting';
import { resolveCustomerTariffQuote } from '../frontend/server/pricing/resolve-customer-tariff';
import { computeCanonicalBillingSnapshot } from '../frontend/server/pricing/quote-billing';
import { seedanceInputTariffBasis } from '../frontend/server/pricing/seedance-input-tariff';
import { prepareReviewedSeedanceLasPrice } from '../frontend/server/pricing/seedance-las-authoring';
import { prepareSeedance25LasTariffRelease } from '../frontend/server/pricing-admin/seedance-las-tariff-release';
import { LOCAL_TARIFF_FACTUAL_ENVIRONMENT_KEYS } from '../frontend/server/pricing/cutover-factual-environment';

async function withModelArk(work: () => Promise<void> | void) {
  const before = { selection: ENV.SEEDANCE_2_5_EDIT_TRANSPORT, region: ENV.BYTEPLUS_ARK_REGION };
  ENV.SEEDANCE_2_5_EDIT_TRANSPORT = 'modelark'; ENV.BYTEPLUS_ARK_REGION = 'ap-southeast-1';
  try { await work(); } finally { ENV.SEEDANCE_2_5_EDIT_TRANSPORT = before.selection; ENV.BYTEPLUS_ARK_REGION = before.region; }
}
function context(resolution = '480p'): PricingContext {
  const engine = getFalEngineById('seedance-2-5')!.engine;
  return { engine: { ...engine, providerMeta: { ...engine.providerMeta, provider: 'byteplus_modelark' } },
    mode: 'v2v', durationSec: 4, resolution, aspectRatio: '16:9', hasVideoInput: true, inputVideoDurationSec: 4 };
}
function reviewedModelArk(ctx: PricingContext) {
  const facts = buildBillingPricingFacts(ctx, ctx.engine.pricingDetails, 'USD').facts;
  const selector = continuousInputTariffSelector(buildManualTariffScenario(ctx, facts).selector)!;
  const price = { kind: 'unit_components' as const, rounding: 'up' as const, components: [{ id: 'retail', rounding: 'none' as const,
    flatCents: ctx.resolution === '480p' ? 62 : 139, terms: [{ unit: 'input_video_seconds',
      centsPerUnit: ctx.resolution === '480p' ? 8.857077007717129 : 139 / 7,
      includedUnits: ctx.resolution === '480p' ? 3.0000520426749935 : 3 }] }] };
  return { facts, state: { status: 'loaded' as const, active: true, revision: 5, databaseCells: [], versionedCells: [{
    id: 'reviewed-modelark-edit', source: 'versioned' as const, version: 1, currency: 'USD', selector,
    effectiveFrom: '2026-10-01T00:00:00Z', price }] } };
}
const at = '2026-10-13T12:00:00Z';

test('new ModelArk Edit quotes preserve reviewed customer cells and use their own supplier and signed SKU evidence',
  { concurrency: false }, async () => withModelArk(() => {
    for (const [resolution, customer, supplier] of [['480p', 71, 0.491904], ['720p', 159, 1.10592]] as const) {
      const ctx = context(resolution);
      const cost = normalBytePlusSupplierCost(ctx, at)!;
      assert.equal(cost.amountUsd, supplier);
      assert.equal(cost.listAmountUsd, supplier);
      assert.equal(cost.usage.transport, 'modelark');
      assert.equal(cost.contract?.id, 'CT20260925128931');
      assert.equal(cost.contract?.discountPercent, 0, 'Seedance 2.5 must not inherit Fast/Mini discounts');
      assert.doesNotMatch(cost.sourceUrl, /byteplus_las/);
      const selected = reviewedModelArk(ctx);
      const quote = resolveCustomerTariffQuote({ context: ctx, ...selected, at })!;
      assert.equal(quote.quote.customerTotalCents, customer);
      assert.equal(quote.quote.breakdown.vendorSubtotalExactCents, resolution === '480p' ? 49.1904 : 110.592);
      assert.ok(seedanceInputTariffBasis(ctx).includedInputSeconds > 0);
    }
  }));

test('ModelArk Edit canonical billing requires an active matching reviewed tariff and preserves supplier provenance',
  { concurrency: false }, async () => withModelArk(async () => {
    const ctx = context(); const { state } = reviewedModelArk(ctx);
    const dependencies = { pricingPolicy: { loadOverrides: async () => ({ status: 'loaded' as const, rules: [] }) },
      loadCustomerTariffState: async () => state };
    const snapshot = await computeCanonicalBillingSnapshot(ctx, dependencies);
    assert.equal(snapshot.totalCents, 71);
    assert.equal(snapshot.meta?.providerCostListUsd, 0.491904);
    await assert.rejects(computeCanonicalBillingSnapshot(ctx, { ...dependencies,
      loadCustomerTariffState: async () => ({ ...state, active: false }) }), /active.*Edit.*tariff/i);
    const cell = state.versionedCells[0]!;
    const lasPrice = { kind: 'unit_components' as const, rounding: 'up' as const, components: [{ id: 'retail', rounding: 'none' as const,
      flatCents: 123.018, terms: [{ unit: 'input_video_seconds', centsPerUnit: 30.7545, includedUnits: 0 }] }] };
    await assert.rejects(computeCanonicalBillingSnapshot(ctx, { ...dependencies,
      loadCustomerTariffState: async () => ({ ...state, versionedCells: [{ ...cell, price: lasPrice }] }) }), /reviewed.*ModelArk.*tariff/i);
  }));

test('a ModelArk Edit selection refuses LAS tariff authoring and binds the public transport fact to release evidence',
  { concurrency: false }, async () => withModelArk(() => {
    assert.throws(() => prepareReviewedSeedanceLasPrice(context()), /LAS.*selected|selected.*LAS/i);
    assert.throws(() => prepareSeedance25LasTariffRelease({ state: { status: 'loaded', active: true, revision: 1,
      databaseCells: [], versionedCells: [] }, at }), /LAS.*selected|selected.*LAS/i);
    assert.ok((LOCAL_TARIFF_FACTUAL_ENVIRONMENT_KEYS as readonly string[]).includes('SEEDANCE_2_5_EDIT_TRANSPORT'));
  }));

test('current ModelArk selection cannot reinterpret a recorded LAS completion', { concurrency: false }, async () => withModelArk(() => {
  const job = { engine_id: 'seedance-2-5', duration_sec: 4, has_audio: false,
    settings_snapshot: { byteplusTransport: 'las', byteplusInputVideoDurationSec: 4, inputMode: 'v2v' } } as never;
  assert.equal(buildBytePlusListCostBreakdown({ job, model: 'seedance25', resolution: '480p', aspectRatio: '16:9',
    usage: { totalTokens: 999999, completionTokens: 888888 } }).provider_cost_usd_list, 0.984144);
}));

test('the four proven ModelArk modes keep their cost when Edit transport changes', { concurrency: false }, async () => withModelArk(() => {
  for (const mode of ['t2v', 'i2v', 'ref2v', 'extend'] as const) {
    const ctx = { ...context(), mode, hasVideoInput: mode === 'ref2v' || mode === 'extend' };
    const modern = normalBytePlusSupplierCost(ctx, at);
    ENV.SEEDANCE_2_5_EDIT_TRANSPORT = 'las';
    const prior = normalBytePlusSupplierCost(ctx, at);
    ENV.SEEDANCE_2_5_EDIT_TRANSPORT = 'modelark';
    assert.deepEqual(modern, prior, mode);
  }
}));
