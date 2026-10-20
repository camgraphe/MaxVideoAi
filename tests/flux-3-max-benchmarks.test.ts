import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { computeBenchmarkOverall, loadBenchmarkLabStaticData } from '../frontend/server/benchmark-lab-data.ts';
import { loadAppEngineScoreMap } from '../frontend/src/server/engine-scores.ts';
import { buildBenchmarkPageData } from '../frontend/app/(localized)/[locale]/(marketing)/benchmarks/_lib/benchmark-page-data.ts';

const evidence = JSON.parse(readFileSync('data/benchmarks/flux-3-max-evidence.v1.json', 'utf8'));

test('FLUX 3 Max editorial estimates are sourced per criterion without claiming controlled runs or converting Elo', async () => {
  const data = await loadBenchmarkLabStaticData();
  const rows = data.scores.filter((row) => row.modelSlug === 'flux-3-max');
  assert.equal(rows.length, 1);
  assert.equal(evidence.criterionAssessments.length, 11);
  const sourceIds = new Set(evidence.sources.map((source: { id: string }) => source.id));
  const sampleIds = new Set(evidence.publicSampleObservations.map((sample: { id: string }) => sample.id));
  for (const criterion of data.methodology.criteria) {
    const assessment = evidence.criterionAssessments.find((entry: { criterion: string }) => entry.criterion === criterion.id);
    assert.ok(assessment, criterion.id);
    assert.ok(Number.isFinite(assessment.score) && assessment.score >= 0 && assessment.score <= 10);
    assert.equal(rows[0]![criterion.id], assessment.score);
    assert.ok(assessment.rationale && assessment.calibration && assessment.confidence);
    for (const id of assessment.sourceIds) assert.ok(sourceIds.has(id), id);
    for (const id of assessment.sampleIds) assert.ok(sampleIds.has(id), id);
  }
  assert.equal(computeBenchmarkOverall(rows[0]!), 8.7);
  assert.equal((await loadAppEngineScoreMap())['flux-3-max'], 8.7);
  assert.equal(evidence.editorialReview.status, 'editorial-estimated');
  assert.equal(evidence.editorialReview.criterionScoresPublished, true);
  assert.equal(evidence.editorialReview.controlledOutputsReviewed, 0);
  assert.equal(evidence.editorialReview.promptPackExecuted, false);
  assert.equal(evidence.criterionAssessments.find((entry: { criterion: string }) => entry.criterion === 'lipsyncQuality').confidence, 'very-low');
});

test('FLUX 3 Max factual specs and the same derived editorial score reach the benchmark page', async () => {
  const data = await loadBenchmarkLabStaticData();
  const page = buildBenchmarkPageData(data, {
    status: 'unavailable', windowDays: 30, asOf: '2026-10-20T00:00:00.000Z', rows: [],
  });
  const spec = page.specs.find((row) => row.modelSlug === 'flux-3-max');
  assert.ok(spec);
  assert.equal(spec.maxDuration, '20s');
  assert.equal(spec.maxResolution, '1080p (upscaled from 720p)');
  assert.equal(spec.sourceKind, 'route-contract');
  assert.equal(spec.mechanicsUrl, 'https://fal.ai/models/blackforestlabs/flux-3-max/text-to-video/api');
  const score = page.scores.find((row) => row.modelSlug === 'flux-3-max');
  assert.ok(score);
  assert.equal(score.overall, 8.7);
});

test('external preference snapshots retain independent tasks, uncertainty and source dates', () => {
  assert.equal(evidence.checkedAt, '2026-10-20');
  assert.equal(evidence.externalEvaluations.length, 2);
  assert.deepEqual(evidence.externalEvaluations.map((row: { elo: number }) => row.elo), [1138, 1159]);
  for (const row of evidence.externalEvaluations) {
    assert.equal(row.audio, true);
    assert.equal(row.resolution, '720p');
    assert.equal(row.confidenceLevel, 0.95);
    assert.ok(row.confidenceInterval[0] < row.elo && row.elo < row.confidenceInterval[1]);
    assert.ok(row.rankRange[0] <= row.displayedRank && row.displayedRank <= row.rankRange[1]);
    assert.ok(row.samples > 0);
    assert.match(row.sourceUrl, /^https:\/\/artificialanalysis\.ai\/video\/leaderboard\//);
  }
  assert.notEqual(evidence.externalEvaluations[0].benchmark, evidence.externalEvaluations[1].benchmark);
});
