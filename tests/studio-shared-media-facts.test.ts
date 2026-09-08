import assert from 'node:assert/strict';
import test from 'node:test';
import { readMediaFacts, canonicalMediaAssetFields } from '../frontend/lib/media-identity';

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
