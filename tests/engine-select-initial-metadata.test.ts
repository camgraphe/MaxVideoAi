import assert from 'node:assert/strict';
import test from 'node:test';
import { listFalEngines } from '../frontend/src/config/falEngines';
import { getBaseEnginesByCategory } from '../frontend/src/lib/engines';
import { getEngineSelectAppMetadata } from '../frontend/src/components/ui/engine-select/engine-select-helpers';

const entries = listFalEngines();
const registry = { order: new Map(entries.map((entry, index) => [entry.id, index])), meta: new Map(entries.map(entry => [entry.id, entry])) };

test('initial variant membership and labels match the deferred registry for every available video and image engine', () => {
  for (const category of ['video', 'image'] as const) {
    const engines = getBaseEnginesByCategory(category).filter(engine => engine.availability !== 'paused');
    for (const engine of engines) {
      const initial = getEngineSelectAppMetadata(engine.id, null);
      const loaded = registry.meta.get(engine.id)!.surfaces.app;
      assert.equal(initial?.variantGroup, loaded.variantGroup, `${engine.id} group cannot appear late`);
      assert.equal(initial?.variantLabel, loaded.variantLabel, `${engine.id} variant label cannot change late`);
      const initialMembers = engines.filter(candidate => initial?.variantGroup && getEngineSelectAppMetadata(candidate.id, null)?.variantGroup === initial.variantGroup);
      const loadedMembers = engines.filter(candidate => loaded.variantGroup && registry.meta.get(candidate.id)?.surfaces.app.variantGroup === loaded.variantGroup);
      assert.deepEqual(initialMembers.map(candidate => candidate.id), loadedMembers.map(candidate => candidate.id));
    }
  }
});

test('loaded registry remains authoritative and unknown engines never infer a variant group', () => {
  assert.equal(getEngineSelectAppMetadata('unknown-engine', null), undefined);
  assert.equal(getEngineSelectAppMetadata('veo-3-1', { order: new Map(), meta: new Map() }), undefined);
  assert.equal(getEngineSelectAppMetadata('pika-text-to-video', null)?.variantGroup, undefined);
});
