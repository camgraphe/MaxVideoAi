import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextRequest } from 'next/server';
import { generateMetadata } from '../frontend/app/(localized)/[locale]/(marketing)/benchmarks/page';
import { BenchmarkMethodologySection } from '../frontend/app/(localized)/[locale]/(marketing)/benchmarks/_components/BenchmarkMethodologySection';
import { BenchmarkScoreTable } from '../frontend/app/(localized)/[locale]/(marketing)/benchmarks/_components/BenchmarkScoreTable';
import { BenchmarkSpecsTable } from '../frontend/app/(localized)/[locale]/(marketing)/benchmarks/_components/BenchmarkSpecsTable';
import { buildBenchmarkPageData } from '../frontend/app/(localized)/[locale]/(marketing)/benchmarks/_lib/benchmark-page-data';
import { getBenchmarkCopy } from '../frontend/app/(localized)/[locale]/(marketing)/benchmarks/_lib/benchmark-copy';
import {
  buildBenchmarkBreadcrumbJsonLd,
  buildBenchmarkWebPageJsonLd,
} from '../frontend/app/(localized)/[locale]/(marketing)/benchmarks/_lib/benchmark-schema';
import { loadBenchmarkLabStaticData } from '../frontend/server/benchmark-lab-data';
import type { PublicBenchmarkLatencySnapshot } from '../frontend/server/benchmark-lab-metrics';
import { routing } from '../frontend/i18n/routing';
import { handleMarketingSlug } from '../frontend/lib/middleware/routing-marketing';

const routeRoot = 'frontend/app/(localized)/[locale]/(marketing)/benchmarks';
const pagePath = path.join(routeRoot, 'page.tsx');
const defaultPagePath = 'frontend/app/benchmarks/page.tsx';
const methodologyLinkPath = 'frontend/components/marketing/BenchmarkMethodologyLink.tsx';
const require = createRequire(import.meta.url);
(globalThis as typeof globalThis & { React: typeof React }).React = React;
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

test('shared benchmark methodology link exposes localized labels and the benchmark route', () => {
  assert.ok(existsSync(methodologyLinkPath));
  const source = readFileSync(methodologyLinkPath, 'utf8');
  assert.match(source, /\/benchmarks/);
  assert.match(source, /en:/);
  assert.match(source, /fr:/);
  assert.match(source, /es:/);
});

test('benchmark copy is complete in American English, French, and Latin American Spanish', () => {
  const scoreHeaders = {
    en: { model: 'Model', overall: 'Overall score (0–10)' },
    fr: { model: 'Modèle', overall: 'Score global (0–10)' },
    es: { model: 'Modelo', overall: 'Puntuación global (0–10)' },
  } as const;
  const rollingNotes = {
    en: 'Rolling performance may reflect incidents, routing changes, and user-selected settings.',
    fr: 'Les performances glissantes peuvent refléter des incidents, des changements de routage et les réglages choisis par les utilisateurs.',
    es: 'El rendimiento de la ventana móvil puede reflejar incidentes, cambios de enrutamiento y configuraciones elegidas por los usuarios.',
  } as const;
  for (const locale of ['en', 'fr', 'es'] as const) {
    const copy = getBenchmarkCopy(locale);
    assert.ok(copy.meta.title.length >= 30);
    assert.ok(copy.hero.title.length >= 20);
    assert.equal(copy.refundNote.length > 0, true);
    assert.equal(copy.scoreLabels.length, 11);
    assert.equal(Object.keys(copy.methodology.criteria).length, 11);
    assert.equal(copy.methodology.methodNotes.length, 6);
    assert.ok(copy.methodology.methodNotes.includes(rollingNotes[locale]));
    assert.equal(copy.scores.model, scoreHeaders[locale].model);
    assert.equal(copy.scores.overall, scoreHeaders[locale].overall);
    assert.doesNotMatch(copy.evidence.map((item) => `${item.title} ${item.body}`).join(' '), /threshold|seuil|umbral/i);
  }
  assert.equal(getBenchmarkCopy('en').refundNote, 'Failed paid generations are automatically refunded.');
  assert.match(getBenchmarkCopy('es').hero.intro, /modelos de video/i);
});

test('evaluation scale exposes all four localized anchors', () => {
  const expectedAnchors = {
    en: {
      2: 'Major visible failures prevent practical use.',
      5: 'Usable in selected shots with clear limitations.',
      8: 'Strong production-ready behavior for the tested criterion.',
      10: 'Exceptional behavior with no material issue in the evaluated outputs.',
    },
    fr: {
      2: 'Des défauts visibles majeurs empêchent une utilisation pratique.',
      5: 'Utilisable pour certains plans, avec des limites nettes.',
      8: 'Comportement solide, prêt pour la production sur le critère évalué.',
      10: 'Comportement exceptionnel, sans problème notable dans les résultats évalués.',
    },
    es: {
      2: 'Las fallas visibles importantes impiden un uso práctico.',
      5: 'Utilizable en tomas seleccionadas, con limitaciones claras.',
      8: 'Desempeño sólido y listo para producción en el criterio evaluado.',
      10: 'Desempeño excepcional, sin problemas relevantes en los resultados evaluados.',
    },
  } as const;
  const methodology = {
    version: '1.0.0',
    effectiveDate: '2026-07-11',
    scoreScale: {
      minimum: 0,
      maximum: 10,
      anchors: [2, 5, 8, 10].map((score) => ({ score, meaning: `English source ${score}` })),
    },
    overallFormula: { method: 'arithmetic_mean' as const, fields: ['fidelity', 'motion', 'consistency'] as const, roundToDecimals: 1 },
    criteria: [],
    promptPack: [],
    limitations: [],
    changelog: [],
  };

  for (const locale of ['en', 'fr', 'es'] as const) {
    const copy = getBenchmarkCopy(locale);
    assert.ok(copy.methodology.scale);
    assert.deepEqual(copy.methodology.scoreAnchors, expectedAnchors[locale]);
    const html = renderToStaticMarkup(React.createElement(BenchmarkMethodologySection, {
      copy,
      locale,
      methodology,
    }));
    for (const score of [2, 5, 8, 10] as const) {
      assert.match(html, new RegExp(`${score}/10`));
      assert.ok(html.includes(expectedAnchors[locale][score]));
    }
  }
});

test('score table renders localized editorial provenance for every current row', () => {
  for (const locale of ['en', 'fr', 'es'] as const) {
    const copy = getBenchmarkCopy(locale);
    const html = renderToStaticMarkup(React.createElement(BenchmarkScoreTable, { copy, locale, rows: [] }));
    assert.ok(html.includes(copy.scores.source));
  }
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
      specs: [{ modelSlug: 'kling-3-pro', sources: ['https://fal.ai/models/kling'], keySpecs: { maxDuration: '15s', maxResolution: '1080p', releaseDate: 'Sep 2025' } }],
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
  assert.equal(pageData.specs[0]?.releaseDate, 'Sep 2025');
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

test('page builder emits only navigable HTTP sources for specification links', async () => {
  const staticData = await loadBenchmarkLabStaticData();
  const pageData = buildBenchmarkPageData(staticData, { status: 'unavailable', windowDays: 30, asOf: null, rows: [] });
  const dreamina = pageData.specs.find((row) => row.modelSlug === 'dreamina-seedance-2-0-mini');

  assert.equal(dreamina?.sourceUrl, 'https://maxvideoai.com/models/dreamina-seedance-2-0-mini');
  assert.ok(pageData.specs.every((row) => row.sourceUrl == null || /^https?:\/\//.test(row.sourceUrl)));
});

test('specification rows and localized tables include release information with a missing-value dash', async () => {
  const staticData = await loadBenchmarkLabStaticData();
  const pageData = buildBenchmarkPageData(staticData, { status: 'unavailable', windowDays: 30, asOf: null, rows: [] });
  const sora = pageData.specs.find((row) => row.modelSlug === 'sora-2');
  const kling = pageData.specs.find((row) => row.modelSlug === 'kling-3-pro');
  assert.equal(sora?.releaseDate, 'Sep 2025');
  assert.equal(kling?.releaseDate, '—');

  const releaseLabels = { en: 'Release', fr: 'Sortie', es: 'Lanzamiento' } as const;
  for (const locale of ['en', 'fr', 'es'] as const) {
    const copy = getBenchmarkCopy(locale);
    const html = renderToStaticMarkup(React.createElement(BenchmarkSpecsTable, { copy, locale, rows: [] }));
    assert.ok(html.includes(releaseLabels[locale]));
  }
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

test('middleware and i18n routing recognize every public benchmark URL', () => {
  for (const pathname of ['/benchmarks', '/fr/benchmarks', '/es/benchmarks']) {
    const request = new NextRequest(`https://maxvideoai.com${pathname}`);
    assert.equal(handleMarketingSlug(request, pathname), null, `${pathname} must not rewrite to /404`);
  }
  assert.deepEqual(routing.pathnames['/benchmarks'], {
    en: '/benchmarks',
    fr: '/benchmarks',
    es: '/benchmarks',
  });
  assert.ok(existsSync(defaultPagePath), 'the canonical English URL needs a default-locale wrapper');
  const defaultPage = readFileSync(defaultPagePath, 'utf8');
  assert.match(defaultPage, /BenchmarkDefaultPage/);
  assert.match(defaultPage, /DEFAULT_LOCALE/);
  assert.match(defaultPage, /DefaultMarketingLayout/);
});

test('benchmark lab presentation stays split into focused server components', () => {
  const components = ['BenchmarkLabView', 'BenchmarkScoreTable', 'BenchmarkSpecsTable', 'BenchmarkLatencySection', 'BenchmarkMethodologySection'];
  for (const component of components) {
    const file = path.join(routeRoot, '_components', `${component}.tsx`);
    assert.ok(existsSync(file), `${component} should exist`);
    const source = readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /['\"]use client['\"]/);
  }
  const view = readFileSync(path.join(routeRoot, '_components/BenchmarkLabView.tsx'), 'utf8');
  const scoreTable = readFileSync(path.join(routeRoot, '_components/BenchmarkScoreTable.tsx'), 'utf8');
  const specsTable = readFileSync(path.join(routeRoot, '_components/BenchmarkSpecsTable.tsx'), 'utf8');
  const methodology = readFileSync(path.join(routeRoot, '_components/BenchmarkMethodologySection.tsx'), 'utf8');
  assert.match(view, /id="scorecards"/);
  assert.match(view, /id="specifications"/);
  assert.match(view, /id="observed-speed"/);
  assert.match(view, /id="methodology"/);
  assert.match(scoreTable, /overflow-x-auto/);
  assert.match(specsTable, /overflow-x-auto/);
  assert.match(scoreTable, /role="region"/);
  assert.match(scoreTable, /aria-label=\{copy\.scores\.title\}/);
  assert.match(scoreTable, /tabIndex=\{0\}/);
  assert.match(scoreTable, /focus-visible:ring-2/);
  assert.match(specsTable, /role="region"/);
  assert.match(specsTable, /aria-label=\{copy\.specs\.title\}/);
  assert.match(specsTable, /tabIndex=\{0\}/);
  assert.match(specsTable, /focus-visible:ring-2/);
  assert.match(scoreTable, /\{copy\.scores\.model\}[\s\S]*\{copy\.scores\.overall\}/);
  assert.match(scoreTable, /copy\.scores\.source/);
  assert.match(specsTable, /copy\.specs\.release/);
  assert.match(specsTable, /row\.releaseDate/);
  assert.match(methodology, /scoreScale\.anchors/);
  assert.match(methodology, /scoreAnchors/);
  assert.match(view, /radial-gradient[^\n]+var\(--accent\)/);
  assert.doesNotMatch(view, /radial-gradient[^\n]+var\(--brand\)/);
  assert.match(view, /Failed paid generations are automatically refunded\.|refundNote/);
  assert.doesNotMatch(view, /success rate|generation count|distinct users|failed jobs refunded/i);
  assert.doesNotMatch(methodology, /minimumCompletedJobs|minimumDistinctUsers|sampleSize/);
});
