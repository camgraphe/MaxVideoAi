import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { JSDOM } from 'jsdom';
import { computeBenchmarkOverall, loadBenchmarkLabStaticData } from '../frontend/server/benchmark-lab-data';
import { loadAppEngineScoreMap, loadAppEngineScoreReviewMap } from '../frontend/src/server/engine-scores';
import { loadHubEngineScoreData } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/_lib/ai-video-engines-scores';
import { loadEngineScores } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-data-loaders';
import { buildComparisonMetrics } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-scorecard';
import { CompareScoreGrid } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_components/CompareScoreGrid';
import { buildBenchmarkPageData } from '../frontend/app/(localized)/[locale]/(marketing)/benchmarks/_lib/benchmark-page-data';
import { getBenchmarkCopy } from '../frontend/app/(localized)/[locale]/(marketing)/benchmarks/_lib/benchmark-copy';
import { BenchmarkScoreTable } from '../frontend/app/(localized)/[locale]/(marketing)/benchmarks/_components/BenchmarkScoreTable';

(globalThis as typeof globalThis & { React: typeof React }).React = React;
const model = 'kling-v4-flash';
const evidence = JSON.parse(readFileSync('data/benchmarks/kling-v4-flash-evidence.v1.json', 'utf8'));

test('Flash publishes all eleven justified editorial criteria through the canonical score owner', async () => {
  const data = await loadBenchmarkLabStaticData();
  const rows = data.scores.filter(row => row.modelSlug === model);
  assert.equal(rows.length, 1, 'Flash needs a canonical score row');
  const score = rows[0]!;
  assert.equal(score.reviewStatus, 'editorial-estimated');
  assert.equal(score.last_updated, '2026-11-06');
  assert.equal(evidence.criterionAssessments.length, 11);
  for (const criterion of data.methodology.criteria) {
    const assessment = evidence.criterionAssessments.find((item: { criterion: string }) => item.criterion === criterion.id);
    assert.ok(assessment, criterion.id);
    assert.ok(Number.isFinite(assessment.score) && assessment.score > 0 && assessment.score <= 10, criterion.id);
    assert.equal(score[criterion.id], assessment.score);
    assert.ok(assessment.rationale && assessment.confidence && assessment.sourceIds.length, criterion.id);
    for (const id of assessment.sourceIds) assert.ok(evidence.sources.some((source: { id: string }) => source.id === id), id);
  }
  assert.equal(evidence.editorialReview.promptPackExecuted, false);
  assert.equal(evidence.editorialReview.criterionScoresPublished, true);
  assert.equal(evidence.publication.scoreRowPresent, true);
  assert.equal(evidence.editorialReview.status, 'editorial-estimated');
});

test('Flash comparison scores render without missing cells in both orders and all three locales', async () => {
  const scores = await loadEngineScores();
  const flash = scores.get(model);
  const standard = scores.get('kling-v4');
  assert.ok(flash?.review && standard);
  for (const locale of ['en', 'fr', 'es'] as const) {
    assert.equal(flash.review.disclosure[locale], evidence.publicCopy[locale]);
    for (const flashLeft of [true, false]) {
      const metrics = buildComparisonMetrics({ compareCopy: {}, leftScore: flashLeft ? flash : standard, rightScore: flashLeft ? standard : flash, pairHasNativeAudio: true, speedScores: { leftScore: null, rightScore: null } });
      assert.equal(metrics.length, 10);
      assert.ok(metrics.every(metric => Number.isFinite(metric.leftValue) && Number.isFinite(metric.rightValue)));
      const document = new JSDOM(renderToStaticMarkup(React.createElement(CompareScoreGrid, { metrics, locale, leftName: 'Left', rightName: 'Right', missingLabel: 'MISSING-SCORE' }))).window.document;
      const cells = [...document.querySelectorAll(`.compare-score-value--${flashLeft ? 'left' : 'right'}`)];
      assert.equal(cells.length, 10);
      assert.ok(cells.every(cell => cell.textContent?.includes('≈')));
      assert.ok(!document.body.textContent?.includes('MISSING-SCORE'));
      document.defaultView?.close();
    }
  }
});

test('Flash benchmark, comparison hub and App share one complete editorial overall', async () => {
  const data = await loadBenchmarkLabStaticData();
  const page = buildBenchmarkPageData(data, { status: 'unavailable', windowDays: 30, asOf: null, rows: [] });
  const row = page.scores.find(item => item.modelSlug === model);
  assert.ok(row?.review);
  const [appScores, appReviews, hub] = await Promise.all([loadAppEngineScoreMap(), loadAppEngineScoreReviewMap(), loadHubEngineScoreData()]);
  assert.equal(row.overall, 8.3);
  assert.equal(appScores[model], row.overall);
  assert.equal(hub.scores.get(model), row.overall);
  assert.equal(appReviews[model], 'editorial-estimated');
  assert.equal(hub.reviews[model], 'editorial-estimated');
  assert.equal(computeBenchmarkOverall(data.scores.find(item => item.modelSlug === model)!), row.overall);
  for (const locale of ['en', 'fr', 'es'] as const) {
    const html = renderToStaticMarkup(React.createElement(NextIntlClientProvider, { locale, messages: {}, children: React.createElement(BenchmarkScoreTable, { copy: getBenchmarkCopy(locale), locale, rows: [row] }) }));
    const document = new JSDOM(html).window.document;
    assert.equal((document.querySelector('tbody')?.textContent?.match(/≈/g) ?? []).length, 12);
    assert.ok(document.querySelector(`#review-${model}`)?.textContent?.includes(evidence.publicCopy[locale]));
    document.defaultView?.close();
  }
});

test('the targeted Flash text assessment retains one approved native result and its limitations', () => {
  const sample = JSON.parse(readFileSync('docs/launch/2026-11-05-model-refresh/flash-text-score-sample.json', 'utf8'));
  assert.equal(sample.modelSlug, model);
  assert.equal(sample.status, 'completed');
  assert.equal(sample.paymentStatus, 'paid_wallet');
  assert.equal(sample.savedToLibrary, true);
  assert.equal(sample.priceCents, 62);
  assert.equal(sample.approval.attempts, 1);
  assert.equal(sample.approval.retries, 0);
  assert.deepEqual(sample.review.observedText, ['SECTOR 9', 'EVACUATE']);
  assert.match(sample.original.sha256, /^[a-f0-9]{64}$/);
  assert.equal(sample.review.textScore, 8.2);
  assert.equal(sample.review.confidence, 'low');
  assert.ok(sample.review.limits.length >= 3);
});
