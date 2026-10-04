import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { buildManualTariffCoverageScenario, collectEffectiveCustomerTariffBaseline } from '../frontend/lib/pricing-audit/manual-tariff-coverage';
import { computeCanonicalBillingSnapshot } from '../frontend/server/pricing/quote-billing';
import { prepareLocalCustomerTariffRelease, assertLocalCustomerTariffReleaseReady } from '../frontend/server/pricing/customer-tariff-release-evidence';

const policy = { status: 'loaded' as const, rules: [{ id: 'default', marginPercent: 0.3, marginFlatCents: 0,
  surchargeAudioPercent: 0.2, surchargeUpscalePercent: 0.5, currency: 'USD' }] };
const hash = createHash('sha256').update(JSON.stringify(policy.rules)).digest('hex');
async function fixture() {
  const scenarios = [buildManualTariffCoverageScenario({ engine: getFalEngineById('wan-3')!.engine,
    mode: 'v2v', resolution: '720p', durationSec: 5, inputVideoDurationSec: 3.25 }, 'fixture')];
  const baseline = await collectEffectiveCustomerTariffBaseline({ at: '2026-10-01T10:00:00Z',
    registryHash: 'registry', databaseIdentity: 'private-db', scenarios,
    quote: scenario => computeCanonicalBillingSnapshot(scenario.context, { pricingPolicy: { loadOverrides: async () => policy } }) });
  return { baseline: { ...baseline, databaseRulesHash: hash }, scenarios, registryHash: baseline.registryHash,
    coverageGaps: [
      { modelId: 'wan-3', reason: 'v2v: fractional input video duration needs a continuous unit tariff' },
      { modelId: 'lumaRay2', reason: 'v2v: nonnumeric auto or open duration requires a reviewed mapping' },
      { modelId: 'lumaRay2_flash', reason: 'v2v: nonnumeric auto or open duration requires a reviewed mapping' },
      { modelId: 'minimax-h3-max', reason: 'ref2v: unbounded reference token budget needs a continuous unit tariff' },
    ], policy, sourceTariffRevision: 3, sourceTariffStateHash: 'state-hash', codeRevision: 'code-hash', factualEnvironmentHash: 'env-hash' };
}

test('release evidence records accepted prices, complete candidate hashes and unresolved domains without authorizing activation', async () => {
  const input = await fixture();
  const release = await prepareLocalCustomerTariffRelease(input);
  assert.equal(release.seed.active, false);
  assert.equal(release.seed.cells.length, 1);
  assert.equal(release.seed.cells[0].source, 'versioned');
  assert.equal(release.report.evidenceEnvironment, 'isolated_local_sandbox');
  assert.equal(release.report.activationReady, false);
  assert.equal(release.report.localCoverageReady, false);
  assert.equal(release.report.checkedScenarios, 1);
  assert.equal(release.report.unchangedScenarios, 1);
  assert.equal(release.report.remainingCoverageGaps.length, 3);
  assert.equal(release.report.reviewedContinuousClasses.length, 1);
  assert.throws(() => assertLocalCustomerTariffReleaseReady(release, release.report.bindings), /coverage/i);
  assert.equal((await prepareLocalCustomerTariffRelease(input)).report.fingerprint, release.report.fingerprint);
});

test('a complete fixture is only local evidence and cannot survive changed registry, policy, code, state or candidate amounts', async () => {
  const input = await fixture();
  const release = await prepareLocalCustomerTariffRelease({ ...input, coverageGaps: input.coverageGaps.slice(0, 1) });
  assert.equal(release.report.localCoverageReady, true);
  assert.equal(release.report.activationReady, false, 'local evidence must never become production authorization');
  assert.doesNotThrow(() => assertLocalCustomerTariffReleaseReady(release, release.report.bindings));
  for (const key of ['registryHash', 'databaseRulesHash', 'databaseIdentity', 'sourceTariffStateHash', 'codeRevision', 'factualEnvironmentHash'] as const) {
    assert.throws(() => assertLocalCustomerTariffReleaseReady(release, { ...release.report.bindings, [key]: 'changed' }), /changed/i);
  }
  assert.throws(() => assertLocalCustomerTariffReleaseReady(release, { ...release.report.bindings, sourceTariffRevision: 4 }), /changed/i);
  const altered = structuredClone(release);
  altered.seed.cells[0].price = { kind: 'fixed', customerCents: 107 };
  assert.throws(() => assertLocalCustomerTariffReleaseReady(altered, release.report.bindings), /integrity/i);
  const fabricated = structuredClone(release);
  fabricated.report.checkedScenarios++;
  assert.throws(() => assertLocalCustomerTariffReleaseReady(fabricated, release.report.bindings), /integrity/i);
});

test('a one-cent mismatch, missing baseline, invalid revision or empty matrix cannot produce ready evidence', async () => {
  const input = await fixture();
  const rows = input.baseline.rows.map(row => ({ ...row, customerCents: row.customerCents + 1 }));
  await assert.rejects(prepareLocalCustomerTariffRelease({ ...input, baseline: { ...input.baseline, rows } }), /parity/i);
  await assert.rejects(prepareLocalCustomerTariffRelease({ ...input, baseline: { ...input.baseline, rows: [] } }), /coverage/i);
  await assert.rejects(prepareLocalCustomerTariffRelease({ ...input, sourceTariffRevision: -1 }), /revision/i);
  await assert.rejects(prepareLocalCustomerTariffRelease({ ...input, scenarios: [], baseline: { ...input.baseline, rows: [] } }), /coverage/i);
});

test('below-reference amounts are reported as rejected quotes and cannot be certified from copied customer cents', async () => {
  const input = await fixture();
  const scenario = buildManualTariffCoverageScenario({ engine: getFalEngineById('gpt-image-2-5-flare')!.engine,
    mode: 'i2i', resolution: '1024x1024', durationSec: 1, quality: 'medium', referenceImageCount: 1 }, 'loss');
  const baseline = await collectEffectiveCustomerTariffBaseline({ at: input.baseline.at, registryHash: 'registry',
    databaseIdentity: 'private-db', scenarios: [scenario], quote: row => computeCanonicalBillingSnapshot(row.context,
      { pricingPolicy: { loadOverrides: async () => policy } }) });
  const release = await prepareLocalCustomerTariffRelease({ ...input, baseline: { ...baseline, databaseRulesHash: hash },
    scenarios: [scenario], coverageGaps: [] });
  assert.equal(release.report.quotedScenarios, 0);
  assert.equal(release.report.settlementGuardFailures.length, 1);
  assert.equal(release.report.localCoverageReady, false);
  assert.throws(() => assertLocalCustomerTariffReleaseReady(release, release.report.bindings), /settlement/i);
});
