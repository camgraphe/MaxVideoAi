import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import scores from '../data/benchmarks/engine-scores.v1.json' with { type: 'json' };
import compareHubConfig from '../frontend/config/compare-hub.json' with { type: 'json' };
import {
  getComparePageOverride,
} from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides.ts';
import { BEST_FOR_PAGES } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/best-for/[usecase]/_lib/best-for-detail-config.ts';
import { MARKETING_NAV_COMPARE, MARKETING_NAV_MODELS } from '../frontend/config/navigation.ts';
import {
  getHubComparisonSlugsForSitemap,
  getPopularComparisons,
  getUseCaseBuckets,
  isPublishedComparisonSlug,
} from '../frontend/lib/compare-hub/data.ts';
import { getIndexableComparisonLocales } from '../frontend/lib/compare-hub/indexation.ts';
import { buildSeoMetadata } from '../frontend/lib/seo/metadata.ts';
import { computeBenchmarkOverall } from '../frontend/server/benchmark-lab-data.ts';

const LOCALES = ['en', 'fr', 'es'] as const;
const COMPARISONS = [
  'minimax-h3-vs-seedance-2-5',
  'kling-o3-pro-vs-minimax-h3',
  'minimax-h3-vs-veo-3-1',
] as const;
const REQUIRED_BEST_FOR = [
  'cinematic-realism',
  'character-reference',
  'reference-to-video',
  'multi-shot-video',
  '4k-video',
  'lipsync-dialogue',
] as const;
const COMPARISON_PREFIX = {
  en: '/ai-video-engines',
  fr: '/fr/comparatif',
  es: '/es/comparativa',
} as const;
const REPO_ROOT = existsSync(path.join(process.cwd(), 'content', 'comparisons'))
  ? process.cwd()
  : path.resolve(process.cwd(), '..');

function scoreFor(slug: string): number | null {
  const entry = scores.scores.find((candidate) => candidate.modelSlug === slug);
  assert.ok(entry, `missing benchmark score for ${slug}`);
  return computeBenchmarkOverall(entry);
}

test('H3 comparison pages are enriched, localized, canonical, and indexable', () => {
  const sitemapSlugs = getHubComparisonSlugsForSitemap();

  for (const slug of COMPARISONS) {
    assert.equal(isPublishedComparisonSlug(slug), true, `${slug} published pair`);
    assert.ok(sitemapSlugs.includes(slug), `${slug} comparison sitemap membership`);
    assert.deepEqual(getIndexableComparisonLocales(slug), LOCALES, `${slug} locale indexation`);

    const raw = readFileSync(path.join(REPO_ROOT, 'content', 'comparisons', `${slug}.json`), 'utf8');
    assert.doesNotMatch(raw, /provisional|estimated|sample|disclaimer|scorecard-only/i);
    assert.doesNotMatch(raw, /\$|\bUSD\b|\bcredits?\b/i, `${slug} must not own mutable pricing totals`);

    for (const locale of LOCALES) {
      const page = getComparePageOverride(locale, slug);
      assert.ok(page?.meta?.title, `${locale} ${slug} title`);
      assert.ok(page.meta.description, `${locale} ${slug} description`);
      assert.ok(page.heroIntro, `${locale} ${slug} hero`);
      assert.ok(page.quickVerdict?.body, `${locale} ${slug} verdict`);
      assert.ok((page.topCards?.length ?? 0) >= 3, `${locale} ${slug} decision cards`);
      assert.ok((page.primaryLinks?.length ?? 0) >= 4, `${locale} ${slug} primary links`);
      assert.ok((page.faq?.items.length ?? 0) >= 4, `${locale} ${slug} FAQs`);

      const metadata = buildSeoMetadata({
        locale,
        title: page.meta.title,
        description: page.meta.description,
        englishPath: `/ai-video-engines/${slug}`,
        availableLocales: getIndexableComparisonLocales(slug),
      });
      assert.equal(
        metadata.alternates?.canonical,
        `https://maxvideoai.com${COMPARISON_PREFIX[locale]}/${slug}`,
      );
      assert.deepEqual(metadata.alternates?.languages, {
        en: `https://maxvideoai.com/ai-video-engines/${slug}`,
        fr: `https://maxvideoai.com/fr/comparatif/${slug}`,
        es: `https://maxvideoai.com/es/comparativa/${slug}`,
        'x-default': `https://maxvideoai.com/ai-video-engines/${slug}`,
      });
    }
  }
});

test('score order keeps H3 just below Kling O3 Pro and below Seedance 2.5', () => {
  assert.equal(scoreFor('seedance-2-5'), 9.1);
  assert.equal(scoreFor('kling-o3-pro'), 8.6);
  assert.equal(scoreFor('minimax-h3'), 8.5);
});

test('bounded discovery surfaces feature H3 immediately after Seedance 2.5', () => {
  assert.deepEqual(
    MARKETING_NAV_MODELS.slice(0, 2).map(({ key, badge }) => ({ key, badge })),
    [
      { key: 'seedance-2-5', badge: 'new' },
      { key: 'minimax-h3', badge: 'new' },
    ],
  );
  assert.equal(MARKETING_NAV_COMPARE.length, 10);
  assert.equal(MARKETING_NAV_COMPARE[0]?.key, 'minimax-h3-vs-minimax-h3-max');
  assert.ok(MARKETING_NAV_COMPARE.some(({ key }) => key === 'minimax-h3-vs-seedance-2-5'));

  const popular = getPopularComparisons();
  assert.equal(compareHubConfig.popularComparisons.length, 44, 'planned comparison inventory includes the P0, P1 and trend scoreboards');
  assert.equal(popular[0]?.slug, 'minimax-h3-vs-seedance-2-5');

  const buckets = new Map(getUseCaseBuckets().map((bucket) => [bucket.id, bucket.pairs]));
  for (const bucketId of ['cinematic', 'audio', 'best-value', 'best-quality', 'text-to-video', 'image-to-video']) {
    assert.ok(
      buckets.get(bucketId)?.some((pair) => COMPARISONS.includes(pair.slug as (typeof COMPARISONS)[number])),
      `${bucketId} should surface an H3 comparison`,
    );
  }
});

test('H3 is fully linked from the six required Best For decision pages', () => {
  const pages = new Map(BEST_FOR_PAGES.map((page) => [page.slug, page]));

  for (const slug of REQUIRED_BEST_FOR) {
    const page = pages.get(slug);
    assert.ok(page, `${slug} Best For page`);
    assert.ok(page.topPicks?.includes('minimax-h3'), `${slug} should rank H3`);
    assert.ok(
      page.relatedComparisons?.some((comparison) => COMPARISONS.includes(comparison as (typeof COMPARISONS)[number])),
      `${slug} should link an H3 comparison`,
    );
  }
});
