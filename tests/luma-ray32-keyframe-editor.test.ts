import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatKeyframeSlots,
  parseKeyframeSlots,
} from '../frontend/app/(core)/(workspace)/app/_lib/luma-ray32-keyframes';

test('Luma Ray 3.2 keyframe editor keeps user-deleted keyframe slots deleted', () => {
  assert.equal(parseKeyframeSlots('', [], 64, 119).length, 4);

  const clearedValue = formatKeyframeSlots([]);
  assert.deepEqual(parseKeyframeSlots(clearedValue, [], 64, 119), []);

  assert.deepEqual(parseKeyframeSlots('0:0, 1:119', [], 64, 119), [
    { assetSlot: 0, frameIndex: 0 },
    { assetSlot: 1, frameIndex: 119 },
  ]);
});
