import assert from 'node:assert/strict';
import test from 'node:test';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { buildSpecValues } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-spec-values';

test('model specs keep the current quote ahead of authored historical prices', () => {
  const entry = getFalEngineById('pika-text-to-video')!;
  const values = buildSpecValues(entry, { pricePerSecond: '$9.99/s', pricePerImage: '$8.88/image',
    releaseDate: '2025-01-01', maxDuration: '10s' }, {
    pricePerSecond: '$0.062/s', pricePerImage: '$0.47/image',
  });
  assert.equal(values.pricePerSecond, '$0.062/s');
  assert.equal(values.pricePerImage, '$0.47/image');
  assert.equal(values.releaseDate, '2025-01-01');
  assert.equal(values.maxDuration, '10s');
});

test('unavailable current model specs never expose an authored or catalogue price', () => {
  for (const modelId of ['pika-text-to-video', 'gpt-image-2-5-flare']) {
    const entry = getFalEngineById(modelId)!;
    for (const overrides of [undefined, { pricePerSecond: null, pricePerImage: null }]) {
      const values = buildSpecValues(entry, { pricePerSecond: '$9.99/s', pricePerImage: '$8.88/image' }, overrides);
      assert.equal(values.pricePerSecond, 'Data pending');
      assert.equal(values.pricePerImage, 'Data pending');
    }
  }
});
