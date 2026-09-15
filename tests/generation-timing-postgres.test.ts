import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { startDisposablePostgres, missingDisposablePostgresCommand } from './helpers/disposable-postgres';
import { fetchGenerationTimingMatrix } from '../frontend/server/generation-timing';
import { selectGenerationTiming } from '../frontend/lib/generation-timing';
import type { DurationQuery } from '../frontend/server/generate-metrics';

const migration = readFileSync('neon/migrations/45_generation_timing_samples.sql', 'utf8');
test('historical recovery and automatic completion feed exact means once, including new models', { timeout: 90_000 }, async (t) => {
  const missing = missingDisposablePostgresCommand();
  if (missing) return t.skip(`PostgreSQL unavailable: ${missing}`);
  const db = await startDisposablePostgres('generation-timing');
  t.after(() => db.cleanup());
  const queryFn: DurationQuery = async (sql, params) => (await db.pool.query(sql, params ? [...params] : [])).rows;
  await db.pool.query(`
    SET TIME ZONE 'UTC';
    CREATE TABLE app_jobs (id serial PRIMARY KEY, job_id text UNIQUE NOT NULL, engine_id text NOT NULL,
      provider text, surface text DEFAULT 'video', status text, video_url text, duration_sec integer,
      settings_snapshot jsonb, created_at timestamptz DEFAULT NOW(), updated_at timestamptz DEFAULT NOW());
    CREATE TABLE fal_queue_log (job_id text, status text, created_at timestamptz);
    CREATE TABLE provider_attempts (job_id integer, provider text, status text, finished_at timestamptz, response_snapshot jsonb);
    INSERT INTO app_jobs (job_id,engine_id,provider,status,video_url,duration_sec,settings_snapshot,created_at)
      SELECT 'history-' || i, 'unlisted-new-model', 'provider-a', 'completed', 'fixture.mp4', 5,
        '{"inputMode":"i2v","core":{"resolution":"720P"}}', NOW() - INTERVAL '3 days'
      FROM generate_series(1,10) i;
    INSERT INTO fal_queue_log SELECT job_id, 'completed', created_at + substring(job_id from 9)::int * INTERVAL '100 seconds' FROM app_jobs;
    INSERT INTO fal_queue_log SELECT job_id, 'poll:completed', created_at + INTERVAL '1 day' FROM app_jobs;
    INSERT INTO app_jobs (job_id,engine_id,provider,status,video_url,duration_sec,settings_snapshot,created_at)
      VALUES ('old-direct','unlisted-new-model','direct','completed','fixture.mp4',30,'{"inputMode":"t2v","core":{"resolution":"1080p"}}',NOW()-INTERVAL '180 days'),
        ('missing-evidence','unlisted-new-model','direct','completed','fixture.mp4',5,'{}',NOW()-INTERVAL '1 day'),
        ('failed','unlisted-new-model','direct','failed',NULL,5,'{}',NOW()-INTERVAL '1 day');
    INSERT INTO provider_attempts(job_id,provider,status,finished_at) SELECT id, provider, 'completed', created_at + INTERVAL '4 minutes' FROM app_jobs WHERE job_id = 'old-direct';
  `);
  await db.pool.query(`BEGIN; ${migration} COMMIT;`);
  await db.pool.query(readFileSync('neon/migrations/46_generation_provider_timing.sql', 'utf8'));
  const matrix = await fetchGenerationTimingMatrix({ databaseConfigured: true, queryFn });
  const selected = selectGenerationTiming(matrix['unlisted-new-model'], { mode: 'i2v', durationSec: 5, resolution: '720p' });
  assert.deepEqual(selected, { averageDurationMs: 550_000, sampleCount: 10 });
  const oldCell = matrix['unlisted-new-model'].find(c => c.durationSec === 30)!;
  assert.equal(oldCell.sampleCount, 1);
  assert.equal(oldCell.recentSampleCount, 0);
  assert.equal(oldCell.averageDurationMs, 240_000);
  assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM generation_timing_samples')).rows[0].n, 11);
  await db.pool.query(`BEGIN; ${migration} COMMIT;`);
  assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM generation_timing_samples')).rows[0].n, 11, 'migration replay is idempotent');
  await db.pool.query(`INSERT INTO app_jobs (job_id,engine_id,provider,status,duration_sec,settings_snapshot,created_at)
    VALUES ('live','unlisted-new-model','brand-new-provider','running',5,'{"inputMode":"i2v","core":{"resolution":"720p"}}',NOW()-INTERVAL '100 seconds');
    UPDATE app_jobs SET status='completed' WHERE job_id='live';`);
  assert.equal((await db.pool.query("SELECT count(*)::int AS n FROM generation_timing_samples WHERE job_id='live'")).rows[0].n, 0, 'no sample until output is available');
  await db.pool.query("UPDATE app_jobs SET video_url='ready.mp4' WHERE job_id='live'");
  const before = (await db.pool.query("SELECT * FROM generation_timing_samples WHERE job_id='live'")).rows[0];
  assert.equal(before.source, 'job_completion');
  const learned = await fetchGenerationTimingMatrix({ databaseConfigured: true, queryFn });
  const next = selectGenerationTiming(learned['unlisted-new-model'], { mode: 'i2v', durationSec: 5, resolution: '720p' })!;
  assert.equal(next.sampleCount, 11);
  assert.ok(Math.abs(next.averageDurationMs - 5_600_000 / 11) < 500);
  await db.pool.query("UPDATE app_jobs SET status='completed',video_url='repaired.mp4',updated_at=NOW() WHERE job_id IN ('live','missing-evidence')");
  assert.deepEqual((await db.pool.query("SELECT * FROM generation_timing_samples WHERE job_id='live'")).rows[0], before);
  assert.equal((await db.pool.query("SELECT count(*)::int AS n FROM generation_timing_samples WHERE job_id='missing-evidence'")).rows[0].n, 0);
  await db.pool.query(`INSERT INTO app_jobs(job_id,engine_id,status,surface,video_url,created_at)
    VALUES ('audio','audio-model','completed','audio','audio.mp3',NOW()-INTERVAL '1 minute');`);
  assert.equal((await db.pool.query("SELECT count(*)::int AS n FROM generation_timing_samples WHERE job_id='audio'")).rows[0].n, 0);
  const reader = await db.pool.connect();
  try {
    await reader.query('BEGIN READ ONLY');
    await fetchGenerationTimingMatrix({ databaseConfigured: true, queryFn: async (sql, params) => (await reader.query(sql, params ? [...params] : [])).rows });
    await reader.query('ROLLBACK');
  } finally { reader.release(); }
});

test('provider timestamps remove delayed discovery from estimates without rewriting delivery evidence', { timeout: 90_000 }, async (t) => {
  const missing = missingDisposablePostgresCommand();
  if (missing) return t.skip(`PostgreSQL unavailable: ${missing}`);
  const db = await startDisposablePostgres('provider-timing');
  t.after(() => db.cleanup());
  await db.pool.query(`CREATE TABLE app_jobs(id serial PRIMARY KEY, job_id text, engine_id text, provider text, surface text DEFAULT 'video',
    status text, video_url text, duration_sec integer, settings_snapshot jsonb, created_at timestamptz, updated_at timestamptz);
    CREATE TABLE fal_queue_log(job_id text,status text,created_at timestamptz);
    CREATE TABLE provider_attempts(job_id integer,provider text,status text,finished_at timestamptz,response_snapshot jsonb);
    INSERT INTO app_jobs(job_id,engine_id,provider,status,video_url,duration_sec,settings_snapshot,created_at)
      VALUES ('late','wan-3-prime','alibaba_model_studio','completed','ready.mp4',15,'{"mode":"t2v","settings":{"resolution":"1080P"}}',NOW()-INTERVAL '1 day');
    INSERT INTO provider_attempts SELECT id,provider,'completed',created_at+INTERVAL '38 minutes',
      '{"output":{"task_status":"SUCCEEDED","submit_time":"2026-09-14 05:48:31.899","end_time":"2026-09-14 05:52:01.429"}}'::jsonb FROM app_jobs;`);
  await db.pool.query(migration);
  const before = (await db.pool.query('SELECT started_at,completed_at,source FROM generation_timing_samples')).rows[0];
  const correction = readFileSync('neon/migrations/46_generation_provider_timing.sql', 'utf8');
  await db.pool.query(correction);
  await db.pool.query(correction);
  assert.deepEqual((await db.pool.query('SELECT started_at,completed_at,source FROM generation_timing_samples')).rows[0], before);
  const sample = (await db.pool.query('SELECT * FROM generation_timing_samples')).rows[0];
  assert.equal(sample.provider_duration_ms, 209530);
  assert.equal(sample.resolution, '1080p');
  const matrix = await fetchGenerationTimingMatrix({databaseConfigured: true, queryFn: async (sql, params) => (await db.pool.query(sql, params ? [...params] : [])).rows});
  assert.equal(selectGenerationTiming(matrix['wan-3-prime'], {mode:'t2v',durationSec:15,resolution:'1080p'})?.averageDurationMs, 209530);
  await db.pool.query(`INSERT INTO app_jobs(job_id,engine_id,provider,status,duration_sec,settings_snapshot,created_at)
    VALUES ('new','future-model','alibaba_model_studio','running',5,'{"mode":"t2v","settings":{"resolution":"720p"}}',NOW()-INTERVAL '10 minutes');
    UPDATE app_jobs SET status='completed',video_url='new.mp4' WHERE job_id='new';
    INSERT INTO provider_attempts SELECT id,provider,'completed',NOW(),'{"output":{"task_status":"SUCCEEDED","submit_time":"2026-09-14 05:48:00","end_time":"2026-09-14 05:51:00"}}'::jsonb FROM app_jobs WHERE job_id='new';`);
  assert.equal((await db.pool.query("SELECT provider_duration_ms FROM generation_timing_samples WHERE job_id='new'")).rows[0].provider_duration_ms, 180000);
  const invalid = (await db.pool.query(`SELECT generation_provider_duration_ms('alibaba_model_studio', '{"output":{"task_status":"SUCCEEDED","submit_time":"bad","end_time":"bad"}}') AS duration`)).rows[0];
  assert.equal(invalid.duration, null);
});
