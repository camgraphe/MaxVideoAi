import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { GET } from '../frontend/app/api/admin/routing/traffic/route';
import { loadRoutingTrafficSnapshot } from '../frontend/app/(core)/admin/routing/_lib/routing-traffic';
import { missingDisposablePostgresCommand, startDisposablePostgres } from './helpers/disposable-postgres';

test('the live traffic endpoint requires admin authentication and prevents shared caching', async () => {
  const response = await GET(new NextRequest('https://example.test/api/admin/routing/traffic', {
    headers: { 'x-maxvideoai-auth-mode': 'bearer' },
  }));
  assert.equal(response.status, 401);
  assert.match(response.headers.get('cache-control') ?? '', /private, no-store/);
  assert.equal('events' in await response.json(), false);
});

test('routing traffic returns recorded attempts, confirmed handoffs and acknowledged legacy owners from a bounded sample', async (t) => {
  const missing = missingDisposablePostgresCommand();
  if (missing) return t.skip(`local PostgreSQL command unavailable: ${missing}`);
  const database = await startDisposablePostgres('routing-traffic');
  t.after(() => database.cleanup());
  const execute = async <T>(sql: string, args?: readonly unknown[]): Promise<T[]> =>
    (await database.pool.query(sql, args ? [...args] : [])).rows;
  await execute(`CREATE TABLE app_jobs (
    id bigserial PRIMARY KEY, engine_id text, surface text, provider text, provider_job_id text,
    status text, created_at timestamptz DEFAULT NOW(), updated_at timestamptz DEFAULT NOW()
  )`);
  await execute(readFileSync('neon/migrations/21_provider_attempts.sql', 'utf8'));

  const empty = await loadRoutingTrafficSnapshot(execute);
  assert.equal(empty.sampledJobs, 0);
  assert.deepEqual(empty.events, []);

  await execute(`INSERT INTO app_jobs(engine_id,surface,provider,provider_job_id,status) VALUES
    ('wan-3-prime','video','fal','private-remote-task','completed'),
    ('seedance-2-5','video','byteplus_modelark','another-private-task','completed'),
    ('reserved','video','fal',NULL,'pending'),
    ('not-video','image','fal','ignored','completed'),
    ('stale','video','fal','ignored','completed');
    UPDATE app_jobs SET created_at = NOW() - interval '61 minutes' WHERE engine_id = 'stale';
    INSERT INTO provider_attempts(job_id,attempt_index,provider,status,request_snapshot) VALUES
      (1,1,'alibaba_model_studio','failed','{"prompt":"private-prompt"}'),
      (1,2,'fal','completed',null),
      (1,3,'fal','polling_stalled',null);
    UPDATE provider_attempts SET fallback_to_attempt_id = 2 WHERE id = 1;`);

  const snapshot = await loadRoutingTrafficSnapshot(execute);
  assert.equal(snapshot.sampledJobs, 3);
  assert.equal(snapshot.truncated, false);
  assert.deepEqual(snapshot.events.map(event => event.stage).sort(), ['attempt', 'fallback', 'job', 'primary']);
  assert.equal(snapshot.events.find(event => event.stage === 'fallback')?.previousProvider, 'alibaba_model_studio');
  const fal = snapshot.routes.find(route => route.provider === 'fal');
  assert.deepEqual(fal && [fal.attempts, fal.jobsOnly, fal.fallbacks, fal.uncertain], [2, 0, 1, 1]);
  assert.equal(snapshot.routes.find(route => route.provider === 'byteplus_modelark')?.jobsOnly, 1);
  assert.equal(snapshot.routes.find(route => route.provider === 'alibaba_model_studio')?.failed, 1);
  assert.doesNotMatch(JSON.stringify(snapshot), /private|reserved|not-video|stale/);
  assert.deepEqual((await loadRoutingTrafficSnapshot(execute)).events, snapshot.events);

  await execute(`INSERT INTO provider_attempts(job_id,attempt_index,provider,status)
    SELECT 1, n, 'fal','accepted' FROM generate_series(4,11) AS n`);
  assert.equal((await loadRoutingTrafficSnapshot(execute)).truncated, true);

  await execute(`INSERT INTO app_jobs(engine_id,surface,provider,provider_job_id,status)
    SELECT 'large-cohort','video','fal','remote-' || n,'completed' FROM generate_series(1,513) AS n`);
  const capped = await loadRoutingTrafficSnapshot(execute);
  assert.equal(capped.sampledJobs, 512);
  assert.equal(capped.truncated, true);
  assert.equal(capped.routes[0]?.jobsOnly, 512);
  assert.equal(capped.events.length, 48);
});
