import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { PUBLIC_VIDEO_SOURCE_ELIGIBILITY } from '../frontend/server/videos-query';
import { missingDisposablePostgresCommand, startDisposablePostgres } from './helpers/disposable-postgres';

test('deleted-media index preserves public video eligibility and avoids repeated media table scans', { timeout: 60_000 }, async (t) => {
  const missing = missingDisposablePostgresCommand();
  if (missing) return t.skip(`${missing} is unavailable`);
  const postgres = await startDisposablePostgres('deleted-media-index');
  t.after(() => postgres.cleanup());
  await postgres.pool.query(`
    CREATE TABLE app_jobs(job_id text PRIMARY KEY,user_id text,video_url text,status text,surface text);
    CREATE TABLE job_outputs(job_id text,kind text,status text,url text,storage_url text);
    CREATE TABLE media_assets(user_id text,url text,status text,deleted_at timestamptz);
    INSERT INTO app_jobs SELECT 'video-'||n,'owner','https://media.example/'||n,'completed','video'
      FROM generate_series(1,400) n;
    INSERT INTO media_assets SELECT 'noise','https://media.example/noise-'||n,'ready',NULL
      FROM generate_series(1,8000) n;
    INSERT INTO media_assets SELECT 'noise','https://media.example/deleted-'||n,'deleted',NULL
      FROM generate_series(1,168) n;
    INSERT INTO media_assets VALUES
      ('owner','https://media.example/1','deleted',NULL),
      ('owner','https://media.example/2','ready',now()),
      ('other-owner','https://media.example/3','deleted',NULL),
      ('owner','https://media.example/4','ready',NULL),
      ('owner','https://media.example/5',NULL,now()),
      ('owner','https://media.example/6',NULL,NULL);
    INSERT INTO job_outputs VALUES ('video-7','video','deleted','https://media.example/7',NULL);
    ANALYZE app_jobs; ANALYZE media_assets; ANALYZE job_outputs;
  `);
  const sql = `SELECT job_id FROM app_jobs WHERE ${PUBLIC_VIDEO_SOURCE_ELIGIBILITY} ORDER BY job_id`;
  const before = (await postgres.pool.query(sql)).rows;
  assert.equal(before.length, 396);
  for (const id of ['video-1', 'video-2', 'video-5', 'video-7']) {
    assert.ok(!before.some(row => row.job_id === id), `${id} remains excluded`);
  }
  for (const id of ['video-3', 'video-4', 'video-6']) {
    assert.ok(before.some(row => row.job_id === id), `${id} remains eligible`);
  }

  const migration = readFileSync('neon/migrations/concurrent/66_public_deleted_media_index.sql', 'utf8');
  // Concurrent creation must run in autocommit, as in the production operation.
  await postgres.pool.query(migration);
  await postgres.pool.query(migration);
  const { rows: [index] } = await postgres.pool.query(`
    SELECT indisvalid,indisready,pg_get_indexdef(indexrelid) AS definition
    FROM pg_index WHERE indexrelid='public.media_assets_deleted_user_url_idx'::regclass
  `);
  assert.equal(index.indisvalid, true);
  assert.equal(index.indisready, true);
  assert.match(index.definition, /\(user_id, url\).*deleted_at IS NOT NULL.*status = 'deleted'/);
  assert.deepEqual((await postgres.pool.query(sql)).rows, before, 'all eligible IDs and ordering are unchanged');

  const { rows: [result] } = await postgres.pool.query(`EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) ${sql}`);
  const nodes: Record<string, unknown>[] = [];
  const visit = (node: Record<string, unknown>) => {
    nodes.push(node);
    for (const child of (node.Plans ?? []) as Record<string, unknown>[]) visit(child);
  };
  visit(result['QUERY PLAN'][0].Plan);
  assert.ok(nodes.some(node => node['Index Name'] === 'media_assets_deleted_user_url_idx'), 'real public predicate uses the partial index');
  assert.ok(!nodes.some(node => node['Relation Name'] === 'media_assets' && node['Node Type'] === 'Seq Scan'), 'deleted-media checks no longer rescan the full table');
});
