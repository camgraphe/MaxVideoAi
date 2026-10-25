import assert from 'node:assert/strict';
import test from 'node:test';
import { getGenerationModelIdentity, isArchivedGenerationModel } from '../frontend/lib/model-generation-policy';
import { getBaseEngines } from '../frontend/src/lib/engines';
import type { EngineCaps } from '../frontend/types/engines';
import {
  buildVideoSettingsSnapshotFromSharedVideo,
  buildVideoSettingsSnapshotFromTile,
  resolveVideoSettingsSnapshot,
} from '../frontend/app/(core)/(workspace)/app/_lib/workspace-video-settings';

const allEngines = getBaseEngines();
const pika = allEngines.find(engine => engine.id === 'pika-text-to-video')!;
const alternative = allEngines.find(engine => engine.id === 'seedance-2-0')!;
assert.ok(pika && alternative);

function resolve(snapshot: unknown, engines: EngineCaps[], createLocalId = () => 'local') {
  return resolveVideoSettingsSnapshot(snapshot, {
    engines, engineMap: new Map(engines.map(engine => [engine.id, engine])), createLocalId,
    createFallbackScene: () => ({ id: 'scene', prompt: '', duration: 5 }),
    createFallbackKlingElement: () => ({ id: 'element', frontal: null, references: [], video: null }),
  });
}

const saved = (engineId: string | null | undefined, mode = 't2v') => ({
  schemaVersion: 1, surface: 'video', engineId, inputMode: mode,
  prompt: 'Saved shot', core: { durationSec: 5, resolution: '720p' },
  refs: { inputs: [{ slotId: 'image_url', kind: 'image', url: 'https://assets.test/source.jpg' }] },
});

const pikaIdentity = getGenerationModelIdentity(pika.id)!;
const pikaAliases = [...new Set([
  pika.id, ...pikaIdentity.aliases.internal, ...pikaIdentity.aliases.publicSlugs,
  ' PIKA-IMAGE-TO-VIDEO ',
])];
for (const mode of ['t2v', 'i2v']) {
  for (const id of pikaAliases) {
    test(`unavailable Pika ${mode} rejects ${id} before resolving references`, () => {
      let referenceIds = 0;
      const snapshot = saved(id, mode);
      const before = structuredClone(snapshot);
      assert.throws(() => resolve(snapshot, [alternative], () => { referenceIds += 1; return 'local'; }), {
        name: 'UnavailableVideoSettingsEngineError', engineId: pika.id,
      });
      assert.deepEqual(snapshot, before);
      assert.equal(referenceIds, 0);
    });
    test(`available Pika ${mode} restores canonical identity from ${id}`, () => {
      const resolved = resolve(saved(id, mode), [alternative, pika]);
      assert.equal(resolved.engine.id, pika.id);
      assert.equal(resolved.mode, mode);
      assert.equal(resolved.prompt, 'Saved shot');
    });
  }
}

for (const engine of allEngines.filter(engine => getGenerationModelIdentity(engine.id) && !isArchivedGenerationModel(engine.id))) {
  test(`known unavailable ${engine.id} cannot recall into another model`, () => {
    const fallback = engine.id === alternative.id ? pika : alternative;
    const identity = getGenerationModelIdentity(engine.id)!;
    for (const id of [engine.id, ...identity.aliases.internal, ...identity.aliases.publicSlugs]) {
      // Engine-input aliases take precedence over public-route aliases (e.g. veo3).
      if (getGenerationModelIdentity(id)?.id !== engine.id) continue;
      assert.throws(() => resolve(saved(id), [fallback]), {
        name: 'UnavailableVideoSettingsEngineError', engineId: engine.id,
      });
      assert.equal(resolve(saved(id), [fallback, engine]).engine.id, engine.id);
    }
  });
}

test('recall keeps the existing engine-input alias precedence over a public-route alias', () => {
  const fast = allEngines.find(engine => engine.id === 'veo-3-1-fast')!;
  assert.equal(resolve(saved('veo3'), [alternative, fast]).engine.id, fast.id);
  assert.throws(() => resolve(saved('veo3'), [alternative]), {
    name: 'UnavailableVideoSettingsEngineError', engineId: fast.id,
  });
});

for (const engineId of [undefined, null, '', 'unregistered-historical-engine']) {
  test(`legacy compatibility for identity ${JSON.stringify(engineId)} retains the existing fallback`, () => {
    const resolved = resolve(saved(engineId), [alternative]);
    assert.equal(resolved.engine.id, alternative.id);
    assert.equal(resolved.prompt, 'Saved shot');
  });
}

for (const [engineId, expected] of [['sora-2', 'sora-2'], ['openai-sora-2', 'sora-2'], ['sora-2-pro', 'sora-2-pro'], ['sora-pro', 'sora-2-pro']]) {
  test(`supported Sora archive ${engineId} stays readable`, () => {
    const resolved = resolve(saved(engineId), [alternative]);
    assert.equal(resolved.engine.id, expected);
    assert.equal(resolved.prompt, 'Saved shot');
  });
}

test('legacy tile and shared-video recall reject the same unavailable alias', () => {
  const tile = buildVideoSettingsSnapshotFromTile({
    id: 'legacy-pika', engineId: 'pika-image-to-video', prompt: 'Legacy shot',
    durationSec: 5, aspectRatio: '16:9', iterationCount: 1,
  });
  const shared = buildVideoSettingsSnapshotFromSharedVideo({
    id: 'legacy-pika', engineId: 'pika-image-to-video', engineLabel: 'Pika',
    prompt: 'Legacy shot', durationSec: 5, createdAt: '',
  });
  for (const snapshot of [tile, shared]) {
    assert.throws(() => resolve(snapshot, [alternative]), {
      name: 'UnavailableVideoSettingsEngineError', engineId: pika.id,
    });
  }
});
