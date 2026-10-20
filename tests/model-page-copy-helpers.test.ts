import assert from 'node:assert/strict';
import test from 'node:test';
import { getFalEngineById, listFalEngines } from '../frontend/src/config/falEngines';
import { buildVideoBoundaries, pickCompareEngines } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-copy-helpers';
import type { KeySpecValues } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-specs-types';

const specs = { maxResolution: '1080p', maxDuration: '5–20 seconds',
  videoToVideo: 'Unsupported', imageToVideo: 'Supported', audioOutput: 'Supported' } as KeySpecValues;

test('video boundaries list canonical resolutions rather than mislabeling only the maximum', () => {
  const engine = getFalEngineById('flux-3-max')!;
  for (const locale of ['en', 'fr', 'es'] as const) {
    const boundaries = buildVideoBoundaries(specs, locale, engine.engine.resolutions);
    assert.ok(boundaries.some(line => line.includes('720p / 1080p')));
    const fallback = buildVideoBoundaries(specs, locale);
    assert.ok(fallback.some(line => /[Mm]ax|máxima/.test(line) && line.includes('1080p')));
  }
});

test('Max model comparison follows its configured canonical opponent without filler cards', () => {
  const entries = listFalEngines();
  assert.deepEqual(pickCompareEngines(entries, 'flux-3-max').map(entry => entry.modelSlug), ['flux-3']);
  assert.equal(pickCompareEngines(entries, 'flux-3').length, 3, 'Other model pages retain their existing default count.');
  assert.equal(pickCompareEngines(entries, 'flux-3-max', 2).length, 2, 'An explicit caller limit remains supported.');
});
