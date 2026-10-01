import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { startDisposablePostgres } from './helpers/disposable-postgres';
import { getDb, withDbTransaction } from '../frontend/src/lib/db';
import { loadPricingPolicyOverridesWithExecutor } from '../frontend/src/lib/pricing-rule-store';
import { collectSellableManualTariffCoverage, collectEffectiveCustomerTariffBaseline } from '../frontend/lib/pricing-audit/manual-tariff-coverage';
import { computeCanonicalBillingSnapshot } from '../frontend/server/pricing/quote-billing';
import { prepareLocalCustomerTariffRelease, localTariffSourceStateHash } from '../frontend/server/pricing/customer-tariff-release-evidence';
import { activateLocalCustomerTariffs } from '../frontend/server/pricing/activate-local-customer-tariffs';
import { loadEffectiveCustomerTariffState, customerTariffsEnabledByCode } from '../frontend/server/pricing/customer-tariff-store';
import { continuousInputTariffSelector } from '../frontend/src/lib/pricing-manual-scenario';
import { previewPricingPolicyChange } from '../frontend/server/pricing-admin/policy-service';

const actor = '11111111-1111-4111-8111-111111111111';
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

test('atomic local cutover rejects stale certificates, preserves staged evidence and removes every model margin fallback', async () => {
  const db = await startDisposablePostgres('tariff-cutover');
  const before = { DATABASE_URL: process.env.DATABASE_URL, NODE_ENV: process.env.NODE_ENV, PRICING_SANDBOX: process.env.PRICING_SANDBOX };
  Object.assign(process.env, { DATABASE_URL: db.databaseUrl, NODE_ENV: 'development', PRICING_SANDBOX: '1' });
  try {
    await db.pool.query(`CREATE TABLE app_pricing_rules (id TEXT PRIMARY KEY, engine_id TEXT, mode TEXT, resolution TEXT,
      margin_percent NUMERIC, margin_flat_cents INTEGER, surcharge_audio_percent NUMERIC, surcharge_upscale_percent NUMERIC,
      currency TEXT, compatibility_profile TEXT, vendor_account_id TEXT, effective_from TIMESTAMPTZ, updated_at TIMESTAMPTZ, updated_by UUID);
      INSERT INTO app_pricing_rules (id, margin_percent, margin_flat_cents, surcharge_audio_percent, surcharge_upscale_percent, currency)
      VALUES ('default', .3, 0, .2, .5, 'USD');`);
    for (const migration of ['27_pricing_admin_cockpit.sql', '54_customer_tariff_cells.sql', '55_customer_tariff_versions.sql', '57_customer_tariff_local_activation_events.sql', '58_customer_tariff_bulk_interval_lock.sql']) {
      await db.pool.query(readFileSync(`neon/migrations/${migration}`, 'utf8'));
    }
    const executor = { async query<T>(sql: string, params?: ReadonlyArray<unknown>) { return (await db.pool.query<T>(sql, params)).rows; } };
    const policy = await loadPricingPolicyOverridesWithExecutor(executor);
    assert.equal(policy.status, 'loaded');
    if (policy.status !== 'loaded') return;
    const coverage = collectSellableManualTariffCoverage();
    const oldSelector = coverage.scenarios.find(row => row.modelId === 'pika-text-to-video')!.selector;
    await db.pool.query(`INSERT INTO app_customer_tariff_cells (id, selector_key, selector_json, price_json, currency, effective_from, revision, updated_by)
      VALUES ('old-staged-price', $1, $2::jsonb, '{"kind":"fixed","customerCents":7}'::jsonb, 'USD', '2026-09-01', 1, $3::uuid)`,
    [JSON.stringify(Object.entries(oldSelector).sort(([a],[b]) => a.localeCompare(b))), JSON.stringify(oldSelector), actor]);
    const registryHash = hash(readFileSync('frontend/config/model-registry.json', 'utf8'));
    const address = new URL(db.databaseUrl);
    const databaseIdentity = hash(`${address.hostname}|${address.pathname}|${address.username}`);
    const baseline = await collectEffectiveCustomerTariffBaseline({ at: new Date().toISOString(), registryHash, databaseIdentity,
      scenarios: coverage.scenarios, quote: s => computeCanonicalBillingSnapshot(s.context, { pricingPolicy: { loadOverrides: async () => policy } }) });
    const databaseRulesHash = hash(JSON.stringify([...policy.rules].sort((a,b) => a.id.localeCompare(b.id))));
    const state = (await db.pool.query('SELECT revision, active FROM app_customer_tariff_state WHERE singleton = TRUE')).rows[0];
    const staged = (await db.pool.query('SELECT id, selector_json, price_json, currency, effective_from, effective_until, revision FROM app_customer_tariff_cells ORDER BY id')).rows;
    const sourceTariffStateHash = localTariffSourceStateHash(state, staged, db.databaseUrl);
    // Mirror the actual preparation CLI, including its serialized provenance.
    const capture = { ...baseline, databaseRulesHash, source: 'isolated_local_repeatable_read_only', coverageGaps: coverage.gaps };
    const first = await prepareLocalCustomerTariffRelease({ baseline: capture, scenarios: coverage.scenarios, registryHash, coverageGaps: coverage.gaps,
      policy, sourceTariffRevision: 0, sourceTariffStateHash, codeRevision: 'test-code', factualEnvironmentHash: 'test-env' });
    assert.equal(first.report.settlementGuardFailures.length, 24);
    const approvedGptImage25ReferenceFloor = { capturedAt: baseline.at, registryHash, databaseRulesHash, databaseIdentity,
      changes: first.report.settlementGuardFailures.map(row => ({ scenarioId: row.scenarioId, currentCustomerCents: row.customerCents, proposedCustomerCents: row.referenceCeilCents })) };
    const release = await prepareLocalCustomerTariffRelease({ baseline: capture, scenarios: coverage.scenarios, registryHash, coverageGaps: coverage.gaps,
      policy, sourceTariffRevision: 0, sourceTariffStateHash, codeRevision: 'test-code', factualEnvironmentHash: 'test-env', approvedGptImage25ReferenceFloor });
    assert.equal(release.report.remainingCoverageGaps.length, 0);
    const run = (candidate = release, fingerprint = release.report.fingerprint, bindings = release.report.bindings) => withDbTransaction(e =>
      activateLocalCustomerTariffs(e, { release: candidate, fingerprint, currentBindings: bindings, actorId: actor }));
    await assert.rejects(run(release, 'old-browser'), /stale/i);
    await assert.rejects(run(first), /settlement|stale/i);
    for (const key of ['registryHash', 'codeRevision', 'databaseRulesHash'] as const) await assert.rejects(run(release, release.report.fingerprint,
      { ...release.report.bindings, [key]: 'changed' }), /changed/i);
    const altered = structuredClone(release);
    altered.seed.cells[0].price = { kind: 'fixed', customerCents: 1 };
    await assert.rejects(run(altered), /integrity/i);
    await db.pool.query('UPDATE app_customer_tariff_state SET revision = 1');
    await assert.rejects(run(), /state|revision/i);
    await db.pool.query('UPDATE app_customer_tariff_state SET revision = 0');
    const result = await run();
    assert.equal(result.revision, 1);
    assert.equal(customerTariffsEnabledByCode(), true);
    const active = await loadEffectiveCustomerTariffState();
    assert.equal(active.status, 'loaded');
    if (active.status !== 'loaded') return;
    assert.equal(active.active, true);
    await assert.rejects(previewPricingPolicyChange({ operation: 'update', targetId: 'default', rule: {
      id: 'default', currency: 'USD', marginPercent: .5, marginFlatCents: 0, surchargeAudioPercent: .2, surchargeUpscalePercent: .5,
    } }), /read.only/i);
    const archive = (await db.pool.query('SELECT previous_staged_cells FROM app_customer_tariff_local_activation_events')).rows[0].previous_staged_cells;
    assert.equal(archive.length, 1);
    assert.equal(archive[0].price_json.customerCents, 7);
    assert.ok(!active.databaseCells.some(cell => cell.id === 'old-staged-price'));
    const key = (value: object) => JSON.stringify(Object.entries(value).sort(([a],[b]) => a.localeCompare(b)));
    const cells = new Map(active.databaseCells.map(cell => [key(cell.selector), cell]));
    const expected = new Map(baseline.rows.map(row => [row.scenarioId, row.customerCents]));
    for (const change of approvedGptImage25ReferenceFloor.changes) expected.set(change.scenarioId, change.proposedCustomerCents);
    for (const scenario of coverage.scenarios) {
      const continuous = continuousInputTariffSelector(scenario.selector);
      const cell = cells.get(key(scenario.selector)) ?? (continuous ? cells.get(key(continuous)) : undefined);
      assert.ok(cell, scenario.id);
      const quote = await computeCanonicalBillingSnapshot(scenario.context, { pricingPolicy: { loadOverrides: async () => policy },
        loadCustomerTariffState: async () => ({ ...active, databaseCells: [cell] }) });
      assert.equal(quote.totalCents, expected.get(scenario.id), scenario.id);
      assert.equal(quote.meta?.pricingMode, 'manual_tariff');
    }
    assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM app_customer_tariff_local_activation_events')).rows[0].n, 1);
    await assert.rejects(db.pool.query('DELETE FROM app_customer_tariff_local_activation_events'), /immutable/i);
    await assert.rejects(run(), /active|state|revision/i);
  } finally {
    await getDb().end().catch(() => undefined);
    await db.cleanup();
    for (const [key,value] of Object.entries(before)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
