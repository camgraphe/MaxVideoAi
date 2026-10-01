import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { buildManualTariffCoverageScenario, collectEffectiveCustomerTariffBaseline } from '../frontend/lib/pricing-audit/manual-tariff-coverage';
import { computeCanonicalBillingSnapshot } from '../frontend/server/pricing/quote-billing';
import { auditReviewedCustomerTariffSeed } from '../frontend/server/pricing/customer-tariff-reviewed-seed';
import { readFileSync } from 'node:fs';

const policy = { status: 'loaded' as const, rules: [{ id: 'default', marginPercent: 0.3, marginFlatCents: 0,
  surchargeAudioPercent: 0.2, surchargeUpscalePercent: 0.5, currency: 'USD' }] };
const rulesHash = createHash('sha256').update(JSON.stringify(policy.rules)).digest('hex');
const scenarios = [
  { engine: getFalEngineById('wan-3')!.engine, mode: 'v2v' as const, resolution: '720p', durationSec: 5, inputVideoDurationSec: 3.25 },
  { engine: getFalEngineById('wan-3')!.engine, mode: 'v2v' as const, resolution: '720p', durationSec: 5, inputVideoDurationSec: 4.75 },
  { engine: getFalEngineById('ltx-2-5-fast')!.engine, mode: 'a2v' as const, resolution: '1080p', durationSec: 5, inputAudioDurationSec: 9.25 },
  { engine: getFalEngineById('gemini-omni-flash')!.engine, mode: 'retake' as const, resolution: '720p', durationSec: 5, inheritedDurationSec: 4.75 },
  { engine: getFalEngineById('minimax-h3-max')!.engine, mode: 'ref2v' as const, resolution: '768P', durationSec: 5, referenceTokenBudget: 4097 },
].map(context => buildManualTariffCoverageScenario(context, 'fixture'));
const gaps = [
  { modelId: 'wan-3', reason: 'v2v: fractional input video duration needs a continuous unit tariff' },
  { modelId: 'ltx-2-5-fast', reason: 'a2v: open input audio duration needs a continuous unit tariff' },
  { modelId: 'gemini-omni-flash', reason: 'retake: open input video duration needs a continuous unit tariff' },
  { modelId: 'minimax-h3-max', reason: 'ref2v: unbounded reference token budget needs a continuous unit tariff' },
  { modelId: 'wan-3', reason: 'v2v: unrelated unreviewed control' },
];
async function input() {
  const baseline = await collectEffectiveCustomerTariffBaseline({ at: '2026-09-30T12:00:00Z', registryHash: 'reviewed-registry',
    databaseIdentity: 'private-test', scenarios, quote: row => computeCanonicalBillingSnapshot(row.context,
      { pricingPolicy: { loadOverrides: async () => policy } }) });
  return { baseline: { ...baseline, databaseRulesHash: rulesHash }, scenarios, registryHash: baseline.registryHash, coverageGaps: gaps, policy };
}

test('read-only candidate collapses reviewed continuous classes with full-domain guards and zero captured cent deltas', async () => {
  const audit = await auditReviewedCustomerTariffSeed(await input());
  assert.equal(audit.cells.length, 4);
  assert.equal(audit.reviewedContinuousClasses.length, 4);
  assert.ok(audit.reviewedContinuousClasses.every(item => item.domain.minimumGrossCents >= 0));
  assert.equal(audit.checkedScenarios, 5);
  assert.deepEqual(audit.remainingCoverageGaps, gaps.slice(4));
  assert.equal(audit.activationReady, false, 'a partial read-only certificate cannot authorize activation');
  assert.ok(audit.cells.some(cell => cell.price.kind === 'unit_bands'));
});

test('changed policies, registry or captured cents reject the candidate instead of weakening the certificate', async () => {
  const original = await input();
  await assert.rejects(auditReviewedCustomerTariffSeed({ ...original, baseline: { ...original.baseline, databaseRulesHash: 'stale' } }), /policy/i);
  await assert.rejects(auditReviewedCustomerTariffSeed({ ...original, registryHash: 'changed' }), /registry/i);
  const rows = original.baseline.rows.map((row, index) => index ? row : { ...row, customerCents: row.customerCents + 1 });
  await assert.rejects(auditReviewedCustomerTariffSeed({ ...original, baseline: { ...original.baseline, rows } }), /parity/i);
});

test('seed audit shares the continuous compiler with admin and has no database writes or activation owner', () => {
  const source = readFileSync('frontend/server/pricing/customer-tariff-reviewed-seed.ts', 'utf8');
  assert.match(source, /compileCurrentContinuousTariffPrice/);
  assert.match(source, /validateCurrentContinuousTariffDomain/);
  assert.doesNotMatch(source, /pricing-admin|withDbTransaction|INSERT INTO|UPDATE app_|activateCustomerTariffs/);
  const admin = readFileSync('frontend/server/pricing-admin/continuous-input-tariff.ts', 'utf8');
  assert.match(admin, /compileCurrentContinuousTariffPrice/);
});

test('an existing below-reference fixed price remains explicit and blocks settlement acceptance without fabricated cost', async () => {
  const scenario = buildManualTariffCoverageScenario({ engine: getFalEngineById('gpt-image-2-5-flare')!.engine,
    mode: 'i2i', resolution: '1024x1024', durationSec: 1, quality: 'medium', referenceImageCount: 1 }, 'fixed-loss');
  const baseline = await collectEffectiveCustomerTariffBaseline({ at: '2026-09-30T12:00:00Z', registryHash: 'reviewed-registry',
    databaseIdentity: 'private-test', scenarios: [scenario], quote: row => computeCanonicalBillingSnapshot(row.context,
      { pricingPolicy: { loadOverrides: async () => policy } }) });
  const audit = await auditReviewedCustomerTariffSeed({ baseline: { ...baseline, databaseRulesHash: rulesHash },
    scenarios: [scenario], registryHash: baseline.registryHash, coverageGaps: [], policy });
  assert.equal(audit.settlementGuardFailures.length, 1);
  assert.equal(audit.quotedScenarios, 0);
  assert.ok(audit.settlementGuardFailures[0].referenceCeilCents > audit.settlementGuardFailures[0].customerCents);
  assert.equal(audit.activationReady, false);
});

async function referenceFloorInput() {
  const floorScenarios = [
    ...['gpt-image-2-5-flare', 'gpt-image-2-5-sunburst'].map(id =>
      buildManualTariffCoverageScenario({ engine: getFalEngineById(id)!.engine, mode: 'i2i',
        resolution: '1024x1024', durationSec: 1, quality: 'medium', referenceImageCount: 1 }, 'approved-floor')),
    buildManualTariffCoverageScenario({ engine: getFalEngineById('gpt-image-2-5-flare')!.engine, mode: 't2i',
      resolution: '1024x1024', durationSec: 1, quality: 'medium' }, 'unchanged'),
  ];
  const baseline = await collectEffectiveCustomerTariffBaseline({ at: '2026-09-30T12:00:00Z', registryHash: 'reviewed-registry',
    databaseIdentity: 'private-test', scenarios: floorScenarios, quote: row => computeCanonicalBillingSnapshot(row.context,
      { pricingPolicy: { loadOverrides: async () => policy } }) });
  return { baseline: { ...baseline, databaseRulesHash: rulesHash }, scenarios: floorScenarios,
    registryHash: baseline.registryHash, coverageGaps: [], policy,
    approvedGptImage25ReferenceFloor: { capturedAt: baseline.at, registryHash: baseline.registryHash, databaseRulesHash: rulesHash,
      databaseIdentity: baseline.databaseIdentity!,
      changes: floorScenarios.slice(0, 2).map(row => ({ scenarioId: row.id, currentCustomerCents: 2, proposedCustomerCents: 3 })) } };
}

test('explicit approved reference floors quote at the supplier ceiling without repricing other cells or mutating the baseline', async () => {
  const request = await referenceFloorInput();
  const original = JSON.stringify(request.baseline);
  const audit = await auditReviewedCustomerTariffSeed(request);
  assert.equal(audit.settlementGuardFailures.length, 0);
  assert.equal(audit.quotedScenarios, 3);
  const result = audit as typeof audit & { approvedPriceChanges: Array<{ currentCustomerCents: number; proposedCustomerCents: number }> };
  assert.deepEqual(result.approvedPriceChanges.map(row => [row.currentCustomerCents, row.proposedCustomerCents]), [[2, 3], [2, 3]]);
  assert.deepEqual(audit.cells.map(cell => cell.price.kind === 'fixed' ? cell.price.customerCents : null), [3, 3, 2]);
  assert.equal(JSON.stringify(request.baseline), original);
  assert.equal(audit.activationReady, false);
});

test('reference-floor approval is bound to captured prices and rejects stale evidence, duplicate changes or increases beyond the approved cent', async () => {
  const original = await referenceFloorInput();
  const approval = original.approvedGptImage25ReferenceFloor;
  for (const changed of [
    { ...approval, capturedAt: '2026-09-29T12:00:00Z' },
    { ...approval, registryHash: 'changed' },
    { ...approval, databaseRulesHash: 'changed' },
    { ...approval, databaseIdentity: 'another-database' },
    { ...approval, changes: [...approval.changes, approval.changes[0]] },
    { ...approval, changes: approval.changes.map(row => ({ ...row, currentCustomerCents: 1 })) },
    { ...approval, changes: approval.changes.map(row => ({ ...row, proposedCustomerCents: 4 })) },
    { ...approval, changes: [{ scenarioId: original.scenarios[2].id, currentCustomerCents: 2, proposedCustomerCents: 3 }] },
  ]) await assert.rejects(auditReviewedCustomerTariffSeed({ ...original, approvedGptImage25ReferenceFloor: changed }), /approved.*reference.*floor/i);
});
