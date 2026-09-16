import assert from 'node:assert/strict';
import test from 'node:test';
import { selectGenerationTiming, type GenerationTimingCell } from '../frontend/lib/generation-timing';
import { getRenderEta } from '../frontend/lib/render-eta';
import type { EngineCaps } from '../frontend/types/engines';

function cell(overrides: Partial<GenerationTimingCell> = {}): GenerationTimingCell {
  return { mode: null, durationSec: null, resolution: null, sampleCount: 10, averageDurationMs: 100_000,
    recentSampleCount: 10, recentAverageDurationMs: 100_000, ...overrides };
}
const settings = { mode: 'i2v', resolution: '720p', durationSec: 5 };

test('exact settings use their own ten-render mean, normalized resolution and correct sample count', () => {
  const cells = [cell(), cell({ mode: 'i2v', averageDurationMs: 200_000, recentAverageDurationMs: 200_000 }),
    cell({ ...settings, averageDurationMs: 300_000, recentAverageDurationMs: 300_000 }),
    cell({ ...settings, resolution: '1080p', averageDurationMs: 900_000, recentAverageDurationMs: 900_000 })];
  const engine = { timingCells: cells, avgDurationMs: 500_000 } as EngineCaps;
  assert.deepEqual(selectGenerationTiming(cells, { ...settings, resolution: ' 720P ' }), { averageDurationMs: 300_000, sampleCount: 10 });
  assert.equal(getRenderEta(engine, 5, settings).seconds, 300);
  assert.equal(getRenderEta(engine, 10, settings).seconds, 200, 'unseen duration uses mode mean, no invented duration multiplier');
  assert.equal(getRenderEta(engine, 5, { ...settings, mode: 't2v' }).seconds, 100);
  assert.equal(getRenderEta(engine, 5, { ...settings, resolution: '1080p' }).seconds, 900);
});

test('one observation is blended, empty matrix retains the existing heuristic', () => {
  const cells = [cell(), cell({ ...settings, sampleCount: 1, recentSampleCount: 1, averageDurationMs: 600_000, recentAverageDurationMs: 600_000 })];
  assert.equal(selectGenerationTiming(cells, settings)?.averageDurationMs, 200_000);
  assert.equal(getRenderEta({ id: 'new-model', timingCells: [] } as unknown as EngineCaps, 5, settings).source, 'heuristic');
});

test('old data seeds estimates without overpowering recent observations', () => {
  assert.equal(selectGenerationTiming([cell({ recentSampleCount: 0, recentAverageDurationMs: null })], {})?.averageDurationMs, 100_000);
  assert.equal(selectGenerationTiming([cell({ sampleCount: 1001, averageDurationMs: 100_800_000 / 1001, recentSampleCount: 1, recentAverageDurationMs: 800_000 })], {})?.averageDurationMs, 1_300_000 / 6);
  assert.equal(selectGenerationTiming([cell({ sampleCount: 1005, recentSampleCount: 5, recentAverageDurationMs: 800_000 })], {})?.averageDurationMs, 800_000);
});


test('an unstable matching cohort retains all measurements but falls back to its broader reference', () => {
  const unstable = cell({ ...settings, averageDurationMs: 600_000, recentAverageDurationMs: 600_000, recentStdDevDurationMs: 2_000_000 });
  assert.equal(selectGenerationTiming([cell(), unstable], settings)?.averageDurationMs, 100_000);
  assert.equal(unstable.averageDurationMs, 600_000, 'no observation or raw mean is discarded');
});

test('a volatile engine-wide mean is rejected and cannot return through the legacy average', () => {
  const volatile = cell({ sampleCount: 3, recentSampleCount: 3, averageDurationMs: 1_551_997, recentAverageDurationMs: 1_551_997,
    stdDevDurationMs: 1_270_000, recentStdDevDurationMs: 1_270_000 });
  assert.equal(selectGenerationTiming([volatile], {}), null);
  const result = getRenderEta({ id: 'wan-3-prime', timingCells: [volatile], avgDurationMs: 1_551_997 } as EngineCaps, 15);
  assert.equal(result.source, 'heuristic');
  assert.notEqual(result.seconds, 1552);
});
