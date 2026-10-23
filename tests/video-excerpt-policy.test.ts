import assert from 'node:assert/strict';
import test from 'node:test';
import { getBaseEngineIncludingHidden } from '../frontend/src/lib/engines';
import { getVideoExcerptLimits, validateVideoExcerptRange } from '../frontend/lib/video-excerpt';
import type { EngineCaps } from '../frontend/types/engines';
const engine = (id: string) => { const value = getBaseEngineIncludingHidden(id); assert.ok(value, id); return value; };
test('source-field limits keep Luma Modify 18 separate from Reframe 10 and output timing', () => {
  const luma = engine('luma-ray-3-2');
  assert.equal(getVideoExcerptLimits(luma, 'v2v')?.maxDurationSec, 18);
  assert.equal(getVideoExcerptLimits(luma, 'v2v')?.durationPolicy, 'source_video');
  assert.equal(getVideoExcerptLimits(luma, 'reframe')?.maxDurationSec, 10);
  assert.equal(getVideoExcerptLimits(luma, 'reframe')?.durationPolicy, 'requested');
});
test('Kling input 10 is independent from requested output 15, and Wan input is 15', () => {
  const kling = engine('kling-o3-standard');
  assert.equal(kling.maxDurationSec, 15);
  assert.equal(getVideoExcerptLimits(kling, 'v2v')?.minDurationSec, 3);
  assert.equal(getVideoExcerptLimits(kling, 'v2v')?.maxDurationSec, 10);
  assert.equal(getVideoExcerptLimits(kling, 'v2v')?.durationPolicy, 'requested');
  assert.equal(getVideoExcerptLimits(engine('wan-3'), 'v2v')?.maxDurationSec, 15);
});
test('Seedance uses the actual source field, including extension, rather than unrelated reference fields', () => {
  for (const [id, max] of [['seedance-2-0', 15], ['seedance-2-5', 30]] as const) {
    assert.equal(getVideoExcerptLimits(engine(id), 'v2v')?.maxDurationSec, max);
    assert.equal(getVideoExcerptLimits(engine(id), 'v2v')?.minDurationSec, null);
    assert.equal(getVideoExcerptLimits(engine(id), 'extend')?.sourceFieldId, 'extension_source_videos');
  }
  const custom = structuredClone(engine('seedance-2-0'));
  const field = custom.inputSchema!.optional!.find(value => value.id === 'video_url')!;
  field.minDurationSec = 4; field.maxDurationSec = 12;
  assert.equal(getVideoExcerptLimits(custom, 'v2v')?.minDurationSec, 4);
  assert.equal(getVideoExcerptLimits(custom, 'v2v')?.maxDurationSec, 12);
});
test('Ray 2 has no invented source cap; unsupported or closed modes cannot prepare', () => {
  assert.equal(getVideoExcerptLimits(engine('lumaRay2'), 'v2v')?.maxDurationSec, null);
  assert.equal(getVideoExcerptLimits(engine('luma-ray-3-2'), 'extend'), null);
  const closed: EngineCaps = { ...engine('luma-ray-3-2'), modeAvailability: { v2v: { available: false, reason: 'provider_disabled' } } };
  assert.equal(getVideoExcerptLimits(closed, 'v2v'), null);
});
test('ranges reject nonfinite, reversed, source overflow and model overflow without silently trimming', () => {
  const limits = getVideoExcerptLimits(engine('luma-ray-3-2'), 'v2v')!;
  assert.deepEqual(validateVideoExcerptRange({ startSec: 20, endSec: 38 }, 60, limits), { startSec: 20, endSec: 38 });
  for (const range of [{startSec: -1, endSec: 2}, {startSec: 4, endSec: 4}, {startSec: 5, endSec: 3}, {startSec: NaN, endSec: 4}, {startSec: 0, endSec: Infinity}, {startSec: 50, endSec: 61}, {startSec: 0, endSec: 18.01}]) assert.throws(() => validateVideoExcerptRange(range, 60, limits));
});
