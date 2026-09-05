import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

import { missingDisposablePostgresCommand, startDisposablePostgres } from './helpers/disposable-postgres';
import { createQueryExecutor, type QueryExecutor } from '../frontend/src/lib/db';
import { createImageThumbnailProjectionRepair } from '../frontend/scripts/_lib/image-thumbnail-projections';
import { parseImageThumbnailBackfillOptions, runImageThumbnailBackfill, type BackfillRow } from '../frontend/scripts/_lib/image-thumbnail-backfill';
import { parseStoredImageRenders } from '../frontend/lib/image-renders';

const exec = promisify(execFile);
const require = createRequire(import.meta.url);
const root = process.cwd();
const original = 'https://media.example/original.png';
const thumbnail = 'https://media.example/thumbnail.webp';

test('image repair includes stored library projections on real PostgreSQL', { timeout: 90_000 }, async (t) => {
  const missing = missingDisposablePostgresCommand();
  if (missing) return t.skip(`local PostgreSQL command unavailable: ${missing}`);
  const database = await startDisposablePostgres('image-projections');
  const cwd = mkdtempSync(path.join(tmpdir(), 'image-backfill-cli-'));
  t.after(async () => { await database.cleanup(); rmSync(cwd, { recursive: true, force: true }); });
  await database.pool.query(`
    CREATE TABLE app_jobs (
      id bigint PRIMARY KEY, job_id text UNIQUE NOT NULL, user_id text, thumb_url text,
      render_ids jsonb, preview_frame text, video_url text, hidden boolean DEFAULT false,
      status text DEFAULT 'completed', payment_status text DEFAULT 'paid_wallet',
      updated_at timestamptz DEFAULT '2026-01-01 00:00:00.123456+00'
    );
    CREATE TABLE job_outputs (
      id text PRIMARY KEY, job_id text, user_id text, kind text DEFAULT 'image',
      url text, thumb_url text, position integer, status text DEFAULT 'ready',
      metadata jsonb, updated_at timestamptz DEFAULT '2026-01-01 00:00:00.123456+00'
    );
    CREATE TABLE media_assets (
      id text PRIMARY KEY, user_id text, kind text DEFAULT 'image', url text,
      thumb_url text, source_job_id text, source_output_id text, status text DEFAULT 'ready',
      deleted_at timestamptz, metadata jsonb, updated_at timestamptz DEFAULT '2026-01-01 00:00:00.123456+00'
    );
    CREATE TABLE user_assets (
      id bigint PRIMARY KEY, user_id text, url text, mime_type text DEFAULT 'image/png', metadata jsonb
    );
  `);
  async function seed() {
    await database.pool.query('TRUNCATE app_jobs, job_outputs, media_assets, user_assets');
    await database.pool.query(`INSERT INTO app_jobs (id,job_id,user_id,thumb_url,render_ids,preview_frame)
      VALUES (1,'job-1','user-1',$1,$2::jsonb,'existing-preview')`, [thumbnail, JSON.stringify([{url:original,thumb_url:thumbnail,width:2048,height:1024,mime_type:'image/png'}])]);
    await database.pool.query(`INSERT INTO job_outputs (id,job_id,user_id,url,thumb_url,position,metadata)
      VALUES ('output-1','job-1','user-1',$1,$1,0,'{"keep":"output","large":9007199254740993}')`, [original]);
    await database.pool.query(`INSERT INTO media_assets (id,user_id,url,thumb_url,source_job_id,source_output_id,metadata)
      VALUES ('asset-1','user-1',$1,$1,'job-1','output-1',jsonb_build_object('thumbUrl',$1::text,'keep','asset'))`, [original]);
    await database.pool.query(`INSERT INTO user_assets (id,user_id,url,metadata)
      VALUES (1,'user-1',$1,jsonb_build_object('jobId','job-1','thumbUrl',$1::text,'keep','legacy'))`, [original]);
  }
  async function command(mode: 'dry-run' | 'apply', readOnly = false) {
    const url = new URL(database.databaseUrl);
    if (readOnly) url.searchParams.set('options', '-c default_transaction_read_only=on');
    return exec(process.execPath, [require.resolve('tsx/cli'), '--tsconfig', path.join(root,'frontend/tsconfig.json'), path.join(root,'frontend/scripts/backfill-image-thumbnails.ts'), `--${mode}`, '--max=1'], {
      cwd, timeout: 30_000,
      env: {...process.env, DATABASE_URL:url.toString(), TS_NODE_PROJECT:path.join(root,'frontend/tsconfig.json'), S3_BUCKET:'', S3_PUBLIC_BASE_URL:''},
    });
  }
  function projectionDependencies(beforeWrite?: () => Promise<void>) {
    const query: QueryExecutor['query'] = async (sql, params) => (await database.pool.query(sql, params ? [...params] : [])).rows;
    return {
      query,
      async transaction<T>(work: (executor: QueryExecutor) => Promise<T>) {
        const client = await database.pool.connect();
        try {
          await client.query('BEGIN');
          const executor = createQueryExecutor(client);
          const result = await work({query: async (sql, params) => {
            if (/^UPDATE /i.test(sql) && beforeWrite) await beforeWrite();
            return executor.query(sql, params);
          }});
          await client.query('COMMIT');
          return result;
        } catch (error) { await client.query('ROLLBACK'); throw error; }
        finally { client.release(); }
      },
    };
  }
  await t.test('dry-run detects stale projections when the generation already has a thumbnail', async () => {
    await seed();
    const before = await database.pool.query('SELECT to_jsonb(o)::text AS row FROM job_outputs o');
    const result = await command('dry-run', true);
    assert.match(result.stdout, /candidates=1/);
    assert.match(result.stdout, /updated=0/);
    assert.deepEqual((await database.pool.query('SELECT to_jsonb(o)::text AS row FROM job_outputs o')).rows, before.rows);
  });
  await t.test('an explicit database target is not overridden by a local environment file', async () => {
    await seed();
    writeFileSync(path.join(cwd,'.env.local'),'DATABASE_URL=postgresql://invalid@127.0.0.1:1/wrong_database\n');
    try { assert.match((await command('dry-run',true)).stdout,/candidates=1 updated=0/); }
    finally { rmSync(path.join(cwd,'.env.local')); }
  });
  await t.test('legacy images without a MIME type are repaired while linked audio and video stay untouched', async () => {
    await seed();
    await database.pool.query(`UPDATE user_assets SET mime_type=NULL;
      UPDATE media_assets SET source_job_id=NULL;
      INSERT INTO user_assets (id,user_id,url,mime_type,metadata) VALUES
        (2,'user-1','https://media.example/video.mp4',NULL,'{"jobId":"job-1"}'),
        (3,'user-1','https://media.example/no-extension','audio/wav','{"jobId":"job-1"}')`);
    await command('apply');
    assert.deepEqual((await database.pool.query("SELECT id::text,metadata->>'thumbUrl' AS thumb FROM user_assets ORDER BY id")).rows,[
      {id:'1',thumb:thumbnail},{id:'2',thumb:null},{id:'3',thumb:null},
    ]);
    assert.equal((await database.pool.query('SELECT thumb_url FROM media_assets')).rows[0].thumb_url,thumbnail);
  });
  await t.test('apply synchronizes all readers without rewriting the healthy generation or metadata', async () => {
    await seed();
    const before = (await database.pool.query('SELECT to_jsonb(j)::text AS row FROM app_jobs j')).rows;
    const result = await command('apply');
    assert.match(result.stdout, /updated=1 skipped=0 failed=0/);
    assert.deepEqual((await database.pool.query('SELECT to_jsonb(j)::text AS row FROM app_jobs j')).rows,before);
    assert.deepEqual((await database.pool.query('SELECT url,thumb_url,metadata::text FROM job_outputs')).rows,[{
      url:original,thumb_url:thumbnail,metadata:'{"keep": "output", "large": 9007199254740993}',
    }]);
    assert.deepEqual((await database.pool.query("SELECT url,thumb_url,metadata->>'thumbUrl' AS metadata_thumb,metadata->>'keep' AS retained FROM media_assets")).rows,[{url:original,thumb_url:thumbnail,metadata_thumb:thumbnail,retained:'asset'}]);
    assert.deepEqual((await database.pool.query("SELECT url,metadata->>'thumbUrl' AS thumb_url,metadata->>'keep' AS retained FROM user_assets")).rows,[{url:original,thumb_url:thumbnail,retained:'legacy'}]);
    const again = await command('apply');
    assert.match(again.stdout,/candidates=0 updated=0 skipped=1 failed=0/);
  });
  await t.test('a projection conflict rolls back all reference writes and leaves a resumable cursor', async () => {
    await seed();
    await database.pool.query(`CREATE FUNCTION reject_asset_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NULL; END $$;
      CREATE TRIGGER reject_asset BEFORE UPDATE ON media_assets FOR EACH ROW EXECUTE FUNCTION reject_asset_update()`);
    try {
      await assert.rejects(command('apply'), (error: Error & {stdout?:string}) => {
        assert.match(error.stdout??'',/updated=0 skipped=0 failed=1/);
        assert.match(error.stdout??'',/resumeAfterId=0/);
        return true;
      });
      assert.equal((await database.pool.query('SELECT thumb_url FROM job_outputs')).rows[0].thumb_url,original);
    } finally { await database.pool.query('DROP TRIGGER reject_asset ON media_assets; DROP FUNCTION reject_asset_update()'); }
    assert.match((await command('apply')).stdout,/updated=1 skipped=0 failed=0/);
  });
  await t.test('retry after a library failure reuses a durably generated thumbnail and preserves failed job billing', async () => {
    await seed();
    await database.pool.query(`UPDATE app_jobs SET thumb_url=NULL,render_ids=$1::jsonb,status='failed',payment_status='refunded_wallet'`,[JSON.stringify([original])]);
    await database.pool.query(`CREATE FUNCTION reject_asset_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NULL; END $$;
      CREATE TRIGGER reject_asset BEFORE UPDATE ON media_assets FOR EACH ROW EXECUTE FUNCTION reject_asset_update()`);
    const dependencies = projectionDependencies();
    let uploads = 0;
    const run = () => runImageThumbnailBackfill(parseImageThumbnailBackfillOptions(['--apply','--max=1'],{}),{
      query:dependencies.query, projections:createImageThumbnailProjectionRepair(dependencies),
      createThumbnails:async () => { uploads++; return [thumbnail]; },
    });
    try {
      const interrupted = await run();
      assert.equal(interrupted.updated,1);assert.equal(interrupted.failed,1);assert.equal(interrupted.resumeAfterId,'0');
      assert.equal((await database.pool.query('SELECT thumb_url FROM app_jobs')).rows[0].thumb_url,thumbnail);
      assert.equal((await database.pool.query('SELECT thumb_url FROM job_outputs')).rows[0].thumb_url,original);
    } finally { await database.pool.query('DROP TRIGGER reject_asset ON media_assets; DROP FUNCTION reject_asset_update()'); }
    const retried = await run();
    assert.equal(retried.updated,1);assert.equal(retried.failed,0);assert.equal(uploads,1);
    assert.deepEqual((await database.pool.query('SELECT status,payment_status,preview_frame FROM app_jobs')).rows,[{status:'failed',payment_status:'refunded_wallet',preview_frame:'existing-preview'}]);
  });
  await t.test('valid thumbnails, foreign owners, deleted assets and jobs beyond the scan limit stay untouched', async () => {
    await seed();
    await database.pool.query(`UPDATE job_outputs SET thumb_url='https://media.example/curated.webp';
      UPDATE media_assets SET thumb_url='https://media.example/saved.webp';
      UPDATE user_assets SET metadata=jsonb_set(metadata,'{thumbUrl}','"https://media.example/legacy.webp"');
      INSERT INTO job_outputs (id,job_id,user_id,url,thumb_url,position) VALUES ('foreign','job-1','user-2','https://media.example/original.png',NULL,1);
      INSERT INTO media_assets (id,user_id,url,source_job_id,deleted_at) VALUES
        ('foreign','user-2','https://media.example/original.png','job-1',NULL),
        ('deleted','user-1','https://media.example/original.png','job-1',NOW());
      INSERT INTO app_jobs (id,job_id,user_id,thumb_url,render_ids) SELECT 2,'job-2',user_id,thumb_url,render_ids FROM app_jobs WHERE id=1;
      INSERT INTO job_outputs (id,job_id,user_id,url,position) VALUES ('later','job-2','user-1','https://media.example/original.png',0)`);
    const before = (await database.pool.query('SELECT to_jsonb(o)::text AS row FROM job_outputs o ORDER BY id')).rows;
    assert.match((await command('apply')).stdout,/scanned=1 candidates=1 updated=1/);
    assert.deepEqual((await database.pool.query('SELECT to_jsonb(o)::text AS row FROM job_outputs o ORDER BY id')).rows,before);
    assert.deepEqual((await database.pool.query("SELECT thumb_url,metadata->>'thumbUrl' AS metadata_thumb FROM media_assets WHERE id='asset-1'")).rows,[{thumb_url:'https://media.example/saved.webp',metadata_thumb:'https://media.example/saved.webp'}]);
    assert.equal((await database.pool.query("SELECT metadata->>'thumbUrl' AS thumb FROM user_assets")).rows[0].thumb,'https://media.example/legacy.webp');
    assert.ok((await database.pool.query("SELECT thumb_url FROM media_assets WHERE id IN ('foreign','deleted')")).rows.every(r=>r.thumb_url===null));
  });
  await t.test('an unmatched saved original is reported instead of being assigned another image thumbnail', async () => {
    await seed();
    await database.pool.query("UPDATE media_assets SET url='https://media.example/different.png',thumb_url=NULL,metadata=jsonb_set(metadata,'{thumbUrl}','null')");
    await assert.rejects(command('apply'),(error:Error & {stdout?:string})=>{assert.match(error.stdout??'',/updated=0 skipped=0 failed=1/);return true;});
    assert.equal((await database.pool.query('SELECT thumb_url FROM job_outputs')).rows[0].thumb_url,original);
  });
  await t.test('source changes between inventory and projection repair are not propagated', async () => {
    await seed();
    const dependencies = projectionDependencies();
    const repair = createImageThumbnailProjectionRepair(dependencies);
    const row = (await dependencies.query<BackfillRow>('SELECT *,updated_at::text AS updated_at FROM app_jobs'))[0]!;
    assert.equal(await repair.inspect(row),3);
    await database.pool.query('UPDATE app_jobs SET hidden=true');
    await assert.rejects(repair.repair(row,parseStoredImageRenders(row.render_ids).entries),/source changed/i);
    await database.pool.query('UPDATE app_jobs SET hidden=false,render_ids=$1::jsonb',[JSON.stringify([{url:'https://media.example/changed.png',thumb_url:thumbnail}])]);
    await assert.rejects(repair.repair(row,parseStoredImageRenders(row.render_ids).entries),/source changed/i);
    assert.equal((await database.pool.query('SELECT thumb_url FROM job_outputs')).rows[0].thumb_url,original);
  });
  await t.test('an exact projection snapshot preserves concurrent metadata edits', async () => {
    await seed();
    let changed = false;
    const dependencies = projectionDependencies(async () => {
      if (changed) return;changed=true;
      await database.pool.query("UPDATE job_outputs SET metadata=metadata || '{\"concurrent\":true}'::jsonb");
    });
    const repair = createImageThumbnailProjectionRepair(dependencies);
    const row = (await dependencies.query<BackfillRow>('SELECT *,updated_at::text AS updated_at FROM app_jobs'))[0]!;
    await assert.rejects(repair.repair(row,parseStoredImageRenders(row.render_ids).entries),/projection changed/i);
    assert.deepEqual((await database.pool.query("SELECT thumb_url,metadata->>'concurrent' AS edit FROM job_outputs")).rows,[{thumb_url:original,edit:'true'}]);
  });
  await t.test('an oversized projection inventory fails explicitly without schema or media writes', async () => {
    await seed();
    await database.pool.query(`INSERT INTO media_assets (id,user_id,url,source_job_id)
      SELECT 'many-' || n,'user-1','https://media.example/original.png','job-1' FROM generate_series(1,1000) n`);
    await assert.rejects(command('dry-run',true),/exceeds 1000 rows per table/);
    assert.equal((await database.pool.query('SELECT thumb_url FROM job_outputs')).rows[0].thumb_url,original);
  });
});
