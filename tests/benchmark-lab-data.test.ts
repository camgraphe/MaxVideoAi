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

test('Seedance 2.5 exposes only City and Train supported score criteria', () => {
  const score = scores.scores.find((row) => row.modelSlug === 'seedance-2-5');
  assert.ok(score);

  for (const criterion of ['fidelity', 'visualQuality', 'motion', 'consistency', 'controllability'] as const) {
    assert.equal(typeof score[criterion], 'number', `${criterion} should have accepted visual evidence`);
    assert.ok(score[criterion] > 0, `${criterion} must not use zero as a scored value`);
  }
  assert.deepEqual(
    {
      anatomy: score.anatomy,
      textRendering: score.textRendering,
      lipsyncQuality: score.lipsyncQuality,
      sequencingQuality: score.sequencingQuality,
      speedStability: score.speedStability,
      pricing: score.pricing,
    },
    {
      anatomy: null,
      textRendering: null,
      lipsyncQuality: null,
      sequencingQuality: null,
      speedStability: null,
      pricing: null,
    }
  );
  assert.equal(computeBenchmarkOverall(score), 9.1);
});

test('Seedance 2.5 specifications expose the factual public model card contract', async () => {
  const data = await loadBenchmarkLabStaticData();
  const spec = data.specs.find((row) => row.modelSlug === 'seedance-2-5');
  assert.ok(spec?.keySpecs);

  assert.equal(spec.keySpecs.maxDuration, '4-30s');
  assert.equal(spec.keySpecs.maxResolution, '480p / 720p');
  assert.deepEqual(spec.keySpecs.aspectRatios, ['16:9']);
  assert.deepEqual(spec.keySpecs.fpsOptions, ['24 fps']);
  assert.equal(spec.keySpecs.nativeAudioGeneration, 'Optional');
  assert.deepEqual(spec.keySpecs.workflows, [
    'Text-to-video',
    'Image-to-video',
    'Reference-to-video',
    'Video editing',
    'Extension',
  ]);
  assert.equal(spec.keySpecs.referenceLimit, 'Up to 50 combined references');
  assert.equal(spec.keySpecs.referenceImageStyle, 'Up to 30 image references');
  assert.equal(spec.keySpecs.referenceVideo, 'Up to 10 video references');
  assert.equal(spec.keySpecs.referenceAudio, 'Up to 10 audio references');
});

test('score slug lookup exposes the exact current editorial roster', async () => {
  const slugs = await loadBenchmarkScoreSlugs();
  assert.equal(slugs.size, scores.scores.length);
  assert.ok(slugs.has('kling-3-pro'));
  assert.ok(slugs.has('dreamina-seedance-2-0-mini'));
  assert.ok(slugs.has('seedance-2-5'));
});
