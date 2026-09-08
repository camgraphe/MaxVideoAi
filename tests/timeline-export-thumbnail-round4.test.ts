import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildPublicStorageUrl, StorageUploadError } from '../frontend/server/storage';

test('streamed export publication creates a local thumbnail and skips remote recopy paths', async () => {
  const renderer = await import('../frontend/src/server/timeline-exports/renderer');
  const publish = Reflect.get(renderer, 'publishTimelineExportArtifactWithDependencies');
  assert.equal(typeof publish, 'function', 'renderer needs a testable local artifact publication boundary');
  let localThumbnailCalls = 0;
  let remoteFetches = 0;
  let ensured: Record<string, unknown> | null = null;
  const thumbUrl = 'https://cdn.maxvideoai.com/user-asset-thumbs/user-round4/export.jpg';
  const asset = await publish({
    outputPath: '/tmp/export.mp4',
    outputSize: 1024,
    userId: 'user-round4',
    exportId: 'export-round4',
    projectName: 'Round 4',
    width: 1920,
    height: 1080,
  }, {
    createLocalThumbnail: async (params: Record<string, unknown>) => {
      localThumbnailCalls += 1;
      assert.equal(params.path, '/tmp/export.mp4');
      return thumbUrl;
    },
    uploadPath: async () => ({
      key: 'timeline-exports/user-round4/export.mp4',
      url: 'https://cdn.maxvideoai.com/timeline-exports/user-round4/export.mp4',
    }),
    ensureAsset: async (params: Record<string, unknown>) => {
      ensured = params;
      if (!params.thumbUrl) remoteFetches += 1;
      return {
        id: 'export-asset', userId: 'user-round4', kind: 'video', url: String(params.url), thumbUrl: String(params.thumbUrl),
        previewUrl: null, mimeType: 'video/mp4', width: 1920, height: 1080, sizeBytes: 1024, durationSec: null,
        source: 'import', sourceJobId: 'export-round4', sourceOutputId: null, status: 'ready', metadata: {},
      };
    },
    deleteRemote: async () => true,
  });

  assert.equal(localThumbnailCalls, 1);
  assert.equal(remoteFetches, 0);
  assert.equal(ensured?.trustedRemoteSource, undefined);
  assert.equal(ensured?.allowRemoteThumbnailFallback, false);
  assert.equal(ensured?.thumbUrl, thumbUrl);
  assert.equal(asset.thumbUrl, thumbUrl);

  const rendererSource = readFileSync('frontend/src/server/timeline-exports/renderer.ts', 'utf8');
  assert.doesNotMatch(rendererSource, /Buffer\.concat|readFile(?:Sync)?\(outputPath\)|createRemoteVideoAssetThumbnail/);
  assert.match(rendererSource, /createVideoThumbnailFromFile/);
});

test('streamed export removes its thumbnail when MP4 upload fails', async () => {
  const renderer = await import('../frontend/src/server/timeline-exports/renderer');
  const publish = Reflect.get(renderer, 'publishTimelineExportArtifactWithDependencies');
  const deleted: string[] = [];
  let registrationCalls = 0;
  const thumbUrl = 'https://cdn.maxvideoai.com/user-asset-thumbs/user-round5/export.jpg';
  await assert.rejects(() => publish({
    outputPath: '/tmp/export.mp4', outputSize: 1024, userId: 'user-round5', exportId: 'export-round5',
    projectName: 'Round 5', width: 1920, height: 1080,
  }, {
    createLocalThumbnail: async () => thumbUrl,
    uploadPath: async () => { throw new Error('MP4_UPLOAD_FAILED'); },
    ensureAsset: async () => { registrationCalls += 1; throw new Error('unexpected registration'); },
    deleteRemote: async (url: string) => { deleted.push(url); return true; },
  }), /MP4_UPLOAD_FAILED/);
  assert.equal(registrationCalls, 0);
  assert.deepEqual(deleted, [thumbUrl]);
});

test('streamed export removes an ambiguously accepted MP4 by its allocated storage key', async () => {
  const renderer = await import('../frontend/src/server/timeline-exports/renderer');
  const publish = Reflect.get(renderer, 'publishTimelineExportArtifactWithDependencies');
  const deleted: string[] = [];
  const thumbUrl = 'https://cdn.maxvideoai.com/user-asset-thumbs/user-round6/export.jpg';
  const attemptedKey = 'timeline-exports/user-round6/allocated-export.mp4';
  const attemptedUrl = buildPublicStorageUrl(attemptedKey);
  await assert.rejects(() => publish({
    outputPath: '/tmp/export.mp4', outputSize: 1024, userId: 'user-round6', exportId: 'export-round6',
    projectName: 'Round 6', width: 1920, height: 1080,
  }, {
    createLocalThumbnail: async () => thumbUrl,
    uploadPath: async () => {
      throw new StorageUploadError('STORAGE_UPLOAD_TIMEOUT', {
        key: attemptedKey,
        prefix: 'timeline-exports',
        userId: 'user-round6',
      });
    },
    ensureAsset: async () => { throw new Error('unexpected registration'); },
    deleteRemote: async (url: string) => { deleted.push(url); return true; },
  }), /STORAGE_UPLOAD_TIMEOUT/);
  assert.deepEqual(new Set(deleted), new Set([attemptedUrl, thumbUrl]));
});

test('streamed export removes MP4 and thumbnail when registration fails', async () => {
  const renderer = await import('../frontend/src/server/timeline-exports/renderer');
  const publish = Reflect.get(renderer, 'publishTimelineExportArtifactWithDependencies');
  const deleted: string[] = [];
  const thumbUrl = 'https://cdn.maxvideoai.com/user-asset-thumbs/user-round5/export.jpg';
  const outputUrl = 'https://cdn.maxvideoai.com/timeline-exports/user-round5/export.mp4';
  await assert.rejects(() => publish({
    outputPath: '/tmp/export.mp4', outputSize: 1024, userId: 'user-round5', exportId: 'export-round5',
    projectName: 'Round 5', width: 1920, height: 1080,
  }, {
    createLocalThumbnail: async () => thumbUrl,
    uploadPath: async () => ({ key: 'timeline-exports/user-round5/export.mp4', url: outputUrl }),
    ensureAsset: async () => { throw new Error('REGISTRATION_FAILED'); },
    deleteRemote: async (url: string) => { deleted.push(url); return true; },
  }), /REGISTRATION_FAILED/);
  assert.deepEqual(new Set(deleted), new Set([outputUrl, thumbUrl]));
});
