import assert from 'node:assert/strict';
import test from 'node:test';

import { extractRenderIds, extractRenderThumbUrls, parseStoredImageRenders } from '../frontend/lib/image-renders';

test('render_ids legacy string[] keeps renderIds and no renderThumbUrls', () => {
  const parsed = parseStoredImageRenders(['https://cdn.example.com/full-1.png', 'https://cdn.example.com/full-2.png']);
  assert.deepEqual(extractRenderIds(parsed.entries), [
    'https://cdn.example.com/full-1.png',
    'https://cdn.example.com/full-2.png',
  ]);
  assert.equal(extractRenderThumbUrls(parsed), undefined);
});

test('render_ids object[] exposes renderIds and renderThumbUrls', () => {
  const parsed = parseStoredImageRenders([
    { url: 'https://cdn.example.com/full-1.png', thumb_url: 'https://cdn.example.com/thumb-1.webp' },
    { url: 'https://cdn.example.com/full-2.png', thumb_url: 'https://cdn.example.com/thumb-2.webp' },
  ]);
  assert.deepEqual(extractRenderIds(parsed.entries), [
    'https://cdn.example.com/full-1.png',
    'https://cdn.example.com/full-2.png',
  ]);
  assert.deepEqual(extractRenderThumbUrls(parsed), [
    'https://cdn.example.com/thumb-1.webp',
    'https://cdn.example.com/thumb-2.webp',
  ]);
});
