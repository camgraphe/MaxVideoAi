import assert from 'node:assert/strict';
import test from 'node:test';
import { localTariffReleaseConnection, refreshLocalReferenceFloorApproval, localTariffFactualEnvironment } from '../frontend/scripts/_lib/local-tariff-release-input';

test('release factual bindings include BytePlus route and region without credentials', () => {
  const env={ SEEDANCE_2_PROVIDER:'byteplus_modelark',BYTEPLUS_ARK_REGION:'ap-southeast-1',
    BYTEPLUS_ARK_API_KEY:'private',LUMARAY2_MODIFY_PER_SECOND_USD:'0.04' };
  const facts=localTariffFactualEnvironment(env);
  assert.deepEqual(facts,{ SEEDANCE_2_PROVIDER:'byteplus_modelark',BYTEPLUS_ARK_REGION:'ap-southeast-1',
    LUMARAY2_MODIFY_PER_SECOND_USD:'0.04' });
  assert.notDeepEqual(localTariffFactualEnvironment({ ...env,BYTEPLUS_ARK_REGION:'other' }),facts);
});

test('local release refuses remote, TCP-only and multiple-host connections before a database client is created', () => {
  const good = { PRICING_SANDBOX: '1', DATABASE_URL: 'postgresql://postgres@localhost/postgres?host=%2Ftmp%2Fmva%2Fsocket' };
  assert.equal(localTariffReleaseConnection(good), good.DATABASE_URL);
  for (const env of [
    { ...good, PRICING_SANDBOX: '0' },
    { ...good, DATABASE_URL: 'postgresql://postgres@remote.example/postgres?host=%2Ftmp%2Fmva%2Fsocket' },
    { ...good, DATABASE_URL: 'postgresql://postgres@localhost/postgres' },
    { ...good, DATABASE_URL: good.DATABASE_URL + '&host=remote.example' },
    { ...good, DATABASE_URL: good.DATABASE_URL + '&options=-c%20some_option' },
  ]) assert.throws(() => localTariffReleaseConnection(env), /isolated.*socket/i);
});

test('rebase carries only the explicit floor amounts into a fresh local capture with unchanged policy and database', () => {
  const approval = { capturedAt: '2026-09-30T12:00:00Z', registryHash: 'old-registry', databaseRulesHash: 'policy',
    databaseIdentity: 'local-db', changes: [{ scenarioId: 'same', currentCustomerCents: 2, proposedCustomerCents: 3 }] };
  const baseline = { at: '2026-10-01T12:00:00Z', registryHash: 'rebased-registry', databaseRulesHash: 'policy',
    databaseIdentity: 'local-db', rows: [{ scenarioId: 'same', customerCents: 2, currency: 'USD', policySource: 'database', ruleId: 'default' }], gaps: [] };
  const refreshed = refreshLocalReferenceFloorApproval(approval, baseline);
  assert.equal(refreshed.registryHash, baseline.registryHash);
  assert.equal(refreshed.capturedAt, baseline.at);
  assert.deepEqual(refreshed.changes, approval.changes);
  assert.equal(approval.registryHash, 'old-registry', 'stored approval remains historical evidence');
  for (const changed of [
    { ...baseline, databaseRulesHash: 'changed' }, { ...baseline, databaseIdentity: 'another-db' },
    { ...baseline, rows: [] }, { ...baseline, rows: baseline.rows.map(row => ({ ...row, customerCents: 3 })) },
    { ...baseline, at: '2026-09-29T12:00:00Z' },
  ]) assert.throws(() => refreshLocalReferenceFloorApproval(approval, changed), /approval/i);
});
