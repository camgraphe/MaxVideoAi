import assert from 'node:assert/strict';
import test from 'node:test';
import { startDisposablePostgres, missingDisposablePostgresCommand } from './helpers/disposable-postgres';
import { resolveOwnedLumaGenerationSource } from '../frontend/src/server/agent-api/generation-luma-lineage';

test('Luma lineage uses the actor, internal attempt join and exact ready output in PostgreSQL', { timeout: 90_000 }, async t => {
  const missing = missingDisposablePostgresCommand(); if (missing) return t.skip(missing);
  const db = await startDisposablePostgres('luma-lineage'); t.after(() => db.cleanup());
  await db.pool.query(`CREATE TABLE app_jobs(id bigint, job_id text, user_id text, engine_id text, surface text, status text, provider text, provider_job_id text, video_url text, hidden boolean DEFAULT false);
    CREATE TABLE provider_attempts(id bigint, job_id bigint, provider text, provider_model text, status text, provider_job_id text, request_snapshot jsonb);
    CREATE TABLE job_outputs(id text, job_id text, user_id text, kind text, position integer, status text, url text, storage_url text);
    CREATE TABLE media_assets(public_id text, source_output_id text, source_job_id text, user_id text, status text, deleted_at timestamptz);
    INSERT INTO app_jobs VALUES(42,'public-job','alice','luma-ray-3-2','video','completed','luma_agents_direct','provider-id','https://owned/original.mp4',false);
    INSERT INTO provider_attempts VALUES(7,42,'luma_agents_direct','ray-3.2','completed','provider-id','{}');
    INSERT INTO job_outputs VALUES('output','public-job','alice','video',0,'ready','https://owned/original.mp4',NULL);`);
  const executor = { query: async <T,>(sql: string, params?: unknown[]): Promise<T[]> => (await db.pool.query(sql, params)).rows };
  const resolve = (userId = 'alice', expectedOutputAssetId?: string) => resolveOwnedLumaGenerationSource({ actor: { userId }, sourceJobId: 'public-job', expectedOutputAssetId, executor });
  const original = await resolve(); assert.equal(original.sourceOutputIdentity, 'output');
  for (const actor of ['bob','admin']) await assert.rejects(resolve(actor), /not available/);
  await assert.rejects(resolve('alice','missing'), /not available/);
  await db.pool.query("INSERT INTO media_assets VALUES('asset','output','public-job','alice','ready',NULL)");
  assert.equal((await resolve('alice','asset')).fingerprint, original.fingerprint);
  for (const mutation of ["UPDATE app_jobs SET hidden=true", "UPDATE provider_attempts SET request_snapshot='{\"hdr\":true}'", "UPDATE app_jobs SET status='failed'", "UPDATE app_jobs SET status='running'", "UPDATE app_jobs SET provider='fal'", "UPDATE app_jobs SET engine_id='luma-ray-2'", "UPDATE app_jobs SET provider_job_id=NULL", "UPDATE provider_attempts SET provider_job_id='other'", "UPDATE provider_attempts SET job_id=99", "UPDATE provider_attempts SET status='accepted'", "UPDATE provider_attempts SET provider_model='ray-2'", "UPDATE job_outputs SET user_id='bob'", "UPDATE job_outputs SET status='deleted'", "UPDATE job_outputs SET url='https://different/output.mp4'", "UPDATE media_assets SET deleted_at=NOW()"]) {
    await db.pool.query('BEGIN');
    try { await db.pool.query(mutation); await assert.rejects(resolve('alice','asset'), /not available/, mutation); }
    finally { await db.pool.query('ROLLBACK'); }
  }
  await db.pool.query("INSERT INTO provider_attempts VALUES(8,42,'fal','ray-3.2','completed','unrelated','{}')");
  assert.equal((await resolve()).fingerprint, original.fingerprint, 'unrelated successful attempts never replace exact provenance');
  await db.pool.query("UPDATE provider_attempts SET status='accepted' WHERE id=7");
  await assert.rejects(resolve(), /not available/, 'completion projection gap cannot borrow another success');
});
