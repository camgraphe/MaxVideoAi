import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildImageCountOptionsWithinMax,
  formatImageSizeLabel,
  resolveSeedreamMaxOutputImages,
} from '../frontend/app/(core)/(workspace)/app/image/_lib/image-workspace-utils.ts';

test('GPT Image 2 image size labels expose real dimensions and 4K clearly', () => {
  assert.equal(formatImageSizeLabel('landscape_16_9'), 'Landscape 16:9 · 1920 x 1080');
  assert.equal(formatImageSizeLabel('portrait_16_9'), 'Portrait · 1024 x 1536');
  assert.equal(formatImageSizeLabel('3840x2160'), '4K · 3840 x 2160');
  assert.equal(formatImageSizeLabel('1024x768'), '1024 x 768');
});

test('Seedream output count leaves room for selected reference images', () => {
  assert.equal(resolveSeedreamMaxOutputImages(0), 15);
  assert.equal(resolveSeedreamMaxOutputImages(3), 12);
  assert.equal(resolveSeedreamMaxOutputImages(10), 5);
  assert.equal(resolveSeedreamMaxOutputImages(20), 1);
});

test('Image count options clamp to the reference-aware maximum', () => {
  const options = [1, 2, 4, 6, 8, 15].map((value) => ({
    value,
    label: `${value} image${value === 1 ? '' : 's'}`,
  }));

  assert.deepEqual(
    buildImageCountOptionsWithinMax({
      options,
      max: 12,
      labelForCount: (count) => `${count} images`,
    }),
    [
      { value: 1, label: '1 image' },
      { value: 2, label: '2 images' },
      { value: 4, label: '4 images' },
      { value: 6, label: '6 images' },
      { value: 8, label: '8 images' },
      { value: 12, label: '12 images' },
    ]
  );

  assert.deepEqual(
    buildImageCountOptionsWithinMax({
      options,
      max: 1,
      labelForCount: (count) => `${count} image`,
    }),
    [{ value: 1, label: '1 image' }]
  );
});
