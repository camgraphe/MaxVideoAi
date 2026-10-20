import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { JSDOM } from 'jsdom';
import evidence from '../data/benchmarks/flux-3-max-evidence.v1.json' with { type: 'json' };
import { loadBenchmarkScoreReview } from '../frontend/server/benchmark-score-review';
import { loadBenchmarkLabStaticData } from '../frontend/server/benchmark-lab-data';
import { getBenchmarkScoreReviewCopy } from '../frontend/lib/benchmark-score-review';
import { buildBenchmarkPageData } from '../frontend/app/(localized)/[locale]/(marketing)/benchmarks/_lib/benchmark-page-data';
import { getBenchmarkCopy } from '../frontend/app/(localized)/[locale]/(marketing)/benchmarks/_lib/benchmark-copy';
import { BenchmarkScoreTable } from '../frontend/app/(localized)/[locale]/(marketing)/benchmarks/_components/BenchmarkScoreTable';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

test('estimate disclosure survives missing evidence without inheriting another review status', async () => {
  assert.equal(await loadBenchmarkScoreReview({ reviewStatus: 'accepted' }), null);
  const review = await loadBenchmarkScoreReview({ reviewStatus: 'editorial-estimated', evidenceFile: '../engine-scores.v1.json', reviewSourceUrl: 'javascript:alert(1)' });
  assert.ok(review);
  assert.equal(review.sourceUrl, null);
  for (const locale of ['en', 'fr', 'es'] as const) {
    assert.equal(review.disclosure[locale], getBenchmarkScoreReviewCopy(locale).fallback);
  }
});

test('public score table qualifies estimated total and all criteria and exposes localized source disclosure', async () => {
  const staticData = await loadBenchmarkLabStaticData();
  const data = buildBenchmarkPageData(staticData, { status: 'unavailable', windowDays: 30, asOf: null, rows: [] });
  const row = data.scores.find((item) => item.modelSlug === 'flux-3-max');
  assert.ok(row?.review);
  assert.equal(row.overall, 8.7);
  assert.equal(row.review.status, 'editorial-estimated');
  assert.equal(data.scores.find((item) => item.modelSlug === 'flux-3')?.review, null);
  for (const locale of ['en', 'fr', 'es'] as const) {
    assert.equal(row.review.disclosure[locale], evidence.publicCopy[locale]);
    const copy = getBenchmarkCopy(locale);
    const html = renderToStaticMarkup(React.createElement(NextIntlClientProvider, { locale, messages: {}, children: React.createElement(BenchmarkScoreTable, { copy, locale, rows: [row] }) }));
    const document = new JSDOM(html).window.document;
    assert.equal((document.querySelector('tbody')?.textContent?.match(/≈/g) ?? []).length, 12);
    const disclosure = document.querySelector('#review-flux-3-max');
    assert.ok(disclosure);
    assert.ok(disclosure.textContent?.includes(evidence.publicCopy[locale]));
    assert.equal(disclosure.querySelector('a[href="https://fal.ai/flux-3-max"]')?.textContent, getBenchmarkScoreReviewCopy(locale).source);
    assert.equal(disclosure.querySelector('a[href="#methodology"]')?.textContent, getBenchmarkScoreReviewCopy(locale).method);
    document.defaultView?.close();
  }
});

test('comparison metrics and export retain the estimated side in both display orders', async () => {
  const { loadEngineScores } = await import('../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-data-loaders');
  const { buildComparisonMetrics } = await import('../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-scorecard');
  const { CompareScoreGrid } = await import('../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_components/CompareScoreGrid');
  const { buildComparisonExport } = await import('../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-export');
  const { loadHubEngineScoreData } = await import('../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/_lib/ai-video-engines-scores');
  const scores = await loadEngineScores();
  const max = scores.get('flux-3-max');
  const standard = scores.get('flux-3');
  assert.ok(max?.review && standard);
  const hub = await loadHubEngineScoreData();
  assert.equal(hub.scores.get('flux-3-max'), 8.7);
  assert.equal(hub.reviews['flux-3-max'], 'editorial-estimated');
  assert.equal(hub.reviews['flux-3'], undefined);
  for (const locale of ['en', 'fr', 'es'] as const) {
    for (const maxLeft of [true, false]) {
      const metrics = buildComparisonMetrics({ compareCopy: {}, leftScore: maxLeft ? max : standard, rightScore: maxLeft ? standard : max, pairHasNativeAudio: true, speedScores: { leftScore: null, rightScore: null } });
      assert.ok(metrics.every(metric => metric.leftEstimated === maxLeft && metric.rightEstimated === !maxLeft));
      const html = renderToStaticMarkup(React.createElement(CompareScoreGrid, { metrics, locale, leftName: 'Left', rightName: 'Right', missingLabel: '—' }));
      const document = new JSDOM(html).window.document;
      const estimated = [...document.querySelectorAll(`.compare-score-value--${maxLeft ? 'left' : 'right'}`)];
      const other = [...document.querySelectorAll(`.compare-score-value--${maxLeft ? 'right' : 'left'}`)];
      assert.equal(estimated.length, 10);
      assert.ok(estimated.every(cell => cell.textContent?.includes('≈')));
      assert.ok(other.every(cell => !cell.textContent?.includes('≈')));
      document.defaultView?.close();
      const markdown = buildComparisonExport({ locale, path: '/ai-video-engines/flux-3-vs-flux-3-max', leftName: 'Left', rightName: 'Right', metrics, specRows: [], leftUpdated: null, rightUpdated: null, leftPricing: { headline: '—', subline: null, prices: [], quoteUnavailable: true }, rightPricing: { headline: '—', subline: null, prices: [], quoteUnavailable: true }, priceSnapshotAt: '2026-10-20', labels: { pending: '—', supported: 'Yes', notSupported: 'No', na: '—' }, sources: [], scoreReviews: [{ name: 'FLUX 3 Max', review: max.review }] });
      assert.ok(markdown.includes(evidence.publicCopy[locale]));
      assert.ok(markdown.includes('https://fal.ai/flux-3-max'));
      assert.equal((markdown.match(/≈/g) ?? []).length, 10);
    }
  }
});
