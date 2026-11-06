import assert from 'node:assert/strict';
import test from 'node:test';
import { recastSettings } from '../frontend/server/character-studio/recast-request';
import { validateVideoExcerptRange } from '../frontend/lib/video-excerpt';

const input = {
  portrait: { assetId: 'ma_' + '1'.repeat(32) },
  direction: 'Dance', dialogue: '', seconds: 15,
  resolution: '1080p', aspectRatio: '9:16',
};
const limits = { sourceFieldId: 'video', minDurationSec: null, maxDurationSec: 15,
  maxSizeMB: 100, durationPolicy: 'requested' as const };

for (const kind of ['video', 'audio'] as const) {
  test(`${kind}: an exact 15-second decimal passage is accepted by both selection and submission`, () => {
    const range = { startSec: 1.1, endSec: 16.1 };
    assert.equal(recastSettings.safeParse({ ...input, [kind]: { assetId: 'ma_' + '2'.repeat(32), range } }).success, true);
    assert.deepEqual(validateVideoExcerptRange(range, 22, limits), range);
    const overflow = { startSec: 1.1, endSec: 16.100001 };
    assert.equal(recastSettings.safeParse({ ...input, [kind]: { assetId: 'ma_' + '2'.repeat(32), range: overflow } }).success, false);
    assert.throws(() => validateVideoExcerptRange(overflow, 22, limits));
  });
}

test('the total cap uses the selected passage and does not count reference audio as input video', () => {
  const video = { assetId: 'ma_' + '2'.repeat(32), range: { startSec: 18.125, endSec: 25.125 } };
  const audio = { assetId: 'ma_' + '3'.repeat(32), range: { startSec: 8.25, endSec: 13.5 } };
  assert.equal(recastSettings.safeParse({ ...input, video, audio, seconds: 23 }).success, true);
  assert.equal(recastSettings.safeParse({ ...input, video, audio, seconds: 24 }).success, false);
  assert.equal(recastSettings.safeParse({ ...input, audio, seconds: 30 }).success, true);
});
