import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { startDisposablePostgres, createPaidGenerationTestSchema } from './helpers/disposable-postgres';
import { createQueryExecutor, withDbTransaction, getDb } from '../frontend/src/lib/db';
import { applicationJobSql } from '../frontend/server/app-job-origin';
import { loadEngineUsageRows } from '../frontend/server/admin-metrics/admin-metrics-engine-usage';
import { fetchAdminHealth } from '../frontend/server/admin-metrics/admin-health';
import { listRecentOutputPage } from '../frontend/server/media-library/job-outputs';
import { readRecentGenerationRecordsForWeb } from '../frontend/src/server/generations/recent-generations';
import { linkFalJob } from '../frontend/server/admin-job-tools';
import { updateJobFromFalWebhook } from '../frontend/server/fal-webhook-handler';
import { listLibraryAssetPage } from '../frontend/server/media-library/asset-listing';

test('external provenance guards stay independent from model launch and preserve native generation metrics', { timeout: 90_000 }, async t => {
  const db = await startDisposablePostgres('external-fal-guardrails');
  const previousDatabase = process.env.DATABASE_URL;
  process.env.DATABASE_URL = db.databaseUrl;
  t.after(async () => { await getDb().end(); process.env.DATABASE_URL = previousDatabase; await db.cleanup(); });
  await createPaidGenerationTestSchema(db.pool);
  await db.pool.query(`ALTER TABLE app_jobs ADD COLUMN IF NOT EXISTS hidden boolean DEFAULT false;
    CREATE TABLE user_roles(user_id text,role text);
    CREATE TABLE app_admins(user_id text);
    CREATE TABLE media_assets(id text PRIMARY KEY,public_id text UNIQUE,user_id text,kind text,url text,thumb_url text,
      mime_type text,width integer,height integer,size_bytes bigint,source text,source_job_id text,source_output_id text,
      status text,metadata jsonb,deleted_at timestamptz,updated_at timestamptz DEFAULT now(),preview_url text,created_at timestamptz DEFAULT now());
    CREATE TABLE user_assets(asset_id text,user_id text,url text,mime_type text,width integer,height integer,size_bytes bigint,source text,metadata jsonb,created_at timestamptz);
    CREATE TABLE job_outputs(id text PRIMARY KEY,job_id text,user_id text,kind text,url text,storage_url text,thumb_url text,
      preview_url text,mime_type text,width integer,height integer,duration_sec integer,position integer,status text,
      metadata jsonb,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(), UNIQUE(job_id,kind,position));
    CREATE TABLE fal_queue_log(job_id text,status text,created_at timestamptz);
    CREATE TABLE provider_attempts(job_id bigint,provider text,status text,finished_at timestamptz,response_snapshot jsonb,error_class text,created_at timestamptz);
    CREATE TABLE app_settings(key text,value jsonb);
    CREATE TABLE app_generate_metrics(id text);
    CREATE FUNCTION forbid_import_side_effect() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'FORBIDDEN_WRITE'; END $$;
    CREATE TRIGGER no_receipt BEFORE INSERT OR UPDATE OR DELETE ON app_receipts FOR EACH ROW EXECUTE FUNCTION forbid_import_side_effect();
    CREATE TRIGGER no_queue BEFORE INSERT OR UPDATE OR DELETE ON fal_queue_log FOR EACH ROW EXECUTE FUNCTION forbid_import_side_effect();
    CREATE TRIGGER no_attempt BEFORE INSERT OR UPDATE OR DELETE ON provider_attempts FOR EACH ROW EXECUTE FUNCTION forbid_import_side_effect();
    CREATE TRIGGER no_metric BEFORE INSERT OR UPDATE OR DELETE ON app_generate_metrics FOR EACH ROW EXECUTE FUNCTION forbid_import_side_effect();`);
  await db.pool.query(readFileSync('neon/migrations/45_generation_timing_samples.sql', 'utf8'));
  await db.pool.query(readFileSync('neon/migrations/46_generation_provider_timing.sql', 'utf8'));

  await db.pool.query(readFileSync('neon/migrations/76_external_fal_import.sql', 'utf8'));
  const owner = '11111111-1111-4111-8111-111111111111';
  const jobId = 'external-real-request-fixture';
  const requestId = '22222222-2222-4222-8222-222222222222';
  const snapshot = { origin: 'external_fal_import', externalImport: { schemaVersion: 1, providerRequestId: requestId } };
  await db.pool.query(`INSERT INTO app_jobs(job_id,user_id,engine_id,provider,provider_job_id,surface,status,video_url,thumb_url,
    created_at,visibility,indexable,payment_status,settings_snapshot)
    VALUES ($1,$2,'flux-3','fal',$3,'video','completed','https://media.maxvideoai.com/video.mp4','https://media.maxvideoai.com/poster.webp',
      now()-interval '2 minutes','private',false,'external_not_billed',$4)`, [jobId,owner,requestId,snapshot]);
  const outputId = jobId + '_video_0';
  await db.pool.query(`INSERT INTO job_outputs(id,job_id,user_id,kind,url,status,position,metadata)
    VALUES ($1,$2,$3,'video','https://media.maxvideoai.com/video.mp4','ready',0,'{"origin":"external_fal_import"}')`, [outputId,jobId,owner]);
  await db.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,source,source_job_id,source_output_id,status)
    VALUES ('asset','ma_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',$1,'video','https://media.maxvideoai.com/video.mp4','upload',$2,$3,'ready')`, [owner,jobId,outputId]);
  assert.equal((await db.pool.query('SELECT count(*)::int n FROM generation_timing_samples')).rows[0].n, 0);
  assert.deepEqual(await loadEngineUsageRows(), []);
  assert.deepEqual((await fetchAdminHealth()).engineStats, []);
  assert.deepEqual(await readRecentGenerationRecordsForWeb({ userId: owner, feedType: 'video', requestedSurface: null, limit: 20 }), []);
  assert.deepEqual((await listRecentOutputPage({ userId: owner }, { ensureSchema: false })).items, []);
  assert.equal((await listRecentOutputPage({ userId: owner, jobId }, { ensureSchema: false })).items[0].isSaved, true);
  const library = await listLibraryAssetPage({ userId: owner, includeOutputs: true }, { ensureSchema: false });
  assert.equal(library.items.length, 1); assert.equal(library.items[0].source, 'upload');
  assert.deepEqual((await listLibraryAssetPage({ userId: owner, source: 'saved_job_output', includeOutputs: true }, { ensureSchema: false })).items, []);
  await assert.rejects(linkFalJob({ jobId }), /External Fal imports/);
  await updateJobFromFalWebhook({ request_id: requestId, status: 'COMPLETED', result: { video: { url: 'https://fal.media/other.mp4' } } });
  await db.pool.query("UPDATE app_jobs SET status='completed',video_url=video_url WHERE job_id=$1", [jobId]);
  for (const table of ['app_receipts','fal_queue_log','provider_attempts','app_generate_metrics','generation_timing_samples']) {
    assert.equal((await db.pool.query(`SELECT count(*)::int n FROM ${table}`)).rows[0].n, 0, table);
  }
  await assert.rejects(db.pool.query("UPDATE app_jobs SET settings_snapshot='{}' WHERE job_id=$1", [jobId]), /immutable/i);
  await assert.rejects(db.pool.query('UPDATE app_jobs SET final_price_cents=0 WHERE job_id=$1', [jobId]), /external_fal_import/);
  await assert.rejects(db.pool.query('UPDATE app_jobs SET user_id=$2 WHERE job_id=$1', [jobId,'another-owner']), /immutable/i);
  await assert.rejects(db.pool.query(`INSERT INTO app_jobs(job_id,user_id,engine_id,provider,provider_job_id,surface,status,video_url,
    created_at,visibility,indexable,payment_status,settings_snapshot) SELECT 'duplicate',user_id,engine_id,provider,provider_job_id,
    surface,status,video_url,created_at,visibility,indexable,payment_status,settings_snapshot FROM app_jobs WHERE job_id=$1`, [jobId]), /unique/i);
  await db.pool.query(`INSERT INTO app_jobs(job_id,user_id,engine_id,provider,surface,status,video_url,created_at)
    VALUES ('native',$1,'flux-3','fal','video','completed','real.mp4',now()-interval '2 minutes')`, [owner]);
  assert.equal((await db.pool.query('SELECT count(*)::int n FROM generation_timing_samples')).rows[0].n, 1);
  assert.equal((await db.pool.query(`SELECT count(*)::int n FROM app_jobs WHERE ${applicationJobSql()}`)).rows[0].n, 1);
  assert.equal(Number((await loadEngineUsageRows())[0].render_count), 1);
  assert.equal((await fetchAdminHealth()).engineStats[0].totalCount, 1);
});
