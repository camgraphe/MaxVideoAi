import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import { getDb } from '../frontend/src/lib/db';
import { ensureMediaLibrarySchema } from '../frontend/src/lib/schema/media-library-schema';
import { createPaidGenerationTestSchema, startDisposablePostgres } from './helpers/disposable-postgres';

test('Activity and Create restore the visible history and playable results for the signed-in account', async (t) => {
  const db = await startDisposablePostgres('mobile-latest');
  const storage = 'https://mobile-latest-fixture.s3.us-east-1.amazonaws.com';
  const original = process.env;
  process.env = {
    ...original,
    DATABASE_URL: db.databaseUrl, S3_PUBLIC_BASE_URL: storage, S3_BUCKET: 'mobile-latest-fixture',
    S3_REGION: 'us-east-1', S3_ACCESS_KEY_ID: 'fixture', S3_SECRET_ACCESS_KEY: 'fixture',
  };
  t.after(async () => {
    await getDb().end();
    process.env = original;
    await db.cleanup();
  });
  const { readLatestMobileResult, readMobileJob, listMobileJobs } = await import('../frontend/src/server/mobile/generations');
  await createPaidGenerationTestSchema(db.pool);
  await ensureMediaLibrarySchema();
  await db.pool.query(`
    INSERT INTO app_jobs(job_id,user_id,surface,status,created_at,video_url,render_ids,hidden,settings_snapshot)
    SELECT job,owner,surface,status,TIMESTAMPTZ '2026-01-02' + n * INTERVAL '1 microsecond',
           video,renders::jsonb,hidden,snapshot::jsonb
    FROM (VALUES
      (1,'older','owner','video','completed','https://cdn.maxvideoai.com/older.mp4',NULL,false,NULL),
      (2,'site-video','owner',NULL,E'\tSuCcEeDeD ','${storage}/renders/owner/site.mp4',NULL,false,NULL),
      (3,'mobile-image','owner','image','completed',NULL,'[{"url":"https://cdn.maxvideoai.com/first.png"}]',false,NULL),
      (4,'site-image','owner',NULL,'finished',NULL,'["https://cdn.maxvideoai.com/site.png"]',false,NULL),
      (5,'other-account','other','video','completed','https://cdn.maxvideoai.com/foreign.mp4',NULL,false,NULL),
      (6,'running','owner','video','running','https://cdn.maxvideoai.com/running.mp4',NULL,false,NULL),
      (7,'failed','owner','image','failed',NULL,'["https://cdn.maxvideoai.com/failed.png"]',false,NULL),
      (8,'hidden','owner','image','completed',NULL,'["https://cdn.maxvideoai.com/hidden.png"]',true,NULL),
      (9,'imported','owner','video','completed','https://cdn.maxvideoai.com/imported.mp4',NULL,false,'{"origin":"external_fal_import"}'),
      (10,'audio','owner','audio','completed','https://cdn.maxvideoai.com/audio.mp4',NULL,false,NULL),
      (11,'foreign-storage','owner','video','completed','${storage}/renders/other/private.mp4',NULL,false,NULL),
      (12,'poster-only','owner','video','completed',NULL,NULL,false,NULL),
      (13,'removed-video','owner','video','completed','https://cdn.maxvideoai.com/removed.mp4',NULL,false,NULL),
      (14,'removed-image','owner','image','completed',NULL,'["https://cdn.maxvideoai.com/removed.png"]',false,NULL)
    ) AS cases(n,job,owner,surface,status,video,renders,hidden,snapshot)`);
  await db.pool.query(`INSERT INTO job_outputs (id,job_id,user_id,kind,status,position,url) VALUES
    ('deleted-video','removed-video','owner','video','deleted',0,'https://cdn.maxvideoai.com/removed.mp4'),
    ('deleted-image','removed-image','owner','image','deleted',0,'https://cdn.maxvideoai.com/removed.png'),
    ('foreign-output','site-video','other','video','ready',0,'https://cdn.maxvideoai.com/foreign.mp4')`);
  // Invalid media can occupy more than a whole batch and share its millisecond.
  await db.pool.query(`
    INSERT INTO app_jobs(job_id,user_id,surface,status,created_at,video_url)
    SELECT 'no-output-'||n,'owner','video','completed',
           TIMESTAMPTZ '2026-01-02' + INTERVAL '20 microseconds','https://untrusted.invalid/result.mp4'
    FROM generate_series(1,24) n`);

  const video = await readLatestMobileResult('owner', 'video');
  assert.equal(video?.jobId, 'site-video');
  assert.equal(video.status, 'completed');
  const signed = new URL(video.url!);
  assert.equal(signed.pathname, '/renders/owner/site.mp4');
  assert.equal(signed.searchParams.get('X-Amz-Expires'), '300');
  assert.match(signed.searchParams.get('X-Amz-Signature') ?? '', /^[a-f0-9]{64}$/);
  const image = await readLatestMobileResult('owner', 'image');
  assert.equal(image?.jobId, 'site-image');
  assert.equal(image.url, 'https://cdn.maxvideoai.com/site.png');
  await db.pool.query(`INSERT INTO job_outputs (id,job_id,user_id,kind,status,position,url) VALUES
    ('surviving-sibling','removed-image','owner','image','ready',1,'https://cdn.maxvideoai.com/sibling.png')`);
  const history = await listMobileJobs('owner', null);
  assert.ok(history.nextCursor);
  const next = await listMobileJobs('owner', history.nextCursor);
  const entries = [...history.items, ...next.items];
  assert.equal(new Set(entries.map(job => job.jobId)).size, entries.length);
  const unavailable = entries.find(job => job.jobId === 'foreign-storage');
  assert.ok(unavailable);
  assert.equal(unavailable.url, null);
  assert.equal(unavailable.shareSourceUrl, undefined);
  assert.ok(entries.some(job => job.jobId === 'running' && job.status === 'running'));
  assert.ok(!entries.some(job => job.jobId === 'other-account' || job.jobId === 'hidden'));
  assert.equal(entries.find(job => job.jobId === 'removed-video')?.url, null);
  assert.equal(entries.find(job => job.jobId === 'removed-image')?.url, 'https://cdn.maxvideoai.com/sibling.png');
  for (const surface of ['image', 'video', 'audio'] as const) {
    const filtered = await listMobileJobs('owner', null, surface);
    assert.ok(filtered.items.length > 0);
    assert.ok(filtered.items.every(job => job.surface === surface));
  }
  assert.deepEqual(await listMobileJobs('empty', null), { items: [], nextCursor: null });
  await assert.rejects(readMobileJob('other', 'site-video'), { code: 'JOB_NOT_FOUND' });
  await assert.rejects(listMobileJobs('owner', 'broken'), /cursor is invalid/);
  await assert.rejects(listMobileJobs('owner', null, 'invalid'), { code: 'INVALID_SURFACE' });
  const survivor = await readLatestMobileResult('owner', 'image');
  assert.equal(survivor?.jobId, 'removed-image');
  assert.equal(survivor.url, 'https://cdn.maxvideoai.com/sibling.png');
  assert.equal((await readMobileJob('owner', survivor.jobId, { includeOutputs: true })).url, survivor.url);
  // Some completed jobs retain their original only in the normalized output table.
  await db.pool.query("UPDATE app_jobs SET render_ids = NULL WHERE job_id = 'removed-image'");
  assert.equal((await readLatestMobileResult('owner', 'image'))?.url, survivor.url);
  assert.equal(await readLatestMobileResult('empty', 'video'), null);
  assert.equal(await readLatestMobileResult('other', 'image'), null);
  assert.equal((await readLatestMobileResult('other', 'video'))?.jobId, 'other-account');
  for (const unsupported of ['audio', 'all', null]) {
    await assert.rejects(readLatestMobileResult('owner', unsupported), { code: 'INVALID_SURFACE', status: 400 });
  }
});

test('all three mobile history GETs require a bearer even with a supplied account and cookie', async () => {
  const { GET: list } = await import('../frontend/app/api/mobile/generations/route');
  const { GET: detail } = await import('../frontend/app/api/mobile/generations/[jobId]/route');
  const { GET: latest } = await import('../frontend/app/api/mobile/generations/latest/route');
  const { NextRequest } = createRequire(resolve('frontend/package.json'))('next/server');
  const request = new NextRequest('http://localhost/api/mobile/generations?surface=image&userId=owner', {
    headers: { Cookie: 'account=owner' },
  });
  const responses = await Promise.all([list(request), detail(request, { params: Promise.resolve({ jobId: 'site-video' }) }), latest(request)]);
  for (const response of responses) {
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
    assert.equal((await response.json()).error.code, 'AUTH_REQUIRED');
  }
});
