import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import {
  buildInitialProviderMediaState,
  resolveProviderMediaState,
} from '../frontend/app/api/generate/_lib/provider-media';
import type { GenerateResult } from '../frontend/src/lib/fal';

const root = process.cwd();
const routePath = join(root, 'frontend/app/api/generate/route.ts');
const helperPath = join(root, 'frontend/app/api/generate/_lib/provider-media.ts');

const routeSource = readFileSync(routePath, 'utf8');
const helperSource = readFileSync(helperPath, 'utf8');

const baseResult = (overrides: Partial<GenerateResult> = {}): GenerateResult => ({
  provider: 'fal',
  thumbUrl: '',
  videoUrl: undefined,
  ...overrides,
});

test('generate route delegates provider media handling', () => {
  assert.ok(existsSync(helperPath), 'provider media handling should live in the generate route _lib folder');
  assert.match(routeSource, /from '\.\/_lib\/provider-media'/);
  assert.doesNotMatch(routeSource, /normalizeMediaUrl/, 'media URL normalization belongs in provider-media.ts');
  assert.doesNotMatch(routeSource, /ensureFastStartVideo/, 'fast-start copy belongs in provider-media.ts');
  assert.doesNotMatch(routeSource, /provider_video_copy_failed/, 'provider copy fallback belongs in provider-media.ts');
  assert.doesNotMatch(routeSource, /ensureJobThumbnail/, 'thumbnail generation belongs in provider-media.ts');

  const lineCount = routeSource.split('\n').length;
  assert.ok(lineCount <= 1870, `/api/generate route should stay below 1870 lines after provider media extraction, got ${lineCount}`);
});

test('provider media helper exposes the route contract', () => {
  assert.match(helperSource, /export type ProviderMediaResolution/, 'ProviderMediaResolution should be exported');
  assert.match(helperSource, /export function buildInitialProviderMediaState/, 'buildInitialProviderMediaState should be exported');
  assert.match(helperSource, /export async function resolveProviderMediaState/, 'resolveProviderMediaState should be exported');
});

test('provider media helper builds initial state from provider result fallbacks', () => {
  assert.deepEqual(
    buildInitialProviderMediaState({
      generationResult: baseResult({
        thumbUrl: '',
        videoUrl: 'https://cdn.maxvideoai.com/video.mp4',
        providerJobId: undefined,
      }),
      batchId: 'batch_123',
      placeholderThumb: '/assets/frames/thumb-16x9.svg',
    }),
    {
      thumb: '/assets/frames/thumb-16x9.svg',
      previewFrame: '/assets/frames/thumb-16x9.svg',
      video: 'https://cdn.maxvideoai.com/video.mp4',
      videoAsset: null,
      providerMode: 'fal',
      status: 'completed',
      progress: 100,
      providerJobId: 'batch_123',
    }
  );
});

test('provider media helper applies fast-start copy and generated thumbnail', async () => {
  const videoAsset = {
    url: 'https://provider.example.com/video.mp4',
    mime: 'video/mp4',
    width: 1280,
    height: 720,
    durationSec: 8,
    tags: [],
  };
  const generationResult = baseResult({
    thumbUrl: '/assets/frames/thumb-16x9.svg',
    videoUrl: 'https://provider.example.com/video.mp4',
    video: videoAsset,
    providerJobId: 'provider_123',
  });
  const state = buildInitialProviderMediaState({
    generationResult,
    batchId: null,
    placeholderThumb: '/assets/frames/thumb-16x9.svg',
  });

  const resolved = await resolveProviderMediaState({
    state,
    generationResult,
    jobId: 'job_123',
    userId: 'user_123',
    isLumaRay2: false,
    aspectRatio: '16:9',
    settingsSnapshot: { schemaVersion: 1 },
    settingsSnapshotJson: '{"schemaVersion":1}',
    message: null,
    deps: {
      ensureFastStartVideoFn: async () => 'https://cdn.maxvideoai.com/copied.mp4',
      ensureJobThumbnailFn: async () => 'https://cdn.maxvideoai.com/thumb.jpg',
      isPlaceholderThumbnailFn: () => true,
    },
  });

  assert.equal(resolved.video, 'https://cdn.maxvideoai.com/copied.mp4');
  assert.equal(resolved.videoAsset?.url, 'https://cdn.maxvideoai.com/copied.mp4');
  assert.equal(resolved.thumb, 'https://cdn.maxvideoai.com/thumb.jpg');
  assert.equal(resolved.previewFrame, 'https://cdn.maxvideoai.com/thumb.jpg');
  assert.equal(resolved.videoAsset?.thumbnailUrl, 'https://cdn.maxvideoai.com/thumb.jpg');
});

test('provider media helper defers provider copy miss when retry is allowed', async () => {
  const originalWarn = console.warn;
  console.warn = () => undefined;
  try {
    const settingsSnapshot = { schemaVersion: 1 };
    const generationResult = baseResult({
      thumbUrl: '/assets/frames/thumb-16x9.svg',
      videoUrl: 'https://provider.example.com/video.mp4',
      providerJobId: 'provider_123',
    });
    const state = buildInitialProviderMediaState({
      generationResult,
      batchId: null,
      placeholderThumb: '/assets/frames/thumb-16x9.svg',
    });

    const resolved = await resolveProviderMediaState({
      state,
      generationResult,
      jobId: 'job_123',
      userId: 'user_123',
      isLumaRay2: false,
      aspectRatio: '16:9',
      settingsSnapshot,
      settingsSnapshotJson: '{"schemaVersion":1}',
      message: null,
      deps: {
        ensureFastStartVideoFn: async () => null,
        shouldFailVideoJobOnProviderCopyMissFn: () => true,
        buildNextProviderVideoCopyStateFn: () => ({ retryCount: 1 }) as never,
        shouldRetryProviderVideoCopyFn: () => true,
        isPlaceholderThumbnailFn: () => false,
        buildSafeProviderMediaLogFn: (value) => ({ value }) as never,
        now: () => new Date('2026-05-07T20:00:00.000Z'),
      },
    });

    assert.equal(resolved.video, null);
    assert.equal(resolved.videoAsset, null);
    assert.equal(resolved.status, 'processing');
    assert.equal(resolved.progress, 90);
    assert.equal(resolved.message, 'Generated video is ready. Preparing it for download.');
    assert.deepEqual(settingsSnapshot, {
      schemaVersion: 1,
      providerVideoCopy: { retryCount: 1 },
    });
    assert.equal(resolved.settingsSnapshotJson, '{"schemaVersion":1,"providerVideoCopy":{"retryCount":1}}');
  } finally {
    console.warn = originalWarn;
  }
});

test('provider media helper fails provider copy miss when retry is not allowed', async () => {
  const originalWarn = console.warn;
  console.warn = () => undefined;
  try {
    const generationResult = baseResult({
      thumbUrl: '/assets/frames/thumb-16x9.svg',
      videoUrl: 'https://provider.example.com/video.mp4',
      providerJobId: 'provider_123',
    });
    const state = buildInitialProviderMediaState({
      generationResult,
      batchId: null,
      placeholderThumb: '/assets/frames/thumb-16x9.svg',
    });

    const resolved = await resolveProviderMediaState({
      state,
      generationResult,
      jobId: 'job_123',
      userId: 'user_123',
      isLumaRay2: false,
      aspectRatio: '16:9',
      settingsSnapshot: { schemaVersion: 1 },
      settingsSnapshotJson: '{"schemaVersion":1}',
      message: null,
      deps: {
        ensureFastStartVideoFn: async () => null,
        shouldFailVideoJobOnProviderCopyMissFn: () => true,
        buildNextProviderVideoCopyStateFn: () => ({ retryCount: 5 }) as never,
        shouldRetryProviderVideoCopyFn: () => false,
        isPlaceholderThumbnailFn: () => false,
        buildSafeProviderMediaLogFn: (value) => ({ value }) as never,
      },
    });

    assert.equal(resolved.status, 'failed');
    assert.equal(resolved.progress, 0);
    assert.equal(
      resolved.message,
      'The render finished, but MaxVideoAI could not prepare the video for download. Please retry.'
    );
  } finally {
    console.warn = originalWarn;
  }
});
