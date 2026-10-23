import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveProbedMediaMetadata } from '../frontend/server/media/detect-has-audio';

for (const rotation of [-270, -90, 90, 270, 450]) {
  test(`phone upload with ${rotation} degree display rotation has portrait geometry`, () => {
    const result = resolveProbedMediaMetadata({ streams: [{ codec_type: 'video', width: 3840, height: 2160,
      side_data_list: [{ rotation }] }], format: { format_name: 'mov,mp4', duration: '5.558333' } });
    assert.equal(result?.width, 2160);
    assert.equal(result?.height, 3840);
    assert.equal(result?.durationSec, 5.558);
  });
}

test('legacy rotate tags are honored; a display matrix takes precedence over a stale tag', () => {
  const base = { codec_type: 'video', width: 1920, height: 1080, tags: { rotate: '90' } };
  const metadata = { streams: [base], format: { format_name: 'mov,mp4', duration: '6' } };
  assert.equal(resolveProbedMediaMetadata(metadata)?.width, 1080);
  assert.equal(resolveProbedMediaMetadata({ ...metadata, streams: [{ ...base, side_data_list: [{ rotation: 0 }] }] })?.width, 1920);
});

for (const rotation of [0, 180, -180, 360, NaN]) {
  test(`a ${rotation} degree rotation does not swap landscape dimensions`, () => {
    const result = resolveProbedMediaMetadata({ streams: [{ codec_type: 'video', width: 1920, height: 1080,
      side_data_list: [{ rotation }] }], format: { format_name: 'mp4', duration: '6' } });
    assert.equal(result?.width, 1920);
    assert.equal(result?.height, 1080);
  });
}
