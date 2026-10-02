import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Pool } from 'pg';
import { collectPricingCutoverSchema, loadPricingCutoverMigrations,
  PRICING_CUTOVER_READ_ONLY_OPTIONS, pricingCutoverTarget } from '../frontend/scripts/_lib/pricing-cutover-schema';
import { withPricingCutoverReadOnlyClient } from '../frontend/scripts/_lib/pricing-cutover-client';
import { createPaidGenerationTestSchema, startDisposablePostgres } from './helpers/disposable-postgres';

test('read-only cutover inventory and exact migration replay preserve historical jobs, receipts and trial snapshots', async () => {
  const db = await startDisposablePostgres('pricing-cutover-rehearsal');
  try {
    const reader = new Pool({ connectionString: db.databaseUrl, options: PRICING_CUTOVER_READ_ONLY_OPTIONS });
    try {
      assert.equal((await reader.query("SELECT current_setting('default_transaction_read_only') AS ro")).rows[0].ro, 'on');
      await assert.rejects(reader.query('CREATE TABLE forbidden_startup_write (id int)'), /read.only/i);
    } finally { await reader.end(); }
    await createPaidGenerationTestSchema(db.pool);
    for (const path of ['27_pricing_admin_cockpit.sql', '31_mcp_trial_entitlements.sql']) {
      await db.pool.query(readFileSync(`neon/migrations/${path}`, 'utf8'));
    }
    await db.pool.query(`INSERT INTO app_jobs (job_id,user_id,engine_id,status,final_price_cents,pricing_snapshot,payment_status)
      VALUES ('historical-job','historical-owner','seedance-2-0-mini','completed',95,
        '{"totalCents":95,"supplierCostCents":10,"historical":true}', 'paid_wallet');
      INSERT INTO app_receipts (user_id,type,amount_cents,currency,job_id,pricing_snapshot)
      VALUES ('historical-owner','charge',95,'USD','historical-job','{"totalCents":95,"historical":true}');`);
    for (const [index, aspectRatio, providerCostCents] of [[1, '1:1', 10], [2, '16:9', 17]] as const) {
      const request = { schemaVersion: 1, surface: 'video', engineId: 'seedance-2-0-mini', mode: 't2v', prompt: 'Historical trial',
        settings: { durationSec: 5, resolution: '480p', aspectRatio, audio: false }, references: [], outputCount: 1 };
      const snapshot = { schemaVersion: 1, catalogRevision: 'historic-catalog', surface: 'video', engineId: request.engineId,
        membership: {}, canonicalPricing: { totalCents: 95, currency: 'USD' },
        funding: { kind: 'included_trial', customerChargeCents: 0, normalPriceCents: 95, providerCostCents } };
      await db.pool.query(`INSERT INTO mcp_generation_quotes
        (quote_id,user_id,request_json,request_hash,catalog_revision,pricing_snapshot,price_cents,currency,funding_mode,state,expires_at)
        VALUES ($1,'historical-owner',$2,$3,'historic-catalog',$4,0,'USD','trial','prepared',now()+interval '10 minutes')`,
      [`11111111-1111-4111-8111-${String(index).padStart(12, '0')}`, request, 'a'.repeat(64), snapshot]);
    }
    // Deployed migration 31 predates the extracted raster predicate. Reproduce
    // its old inline cost clause while retaining every other funding guard.
    const funding = (await db.pool.query(`SELECT pg_get_constraintdef(oid) AS definition
      FROM pg_constraint WHERE conrelid='public.mcp_generation_quotes'::regclass
      AND conname='mcp_generation_quotes_funding_shape'`)).rows[0].definition as string;
    const name = 'mcp_trial_provider_cost_matches_snapshot';
    let start = funding.indexOf(`${name}(`);
    assert.ok(start >= 0);
    const opening = start + name.length;
    let depth = 1, end = opening + 1;
    while (depth > 0 && end < funding.length) {
      if (funding[end] === '(') depth++;
      if (funding[end] === ')') depth--;
      end++;
    }
    assert.equal(depth, 0);
    if (funding.slice(start - 7, start) === 'public.') start -= 7;
    const inline = `((pricing_snapshot #>> '{funding,providerCostCents}')::numeric =
      CASE request_json #>> '{settings,aspectRatio}' WHEN '1:1' THEN 10
      WHEN '16:9' THEN 17 WHEN '9:16' THEN 17 ELSE NULL END)`;
    const historicalConstraint = funding.slice(0, start) + inline + funding.slice(end);
    await db.pool.query(`ALTER TABLE mcp_generation_quotes DROP CONSTRAINT mcp_generation_quotes_funding_shape;
      DROP FUNCTION public.mcp_trial_provider_cost_matches_snapshot(text,numeric);
      ALTER TABLE mcp_generation_quotes ADD CONSTRAINT mcp_generation_quotes_funding_shape ${historicalConstraint}`);
    const saved = async () => (await db.pool.query(`SELECT
      (SELECT jsonb_agg(to_jsonb(j) ORDER BY job_id) FROM app_jobs j) AS jobs,
      (SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM app_receipts r) AS receipts,
      (SELECT jsonb_agg(to_jsonb(q) ORDER BY quote_id) FROM mcp_generation_quotes q) AS quotes`)).rows[0];
    const original = await saved();
    const inventory = async () => {
      const client = await db.pool.connect();
      try {
        await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
        const result = await collectPricingCutoverSchema({ async query<T>(sql: string, params?: ReadonlyArray<unknown>) {
          return (await client.query<T>(sql, params)).rows;
        } });
        await assert.rejects(client.query('CREATE TABLE forbidden_inventory_write (id int)'), /read.only/i);
        return result;
      } finally { await client.query('ROLLBACK'); client.release(); }
    };
    const before = await inventory();
    assert.deepEqual(before.missingPrerequisites, []);
    assert.deepEqual(before.missingTrialFunctions, []);
    assert.equal(before.trialRasterPredicate, 'created_by_migration_60');
    assert.equal(before.missingCutoverTables.length, 7);
    assert.equal(before.activationReady, false);
    assert.equal(before.schemaReviewRequired, true);
    await assert.rejects(collectPricingCutoverSchema({ async query<T>(sql: string, params?: ReadonlyArray<unknown>) {
      return (await db.pool.query<T>(sql, params)).rows;
    } }), /repeatable-read, read-only/i);
    assert.deepEqual(await saved(), original, 'inventory does not touch application rows');

    const migrations = await loadPricingCutoverMigrations(process.cwd());
    for (let replay = 0; replay < 2; replay++) {
      for (const migration of migrations) {
        // Match the deployment owner: psql, error stop and one transaction per file.
        const result = spawnSync('psql', [db.databaseUrl, '--single-transaction', '-v', 'ON_ERROR_STOP=1', '-f', migration.path], { encoding: 'utf8' });
        assert.equal(result.status, 0, `${migration.path}: ${result.stderr}`);
      }
      assert.deepEqual(await saved(), original, 'replay never reprices historical rows');
      assert.deepEqual((await db.pool.query('SELECT revision, active FROM app_customer_tariff_state')).rows,
        [{ revision: '0', active: false }], 'schema migration does not activate tariffs');
    }
    const after = await inventory();
    assert.deepEqual(after.missingCutoverTables, []);
    assert.equal(after.trialRasterPredicate, 'present_requires_definition_review');
    assert.equal(after.activationReady, false, 'migrated schema alone cannot authorize a price cutover');
    assert.notEqual(after.schemaHash, before.schemaHash);
    assert.equal((await db.pool.query("SELECT to_regclass('public.forbidden_inventory_write') AS forbidden")).rows[0].forbidden, null);
    assert.equal((await db.pool.query("SELECT count(*)::int AS n FROM app_customer_tariff_cells")).rows[0].n, 0);
    const functions = (await db.pool.query(`SELECT
      mcp_trial_provider_cost_matches_snapshot('1:1', 10) AS historic,
      mcp_trial_provider_cost_matches_snapshot('1:1', 17) AS current,
      mcp_trial_provider_cost_matches_snapshot('1:1', 18) AS invalid`)).rows[0];
    assert.deepEqual(functions, { historic: true, current: true, invalid: false });
  } finally { await db.cleanup(); }
});

test('a terminated schema reader rejects controlled work instead of emitting an uncaught backend error or returning a report', async () => {
  const db = await startDisposablePostgres('pricing-cutover-disconnect');
  try {
    const target = pricingCutoverTarget({ DATABASE_URL: db.databaseUrl });
    let pid = 0;
    await assert.rejects(withPricingCutoverReadOnlyClient(target.config, async client => {
      pid = (await client.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      await db.pool.query('SELECT pg_terminate_backend($1)', [pid]);
      await new Promise(resolve => setTimeout(resolve, 30));
      return { mustNotPublish: true };
    }), /connection.*lost/i);
    assert.ok(pid > 0);
    assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM pg_stat_activity WHERE pid=$1', [pid])).rows[0].n, 0);
  } finally { await db.cleanup(); }
});
