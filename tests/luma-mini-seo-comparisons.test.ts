import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import compareConfig from '../frontend/config/compare-config.json' with { type: 'json' };
import engineCatalog from '../frontend/config/engine-catalog.json' with { type: 'json' };
import { buildCompareShowdownSlots } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-showdowns.ts';
import { EN_COMPARE_PAGE_OVERRIDES } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-en.ts';
import { FR_COMPARE_PAGE_OVERRIDES } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-fr.ts';
import { ES_COMPARE_PAGE_OVERRIDES } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-es.ts';
import { getPublishedComparisonSlugs } from '../frontend/lib/compare-hub/data.ts';

type EngineCatalogEntry = (typeof engineCatalog)[number];

const LUMA_MINI_SEO_COMPARISONS = [
  'dreamina-seedance-2-0-mini-vs-luma-ray-3-2',
  'luma-ray-3-2-vs-veo-3-1-fast',
] as const;

function getCatalogEntry(slug: string): EngineCatalogEntry {
  const entry = engineCatalog.find((candidate) => candidate.modelSlug === slug);
  assert.ok(entry, `Expected catalog entry for ${slug}`);
  return entry;
}

test('Luma Ray 3.2 and Seedance Mini SEO comparison wave is published', () => {
  const publishedComparisonSlugs = getPublishedComparisonSlugs();
  const luma = getCatalogEntry('luma-ray-3-2');
  const mini = getCatalogEntry('dreamina-seedance-2-0-mini');

  assert.ok(luma.surfaces.compare.publishedPairs.includes('veo-3-1-fast'));
  assert.ok(luma.surfaces.compare.publishedPairs.includes('dreamina-seedance-2-0-mini'));
  assert.ok(mini.surfaces.compare.publishedPairs.includes('luma-ray-3-2'));

  LUMA_MINI_SEO_COMPARISONS.forEach((slug) =>
    assert.ok(publishedComparisonSlugs.includes(slug), `Missing published comparison ${slug}`)
  );
});

test('Luma Ray 3.2 and Seedance Mini SEO comparisons have localized GEO overrides', () => {
  LUMA_MINI_SEO_COMPARISONS.forEach((slug) => {
    assert.ok(EN_COMPARE_PAGE_OVERRIDES[slug], `missing EN override for ${slug}`);
    assert.ok(FR_COMPARE_PAGE_OVERRIDES[slug], `missing FR override for ${slug}`);
    assert.ok(ES_COMPARE_PAGE_OVERRIDES[slug], `missing ES override for ${slug}`);
    assert.ok((EN_COMPARE_PAGE_OVERRIDES[slug]?.faq?.items.length ?? 0) >= 3, `EN FAQ should cover ${slug}`);
  });

  assert.match(EN_COMPARE_PAGE_OVERRIDES['dreamina-seedance-2-0-mini-vs-luma-ray-3-2']?.heroIntro ?? '', /scorecard-only/);
  assert.match(EN_COMPARE_PAGE_OVERRIDES['luma-ray-3-2-vs-veo-3-1-fast']?.heroIntro ?? '', /source-video control/);
});

test('Seedance Mini vs Luma Ray 3.2 stays scorecard-only without comparison videos', async () => {
  const left = getCatalogEntry('dreamina-seedance-2-0-mini');
  const right = getCatalogEntry('luma-ray-3-2');
  const canonicalSlug = 'dreamina-seedance-2-0-mini-vs-luma-ray-3-2';

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

test('llms.txt lists the Luma and Mini comparison wave', () => {
  const llmsSource = readFileSync('frontend/public/llms.txt', 'utf8');

  LUMA_MINI_SEO_COMPARISONS.forEach((slug) =>
    assert.match(
      llmsSource,
      new RegExp(`https://maxvideoai\\.com/ai-video-engines/${slug}`),
      `Missing llms.txt URL for ${slug}`
    )
  );
});
