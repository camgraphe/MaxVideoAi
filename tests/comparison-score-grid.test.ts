import assert from 'node:assert/strict';
import test from 'node:test';
import { orderCompareMetrics } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_components/CompareScoreGrid';
import { buildComparisonMetrics, deriveCompareStrengths, type CompareMetric } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-scorecard';
import { replaceCriteriaCount } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-text';

function metric(id: string, leftValue = 8, rightValue = 8): CompareMetric {
  return { id, label: id, tooltip: id, leftValue, rightValue };
}

test('the first six score rows use a fixed order even when neither model has native audio', () => {
  const metrics = [
    metric('speed_stability'), metric('controllability'),
    metric('multi_shot_sequencing'), metric('text_ui_legibility'),
    metric('human_fidelity'), metric('temporal_consistency'),
    metric('motion_realism'), metric('visual_quality'), metric('prompt_adherence'),
  ];
  assert.deepEqual(orderCompareMetrics(metrics).slice(0, 6).map((row) => row.id), [
    'prompt_adherence', 'visual_quality', 'motion_realism',
    'human_fidelity', 'controllability', 'temporal_consistency',
  ]);
  assert.equal(metrics[0].id, 'speed_stability');
});

test('the scorecard keeps price quotes separate from editorial ratings', () => {
  const input = {
    compareCopy: {},
    leftScore: null,
    rightScore: null,
    speedScores: { leftScore: null, rightScore: null },
  };
  const withAudio = buildComparisonMetrics({ ...input, pairHasNativeAudio: true });
  const withoutAudio = buildComparisonMetrics({ ...input, pairHasNativeAudio: false });
  assert.equal(withAudio.length, 10);
  assert.equal(withoutAudio.length, 9);
  assert.ok(withAudio.every(row => row.id !== 'pricing'));
  assert.deepEqual(deriveCompareStrengths([metric('motion_realism', 8.8, 8.1)], 'left'), ['motion_realism']);
});

test('localized UI copy counts match the shorter scorecard', () => {
  assert.equal(replaceCriteriaCount('an 11-point scorecard', 10), 'a 10-criterion scorecard');
  assert.equal(replaceCriteriaCount('11 critères', 9), '9 critères');
  assert.equal(replaceCriteriaCount('11 criterios', 10), '10 criterios');
});
