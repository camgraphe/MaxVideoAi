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

test('P1 adds exactly seven English canonical routes and 21 localized sitemap locs', () => {
  assert.equal(modelPaths.length - fixture.publishedModelCount, 3);
  assert.equal(comparisonPaths.length - fixture.publishedComparisonCount, 4);
  assert.equal(dynamicPaths.size - fixture.dynamicEnglishCanonicalCount, 7);

  const localizedLocCount = modelRoster.length * 3 + getHubComparisonSlugsForSitemap().reduce(
    (total, slug) => total + getIndexableComparisonLocales(slug).length,
    0,
  );
  assert.equal(localizedLocCount - fixture.localizedLocCount, 21);
  for (const path of fixture.expectedNewEnglishPaths) assert.equal(dynamicPaths.has(path), true, path);
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
