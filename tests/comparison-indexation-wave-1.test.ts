import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';

import { getHubComparisonSlugsForSitemap } from '../frontend/lib/compare-hub/data.ts';
import { generateComparisonIndexationArtifacts } from '../scripts/generate-comparison-indexation-matrix.ts';

type CuratedLocale = 'fr' | 'es';

type ComparisonIndexationConfig = {
  schemaVersion: number;
  wave: string;
  evidenceDate: string;
  noindexByLocale: Record<CuratedLocale, string[]> & { en?: string[] };
};

type EngineCatalogEntry = {
  modelSlug: string;
  availability?: string;
  engine?: { status?: string };
};

const comparisonIndexation = JSON.parse(
  readFileSync('frontend/config/comparison-indexation.json', 'utf8'),
) as ComparisonIndexationConfig;
const engineCatalog = JSON.parse(
  readFileSync('frontend/config/engine-catalog.json', 'utf8'),
) as EngineCatalogEntry[];
const requireFromTest = createRequire(import.meta.url);
const reactModule = requireFromTest('react') as { cache?: <T>(callback: T) => T };
reactModule.cache ??= (callback) => callback;

test('wave 1 exposes one shared locale indexation policy', async () => {
  const policy = await import('../frontend/lib/compare-hub/indexation.ts').catch(() => null);
  assert.ok(policy, 'missing comparison indexation policy module');
  assert.equal(policy.isComparisonIndexable('en', 'ltx-2-vs-veo-3-1-lite'), true);
  assert.equal(policy.isComparisonIndexable('fr', 'ltx-2-vs-veo-3-1-lite'), false);
  assert.equal(policy.isComparisonIndexable('es', 'kling-3-pro-vs-minimax-hailuo-02-text'), false);
  assert.deepEqual(policy.getIndexableComparisonLocales('ltx-2-vs-veo-3-1-lite'), ['en', 'es']);
  assert.deepEqual(
    policy.getIndexableComparisonSlugs('fr', [
      'ltx-2-vs-veo-3-1-lite',
      'kling-3-pro-vs-minimax-hailuo-02-text',
    ]),
    ['kling-3-pro-vs-minimax-hailuo-02-text'],
  );
});

test('wave 1 configuration contains exactly 30 unique candidates per localized market', () => {
  assert.equal(comparisonIndexation.schemaVersion, 1);
  assert.equal(comparisonIndexation.wave, 'localized-low-signal-2026-07-11');
  assert.equal(comparisonIndexation.evidenceDate, '2026-07-08');
  assert.equal(Object.hasOwn(comparisonIndexation.noindexByLocale, 'en'), false);

  const frenchSlugs = comparisonIndexation.noindexByLocale.fr;
  const spanishSlugs = comparisonIndexation.noindexByLocale.es;
  assert.equal(frenchSlugs.length, 30);
  assert.equal(spanishSlugs.length, 30);
  assert.equal(frenchSlugs.length + spanishSlugs.length, 60);
  assert.equal(new Set(frenchSlugs).size, frenchSlugs.length);
  assert.equal(new Set(spanishSlugs).size, spanishSlugs.length);
});

test('wave 1 candidates reproduce the approved low-signal evidence selection', () => {
  const { document } = generateComparisonIndexationArtifacts();
  const candidateComparator = (a: (typeof document.rows)[number], b: (typeof document.rows)[number]) =>
    Number(b.hasGscRow) - Number(a.hasGscRow) ||
    a.impressions - b.impressions ||
    a.slug.localeCompare(b.slug, 'en');

  for (const locale of ['fr', 'es'] as const) {
    const expectedSlugs = document.rows
      .filter((row) => row.locale === locale && row.classification === 'noindex_candidate')
      .sort(candidateComparator)
      .slice(0, 30)
      .map((row) => row.slug);
    const selectedSlugs = comparisonIndexation.noindexByLocale[locale];

    assert.deepEqual(selectedSlugs, expectedSlugs);

    for (const slug of selectedSlugs) {
      const row = document.rows.find((candidate) => candidate.locale === locale && candidate.slug === slug);
      assert.ok(row, `${locale}:${slug} should exist in the generated evidence matrix`);
      assert.equal(row.classification, 'noindex_candidate');
      assert.equal(row.clicks, 0);
      assert.ok(row.impressions < 30);
      assert.equal(row.hasLocalizedOverride, false);
      assert.deepEqual(row.strategicSignals, []);

      const modelSlugs = slug.split('-vs-');
      assert.equal(modelSlugs.length, 2, `${slug} should resolve to exactly two model slugs`);
      for (const modelSlug of modelSlugs) {
        const catalogEntry = engineCatalog.find((entry) => entry.modelSlug === modelSlug);
        assert.ok(catalogEntry, `${modelSlug} should exist in the engine catalog`);
        assert.equal(catalogEntry.availability, 'available', `${modelSlug} should be available`);
        assert.equal(catalogEntry.engine?.status, 'live', `${modelSlug} should be live`);
      }
    }
  }
});

test('wave 1 keeps English and every comparison carrying a positive safety signal indexable', async () => {
  const policy = await import('../frontend/lib/compare-hub/indexation.ts');
  const { document } = generateComparisonIndexationArtifacts();
  const englishRows = document.rows.filter((row) => row.locale === 'en');
  assert.ok(englishRows.length > 0);
  assert.ok(
    englishRows.every((row) => policy.isComparisonIndexable('en', row.slug)),
    'every published English comparison should remain indexable',
  );

  const protectedRows = document.rows.filter(
    (row) =>
      row.clicks > 0 ||
      row.impressions >= 30 ||
      (row.position > 0 && row.position <= 10) ||
      row.hasLocalizedOverride ||
      row.strategicSignals.length > 0,
  );
  assert.ok(protectedRows.length > 0);
  for (const row of protectedRows) {
    assert.equal(
      policy.isComparisonIndexable(row.locale, row.slug),
      true,
      `${row.locale}:${row.slug} has a positive safety signal and must remain indexable`,
    );
  }
});

test('wave 1 sitemap contains exactly the indexable localized comparison URLs', async () => {
  const { getCanonicalPathEntries } = await import('../frontend/lib/sitemap/route-discovery.ts');
  const comparisonPathByLocale = {
    en: '/ai-video-engines',
    fr: '/fr/comparatif',
    es: '/es/comparativa',
  } as const;
  const publishedSlugs = getHubComparisonSlugsForSitemap();
  const publishedSlugSet = new Set(publishedSlugs);
  const comparisonEntries = (await getCanonicalPathEntries()).filter(({ englishPath }) => {
    const slug = englishPath.slice('/ai-video-engines/'.length);
    return englishPath.startsWith('/ai-video-engines/') && publishedSlugSet.has(slug);
  });
  const comparisonUrlKeys = new Set(
    comparisonEntries.flatMap((entry) => {
      const slug = entry.englishPath.slice('/ai-video-engines/'.length);
      return (entry.locales ?? []).map(
        (locale) => `${locale}:${comparisonPathByLocale[locale]}/${slug}`,
      );
    }),
  );

  assert.equal(publishedSlugs.length, 292);
  assert.equal(comparisonEntries.length, publishedSlugs.length);
  assert.equal(comparisonUrlKeys.size, 292 * 3 - 60);

  for (const slug of publishedSlugs) {
    assert.ok(
      comparisonUrlKeys.has(`en:${comparisonPathByLocale.en}/${slug}`),
      `English comparison must remain in the sitemap: ${slug}`,
    );
  }

  for (const locale of ['fr', 'es'] as const) {
    const excludedSlugs = new Set(comparisonIndexation.noindexByLocale[locale]);
    for (const slug of publishedSlugs) {
      const key = `${locale}:${comparisonPathByLocale[locale]}/${slug}`;
      if (excludedSlugs.has(slug)) {
        assert.ok(!comparisonUrlKeys.has(key), `configured sitemap URL must be omitted: ${key}`);
      } else {
        assert.ok(comparisonUrlKeys.has(key), `unselected sitemap URL must remain: ${key}`);
      }
    }
  }
});

test('wave 1 applies locale exclusions to comparison metadata and hreflang alternates', async () => {
  const { getIndexableComparisonLocales, isComparisonIndexable } = await import(
    '../frontend/lib/compare-hub/indexation.ts'
  );
  const { buildSeoMetadata } = await import('../frontend/lib/seo/metadata.ts');
  const frenchSelectedSlug = 'ltx-2-vs-veo-3-1-lite';
  const spanishSelectedSlug = 'kling-3-pro-vs-minimax-hailuo-02-text';
  const metadataFor = (locale: 'en' | CuratedLocale, slug: string) => {
    const excluded = !isComparisonIndexable(locale, slug);
    return buildSeoMetadata({
      locale,
      title: 'Comparison metadata contract',
      description: 'Comparison metadata contract for locale-aware indexation.',
      englishPath: `/ai-video-engines/${slug}`,
      availableLocales: getIndexableComparisonLocales(slug),
      robots: excluded ? { index: false, follow: true } : undefined,
    });
  };

  const [frenchSelected, spanishSelected, frenchSelectedEnglish, spanishSelectedEnglish, frenchUnselected] =
    [
      metadataFor('fr', frenchSelectedSlug),
      metadataFor('es', spanishSelectedSlug),
      metadataFor('en', frenchSelectedSlug),
      metadataFor('en', spanishSelectedSlug),
      metadataFor('fr', spanishSelectedSlug),
    ];

  assert.deepEqual(frenchSelected.robots, { index: false, follow: true });
  assert.equal(
    frenchSelected.alternates?.canonical,
    `https://maxvideoai.com/fr/comparatif/${frenchSelectedSlug}`,
  );
  assert.deepEqual(frenchSelected.alternates?.languages, {
    en: `https://maxvideoai.com/ai-video-engines/${frenchSelectedSlug}`,
    es: `https://maxvideoai.com/es/comparativa/${frenchSelectedSlug}`,
    'x-default': `https://maxvideoai.com/ai-video-engines/${frenchSelectedSlug}`,
  });

  assert.deepEqual(spanishSelected.robots, { index: false, follow: true });
  assert.equal(
    spanishSelected.alternates?.canonical,
    `https://maxvideoai.com/es/comparativa/${spanishSelectedSlug}`,
  );
  assert.deepEqual(spanishSelected.alternates?.languages, {
    en: `https://maxvideoai.com/ai-video-engines/${spanishSelectedSlug}`,
    fr: `https://maxvideoai.com/fr/comparatif/${spanishSelectedSlug}`,
    'x-default': `https://maxvideoai.com/ai-video-engines/${spanishSelectedSlug}`,
  });

  assert.notEqual(
    typeof frenchSelectedEnglish.robots === 'object'
      ? frenchSelectedEnglish.robots?.index
      : frenchSelectedEnglish.robots,
    false,
  );
  assert.notEqual(
    typeof spanishSelectedEnglish.robots === 'object'
      ? spanishSelectedEnglish.robots?.index
      : spanishSelectedEnglish.robots,
    false,
  );
  assert.notEqual(
    typeof frenchUnselected.robots === 'object' ? frenchUnselected.robots?.index : frenchUnselected.robots,
    false,
  );
  assert.equal(
    frenchUnselected.alternates?.canonical,
    `https://maxvideoai.com/fr/comparatif/${spanishSelectedSlug}`,
  );
});

test('wave 1 metadata builder preserves order-query noindex and applies the locale policy', () => {
  const metadataSource = readFileSync(
    'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-metadata.ts',
    'utf8',
  );

  assert.match(
    metadataSource,
    /if\s*\(\s*!isComparisonIndexable\(\s*locale\s*,\s*canonicalSlug\s*\)\s*\)\s*\{\s*robots\s*=\s*\{\s*index:\s*false\s*,\s*follow:\s*true\s*\}\s*;\s*\}/,
  );
  assert.match(
    metadataSource,
    /availableLocales:\s*getIndexableComparisonLocales\(canonicalSlug\)/,
  );
  assert.match(
    metadataSource,
    /return\s+buildSeoMetadata\(\s*\{[\s\S]*?\brobots\s*,[\s\S]*?\}\s*\)\s*;/,
  );
  assert.match(
    metadataSource,
    /if \(typeof searchParams\?\.order === 'string' && searchParams\.order\.trim\(\)\) \{\s*robots = \{ index: false, follow: true \};\s*\}/,
  );
});

test('wave 1 applies locale indexation policy when accepting related comparison destinations', () => {
  const relatedSource = readFileSync(
    'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-related-links.ts',
    'utf8',
  );
  const pageSource = readFileSync(
    'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/page.tsx',
    'utf8',
  );

  assert.match(relatedSource, /isComparisonIndexable\(locale, canonicalPair\)/);
  assert.match(pageSource, /buildRelatedComparisonLinks\(canonicalSlug, activeLocale\)/);
});
