import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCanonicalCompareSlug,
  buildCompareRoute,
  buildPublishedComparisonSlugsFromModels,
  canonicalizeComparePair,
  canonicalizePublishedCompareSlug,
  type ComparisonPublicationModel,
} from '../frontend/lib/compare-hub/pairs.ts';

function model(
  id: string,
  slug: string,
  publishedPairIds: readonly string[],
  flags: { published: boolean; indexed: boolean } = { published: true, indexed: true },
): ComparisonPublicationModel {
  return { id, slug, publication: { compare: { ...flags, publishedPairIds } } };
}

test('pair links use canonical slug order while preserving the requested left side', () => {
  assert.deepEqual(canonicalizeComparePair('zeta-video', 'alpha-video'), {
    leftSlug: 'alpha-video', rightSlug: 'zeta-video',
  });
  assert.equal(buildCanonicalCompareSlug('zeta-video', 'alpha-video'), 'alpha-video-vs-zeta-video');
  assert.equal(buildCanonicalCompareSlug('alpha-video', 'zeta-video'), 'alpha-video-vs-zeta-video');
  assert.deepEqual(buildCompareRoute('alpha-video', 'zeta-video'), {
    slug: 'alpha-video-vs-zeta-video', order: undefined,
  });
  assert.deepEqual(buildCompareRoute('zeta-video', 'alpha-video'), {
    slug: 'alpha-video-vs-zeta-video', order: 'zeta-video',
  });
});

test('published slug normalization preserves incomplete slugs and canonicalizes either direction', () => {
  assert.equal(canonicalizePublishedCompareSlug('zeta-video-vs-alpha-video'), 'alpha-video-vs-zeta-video');
  assert.equal(canonicalizePublishedCompareSlug('alpha-video-vs-zeta-video'), 'alpha-video-vs-zeta-video');
  for (const slug of ['alpha-video', 'alpha-video-vs-', '-vs-zeta-video']) {
    assert.equal(canonicalizePublishedCompareSlug(slug), slug);
  }
});

test('publication accepts either declared pair direction and uses model slugs instead of IDs', () => {
  for (const models of [
    [model('left-id', 'zeta-video', ['right-id']), model('right-id', 'alpha-video', [])],
    [model('left-id', 'zeta-video', []), model('right-id', 'alpha-video', ['left-id'])],
  ]) {
    assert.deepEqual(buildPublishedComparisonSlugsFromModels(models, () => true), ['alpha-video-vs-zeta-video']);
  }
});

test('publication requires published and indexed flags independently on each endpoint', () => {
  for (const endpoint of ['left', 'right']) {
    for (const flag of ['published', 'indexed'] as const) {
      const flags = { published: true, indexed: true, [flag]: false };
      const models = [
        model('left', 'alpha-video', ['right'], endpoint === 'left' ? flags : undefined),
        model('right', 'zeta-video', ['left'], endpoint === 'right' ? flags : undefined),
      ];
      assert.deepEqual(buildPublishedComparisonSlugsFromModels(models, () => true), [], `${endpoint}.${flag}`);
    }
  }
});

test('publication ignores unknown opponents and self references before checking scoreboards', () => {
  const visited: string[] = [];
  assert.deepEqual(buildPublishedComparisonSlugsFromModels([
    model('left', 'alpha-video', ['missing', 'left']),
  ], (slug) => { visited.push(slug); return true; }), []);
  assert.deepEqual(visited, []);
});

test('publication deduplicates reciprocal and repeated pairs and returns sorted canonical slugs', () => {
  const models = [
    model('zeta', 'zeta-video', ['beta', 'alpha', 'beta']),
    model('beta', 'beta-video', ['zeta', 'alpha']),
    model('alpha', 'alpha-video', ['zeta', 'beta']),
  ];
  const expected = ['alpha-video-vs-beta-video', 'alpha-video-vs-zeta-video', 'beta-video-vs-zeta-video'];
  assert.deepEqual(buildPublishedComparisonSlugsFromModels(models, () => true), expected);
  assert.deepEqual(buildPublishedComparisonSlugsFromModels([...models].reverse(), () => true), expected);
});

test('publication checks localized scoreboard completeness against canonical slugs', () => {
  const visited: string[] = [];
  const result = buildPublishedComparisonSlugsFromModels([
    model('zeta', 'zeta-video', ['beta', 'alpha']),
    model('beta', 'beta-video', []),
    model('alpha', 'alpha-video', []),
  ], (slug) => {
    visited.push(slug);
    return slug === 'alpha-video-vs-zeta-video';
  });
  assert.deepEqual(visited, ['beta-video-vs-zeta-video', 'alpha-video-vs-zeta-video']);
  assert.deepEqual(result, ['alpha-video-vs-zeta-video']);
});
