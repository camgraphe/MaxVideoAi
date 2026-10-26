import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { startDisposablePostgres, createPaidGenerationTestSchema } from './helpers/disposable-postgres';
import { createQueryExecutor, withDbTransaction, getDb } from '../frontend/src/lib/db';
import { verifyExternalFalImport, applyExternalFalImport } from '../frontend/server/external-fal-import';
import { externalFalImportPlan } from '../frontend/server/external-fal-import/contract';
import { applicationJobSql } from '../frontend/server/app-job-origin';
import { loadEngineUsageRows } from '../frontend/server/admin-metrics/admin-metrics-engine-usage';
import { fetchAdminHealth } from '../frontend/server/admin-metrics/admin-health';
import { listRecentOutputPage } from '../frontend/server/media-library/job-outputs';
import { readRecentGenerationRecordsForWeb } from '../frontend/src/server/generations/recent-generations';
import { linkFalJob } from '../frontend/server/admin-job-tools';
import { updateJobFromFalWebhook } from '../frontend/server/fal-webhook-handler';
import { mapGalleryVideoRow } from '../frontend/server/videos-normalization';
import { listLibraryAssetPage } from '../frontend/server/media-library/asset-listing';

test('a real external result imports atomically once, privately, with no financial or generation events', { timeout: 90_000 }, async t => {
  const db = await startDisposablePostgres('external-fal-import');
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
  const owner = '11111111-1111-4111-8111-111111111111';
  const input = { schemaVersion: 1, ownerUserId: owner, engineId: 'flux-3-max', mode: 't2v',
    endpoint: 'blackforestlabs/flux-3-max/text-to-video', providerRequestId: '01a15b12-7619-7060-8be6-f69e46ed0cf1',
    providerInput: { prompt: 'Small complete film', duration: 18, resolution: '720p', aspect_ratio: '16:9', generate_audio: true, reasoning_level: 'high' },
    videoAssetId: 'ma_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', videoSha256: 'a'.repeat(64), evidenceSha256: 'b'.repeat(64), references: [] };
  const videoUrl = 'https://media.maxvideoai.com/user-assets/' + owner + '/original.mp4';
  await db.pool.query(`INSERT INTO user_roles VALUES ($1,'admin');
    `, [owner]);
  await db.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,thumb_url,mime_type,width,height,size_bytes,source,source_job_id,source_output_id,status,metadata,deleted_at,updated_at)
    VALUES ('asset',$1,$2,'video',$3,$4,'video/mp4',1280,704,100,'upload',NULL,NULL,'ready','{}',NULL,now())`,
    [input.videoAssetId, owner, videoUrl, 'https://media.maxvideoai.com/poster.webp']);
  const query = createQueryExecutor(db.pool);
  const deps = { executor: query, actorUserId: owner, verifyEvidence: async () => ({ providerResultSha256: 'c'.repeat(64),
    providerVideoUrl: 'https://fal.media/real.mp4', verifiedAt: new Date().toISOString(),
    video: { sha256: input.videoSha256, sizeBytes: 100, width: 1280, height: 704, hasAudio: true,
      mediaFacts: { source: 'probe' as const, version: 1 as const, probe: 'ffprobe' as const,
        original: { url: videoUrl, sha256: input.videoSha256, sizeBytes: 100 }, durationSec: 18.042,
        videoDurationSec: 18.042, audioDurationSec: 18.04, containerDurationSec: 18.042 } } }) };
  await db.pool.query('DELETE FROM user_roles');
  await db.pool.query('INSERT INTO app_admins VALUES ($1)', [owner]);
  const beforeMigration = await verifyExternalFalImport(input, deps);
  await db.pool.query("INSERT INTO user_roles VALUES ('22222222-2222-4222-8222-222222222222','admin')");
  await assert.rejects(verifyExternalFalImport(input, deps), /ADMIN/, 'a populated user_roles admin list takes precedence over the legacy list');
  await db.pool.query('DELETE FROM user_roles');
  assert.equal(beforeMigration.migrationReady, false, 'media verification can precede deployment without permitting writes');
  await assert.rejects(withDbTransaction(executor => applyExternalFalImport(beforeMigration, { executor, actorUserId: owner, approvedPlanSha256: beforeMigration.planSha256 }), { pool: db.pool }), /MIGRATION/);
  await db.pool.query(readFileSync('neon/migrations/76_external_fal_import.sql', 'utf8'));
  await db.pool.query('ALTER TABLE app_jobs DISABLE TRIGGER app_jobs_preserve_external_fal_import');
  const guardDisabled = await verifyExternalFalImport(input, deps);
  assert.equal(guardDisabled.migrationReady, false);
  await assert.rejects(withDbTransaction(executor => applyExternalFalImport(guardDisabled, { executor, actorUserId: owner, approvedPlanSha256: guardDisabled.planSha256 }), { pool: db.pool }), /MIGRATION/);
  await db.pool.query('ALTER TABLE app_jobs ENABLE TRIGGER app_jobs_preserve_external_fal_import');
  // Dry-run can run under PostgreSQL READ ONLY, including exact admin/asset/provenance checks.
  const reader = await db.pool.connect();
  try {
    await reader.query('BEGIN READ ONLY');
    await verifyExternalFalImport(input, { ...deps, executor: createQueryExecutor(reader) });
    await reader.query('ROLLBACK');
  } finally { reader.release(); }
  assert.equal((await db.pool.query('SELECT count(*)::int n FROM app_jobs')).rows[0].n, 0);
  const verified = await verifyExternalFalImport(input, deps);
  assert.equal(verified.migrationReady, true);
  assert.equal(verified.planSha256, beforeMigration.planSha256, 'schema readiness does not change verified media or plan identity');
  const apply = () => withDbTransaction(executor => applyExternalFalImport(verified, { executor, actorUserId: owner, approvedPlanSha256: verified.planSha256 }), { pool: db.pool });
  const results = await Promise.all([apply(), apply()]);
  assert.equal(results.filter(result => result.created).length, 1);
  const jobId = externalFalImportPlan(input).jobId;
  const row = (await db.pool.query('SELECT * FROM app_jobs WHERE job_id=$1', [jobId])).rows[0];
  assert.equal(row.status, 'completed'); assert.equal(row.visibility, 'private'); assert.equal(row.indexable, false);
  assert.equal(row.user_id, owner); assert.equal(row.provider_job_id, input.providerRequestId);
  assert.equal(row.duration_sec, 18); assert.equal(row.final_price_cents, null); assert.equal(row.pricing_snapshot, null);
  assert.equal(row.payment_status, 'external_not_billed'); assert.equal(row.settings_snapshot.origin, 'external_fal_import');
  assert.equal(row.settings_snapshot.externalImport.manifestSha256, externalFalImportPlan(input).manifestSha256);
  const output = (await db.pool.query('SELECT * FROM job_outputs')).rows[0];
  assert.equal(output.metadata.mediaFacts.durationSec, 18.042); assert.equal(output.user_id, owner);
  const gallery = mapGalleryVideoRow(row);
  assert.equal(gallery.durationSec, 18); assert.equal(gallery.settingsSnapshot.core.durationSec, 18);
  assert.equal(gallery.finalPriceCents, undefined, 'an external supplier cost is never a customer historical charge');
  const library = (await db.pool.query('SELECT * FROM media_assets')).rows;
  assert.equal(library.length, 1); assert.equal(library[0].source, 'upload');
  assert.equal(library[0].public_id, input.videoAssetId); assert.equal(library[0].source_output_id, outputIdFor(jobId));
  const allMedia = await listLibraryAssetPage({ userId: owner, includeOutputs: true }, { ensureSchema: false });
  assert.equal(allMedia.items.length, 1); assert.equal(allMedia.items[0].publicId, input.videoAssetId);
  assert.equal(allMedia.items[0].source, 'upload');
  assert.deepEqual((await listLibraryAssetPage({ userId: owner, source: 'saved_job_output', includeOutputs: true }, { ensureSchema: false })).items, []);
  assert.deepEqual(await loadEngineUsageRows(), []);
  assert.deepEqual((await fetchAdminHealth()).engineStats, []);
  assert.deepEqual((await listRecentOutputPage({ userId: owner }, { ensureSchema: false })).items, []);
  assert.equal((await listRecentOutputPage({ userId: owner, jobId }, { ensureSchema: false })).items[0].isSaved, true);
  assert.deepEqual(await readRecentGenerationRecordsForWeb({ userId: owner, feedType: 'video', requestedSurface: null, limit: 20 }), []);
  await assert.rejects(linkFalJob({ jobId }), /External Fal imports/);
  await updateJobFromFalWebhook({ request_id: input.providerRequestId, status: 'COMPLETED', result: { video: { url: 'https://fal.media/other.mp4' } } });
  for (const table of ['app_receipts', 'fal_queue_log', 'provider_attempts', 'app_generate_metrics', 'generation_timing_samples']) {
    assert.equal((await db.pool.query(`SELECT count(*)::int n FROM ${table}`)).rows[0].n, 0, table);
  }
  assert.equal((await db.pool.query(`SELECT count(*)::int n FROM app_jobs WHERE ${applicationJobSql()}`)).rows[0].n, 0);
  // Media repair cannot manufacture a timing sample or erase origin/financial identity.
  await db.pool.query("UPDATE app_jobs SET status='completed',video_url=video_url WHERE job_id=$1", [jobId]);
  await assert.rejects(db.pool.query("UPDATE app_jobs SET settings_snapshot='{}' WHERE job_id=$1", [jobId]), /immutable/i);
  await assert.rejects(db.pool.query('UPDATE app_jobs SET final_price_cents=0 WHERE job_id=$1', [jobId]), /external_fal_import/);
  await assert.rejects(verifyExternalFalImport({ ...input, ownerUserId: '22222222-2222-4222-8222-222222222222' }, deps), /OWNER|ASSET|CONFLICT/);
  await assert.rejects(verifyExternalFalImport(input, { ...deps, actorUserId: '22222222-2222-4222-8222-222222222222' }), /ADMIN/);
  await assert.rejects(withDbTransaction(executor => applyExternalFalImport(verified, { executor, actorUserId: owner, approvedPlanSha256: 'd'.repeat(64) }), { pool: db.pool }), /APPROVAL/);
  // Ordered durable references and requested16s survive adoption without rewriting the historical Fal input.
  const keyframes = [0, 192, 384].map((frame_index, index) => ({ frame_index, image_url: `https://fal.media/k${index + 1}.png` }));
  const references = keyframes.map((frame, index) => ({ providerUrl: frame.image_url,
    assetId: 'ma_' + String(index + 1).repeat(32), sha256: String(index + 1).repeat(64) }));
  const keyframeInput = { ...input, mode: 'ref2v', endpoint: 'blackforestlabs/flux-3-max/keyframes-to-video',
    providerRequestId: '33333333-3333-4333-8333-333333333333', videoAssetId: 'ma_' + 'e'.repeat(32),
    providerInput: { ...input.providerInput, duration: 16, keyframes }, references };
  await db.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,thumb_url,mime_type,width,height,size_bytes,source,status)
    VALUES ('video-keyframes',$1,$2,'video',$3,'https://media.maxvideoai.com/keyframe-poster.webp','video/mp4',1280,704,100,'upload','ready')`,
    [keyframeInput.videoAssetId,owner,videoUrl]);
  for (const [index, ref] of references.entries()) await db.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,mime_type,width,height,size_bytes,source,status)
    VALUES ($1,$2,$3,'image',$4,'image/png',1536,1024,200,'upload','ready')`,
    ['reference-' + index,ref.assetId,owner,`https://media.maxvideoai.com/user-assets/${owner}/k${index + 1}.png`]);
  const keyframeEvidence = await deps.verifyEvidence();
  keyframeEvidence.video.mediaFacts.durationSec = 16.041667;
  keyframeEvidence.video.mediaFacts.containerDurationSec = 16.041667;
  const keyframeVerified = await verifyExternalFalImport(keyframeInput, { ...deps, verifyEvidence: async () => ({ ...keyframeEvidence,
    resolvedSeed: 123456, referenceProofs: references.map(ref => ({ assetId: ref.assetId, providerSha256: ref.sha256, durableSha256: ref.sha256, transform: 'none' as const })) }) });
  const importedKeyframe = await withDbTransaction(executor => applyExternalFalImport(keyframeVerified, {
    executor, actorUserId: owner, approvedPlanSha256: keyframeVerified.planSha256 }), { pool: db.pool });
  const keyframeRow = (await db.pool.query('SELECT * FROM app_jobs WHERE job_id=$1', [importedKeyframe.jobId])).rows[0];
  assert.equal(keyframeRow.duration_sec, 16); assert.equal(keyframeRow.settings_snapshot.core.durationSec, 16);
  assert.equal(keyframeRow.settings_snapshot.advanced.seed, 123456);
  assert.equal(keyframeRow.settings_snapshot.externalImport.requestedSeed, null);
  assert.equal(keyframeRow.settings_snapshot.externalImport.resolvedSeed, 123456);
  assert.deepEqual(keyframeRow.settings_snapshot.externalImport.providerInput, keyframeInput.providerInput);
  assert.equal(keyframeRow.settings_snapshot.advanced.extraInputValues.keyframe_indexes, '0,192,384');
  assert.deepEqual(keyframeRow.settings_snapshot.refs.referenceImages, references.map((_,index) => `https://media.maxvideoai.com/user-assets/${owner}/k${index + 1}.png`));
  assert.deepEqual(keyframeRow.settings_snapshot.refs.inputs.map((ref: { assetId: string }) => ref.assetId), references.map(ref => ref.assetId));
  assert.equal((await db.pool.query('SELECT metadata FROM job_outputs WHERE id=$1', [importedKeyframe.outputId])).rows[0].metadata.mediaFacts.durationSec, 16.041667);
  for (const table of ['app_receipts','fal_queue_log','provider_attempts','app_generate_metrics','generation_timing_samples'])
    assert.equal((await db.pool.query(`SELECT count(*)::int n FROM ${table}`)).rows[0].n, 0, table);
  // Kling uses the same owner/idempotency/payment boundary, with explicit display roles and no FLUX defaults.
  const klingInput = { schemaVersion: 1, ownerUserId: owner, engineId: 'kling-v4', mode: 'ref2v',
    endpoint: 'kling/v4/reference-to-video', providerRequestId: '44444444-4444-4444-8444-444444444444',
    providerInput: { multi_prompt: [{ prompt: 'First scene', duration: 2 }, { prompt: 'Last scene', duration: 3 }],
      duration: 5, resolution: '1080p', aspect_ratio: '16:9', video_urls: ['https://fal.media/reference.mp4'],
      elements: [{ frontal_image_url: references[0].providerUrl, reference_image_urls: [references[1].providerUrl] }] },
    videoAssetId: 'ma_' + 'f'.repeat(32), videoSha256: 'f'.repeat(64), evidenceSha256: 'e'.repeat(64),
    references: [{ slotId: 'video_urls.0', kind: 'video', providerUrl: 'https://fal.media/reference.mp4', assetId: 'ma_' + 'd'.repeat(32), sha256: 'd'.repeat(64) },
      { ...references[0], slotId: 'elements.0.frontal_image_url', kind: 'image' },
      { ...references[1], slotId: 'elements.0.reference_image_urls.0', kind: 'image' }],
    media: { poster: { url: 'https://media.maxvideoai.com/kling-poster.webp', sha256: 'c'.repeat(64) },
      preview: { url: 'https://media.maxvideoai.com/kling-preview.mp4', sha256: 'b'.repeat(64) } } };
  await db.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,thumb_url,preview_url,mime_type,width,height,size_bytes,source,status)
    VALUES ('kling-video',$1,$2,'video',$3,$4,$5,'video/mp4',1280,704,100,'upload','ready')`,
    [klingInput.videoAssetId,owner,videoUrl,klingInput.media.poster.url,klingInput.media.preview.url]);
  await db.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,mime_type,width,height,size_bytes,source,status)
    VALUES ('kling-ref-video',$1,$2,'video','https://media.maxvideoai.com/ref.mp4','video/mp4',1280,704,100,'upload','ready')`,
    [klingInput.references[0].assetId,owner]);
  const klingEvidence = { ...await deps.verifyEvidence(),
    display: { poster: { ...klingInput.media.poster, width: 1280, height: 704, sizeBytes: 10 },
      preview: { ...klingInput.media.preview, width: 640, height: 352, sizeBytes: 10, durationSec: 2, hasAudio: false } },
    referenceProofs: klingInput.references.map(ref => ({ assetId: ref.assetId, providerSha256: ref.sha256, durableSha256: ref.sha256, transform: 'none' as const })) };
  klingEvidence.video.sha256 = klingInput.videoSha256;
  klingEvidence.video.mediaFacts.original.sha256 = klingInput.videoSha256;
  const klingDeps = { ...deps, verifyEvidence: async () => klingEvidence };
  await assert.rejects(verifyExternalFalImport({ ...klingInput, ownerUserId: '22222222-2222-4222-8222-222222222222' }, klingDeps), /OWNER/);
  await assert.rejects(verifyExternalFalImport(klingInput, { ...klingDeps, actorUserId: '22222222-2222-4222-8222-222222222222' }), /ADMIN/);
  const klingVerified = await verifyExternalFalImport(klingInput, klingDeps);
  const applyKling = () => withDbTransaction(executor => applyExternalFalImport(klingVerified, {
    executor, actorUserId: owner, approvedPlanSha256: klingVerified.planSha256 }), { pool: db.pool });
  const klingResults = await Promise.all([applyKling(), applyKling()]);
  assert.equal(klingResults.filter(value => value.created).length, 1);
  assert.equal(Object.isFrozen(klingVerified.input.providerInput), true);
  await assert.rejects(verifyExternalFalImport({ ...klingInput, providerInput: { ...klingInput.providerInput,
    multi_prompt: [{ prompt: 'Changed scene', duration: 2 }, { prompt: 'Last scene', duration: 3 }] } }, klingDeps), /CONFLICT/);
  const klingRow = (await db.pool.query('SELECT * FROM app_jobs WHERE job_id=$1', [klingResults[0].jobId])).rows[0];
  assert.equal(klingRow.engine_id, 'kling-v4'); assert.equal(klingRow.engine_label, 'Kling 4.0');
  assert.equal(klingRow.visibility, 'private'); assert.equal(klingRow.indexable, false);
  assert.equal(klingRow.payment_status, 'external_not_billed'); assert.equal(klingRow.final_price_cents, null);
  assert.equal(klingRow.preview_video_url, klingInput.media.preview.url);
  assert.deepEqual(klingRow.settings_snapshot.externalImport.providerInput, klingInput.providerInput);
  assert.deepEqual(klingRow.settings_snapshot.advanced.multiPrompt, klingInput.providerInput.multi_prompt);
  assert.equal(klingRow.settings_snapshot.core.fps, null); assert.equal(klingRow.settings_snapshot.core.audio, null);
  assert.deepEqual(klingRow.settings_snapshot.refs.videoUrls, ['https://media.maxvideoai.com/ref.mp4']);
  assert.equal(klingRow.settings_snapshot.refs.elements[0].frontalAssetId, references[0].assetId);
  assert.equal(klingRow.settings_snapshot.refs.elements[0].frontalImageUrl, `https://media.maxvideoai.com/user-assets/${owner}/k1.png`);
  const klingOutput = (await db.pool.query('SELECT * FROM job_outputs WHERE id=$1', [klingResults[0].outputId])).rows[0];
  assert.equal(klingOutput.preview_url, klingInput.media.preview.url); assert.equal(klingOutput.thumb_url, klingInput.media.poster.url);
  await db.pool.query("UPDATE job_outputs SET preview_url='https://media.maxvideoai.com/changed.mp4' WHERE id=$1", [klingResults[0].outputId]);
  await assert.rejects(applyKling(), /OUTPUT_CONFLICT/);
  await db.pool.query('UPDATE job_outputs SET preview_url=$2 WHERE id=$1', [klingResults[0].outputId,klingInput.media.preview.url]);
  await db.pool.query("UPDATE media_assets SET preview_url='https://media.maxvideoai.com/changed.mp4' WHERE public_id=$1", [klingInput.videoAssetId]);
  await assert.rejects(applyKling(), /DISPLAY|CHANGED/);
  for (const table of ['app_receipts','fal_queue_log','provider_attempts','app_generate_metrics','generation_timing_samples'])
    assert.equal((await db.pool.query(`SELECT count(*)::int n FROM ${table}`)).rows[0].n, 0, table);
  // A native job continues contributing normally.
  await db.pool.query(`INSERT INTO app_jobs(job_id,user_id,engine_id,provider,surface,status,video_url,created_at)
    VALUES ('native',$1,'flux-3-max','fal','video','completed','real.mp4',now()-interval '2 minutes')`, [owner]);
  assert.equal((await db.pool.query('SELECT count(*)::int n FROM generation_timing_samples')).rows[0].n, 1);
  assert.equal((await db.pool.query(`SELECT count(*)::int n FROM app_jobs WHERE ${applicationJobSql()}`)).rows[0].n, 1);
  assert.equal(Number((await loadEngineUsageRows())[0].render_count), 1);
  assert.equal((await fetchAdminHealth()).engineStats[0].totalCount, 1);
});
function outputIdFor(jobId: string) { return jobId + '_video_0'; }
