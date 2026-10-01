import assert from 'node:assert/strict';
import test from 'node:test';
import { factsFromProbe, readGeneratedVideoFacts, videoDuration } from '../frontend/lib/generated-video-media-facts';

const original = { url: 'https://owned.test/original.mp4', sha256: 'a'.repeat(64), sizeBytes: 12 };
for (const duration of [15, 15.001]) {
  test(`preserves exact duration ${duration} independently of requested output`, () => {
    const facts = factsFromProbe({ streams: [{ codec_type: 'video', duration: String(duration) }], format: { duration: String(duration) } }, original);
    assert.equal(videoDuration({ mediaFacts: facts, requestedDurationSec: 10 }, original.url, 10), duration);
  });
}
test('retains divergent video, audio and container durations', () => {
  const facts = factsFromProbe({ streams: [{ codec_type: 'video', duration: '15' }, { codec_type: 'audio', duration: '15.02' }], format: { duration: '15.04' } }, original);
  assert.equal(facts?.videoDurationSec, 15);
  assert.equal(facts?.audioDurationSec, 15.02);
  assert.equal(facts?.containerDurationSec, 15.04);
  assert.equal(facts?.durationSec, 15.04);
});
test('URL replacement invalidates provenance instead of resurrecting nominal duration', () => {
  const facts = factsFromProbe({ streams: [{ codec_type: 'video', duration: '15.001' }] }, original);
  assert.equal(readGeneratedVideoFacts(facts, 'https://owned.test/replacement.mp4'), null);
  assert.equal(videoDuration({ mediaFacts: facts, durationSec: 15 }, 'https://owned.test/replacement.mp4', 15), null);
});
test('unknown measurements remain unknown; legacy nominal remains compatible', () => {
  assert.equal(factsFromProbe({ streams: [{ codec_type: 'video' }] }, original), null);
  assert.equal(videoDuration({}, original.url, 15), 15);
  assert.equal(videoDuration({}, original.url, null), null);
});
test('invalid fingerprint and nonfinite values cannot become trusted facts', () => {
  const facts = factsFromProbe({ streams: [{ codec_type: 'video', duration: '15' }] }, original)!;
  assert.equal(readGeneratedVideoFacts({ ...facts, original: { ...original, sha256: 'bad' } }, original.url), null);
  assert.equal(readGeneratedVideoFacts({ ...facts, durationSec: Infinity }, original.url), null);
});
