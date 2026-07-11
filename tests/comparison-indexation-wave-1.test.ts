import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

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
