import assert from 'node:assert/strict';
import test from 'node:test';

import { listFalEngines } from '../frontend/src/config/falEngines';
import { ENV } from '../frontend/src/lib/env';
import {
  listAgentModels,
  listPublicAgentGenerationEngines,
  type AgentModelCatalogDeps,
} from '../frontend/src/server/agent-api/model-catalog';
import {
  resolveAgentGenerationEngineExecutability,
  resolveAgentGenerationModeExecutability,
} from '../frontend/src/server/agent-runtime/model-executability';
import type { EngineCaps, Mode } from '../frontend/types/engines';

function engine(
  id: string,
  modes: Mode[],
  overrides: Partial<EngineCaps> = {}
): EngineCaps {
  const isImage = modes.every((mode) => mode === 't2i' || mode === 'i2i');
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
    modeCaps: Object.fromEntries(modes.map((mode) => [mode, {
      modes: [mode],
      ...(!isImage ? { duration: { options: [5, 10], default: 5 } } : {}),
      resolution: ['1080p'],
      aspectRatio: ['16:9', '9:16'],
    }])),
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

function realRegistryDeps(falApiKey = ENV.FAL_API_KEY): AgentModelCatalogDeps {
  const entries = listFalEngines();
  const environment = () => ({
    bytePlusEnabled: ENV.BYTEPLUS_ARK_ENABLED === 'true',
    bytePlusApiKey: ENV.BYTEPLUS_ARK_API_KEY,
    bytePlusLasApiKey: ENV.BYTEPLUS_LAS_API_KEY,
    bytePlusLasEnabled: (ENV as typeof ENV & { SEEDANCE_2_5_LAS_ENABLED?: string }).SEEDANCE_2_5_LAS_ENABLED === 'true',
    falApiKey,
  });
  return {
    async listEngines() {
      return entries.map((entry) => entry.engine);
    },
    surfaceByEngineId(id) {
      const entry = entries.find((candidate) => candidate.id === id);
      if (!entry) return null;
      return entry.category === 'image' ? 'image' : 'video';
    },
    isEngineExecutable: (engine) =>
      resolveAgentGenerationEngineExecutability(engine, environment()).executable,
    isModeExecutable: (engine, mode) =>
      resolveAgentGenerationModeExecutability(engine, mode, environment()).executable,
  };
}

test('catalog emits a narrow public DTO and supported modes only', async () => {
  const models = await listAgentModels(
    {},
    deps(
      [engine('video-public', ['t2v', 'i2v', 'v2v', 'extend']), engine('image-public', ['t2i', 'i2i'])],
      { 'video-public': 'video', 'image-public': 'image' }
    )
  );

  assert.deepEqual(models, [
    {
      id: 'video-public',
      label: 'video-public',
      surface: 'video',
      modes: ['t2v', 'i2v', 'v2v', 'extend'],
      aspectRatios: ['16:9', '9:16'],
      resolutions: ['1080p'],
      maxDurationSec: 10,
      audio: false,
      referenceImages: true,
      availability: 'available',
      generationEnabled: true,
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
      generationEnabled: true,
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
    engine('unsupported', ['v2v'], { modeCaps: {} }),
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

test('mode-scoped catalog filtering uses modeCaps while aggregate discovery stays available', async () => {
  const splitControls = engine('split-controls', ['t2v', 'i2v'], {
    maxDurationSec: 12,
    resolutions: ['720p', '4k'],
    aspectRatios: ['16:9', '9:16'],
    audio: true,
    modeCaps: {
      t2v: {
        modes: ['t2v'],
        duration: { options: [4, 6], default: 4 },
        resolution: ['720p'],
        aspectRatio: ['16:9'],
        audioToggle: false,
      },
      i2v: {
        modes: ['i2v'],
        duration: { options: [8, 12], default: 8 },
        resolution: ['4k'],
        aspectRatio: ['9:16'],
        audioToggle: true,
      },
    },
  });
  const catalogDeps = deps([splitControls], { 'split-controls': 'video' });

  assert.deepEqual(
    await listAgentModels({ mode: 't2v', resolution: '4k' }, catalogDeps),
    [],
  );
  assert.deepEqual(
    await listAgentModels({ mode: 't2v', aspectRatio: '9:16' }, catalogDeps),
    [],
  );
  assert.deepEqual(
    await listAgentModels({ mode: 't2v', maxDurationSec: 8 }, catalogDeps),
    [],
  );

  const [t2v] = await listAgentModels({ mode: 't2v' }, catalogDeps);
  assert.deepEqual(t2v, {
    id: 'split-controls',
    label: 'split-controls',
    surface: 'video',
    modes: ['t2v'],
    aspectRatios: ['16:9'],
    resolutions: ['720p'],
    maxDurationSec: 6,
    audio: true,
    referenceImages: false,
    availability: 'available',
    generationEnabled: true,
  });

  const [aggregate] = await listAgentModels({}, catalogDeps);
  assert.deepEqual(aggregate.aspectRatios, ['16:9', '9:16']);
  assert.deepEqual(aggregate.resolutions, ['720p', '4k']);
  assert.equal(aggregate.maxDurationSec, 12);
  assert.equal(aggregate.referenceImages, true);
});

test('real Sora 2 Pro never publishes ref2v without an executable mode capability', async () => {
  const registryDeps = realRegistryDeps('test-fal-key');
  const [soraModel] = await listAgentModels({ id: 'sora-2-pro' }, registryDeps);
  const soraCapability = (await listPublicAgentGenerationEngines(registryDeps))
    .find((candidate) => candidate.engine.id === 'sora-2-pro');
  assert.ok(soraModel);
  assert.ok(soraCapability);
  assert.deepEqual(soraModel.modes, ['t2v', 'i2v']);
  assert.deepEqual(soraCapability.publicModes, ['t2v', 'i2v']);
});

test('catalog never advertises H3 generation without an effective Fal credential', async () => {
  const [closedH3] = await listAgentModels({ id: 'minimax-h3' }, realRegistryDeps(''));
  const [readyH3] = await listAgentModels({ id: 'minimax-h3' }, realRegistryDeps('test-fal-key'));

  assert.ok(closedH3);
  assert.ok(readyH3);
  assert.equal(closedH3.generationEnabled, false);
  assert.equal(readyH3.generationEnabled, true);
});

test('catalog applies the requested result limit after capability filtering', async () => {
  const engines = Array.from({ length: 5 }, (_, index) => engine(`video-${index + 1}`, ['t2v']));
  const surfaces = Object.fromEntries(engines.map((item) => [item.id, 'video' as const]));

  const models = await listAgentModels({ surface: 'video', limit: 3 }, deps(engines, surfaces));

  assert.deepEqual(models.map((model) => model.id), ['video-1', 'video-2', 'video-3']);
});

test('catalog mirrors real execution gates for newly registered video models', { concurrency: false }, async () => {
  const extendedEnv = ENV as typeof ENV & { SEEDANCE_2_5_LAS_ENABLED?: string };
  const original = {
    bytePlusEnabled: ENV.BYTEPLUS_ARK_ENABLED,
    seedance25Enabled: ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED,
    seedance25Provider: ENV.SEEDANCE_2_5_PROVIDER,
    seedance25AdminOnly: ENV.SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY,
    seedance25Modes: ENV.SEEDANCE_2_5_BYTEPLUS_MODES,
    seedance25ArkApiKey: ENV.BYTEPLUS_ARK_API_KEY,
    seedance25LasApiKey: ENV.BYTEPLUS_LAS_API_KEY,
    seedance25LasEnabled: extendedEnv.SEEDANCE_2_5_LAS_ENABLED,
  };
  const registryDeps = realRegistryDeps('test-fal-key');

  try {
    ENV.BYTEPLUS_ARK_ENABLED = 'false';
    ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED = 'false';
    ENV.SEEDANCE_2_5_PROVIDER = 'disabled';
    ENV.SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY = 'true';
    ENV.SEEDANCE_2_5_BYTEPLUS_MODES = 't2v';

    const closedModels = await listAgentModels({}, registryDeps);
    assert.equal(
      closedModels.find((model) => model.id === 'seedance-2-5')?.generationEnabled,
      false,
    );
    assert.equal(
      (await listPublicAgentGenerationEngines(registryDeps))
        .some((candidate) => candidate.engine.id === 'seedance-2-5'),
      false,
    );
    assert.deepEqual(
      closedModels.find((model) => model.id === 'minimax-h3'),
      {
        id: 'minimax-h3',
        label: 'MiniMax H3',
        surface: 'video',
        modes: ['t2v', 'i2v', 'ref2v'],
        aspectRatios: ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16', 'auto'],
        resolutions: ['768P', '2K', '4K'],
        maxDurationSec: 15,
        audio: true,
        referenceImages: true,
        availability: 'available',
        generationEnabled: true,
      },
    );

    ENV.BYTEPLUS_ARK_ENABLED = 'true';
    ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED = 'true';
    ENV.SEEDANCE_2_5_PROVIDER = 'byteplus_modelark';
    ENV.SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY = 'false';
    ENV.SEEDANCE_2_5_BYTEPLUS_MODES = 't2v,i2v,ref2v,v2v,extend';
    ENV.BYTEPLUS_ARK_API_KEY = 'ark-test-key';
    ENV.BYTEPLUS_LAS_API_KEY = '';
    extendedEnv.SEEDANCE_2_5_LAS_ENABLED = 'false';

    assert.deepEqual(
      (await listAgentModels({ id: 'seedance-2-5' }, registryDeps))[0],
      {
        id: 'seedance-2-5',
        label: 'Seedance 2.5',
        surface: 'video',
        modes: ['t2v', 'i2v', 'ref2v', 'extend'],
        aspectRatios: ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
        resolutions: ['480p', '720p', '1080p'],
        maxDurationSec: 30,
        audio: true,
        referenceImages: true,
        availability: 'available',
        generationEnabled: true,
      },
    );
    assert.equal(
      (await listAgentModels({ id: 'seedance-2-5', mode: 'v2v' }, registryDeps)).length,
      0,
    );

    ENV.BYTEPLUS_LAS_API_KEY = 'las-test-key';

    assert.deepEqual(
      (await listAgentModels({ id: 'seedance-2-5' }, registryDeps))[0]?.modes,
      ['t2v', 'i2v', 'ref2v', 'extend'],
      'a LAS credential alone must not publish V2V before pricing is approved',
    );

    extendedEnv.SEEDANCE_2_5_LAS_ENABLED = 'true';

    assert.deepEqual(
      (await listAgentModels({ id: 'seedance-2-5' }, registryDeps))[0],
      {
        id: 'seedance-2-5',
        label: 'Seedance 2.5',
        surface: 'video',
        modes: ['t2v', 'i2v', 'ref2v', 'v2v', 'extend'],
        aspectRatios: ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
        resolutions: ['480p', '720p', '1080p'],
        maxDurationSec: 30,
        audio: true,
        referenceImages: true,
        availability: 'available',
        generationEnabled: true,
      },
    );
  } finally {
    ENV.BYTEPLUS_ARK_ENABLED = original.bytePlusEnabled;
    ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED = original.seedance25Enabled;
    ENV.SEEDANCE_2_5_PROVIDER = original.seedance25Provider;
    ENV.SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY = original.seedance25AdminOnly;
    ENV.SEEDANCE_2_5_BYTEPLUS_MODES = original.seedance25Modes;
    ENV.BYTEPLUS_ARK_API_KEY = original.seedance25ArkApiKey;
    ENV.BYTEPLUS_LAS_API_KEY = original.seedance25LasApiKey;
    extendedEnv.SEEDANCE_2_5_LAS_ENABLED = original.seedance25LasEnabled;
  }
});

test('catalog mirrors direct Seedream credential readiness', { concurrency: false }, async () => {
  const original = {
    bytePlusEnabled: ENV.BYTEPLUS_ARK_ENABLED,
    bytePlusApiKey: ENV.BYTEPLUS_ARK_API_KEY,
  };
  const registryDeps = realRegistryDeps();

  try {
    ENV.BYTEPLUS_ARK_ENABLED = 'true';
    ENV.BYTEPLUS_ARK_API_KEY = '';

    assert.equal(
      (await listAgentModels({ id: 'seedream' }, registryDeps))[0]?.generationEnabled,
      false,
    );

    ENV.BYTEPLUS_ARK_API_KEY = 'test-key';

    assert.equal(
      (await listAgentModels({ id: 'seedream' }, registryDeps))[0]?.generationEnabled,
      true,
    );
  } finally {
    ENV.BYTEPLUS_ARK_ENABLED = original.bytePlusEnabled;
    ENV.BYTEPLUS_ARK_API_KEY = original.bytePlusApiKey;
  }
});
