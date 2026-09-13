import assert from 'node:assert/strict';
import test from 'node:test';

import { buildObjectKey, isAllowedAssetHost } from '../frontend/server/storage.ts';
import { claimStorageObjectProducer } from '../frontend/src/server/storage-object-producer-claims';

test('the canonical MaxVideoAI media host stays trusted without optional environment wiring', () => {
  assert.equal(
    isAllowedAssetHost('https://media.maxvideoai.com/user-assets/example/reference.jpg'),
    true
  );
});

test('storage object keys preserve slash-separated prefixes', () => {
  assert.equal(
    buildObjectKey({
      prefix: 'renders/images',
      userId: 'user_test',
      leafName: 'output.jpeg',
    }),
    'renders/images/user_test/output.jpeg'
  );
});

test('a render namespace isolates videos and all gallery derivatives', { concurrency: false }, () => {
  const previousPrefix = process.env.VIDEO_RENDER_STORAGE_PREFIX;
  process.env.VIDEO_RENDER_STORAGE_PREFIX = 'mcp-render-staging/';

  try {
    assert.equal(
      buildObjectKey({ prefix: 'renders', userId: 'user_test', leafName: 'video.mp4' }),
      'mcp-render-staging/user_test/video.mp4'
    );
    assert.equal(
      buildObjectKey({ prefix: 'renders/previews', userId: 'user_test', leafName: 'preview.mp4' }),
      'mcp-render-staging/previews/user_test/preview.mp4'
    );
    assert.equal(
      buildObjectKey({ prefix: 'renders/keyframes', userId: 'user_test', leafName: 'start.jpg' }),
      'mcp-render-staging/keyframes/user_test/start.jpg'
    );
    assert.equal(
      buildObjectKey({ prefix: 'mcp-reference-staging/', userId: 'user_test', leafName: 'source.png' }),
      'mcp-reference-staging/user_test/source.png'
    );
  } finally {
    if (previousPrefix === undefined) {
      delete process.env.VIDEO_RENDER_STORAGE_PREFIX;
    } else {
      process.env.VIDEO_RENDER_STORAGE_PREFIX = previousPrefix;
    }
  }
});

test('a reference namespace isolates reusable library media and thumbnails', { concurrency: false }, () => {
  const previousPrefix = process.env.MCP_STAGING_REFERENCE_STORAGE_PREFIX;
  process.env.MCP_STAGING_REFERENCE_STORAGE_PREFIX = 'mcp-reference-staging/';

  try {
    assert.equal(
      buildObjectKey({ prefix: 'media-assets', userId: 'user_test', leafName: 'video.mp4' }),
      'mcp-reference-staging/media-assets/user_test/video.mp4'
    );
    assert.equal(
      buildObjectKey({ prefix: 'user-asset-thumbs', userId: 'user_test', leafName: 'thumb.jpg' }),
      'mcp-reference-staging/user-asset-thumbs/user_test/thumb.jpg'
    );
    assert.equal(
      buildObjectKey({ prefix: 'user-assets/by-content', userId: 'user_test', leafName: 'source.png' }),
      'mcp-reference-staging/user-assets/by-content/user_test/source.png'
    );
    assert.equal(
      buildObjectKey({ prefix: 'uploads', userId: 'user_test', leafName: 'source.png' }),
      'uploads/user_test/source.png'
    );
  } finally {
    if (previousPrefix === undefined) {
      delete process.env.MCP_STAGING_REFERENCE_STORAGE_PREFIX;
    } else {
      process.env.MCP_STAGING_REFERENCE_STORAGE_PREFIX = previousPrefix;
    }
  }
});

test('a staging-prefixed content-addressed key can acquire the shared producer fence', async () => {
  const objectKey = `mcp-reference-staging/user-assets/by-content/${'a'.repeat(32)}/${'b'.repeat(64)}.png`;
  const claimId = '00000000-0000-4000-8000-000000000099';
  const leaseExpiresAt = new Date('2026-09-13T12:05:00.000Z');
  let persistedKey = '';
  const claim = await claimStorageObjectProducer({ objectKey }, {
    now: new Date('2026-09-13T12:00:00.000Z'),
    claimId,
    executor: {
      async query<T>(_sql: string, params?: unknown[]) {
        persistedKey = String(params?.[0] ?? '');
        return [{ object_key: objectKey, producer_claim_id: claimId, producer_lease_expires_at: leaseExpiresAt }] as T[];
      },
    },
  });

  assert.equal(persistedKey, objectKey);
  assert.equal(claim.objectKey, objectKey);
});
