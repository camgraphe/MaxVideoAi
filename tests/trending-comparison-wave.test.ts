import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import { parseComparePageContentDocument } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides.ts';
import {
  getPublishedComparisonSlugs,
  isPublishedComparisonSlug,
} from '../frontend/lib/compare-hub/data.ts';
import { getIndexableComparisonLocales } from '../frontend/lib/compare-hub/indexation.ts';

const TRENDING_PAIRS = [
  {
    leftId: 'seedance-2-5',
    rightId: 'wan-3',
    slug: 'seedance-2-5-vs-wan-3',
  },
  {
    leftId: 'minimax-h3-max',
    rightId: 'seedance-2-5',
    slug: 'minimax-h3-max-vs-seedance-2-5',
  },
] as const;

const SCORE_FIELDS = [
  'fidelity',
  'visualQuality',
  'motion',
  'consistency',
  'anatomy',
  'textRendering',
  'lipsyncQuality',
  'sequencingQuality',
  'controllability',
  'speedStability',
  'pricing',
] as const;

test('the two trend-led comparisons are reciprocally published from the model registry', () => {
  const registry = JSON.parse(readFileSync('frontend/config/model-registry.json', 'utf8')) as {
    models: Array<{
      id: string;
      publication: { compare: { publishedPairIds: string[] } };
    }>;
  };
  const models = new Map(registry.models.map((model) => [model.id, model]));
  const published = getPublishedComparisonSlugs();

  for (const pair of TRENDING_PAIRS) {
    assert.ok(models.get(pair.leftId)?.publication.compare.publishedPairIds.includes(pair.rightId));
    assert.ok(models.get(pair.rightId)?.publication.compare.publishedPairIds.includes(pair.leftId));
    assert.equal(isPublishedComparisonSlug(pair.slug), true, pair.slug);
    assert.ok(published.includes(pair.slug), pair.slug);
  }
});

test('trend-led comparisons launch as complete scoreboards without face-to-face placeholders', () => {
  const config = JSON.parse(readFileSync('frontend/config/compare-config.json', 'utf8')) as {
    scoreboardOnlyComparisons: string[];
    showdowns: Record<string, unknown>;
  };
  const scores = JSON.parse(readFileSync('data/benchmarks/engine-scores.v1.json', 'utf8')) as {
    scores: Array<Record<string, unknown> & { modelSlug: string }>;
  };

  for (const pair of TRENDING_PAIRS) {
    assert.ok(config.scoreboardOnlyComparisons.includes(pair.slug), pair.slug);
    assert.equal(config.showdowns[pair.slug], undefined, `${pair.slug} must not render empty media slots`);
    const file = `content/comparisons/${pair.slug}.json`;
    assert.equal(existsSync(file), true, file);
    const document = parseComparePageContentDocument(readFileSync(file, 'utf8'), pair.slug, file);
    for (const locale of ['en', 'fr', 'es'] as const) {
      assert.ok(document[locale].meta?.title, `${pair.slug}.${locale}.title`);
      assert.ok(document[locale].meta?.description, `${pair.slug}.${locale}.description`);
      assert.ok(document[locale].quickVerdict?.body, `${pair.slug}.${locale}.verdict`);
      assert.equal(document[locale].primaryLinks?.length, 2, `${pair.slug}.${locale}.links`);
      assert.doesNotMatch(JSON.stringify(document[locale]), /side[- ]by[- ]side|showdown|placeholder/i);
    }
  }

  for (const modelSlug of ['seedance-2-5', 'wan-3', 'minimax-h3-max']) {
    const row = scores.scores.find((score) => score.modelSlug === modelSlug);
    assert.ok(row, modelSlug);
    for (const field of SCORE_FIELDS) {
      assert.equal(typeof row[field], 'number', `${modelSlug}.${field}`);
      assert.ok(Number.isFinite(row[field] as number), `${modelSlug}.${field}`);
    }
  }
});

test('trend-led comparisons are English-first and excluded from FR/ES sitemaps at launch', () => {
  for (const { slug } of TRENDING_PAIRS) {
    assert.deepEqual(getIndexableComparisonLocales(slug), ['en'], slug);
  }
});

test('trend-led comparisons receive bounded contextual discovery and preserve the LTX upgrade page', () => {
  const compareConfig = JSON.parse(readFileSync('frontend/config/compare-config.json', 'utf8')) as {
    relatedComparisons: Record<string, string[]>;
  };
  const hub = JSON.parse(readFileSync('frontend/config/compare-hub.json', 'utf8')) as {
    popularComparisons: Array<{ left: string; right: string }>;
  };
  const popularKeys = new Set(
    hub.popularComparisons.map(({ left, right }) => [left, right].sort().join('::')),
  );

  for (const pair of TRENDING_PAIRS) {
    assert.ok(popularKeys.has([pair.leftId, pair.rightId].sort().join('::')), pair.slug);
    assert.ok((compareConfig.relatedComparisons[pair.slug]?.length ?? 0) >= 3, pair.slug);
  }

  const ltx = JSON.parse(
    readFileSync('content/comparisons/ltx-2-3-pro-vs-ltx-2-5-pro.json', 'utf8'),
  ) as { en: { quickVerdict: { body: string } } };
  assert.match(ltx.en.quickVerdict.body, /current|upgrade/i);
  assert.match(ltx.en.quickVerdict.body, /keep LTX 2\.3 Pro|legacy workflow/i);
});
