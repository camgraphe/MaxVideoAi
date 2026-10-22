import assert from 'node:assert/strict';
import test from 'node:test';
import { estimateLumaAgentsVideoCost } from '../frontend/src/server/video-providers/luma-agents/cost';

for (const [mode, durationSec, resolution, hdr, exrExport, expected] of [
  ['t2v', 5, '720p', false, false, 0.3], ['t2v', 5, '720p', true, false, 0.6],
  ['t2v', 5, '1080p', true, true, 3.6], ['v2v', 5, '720p', false, false, 1.08],
  ['v2v', 10, '720p', true, false, 4.32], ['v2v', 5, '1080p', true, true, 6.48],
  ['reframe', 10, '720p', false, false, 1.2],
] as const) test(`direct ${mode} ${durationSec}s ${resolution} hdr=${hdr} exr=${exrExport} records ${expected} USD`, () => {
  assert.equal(estimateLumaAgentsVideoCost({ engineId: 'luma-ray-3-2', mode, durationSec, resolution, hdr, exrExport }).providerCostUsd, expected);
});

test('unpriced or invalid Luma cost scenarios never silently become 5s SDR estimates', () => {
  for (const override of [
    { durationSec: 8 }, { durationSec: 10.1 }, { durationSec: NaN }, { resolution: '4k' },
    { hdr: true, resolution: '540p' }, { exrExport: true, hdr: false },
    { mode: 'reframe', hdr: true }, { mode: 't2v', durationSec: 10, hdr: true },
  ]) {
    assert.equal(estimateLumaAgentsVideoCost({ engineId: 'luma-ray-3-2', mode: 'v2v',
      durationSec: 5, resolution: '720p', ...override }).providerCostUsd, null);
  }
});
