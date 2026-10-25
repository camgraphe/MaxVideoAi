import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareLumaExtendTariffProposal } from '../frontend/server/pricing/luma-extend-tariff-proposal';
import { computeCanonicalBillingSnapshot } from '../frontend/server/pricing/quote-billing';
import { getFalEngineById } from '../frontend/src/config/falEngines';
const policy = { status: 'loaded' as const, rules: [{ id: 'default', marginPercent: .3, marginFlatCents: 0,
  surchargeAudioPercent: 0, surchargeUpscalePercent: 0, currency: 'USD' }] };
const state = { status: 'loaded' as const, active: true, revision: 1798, databaseCells: [], versionedCells: [] };
test('Extend preparation uses canonical standard rounding for three distinct fixed block cells', async () => {
  const result = await prepareLumaExtendTariffProposal({state, policy});
  assert.equal(result.writes, false);
  assert.equal(result.activationReady, false);
  assert.deepEqual(result.proposals.map(p => p.price.customerCents), [20,39,156]);
  assert.deepEqual(result.proposals.map(p => p.supplierReferenceCents), [15,30,120]);
  assert.ok(result.proposals.every(p => p.selector.operation === 'luma-extend'));
  assert.notEqual(result.fingerprint,(await prepareLumaExtendTariffProposal({state:{...state, revision:1799},policy})).fingerprint);
  await assert.rejects(prepareLumaExtendTariffProposal({state:{...state,active:false},policy}));
});
test('missing Extend cells never fall back to Create customer prices or percentage calculation', async () => {
  await assert.rejects(computeCanonicalBillingSnapshot({engine:getFalEngineById('luma-ray-3-2')!.engine,
    mode:'extend',durationSec:5,resolution:'720p'}, {pricingPolicy:{loadOverrides:async()=>policy},loadCustomerTariffState:async()=>state}));
});
