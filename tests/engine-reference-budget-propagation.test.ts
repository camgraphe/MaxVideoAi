import assert from 'node:assert/strict';
import test from 'node:test';

import { FAL_ENGINE_REGISTRY } from '../frontend/src/config/falEngines.ts';
import {
  cloneEngine,
  getBaseEnginesByCategory,
} from '../frontend/src/lib/engines.ts';
import { getPublicConfiguredEnginesByCategory } from '../frontend/src/server/engines.ts';
import type { EngineReferenceBudget } from '../frontend/types/engines.ts';

test('Seedance 2.5 keeps its unified 50-reference budget when cloned', () => {
  const entry = FAL_ENGINE_REGISTRY.find((candidate) => candidate.id === 'seedance-2-5');
  assert.ok(entry);

  const clonedBudget = cloneEngine(entry.engine).inputSchema?.referenceBudget;
  assert.deepEqual(clonedBudget, {
    fieldIds: [
      'image_url',
      'end_image_url',
      'image_urls',
      'video_url',
      'video_urls',
      'extension_source_videos',
      'audio_urls',
    ],
    modes: ['i2v', 'ref2v', 'v2v', 'extend'],
    maxTotal: 50,
    countUniqueUrls: true,
  });
  assert.notStrictEqual(clonedBudget?.fieldIds, entry.engine.inputSchema?.referenceBudget?.fieldIds);
});

test('engine clone and configured projection preserve independent aggregate reference budgets', async () => {
  const registryEntry = FAL_ENGINE_REGISTRY.find(
    (entry) =>
      (entry.category ?? 'video') === 'video' &&
      entry.surfaces.app.enabled &&
      entry.engine.inputSchema
  );
  assert.ok(registryEntry);

  const originalInputSchema = registryEntry.engine.inputSchema;
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const referenceBudget: EngineReferenceBudget = {
    fieldIds: ['synthetic_images', 'synthetic_videos'],
    modes: ['ref2v', 'v2v'],
    maxTotal: 7,
    countUniqueUrls: false,
  };
  registryEntry.engine.inputSchema = {
    ...originalInputSchema,
    referenceBudget,
  };
  delete process.env.DATABASE_URL;

  try {
    const directBudget = cloneEngine(registryEntry.engine).inputSchema?.referenceBudget;
    assert.deepEqual(directBudget, {
      fieldIds: ['synthetic_images', 'synthetic_videos'],
      modes: ['ref2v', 'v2v'],
      maxTotal: 7,
      countUniqueUrls: false,
    });
    assert.notStrictEqual(directBudget, referenceBudget);
    assert.notStrictEqual(directBudget?.fieldIds, referenceBudget.fieldIds);
    assert.notStrictEqual(directBudget?.modes, referenceBudget.modes);

    const baseEngine = getBaseEnginesByCategory('video').find(
      (engine) => engine.id === registryEntry.id
    );
    assert.ok(baseEngine);
    assert.deepEqual(baseEngine.inputSchema?.referenceBudget, referenceBudget);

    const configuredEngine = (await getPublicConfiguredEnginesByCategory('video')).find(
      (engine) => engine.id === registryEntry.id
    );
    assert.ok(configuredEngine);
    assert.deepEqual(configuredEngine.inputSchema?.referenceBudget, referenceBudget);
    assert.notStrictEqual(
      configuredEngine.inputSchema?.referenceBudget?.fieldIds,
      baseEngine.inputSchema?.referenceBudget?.fieldIds
    );
    assert.notStrictEqual(
      configuredEngine.inputSchema?.referenceBudget?.modes,
      baseEngine.inputSchema?.referenceBudget?.modes
    );
  } finally {
    registryEntry.engine.inputSchema = originalInputSchema;
    if (previousDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousDatabaseUrl;
    }
  }
});
