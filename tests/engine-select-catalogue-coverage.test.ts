import assert from 'node:assert/strict';
import test from 'node:test';

import registry from '../frontend/config/model-registry.json' with { type: 'json' };
import { listFalEngines } from '../frontend/src/config/falEngines.ts';
import {
  buildEngineFamilyGroups,
} from '../frontend/src/components/ui/engine-select/engine-select-helpers.ts';
import {
  getEngineSelectCatalogueSummary,
} from '../frontend/src/components/ui/engine-select/engine-select-catalogue.ts';
import { getBaseEnginesByCategory, type EngineCategory } from '../frontend/src/lib/engines.ts';

const registryEntries = listFalEngines();
const registryMeta = {
  order: new Map(registryEntries.map((entry, index) => [entry.id, index])),
  meta: new Map(registryEntries.map((entry) => [entry.id, entry])),
};

for (const category of ['video', 'image'] satisfies EngineCategory[]) {
  test(`${category} selector reaches every app-published engine in its canonical family`, () => {
    const published = registry.models.filter(
      (model) => model.category === category && model.publication.app.published,
    );
    const engines = getBaseEnginesByCategory(category);
    const groups = buildEngineFamilyGroups({
      engines,
      registryMeta,
      showLegacy: true,
    });
    const groupedIds = groups.flatMap((group) => group.engines.map((engine) => engine.id));

    assert.deepEqual(
      groupedIds.slice().sort(),
      published.map((model) => model.id).sort(),
    );
    assert.equal(new Set(groupedIds).size, groupedIds.length, 'an engine belongs to exactly one family');

    const publishedById = new Map(published.map((model) => [model.id, model]));
    for (const group of groups) {
      for (const engine of group.engines) {
        assert.equal(
          group.id,
          publishedById.get(engine.id)?.family,
          `${engine.id} must remain in its registry-authored family`,
        );
      }
    }
  });
}

test('category projection excludes unpublished private engines and never crosses video/image identities', () => {
  const videoIds = new Set(getBaseEnginesByCategory('video').map((engine) => engine.id));
  const imageIds = new Set(getBaseEnginesByCategory('image').map((engine) => engine.id));
  const unpublishedIds = registry.models
    .filter((model) => !model.publication.app.published)
    .map((model) => model.id);

  assert.deepEqual([...videoIds].filter((id) => imageIds.has(id)), []);
  for (const id of unpublishedIds) {
    assert.equal(videoIds.has(id), false, `${id} must stay outside the video selector`);
    assert.equal(imageIds.has(id), false, `${id} must stay outside the image selector`);
  }
});

test('catalogue summary derives visible, legacy, hidden, paused, and family coverage from its inputs', () => {
  const videoEngines = getBaseEnginesByCategory('video');
  const byId = new Map(videoEngines.map((engine) => [engine.id, engine]));
  const currentSeedance = byId.get('seedance-2-5')!;
  const currentKling = byId.get('kling-3-pro')!;
  const legacyKling = byId.get('kling-2-5-turbo')!;
  const legacyLuma = byId.get('lumaRay2')!;
  const pausedLuma = { ...byId.get('luma-ray-3-2')!, availability: 'paused' as const };

  assert.deepEqual(
    getEngineSelectCatalogueSummary({
      engines: [currentSeedance, currentKling, legacyKling, legacyLuma, pausedLuma],
      visibleEngines: [currentSeedance, currentKling, legacyKling],
      registryMeta,
    }),
    {
      totalCount: 4,
      visibleCount: 3,
      legacyCount: 2,
      hiddenLegacyCount: 1,
      familyCount: 3,
    },
  );
});
