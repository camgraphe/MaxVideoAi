import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareVideoOperationTariffs } from '../frontend/server/pricing/video-operation-tariffs';

import { operationPolicy, operationIdentity, operationTariffState } from './helpers/video-operation-tariff-fixture';
test('missing-only proposal freezes 89 additions and preserves six exact Veo anchors', async () => {
  const state = operationTariffState(), before = structuredClone(state);
  const result = await prepareVideoOperationTariffs({ ...operationIdentity, state, policy: operationPolicy });
  assert.equal(result.cells.length, 89);
  assert.equal(result.cells.filter(cell => cell.price.kind === 'unit_bands').length, 13);
  assert.equal(result.cells.filter(cell => cell.price.kind === 'fixed').length, 76);
  assert.equal(result.sourceBindings.length, 6);
  assert.deepEqual(state, before);
  assert.deepEqual(result.cells.filter(cell => cell.selector.operation === 'luma-extend').map(cell => cell.price),
    [20,39,156].map(customerCents => ({ kind: 'fixed', customerCents })));
  assert.ok(result.cells.every(cell => cell.selector.durationSec !== '8' || cell.selector.engineId !== 'veo-3-1'));
  assert.equal(result.activationReady, false);
  await assert.rejects(prepareVideoOperationTariffs({ ...operationIdentity, state: { ...state, active: false }, policy: operationPolicy }), /active/i);
  await assert.rejects(prepareVideoOperationTariffs({ ...operationIdentity, state: { ...state, databaseCells: [...state.databaseCells, result.cells[0]] }, policy: operationPolicy }), /existing/i);
  await assert.rejects(prepareVideoOperationTariffs({ ...operationIdentity, state, policy: { ...operationPolicy,
    rules: [{ ...operationPolicy.rules[0], marginPercent: .31 }] } }), /policy/i);
});

test('all 89 additions require an active initialized exact tariff, including newly admitted Veo durations', async () => {
  const {videoOperationInitializationScenarios}=await import('../frontend/server/pricing/video-operation-tariffs');
  const {computeCanonicalBillingSnapshot}=await import('../frontend/server/pricing/quote-billing');
  for(const scenario of videoOperationInitializationScenarios())for(const active of [false,true]) {
    await assert.rejects(computeCanonicalBillingSnapshot(scenario.context,{pricingPolicy:{loadOverrides:async()=>operationPolicy},
      loadCustomerTariffState:async()=>({...operationTariffState(),active,databaseCells:[]})}),undefined,`${scenario.id}:${active}`);
  }
});
