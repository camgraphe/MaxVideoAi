import assert from 'node:assert/strict';
import test from 'node:test';
import { selectCreatorSource } from '../frontend/src/components/tools/creator/creator-source-selection';

test('source selection carries canonical identity and exact original, never a thumbnail or guessed ID', () => {
  const asset = { id: 'ma_11111111111111111111111111111111', url: 'https://private.example/original', thumbUrl: 'https://private.example/thumb', kind: 'image' as const };
  const selected = selectCreatorSource(asset, 'image');
  assert.deepEqual(selected.ref, { type: 'asset', assetId: asset.id, kind: 'image' });
  assert.equal(selected.url, asset.url);
  assert.equal(selected.thumbnailUrl, asset.thumbUrl);
  assert.throws(() => selectCreatorSource({ ...asset, id: 'gallery-card-0' }, 'image'));
  assert.throws(() => selectCreatorSource(asset, 'video'));
  assert.throws(() => selectCreatorSource({ ...asset, url: 'javascript:alert(1)' }, 'image'));
});

test('upload selection prefers the canonical ref over legacy IDs and keeps fractional measured duration', () => {
  const selected = selectCreatorSource({ id: 'legacy-42', assetId: 'ma_22222222222222222222222222222222', url: 'https://private.example/audio.wav', mime: 'audio/wav', durationSec: 7.412 }, 'audio');
  assert.equal(selected.ref.type === 'asset' && selected.ref.assetId, 'ma_22222222222222222222222222222222');
  assert.equal(selected.durationSec, 7.412);
});

test('library continuation uses an exact returned output identity and never derives an output index', () => {
  const asset = { id: 'card-17', jobId: 'job-original', sourceOutputId: 'output-exact', url: 'https://private.example/video.mp4', kind: 'video' };
  assert.deepEqual(selectCreatorSource(asset, 'video').ref, { type: 'job-output', jobId: 'job-original', outputId: 'output-exact', kind: 'video' });
  assert.throws(() => selectCreatorSource({ ...asset, sourceOutputId: undefined }, 'video'));
});
