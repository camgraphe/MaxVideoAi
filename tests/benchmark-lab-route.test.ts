import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { buildBenchmarkPageData } from '../frontend/app/(localized)/[locale]/(marketing)/benchmarks/_lib/benchmark-page-data';
import { getBenchmarkCopy } from '../frontend/app/(localized)/[locale]/(marketing)/benchmarks/_lib/benchmark-copy';
import { loadBenchmarkLabStaticData } from '../frontend/server/benchmark-lab-data';

const routeRoot = 'frontend/app/(localized)/[locale]/(marketing)/benchmarks';
const pagePath = path.join(routeRoot, 'page.tsx');

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

test('page builder keeps production volumes and rates out of public data', () => {
  const pageData = buildBenchmarkPageData(
    {
      scores: [{ modelSlug: 'kling-3-pro', fidelity: 8.6, motion: 8.4, consistency: 8.0 }],
      specs: [{ modelSlug: 'kling-3-pro', sources: ['https://fal.ai/models/kling'], keySpecs: { maxDuration: '15s', maxResolution: '1080p' } }],
      methodology: {
        version: '1.0.0', effectiveDate: '2026-07-11', scoreScale: { minimum: 0, maximum: 10, anchors: [] },
        overallFormula: { method: 'arithmetic_mean', fields: ['fidelity', 'motion', 'consistency'], roundToDecimals: 1 },
        criteria: [], promptPack: [], requiredRunMetadata: [],
        operationalLatency: { windowDays: 30, minimumCompletedJobs: 30, minimumDistinctUsers: 5, medianPercentile: 0.5, slowPercentile: 0.9 },
        limitations: [], changelog: [],
      },
    },
    { status: 'available', windowDays: 30, asOf: '2026-07-11T14:00:00.000Z', rows: [{ engineId: 'kling-3-pro', modelSlug: 'kling-3-pro', medianDurationMs: 230800, p90DurationMs: 451600, asOf: '2026-07-11T14:00:00.000Z' }] }
  );
  assert.equal(pageData.scores[0]?.overall, 8.3);
  assert.equal(pageData.latency.rows[0]?.medianDurationMs, 230800);
  assert.equal(JSON.stringify(pageData).includes('successRate'), false);
  assert.equal(JSON.stringify(pageData).includes('completedJobs'), false);
  assert.equal(JSON.stringify(pageData).includes('distinctUsers'), false);
  assert.equal(JSON.stringify(pageData).includes('minimumCompletedJobs'), false);
  assert.equal(JSON.stringify(pageData).includes('minimumDistinctUsers'), false);
  assert.equal(JSON.stringify(pageData).includes('sampleSize'), false);
});

test('page builder preserves the complete editorial roster, including legacy video models', async () => {
  const staticData = await loadBenchmarkLabStaticData();
  const pageData = buildBenchmarkPageData(staticData, { status: 'unavailable', windowDays: 30, asOf: null, rows: [] });
  assert.equal(pageData.scores.length, staticData.scores.length);
  assert.ok(pageData.scores.some((row) => row.modelSlug === 'ltx-2'));
});

test('localized sitemap generation includes the benchmark hub', () => {
  const sitemapSource = readFileSync('frontend/next-sitemap.config.js', 'utf8');
  assert.match(sitemapSource, /MARKETING_CORE_PATHS[\s\S]*['"]\/benchmarks['"]/);
});
