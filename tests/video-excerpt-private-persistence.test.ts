import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import type { StudioResolvedMedia } from '../frontend/src/server/studio/media-resolver';
import type { VideoExcerptFacts } from '../frontend/server/video-excerpts/media';

process.env.S3_BUCKET = 'excerpt-private-fixture';
process.env.S3_REGION = 'us-east-1';
process.env.S3_ACCESS_KEY_ID = 'fixture-access';
process.env.S3_SECRET_ACCESS_KEY = 'fixture-secret';
process.env.S3_PUBLIC_BASE_URL = 'https://excerpt-private-fixture.s3.us-east-1.amazonaws.com';
process.env.S3_UPLOAD_ACL = 'public-read';
process.env.S3_CACHE_CONTROL = 'public, max-age=3600';

test('preparing a private source keeps original and thumbnail private in a new namespace with signed playback', async () => {
  const { prepareVideoExcerpt, persistVideoExcerpt } = await import('../frontend/server/video-excerpts/prepare');
  const { createStoreVideoUploadService } = await import('../frontend/src/server/uploads/store-media-upload');
  const { buildContentAddressedFileLeaf } = await import('../frontend/server/storage');
  const { createConversationMediaReadAccess } = await import('../frontend/src/server/studio/conversation-media-read-access');
  const { getBaseEngineIncludingHidden } = await import('../frontend/src/lib/engines');
  const base = process.env.S3_PUBLIC_BASE_URL!;
  const sourceRef = { type: 'asset' as const, assetId: 'ma_11111111111111111111111111111111', kind: 'video' as const };
  const outputRef = { ...sourceRef, assetId: 'ma_22222222222222222222222222222222' };
  const source: StudioResolvedMedia = { id: 'source', ref: sourceRef, kind: 'video', url: `${base}/user-assets/owner/private.mp4`,
    mime: 'video/mp4', thumbUrl: null, previewUrl: null, originalAccess: { type: 'owned-storage', storageKey: 'user-assets/owner/private.mp4' } };
  const facts: VideoExcerptFacts = { kind: 'video', width: 640, height: 480, durationSec: 60, fps: 30, hasAudio: true, sizeBytes: 10, mimeType: 'video/mp4', videoCodec: 'h264', audioCodec: 'aac' };
  const range = { startSec: 10, endSec: 15 };
  const outputFacts = { ...facts, durationSec: 5 };
  let storedUrl = '', storedKey = '', namespace = '';
  let thumbnailUrl = '';
  const uploads: Array<{ acl?: string | null; cacheControl?: string; location?: string }> = [];
  const records: Record<string, unknown>[] = [];
  const store = createStoreVideoUploadService({
    probeMediaBuffer: async () => ({ kind: 'video', canonicalMime: 'video/mp4', detectedMime: 'video/mp4', durationSec: 5, width: 640, height: 480, hasAudio: true }),
    uploadFileBuffer: async input => {
      assert.equal(input.prefix, 'user-assets');
      uploads.push({ acl: input.acl, cacheControl: input.cacheControl, location: input.privateStorageScope });
      namespace = input.contentAddressedNamespace!;
      storedKey = `${input.prefix}/by-content/${createHash('sha256').update('owner').digest('hex').slice(0, 32)}/video-excerpts-private-v3-${buildContentAddressedFileLeaf(input.data, input.mime, namespace)}`;
      storedUrl = `${base}/${storedKey}`;
      await input.beforeUpload?.(storedKey);
      return { key: storedKey, url: storedUrl };
    },
    createUploadVideoThumbnail: async input => {
      uploads.push({ acl: input.acl, cacheControl: input.cacheControl, location: input.privateStorageScope });
      thumbnailUrl = `${base}/user-asset-thumbs/owner/video-excerpts-private-v3-excerpt.jpg`;
      return thumbnailUrl;
    },
    recordUserAsset: async input => { records.push(input.metadata!); return input.assetId!; },
    ensureReusableAsset: async input => { assert.equal(input.allowRemoteThumbnailFallback, false); records.push(input.metadata!); return { publicId: outputRef.assetId } as never; },
    claimStorageObjectProducer: async ({ objectKey }) => ({ objectKey, claimId: 'claim', leaseExpiresAt: new Date('2030-01-01') }),
    renewStorageObjectProducer: async ({ claim }) => claim, settleStorageObjectProducer: async () => {}, scheduleProducerHeartbeat: () => () => {},
  });
  const result = await prepareVideoExcerpt('owner', { source: sourceRef, engineId: 'luma-ray-3-2', mode: 'v2v', range }, {
    engine: async id => getBaseEngineIncludingHidden(id),
    resolve: async (_user, ref) => (ref as typeof sourceRef).assetId === sourceRef.assetId ? source : {
      ...source, id: 'excerpt', ref: outputRef, url: storedUrl, thumbUrl: thumbnailUrl, originalAccess: { type: 'owned-storage', storageKey: storedKey },
    },
    readAccess: createConversationMediaReadAccess,
    download: async file => {
      assert.equal(new URL(file.download_url).pathname, '/user-assets/owner/private.mp4');
      assert.ok(new URL(file.download_url).searchParams.get('X-Amz-Signature'));
      return { bytes: Buffer.from('source'), fileName: 'private.mp4', mimeType: 'video/mp4' };
    },
    inspect: async () => facts, trim: async () => ({ bytes: Buffer.from('excerpt'), facts: outputFacts }),
    persist: (user, bytes, measured, lineage) => persistVideoExcerpt(user, bytes, measured, lineage, store),
  });
  assert.deepEqual(uploads, [ { acl: null, cacheControl: 'private, no-store', location: 'video-excerpt' }, { acl: null, cacheControl: 'private, no-store', location: 'video-excerpt' } ]);
  assert.equal(records.length, 2);
  for (const metadata of records) {
    assert.equal((metadata.videoExcerpt as Record<string, unknown>).version, 3);
    assert.equal((metadata.videoExcerpt as Record<string, unknown>).storageAccess, 'private');
  }
  const lineage = records[0].videoExcerpt as Record<string, unknown>;
  const { storageAccess: _private, ...oldLineage } = { ...lineage, version: 1 };
  const oldNamespace = `video-excerpt-v1-${createHash('sha256').update(JSON.stringify(oldLineage)).digest('hex')}`;
  assert.notEqual(buildContentAddressedFileLeaf(Buffer.from('excerpt'), 'video/mp4', namespace), buildContentAddressedFileLeaf(Buffer.from('excerpt'), 'video/mp4', oldNamespace));
  assert.equal(result.asset.url, storedUrl);
  assert.equal(new URL(result.asset.previewUrl!).pathname, `/${storedKey}`);
  assert.equal(new URL(result.asset.thumbUrl!).pathname, '/user-asset-thumbs/owner/video-excerpts-private-v3-excerpt.jpg');
  assert.ok(new URL(result.asset.previewUrl!).searchParams.get('X-Amz-Signature'));
  assert.ok(new URL(result.asset.thumbUrl!).searchParams.get('X-Amz-Signature'));
  assert.equal(result.asset.durationSec, 5);
  assert.deepEqual(result.original, sourceRef);
  assert.doesNotMatch(JSON.stringify(records), /X-Amz-|fixture-secret/);
});

test('identical v2 bytes and lineage cannot reuse the old public object or legacy row in v3', async () => {
  const { persistVideoExcerpt } = await import('../frontend/server/video-excerpts/prepare');
  const { createStoreVideoUploadService } = await import('../frontend/src/server/uploads/store-media-upload');
  const { buildContentAddressedFileLeaf } = await import('../frontend/server/storage');
  const rows = new Map<string, string>();
  const store = createStoreVideoUploadService({
    probeMediaBuffer: async () => ({ kind: 'video', canonicalMime: 'video/mp4', detectedMime: 'video/mp4', durationSec: 5, width: 640, height: 480, hasAudio: true }),
    uploadFileBuffer: async input => {
      const leaf = buildContentAddressedFileLeaf(input.data, input.mime, input.contentAddressedNamespace);
      const key = `user-assets/by-content/owner/${input.privateStorageScope ? 'video-excerpts-private-v3-' : ''}${leaf}`;
      await input.beforeUpload?.(key);
      return { key, url: `https://media.example/${key}` };
    },
    createUploadVideoThumbnail: async () => null,
    recordUserAsset: async input => { if (!rows.has(input.assetId!)) rows.set(input.assetId!, input.url); return input.assetId!; },
    ensureReusableAsset: async input => ({ publicId: `ma_${createHash('sha256').update(input.url).digest('hex').slice(0, 32)}` } as never),
    claimStorageObjectProducer: async ({ objectKey }) => ({ objectKey, claimId: 'claim', leaseExpiresAt: new Date('2030-01-01') }),
    renewStorageObjectProducer: async ({ claim }) => claim, settleStorageObjectProducer: async () => {}, scheduleProducerHeartbeat: () => () => {},
  });
  const bytes = Buffer.from('same excerpt bytes');
  const lineage = { version: 2, storageAccess: 'private', encoder: 'h264-aac-v4', source: 'same-owned-source', range: { startSec: 0, endSec: 5 } };
  const namespaceV2 = `video-excerpt-private-v2-${createHash('sha256').update(JSON.stringify(lineage)).digest('hex')}`;
  const old = await store({ userId: 'owner', bytes, fileName: 'video-excerpt.mp4', declaredMime: 'video/mp4', contentAddressedNamespace: namespaceV2, metadata: { videoExcerpt: lineage } });
  const facts: VideoExcerptFacts = { kind: 'video', width: 640, height: 480, durationSec: 5, fps: 30, hasAudio: true, sizeBytes: bytes.length, mimeType: 'video/mp4', videoCodec: 'h264', audioCodec: 'aac' };
  // Even identical lineage must be separated by the v3 namespace, independently of the version field.
  const fresh = await persistVideoExcerpt('owner', bytes, facts, lineage, store);
  assert.notEqual(fresh.legacyAssetId, old.legacyAssetId);
  assert.notEqual(fresh.assetId, old.assetId);
  assert.notEqual(fresh.url, old.storageUrl);
  assert.equal(rows.size, 2);
  assert.equal(rows.get(old.legacyAssetId), old.storageUrl);
  assert.equal(rows.get(fresh.legacyAssetId!), fresh.url);
});
