import assert from 'node:assert/strict';
import test from 'node:test';
import { collectCustomerTariffCutoverCheckpoints, cutoverDigest, assertCustomerTariffCutoverRelease,
  projectInitialCustomerTariffCutoverCells,type CustomerTariffCutoverRelease } from '../frontend/server/pricing/customer-tariff-cutover-evidence';
import { collectSellableManualTariffCoverage } from '../frontend/lib/pricing-audit/manual-tariff-coverage';
import { ENV } from '../frontend/src/lib/env';

test('cutover derives all ordinary, workflow and real input duration checkpoints with unique identities', () => {
  const cases = collectCustomerTariffCutoverCheckpoints();
  assert.equal(cases.filter(row => row.kind === 'ordinary' && row.scenario.modelId !== 'flux-3-max').length, 20158);
  assert.equal(cases.filter(row => row.scenario.modelId === 'flux-3-max').length, 128);
  assert.equal(cases.filter(row => row.kind === 'ordinary').length, 20286);
  assert.equal(cases.filter(row => row.kind === 'local_workflow').length, 324);
  assert.equal(cases.filter(row => row.kind === 'input_stress').length, 6372);
  assert.equal(cases.length, 26982);
  assert.equal(new Set(cases.map(row => row.key)).size, cases.length);
  const lumaModify = cases.filter(row => row.kind === 'ordinary' && row.scenario.modelId === 'luma-ray-3-2' && row.scenario.context.mode === 'v2v');
  assert.deepEqual([...new Set(lumaModify.map(row => row.scenario.context.durationSec))].sort((a, b) => a - b),
    Array.from({ length: 14 }, (_, index) => index + 5));
  assert.equal(cases.filter(row => row.currentStatus === 'unavailable').length, 486);
  assert.ok(cases.filter(row => row.currentStatus === 'unavailable').every(row => row.scenario.selector.engineId === 'seedance-2-5'
    && row.scenario.selector.mode === 'v2v' && row.scenario.selector.resolution === '1080p'));
  assert.ok(cases.some(row => row.kind === 'input_stress' && row.scenario.context.inputVideoDurationSec === 30));
});

test('transport coverage keeps every historical checkpoint and admits 1080p only for ModelArk normal Edit', () => {
  const previous = ENV.SEEDANCE_2_5_EDIT_TRANSPORT;
  try {
    ENV.SEEDANCE_2_5_EDIT_TRANSPORT = 'las';
    const las = collectCustomerTariffCutoverCheckpoints();
    assert.ok(collectSellableManualTariffCoverage({ modelId: 'seedance-2-5', mode: 'v2v' }).scenarios
      .every(s => s.context.resolution !== '1080p'));
    ENV.SEEDANCE_2_5_EDIT_TRANSPORT = 'modelark';
    const modelark = collectCustomerTariffCutoverCheckpoints();
    assert.deepEqual(modelark.map(row => row.key).sort(), las.map(row => row.key).sort());
    assert.equal(modelark.filter(row => row.currentStatus === 'unavailable').length, 0);
    assert.ok(collectSellableManualTariffCoverage({ modelId: 'seedance-2-5', mode: 'v2v' }).scenarios
      .some(s => s.context.resolution === '1080p'));
    assert.ok(modelark.filter(row => row.kind === 'local_workflow').every(row => row.scenario.context.mode === 't2v'),
      'The historical initializer must not author independent multimodal stage prices.');
  } finally {
    ENV.SEEDANCE_2_5_EDIT_TRANSPORT = previous;
  }
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
