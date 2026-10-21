import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { MODEL_LAUNCH_WAVES } from '../frontend/config/model-launch-waves';
import { parseModelLaunchReadinessProjection } from '../frontend/config/model-launch-readiness-schema';
import {
  buildModelLaunchProjectionsFromSources, buildP0LaunchProjectionsFromSource,
  projectAcceptedDurableModelAssets, validateModelLaunchWaveDocument,
} from '../frontend/server/model-launch-assets-validation';

const priorSources = {
  p0: readFileSync('docs/model-launch/p0-video-example-pack.json', 'utf8'),
  p1: readFileSync('docs/model-launch/p1-video-example-pack.json', 'utf8'),
};

// Synthetic test fixtures only. Operational evidence is filled from verified adopted jobs.
function document() {
  return { schemaVersion: 1, assets: [1, 9].map(index => ({
    waveId: 'flux-3-max', assetId: `test-output-${index}`, videoId: `test-job-${index}`,
    libraryAssetId: `test-library-${index}`, jobId: `test-job-${index}`, modelId: 'flux-3-max', engineId: 'flux-3-max',
    familyId: 'flux', mode: 't2v', prompt: `Test-only reviewed scene ${index}`, sourceKind: 'text', sourceAssetIds: [],
    videoUrl: `https://media.maxvideoai.com/test-only/film-${index}.mp4`,
    thumbnailUrl: `https://media.maxvideoai.com/test-only/film-${index}.jpg`,
    width: 1280, height: 704, durationSec: index === 1 ? 18 + 1 / 24 : 16 + 1 / 24,
    acceptedAt: '2026-10-20T12:00:00Z', reviewStatus: 'accepted', publicationState: 'gallery_only',
    watchPageCandidate: false, familyPlaylistId: 'test-family-flux', modelPlaylistId: 'test-examples-max',
    playlistSlugs: ['family-flux', 'examples-flux-3-max'],
  })) };
}

test('Max has a separate wave and absent evidence preserves historical readiness without making Max ready', () => {
  const wave = MODEL_LAUNCH_WAVES.find(wave => wave.id === 'flux-3-max');
  assert.ok(wave);
  assert.equal(wave.sourceManifest, 'docs/model-launch/flux-3-max-video-example-pack.json');
  assert.deepEqual(wave.models, [{ modelId: 'flux-3-max', familyId: 'flux', requiredVideos: 2 }]);
  const result = buildModelLaunchProjectionsFromSources(priorSources);
  assert.equal(result.full.assets.length, 22);
  assert.equal(result.readiness.models.length, 11);
  assert.deepEqual(result.readiness.waves.find(wave => wave.waveId === 'flux-3-max')?.models, []);
  assert.equal(result.readiness.waves.find(wave => wave.waveId === 'flux-3-max')?.sourceStatus, 'missing');
  assert.deepEqual(parseModelLaunchReadinessProjection(result.readiness), result.readiness);
  assert.equal(buildP0LaunchProjectionsFromSource(priorSources.p0).readiness.waves.length, 3);
});

test('a complete separate Max pair validates without changing the P0/P1 source evidence', () => {
  const before = buildModelLaunchProjectionsFromSources(priorSources);
  const after = buildModelLaunchProjectionsFromSources({ ...priorSources, 'flux-3-max': JSON.stringify(document()) });
  assert.deepEqual(after.full.assets.filter(asset => asset.waveId !== 'flux-3-max'), before.full.assets);
  assert.deepEqual(after.full.waves.slice(0, 2), before.full.waves.slice(0, 2));
  assert.equal(after.readiness.models.find(model => model.modelId === 'flux-3-max')?.acceptedAssetCount, 2);
  assert.equal(projectAcceptedDurableModelAssets(after.full).length, 24);
});

test('Max readiness rejects a partial pair, missing adoption or playlist facts, invalid modes and source mappings', () => {
  const incomplete = document(); incomplete.assets.pop();
  assert.equal(validateModelLaunchWaveDocument('flux-3-max', incomplete).ok, false);
  for (const patch of [
    { jobId: null }, { videoId: null }, { libraryAssetId: null }, { familyPlaylistId: null },
    { modelPlaylistId: null }, { videoUrl: null }, { thumbnailUrl: null }, { reviewStatus: 'pending_adoption' },
    { videoUrl: 'https://media.maxvideoai.com/film.mp4?token=temporary' },
    { thumbnailUrl: 'https://user:password@media.maxvideoai.com/poster.jpg' },
    { engineId: 'flux-3' }, { mode: 'extend' }, { sourceKind: 'image', sourceAssetIds: ['test-reference'] },
    { mode: 'i2v' }, { mode: 'fl2v', sourceKind: 'image', sourceAssetIds: ['test-reference'] },
    { mode: 'ref2v', sourceKind: 'references', sourceAssetIds: [] },
  ]) {
    const invalid = document(); Object.assign(invalid.assets[0], patch);
    assert.equal(validateModelLaunchWaveDocument('flux-3-max', invalid).ok, false, JSON.stringify(patch));
  }
});

test('Max launch source validation follows the engine reference counts for every supported mode', () => {
  for (const [mode, sourceKind, count] of [
    ['i2v', 'image', 1], ['i2v', 'image', 2], ['fl2v', 'image', 2],
    ['ref2v', 'references', 1], ['ref2v', 'references', 10],
  ] as const) {
    const valid = document();
    Object.assign(valid.assets[0], { mode, sourceKind, sourceAssetIds: Array.from({ length: count }, (_, index) => `test-source-${index}`) });
    assert.equal(validateModelLaunchWaveDocument('flux-3-max', valid).ok, true, `${mode}/${count}`);
  }
  const over = document();
  Object.assign(over.assets[0], { mode: 'ref2v', sourceKind: 'references', sourceAssetIds: Array.from({ length: 11 }, (_, index) => `test-source-${index}`) });
  assert.equal(validateModelLaunchWaveDocument('flux-3-max', over).ok, false);
});
