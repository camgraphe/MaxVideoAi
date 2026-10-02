import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { startDisposablePostgres } from './helpers/disposable-postgres';
import { withDbTransaction } from '../frontend/src/lib/db';
import { ENV } from '../frontend/src/lib/env';
import { loadPricingPolicyOverridesWithExecutor } from '../frontend/src/lib/pricing-rule-store';
import { collectSellableManualTariffCoverage, collectEffectiveCustomerTariffBaseline } from '../frontend/lib/pricing-audit/manual-tariff-coverage';
import { continuousInputTariffSelector } from '../frontend/src/lib/pricing-manual-scenario';
import { auditReviewedCustomerTariffSeed } from '../frontend/server/pricing/customer-tariff-reviewed-seed';
import { prepareSeedanceWorkflowTariffSeed } from '../frontend/server/pricing/seedance-workflow-tariffs';
import { computeCanonicalBillingSnapshot } from '../frontend/server/pricing/quote-billing';
import { collectCustomerTariffCutoverCheckpoints, cutoverDigest, type CustomerTariffCutoverRelease,
  type CutoverApprovedChange } from '../frontend/server/pricing/customer-tariff-cutover-evidence';
import { captureCustomerTariffCutoverBindings, activateInitialCustomerTariffGrid,
  rollbackInitialCustomerTariffGrid, withPricingCutoverTransaction } from '../frontend/server/pricing/customer-tariff-cutover';
import { pricingCutoverTarget } from '../frontend/server/pricing/cutover-target';

const actor = '11111111-1111-4111-8111-111111111111';
const key = (value: object) => JSON.stringify(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
const digest = (value: string) => createHash('sha256').update(value).digest('hex');

test('initial cutover is atomic, validates the actual reader, and rollback preserves all financial history', async t => {
  const db = await startDisposablePostgres('initial-pricing-cutover');
  const previous = { DATABASE_URL: process.env.DATABASE_URL, NODE_ENV: process.env.NODE_ENV, PRICING_SANDBOX: process.env.PRICING_SANDBOX };
  const routes = { SEEDANCE_2_PROVIDER: ENV.SEEDANCE_2_PROVIDER, SEEDANCE_FAST_PROVIDER: ENV.SEEDANCE_FAST_PROVIDER,
    SEEDANCE_2_5_PROVIDER: ENV.SEEDANCE_2_5_PROVIDER, SEEDANCE_2_5_BYTEPLUS_ENABLED: ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED };
  Object.assign(process.env, { DATABASE_URL: db.databaseUrl, NODE_ENV: 'development', PRICING_SANDBOX: '1' });
  Object.assign(ENV, { SEEDANCE_2_PROVIDER: 'byteplus_modelark', SEEDANCE_FAST_PROVIDER: 'byteplus_modelark',
    SEEDANCE_2_5_PROVIDER: 'byteplus_modelark', SEEDANCE_2_5_BYTEPLUS_ENABLED: 'true' });
  const target = pricingCutoverTarget({ DATABASE_URL: db.databaseUrl });
  const transaction = <T>(work: Parameters<typeof withDbTransaction<T>>[0]) => withDbTransaction(work, { pool: db.pool });
  try {
    await db.pool.query(`CREATE TABLE app_pricing_rules (id text PRIMARY KEY, engine_id text, mode text, resolution text,
      margin_percent numeric, margin_flat_cents integer, surcharge_audio_percent numeric, surcharge_upscale_percent numeric,
      currency text, compatibility_profile text, vendor_account_id text, effective_from timestamptz, updated_at timestamptz, updated_by uuid);
      INSERT INTO app_pricing_rules (id,margin_percent,margin_flat_cents,surcharge_audio_percent,surcharge_upscale_percent,currency)
      VALUES ('default',.3,0,.2,.5,'USD');
      CREATE TABLE user_roles (user_id uuid PRIMARY KEY,role text NOT NULL);
      INSERT INTO user_roles VALUES ('${actor}','admin');
      CREATE TABLE app_billing_products (product_key text PRIMARY KEY,surface text,label text,currency text,unit_kind text,unit_price_cents integer,active boolean,metadata jsonb);
      INSERT INTO app_billing_products VALUES ('historic-product','toolbox','Historic product','USD','run',8,true,'{}');
      CREATE TABLE historical_paid_snapshots (id text PRIMARY KEY,snapshot jsonb);
      INSERT INTO historical_paid_snapshots VALUES ('paid-quote','{"totalCents":13,"rule":"old"}');`);
    for (const name of ['08_admin_controls.sql','09_engine_settings.sql','27_pricing_admin_cockpit.sql','54_customer_tariff_cells.sql',
      '55_customer_tariff_versions.sql','58_customer_tariff_bulk_interval_lock.sql','61_customer_tariff_cutover_events.sql']) {
      await db.pool.query(readFileSync(`neon/migrations/${name}`, 'utf8'));
    }
    const bindings = await transaction(e => captureCustomerTariffCutoverBindings(e, target.databaseIdentity));
    const policy = await transaction(loadPricingPolicyOverridesWithExecutor);
    assert.equal(policy.status, 'loaded');
    if (policy.status !== 'loaded') throw new Error('Fixture policy unavailable');
    const coverage = collectSellableManualTariffCoverage();
    const inactive = { status: 'loaded' as const, active: false, revision: 0, databaseCells: [], versionedCells: [] };
    const quoteLegacy = (scenario: typeof coverage.scenarios[number]) => computeCanonicalBillingSnapshot(scenario.context,
      { pricingPolicy: { loadOverrides: async () => policy }, loadCustomerTariffState: async () => inactive });
    const baseline = await collectEffectiveCustomerTariffBaseline({ at: new Date().toISOString(), registryHash: bindings.registryHash,
      databaseIdentity: bindings.databaseIdentity, scenarios: coverage.scenarios, quote: quoteLegacy });
    const captured = { ...baseline, databaseRulesHash: digest(JSON.stringify([...policy.rules].sort((a,b) => a.id.localeCompare(b.id)))) };
    const input = { baseline: captured, scenarios: coverage.scenarios, registryHash: bindings.registryHash, coverageGaps: coverage.gaps,
      policy, approvedSeedanceMarginPolicy: 'preserve_positive_variant_margin' as const };
    const first = await auditReviewedCustomerTariffSeed(input);
    const audited = await auditReviewedCustomerTariffSeed({ ...input, approvedGptImage25ReferenceFloor: {
      capturedAt: baseline.at, registryHash: bindings.registryHash, databaseRulesHash: captured.databaseRulesHash, databaseIdentity: bindings.databaseIdentity,
      changes: first.settlementGuardFailures.map(row => ({ scenarioId: row.scenarioId, currentCustomerCents: row.customerCents,
        proposedCustomerCents: row.referenceCeilCents })) } });
    assert.equal(audited.settlementGuardFailures.length, 0);
    t.diagnostic('Complete reviewed fixture seed prepared.');
    const active = { ...inactive, active: true, revision: 1, databaseCells: audited.cells };
    const workflow = await prepareSeedanceWorkflowTariffSeed({ normalScenarios: coverage.scenarios, state: active, policy });
    const cells = [...audited.cells, ...workflow.cells];
    const indexed = new Map(cells.map(cell => [key(cell.selector),cell]));
    const checkpoints: CustomerTariffCutoverRelease['checkpoints'] = [];
    const approvedChanges: CutoverApprovedChange[] = [];
    for (const point of collectCustomerTariffCutoverCheckpoints()) {
      const continuous = continuousInputTariffSelector(point.scenario.selector);
      const cell = indexed.get(key(point.scenario.selector)) ?? (continuous ? indexed.get(key(continuous)) : undefined);
      assert.ok(cell, point.key);
      const snapshot = await computeCanonicalBillingSnapshot(point.scenario.context, { pricingPolicy: { loadOverrides: async () => policy },
        loadCustomerTariffState: async () => ({ ...active, databaseCells: [cell] }) });
      const beforeCents = point.kind === 'local_workflow' ? null : (await quoteLegacy(point.scenario)).totalCents;
      checkpoints.push({ key: point.key,beforeCents,customerCents: snapshot.totalCents,currency: snapshot.currency });
      if (beforeCents !== null && beforeCents !== snapshot.totalCents) approvedChanges.push({ key: point.key,beforeCents,customerCents: snapshot.totalCents,
        reason: ['gpt-image-2-5-flare','gpt-image-2-5-sunburst'].includes(point.scenario.modelId) ? 'gpt_reference_floor' : 'seedance_proportional' });
    }
    const body = { schemaVersion: 1 as const, evidenceKind: 'isolated_operation_rehearsal' as const, activationReady: false as const,
      capturedAt: new Date().toISOString(), bindings, deployedSource: { codeRevision: bindings.codeRevision,deploymentId: 'fixture' },
      cells: cells.map(({ id,selector,price,currency }) => ({ id,selector,price,currency })),checkpoints,approvedChanges };
    const release = { ...body,fingerprint: cutoverDigest(body) };
    t.diagnostic('All 26,818 fixture checkpoint amounts prepared.');
    const cutover = <T>(work: Parameters<typeof withDbTransaction<T>>[0]) => withPricingCutoverTransaction({ DATABASE_URL: db.databaseUrl },'rehearsal',e => work(e,undefined as never));
    const run = (candidate = release, fingerprint = candidate.fingerprint) => cutover(e => activateInitialCustomerTariffGrid(e,
      { release: candidate,fingerprint,target,actorId: actor,mode: 'rehearsal' }));
    await assert.rejects(run(release,'stale'), /stale/i);
    const altered = structuredClone(release);
    altered.cells[0].price = { kind: 'fixed',customerCents: 1 };
    await assert.rejects(run(altered), /integrity/i);
    const wrongQuote = structuredClone(release);
    const pika = wrongQuote.checkpoints.find(row => row.key.startsWith('ordinary:engineId=pika-text-to-video'))!;
    pika.customerCents++;
    wrongQuote.approvedChanges.push({ key: pika.key,beforeCents: pika.beforeCents!,customerCents: pika.customerCents,reason: 'seedance_proportional' });
    const { fingerprint: _wrong, ...wrongBody } = wrongQuote;
    wrongQuote.fingerprint = cutoverDigest(wrongBody);
    await assert.rejects(run(wrongQuote), /outside.*policy/i);
    await db.pool.query("UPDATE app_billing_products SET unit_price_cents=9");
    await assert.rejects(run(), /commercial.*changed/i);
    await db.pool.query("UPDATE app_billing_products SET unit_price_cents=8");
    const readerMismatch = structuredClone(release);
    const pikaCell = readerMismatch.cells.find(row => row.selector.engineId === 'pika-text-to-video')!;
    assert.equal(pikaCell.price.kind,'fixed');
    if (pikaCell.price.kind !== 'fixed') throw new Error('Fixture Pika must be fixed');
    pikaCell.price.customerCents++;
    const { fingerprint: _reader, ...readerBody } = readerMismatch;
    readerMismatch.fingerprint = cutoverDigest(readerBody);
    await assert.rejects(run(readerMismatch), /canonical.*quote.*changed/i);
    assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM app_customer_tariff_cells')).rows[0].n,0);
    await assert.rejects(cutover(async e => { await activateInitialCustomerTariffGrid(e,{ release,fingerprint: release.fingerprint,target,actorId: actor,mode: 'rehearsal' });
      throw new Error('FAIL_AFTER_FULL_ACTIVATION'); }), /FAIL_AFTER_FULL_ACTIVATION/);
    assert.deepEqual((await db.pool.query('SELECT revision,active FROM app_customer_tariff_state')).rows,[{ revision: '0',active: false }]);
    assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM app_customer_tariff_cutover_events')).rows[0].n,0);
    const applied = await run();
    assert.equal(applied.revision,1);
    assert.equal(applied.checkedQuotes,26818);
    assert.equal(applied.candidateCells,14991);
    t.diagnostic('Actual reader activation accepted before commit.');
    await assert.rejects(run(), /initial.*empty|revision/i);
    await assert.rejects(db.pool.query('DELETE FROM app_customer_tariff_cutover_events'), /immutable/i);
    await db.pool.query('UPDATE app_customer_tariff_state SET revision=2');
    const rollback = () => cutover(e => rollbackInitialCustomerTariffGrid(e,{ eventId: applied.eventId,
      fingerprint: release.fingerprint,target,actorId: actor,mode: 'rehearsal' }));
    await assert.rejects(rollback(), /edited|revision/i);
    await db.pool.query('UPDATE app_customer_tariff_state SET revision=1');
    assert.equal((await rollback()).revision,2);
    assert.deepEqual((await db.pool.query('SELECT revision,active FROM app_customer_tariff_state')).rows,[{ revision: '2',active: false }]);
    assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM app_customer_tariff_cells')).rows[0].n,14991);
    assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM app_customer_tariff_cutover_events')).rows[0].n,2);
    assert.deepEqual((await db.pool.query('SELECT snapshot FROM historical_paid_snapshots')).rows,[{ snapshot: { totalCents: 13,rule: 'old' } }]);
    assert.equal((await db.pool.query('SELECT unit_price_cents FROM app_billing_products')).rows[0].unit_price_cents,8);
    await assert.rejects(rollback(), /edited|revision/i);
  } finally {
    await db.cleanup();
    Object.assign(ENV,routes);
    for (const [name,value] of Object.entries(previous)) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
  }
});
