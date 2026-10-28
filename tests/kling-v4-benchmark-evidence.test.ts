import assert from 'node:assert/strict';
import test from 'node:test';
import evidence from '../data/benchmarks/kling-v4-evidence.v1.json' with { type: 'json' };
import { loadBenchmarkLabStaticData } from '../frontend/server/benchmark-lab-data';
import { loadAppEngineScoreMap } from '../frontend/src/server/engine-scores';
import { buildBenchmarkPageData } from '../frontend/app/(localized)/[locale]/(marketing)/benchmarks/_lib/benchmark-page-data';

test('the October22 worksheet remains historical while the manual V4 score feeds public and App readers', async () => {
  const data = await loadBenchmarkLabStaticData();
  const page = buildBenchmarkPageData(data, {
    status: 'unavailable', windowDays: 30, asOf: null, rows: [],
  });
  const manual = data.scores.find((row) => (row.modelSlug ?? row.engineId) === evidence.modelSlug);
  assert.ok(manual);
  for (const key of ['fidelity', 'visualQuality', 'motion', 'consistency', 'anatomy', 'textRendering', 'lipsyncQuality', 'sequencingQuality', 'controllability', 'speedStability', 'pricing'] as const) {
    assert.equal(typeof manual[key], 'number', key);
  }
  assert.equal(manual.last_updated, '2026-10-27');
  assert.equal(manual.reviewStatus, undefined);
  assert.equal(page.scores.some((row) => row.modelSlug === evidence.modelSlug), true);
  assert.equal((await loadAppEngineScoreMap())[evidence.modelSlug], 9.2);
  assert.equal(evidence.checkedAt, '2026-10-22');
  assert.equal(evidence.editorialReview.criterionScoresPublished, false);
  assert.equal(evidence.editorialReview.controlledOutputsReviewed, 0);
  assert.equal(evidence.editorialReview.publicVideosInspected, 0);
});

test('the V4 worksheet covers the canonical criteria and resolves every prompt and source', async () => {
  const { methodology } = await loadBenchmarkLabStaticData();
  assert.equal(evidence.editorialReview.methodologyVersion, methodology.version);
  assert.deepEqual(evidence.publication.overallRequiredCriteria, methodology.overallFormula.fields);
  assert.deepEqual(
    evidence.criterionAssessments.map((row) => row.criterion).sort(),
    methodology.criteria.map((row) => row.id).sort(),
  );
  const sources = new Set(evidence.sources.map((source) => source.id));
  const prompts = new Set(methodology.promptPack.map((prompt) => prompt.id));
  for (const assessment of evidence.criterionAssessments) {
    assert.equal(assessment.score, null, `${assessment.criterion} has no observed quality evidence yet`);
    assert.equal(assessment.status, 'withheld');
    assert.ok(assessment.requiredEvidence.length > 0, assessment.criterion);
    for (const source of assessment.sourceIds) assert.ok(sources.has(source), source);
    for (const prompt of assessment.promptPackIds) assert.ok(prompts.has(prompt), prompt);
  }
});

test('search absence and another model review never become V4 numeric evaluations', () => {
  assert.deepEqual(evidence.externalEvaluations, []);
  const sources = new Map(evidence.sources.map((source) => [source.id, source]));
  for (const check of evidence.externalEvaluationChecks) {
    assert.equal(sources.get(check.sourceId)?.type, 'independent-benchmark-publisher');
    assert.equal(check.result, 'no-matching-model-in-retrieved-table');
    assert.equal(Object.hasOwn(check, 'elo'), false);
    assert.equal(Object.hasOwn(check, 'score'), false);
  }
  const excluded = evidence.sources.filter((source) => source.type === 'independent-first-person-review-different-model');
  assert.ok(excluded.length > 0);
  const scoreSourceIds = new Set(evidence.criterionAssessments.flatMap((row) => row.sourceIds));
  for (const source of excluded) assert.equal(scoreSourceIds.has(source.id), false);
});
