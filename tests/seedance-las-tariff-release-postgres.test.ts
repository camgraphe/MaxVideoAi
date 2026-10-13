import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { startDisposablePostgres } from './helpers/disposable-postgres';
import { getDb } from '../frontend/src/lib/db';
import { ENV } from '../frontend/src/lib/env';
import { collectSellableManualTariffCoverage } from '../frontend/lib/pricing-audit/manual-tariff-coverage';
import { continuousInputTariffSelector } from '../frontend/src/lib/pricing-manual-scenario';
import { customerTariffCellId } from '../frontend/server/pricing/customer-tariff-seed';
import { previewSeedance25LasTariffRelease, confirmSeedance25LasTariffRelease } from '../frontend/server/pricing-admin/seedance-las-tariff-release';

test('LAS correction rejects stale review and appends all prices atomically, preserving history and unrelated prices', async () => {
  const db = await startDisposablePostgres('las-tariff-release');
  const originalUrl = process.env.DATABASE_URL;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalSandbox = process.env.PRICING_SANDBOX;
  const originalFlag = ENV.SEEDANCE_2_5_LAS_ENABLED;
  process.env.DATABASE_URL = db.databaseUrl;
  process.env.NODE_ENV = 'development';
  process.env.PRICING_SANDBOX = '1';
  ENV.SEEDANCE_2_5_LAS_ENABLED = 'false';
  const actor = '11111111-1111-4111-8111-111111111111';
  try {
    await db.pool.query(`CREATE TABLE app_pricing_change_events (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), domain TEXT NOT NULL,
      operation TEXT NOT NULL, target_id TEXT NOT NULL, actor_id UUID NOT NULL, previous_state JSONB, next_state JSONB,
      preview_summary JSONB NOT NULL, affected_scenario_ids JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`);
    await db.pool.query(readFileSync('neon/migrations/54_customer_tariff_cells.sql', 'utf8'));
    await db.pool.query(readFileSync('neon/migrations/55_customer_tariff_versions.sql', 'utf8'));
    const price = { kind: 'unit_components', rounding: 'up', components: [{ id: 'retail', rounding: 'none', flatCents: 62,
      terms: [{ unit: 'input_video_seconds', centsPerUnit: 8.857077007717129, includedUnits: 3.0000520426749935 }] }] };
    for (const s of collectSellableManualTariffCoverage({ modelId: 'seedance-2-5', mode: 'v2v' }).scenarios) {
      const selector = continuousInputTariffSelector(s.selector)!;
      const id = customerTariffCellId(Object.entries(selector).map(([k,v]) => `${k}=${encodeURIComponent(v)}`).join('|'));
      await db.pool.query(`INSERT INTO app_customer_tariff_cells
        (id,selector_key,selector_json,price_json,currency,effective_from,revision,updated_by)
        VALUES ($1,$2,$3,$4,'USD','2026-10-02',1,$5)`, [id, JSON.stringify(Object.entries(selector).sort(([a],[b]) => a.localeCompare(b))), selector, price, actor]);
    }
    await db.pool.query(`INSERT INTO app_customer_tariff_cells
      (id,selector_key,selector_json,price_json,currency,effective_from,revision,updated_by)
      VALUES ('untouched','untouched','{"engineId":"seedance-2-5","mode":"i2v"}','{"kind":"fixed","customerCents":77}','USD','2026-10-02',1,$1)`, [actor]);
    await db.pool.query('UPDATE app_customer_tariff_state SET active=TRUE,revision=1');
    const review = await previewSeedance25LasTariffRelease();
    assert.equal(review.cells.length, 324);
    await assert.rejects(confirmSeedance25LasTariffRelease('0'.repeat(64), actor, () => undefined), /changed/i);
    assert.equal((await db.pool.query('SELECT revision FROM app_customer_tariff_state')).rows[0].revision, '1');
    // A failure after prior writes must unwind the price grid, closed versions,
    // revision and event together; retry requires an unchanged fresh review.
    await db.pool.query(`CREATE FUNCTION reject_las_price() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.selector_json->>'resolution'='720p' THEN RAISE EXCEPTION 'injected persistence failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER reject_las_price BEFORE UPDATE ON app_customer_tariff_cells FOR EACH ROW EXECUTE FUNCTION reject_las_price();`);
    await assert.rejects(confirmSeedance25LasTariffRelease(review.fingerprint, actor, () => undefined), /injected/);
    assert.equal((await db.pool.query('SELECT count(*) FROM app_customer_tariff_cell_versions')).rows[0].count, '0');
    assert.equal((await db.pool.query('SELECT revision FROM app_customer_tariff_state')).rows[0].revision, '1');
    await db.pool.query('DROP TRIGGER reject_las_price ON app_customer_tariff_cells');
    const applied = await confirmSeedance25LasTariffRelease(review.fingerprint, actor, () => undefined);
    assert.equal(applied.cellCount, 324);
    assert.equal(applied.revision, 325);
    assert.equal(applied.executionActivated, false);
    assert.equal((await db.pool.query('SELECT count(*) FROM app_customer_tariff_cell_versions')).rows[0].count, '324');
    const event = (await db.pool.query('SELECT previous_state,next_state FROM app_pricing_change_events')).rows[0];
    assert.equal(event.previous_state.length, 324);
    assert.equal(event.next_state.length, 324);
    const current = (await db.pool.query("SELECT price_json FROM app_customer_tariff_cells WHERE selector_json->>'mode'='v2v' AND selector_json->>'resolution'='480p' AND selector_json->>'durationSec'='4' LIMIT 1")).rows[0].price_json;
    assert.equal(current.components[0].flatCents, 123.018);
    assert.equal(current.components[0].terms[0].centsPerUnit, 30.7545);
    assert.equal(current.components[0].terms[0].includedUnits, 0);
    assert.deepEqual((await db.pool.query("SELECT price_json FROM app_customer_tariff_cells WHERE id='untouched'")).rows[0].price_json,
      { kind: 'fixed', customerCents: 77 });
    await assert.rejects(confirmSeedance25LasTariffRelease(review.fingerprint, actor, () => undefined), /changed/i);
  } finally {
    await getDb().end().catch(() => undefined);
    await db.cleanup();
    if (originalUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = originalUrl;
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = originalNodeEnv;
    if (originalSandbox === undefined) delete process.env.PRICING_SANDBOX; else process.env.PRICING_SANDBOX = originalSandbox;
    ENV.SEEDANCE_2_5_LAS_ENABLED = originalFlag;
  }
});
