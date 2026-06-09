import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateLumaAgentsImageReferencePrice,
  calculateLumaRay32ReferencePrice,
} from '../frontend/src/lib/luma-agents-pricing';

test('Luma Uni-1 fal-reference pricing uses source/reference image counts', () => {
  assert.equal(
    calculateLumaAgentsImageReferencePrice({
      engineId: 'luma-uni-1',
      mode: 't2i',
      referenceImageCount: 0,
    }).totalUsd,
    0.042
  );
  assert.equal(
    calculateLumaAgentsImageReferencePrice({
      engineId: 'luma-uni-1',
      mode: 'i2i',
      referenceImageCount: 0,
    }).totalUsd,
    0.045
  );
  assert.equal(
    calculateLumaAgentsImageReferencePrice({
      engineId: 'luma-uni-1',
      mode: 'i2i',
      referenceImageCount: 3,
    }).totalUsd,
    0.054
  );
});

test('Luma Uni-1 Max fal-reference pricing charges source plus references separately', () => {
  assert.equal(
    calculateLumaAgentsImageReferencePrice({
      engineId: 'luma-uni-1-max',
      mode: 't2i',
      referenceImageCount: 0,
    }).totalUsd,
    0.102
  );
  assert.equal(
    calculateLumaAgentsImageReferencePrice({
      engineId: 'luma-uni-1-max',
      mode: 'i2i',
      referenceImageCount: 2,
    }).totalUsd,
    0.111
  );
});

test('Luma Ray 3.2 fal-reference pricing uses 5s and 10s totals by resolution', () => {
  assert.equal(calculateLumaRay32ReferencePrice({ duration: '5s', resolution: '540p' }).totalUsd, 0.5);
  assert.equal(calculateLumaRay32ReferencePrice({ duration: '5s', resolution: '720p' }).totalUsd, 1);
  assert.equal(calculateLumaRay32ReferencePrice({ duration: '5s', resolution: '1080p' }).totalUsd, 2);
  assert.equal(calculateLumaRay32ReferencePrice({ duration: '10s', resolution: '540p' }).totalUsd, 1);
  assert.equal(calculateLumaRay32ReferencePrice({ duration: '10s', resolution: '720p' }).totalUsd, 2);
  assert.equal(calculateLumaRay32ReferencePrice({ duration: '10s', resolution: '1080p' }).totalUsd, 4);
});

test('Luma Ray 3.2 rejects non-public fallback-safe pricing combinations', () => {
  assert.throws(
    () => calculateLumaRay32ReferencePrice({ duration: '9s', resolution: '720p' }),
    /Luma Ray 3.2 supports 5s or 10s/
  );
  assert.throws(
    () => calculateLumaRay32ReferencePrice({ duration: '5s', resolution: '4k' }),
    /Luma Ray 3.2 supports 540p, 720p, or 1080p/
  );
  assert.throws(
    () => calculateLumaRay32ReferencePrice({ duration: undefined, resolution: '720p' }),
    /Luma Ray 3.2 supports 5s or 10s/
  );
  assert.throws(
    () => calculateLumaRay32ReferencePrice({ duration: '5s', resolution: undefined }),
    /Luma Ray 3.2 supports 540p, 720p, or 1080p/
  );
});
