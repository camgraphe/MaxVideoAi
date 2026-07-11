import assert from 'node:assert/strict';
import test from 'node:test';

import { listAgentModels, type AgentModelCatalogDeps } from '../frontend/src/server/agent-api/model-catalog';
import type { EngineCaps, Mode } from '../frontend/types/engines';

function engine(
  id: string,
  modes: Mode[],
  overrides: Partial<EngineCaps> = {}
): EngineCaps {
  return {
    id,
    label: id,
    provider: 'test',
    status: 'live',
    latencyTier: 'standard',
    modes,
    maxDurationSec: modes.some((mode) => mode.endsWith('2i')) ? 0 : 10,
    resolutions: ['1080p'],
    aspectRatios: ['16:9', '9:16'],
    fps: [24],
    audio: false,
    upscale4k: false,
    extend: false,
    motionControls: false,
    keyframes: false,
    params: {},
    inputLimits: {},
    updatedAt: '2026-07-11T00:00:00.000Z',
    ttlSec: 300,
    availability: 'available',
    ...overrides,
  };
}

function deps(engines: EngineCaps[], surfaces: Record<string, 'video' | 'image' | null>): AgentModelCatalogDeps {
  return {
    async listEngines() {
      return engines;
    },
    surfaceByEngineId(id) {
      return surfaces[id] ?? null;
    },
  };
}

test('catalog emits a narrow public DTO and supported modes only', async () => {
  const models = await listAgentModels(
    {},
    deps(
      [engine('video-public', ['t2v', 'i2v', 'v2v']), engine('image-public', ['t2i', 'i2i'])],
      { 'video-public': 'video', 'image-public': 'image' }
    )
  );

  assert.deepEqual(models, [
    {
      id: 'video-public',
      label: 'video-public',
      surface: 'video',
      modes: ['t2v', 'i2v'],
      aspectRatios: ['16:9', '9:16'],
      resolutions: ['1080p'],
      maxDurationSec: 10,
      audio: false,
      referenceImages: true,
      availability: 'available',
    },
    {
      id: 'image-public',
      label: 'image-public',
      surface: 'image',
      modes: ['t2i', 'i2i'],
      aspectRatios: ['16:9', '9:16'],
      resolutions: ['1080p'],
      maxDurationSec: null,
      audio: false,
      referenceImages: true,
      availability: 'available',
    },
  ]);
  assert.equal('pricing' in models[0], false);
  assert.equal('provider' in models[0], false);
});

test('hidden, disabled, admin-only, maintenance, and unsupported engines never appear', async () => {
  const engines = [
    engine('public', ['t2v']),
    engine('labs', ['t2v'], { isLab: true }),
    engine('disabled', ['t2v'], { availability: 'paused' }),
    engine('admin', ['t2v'], { apiAvailability: 'admin only' }),
    engine('maintenance', ['t2v'], { status: 'maintenance' }),
    engine('unsupported', ['v2v']),
  ];
  const surfaces = Object.fromEntries(engines.map((item) => [item.id, 'video' as const]));
  const catalogDeps = deps(engines, surfaces);

  assert.deepEqual((await listAgentModels({}, catalogDeps)).map((model) => model.id), ['public']);
  for (const id of ['labs', 'disabled', 'admin', 'maintenance', 'unsupported']) {
    assert.deepEqual(await listAgentModels({ id }, catalogDeps), []);
  }
});

test('catalog filters against real capabilities', async () => {
  const catalogDeps = deps(
    [
      engine('video-basic', ['t2v']),
      engine('video-reference', ['ref2v'], { audio: true, maxDurationSec: 12 }),
      engine('image-reference', ['i2i']),
    ],
    { 'video-basic': 'video', 'video-reference': 'video', 'image-reference': 'image' }
  );

  const matches = await listAgentModels(
    { surface: 'video', mode: 'ref2v', maxDurationSec: 10, audio: true, referenceImages: true },
    catalogDeps
  );

  assert.deepEqual(matches.map((model) => model.id), ['video-reference']);
});
