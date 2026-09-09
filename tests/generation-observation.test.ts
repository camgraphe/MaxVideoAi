import assert from 'node:assert/strict';
import test from 'node:test';
import { degradedGenerationObservation, generationStage, generationTimingView, isStaleGenerationUpdate, normalizeGenerationObservation } from '../frontend/lib/generation-observation';
import { getRenderEta } from '../frontend/lib/render-eta';
import type { EngineCaps } from '../frontend/types/engines';

const engine = (props: Partial<EngineCaps>) => ({ id: 'veo-3-1', label: 'Veo', ...props } as EngineCaps);

test('observed milliseconds become engine-wide seconds without duration or quality multipliers', () => {
  for (const durationSec of [1, 5, 20]) {
    assert.deepEqual(getRenderEta(engine({ avgDurationMs: 123_400, durationSampleCount: 7 }), durationSec), {
      seconds: 123, label: '≈ 2.0 min', source: 'observed', sampleCount: 7,
    });
  }
  assert.equal(getRenderEta(engine({ avgDurationMs: 2_500 }), 5).seconds, 3);
});

test('missing, nonfinite and nonpositive averages retain explicit approximate fallback', () => {
  for (const avgDurationMs of [undefined, null, NaN, Infinity, -1, 0]) {
    const result = getRenderEta(engine({ avgDurationMs }), 8);
    assert.equal(result.source, 'heuristic');
    assert.equal(result.sampleCount, null);
    assert.ok(Number.isFinite(result.seconds) && result.seconds > 0);
  }
});

test('provider provenance preserves zero and clamps valid telemetry, rejecting synthetic or nonfinite values', () => {
  for (const [value, expected] of [[0, 0], [-3, 0], [120, 100], [45.5, 45.5]]) {
    assert.equal(normalizeGenerationObservation({ stage: 'processing', providerPercent: { value, provider: 'fal', source: 'provider' } })?.providerPercent?.value, expected);
  }
  for (const input of [
    { progress: 50 },
    { providerPercent: { value: 50, source: 'internal', provider: 'fal' } },
    { providerPercent: { value: NaN, source: 'provider', provider: 'fal' } },
    { providerPercent: { value: Infinity, source: 'provider', provider: 'fal' } },
    { providerPercent: { value: '50', source: 'provider', provider: 'fal' } },
    { providerPercent: { value: 50, source: 'provider', provider: '' } },
  ]) assert.equal(normalizeGenerationObservation({ stage: 'processing', ...input })?.providerPercent, undefined);
});

test('confirmed stages do not require a numeric percentage', () => {
  assert.equal(generationStage('IN_PROGRESS'), 'processing');
  assert.equal(generationStage('queued'), 'queued');
  assert.equal(generationStage('processing', true), 'finalizing');
  assert.equal(generationStage('completed', true), 'completed');
  assert.equal(generationStage('pending'), 'pending');
});

test('elapsed, total estimate and overdue are independent; a failed check never advances freshness', () => {
  const last = { stage: 'processing' as const, checkedAt: 100_000 };
  const failed = degradedGenerationObservation(last);
  assert.equal(failed.checkedAt, 100_000);
  assert.equal(failed.degraded, true);
  assert.deepEqual(generationTimingView(130_000, 10_000, 100, failed), {
    elapsedSeconds: 120, estimatedSeconds: 100, overdue: true, checkedAgoSeconds: 30, degraded: true,
  });
  assert.equal(generationTimingView(140_000, 10_000, 200, last).degraded, true);
  assert.equal(generationTimingView(100_000, undefined, NaN).overdue, false);
});

test('terminal and stale observations cannot regress an accepted result', () => {
  assert.equal(isStaleGenerationUpdate({ status: 'completed' }, {}), false, 'partial media repairs have no regressing status');
  for (const status of ['completed', 'failed']) {
    assert.equal(isStaleGenerationUpdate({ status }, { status: 'pending' }), true);
  }
  assert.equal(isStaleGenerationUpdate({ status: 'pending', observation: { stage: 'processing', checkedAt: 20 } }, { status: 'pending', observation: { stage: 'queued', checkedAt: 10 } }), true);
  assert.equal(isStaleGenerationUpdate({ status: 'pending', observation: { stage: 'processing', checkedAt: 20 } }, { status: 'completed', observation: { stage: 'completed', checkedAt: 10 } }), false, 'a real completed result is immediately usable');
});

test('server degradation keeps the last confirmed check instead of looking freshly confirmed', async () => {
  const { mergeGenerationObservation } = await import('../frontend/lib/generation-observation');
  assert.deepEqual(mergeGenerationObservation({ stage: 'processing', checkedAt: 100 }, { stage: 'queued' }), { stage: 'processing', checkedAt: 100 });
  assert.deepEqual(mergeGenerationObservation({ stage: 'processing', checkedAt: 100 }, { stage: 'processing', checkedAt: 200, degraded: true }), { stage: 'processing', checkedAt: 100, degraded: true });
});
