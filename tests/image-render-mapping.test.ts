import assert from 'node:assert/strict';
import test from 'node:test';

import { buildStoredImageRenderEntries, resolveHeroThumbFromRenders } from '../frontend/lib/image-renders';

test('image render mapping stores lightweight thumb_url and hero thumb', () => {
  const images = [
    {
      url: 'https://cdn.example.com/full-1.png',
      thumbUrl: 'https://cdn.example.com/thumb-1.webp',
      width: 1024,
      height: 1024,
      mimeType: 'image/png',
    },
    {
      url: 'https://cdn.example.com/full-2.png',
      thumbUrl: 'https://cdn.example.com/thumb-2.webp',
      width: 1024,
      height: 1024,
      mimeType: 'image/png',
    },
  ];

  const stored = buildStoredImageRenderEntries(images);
  assert.equal(stored[0]?.thumb_url, 'https://cdn.example.com/thumb-1.webp');
  assert.equal(resolveHeroThumbFromRenders(images), 'https://cdn.example.com/thumb-1.webp');
});
