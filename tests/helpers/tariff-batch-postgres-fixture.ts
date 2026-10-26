import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { getDb } from '../../frontend/src/lib/db';
import { startDisposablePostgres, createPaidGenerationTestSchema } from './disposable-postgres';
const source = 'a'.repeat(40);
export async function withTariffBatchFixture(work: (f: { db: Awaited<ReturnType<typeof startDisposablePostgres>>; beforeQuery?: (sql: string, client: PoolClient) => Promise<void>; afterQuery?: (sql: string) => Promise<void> }) => Promise<void>) {
  const db = await startDisposablePostgres('tariff-batch');
  const url = new URL(db.databaseUrl);
  assert.equal(url.hostname, 'localhost'); assert.ok(url.searchParams.get('host')?.startsWith('/'));
  const env = { ...process.env };
  Object.assign(process.env, { DATABASE_URL: db.databaseUrl, NODE_ENV: 'development', PRICING_SANDBOX: '1',
    PRICING_ADMIN_BATCHES_ENABLED: '1', PRICING_ADMIN_BATCHES_SOURCE_ID: source, PRICING_ADMIN_BATCHES_TARGET_ID: randomUUID() });
  delete process.env.VERCEL; delete process.env.VERCEL_ENV;
  const pool = getDb(), f: Parameters<typeof work>[0] = { db };
  pool.on('connect', client => { const query = client.query; client.query = (async function (this: PoolClient, ...args: unknown[]) {
    const sql = typeof args[0] === 'string' ? args[0] : (args[0] as { text: string }).text;
    await f.beforeQuery?.(sql, client); const result = await Reflect.apply(query, this, args); await f.afterQuery?.(sql); return result;
  }) as typeof client.query; });
  try {
    assert.match((await db.pool.query('SHOW server_version')).rows[0].server_version, /^17\./);
    await createPaidGenerationTestSchema(db.pool);
    for (const file of ['27_pricing_admin_cockpit.sql', '54_customer_tariff_cells.sql', '55_customer_tariff_versions.sql', '81_customer_tariff_batches.sql']) {
      await db.pool.query(readFileSync(`neon/migrations/${file}`, 'utf8'));
    }
    assert.equal((await db.pool.query('SELECT enabled FROM app_tariff_batch_control')).rows[0].enabled, false);
    await db.pool.query('UPDATE app_tariff_batch_control SET enabled = TRUE, source_id = $1, target_id = $2', [source, process.env.PRICING_ADMIN_BATCHES_TARGET_ID]);
    await db.pool.query('UPDATE app_customer_tariff_state SET active = TRUE');
    await work(f);
  } finally { await pool.end(); await db.cleanup(); for (const key of Object.keys(process.env)) if (!(key in env)) delete process.env[key]; Object.assign(process.env, env); }
}
