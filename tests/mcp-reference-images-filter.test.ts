import assert from 'node:assert/strict';
import test from 'node:test';

import { getFalEngineById } from '../frontend/src/config/falEngines';
import {
  listAgentModels,
  type AgentModelCatalogDeps,
} from '../frontend/src/server/agent-api/model-catalog';
import {
  resolveAgentGenerationEngineExecutability,
  resolveAgentGenerationModeExecutability,
} from '../frontend/src/server/agent-runtime/model-executability';
import type { AgentGenerationMode } from '../frontend/src/server/agent-api/types';
import type { EngineCaps, EngineInputField, Mode } from '../frontend/types/engines';

function registryDeps(ids: string[]): AgentModelCatalogDeps {
  const entries = ids.map((id) => {
    const entry = getFalEngineById(id);
    assert.ok(entry, `Missing test model ${id}`);
    return entry;
  });
  const environment = {
    bytePlusEnabled: true,
    bytePlusApiKey: 'offline-test-key',
    falApiKey: 'offline-test-key',
  };
  return {
    async listEngines() { return entries.map((entry) => entry.engine); },
    surfaceByEngineId(id) {
      return entries.find((entry) => entry.id === id)?.category === 'image' ? 'image' : 'video';
    },
    isEngineExecutable: (engine) => resolveAgentGenerationEngineExecutability(engine, environment).executable,
    isModeExecutable: (engine, mode) => resolveAgentGenerationModeExecutability(engine, mode, environment).executable,
  };
}

function fixtureDeps(
  inputSchema: EngineCaps['inputSchema'],
  options: { modes?: Mode[]; disabledModes?: Mode[] } = {},
): AgentModelCatalogDeps {
  const base = getFalEngineById('kling-v4')!.engine;
  const engine: EngineCaps = {
    ...base,
    id: 'reference-filter-fixture',
    modes: options.modes ?? ['t2v', 'v2v'],
    inputSchema,
  };
  return {
    async listEngines() { return [engine]; },
    surfaceByEngineId() { return 'video'; },
    isModeExecutable: (_, mode) => !options.disabledModes?.includes(mode),
  };
}

test('Kling V4 and Flash Modify accept the image-reference filter without inventing aspect-ratio control', async () => {
  for (const id of ['kling-v4', 'kling-v4-flash']) {
    const deps = registryDeps([id]);
    const models = await listAgentModels({ id, mode: 'v2v', referenceImages: true }, deps);

    assert.deepEqual(models.map((model) => model.id), [id]);
    assert.deepEqual(models[0].modes, ['v2v']);
    assert.equal(models[0].referenceImages, true);
    assert.equal(models[0].generationEnabled, true);
    assert.deepEqual(models[0].aspectRatios, []);
    assert.deepEqual(await listAgentModels({ mode: 'v2v', referenceImages: true, aspectRatio: '16:9' }, deps), []);
  }
});

test('reference-image filtering follows the selected mode and aggregate executable modes', async () => {
  const deps = registryDeps(['kling-v4']);
  for (const { mode, referenceImages, expectedIds } of [
    { mode: undefined, referenceImages: true, expectedIds: ['kling-v4'] },
    { mode: undefined, referenceImages: false, expectedIds: [] },
    { mode: 't2v', referenceImages: true, expectedIds: [] },
    { mode: 't2v', referenceImages: false, expectedIds: ['kling-v4'] },
    { mode: 'v2v', referenceImages: false, expectedIds: [] },
  ] as const) {
    const models = await listAgentModels({ mode, referenceImages }, deps);
    assert.deepEqual(models.map((model) => model.id), expectedIds, `${mode ?? 'all modes'} / ${referenceImages}`);
  }
});

test('image-generation, image-to-video and canonical Standard modes retain image-reference discovery', async () => {
  const cases: { id: string; mode: AgentGenerationMode }[] = [
    { id: 'seedream', mode: 'i2i' },
    { id: 'kling-v4', mode: 'i2v' },
    { id: 'kling-v4', mode: 'ref2v' },
    { id: 'kling-2-5-turbo', mode: 'i2v_standard' },
  ];
  const deps = registryDeps(cases.map(({ id }) => id).filter((id, index, ids) => ids.indexOf(id) === index));
  for (const { id, mode } of cases) {
    const models = await listAgentModels({ id, mode, referenceImages: true }, deps);
    assert.deepEqual(models.map((model) => model.id), [id], `${id} / ${mode}`);
    assert.deepEqual(await listAgentModels({ id, mode, referenceImages: false }, deps), []);
  }
});

test('video-only Modify does not gain image support from its mode name or a different mode', async () => {
  const deps = fixtureDeps({
    required: [{ id: 'video_url', type: 'video', label: 'Source', modes: ['v2v'] }],
    optional: [{ id: 'image_urls', type: 'image', label: 'Images', modes: ['t2v'] }],
  });

  assert.deepEqual(await listAgentModels({ mode: 'v2v', referenceImages: true }, deps), []);
  const [videoOnly] = await listAgentModels({ mode: 'v2v', referenceImages: false }, deps);
  assert.ok(videoOnly);
  assert.equal(videoOnly.referenceImages, false);
  assert.deepEqual((await listAgentModels({ mode: 't2v', referenceImages: true }, deps)).map((model) => model.id), [
    'reference-filter-fixture',
  ]);
});

test('aggregate discovery ignores image fields restricted to a non-executable mode', async () => {
  const deps = fixtureDeps({
    optional: [{ id: 'image_urls', type: 'image', label: 'Images', modes: ['v2v'] }],
  }, { disabledModes: ['v2v'] });

  assert.deepEqual(await listAgentModels({ referenceImages: true }, deps), []);
  const [model] = await listAgentModels({ referenceImages: false }, deps);
  assert.deepEqual(model.modes, ['t2v']);
  assert.deepEqual(await listAgentModels({ mode: 'v2v' }, deps), []);
});

test('required and optional image fields with unrestricted modes apply to Modify', async () => {
  for (const group of ['required', 'optional'] as const) {
    for (const modes of [undefined, []] as (Mode[] | undefined)[]) {
      const field: EngineInputField = { id: 'guide', type: 'image', label: 'Guide', modes };
      const models = await listAgentModels({ mode: 'v2v', referenceImages: true }, fixtureDeps({ [group]: [field] }));
      assert.deepEqual(models.map((model) => model.id), ['reference-filter-fixture'], `${group} / ${String(modes)}`);
    }
  }
});

test('an image-like field name or absent schema does not establish image acceptance', async () => {
  for (const inputSchema of [undefined, { optional: [{ id: 'image_urls', type: 'text' as const, label: 'Metadata' }] }]) {
    const deps = fixtureDeps(inputSchema, { modes: ['i2v'] });
    assert.deepEqual(await listAgentModels({ referenceImages: true }, deps), []);
    const [model] = await listAgentModels({ referenceImages: false }, deps);
    assert.ok(model);
    assert.equal(model.referenceImages, false);
  }
});
