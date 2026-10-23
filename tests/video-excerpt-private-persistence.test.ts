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
  const uploads: Array<{ acl?: string | null; cacheControl?: string }> = [];
  const records: Record<string, unknown>[] = [];
  const store = createStoreVideoUploadService({
    probeMediaBuffer: async () => ({ kind: 'video', canonicalMime: 'video/mp4', detectedMime: 'video/mp4', durationSec: 5, width: 640, height: 480, hasAudio: true }),
    uploadFileBuffer: async input => {
      uploads.push({ acl: input.acl, cacheControl: input.cacheControl });
      namespace = input.contentAddressedNamespace!;
      storedKey = `user-assets/by-content/${createHash('sha256').update('owner').digest('hex').slice(0, 32)}/${buildContentAddressedFileLeaf(input.data, input.mime, namespace)}`;
      storedUrl = `${base}/${storedKey}`;
      await input.beforeUpload?.(storedKey);
      return { key: storedKey, url: storedUrl };
    },
    createUploadVideoThumbnail: async input => {
      uploads.push({ acl: input.acl, cacheControl: input.cacheControl });
      thumbnailUrl = `${base}/user-asset-thumbs/owner/excerpt.jpg`;
      return thumbnailUrl;
    },
    recordUserAsset: async input => { records.push(input.metadata!); return input.assetId!; },
    ensureReusableAsset: async input => { records.push(input.metadata!); return { publicId: outputRef.assetId } as never; },
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
  assert.deepEqual(uploads, [ { acl: null, cacheControl: 'private, no-store' }, { acl: null, cacheControl: 'private, no-store' } ]);
  assert.equal(records.length, 2);
  for (const metadata of records) {
    assert.equal((metadata.videoExcerpt as Record<string, unknown>).version, 2);
    assert.equal((metadata.videoExcerpt as Record<string, unknown>).storageAccess, 'private');
  }
  const lineage = records[0].videoExcerpt as Record<string, unknown>;
  const { storageAccess: _private, ...oldLineage } = { ...lineage, version: 1 };
  const oldNamespace = `video-excerpt-v1-${createHash('sha256').update(JSON.stringify(oldLineage)).digest('hex')}`;
  assert.notEqual(buildContentAddressedFileLeaf(Buffer.from('excerpt'), 'video/mp4', namespace), buildContentAddressedFileLeaf(Buffer.from('excerpt'), 'video/mp4', oldNamespace));
  assert.equal(result.asset.url, storedUrl);
  assert.equal(new URL(result.asset.previewUrl!).pathname, `/${storedKey}`);
  assert.equal(new URL(result.asset.thumbUrl!).pathname, '/user-asset-thumbs/owner/excerpt.jpg');
  assert.ok(new URL(result.asset.previewUrl!).searchParams.get('X-Amz-Signature'));
  assert.ok(new URL(result.asset.thumbUrl!).searchParams.get('X-Amz-Signature'));
  assert.equal(result.asset.durationSec, 5);
  assert.deepEqual(result.original, sourceRef);
  assert.doesNotMatch(JSON.stringify(records), /X-Amz-|fixture-secret/);
});
