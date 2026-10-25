import assert from 'node:assert/strict';
import test from 'node:test';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import type { TransactionQueryExecutor } from '../frontend/src/lib/db';
import type { CanonicalGenerationRequest } from '../frontend/src/server/agent-api/generation-types';
import { resolveReservedVideoTiming } from '../frontend/src/server/agent-api/video-generation-timing';
import { startDisposablePostgres } from './helpers/disposable-postgres';

test('optional timing reads preserve a writable reservation and use its transaction snapshot', { timeout: 90_000 }, async (t) => {
  const db = await startDisposablePostgres('agent-video-timing');
  const client = await db.pool.connect();
  t.after(async () => { client.release(); await db.cleanup(); });
  const executor = {
    async query<TRecord>(sql: string, params?: ReadonlyArray<unknown>) {
      return (await client.query(sql, params ? [...params] : [])).rows as TRecord[];
    },
  } as TransactionQueryExecutor;
  const engine = getFalEngineById('wan-3-prime')!.engine;
  const request: CanonicalGenerationRequest = {
    schemaVersion: 1, surface: 'video', engineId: engine.id, mode: 'v2v', prompt: 'Fixture',
    settings: { durationSec: 8, resolution: '480p', aspectRatio: '16:9' }, references: [], outputCount: 1,
  };

  await t.test('missing observations cannot abort an otherwise valid reservation', async () => {
    await client.query('CREATE TABLE reservation_probe (id integer)');
    await client.query('BEGIN');
    await client.query('INSERT INTO reservation_probe VALUES (1)');
    assert.deepEqual(await resolveReservedVideoTiming(engine, request, 8, executor), { etaSeconds: 28, etaLabel: '≈ 28s' });
    await client.query('INSERT INTO reservation_probe VALUES (2)');
    await client.query('COMMIT');
    assert.equal((await client.query('SELECT count(*)::int AS count FROM reservation_probe')).rows[0].count, 2);
  });

  await t.test('matching samples in the transaction supply the saved estimate', async () => {
    await client.query(`CREATE TABLE app_jobs (job_id text, settings_snapshot jsonb);
      CREATE TABLE generation_timing_samples (job_id text, engine_id text, mode text, duration_sec integer,
        resolution text, completed_at timestamptz, started_at timestamptz, provider_duration_ms integer)`);
    await client.query('BEGIN');
    await client.query(`INSERT INTO generation_timing_samples
      SELECT 'sample-' || i, 'wan-3-prime', 'v2v', 8, '480p', NOW(), NOW()-interval '95 seconds', 95000
      FROM generate_series(1,10) i`);
    assert.deepEqual(await resolveReservedVideoTiming(engine, request, 8, executor), { etaSeconds: 95, etaLabel: '≈ 1 min 35s' });
    await client.query('ROLLBACK');
  });
});
