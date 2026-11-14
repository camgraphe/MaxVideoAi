import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateManualTariffPrice } from '../packages/pricing/src/manual-tariff-price';
import { prepareSeedance25CommercialTariffs } from '../frontend/server/pricing/seedance25-commercial-tariffs';
import { computeCanonicalBillingSnapshot } from '../frontend/server/pricing/quote-billing';
import { ENV } from '../frontend/src/lib/env';

const at = '2026-11-13T12:00:00.000Z';
const standard = prepareSeedance25CommercialTariffs({ modelId: 'seedance-2-5', at, standardEditTransport: 'modelark' });
const flash = prepareSeedance25CommercialTariffs({ modelId: 'seedance-2-5-flash', at, standardEditTransport: 'modelark' });
const selected = (plan: typeof flash, mode: string, resolution: string, workflowStep?: string) => plan.scenarios.find(s =>
  s.context.mode === mode && s.context.resolution === resolution && s.context.durationSec === 5
  && s.context.aspectRatio === '16:9' && s.context.workflowStep === workflowStep)!;
const cents = (row: typeof flash.scenarios[number], seconds = 4) => evaluateManualTariffPrice(row.cell.price, { input_video_seconds: seconds }).customerTotalCents;

test('commercial proposal covers all 4,860 standard and 1,944 Flash classes without adding unsupported tiers', () => {
  assert.equal(standard.cells.length, 4860);
  assert.equal(flash.cells.length, 1944);
  assert.deepEqual(new Set(flash.cells.map(c => c.selector.resolution)), new Set(['480p', '720p']));
  assert.ok(flash.cells.every(c => !c.selector.workflowStep));
  assert.ok(standard.cells.filter(c => c.selector.workflowStep === 'draft').every(c => c.selector.resolution === '480p'));
  assert.ok(standard.cells.filter(c => c.selector.workflowStep === 'final').every(c => c.selector.resolution === '1080p'));
  assert.equal(flash.fingerprint, prepareSeedance25CommercialTariffs({ modelId: 'seedance-2-5-flash', at: '2026-11-14T00:00:00Z', standardEditTransport: 'modelark' }).fingerprint);
});

test('retail amounts apply the approved multipliers to unrounded LIST, then round once to cents', () => {
  assert.equal(cents(selected(standard, 't2v', '720p')), 232);
  assert.equal(cents(selected(standard, 't2v', '480p')), 103);
  assert.equal(cents(selected(standard, 't2v', '1080p', 'final')), 569);
  assert.equal(cents(selected(flash, 't2v', '720p')), 121);
  assert.equal(cents(selected(flash, 't2v', '480p')), 54);
  assert.equal(cents(selected(standard, 'v2v', '720p'), 4), 249);
  assert.equal(cents(selected(flash, 'v2v', '720p'), 4), 134);
  assert.equal(cents(selected(flash, 'v2v', '720p'), 4.25), 138);
  assert.equal(cents(selected(flash, 'extend', '720p'), 30), 521);
});

test('every open source tariff preserves its minimum plateau and exact fractional-second slope', () => {
  for (const plan of [standard, flash]) for (const row of plan.scenarios) {
    if (row.cell.price.kind !== 'unit_components') continue;
    const component = row.cell.price.components[0];
    const included = component.terms[0].includedUnits!;
    const base = row.supplierMinimumUsd * plan.multiplier * 100;
    const expected = (seconds: number) => Math.ceil(base + Math.max(0, seconds - included) * component.terms[0].centsPerUnit - 1e-9);
    for (const seconds of [0.001, 2, included, included + 0.001, 4.25, 14.999, 29.999, 30]) {
      assert.equal(cents(row, seconds), expected(seconds), JSON.stringify(row.cell.selector));
    }
  }
});

test('canonical billing uses the prepared cell and fails closed without an active Flash tariff', async () => {
  const saved = ENV.SEEDANCE_2_5_EDIT_TRANSPORT;
  ENV.SEEDANCE_2_5_EDIT_TRANSPORT = 'modelark';
  try {
    for (const plan of [standard, flash]) for (const mode of ['t2v', 'v2v']) {
      const row = selected(plan, mode, '720p');
      const context = { ...row.context, ...(mode === 'v2v' ? { inputVideoDurationSec: 4.25 } : {}) };
      const dependencies = { pricingPolicy: { loadOverrides: async () => ({ status: 'loaded' as const, rules: [] }) },
        loadCustomerTariffState: async () => ({ status: 'loaded' as const, revision: 4732, active: true, versionedCells: [], databaseCells: [row.cell] }) };
      const snapshot = await computeCanonicalBillingSnapshot(context, dependencies);
      assert.equal(snapshot.totalCents, cents(row, 4.25));
      assert.equal(snapshot.meta?.customerTariffRevision, 4732);
      if (plan === flash) await assert.rejects(computeCanonicalBillingSnapshot(context, { ...dependencies,
        loadCustomerTariffState: async () => ({ status: 'loaded', revision: 4732, active: false, versionedCells: [], databaseCells: [] }) }), /active reviewed|tariff/i);
    }
  } finally { ENV.SEEDANCE_2_5_EDIT_TRANSPORT = saved; }
});
