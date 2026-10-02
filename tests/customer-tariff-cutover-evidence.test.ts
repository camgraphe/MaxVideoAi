import assert from 'node:assert/strict';
import test from 'node:test';
import { collectCustomerTariffCutoverCheckpoints, cutoverDigest, assertCustomerTariffCutoverRelease,
  projectInitialCustomerTariffCutoverCells,type CustomerTariffCutoverRelease } from '../frontend/server/pricing/customer-tariff-cutover-evidence';

test('cutover derives all ordinary, workflow and real input duration checkpoints with unique identities', () => {
  const cases = collectCustomerTariffCutoverCheckpoints();
  assert.equal(cases.filter(row => row.kind === 'ordinary').length, 20122);
  assert.equal(cases.filter(row => row.kind === 'local_workflow').length, 324);
  assert.equal(cases.filter(row => row.kind === 'input_stress').length, 6372);
  assert.equal(new Set(cases.map(row => row.key)).size, cases.length);
  assert.ok(cases.some(row => row.kind === 'input_stress' && row.scenario.context.inputVideoDurationSec === 30));
});

test('initial projection archives obsolete no-duration Seedance staging and refuses unrelated unused prices', () => {
  const cases = collectCustomerTariffCutoverCheckpoints();
  const pika = cases.find(row => row.scenario.modelId === 'pika-text-to-video')!.scenario.selector;
  const video = cases.find(row => row.scenario.modelId === 'seedance-2-0-mini' && row.scenario.selector.billingInputType === 'video_input')!.scenario.selector;
  const { inputVideoDurationSec: _duration,...old } = video;
  const rows: CustomerTariffCutoverRelease['cells'] = [
    { id: 'current',selector: pika,price: { kind: 'fixed',customerCents: 26 },currency: 'USD' },
    { id: 'obsolete',selector: old,price: { kind: 'fixed',customerCents: 57 },currency: 'USD' },
  ];
  const result = projectInitialCustomerTariffCutoverCells(rows);
  assert.deepEqual(result.cells,[rows[0]]);
  assert.deepEqual(result.archivedLegacyCells,[rows[1]]);
  assert.deepEqual(rows.map(row => row.id),['current','obsolete']);
  assert.throws(() => projectInitialCustomerTariffCutoverCells([{ ...rows[0],selector: { engineId: 'unknown' } }]), /unknown unused/i);
});

test('a fingerprint of a reduced inventory, expired capture or local provenance cannot certify production', t => {
  const capturedAt = Date.now();
  t.mock.timers.enable({ apis: ['Date'], now: capturedAt });
  const cases = collectCustomerTariffCutoverCheckpoints();
  const body = { schemaVersion: 1, evidenceKind: 'isolated_operation_rehearsal', activationReady: false,
    capturedAt: new Date().toISOString(), bindings: { databaseIdentity: 'a'.repeat(64), commercialHash: 'b'.repeat(64),
      codeRevision: 'c'.repeat(40), registryHash: 'd'.repeat(64), factualEnvironmentHash: 'e'.repeat(64) },
    deployedSource: { codeRevision: 'f'.repeat(40), deploymentId: 'local-fixture' },
    cells: [], checkpoints: cases.slice(0, 1).map(row => ({ key: row.key, beforeCents: 30, customerCents: 31, currency: 'USD' })),
    approvedChanges: [] };
  const release = { ...body, fingerprint: cutoverDigest(body) } as CustomerTariffCutoverRelease;
  assert.throws(() => assertCustomerTariffCutoverRelease(release, release.fingerprint, 'rehearsal'), /complete.*coverage/i);
  t.mock.timers.tick(16 * 60_000);
  assert.throws(() => assertCustomerTariffCutoverRelease(release, release.fingerprint, 'rehearsal'), /capture expired/i);
  t.mock.timers.setTime(capturedAt);
  assert.throws(() => assertCustomerTariffCutoverRelease(release, release.fingerprint, 'rehearsal'), /complete.*coverage/i);
  assert.throws(() => assertCustomerTariffCutoverRelease(release, release.fingerprint, 'production'), /production.*provenance/i);
});
