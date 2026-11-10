import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import sharp from 'sharp';
import type { LibraryMediaReference } from '../frontend/lib/media-library-organization';
import { startDisposablePostgres } from './helpers/disposable-postgres';

test('explicit imports after permanent purge create a fresh source without reviving retired references', { timeout: 120_000 }, async t => {
  const pg = await startDisposablePostgres('library-reimport');
  const env = { DATABASE_URL: pg.databaseUrl, S3_BUCKET: 'library-reimport-fixture', S3_REGION: 'eu-west-1',
    S3_ACCESS_KEY_ID: 'fixture', S3_SECRET_ACCESS_KEY: 'fixture', S3_PUBLIC_BASE_URL: 'https://assets.maxvideo.ai' };
  const previous = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  Object.assign(process.env, env);
  const { S3Client } = createRequire(new URL('../frontend/package.json', import.meta.url))('@aws-sdk/client-s3');
  const objects = new Map<string, Buffer>();
  const writes: string[] = [];
  t.mock.method(S3Client.prototype, 'send', async (command: { constructor: { name: string }; input: { Key: string; Body: Buffer } }) => {
    assert.equal(command.constructor.name, 'PutObjectCommand', 'only the isolated PUT transport may reach S3');
    objects.set(command.input.Key, Buffer.from(command.input.Body));
    writes.push(command.input.Key);
    return {};
  });
  const db = await import('../frontend/src/lib/db');
  t.after(async () => {
    await db.getDb().end();
    for (const key of Object.keys(env)) {
      if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
    }
    await pg.cleanup();
  });
  const schema = await import('../frontend/src/lib/schema');
  await schema.ensureAssetSchema(); await schema.ensureMediaLibrarySchema(); await schema.ensureMediaLibraryOrganizationSchema();
  await pg.pool.query(`CREATE TABLE app_jobs(job_id text PRIMARY KEY,user_id text,status text DEFAULT 'completed',hidden boolean DEFAULT false,
    prompt text,surface text,settings_snapshot jsonb,duration_sec integer,aspect_ratio text,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),
    video_url text,audio_url text,thumb_url text,preview_video_url text,preview_frame text,keyframe_urls jsonb,render_ids jsonb,hero_render_id text);`);
  for (const name of ['32_mcp_reference_uploads', '34_mcp_reference_upload_media_kind', '35_mcp_reference_upload_hardening',
    '36_mcp_reference_upload_replay_safety', '37_mcp_reference_upload_recovery_state', '43_mcp_reference_asset_deletion',
    '44_mcp_reference_staging_storage_namespace', '98_media_library_purge']) {
    await pg.pool.query(readFileSync(`neon/migrations/${name}.sql`, 'utf8'));
  }
  const { createStoreImageUploadService, loadStoredImageUploadRouteAsset } = await import('../frontend/src/server/uploads/store-image-upload');
  const { createStoreAudioUploadService, createStoreVideoUploadService } = await import('../frontend/src/server/uploads/store-media-upload');
  const { mutateLibraryOrganization } = await import('../frontend/server/media-library/organization');
  const { createLibrarySelectionSnapshot } = await import('../frontend/server/media-library/selection');
  const { requestLibraryTrashPurge } = await import('../frontend/server/media-library/purge');
  const { processLibraryPurgeBatch } = await import('../frontend/server/media-library/purge-worker');
  const { resolveStudioMedia } = await import('../frontend/src/server/studio/media-resolver');
  const { browseLibrary } = await import('../frontend/server/media-library/browse');
  const { claimStorageObjectProducer } = await import('../frontend/src/server/storage-object-producer-claims');
  const imageBytes = await sharp({ create: { width: 16, height: 16, channels: 3, background: '#2277bb' } }).png().toBuffer();
  let tick = 0;
  const worker = (userId: string, fail = false) => processLibraryPurgeBatch({ userId, now: new Date(Date.now() + (20 + tick++ * 10) * 60_000) }, {
    deleteStorageObjectKey: async key => { if (fail) throw new Error('synthetic cleanup pending'); objects.delete(key); },
  });
  const requestPurge = async (userId: string, reference: LibraryMediaReference) => {
    await mutateLibraryOrganization({ userId, operation: 'trash', references: [reference] });
    const snapshot = await createLibrarySelectionSnapshot({ userId, scope: { view: 'all', kind: 'all', sort: 'recent', trash: true } });
    await requestLibraryTrashPurge({ userId, snapshotId: snapshot.id, confirmation: 'empty-trash' });
  };
  const makeUpload = (kind: 'image' | 'audio' | 'video', userId: string, claim = claimStorageObjectProducer) => {
    const bytes = kind === 'image' ? imageBytes : Buffer.from(`synthetic ${kind} content`);
    const mime = kind === 'image' ? 'image/png' : kind === 'audio' ? 'audio/wav' : 'video/mp4';
    const imageStore = createStoreImageUploadService({ claimStorageObjectProducer: claim,
      createUploadImageThumbnail: async () => null, prepareImageRenditions: async () => ({}) });
    const mediaStore = (kind === 'audio' ? createStoreAudioUploadService : createStoreVideoUploadService)({
      claimStorageObjectProducer: claim,
      probeMediaBuffer: async () => ({ kind: kind === 'audio' ? 'audio' : 'video', canonicalMime: mime, detectedMime: mime,
        durationSec: 4, width: kind === 'video' ? 16 : null, height: kind === 'video' ? 16 : null, hasAudio: kind === 'audio' }),
      createUploadVideoThumbnail: async () => null,
    });
    return async () => {
      const input = { userId, fileName: `same-file.${mime.split('/')[1]}`, declaredMime: mime, bytes };
      if (kind !== 'image') {
        const stored = await mediaStore(input);
        return { assetId: stored.assetId, legacyAssetId: stored.legacyAssetId, url: stored.storageUrl };
      }
      const stored = await imageStore(input);
      const asset = await loadStoredImageUploadRouteAsset({ userId, assetId: stored.assetId });
      assert.match(asset.canonicalAssetId ?? '', /^ma_[a-f0-9]{32}$/, 'successful reimport must publish a usable canonical source');
      return { assetId: asset.canonicalAssetId!, legacyAssetId: asset.assetId, url: asset.url };
    };
  };
  for (const kind of ['image', 'audio', 'video'] as const) {
    await t.test(`${kind}: two completed purge cycles produce usable distinct originals and preserve tombstones`, async () => {
      const userId = `reimport-${kind}`;
      const bytes = kind === 'image' ? imageBytes : Buffer.from(`synthetic ${kind} content`);
      const upload = makeUpload(kind, userId);
      let current = await upload();
      const retired: typeof current[] = [];
      for (let cycle = 0; cycle < 2; cycle++) {
        const old = current;
        retired.push(old);
        const reference = { type: 'asset', assetId: old.assetId, kind } as const;
        await requestPurge(userId, reference);
        const pendingWrites = writes.length;
        await assert.rejects(upload(), /upload|delet|store/i, 'a queued purge must never return its unusable existing source');
        assert.equal(writes.length, pendingWrites, 'a queued purge must block before PUT');
        if (cycle === 0) {
          await worker(userId, true);
          assert.equal((await pg.pool.query('SELECT state FROM library_purge_requests WHERE user_id=$1', [userId])).rows[0].state, 'deleting');
          const writesBefore = writes.length;
          await assert.rejects(upload(), /upload|deleted|produced/i);
          assert.equal(writes.length, writesBefore, 'an active deletion must block before PUT');
        }
        await worker(userId);
        assert.ok((await pg.pool.query('SELECT state FROM library_purge_requests WHERE user_id=$1', [userId])).rows.every(row => row.state === 'completed'));
        current = await upload();
        assert.notEqual(current.assetId, old.assetId);
        assert.notEqual(current.legacyAssetId, old.legacyAssetId);
        assert.notEqual(current.url, old.url, 'retired raw URLs must never point to newly imported bytes');
        const liveKey = new URL(current.url).pathname.slice(1);
        assert.deepEqual(objects.get(liveKey), bytes, 'explicit reimport preserves exact original bytes');
        assert.equal((await resolveStudioMedia(userId, { type: 'asset', assetId: current.assetId, kind })).url, current.url);
        assert.deepEqual(await upload(), current, 'repeated current content keeps the same canonical and legacy identities');
        for (const deleted of retired) {
          assert.equal(objects.has(new URL(deleted.url).pathname.slice(1)), false);
          await assert.rejects(resolveStudioMedia(userId, { type: 'asset', assetId: deleted.assetId, kind }, undefined, { distinguishDeleted: true }), /MEDIA_DELETED/);
          for (const source of [deleted.url, deleted.legacyAssetId]) {
            assert.equal((await pg.pool.query('SELECT library_deleted_input($1,$2::jsonb,ARRAY[]::text[]) AS deleted', [userId, JSON.stringify(source)])).rows[0].deleted, true,
              'retired URL and legacy reference remain rejected for new generation admission');
          }
          const tombstone = (await pg.pool.query('SELECT status,deleted_at FROM media_assets WHERE user_id=$1 AND public_id=$2', [userId, deleted.assetId])).rows[0];
          assert.equal(tombstone.status, 'deleted'); assert.ok(tombstone.deleted_at);
        }
        const listed = await browseLibrary({ userId, scope: { view: 'all', kind, sort: 'recent' } });
        assert.equal(listed.totalCount, 1, 'only the new live incarnation is discoverable');
        assert.equal((await pg.pool.query('SELECT library_deleted_input($1,$2::jsonb,ARRAY[]::text[]) AS deleted', [userId, JSON.stringify(current.url)])).rows[0].deleted, false);
      }
    });
    await t.test(`${kind}: purge completed between key resolution and producer acquisition cannot revive its URL`, async () => {
      const userId = `race-before-claim-${kind}`;
      const upload = makeUpload(kind, userId);
      let retired: Awaited<ReturnType<typeof upload>> | undefined;
      let writesAfterPurge = -1;
      const racingUpload = makeUpload(kind, userId, async input => {
        // The first importer has resolved its key, but another importer can finish
        // and purge the same content before the first one acquires that key's lease.
        retired = await upload();
        assert.equal(new URL(retired.url).pathname.slice(1), input.objectKey);
        await requestPurge(userId, { type: 'asset', assetId: retired.assetId, kind });
        await worker(userId);
        assert.equal((await pg.pool.query('SELECT state FROM library_purge_requests WHERE user_id=$1', [userId])).rows[0].state, 'completed');
        assert.equal(objects.has(input.objectKey), false);
        writesAfterPurge = writes.length;
        return claimStorageObjectProducer(input);
      });
      await assert.rejects(racingUpload(), /upload|canonical|record/i);
      assert.equal(writes.length, writesAfterPurge, 'post-claim validation must reject before writing the retired URL');
      assert.ok(retired);
      assert.equal(objects.has(new URL(retired.url).pathname.slice(1)), false);
      assert.equal((await pg.pool.query('SELECT producer_claim_id FROM mcp_reference_upload_object_fences WHERE object_key=$1', [new URL(retired.url).pathname.slice(1)])).rows[0].producer_claim_id, null);
      const current = await upload();
      assert.notEqual(current.url, retired.url);
      await assert.rejects(resolveStudioMedia(userId, { type: 'asset', assetId: retired.assetId, kind }, undefined, { distinguishDeleted: true }), /MEDIA_DELETED/);
    });
    await t.test(`${kind}: a held producer lease keeps the purge worker from reclaiming its object`, async () => {
      const userId = `race-after-claim-${kind}`;
      const upload = makeUpload(kind, userId);
      let key: string | undefined;
      let writesBeforeCheck = -1;
      let hookError: unknown;
      const racingUpload = makeUpload(kind, userId, async input => {
        try {
          const existing = await upload();
          key = input.objectKey;
          const claim = await claimStorageObjectProducer(input);
          await requestPurge(userId, { type: 'asset', assetId: existing.assetId, kind });
          // Advance queue eligibility, never the clock past this live producer lease.
          await pg.pool.query("UPDATE library_purge_requests SET not_before=clock_timestamp()-interval '1 second' WHERE user_id=$1", [userId]);
          const result = await processLibraryPurgeBatch({ userId }, { deleteStorageObjectKey: async objectKey => { objects.delete(objectKey); } });
          assert.equal(result.completedCount, 0);
          assert.equal((await pg.pool.query('SELECT state FROM library_purge_requests WHERE user_id=$1', [userId])).rows[0].state, 'deleting');
          assert.equal(objects.has(key), true, 'the active producer prevents physical deletion');
          assert.equal((await pg.pool.query('SELECT producer_claim_id FROM mcp_reference_upload_object_fences WHERE object_key=$1', [key])).rows[0].producer_claim_id, claim.claimId);
          writesBeforeCheck = writes.length;
          return claim;
        } catch (error) { hookError = error; throw error; }
      });
      await assert.rejects(racingUpload(), /upload|canonical|record/i);
      if (hookError) throw hookError;
      assert.equal(writes.length, writesBeforeCheck, 'the recheck sees the active purge before PUT');
      await worker(userId);
      assert.equal(objects.has(key!), false, 'cleanup can finish after the rejected producer releases its claim');
    });
  }
});
