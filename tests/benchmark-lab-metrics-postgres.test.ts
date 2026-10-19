import assert from 'node:assert/strict';
import test from 'node:test';
import { startDisposablePostgres } from './helpers/disposable-postgres';
import { fetchPublicBenchmarkLatency, type BenchmarkQuery } from '../frontend/server/benchmark-lab-metrics';
import { ADMIN_EXCLUDED_USER_IDS } from '../frontend/lib/admin/exclusions';
import type { FalEngineEntry } from '../frontend/src/config/falEngines';

const engines = [{ id: 'kling-3-pro', modelSlug: 'kling-3-pro',
  engine: { id: 'kling-3-pro', modes: ['t2v'] }, modes: [] }] as unknown as FalEngineEntry[];

test('public latency uses eligible immutable delivery samples and survives later job repairs', { timeout: 90_000 }, async (t) => {
  const db = await startDisposablePostgres('benchmark-delivery');
  t.after(() => db.cleanup());
  const queryFn: BenchmarkQuery = async (sql, params) => (await db.pool.query(sql, params ? [...params] : [])).rows;
  await db.pool.query(`
    CREATE TABLE app_jobs(job_id text PRIMARY KEY, engine_id text, user_id text, status text,
      surface text DEFAULT 'video', video_url text DEFAULT 'ready.mp4', created_at timestamptz, updated_at timestamptz);
    CREATE TABLE generation_timing_samples(job_id text PRIMARY KEY, engine_id text, started_at timestamptz,
      completed_at timestamptz, source text, provider_duration_ms double precision);
    INSERT INTO app_jobs
      SELECT 'valid-' || i, 'kling-3-pro', 'user-' || i % 5, 'completed', 'video', 'ready.mp4',
        NOW()-INTERVAL '1 day', NOW()-INTERVAL '1 hour' FROM generate_series(1,30) i;
    INSERT INTO generation_timing_samples
      SELECT job_id, engine_id, created_at, created_at + INTERVAL '2 minutes', 'job_completion', 5000 FROM app_jobs;
  `);
  const first = await fetchPublicBenchmarkLatency({ queryFn, databaseConfigured: true, engines });
  assert.equal(first.rows.length, 1);
  assert.equal(first.rows[0].medianDurationMs, 120_000, 'application delivery time, not mutable updates or provider-only execution');
  assert.equal(first.rows[0].p90DurationMs, 120_000);
  await db.pool.query("UPDATE app_jobs SET updated_at=NOW(),video_url='repaired.mp4'");
  assert.deepEqual(await fetchPublicBenchmarkLatency({ queryFn, databaseConfigured: true, engines }), first);

  // Completed jobs without trustworthy delivery evidence must not cross the threshold.
  await db.pool.query("DELETE FROM generation_timing_samples WHERE job_id='valid-30'");
  await db.pool.query(`INSERT INTO app_jobs
    SELECT 'unmeasured-' || i,'kling-3-pro','user-' || i % 5,'completed','video','ready.mp4',
      NOW()-INTERVAL '1 day',NOW() FROM generate_series(1,40) i;
    INSERT INTO generation_timing_samples
      SELECT job_id,engine_id,created_at,created_at+INTERVAL '10 minutes','provider_completion',NULL
      FROM app_jobs WHERE job_id LIKE 'unmeasured-%';`);
  assert.deepEqual((await fetchPublicBenchmarkLatency({ queryFn, databaseConfigured: true, engines })).rows, []);

  await db.pool.query(`INSERT INTO generation_timing_samples
    SELECT job_id,engine_id,created_at,created_at+INTERVAL '2 minutes','job_completion',NULL
    FROM app_jobs WHERE job_id='valid-30'`);
  // An administrator's traffic is excluded even when it would supply user five.
  await db.pool.query("UPDATE app_jobs SET user_id=$1 WHERE user_id='user-0'", [ADMIN_EXCLUDED_USER_IDS[0]]);
  assert.deepEqual((await fetchPublicBenchmarkLatency({ queryFn, databaseConfigured: true, engines })).rows, []);
  await db.pool.query("UPDATE app_jobs SET user_id='user-1' WHERE user_id=$1", [ADMIN_EXCLUDED_USER_IDS[0]]);
  assert.deepEqual((await fetchPublicBenchmarkLatency({ queryFn, databaseConfigured: true, engines })).rows, [], '30 samples but only four people');
  await db.pool.query("UPDATE app_jobs SET user_id='user-0' WHERE job_id='valid-30'");
  assert.equal((await fetchPublicBenchmarkLatency({ queryFn, databaseConfigured: true, engines })).rows.length, 1);

  await db.pool.query("UPDATE generation_timing_samples SET completed_at=NOW()-INTERVAL '31 days',started_at=NOW()-INTERVAL '32 days' WHERE job_id='valid-30'");
  assert.deepEqual((await fetchPublicBenchmarkLatency({ queryFn, databaseConfigured: true, engines })).rows, [], 'old delivery does not count toward the rolling window');
  await db.pool.query("UPDATE generation_timing_samples SET completed_at=NOW()+INTERVAL '1 day' WHERE job_id='valid-30'");
  assert.deepEqual((await fetchPublicBenchmarkLatency({ queryFn, databaseConfigured: true, engines })).rows, [], 'future delivery is invalid');
});
