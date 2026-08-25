import assert from 'node:assert/strict';
import test from 'node:test';

import { buildObjectKey } from '../frontend/server/storage.ts';

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
