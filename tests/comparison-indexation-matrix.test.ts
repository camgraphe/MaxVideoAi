import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import test from 'node:test';

import gscSnapshot from '../docs/seo/gsc-comparison-performance-2026-07-08.json';
import * as comparisonPolicy from '../scripts/comparison-indexation-policy.ts';
import {
  buildComparisonIndexationMatrix,
  classifyComparison,
} from '../scripts/comparison-indexation-policy.ts';
import * as comparisonGenerator from '../scripts/generate-comparison-indexation-matrix.ts';
import { generateComparisonIndexationArtifacts } from '../scripts/generate-comparison-indexation-matrix.ts';

test('comparison indexation policy is implemented as a reusable module', () => {
  assert.ok(
    existsSync('scripts/comparison-indexation-policy.ts'),
    'missing reusable comparison indexation policy',
  );
});

test('comparison indexation matrix has a reproducible report generator', () => {
  assert.ok(
    existsSync('scripts/generate-comparison-indexation-matrix.ts'),
    'missing comparison indexation report generator',
  );
});

test('comparison indexation generator exposes an artifact builder', () => {
  assert.equal(
    typeof (comparisonGenerator as Record<string, unknown>).generateComparisonIndexationArtifacts,
    'function',
  );
});

test('the saved GSC comparison rows contain clean canonical slugs', () => {
  assert.equal(
    (gscSnapshot as typeof gscSnapshot & { rawPageRows?: number }).rawPageRows,
    996,
  );
  assert.equal(gscSnapshot.comparisonRows, gscSnapshot.rows.length);
  for (const row of gscSnapshot.rows) {
    assert.doesNotMatch(row.url, /[\n\r]|Copy URL|Inspect URL/);
    assert.doesNotMatch(row.slug, /%20|Copy URL|Inspect URL/);
  }
});

test('comparison indexation policy exposes a classifier', () => {
  assert.equal(
    typeof (comparisonPolicy as Record<string, unknown>).classifyComparison,
    'function',
  );
});

test('comparison indexation policy exposes a matrix builder', () => {
  assert.equal(
    typeof (comparisonPolicy as Record<string, unknown>).buildComparisonIndexationMatrix,
    'function',
  );
});

const BASE_INPUT = {
  locale: 'fr' as const,
  clicks: 0,
  impressions: 0,
  position: 0,
  hasLocalizedOverride: false,
  isStrategic: false,
};

test('a comparison with a GSC click is kept', () => {
  assert.equal(classifyComparison({ ...BASE_INPUT, clicks: 1 }), 'keep');
});

test('a comparison with at least 500 impressions is kept', () => {
  assert.equal(classifyComparison({ ...BASE_INPUT, impressions: 500 }), 'keep');
});

test('a comparison with a localized editorial override is kept', () => {
  assert.equal(classifyComparison({ ...BASE_INPUT, hasLocalizedOverride: true }), 'keep');
});

test('an English strategic comparison is kept', () => {
  assert.equal(
    classifyComparison({ ...BASE_INPUT, locale: 'en', isStrategic: true }),
    'keep',
  );
});

test('a comparison with at least 100 impressions is queued for enrichment', () => {
  assert.equal(classifyComparison({ ...BASE_INPUT, impressions: 100 }), 'enrich');
});

test('a comparison with at least 30 impressions is queued for review', () => {
  assert.equal(classifyComparison({ ...BASE_INPUT, impressions: 30 }), 'review');
});

test('a low-impression comparison already ranking in the top 10 is reviewed', () => {
  assert.equal(
    classifyComparison({
      ...BASE_INPUT,
      impressions: 12,
      position: 8,
    }),
    'review',
  );
});

test('a non-English strategic comparison without local proof is reviewed', () => {
  assert.equal(classifyComparison({ ...BASE_INPUT, isStrategic: true }), 'review');
});

test('a comparison without GSC or editorial signals is only a noindex candidate', () => {
  assert.equal(classifyComparison(BASE_INPUT), 'noindex_candidate');
});

test('the matrix expands every published slug across the three canonical locale URLs', () => {
  const rows = buildComparisonIndexationMatrix({
    publishedSlugs: ['alpha-vs-beta', 'alpha-vs-gamma'],
    gscRows: [],
    localizedOverrideSlugs: {
      en: new Set(),
      fr: new Set(),
      es: new Set(),
    },
    strategicSignalsBySlug: new Map(),
  });

  assert.equal(rows.length, 6);
  assert.deepEqual(
    rows.map((row) => row.url).sort(),
    [
      'https://maxvideoai.com/ai-video-engines/alpha-vs-beta',
      'https://maxvideoai.com/ai-video-engines/alpha-vs-gamma',
      'https://maxvideoai.com/es/comparativa/alpha-vs-beta',
      'https://maxvideoai.com/es/comparativa/alpha-vs-gamma',
      'https://maxvideoai.com/fr/comparatif/alpha-vs-beta',
      'https://maxvideoai.com/fr/comparatif/alpha-vs-gamma',
    ],
  );
});

test('the matrix joins GSC, localized editorial, and strategic signals before classifying', () => {
  const rows = buildComparisonIndexationMatrix({
    publishedSlugs: ['alpha-vs-beta', 'alpha-vs-gamma'],
    gscRows: [
      {
        url: 'https://maxvideoai.com/ai-video-engines/alpha-vs-beta',
        locale: 'en',
        slug: 'alpha-vs-beta',
        clicks: 2,
        impressions: 25,
        ctr: 8,
        position: 4,
      },
      {
        url: 'https://maxvideoai.com/fr/comparatif/alpha-vs-beta',
        locale: 'fr',
        slug: 'alpha-vs-beta',
        clicks: 0,
        impressions: 120,
        ctr: 0,
        position: 15,
      },
    ],
    localizedOverrideSlugs: {
      en: new Set(),
      fr: new Set(),
      es: new Set(['alpha-vs-gamma']),
    },
    strategicSignalsBySlug: new Map([['alpha-vs-beta', ['popular']]]),
  });

  const byKey = new Map(rows.map((row) => [`${row.locale}:${row.slug}`, row]));
  assert.equal(byKey.get('en:alpha-vs-beta')?.classification, 'keep');
  assert.equal(byKey.get('fr:alpha-vs-beta')?.classification, 'enrich');
  assert.equal(byKey.get('es:alpha-vs-beta')?.classification, 'review');
  assert.equal(byKey.get('es:alpha-vs-gamma')?.classification, 'keep');
  assert.equal(byKey.get('fr:alpha-vs-gamma')?.classification, 'noindex_candidate');
  assert.deepEqual(byKey.get('en:alpha-vs-beta')?.strategicSignals, ['popular']);
  assert.equal(byKey.get('en:alpha-vs-beta')?.hasGscRow, true);
  assert.equal(byKey.get('es:alpha-vs-beta')?.hasGscRow, false);
});

test('the matrix aggregates canonical and parameterized GSC variants by locale and slug', () => {
  const rows = buildComparisonIndexationMatrix({
    publishedSlugs: ['alpha-vs-beta'],
    gscRows: [
      {
        url: 'https://maxvideoai.com/ai-video-engines/alpha-vs-beta',
        locale: 'en',
        slug: 'alpha-vs-beta',
        clicks: 1,
        impressions: 20,
        ctr: 5,
        position: 4,
      },
      {
        url: 'https://maxvideoai.com/ai-video-engines/alpha-vs-beta?order=beta',
        locale: 'en',
        slug: 'alpha-vs-beta',
        clicks: 2,
        impressions: 30,
        ctr: 6.7,
        position: 6,
      },
    ],
    localizedOverrideSlugs: {
      en: new Set(),
      fr: new Set(),
      es: new Set(),
    },
    strategicSignalsBySlug: new Map(),
  });
  const english = rows.find((row) => row.locale === 'en');

  assert.equal(english?.clicks, 3);
  assert.equal(english?.impressions, 50);
  assert.equal(english?.ctr, 6);
  assert.equal(english?.position, 5.2);
});

test('a noindex candidate with observed low demand gets an accurate rationale', () => {
  const rows = buildComparisonIndexationMatrix({
    publishedSlugs: ['alpha-vs-beta'],
    gscRows: [{
      url: 'https://maxvideoai.com/ai-video-engines/alpha-vs-beta',
      locale: 'en',
      slug: 'alpha-vs-beta',
      clicks: 0,
      impressions: 12,
      ctr: 0,
      position: 12,
    }],
    localizedOverrideSlugs: { en: new Set(), fr: new Set(), es: new Set() },
    strategicSignalsBySlug: new Map(),
  });
  const english = rows.find((row) => row.locale === 'en');

  assert.equal(english?.classification, 'noindex_candidate');
  assert.deepEqual(english?.rationale, ['low_demand_outside_top_10']);
});

test('the generated inventory covers all 876 localized published comparison URLs', () => {
  const artifacts = generateComparisonIndexationArtifacts() as {
    document: {
      summary: {
        publishedSlugs: number;
        totalUrls: number;
        gscRowsOutsidePublishedSet: number;
        gscRowsOutsidePublishedSetWithClicks: number;
        byClassification: Record<string, number>;
      };
      rows: Array<{
        locale: string;
        slug: string;
        clicks: number;
        classification: string;
      }>;
      legacyGscRows: Array<{ clicks: number }>;
    };
    markdown: string;
  };

  assert.equal(artifacts.document.summary.publishedSlugs, 292);
  assert.equal(artifacts.document.summary.totalUrls, 876);
  assert.equal(artifacts.document.summary.gscRowsOutsidePublishedSet, 21);
  assert.equal(artifacts.document.summary.gscRowsOutsidePublishedSetWithClicks, 2);
  assert.equal(artifacts.document.legacyGscRows.length, 21);
  assert.equal(artifacts.document.rows.length, 876);
  assert.equal(
    new Set(artifacts.document.rows.map((row) => `${row.locale}:${row.slug}`)).size,
    876,
  );
  assert.equal(
    Object.values(artifacts.document.summary.byClassification).reduce(
      (sum, count) => sum + count,
      0,
    ),
    876,
  );
  assert.ok(
    artifacts.document.rows
      .filter((row) => row.clicks > 0)
      .every((row) => row.classification === 'keep'),
    'every comparison with GSC clicks must remain in the keep class',
  );
  assert.match(artifacts.markdown, /Aucun noindex n'est applique/i);
  assert.match(artifacts.markdown, /996 premières pages/);
  assert.match(artifacts.markdown, /URLs GSC hors du périmètre publié/);
  assert.match(artifacts.markdown, /19 anciennes variantes Veo/);
  assert.match(artifacts.markdown, /Happy Horse 1\.0[\s\S]*redirection permanente/);
  assert.match(artifacts.markdown, /^\| en \| \[/m);
});

test('the generator CLI writes the JSON and Markdown audit artifacts', () => {
  const result = spawnSync(
    './frontend/node_modules/.bin/tsx',
    [
      '--tsconfig',
      'frontend/tsconfig.json',
      'scripts/generate-comparison-indexation-matrix.ts',
    ],
    { cwd: process.cwd(), encoding: 'utf8' },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.ok(existsSync('docs/seo/comparison-indexation-matrix-2026-07-08.json'));
  assert.ok(existsSync('docs/seo/comparison-indexation-matrix-2026-07-08.md'));
  assert.match(result.stdout, /"totalUrls": 876/);
});
