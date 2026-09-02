import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  MODEL_LAUNCH_WAVES,
  type ModelLaunchWave,
} from '../frontend/config/model-launch-waves.ts';
import {
  P0_VIDEO_EXAMPLE_MODEL_IDS,
  parseModelLaunchReadinessProjection,
} from '../frontend/config/model-launch-readiness-schema.ts';
import {
  buildModelLaunchProjectionsFromSources,
} from '../frontend/server/model-launch-assets-validation.ts';

const P1_EXPECTED_MODELS = [
  { modelId: 'gemini-omni-flash', familyId: 'veo' },
  { modelId: 'kling-3-turbo-standard', familyId: 'kling' },
  { modelId: 'kling-3-turbo-pro', familyId: 'kling' },
  { modelId: 'minimax-h3-max', familyId: 'hailuo' },
] as const;

function wave(id: ModelLaunchWave['id']): ModelLaunchWave {
  const result = MODEL_LAUNCH_WAVES.find((candidate) => candidate.id === id);
  assert.ok(result, `Expected ${id} launch wave.`);
  return result;
}

test('versioned launch waves preserve all P0 targets and configure P1 targets', () => {
  const p0 = wave('p0');
  const p1 = wave('p1');

  assert.deepEqual(p0.models.map(({ modelId }) => modelId), [...P0_VIDEO_EXAMPLE_MODEL_IDS]);
  assert.deepEqual(
    p1.models.map(({ modelId, familyId }) => ({ modelId, familyId })),
    P1_EXPECTED_MODELS,
  );
  for (const target of [...p0.models, ...p1.models]) {
    assert.equal(target.requiredVideos, 2, target.modelId);
  }
});

test('a missing P1 manifest preserves validated P0 readiness and marks P1 unready', () => {
  const p0Source = readFileSync('docs/model-launch/p0-video-example-pack.json', 'utf8');
  const projections = buildModelLaunchProjectionsFromSources({ p0: p0Source, p1: null });
  const parsedReadiness = parseModelLaunchReadinessProjection(projections.readiness);

  assert.deepEqual(
    parsedReadiness.waves.map(({ waveId, sourceStatus, models }) => ({
      waveId,
      sourceStatus,
      models: models.map(({ modelId, waveId: modelWaveId }) => ({ modelId, waveId: modelWaveId })),
    })),
    [
      {
        waveId: 'p0',
        sourceStatus: 'validated',
        models: P0_VIDEO_EXAMPLE_MODEL_IDS.map((modelId) => ({ modelId, waveId: 'p0' })),
      },
      { waveId: 'p1', sourceStatus: 'missing', models: [] },
    ],
  );
  assert.deepEqual(
    projections.readiness.waves.find(({ waveId }) => waveId === 'p1')?.models,
    [],
  );
});

test('every P1 target requires exactly two accepted videos', () => {
  assert.throws(
    () => buildModelLaunchProjectionsFromSources({
      p0: null,
      p1: JSON.stringify({ schemaVersion: 1, assets: [] }),
    }),
    /gemini-omni-flash must have exactly 2 accepted assets/,
  );
});

test('launch projections reject an accepted video reused by separate waves', () => {
  const p0Source = readFileSync('docs/model-launch/p0-video-example-pack.json', 'utf8');
  const p0Document = JSON.parse(p0Source) as { schemaVersion: number; assets: Array<Record<string, unknown>> };
  const accepted = p0Document.assets[0];
  assert.ok(accepted);
  const p1Document = {
    schemaVersion: 1,
    assets: P1_EXPECTED_MODELS.flatMap(({ modelId, familyId }, index) => [0, 1].map((videoIndex) => ({
      ...accepted,
      assetId: `p1-${index}-${videoIndex}-asset`,
      videoId: videoIndex === 0 && index === 0 ? accepted.videoId : `p1-${index}-${videoIndex}-video`,
      libraryAssetId: `p1-${index}-${videoIndex}-library`,
      jobId: `p1-${index}-${videoIndex}-job`,
      modelId,
      engineId: modelId,
      familyId,
      mode: videoIndex === 0 ? 't2v' : 'i2v',
      familyPlaylistId: `p1-${familyId}-playlist`,
      modelPlaylistId: `p1-${modelId}-playlist`,
      playlistSlugs: [`family-${familyId}`, `examples-${modelId}`],
    }))),
  };

  assert.throws(
    () => buildModelLaunchProjectionsFromSources({ p0: p0Source, p1: JSON.stringify(p1Document) }),
    /videoId values must be unique across launch waves/,
  );
});
