import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildModelLaunchProjectionsFromSources, validateModelLaunchWaveDocument } from '../frontend/server/model-launch-assets-validation';

test('the selected concert and tram are the two exact public Kling readiness assets', () => {
  const document = JSON.parse(readFileSync('docs/model-launch/kling-v4-video-example-pack.json', 'utf8'));
  assert.equal(validateModelLaunchWaveDocument('kling-v4', document).ok, true);
  assert.deepEqual(document.assets.map((asset: {videoId: string}) => asset.videoId), [
    'job_external_fal_a308ea2f899d01a2306e89aecdc9dcd501ed29b5',
    'job_external_fal_7ba203855713484c19652a8a3ef9412b6eac98fe',
  ]);
  for (const asset of document.assets) {
    assert.equal(asset.familyPlaylistId, '243ecbb8-221e-4592-93c1-0a12d85f5c30');
    assert.equal(asset.modelPlaylistId, 'a04d8baf-5b6b-4074-bdb7-9e73dada408d');
    assert.ok(asset.videoUrl.startsWith('https://media.maxvideoai.com/marketing-media/'));
    assert.ok(asset.thumbnailUrl.startsWith('https://media.maxvideoai.com/marketing-media/'));
    assert.ok(asset.previewVideoUrl.startsWith('https://media.maxvideoai.com/marketing-media/'));
    assert.equal(asset.sourceAssetIds.length, 2);
    assert.equal(asset.watchPageCandidate, false);
  }
});

test('absent V4 renders remain unready and do not change historical FLUX/Kling media', () => {
  const sources = Object.fromEntries(['p0', 'p1', 'flux-3-max'].map(wave => [wave, readFileSync(`docs/model-launch/${wave}-video-example-pack.json`, 'utf8')]));
  const result = buildModelLaunchProjectionsFromSources(sources);
  assert.deepEqual(result.full.waves.find(wave => wave.waveId === 'kling-v4'), {
    waveId: 'kling-v4', sourceManifest: 'docs/model-launch/kling-v4-video-example-pack.json', sourceStatus: 'missing', sourceDigest: null,
  });
  assert.equal(result.full.assets.filter(asset => asset.modelId === 'kling-v4').length, 0);
  assert.equal(result.full.assets.filter(asset => asset.modelId === 'flux-3-max').length, 2);
  assert.equal(result.readiness.models.some(model => model.modelId === 'kling-v4'), false);
});

test('V4 qualification requires owned original, poster, short preview and exact model/family playlists', () => {
  // Synthetic test-only records; never written into the launch manifest.
  const assets = [1, 2].map(i => ({ waveId: 'kling-v4', assetId: `test-output-${i}`, videoId: `test-job-${i}`, libraryAssetId: `test-library-${i}`,
    jobId: `test-job-${i}`, modelId: 'kling-v4', engineId: 'kling-v4', familyId: 'kling', mode: 't2v', prompt: 'Test fixture', sourceKind: 'text', sourceAssetIds: [],
    videoUrl: `https://media.maxvideoai.com/test/film-${i}.mp4`, thumbnailUrl: `https://media.maxvideoai.com/test/film-${i}.jpg`, previewVideoUrl: `https://media.maxvideoai.com/test/film-${i}-preview.mp4`,
    width: 1280, height: 720, durationSec: 5, acceptedAt: '2026-10-22T00:00:00Z', reviewStatus: 'accepted', publicationState: 'gallery_only', watchPageCandidate: false,
    familyPlaylistId: 'test-family', modelPlaylistId: 'test-model', playlistSlugs: ['family-kling', 'examples-kling-v4'] }));
  assert.equal(validateModelLaunchWaveDocument('kling-v4', { schemaVersion: 1, assets }).ok, true);
  for (const patch of [{ previewVideoUrl: undefined }, { previewVideoUrl: 'https://media.maxvideoai.com/test/preview.mp4?token=temporary' }, { engineId: 'kling-3-pro' }, { libraryAssetId: null }, { mode: 'extend' }, { thumbnailUrl: '' }]) {
    assert.equal(validateModelLaunchWaveDocument('kling-v4', { schemaVersion: 1, assets: [{ ...assets[0], ...patch }, assets[1]] }).ok, false);
  }
});
