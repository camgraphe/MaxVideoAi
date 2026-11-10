import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import sharp from 'sharp';
import { startDisposablePostgres } from './helpers/disposable-postgres';

test('image imports participate in the content-object producer fence', { timeout: 120_000 }, async t => {
  const pg = await startDisposablePostgres('image-reimport');
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = pg.databaseUrl;
  const db = await import('../frontend/src/lib/db');
  t.after(async () => { await db.getDb().end(); process.env.DATABASE_URL = previous; await pg.cleanup(); });
  const schema = await import('../frontend/src/lib/schema');
  await schema.ensureAssetSchema();
  await schema.ensureMediaLibrarySchema();
  await schema.ensureMediaLibraryOrganizationSchema();
  for (const name of ['32_mcp_reference_uploads', '34_mcp_reference_upload_media_kind',
    '35_mcp_reference_upload_hardening', '36_mcp_reference_upload_replay_safety',
    '37_mcp_reference_upload_recovery_state', '43_mcp_reference_asset_deletion',
    '44_mcp_reference_staging_storage_namespace', '98_media_library_purge']) {
    await pg.pool.query(readFileSync(`neon/migrations/${name}.sql`, 'utf8'));
  }
  const { createStoreImageUploadService, loadStoredImageUploadRouteAsset } = await import('../frontend/src/server/uploads/store-image-upload');
  const owner = 'image-reimport-owner';
  const ownerHash = createHash('sha256').update(owner).digest('hex').slice(0, 32);
  const bytes = await sharp({ create: { width: 16, height: 16, channels: 3, background: '#1177bb' } }).png().toBuffer();
  const key = `user-assets/by-content/${ownerHash}/${createHash('sha256').update(bytes).digest('hex')}.png`;
  const url = `https://assets.maxvideo.ai/${key}`;
  let writes = 0;
  const store = createStoreImageUploadService({
    uploadImageToStorage: async params => {
      await params.beforeUpload?.(key);
      params.signal?.throwIfAborted();
      writes++;
      return { key, url, width: 16, height: 16, size: bytes.length, mime: 'image/png' };
    },
    createUploadImageThumbnail: async () => `https://assets.maxvideo.ai/user-asset-thumbs/${owner}/${randomUUID()}.webp`,
    prepareImageRenditions: async () => ({}),
  });
  const input = { userId: owner, fileName: 'reimport.png', declaredMime: 'image/png', bytes };

  await t.test('a deleted original can be uploaded again and selected through its new canonical identity', async () => {
    await pg.pool.query(`INSERT INTO mcp_reference_upload_object_fences(object_key,state,created_at,updated_at)
      VALUES($1,'deleted',now(),now())`, [key]);
    const result = await store(input);
    const asset = await loadStoredImageUploadRouteAsset({ userId: owner, assetId: result.assetId });
    assert.equal(asset.url, url);
    assert.match(asset.canonicalAssetId!, /^ma_[a-f0-9]{32}$/);
    assert.equal(writes, 1);
    assert.deepEqual((await pg.pool.query('SELECT state,producer_claim_id FROM mcp_reference_upload_object_fences WHERE object_key=$1', [key])).rows,
      [{ state: 'referenced', producer_claim_id: null }]);
    const repeated = await store(input);
    assert.equal(repeated.assetId, result.assetId);
    assert.equal(writes, 1, 'a live existing image is reused without rewriting storage');
  });

  await t.test('an active deletion stops the upload before it writes any bytes', async () => {
    const deletingKey = key.replace('.png', '-deleting.png');
    await pg.pool.query(`INSERT INTO mcp_reference_upload_object_fences
      (object_key,state,delete_claim_id,delete_lease_expires_at,created_at,updated_at)
      VALUES($1,'deleting',$2,now()+interval '5 minutes',now(),now())`, [deletingKey, randomUUID()]);
    let attemptedWrites = 0;
    const deletingStore = createStoreImageUploadService({
      query: async () => [],
      uploadImageToStorage: async params => {
        await params.beforeUpload?.(deletingKey);
        attemptedWrites++;
        throw new Error('storage must not be reached');
      },
    });
    await assert.rejects(deletingStore(input));
    assert.equal(attemptedWrites, 0);
    assert.equal((await pg.pool.query('SELECT state FROM mcp_reference_upload_object_fences WHERE object_key=$1', [deletingKey])).rows[0].state, 'deleting');
  });

  await t.test('a failed PUT releases its producer lease without publishing an asset', async () => {
    const failedKey = key.replace('.png', '-failed.png');
    const failedStore = createStoreImageUploadService({
      query: async () => [],
      uploadImageToStorage: async params => {
        await params.beforeUpload?.(failedKey);
        throw new Error('simulated storage failure');
      },
    });
    await assert.rejects(failedStore(input));
    assert.deepEqual((await pg.pool.query('SELECT state,producer_claim_id FROM mcp_reference_upload_object_fences WHERE object_key=$1', [failedKey])).rows,
      [{ state: 'orphaned', producer_claim_id: null }]);
  });

  await t.test('a lost producer lease aborts before registering the uploaded original', async () => {
    const lostKey = key.replace('.png', '-lost.png');
    let stored = false;
    let uploadSignal: AbortSignal | undefined;
    const lostStore = createStoreImageUploadService({
      query: async () => [],
      uploadImageToStorage: async params => {
        await params.beforeUpload?.(lostKey);
        uploadSignal = params.signal;
        return { key: lostKey, url: `https://assets.maxvideo.ai/${lostKey}`, width: 16, height: 16, size: bytes.length, mime: 'image/png' };
      },
      createUploadImageThumbnail: async () => {
        await pg.pool.query("UPDATE mcp_reference_upload_object_fences SET producer_lease_expires_at=now()-interval '1 second' WHERE object_key=$1", [lostKey]);
        return null;
      },
      recordUserAsset: async () => { stored = true; return 'must-not-persist'; },
    });
    await assert.rejects(lostStore(input));
    assert.equal(stored, false);
    assert.equal(uploadSignal?.aborted, true);
    assert.deepEqual((await pg.pool.query('SELECT state,producer_claim_id FROM mcp_reference_upload_object_fences WHERE object_key=$1', [lostKey])).rows,
      [{ state: 'orphaned', producer_claim_id: null }]);
  });
});
