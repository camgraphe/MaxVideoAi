import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { JSDOM } from 'jsdom';
import evidence from '../data/benchmarks/seedance-2-5-flash-evidence.v1.json' with { type: 'json' };
import scores from '../data/benchmarks/engine-scores.v1.json' with { type: 'json' };
import { loadBenchmarkLabStaticData } from '../frontend/server/benchmark-lab-data';
import { loadAppEngineScoreMap, loadAppEngineScoreReviewMap } from '../frontend/src/server/engine-scores';
import { getAgentModelGuidance } from '../frontend/src/server/agent-api/model-guidance';
import { buildBenchmarkPageData } from '../frontend/app/(localized)/[locale]/(marketing)/benchmarks/_lib/benchmark-page-data';
import { getBenchmarkCopy } from '../frontend/app/(localized)/[locale]/(marketing)/benchmarks/_lib/benchmark-copy';
import { BenchmarkScoreTable } from '../frontend/app/(localized)/[locale]/(marketing)/benchmarks/_components/BenchmarkScoreTable';
import { loadEngineScores } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-data-loaders';
import { loadHubEngineScoreData } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/_lib/ai-video-engines-scores';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

test('Flash estimates resolve their own evidence and disclose the three capability-only priors', async () => {
  const { methodology } = await loadBenchmarkLabStaticData();
  const row = scores.scores.find(row => row.modelSlug === evidence.modelSlug)!;
  assert.ok(row);
  assert.equal(row.reviewStatus, 'editorial-estimated');
  assert.equal(row.evidenceFile, 'seedance-2-5-flash-evidence.v1.json');
  assert.equal(evidence.editorialReview.ownedCompletedSamples, 8);
  assert.equal(evidence.editorialReview.ownedQualityScoredSamples, 0);
  assert.equal(evidence.editorialReview.controlledBenchmark, false);
  assert.equal(evidence.editorialReview.independentReviewCompleted, false);
  assert.deepEqual(Object.keys(evidence.criterionAssessments).sort(), methodology.criteria.map(item => item.id).sort());
  const sourceIds = new Set(evidence.sources.map(source => source.id));
  for (const [id, assessment] of Object.entries(evidence.criterionAssessments)) {
    assert.equal(row[id as keyof typeof row], assessment.score, id);
    assert.ok(assessment.score > 0 && assessment.score <= 10, id);
    assert.ok(assessment.sourceIds.length > 0, id);
    assert.ok(assessment.sourceIds.every(source => sourceIds.has(source)), id);
  }
  for (const id of ['textRendering', 'lipsyncQuality', 'sequencingQuality'] as const) {
    assert.equal(evidence.criterionAssessments[id].support, 'indirect-capability-prior');
    assert.equal(evidence.criterionAssessments[id].confidence, 'low');
  }
  assert.equal(evidence.criterionAssessments.pricing.support, 'prepared-customer-tariff-comparison');
  assert.deepEqual(evidence.editorialReview.overallFields, methodology.overallFormula.fields);
});

test('App, comparison hub and comparison detail preserve the same Flash estimate', async () => {
  const [app, reviews, hub, comparisons] = await Promise.all([
    loadAppEngineScoreMap(), loadAppEngineScoreReviewMap(), loadHubEngineScoreData(), loadEngineScores(),
  ]);
  assert.equal(app[evidence.modelSlug], 8.0);
  assert.equal(reviews[evidence.modelSlug], 'editorial-estimated');
  assert.equal(hub.scores.get(evidence.modelSlug), 8.0);
  assert.equal(hub.reviews[evidence.modelSlug], 'editorial-estimated');
  assert.equal(comparisons.get(evidence.modelSlug)?.review?.status, 'editorial-estimated');
  assert.match(getAgentModelGuidance(evidence.modelSlug)!.considerations.join(' '), /provisional editorial estimates/);
  const guidance = getAgentModelGuidance(evidence.modelSlug)!.considerations.join(' ');
  assert.match(guidance, /audio-only references and MP4\/MOV output are supported/);
  assert.doesNotMatch(guidance, /audio-only references are not supported/);
});

test('the public Flash table has all eleven qualified scores and only the necessary methodology link', async () => {
  const data = buildBenchmarkPageData(await loadBenchmarkLabStaticData(), { status: 'unavailable', windowDays: 30, asOf: null, rows: [] });
  const row = data.scores.find(row => row.modelSlug === evidence.modelSlug)!;
  assert.equal(row.overall, evidence.editorialReview.overall);
  assert.equal(row.review?.sourceUrl, null);
  for (const locale of ['en', 'fr', 'es'] as const) {
    const html = renderToStaticMarkup(React.createElement(NextIntlClientProvider, {
      locale, messages: {}, children: React.createElement(BenchmarkScoreTable, { copy: getBenchmarkCopy(locale), locale, rows: [row] }),
    }));
    const document = new JSDOM(html).window.document;
    assert.equal((document.querySelector('tbody')?.textContent?.match(/≈/g) ?? []).length, 12);
    const disclosure = document.querySelector(`#review-${evidence.modelSlug}`)!;
    assert.ok(disclosure.textContent?.includes(evidence.publicCopy[locale]));
    assert.deepEqual([...disclosure.querySelectorAll('a')].map(link => link.getAttribute('href')), ['#methodology']);
    document.defaultView?.close();
  }
});
