import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildLocalizedModelPath } from '../frontend/config/model-registry.ts';
import {
  getRuntimeModelByCanonicalSlug,
  getRuntimeModelById,
  listRuntimeModels,
  resolveRuntimeEngineInput,
  resolveRuntimePublicSlug,
  toLegacyModelSurfaces,
} from '../frontend/config/model-runtime.ts';
import {
  canonicalizeFalModelSlug,
  getFalEngineBySlug,
} from '../frontend/src/config/falEngines.ts';
import { normalizeEngineId } from '../frontend/src/lib/engine-alias.ts';
import {
  getCanonicalSlug,
  getEngineIdFromSlug,
} from '../frontend/src/lib/model-slugs.ts';
import {
  MODEL_FAMILIES,
  getModelFamilyExamplesPageConfig,
} from '../frontend/config/model-families.ts';

const baseline = JSON.parse(readFileSync('tests/fixtures/model-registry-baseline.json', 'utf8'));

test('runtime model projection matches every baseline identity and surface', () => {
  const runtimeById = new Map(listRuntimeModels().map((model) => [model.id, model]));
  for (const expected of baseline.models) {
    const actual = runtimeById.get(expected.id);
    assert.ok(actual, `missing runtime model ${expected.id}`);
    assert.equal(actual.slug, expected.slug);
    assert.equal(actual.family, expected.family);
    assert.equal(actual.category, expected.category);
    assert.deepEqual(toLegacyModelSurfaces(actual), expected.publication);
  }
});

test('every published runtime model has canonical localized paths', () => {
  for (const model of listRuntimeModels().filter((entry) => entry.publication.model.published)) {
    assert.equal(buildLocalizedModelPath('en', model.slug), `/models/${model.slug}`);
    assert.equal(buildLocalizedModelPath('fr', model.slug), `/fr/modeles/${model.slug}`);
    assert.equal(buildLocalizedModelPath('es', model.slug), `/es/modelos/${model.slug}`);
  }
});

test('runtime projection resolves every frozen explicit alias', () => {
  for (const row of baseline.internalAliases) {
    assert.equal(resolveRuntimeEngineInput(row.alias)?.id, row.targetId, row.alias);
  }
  for (const row of baseline.publicSlugAliases) {
    assert.equal(resolveRuntimePublicSlug(row.alias)?.slug, row.targetSlug, row.alias);
  }
});

test('runtime projection keeps engine and public aliases in separate namespaces', () => {
  assert.equal(resolveRuntimeEngineInput('veo3')?.id, 'veo-3-1-fast');
  assert.equal(resolveRuntimePublicSlug('veo3')?.id, 'veo-3-1');
});

test('runtime facade normalizes canonical lookups and rejects missing inputs', () => {
  assert.equal(getRuntimeModelById(' VEO-3-1 ')?.id, 'veo-3-1');
  assert.equal(getRuntimeModelByCanonicalSlug(' VEO-3-1-FAST ')?.slug, 'veo-3-1-fast');
  assert.equal(getRuntimeModelById('missing-model'), null);
  assert.equal(getRuntimeModelByCanonicalSlug('missing-model'), null);
  assert.equal(resolveRuntimeEngineInput(undefined), null);
  assert.equal(resolveRuntimeEngineInput('  '), null);
  assert.equal(resolveRuntimePublicSlug('missing-model'), null);
});

test('generated runtime document excludes registry-only replacement and tombstone data', () => {
  const runtime = JSON.parse(readFileSync('frontend/config/model-runtime.json', 'utf8'));
  const registry = JSON.parse(readFileSync('frontend/config/model-registry.json', 'utf8'));
  const registryById = new Map(registry.models.map((model: any) => [model.id, model]));
  assert.equal(Object.hasOwn(runtime, 'tombstones'), false);
  assert.equal(runtime.models.every((model: object) => !Object.hasOwn(model, 'replacement')), true);
  for (const model of runtime.models) {
    const source = registryById.get(model.id) as any;
    assert.equal(Object.hasOwn(model, 'publicTargetId'), Boolean(source.replacement), model.id);
  }
});

test('legacy facades resolve the frozen registry compatibility matrix', () => {
  for (const row of baseline.internalAliases) {
    assert.equal(normalizeEngineId(row.alias), row.targetId, row.alias);
  }
  for (const row of baseline.publicSlugAliases) {
    assert.equal(canonicalizeFalModelSlug(row.alias), row.targetSlug, row.alias);
    assert.equal(getFalEngineBySlug(row.alias)?.modelSlug, row.targetSlug, row.alias);
  }
  for (const model of baseline.models) {
    assert.equal(getCanonicalSlug(model.id), model.slug);
    assert.equal(getEngineIdFromSlug(model.slug), model.id);
  }
});

test('family model membership and current variants remain identical to baseline', () => {
  for (const expected of baseline.familyDefinitions) {
    const actual = MODEL_FAMILIES.find((family) => family.id === expected.id);
    assert.ok(actual, expected.id);
    assert.equal(actual.defaultModelSlug, expected.defaultModelSlug);
    assert.deepEqual(actual.routeAliases, expected.routeAliases);
    assert.deepEqual(
      getModelFamilyExamplesPageConfig(expected.id)?.publishedModelSlugs,
      expected.examplesPage?.publishedModelSlugs ?? []
    );
    assert.deepEqual(
      getModelFamilyExamplesPageConfig(expected.id)?.currentModelSlugs,
      expected.examplesPage?.currentModelSlugs?.length
        ? expected.examplesPage.currentModelSlugs
        : expected.examplesPage?.publishedModelSlugs ?? []
    );
  }
});
