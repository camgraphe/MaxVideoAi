import assert from 'node:assert/strict';
import test from 'node:test';

import { buildManualTariffScenario } from '../frontend/src/lib/pricing-manual-scenario.ts';
import { resolveCustomerTariffQuote } from '../frontend/server/pricing/resolve-customer-tariff.ts';
import { computeCanonicalBillingSnapshot } from '../frontend/server/pricing/quote-billing.ts';
import { getFalEngineById } from '../frontend/src/config/falEngines.ts';

const engine = getFalEngineById('wan-3')!.engine;
const context = { engine, mode: 'v2v' as const, durationSec: 5, resolution: '720p', aspectRatio: '16:9',
  inputVideoDurationSec: 3, hasVideoInput: true };
const facts = { engineId: 'wan-3', currency: 'USD', vendorSubtotalExactCents: 30, unit: 'sec', quantity: 8 };
const at = '2026-09-29T12:00:00.000Z';

test('manual selectors distinguish trusted input duration, media counts and output options', () => {
  const scenario = buildManualTariffScenario(context, facts);
  assert.equal(scenario.selector.inputVideoDurationSec, '3');
  assert.equal(scenario.quantities.input_video_seconds, 3);
  assert.notDeepEqual(buildManualTariffScenario({ ...context, inputVideoDurationSec: 4 }, facts).selector, scenario.selector);
  assert.notDeepEqual(buildManualTariffScenario({ ...context, aspectRatio: '9:16' }, facts).selector, scenario.selector);
  assert.notDeepEqual(buildManualTariffScenario({ ...context, referenceImageCount: 2 }, facts).selector, scenario.selector);
});

test('inactive state retains legacy path; active missing cell and outage fail closed', () => {
  assert.equal(resolveCustomerTariffQuote({ context, facts, at,
    state: { status: 'loaded', revision: 0, active: false, versionedCells: [], databaseCells: [] } }), null);
  assert.throws(() => resolveCustomerTariffQuote({ context, facts, at,
    state: { status: 'unavailable' } }), /unavailable/i);
  assert.throws(() => resolveCustomerTariffQuote({ context, facts, at,
    state: { status: 'loaded', revision: 1, active: true, versionedCells: [], databaseCells: [] } }), /No active manual tariff/);
});

test('active exact cell uses authored cents and exposes its revision', () => {
  const selector = buildManualTariffScenario(context, facts).selector;
  const quote = resolveCustomerTariffQuote({ context, facts, at,
    state: { status: 'loaded', revision: 4, active: true, versionedCells: [{
      id: 'wan-v2v', source: 'versioned', version: 1, selector, currency: 'USD', effectiveFrom: at,
      price: { kind: 'fixed', customerCents: 99 },
    }], databaseCells: [] } });
  assert.equal(quote?.quote.customerTotalCents, 99);
  assert.equal(quote?.revision, 4);
});

test('canonical billing uses the active exact tariff and never a neighboring percentage rule', async () => {
  const pricedContext = { ...context, mode: 't2v' as const, inputVideoDurationSec: undefined, hasVideoInput: false };
  const liveFacts = { ...facts, quantity: 5 };
  const selector = buildManualTariffScenario(pricedContext, liveFacts).selector;
  const snapshot = await computeCanonicalBillingSnapshot(pricedContext, {
    pricingPolicy: { loadOverrides: async () => ({ status: 'loaded', rules: [] }) },
    loadCustomerTariffState: async () => ({ status: 'loaded', active: true, revision: 17,
      versionedCells: [{ id: 'exact-override', source: 'versioned', version: 1, selector,
        currency: 'USD', effectiveFrom: '2026-09-28T00:00:00.000Z',
        price: { kind: 'fixed', customerCents: 999 } }], databaseCells: [] }),
  });
  assert.equal(snapshot.totalCents, 999);
  assert.equal(snapshot.meta?.customerTariffRevision, 17);
  assert.equal(snapshot.meta?.pricingPolicy && (snapshot.meta.pricingPolicy as { compatibilityProfile?: string }).compatibilityProfile, 'manual-tariff');
});
