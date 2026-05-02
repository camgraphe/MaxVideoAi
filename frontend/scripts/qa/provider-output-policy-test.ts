import assert from 'node:assert/strict';

import { normalizeMediaUrl } from '../../lib/media';
import {
  buildSafeProviderMediaLog,
  buildNextProviderVideoCopyState,
  getProviderVideoCopyState,
  isProviderVideoCopyRetryDue,
  PROVIDER_VIDEO_COPY_RETRY_MESSAGE,
  resolveProviderVideoCopyMaxAttempts,
  shouldFailVideoJobOnProviderCopyMiss,
  shouldRetryProviderVideoCopy,
} from '../../server/provider-output-policy';

const previousRequireCopy = process.env.REQUIRE_PROVIDER_VIDEO_COPY_FOR_FAL;
const previousS3PublicBaseUrl = process.env.S3_PUBLIC_BASE_URL;
const previousS3Bucket = process.env.S3_BUCKET;
const previousS3Region = process.env.S3_REGION;

try {
  process.env.REQUIRE_PROVIDER_VIDEO_COPY_FOR_FAL = 'true';
  process.env.S3_PUBLIC_BASE_URL = 'https://cdn.maxvideoai.com';
  process.env.S3_BUCKET = 'maxvideoai-renders';
  process.env.S3_REGION = 'eu-west-3';

  assert.equal(
    shouldFailVideoJobOnProviderCopyMiss({
      provider: 'fal',
      sourceUrl: 'https://v3.fal.media/files/example/video.mp4',
      copiedUrl: null,
      currentJobStatus: 'running',
    }),
    true,
    'fal provider URL must fail completion when mandatory copy is enabled and no S3 copy exists'
  );

  assert.equal(
    shouldFailVideoJobOnProviderCopyMiss({
      provider: 'fal',
      sourceUrl: 'https://v3.fal.media/files/example/video.mp4',
      copiedUrl: null,
      currentJobStatus: 'completed',
    }),
    false,
    'completed fal jobs must never be failed retroactively when mandatory copy is enabled'
  );

  assert.equal(
    shouldFailVideoJobOnProviderCopyMiss({
      provider: 'fal',
      sourceUrl: 'https://v3.fal.media/files/example/video.mp4',
      copiedUrl: 'https://cdn.maxvideoai.com/renders/job-faststart.mp4',
      currentJobStatus: 'running',
    }),
    false,
    'fal provider URL must not fail when an S3 copy exists'
  );

  assert.equal(
    shouldFailVideoJobOnProviderCopyMiss({
      provider: 'fal',
      sourceUrl: 'https://v3.fal.media/files/example/video.mp4',
      copiedUrl: 'https://cdn.maxvideoai.com/renders/job-faststart.mp4',
      currentJobStatus: 'completed',
    }),
    false,
    'completed fal jobs with a successful copy can be upgraded without being treated as failures'
  );

  assert.equal(
    shouldFailVideoJobOnProviderCopyMiss({
      provider: 'fal',
      sourceUrl: 'https://cdn.maxvideoai.com/renders/job-faststart.mp4',
      copiedUrl: null,
    }),
    false,
    'already managed storage URLs must not be treated as copy failures'
  );

  process.env.REQUIRE_PROVIDER_VIDEO_COPY_FOR_FAL = 'false';
  assert.equal(
    shouldFailVideoJobOnProviderCopyMiss({
      provider: 'fal',
      sourceUrl: 'https://v3.fal.media/files/example/video.mp4',
      copiedUrl: null,
    }),
    false,
    'fal copy enforcement must be disabled by default/flag off'
  );

  process.env.REQUIRE_PROVIDER_VIDEO_COPY_FOR_FAL = 'true';
  assert.equal(
    shouldFailVideoJobOnProviderCopyMiss({
      provider: 'byteplus_modelark',
      sourceUrl: 'https://ark.example/output.mp4',
      copiedUrl: null,
    }),
    false,
    'fal-specific enforcement must not change BytePlus policy'
  );

  const safeLog = buildSafeProviderMediaLog('https://v3.fal.media/files/private/path/video.mp4?token=secret');
  assert.deepEqual(safeLog, {
    present: true,
    host: 'v3.fal.media',
    managedStorage: false,
  });
  assert.equal(
    normalizeMediaUrl('https://maxvideoai-renders.s3.eu-west-3.amazonaws.com/renders/job/video.mp4?x=1'),
    'https://cdn.maxvideoai.com/renders/job/video.mp4?x=1',
    'managed S3 URLs should be rewritten to S3_PUBLIC_BASE_URL when configured'
  );

  assert.equal(PROVIDER_VIDEO_COPY_RETRY_MESSAGE.length > 0, true);
  assert.equal(resolveProviderVideoCopyMaxAttempts('3'), 3);
  assert.equal(resolveProviderVideoCopyMaxAttempts('0'), 6);
  assert.deepEqual(getProviderVideoCopyState({}), {
    attempts: 0,
    firstFailedAt: null,
    lastFailedAt: null,
    lastProviderStatus: null,
    lastReason: null,
    nextRetryAt: null,
  });
  assert.deepEqual(
    buildNextProviderVideoCopyState(
      {
        providerVideoCopy: {
          attempts: 1,
          firstFailedAt: '2026-05-02T18:10:00.000Z',
        },
      },
      {
        nowIso: '2026-05-02T18:12:00.000Z',
        providerStatus: 'completed',
        reason: 'provider_video_copy_failed',
      }
    ),
    {
      attempts: 2,
      firstFailedAt: '2026-05-02T18:10:00.000Z',
      lastFailedAt: '2026-05-02T18:12:00.000Z',
      lastProviderStatus: 'completed',
      lastReason: 'provider_video_copy_failed',
      nextRetryAt: '2026-05-02T18:17:00.000Z',
    }
  );
  assert.equal(
    isProviderVideoCopyRetryDue(
      {
        nextRetryAt: '2026-05-02T18:17:00.000Z',
      },
      Date.parse('2026-05-02T18:16:59.000Z')
    ),
    false
  );
  assert.equal(
    isProviderVideoCopyRetryDue(
      {
        nextRetryAt: '2026-05-02T18:17:00.000Z',
      },
      Date.parse('2026-05-02T18:17:00.000Z')
    ),
    true
  );
  assert.equal(
    shouldRetryProviderVideoCopy({
      state: { attempts: 2 },
      createdAt: '2026-05-02T18:00:00.000Z',
      nowMs: Date.parse('2026-05-02T18:12:00.000Z'),
      maxAttempts: 3,
    }),
    true
  );
  assert.equal(
    shouldRetryProviderVideoCopy({
      state: { attempts: 3 },
      createdAt: '2026-05-02T18:00:00.000Z',
      nowMs: Date.parse('2026-05-02T18:12:00.000Z'),
      maxAttempts: 3,
    }),
    false
  );
  assert.equal(
    shouldRetryProviderVideoCopy({
      state: { attempts: 1 },
      createdAt: '2026-05-02T18:00:00.000Z',
      nowMs: Date.parse('2026-05-02T20:59:00.000Z'),
      maxAttempts: 6,
    }),
    true
  );
  assert.equal(
    shouldRetryProviderVideoCopy({
      state: { attempts: 1 },
      createdAt: '2026-05-02T18:00:00.000Z',
      nowMs: Date.parse('2026-05-02T21:01:00.000Z'),
      maxAttempts: 6,
    }),
    false
  );
} finally {
  if (previousRequireCopy === undefined) {
    delete process.env.REQUIRE_PROVIDER_VIDEO_COPY_FOR_FAL;
  } else {
    process.env.REQUIRE_PROVIDER_VIDEO_COPY_FOR_FAL = previousRequireCopy;
  }
  if (previousS3PublicBaseUrl === undefined) {
    delete process.env.S3_PUBLIC_BASE_URL;
  } else {
    process.env.S3_PUBLIC_BASE_URL = previousS3PublicBaseUrl;
  }
  if (previousS3Bucket === undefined) {
    delete process.env.S3_BUCKET;
  } else {
    process.env.S3_BUCKET = previousS3Bucket;
  }
  if (previousS3Region === undefined) {
    delete process.env.S3_REGION;
  } else {
    process.env.S3_REGION = previousS3Region;
  }
}
