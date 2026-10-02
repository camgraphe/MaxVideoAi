import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { startDisposablePostgres } from './helpers/disposable-postgres';
import { getDb, withDbTransaction } from '../frontend/src/lib/db';
import { collectSellableManualTariffCoverage } from '../frontend/lib/pricing-audit/manual-tariff-coverage';
import { loadEffectiveCustomerTariffState } from '../frontend/server/pricing/customer-tariff-store';
import { prepareSeedanceInputTariffSeed } from '../frontend/server/pricing/seedance-input-tariff-seed';
import { applyLocalSeedanceInputTariffs } from '../frontend/server/pricing/apply-local-seedance-input-tariffs';
import { ENV } from '../frontend/src/lib/env';

test('local seed is atomic, refuses stale review and TCP, and preserves unrelated and old tariffs', async () => {
  const db = await startDisposablePostgres('seedance-input-seed');
  const previous = { DATABASE_URL: process.env.DATABASE_URL, NODE_ENV: process.env.NODE_ENV, PRICING_SANDBOX: process.env.PRICING_SANDBOX };
  Object.assign(process.env,{ DATABASE_URL: db.databaseUrl, NODE_ENV: 'development', PRICING_SANDBOX: '1' });
  const oldProvider = ENV.SEEDANCE_2_PROVIDER; ENV.SEEDANCE_2_PROVIDER='byteplus_modelark';
  try {
    await db.pool.query(`CREATE TABLE app_pricing_rules (id TEXT PRIMARY KEY);
      CREATE TABLE app_pricing_change_events (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), domain TEXT NOT NULL,
        operation TEXT NOT NULL, target_id TEXT NOT NULL, actor_id UUID NOT NULL, previous_state JSONB, next_state JSONB,
        preview_summary JSONB NOT NULL, affected_scenario_ids JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`);
    await db.pool.query(readFileSync('neon/migrations/54_customer_tariff_cells.sql','utf8'));
    await db.pool.query(readFileSync('neon/migrations/55_customer_tariff_versions.sql','utf8'));
    const scenarios = [collectSellableManualTariffCoverage().scenarios.find(s => s.modelId==='seedance-2-0'
      && s.selector.mode==='ref2v' && s.selector.resolution==='480p' && s.selector.durationSec==='4'
      && s.selector.aspectRatio==='16:9' && s.selector.billingInputType==='video_input')!];
    const { inputVideoDurationSec: _, ...oldSelector } = scenarios[0].selector;
    const actorId='11111111-1111-4111-8111-111111111111';
    await db.pool.query(`INSERT INTO app_customer_tariff_cells
      (id,selector_key,selector_json,price_json,currency,effective_from,revision,updated_by)
      VALUES ('legacy-source',$1,$2::jsonb,'{"kind":"fixed","customerCents":68}','USD','2026-10-01',1,$3),
      ('unrelated','unrelated','{"engineId":"other"}','{"kind":"fixed","customerCents":100}','USD','2026-10-01',1,$3)`,
      [JSON.stringify(Object.entries(oldSelector).sort(([a],[b])=>a.localeCompare(b))),JSON.stringify(oldSelector),actorId]);
    await db.pool.query('UPDATE app_customer_tariff_state SET active=TRUE,revision=1');
    const prepare=()=>withDbTransaction(async executor => prepareSeedanceInputTariffSeed({ scenarios,
      state: await loadEffectiveCustomerTariffState(executor),at: new Date().toISOString() }));
    const prepared=await prepare();
    const apply=(fingerprint:string)=>withDbTransaction(executor=>applyLocalSeedanceInputTariffs(executor,{ actorId,fingerprint },scenarios));
    await assert.rejects(apply('stale'),/reviewed.*changed/i);
    assert.equal(Number((await db.pool.query('SELECT count(*) FROM app_customer_tariff_cells')).rows[0].count),2);
    await withDbTransaction(async executor => {
      process.env.DATABASE_URL='postgresql://postgres@localhost/postgres';
      try { await assert.rejects(applyLocalSeedanceInputTariffs(executor,{ actorId,fingerprint:prepared.fingerprint },scenarios),/isolated local/i); }
      finally { process.env.DATABASE_URL=db.databaseUrl; }
    });
    const result=await apply(prepared.fingerprint);
    assert.equal(result.insertedCells,1); assert.equal(result.revision,2);
    const old=await db.pool.query("SELECT price_json FROM app_customer_tariff_cells WHERE id IN ('legacy-source','unrelated') ORDER BY id");
    assert.deepEqual(old.rows.map(r=>r.price_json),[{ kind:'fixed',customerCents:68 },{ kind:'fixed',customerCents:100 }]);
    assert.equal(Number((await db.pool.query('SELECT count(*) FROM app_pricing_change_events')).rows[0].count),1);
    await assert.rejects(prepare(),/already exists/i);
  } finally {
    await getDb().end().catch(()=>undefined);await db.cleanup();ENV.SEEDANCE_2_PROVIDER=oldProvider;
    for(const [k,v] of Object.entries(previous)){if(v===undefined)delete process.env[k];else process.env[k]=v;}
  }
});
