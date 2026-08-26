import assert from 'node:assert/strict';
import test from 'node:test';

import {
  promoteCompletedMcpJobOutputs,
  type McpOutputLibraryPromotionDependencies,
} from '../frontend/server/media-library/mcp-output-assets';
import type { JobOutputRecord, MediaAssetRecord } from '../frontend/server/media-library';

const completedVideo: JobOutputRecord = {
  id: 'quote-1:video:0',
  jobId: 'quote-1',
  userId: 'user-1',
  kind: 'video',
  url: 'https://cdn.example.com/render.mp4',
  storageUrl: null,
  thumbUrl: 'https://cdn.example.com/thumb.jpg',
  previewUrl: 'https://cdn.example.com/preview.mp4',
  mimeType: 'video/mp4',
  width: 1280,
  height: 720,
  durationSec: 5,
  position: 0,
  status: 'ready',
  metadata: {},
};

function assetRecord(input: Parameters<McpOutputLibraryPromotionDependencies['ensureReusableAsset']>[0]): MediaAssetRecord {
  return {
    id: `output:${input.sourceOutputId}`,
    publicId: 'ma_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    userId: input.userId,
    kind: input.kind,
    url: input.url,
    thumbUrl: input.thumbUrl ?? null,
    previewUrl: input.previewUrl ?? null,
    mimeType: input.mimeType ?? null,
    width: input.width ?? null,
    height: input.height ?? null,
    sizeBytes: null,
    durationSec: input.durationSec ?? null,
    source: 'saved_job_output',
    sourceJobId: input.sourceJobId ?? null,
    sourceOutputId: input.sourceOutputId ?? null,
    status: 'ready',
    metadata: input.metadata ?? {},
  };
}

test('accepted MCP job outputs become reusable assets with idempotent output identity', async () => {
  const ensured: Array<Parameters<McpOutputLibraryPromotionDependencies['ensureReusableAsset']>[0]> = [];
  const dependencies: McpOutputLibraryPromotionDependencies = {
    executor: {
      query: async <TRecord>() => [{ job_id: 'quote-1' }] as TRecord[],
    },
    ensureReusableAsset: async (input) => {
      ensured.push(input);
      return assetRecord(input);
    },
  };

  const result = await promoteCompletedMcpJobOutputs([completedVideo], dependencies);

  assert.deepEqual(result, { promoted: 1, failed: 0, skipped: 0 });
  assert.equal(ensured.length, 1);
  assert.deepEqual(ensured[0], {
    userId: 'user-1',
    url: completedVideo.url,
    kind: 'video',
    source: 'saved_job_output',
    sourceJobId: 'quote-1',
    sourceOutputId: 'quote-1:video:0',
    mimeType: 'video/mp4',
    width: 1280,
    height: 720,
    durationSec: 5,
    thumbUrl: completedVideo.thumbUrl,
    previewUrl: completedVideo.previewUrl,
    metadata: { mcpGenerated: true },
  });
});

test('ordinary site outputs are not auto-promoted by the MCP path', async () => {
  let ensureCalls = 0;
  const result = await promoteCompletedMcpJobOutputs([completedVideo], {
    executor: { query: async <TRecord>() => [] as TRecord[] },
    ensureReusableAsset: async (input) => {
      ensureCalls += 1;
      return assetRecord(input);
    },
  });

  assert.deepEqual(result, { promoted: 0, failed: 0, skipped: 1 });
  assert.equal(ensureCalls, 0);
});

test('asset copy failures stay retryable without failing the completed generation', async () => {
  const result = await promoteCompletedMcpJobOutputs([completedVideo], {
    executor: {
      query: async <TRecord>() => [{ job_id: 'quote-1' }] as TRecord[],
    },
    ensureReusableAsset: async () => {
      throw new Error('storage temporarily unavailable');
    },
  });

  assert.deepEqual(result, { promoted: 0, failed: 1, skipped: 0 });
});
