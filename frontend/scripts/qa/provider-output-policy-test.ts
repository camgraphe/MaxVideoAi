import assert from 'node:assert/strict';

import {
  buildSafeProviderMediaLog,
  shouldFailVideoJobOnProviderCopyMiss,
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
