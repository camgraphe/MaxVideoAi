import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import compareConfig from '../frontend/config/compare-config.json' with { type: 'json' };
import engineCatalog from '../frontend/config/engine-catalog.json' with { type: 'json' };
import { buildCompareShowdownSlots } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-showdowns.ts';
import { getComparePageOverride } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides.ts';
import { getPublishedComparisonSlugs } from '../frontend/lib/compare-hub/data.ts';

type EngineCatalogEntry = (typeof engineCatalog)[number];

const HAPPY_HORSE_SEO_EXPANSION_SLUGS = [
  'happy-horse-1-1-vs-kling-o3-pro',
  'happy-horse-1-1-vs-veo-3-1-fast',
  'happy-horse-1-1-vs-seedance-2-0-fast',
  'dreamina-seedance-2-0-mini-vs-happy-horse-1-1',
  'happy-horse-1-1-vs-ltx-2-3-pro',
] as const;

function getCatalogEntry(slug: string): EngineCatalogEntry {
  const entry = engineCatalog.find((candidate) => candidate.modelSlug === slug);
  assert.ok(entry, `Expected catalog entry for ${slug}`);
  return entry;
}

test('Happy Horse 1.1 compare pages hide showdowns until curated videos exist', async () => {
  const left = getCatalogEntry('happy-horse-1-1');
  const right = getCatalogEntry('kling-3-pro');

  const slots = await buildCompareShowdownSlots({
    activeLocale: 'en',
    canonicalSlug: 'happy-horse-1-1-vs-kling-3-pro',
    left,
    pairHasKling3Native4k: false,
    pairHasNativeAudio: true,
    right,
    shouldSwapDisplayOrder: false,
  });

  assert.deepEqual(slots, []);
});

test('Happy Horse 1.1 first-wave SEO comparisons are published', () => {
  const publishedComparisonSlugs = getPublishedComparisonSlugs();
  const happyHorse = getCatalogEntry('happy-horse-1-1');

  ['kling-o3-pro', 'veo-3-1-fast', 'seedance-2-0-fast', 'dreamina-seedance-2-0-mini', 'ltx-2-3-pro'].forEach((slug) =>
    assert.ok(happyHorse.surfaces.compare.publishedPairs.includes(slug), `Happy Horse 1.1 missing published pair ${slug}`)
  );

  HAPPY_HORSE_SEO_EXPANSION_SLUGS.forEach((slug) =>
    assert.ok(publishedComparisonSlugs.includes(slug), `Missing published comparison ${slug}`)
  );
});

test('Happy Horse 1.1 first-wave comparisons have localized GEO overrides', () => {
  HAPPY_HORSE_SEO_EXPANSION_SLUGS.forEach((slug) => {
    const english = getComparePageOverride('en', slug);
    assert.ok(english, `missing EN override for ${slug}`);
    assert.ok(getComparePageOverride('fr', slug), `missing FR override for ${slug}`);
    assert.ok(getComparePageOverride('es', slug), `missing ES override for ${slug}`);
    assert.ok(english.heroIntro?.includes('Happy Horse'), `EN hero should mention Happy Horse for ${slug}`);
    assert.ok((english.faq?.items.length ?? 0) >= 3, `EN FAQ should cover ${slug}`);
  });

  assert.match(getComparePageOverride('en', 'dreamina-seedance-2-0-mini-vs-happy-horse-1-1')?.heroIntro ?? '', /scorecard-only/);
  assert.match(getComparePageOverride('fr', 'dreamina-seedance-2-0-mini-vs-happy-horse-1-1')?.heroIntro ?? '', /scorecard-only/);
  assert.match(getComparePageOverride('es', 'dreamina-seedance-2-0-mini-vs-happy-horse-1-1')?.heroIntro ?? '', /scorecard-only/);
});

test('Seedance Mini vs Happy Horse stays scoreboard-only without comparison videos', async () => {
  const left = getCatalogEntry('dreamina-seedance-2-0-mini');
  const right = getCatalogEntry('happy-horse-1-1');
  const canonicalSlug = 'dreamina-seedance-2-0-mini-vs-happy-horse-1-1';

  assert.ok(compareConfig.scoreboardOnlyComparisons.includes(canonicalSlug));

  const slots = await buildCompareShowdownSlots({
    activeLocale: 'en',
    canonicalSlug,
    left,
    pairHasKling3Native4k: false,
    pairHasNativeAudio: true,
    right,
    shouldSwapDisplayOrder: false,
  });

  assert.deepEqual(slots, []);
});

test('llms.txt lists the new Happy Horse and Seedance Mini SEO surfaces', () => {
  const llmsSource = readFileSync('frontend/public/llms.txt', 'utf8');

  [
    'https://maxvideoai.com/models/happy-horse-1-1',
    'https://maxvideoai.com/models/dreamina-seedance-2-0-mini',
    'https://maxvideoai.com/models/luma-ray-3-2',
    ...HAPPY_HORSE_SEO_EXPANSION_SLUGS.map((slug) => `https://maxvideoai.com/ai-video-engines/${slug}`),
    'https://maxvideoai.com/ai-video-engines/best-for/lipsync-dialogue',
    'https://maxvideoai.com/ai-video-engines/best-for/fast-drafts',
  ].forEach((url) => assert.match(llmsSource, new RegExp(url.replaceAll('.', '\\.')), `Missing llms.txt URL ${url}`));
});
