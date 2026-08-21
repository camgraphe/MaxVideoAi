import assert from 'node:assert/strict';
import test from 'node:test';
import scores from '../data/benchmarks/engine-scores.v1.json' with { type: 'json' };
import { computeBenchmarkOverall } from '../frontend/server/benchmark-lab-data';

const completeMetrics = {
  'minimax-h3': {
    fidelity: 8.6,
    visualQuality: 8.5,
    motion: 8.4,
    consistency: 8.4,
    anatomy: 8.1,
    textRendering: 8.3,
    lipsyncQuality: 8.7,
    sequencingQuality: 8.6,
    controllability: 9.0,
    speedStability: 7.6,
    pricing: 9.7,
  },
  'seedance-2-5': {
    fidelity: 9.1,
    visualQuality: 9.2,
    motion: 9.2,
    consistency: 9.0,
    anatomy: 8.9,
    textRendering: 8.5,
    lipsyncQuality: 9.3,
    sequencingQuality: 9.4,
    controllability: 9.0,
    speedStability: 7.7,
    pricing: 7.2,
  },
} as const;

test('MiniMax H3 and Seedance 2.5 publish all eleven benchmark scores', () => {
  for (const [modelSlug, expected] of Object.entries(completeMetrics)) {
    const score = scores.scores.find((row) => row.modelSlug === modelSlug);
    assert.ok(score, `${modelSlug} must have a benchmark row`);
    assert.deepEqual(
      Object.fromEntries(Object.keys(expected).map((metric) => [metric, score[metric as keyof typeof score]])),
      expected
    );
  }
});

test('public positioning keeps Seedance 2.5 above Kling O3 Pro and H3 just below Kling', () => {
  const overall = (modelSlug: string) => {
    const score = scores.scores.find((row) => row.modelSlug === modelSlug);
    assert.ok(score, `${modelSlug} must have a benchmark row`);
    return computeBenchmarkOverall(score);
  };

  assert.equal(overall('seedance-2-5'), 9.1);
  assert.equal(overall('kling-o3-pro'), 8.6);
  assert.equal(overall('minimax-h3'), 8.5);
  assert.ok(overall('seedance-2-5')! > overall('kling-o3-pro')!);
  assert.ok(overall('kling-o3-pro')! > overall('minimax-h3')!);
  assert.equal(Number((overall('kling-o3-pro')! - overall('minimax-h3')!).toFixed(1)), 0.1);
});
