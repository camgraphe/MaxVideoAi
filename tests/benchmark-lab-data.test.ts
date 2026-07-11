import assert from 'node:assert/strict';
import test from 'node:test';
import methodology from '../data/benchmarks/benchmark-methodology.v1.json' with { type: 'json' };
import scores from '../data/benchmarks/engine-scores.v1.json' with { type: 'json' };
import {
  computeBenchmarkOverall,
  loadBenchmarkLabStaticData,
  loadBenchmarkScoreSlugs,
} from '../frontend/server/benchmark-lab-data';

test('benchmark methodology is versioned and preserves the current overall formula', () => {
  assert.equal(methodology.version, '1.0.0');
  assert.equal(methodology.effectiveDate, '2026-07-11');
  assert.deepEqual(methodology.overallFormula.fields, ['fidelity', 'motion', 'consistency']);
  assert.equal(methodology.overallFormula.method, 'arithmetic_mean');
  assert.equal(methodology.overallFormula.roundToDecimals, 1);
  assert.equal(methodology.criteria.length, 11);
  assert.equal(new Set(methodology.criteria.map((criterion) => criterion.id)).size, 11);
  assert.equal(methodology.promptPack.length, 8);
  assert.ok(methodology.promptPack.every((entry) => entry.language === 'en-US'));
  assert.ok(methodology.promptPack.every((entry) => entry.prompt.length >= 120));
  assert.deepEqual(methodology.operationalLatency, {
    windowDays: 30,
    minimumCompletedJobs: 30,
    minimumDistinctUsers: 5,
    medianPercentile: 0.5,
    slowPercentile: 0.9,
  });
});

test('static loader returns the current score and specification sources unchanged', async () => {
  const data = await loadBenchmarkLabStaticData();
  assert.equal(data.scores.length, scores.scores.length);
  assert.ok(data.specs.length >= data.scores.length);
  assert.equal(data.methodology.version, '1.0.0');
  assert.equal(data.scores.find((row) => row.modelSlug === 'sora-2')?.last_updated, '2026-01-27');
});

test('overall score stays aligned with current model and compare hubs', () => {
  assert.equal(computeBenchmarkOverall({ fidelity: 8.4, motion: 7.9, consistency: 7.4 }), 7.9);
  assert.equal(computeBenchmarkOverall({ fidelity: 8.4, motion: null, consistency: undefined }), 8.4);
  assert.equal(computeBenchmarkOverall({}), null);
});

test('score slug lookup exposes the exact current editorial roster', async () => {
  const slugs = await loadBenchmarkScoreSlugs();
  assert.equal(slugs.size, scores.scores.length);
  assert.ok(slugs.has('kling-3-pro'));
  assert.ok(slugs.has('dreamina-seedance-2-0-mini'));
});
