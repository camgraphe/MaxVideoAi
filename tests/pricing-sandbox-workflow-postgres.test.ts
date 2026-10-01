import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { Pool } from 'pg';
import * as sandbox from '../frontend/scripts/_lib/pricing-sandbox';
import { startDisposablePostgres } from './helpers/disposable-postgres';

const migrate = (sandbox as typeof sandbox & {
  migratePricingSandbox?: (pool: Pool, root: string) => Promise<void>;
}).migratePricingSandbox;

test('pricing sandbox initialization supports a completed Draft and final on a fresh database', { timeout: 90_000 }, async t => {
  assert.equal(typeof migrate, 'function', 'sandbox initialization needs a shared, tested migration owner');
  const db = await startDisposablePostgres('pricing-sandbox-workflow');
  t.after(() => db.cleanup());
  const initialized = spawnSync('frontend/node_modules/.bin/tsx', ['--tsconfig', 'frontend/tsconfig.json',
    'scripts/bootstrap-application-schema.ts', '--allow-local-postgres-test'], {
    encoding: 'utf8', env: { PATH: process.env.PATH, NODE_ENV: 'test', APPLICATION_DATABASE_URL: db.databaseUrl },
  });
  assert.equal(initialized.status, 0, initialized.stderr);
  await migrate!(db.pool, process.cwd());
  await migrate!(db.pool, process.cwd()); // A local restart can safely repeat initialization.
  await db.pool.query(`INSERT INTO app_jobs (job_id,user_id,engine_id,engine_label,duration_sec,prompt,
      thumb_url,preview_frame,provider,status)
    VALUES ('local-draft','local-owner','seedance-2-5','Seedance 2.5',4,'local fixture',
      '/thumb.svg','/thumb.svg','byteplus_modelark','completed');
    INSERT INTO seedance_draft_links (draft_job_id,user_id,provider_task_id,provider_model_id,
      validity_started_at,validity_start_source,expires_at,draft_state,final_job_id,final_state)
    VALUES ('local-draft','local-owner','cgt-local-draft','local-model',now(),
      'server_request_started',now()+interval '7 days','ready','local-final','completed')`);
  const link = (await db.pool.query('SELECT draft_state,final_state FROM seedance_draft_links')).rows[0];
  assert.deepEqual(link, { draft_state: 'ready', final_state: 'completed' });
  const runner = readFileSync('frontend/scripts/run-pricing-sandbox.ts', 'utf8');
  assert.match(runner, /await migratePricingSandbox\(pool, root\)/, 'the actual sandbox must use the tested migration path');
});

test('sandbox migrations refuse a TCP database before any DDL', async () => {
  assert.equal(typeof migrate, 'function');
  const queries: string[] = [];
  const pool = { query: async (sql: string) => {
    queries.push(sql);
    return { rows: [{ server_address: '203.0.113.1', client_address: '203.0.113.2' }] };
  } } as unknown as Pool;
  await assert.rejects(migrate!(pool, process.cwd()), /Unix.socket/i);
  assert.equal(queries.length, 1);
  assert.match(queries[0], /^SELECT /);
});
