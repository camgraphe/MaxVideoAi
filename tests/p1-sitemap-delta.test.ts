import assert from 'node:assert/strict';
import test from 'node:test';

import modelRoster from '../frontend/config/model-roster.json' with { type: 'json' };
import fixture from './fixtures/p1-production-routes-before.json' with { type: 'json' };
import { getHubComparisonSlugsForSitemap } from '../frontend/lib/compare-hub/data.ts';
import { getIndexableComparisonLocales } from '../frontend/lib/compare-hub/indexation.ts';

const comparisonPaths = getHubComparisonSlugsForSitemap().map(
  (slug) => `/ai-video-engines/${slug}`,
);
const modelPaths = modelRoster.map(({ modelSlug }) => `/models/${modelSlug}`);
const dynamicPaths = new Set([...modelPaths, ...comparisonPaths]);

test('P1 and subsequent candidates add seventeen English routes, retaining Nano21 and the two Kling V4 comparisons', () => {
  assert.equal(modelPaths.length - fixture.publishedModelCount, 8);
  assert.equal(comparisonPaths.length - fixture.publishedComparisonCount, 9);
  assert.equal(dynamicPaths.size - fixture.dynamicEnglishCanonicalCount, 17);

  const localizedLocCount = modelRoster.length * 3 + getHubComparisonSlugsForSitemap().reduce(
    (total, slug) => total + getIndexableComparisonLocales(slug).length,
    0,
  );
  // Preserve the candidate Nano21/model inventory; the two new comparisons contribute six locale URLs.
  assert.equal(localizedLocCount - fixture.localizedLocCount, 38 - 82 + 3 + 6);
  const v4 = modelRoster.find(model => model.modelSlug === 'kling-v4');
  assert.ok(v4);
  assert.deepEqual(v4.surfaces.modelPage, { indexable: true, includeInSitemap: true });
  assert.equal(dynamicPaths.has('/models/kling-v4'), true);
  const nano21 = modelRoster.find(model => model.modelSlug === 'nano-banana-2-1');
  assert.ok(nano21);
  assert.deepEqual(nano21.surfaces.modelPage, { indexable: true, includeInSitemap: true });
  assert.equal(dynamicPaths.has('/models/nano-banana-2-1'), true);
  for (const path of fixture.expectedNewEnglishPaths) assert.equal(dynamicPaths.has(path), true, path);
  for (const path of [
    '/models/flux-3-max',
    '/ai-video-engines/flux-3-vs-flux-3-max',
    '/ai-video-engines/seedance-2-5-vs-wan-3',
    '/ai-video-engines/minimax-h3-max-vs-seedance-2-5',
  ]) assert.equal(dynamicPaths.has(path), true, path);
  for (const path of fixture.protectedEnglishPaths) assert.equal(dynamicPaths.has(path), true, path);
});

test('aliases and excluded products add no canonical route', () => {
  for (const path of [
    '/models/gemini-omni-flash-1-1',
    '/models/gemini-omni-1-1-flash',
    '/models/gemini-omni-flash-1-0',
    '/models/minimax-h3-max-turbo',
  ]) {
    assert.equal(dynamicPaths.has(path), false, path);
  }
  assert.equal([...dynamicPaths].some((path) => path.toLowerCase().includes('runway')), false);
});
