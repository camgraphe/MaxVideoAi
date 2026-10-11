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

test('upload probing reads geometry from the first motion stream, never attached cover art or audio', () => {
  const measured = resolveProbedMediaMetadata({ streams: [
    { codec_type: 'video', width: 300, height: 300, disposition: { attached_pic: 1 } },
    { codec_type: 'video', width: 720, height: 1280, duration: '14' },
  ], format: { format_name: 'mp4', duration: '14' } });
  assert.equal(measured?.width, 720);
  assert.equal(measured?.height, 1280);
  for (const [width, height] of [[0, 1280], [-1, 1280], [720.5, 1280], [720, NaN], [720, Infinity]]) {
    const invalid = resolveProbedMediaMetadata({ streams: [{ codec_type: 'video', width, height }],
      format: { format_name: 'mp4', duration: '14' } });
    assert.equal(invalid?.width, undefined);
    assert.equal(invalid?.height, undefined);
  }
  const audio = resolveProbedMediaMetadata({ streams: [
    { codec_type: 'video', width: 300, height: 300, disposition: { attached_pic: 1 } },
    { codec_type: 'audio' },
  ], format: { format_name: 'mp3', duration: '14' } });
  assert.equal(audio?.width, undefined);
  assert.equal(audio?.height, undefined);
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
