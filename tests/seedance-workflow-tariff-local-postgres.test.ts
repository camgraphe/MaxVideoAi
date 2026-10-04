import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { collectSellableManualTariffCoverage } from '../frontend/lib/pricing-audit/manual-tariff-coverage';
import { prepareSeedanceWorkflowTariffSeed } from '../frontend/server/pricing/seedance-workflow-tariffs';
import { applyLocalSeedanceWorkflowTariffs } from '../frontend/server/pricing/apply-local-seedance-workflow-tariffs';
import { loadEffectiveCustomerTariffState } from '../frontend/server/pricing/customer-tariff-store';
import { loadPricingPolicyOverridesWithExecutor } from '../frontend/src/lib/pricing-rule-store';
import { getDb, withDbTransaction } from '../frontend/src/lib/db';
import { createPaidGenerationTestSchema, startDisposablePostgres } from './helpers/disposable-postgres';

test('workflow seed confirmation is local-only, stale-safe, audited and preserves all normal cells', { timeout: 90_000 }, async () => {
  const db = await startDisposablePostgres('seedance-local-tariffs');
  const keys = ['DATABASE_URL', 'NODE_ENV', 'PRICING_SANDBOX'] as const;
  const old = keys.map(key => process.env[key]);
  Object.assign(process.env, { DATABASE_URL: db.databaseUrl, NODE_ENV: 'development', PRICING_SANDBOX: '1' });
  try {
    await createPaidGenerationTestSchema(db.pool);
    await db.pool.query(`CREATE TABLE app_pricing_change_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), domain text,
      operation text, target_id text, actor_id uuid, previous_state jsonb, next_state jsonb, preview_summary jsonb,
      affected_scenario_ids jsonb, created_at timestamptz DEFAULT now())`);
    for (const migration of ['54_customer_tariff_cells.sql', '55_customer_tariff_versions.sql', '58_customer_tariff_bulk_interval_lock.sql']) {
      await db.pool.query(readFileSync(`neon/migrations/${migration}`, 'utf8'));
    }
    const normal = collectSellableManualTariffCoverage().scenarios.filter(s => s.modelId === 'seedance-2-5'
      && s.context.mode === 't2v' && ['480p', '1080p'].includes(s.context.resolution));
    const actorId = '11111111-1111-4111-8111-111111111111';
    for (const [index, s] of normal.entries()) await db.pool.query(`INSERT INTO app_customer_tariff_cells
      (id,selector_key,selector_json,price_json,currency,effective_from,revision,updated_by)
      VALUES ($1,$2,$3,'{"kind":"fixed","customerCents":9999}','USD','2026-09-28',4,$4)`,
      [`normal-${index}`, JSON.stringify(Object.entries(s.selector).sort(([a], [b]) => a.localeCompare(b))), s.selector, actorId]);
    await db.pool.query('UPDATE app_customer_tariff_state SET revision = 4, active = true');
    const prepared = await withDbTransaction(async executor => prepareSeedanceWorkflowTariffSeed({ normalScenarios: normal,
      state: await loadEffectiveCustomerTariffState(executor), policy: await loadPricingPolicyOverridesWithExecutor(executor) }));
    await assert.rejects(withDbTransaction(executor => applyLocalSeedanceWorkflowTariffs(executor, { actorId, fingerprint: 'stale' })), /review|stale|changed/i);
    assert.equal((await db.pool.query('SELECT count(*) FROM app_customer_tariff_cells')).rows[0].count, String(normal.length));
    const applied = await withDbTransaction(executor => applyLocalSeedanceWorkflowTariffs(executor, { actorId, fingerprint: prepared.fingerprint }));
    assert.equal(applied.insertedCells, normal.length);
    assert.equal((await db.pool.query("SELECT count(*) FROM app_customer_tariff_cells WHERE id LIKE 'normal-%' AND price_json->>'customerCents' = '9999'")).rows[0].count, String(normal.length));
    assert.equal((await db.pool.query('SELECT count(*) FROM app_pricing_change_events')).rows[0].count, '1');
    await assert.rejects(withDbTransaction(executor => applyLocalSeedanceWorkflowTariffs(executor, { actorId, fingerprint: prepared.fingerprint })), /review|stale|changed|exist/i);
    Object.assign(process.env, { NODE_ENV: 'production' });
    await assert.rejects(withDbTransaction(executor => applyLocalSeedanceWorkflowTariffs(executor, { actorId, fingerprint: prepared.fingerprint })), /local|development/i);
  } finally {
    await getDb().end().catch(() => undefined); await db.cleanup();
    keys.forEach((key, index) => { if (old[index] === undefined) delete process.env[key]; else process.env[key] = old[index]; });
  }
});
