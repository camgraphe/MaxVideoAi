import assert from 'node:assert/strict';
import test from 'node:test';
import { readMediaFacts, canonicalMediaAssetFields } from '../frontend/lib/media-identity';
import { resolveProbedMediaMetadata } from '../frontend/server/media/detect-has-audio';

test('the existing full-stream probe retains positive and negative embedded audio evidence', () => {
  for (const hasAudio of [true, false]) {
    const measured = resolveProbedMediaMetadata({ streams: [{ codec_type: 'video' }, ...(hasAudio ? [{ codec_type: 'audio' }] : [])], format: { format_name: 'mp4', duration: '6.25' } });
    assert.equal(measured?.hasAudio, hasAudio);
  }
});

test('only measured facts survive; negative audio evidence and fractional duration survive', () => {
  assert.equal(readMediaFacts({ durationSec: 8 }), undefined);
  assert.deepEqual(readMediaFacts({ source: 'probe', durationSec: 9.25, hasAudio: false, width: -1 }), { source: 'probe', durationSec: 9.25, hasAudio: false });
  assert.equal(readMediaFacts({ source: 'probe', durationSec: NaN }), undefined);
});
test('canonical upload aliases are additive and never manufactured from legacy identifiers', () => {
  const assetId = `ma_${'a'.repeat(32)}`;
  assert.deepEqual(canonicalMediaAssetFields(assetId, 'audio'), { assetId, ref: { type: 'asset', assetId, kind: 'audio' } });
  for (const invalid of [null, 'legacy-1', 'https://example.com', 'x'.repeat(300)]) {
    assert.deepEqual(canonicalMediaAssetFields(invalid, 'image'), {});
  }
});
