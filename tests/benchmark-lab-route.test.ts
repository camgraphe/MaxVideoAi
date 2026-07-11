import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { generateMetadata } from '../frontend/app/(localized)/[locale]/(marketing)/benchmarks/page';
import { buildBenchmarkPageData } from '../frontend/app/(localized)/[locale]/(marketing)/benchmarks/_lib/benchmark-page-data';
import { getBenchmarkCopy } from '../frontend/app/(localized)/[locale]/(marketing)/benchmarks/_lib/benchmark-copy';
import {
  buildBenchmarkBreadcrumbJsonLd,
  buildBenchmarkWebPageJsonLd,
} from '../frontend/app/(localized)/[locale]/(marketing)/benchmarks/_lib/benchmark-schema';
import { loadBenchmarkLabStaticData } from '../frontend/server/benchmark-lab-data';
import type { PublicBenchmarkLatencySnapshot } from '../frontend/server/benchmark-lab-metrics';

const routeRoot = 'frontend/app/(localized)/[locale]/(marketing)/benchmarks';
const pagePath = path.join(routeRoot, 'page.tsx');
const require = createRequire(import.meta.url);
const sitemapConfig = require('../frontend/next-sitemap.config.js') as {
  additionalPaths(config: unknown): Promise<Array<{ loc: string; alternateRefs: Array<{ href: string; hreflang: string }> }>>;
};

test('benchmark lab route stays a thin localized server orchestrator', () => {
  assert.ok(existsSync(pagePath));
  const source = readFileSync(pagePath, 'utf8');
  assert.match(source, /export const revalidate = 21600/);
  assert.match(source, /englishPath: '\/benchmarks'/);
  assert.match(source, /loadBenchmarkLabStaticData/);
  assert.match(source, /fetchPublicBenchmarkLatency/);
  assert.match(source, /BenchmarkLabView/);
  assert.doesNotMatch(source, /FROM app_jobs|PERCENTILE_CONT|scores\.map|specs\.map/);
  assert.ok(source.split('\n').length <= 120);
});

test('benchmark copy is complete in American English, French, and Latin American Spanish', () => {
  for (const locale of ['en', 'fr', 'es'] as const) {
    const copy = getBenchmarkCopy(locale);
    assert.ok(copy.meta.title.length >= 30);
    assert.ok(copy.hero.title.length >= 20);
    assert.equal(copy.refundNote.length > 0, true);
    assert.equal(copy.scoreLabels.length, 11);
    assert.equal(Object.keys(copy.methodology.criteria).length, 11);
    assert.equal(copy.methodology.methodNotes.length, 5);
  }
  assert.equal(getBenchmarkCopy('en').refundNote, 'Failed paid generations are automatically refunded.');
  assert.match(getBenchmarkCopy('es').hero.intro, /modelos de video/i);
});

test('benchmark metadata is self-canonical, reciprocal, regionalized, and indexable in every locale', async () => {
  const cases = [
    { locale: 'en', canonical: 'https://maxvideoai.com/benchmarks', ogLocale: 'en_US' },
    { locale: 'fr', canonical: 'https://maxvideoai.com/fr/benchmarks', ogLocale: 'fr_FR' },
    { locale: 'es', canonical: 'https://maxvideoai.com/es/benchmarks', ogLocale: 'es_419' },
  ] as const;
  const languages = {
    en: 'https://maxvideoai.com/benchmarks',
    fr: 'https://maxvideoai.com/fr/benchmarks',
    es: 'https://maxvideoai.com/es/benchmarks',
    'x-default': 'https://maxvideoai.com/benchmarks',
  };

  for (const entry of cases) {
    const metadata = await generateMetadata({ params: Promise.resolve({ locale: entry.locale }) });
    assert.equal(metadata.alternates?.canonical, entry.canonical);
    assert.deepEqual(metadata.alternates?.languages, languages);
    assert.equal(metadata.openGraph?.locale, entry.ogLocale);
    assert.notEqual(typeof metadata.robots === 'object' ? metadata.robots?.index : metadata.robots, false);
  }
});

test('benchmark schema is limited to WebPage and BreadcrumbList with MaxVideoAI as publisher', () => {
  const copy = getBenchmarkCopy('en');
  const webPage = buildBenchmarkWebPageJsonLd({
    canonicalUrl: 'https://maxvideoai.com/benchmarks',
    copy,
    inLanguage: 'en-US',
    modifiedAt: '2026-07-11',
  });
  const breadcrumb = buildBenchmarkBreadcrumbJsonLd({
    canonicalUrl: 'https://maxvideoai.com/benchmarks',
    copy,
  });
  const schemas = [webPage, breadcrumb];

  assert.deepEqual(schemas.map((schema) => schema['@type']), ['WebPage', 'BreadcrumbList']);
  assert.deepEqual(webPage.publisher, {
    '@type': 'Organization',
    name: 'MaxVideoAI',
    url: 'https://maxvideoai.com',
  });
  assert.equal(JSON.stringify(schemas).includes('Dataset'), false);
});

test('page builder keeps production volumes and rates out of public data', () => {
  const latencyWithInternalFields = {
    status: 'available',
    windowDays: 30,
    asOf: '2026-07-11T14:00:00.000Z',
    sampleSize: 120,
    completedJobs: 110,
    distinctUsers: 42,
    failedJobs: 10,
    successRate: 0.92,
    refundRate: 0.08,
    rows: [{
      engineId: 'kling-3-pro',
      modelSlug: 'kling-3-pro',
      medianDurationMs: 230800,
      p90DurationMs: 451600,
      asOf: '2026-07-11T14:00:00.000Z',
      sampleSize: 120,
      jobCount: 110,
      userCount: 42,
      failureCount: 10,
      successRate: 0.92,
      refundRate: 0.08,
    }],
  } as unknown as PublicBenchmarkLatencySnapshot;
  const pageData = buildBenchmarkPageData(
    {
      scores: [{ modelSlug: 'kling-3-pro', fidelity: 8.6, motion: 8.4, consistency: 8.0 }],
      specs: [{ modelSlug: 'kling-3-pro', sources: ['https://fal.ai/models/kling'], keySpecs: { maxDuration: '15s', maxResolution: '1080p' } }],
      methodology: {
        version: '1.0.0', effectiveDate: '2026-07-11', scoreScale: { minimum: 0, maximum: 10, anchors: [] },
        overallFormula: { method: 'arithmetic_mean', fields: ['fidelity', 'motion', 'consistency'], roundToDecimals: 1 },
        criteria: [], promptPack: [], requiredRunMetadata: ['seed', 'providerRequestId'],
        operationalLatency: { windowDays: 30, minimumCompletedJobs: 30, minimumDistinctUsers: 5, medianPercentile: 0.5, slowPercentile: 0.9 },
        limitations: [], changelog: [],
      },
    },
    latencyWithInternalFields
  );
  assert.equal(pageData.scores[0]?.overall, 8.3);
  assert.equal(pageData.latency.rows[0]?.medianDurationMs, 230800);
  const serialized = JSON.stringify(pageData);
  for (const privateField of [
    'requiredRunMetadata',
    'operationalLatency',
    'minimumCompletedJobs',
    'minimumDistinctUsers',
    'medianPercentile',
    'slowPercentile',
    'sampleSize',
    'completedJobs',
    'jobCount',
    'distinctUsers',
    'userCount',
    'failedJobs',
    'failureCount',
    'successRate',
    'refundRate',
  ]) {
    assert.equal(serialized.includes(privateField), false, `${privateField} must stay private`);
  }
});

test('page builder preserves the complete editorial roster, including legacy video models', async () => {
  const staticData = await loadBenchmarkLabStaticData();
  const pageData = buildBenchmarkPageData(staticData, { status: 'unavailable', windowDays: 30, asOf: null, rows: [] });
  assert.equal(pageData.scores.length, staticData.scores.length);
  assert.ok(pageData.scores.some((row) => row.modelSlug === 'ltx-2'));
});

test('localized sitemap generation emits each benchmark locale URL exactly once', async () => {
  const sitemapSource = readFileSync('frontend/next-sitemap.config.js', 'utf8');
  assert.match(sitemapSource, /MARKETING_CORE_PATHS[\s\S]*['"]\/benchmarks['"]/);
  const entries = await sitemapConfig.additionalPaths(sitemapConfig);
  const benchmarkEntries = entries.filter((entry) => entry.loc.endsWith('/benchmarks'));
  assert.equal(benchmarkEntries.length, 1);

  const localizedUrls = benchmarkEntries.flatMap((entry) =>
    entry.alternateRefs
      .filter((alternate) => alternate.hreflang !== 'x-default')
      .map((alternate) => alternate.href)
  );
  for (const expected of [
    'https://maxvideoai.com/benchmarks',
    'https://maxvideoai.com/fr/benchmarks',
    'https://maxvideoai.com/es/benchmarks',
  ]) {
    assert.equal(localizedUrls.filter((url) => url === expected).length, 1, `${expected} must appear once`);
  }
});
