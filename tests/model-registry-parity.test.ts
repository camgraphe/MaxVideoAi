import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildLocalizedModelPath } from '../frontend/config/model-registry.ts';
import {
  createRuntimeModelResolver,
  getRuntimeModelByCanonicalSlug,
  getRuntimeModelById,
  getRuntimeModelSuccessor,
  isRuntimeModelRecommendedByDefault,
  listRuntimeModels,
  resolveRuntimeEngineInput,
  resolveRuntimePublicSlug,
  toLegacyModelSurfaces,
} from '../frontend/config/model-runtime.ts';
import { buildModelRuntimeProjection } from '../scripts/lib/model-runtime-projection.mjs';
import {
  canonicalizeFalModelSlug,
  getFalEngineBySlug,
  listFalEngines,
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
  const reciprocalSeedance25PairOwners = new Set([
    'kling-3-pro',
    'seedance-2-0',
    'veo-3-1',
  ]);
  const reciprocalMinimaxH3PairOwners = new Set([
    'kling-o3-pro',
    'seedance-2-5',
    'veo-3-1',
  ]);
  for (const expected of baseline.models) {
    const actual = runtimeById.get(expected.id);
    assert.ok(actual, `missing runtime model ${expected.id}`);
    assert.equal(actual.slug, expected.slug);
    assert.equal(actual.family, expected.family);
    assert.equal(actual.category, expected.category);
    assert.equal(actual.lifecycle, expected.lifecycle);
    assert.equal(actual.successorId, expected.successorId);
    const actualPublication = toLegacyModelSurfaces(actual);
    if (reciprocalSeedance25PairOwners.has(expected.id)) {
      assert.equal(
        actualPublication.compare.publishedPairs.filter((slug) => slug === 'seedance-2-5').length,
        1,
        expected.id,
      );
      actualPublication.compare.publishedPairs = actualPublication.compare.publishedPairs.filter(
        (slug) => slug !== 'seedance-2-5',
      );
    }
    if (reciprocalMinimaxH3PairOwners.has(expected.id)) {
      assert.equal(
        actualPublication.compare.publishedPairs.filter((slug) => slug === 'minimax-h3').length,
        1,
        expected.id,
      );
      actualPublication.compare.publishedPairs = actualPublication.compare.publishedPairs.filter(
        (slug) => slug !== 'minimax-h3',
      );
    }
    assert.deepEqual(actualPublication, expected.publication);
  }
});

test('runtime projection derives successor slugs without changing identity or public routing', () => {
  const registry = JSON.parse(readFileSync('frontend/config/model-registry.json', 'utf8'));
  const source = structuredClone(registry.models.find((model: any) => model.id === 'happy-horse-1-0'));
  const target = structuredClone(registry.models.find((model: any) => model.id === 'happy-horse-1-1'));
  source.lifecycle = 'legacy';
  source.successorId = target.id;
  target.lifecycle = 'current';
  target.successorId = null;
  const runtime = buildModelRuntimeProjection({ schemaVersion: 2, models: [source, target], tombstones: [] });
  const resolver = createRuntimeModelResolver(runtime);
  const projectedSource = resolver.getById(source.id);

  assert.equal(projectedSource?.successorId, target.id);
  assert.equal(projectedSource?.successorSlug, target.slug);
  assert.equal(resolver.getSuccessor(source.id)?.id, target.id);
  assert.equal(resolver.isRecommendedByDefault(source.id), false);
  assert.equal(resolver.isRecommendedByDefault(target.id), true);
  assert.equal(resolver.resolveEngineInput(source.id)?.id, source.id);
  assert.equal(resolver.resolvePublicSlug(source.slug)?.id, source.id);
  assert.equal(Object.hasOwn(projectedSource!, 'publicTargetId'), false);
});

test('runtime lifecycle helpers and Fal materialization share canonical recommendation policy', () => {
  const runtimeById = new Map(listRuntimeModels().map((model) => [model.id, model]));
  for (const engine of listFalEngines()) {
    const model = runtimeById.get(engine.id);
    assert.ok(model, engine.id);
    assert.equal(engine.lifecycle, model.lifecycle, engine.id);
    assert.equal(engine.successorId, model.successorId, engine.id);
    assert.equal(engine.successorSlug, model.successorSlug, engine.id);
    assert.equal(engine.isLegacy, model.lifecycle !== 'current', engine.id);
    assert.equal(isRuntimeModelRecommendedByDefault(model), model.lifecycle === 'current', engine.id);
    assert.equal(getRuntimeModelSuccessor(model), null, engine.id);
  }
});

test('generated catalog and rosters project registry lifecycle and successor identity consistently', () => {
  const registry = JSON.parse(readFileSync('frontend/config/model-registry.json', 'utf8'));
  const catalog = JSON.parse(readFileSync('frontend/config/engine-catalog.json', 'utf8'));
  const frontendRoster = JSON.parse(readFileSync('frontend/config/model-roster.json', 'utf8'));
  const docsRoster = JSON.parse(readFileSync('docs/model-roster.json', 'utf8'));
  const docsRosterCsv = readFileSync('docs/model-roster.csv', 'utf8');
  const registryById = new Map(registry.models.map((model: any) => [model.id, model]));

  assert.deepEqual(frontendRoster, docsRoster);
  assert.match(
    docsRosterCsv,
    /^engineId,marketingName,brandId,modelSlug,family,lifecycle,successorId,successorSlug,/,
  );
  assert.match(docsRosterCsv, /^happy-horse-1-0,[^\n]*,legacy,,,/m);
  assert.match(docsRosterCsv, /^ltx-2,[^\n]*,deep_legacy,,,/m);
  for (const entry of [...catalog, ...frontendRoster]) {
    const source = registryById.get(entry.engineId) as any;
    assert.ok(source, entry.engineId);
    assert.equal(entry.lifecycle, source.lifecycle, entry.engineId);
    assert.equal(entry.successorId, source.successorId, entry.engineId);
    assert.equal(entry.successorSlug, null, entry.engineId);
  }
});

test('canonical migration classifies every approved non-current model and authors no successor yet', () => {
  const nonCurrent = Object.fromEntries(
    listRuntimeModels()
      .filter((model) => model.lifecycle !== 'current')
      .map((model) => [model.id, model.lifecycle]),
  );
  assert.deepEqual(nonCurrent, {
    'happy-horse-1-0': 'legacy',
    'kling-2-5-turbo': 'legacy',
    'kling-2-6-pro': 'legacy',
    'ltx-2': 'deep_legacy',
    'ltx-2-3': 'legacy',
    'ltx-2-3-fast': 'legacy',
    'ltx-2-fast': 'deep_legacy',
    lumaRay2: 'legacy',
    lumaRay2_flash: 'legacy',
    'nano-banana': 'legacy',
    'wan-2-5': 'deep_legacy',
    'wan-2-6': 'legacy',
  });
  assert.equal(listRuntimeModels().every((model) => model.successorId === null), true);
});

test('legacy app projection preserves registry-owned launch metadata', () => {
  const model = getRuntimeModelById('seedance-2-5');
  assert.ok(model);
  assert.equal(model.publication.app.launchBadge, 'new');
  assert.deepEqual(toLegacyModelSurfaces(model).app, {
    enabled: true,
    discoveryRank: -3,
    variantGroup: 'seedance-2-0',
    variantLabel: '2.5',
    launchBadge: 'new',
  });
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
    assert.equal(
      actual.defaultModelSlug,
      expected.id === 'hailuo' ? 'minimax-h3' : expected.defaultModelSlug,
    );
    assert.deepEqual(
      actual.routeAliases,
      expected.id === 'hailuo' ? ['minimax-h3', ...expected.routeAliases] : expected.routeAliases,
    );
    const expectedPublishedModelSlugs = expected.id === 'seedance'
      ? ['seedance-2-5', ...(expected.examplesPage?.publishedModelSlugs ?? [])]
      : expected.id === 'hailuo'
        ? ['minimax-h3', ...(expected.examplesPage?.publishedModelSlugs ?? [])]
        : expected.examplesPage?.publishedModelSlugs ?? [];
    const baselineCurrentModelSlugs = expected.examplesPage?.currentModelSlugs?.length
      ? expected.examplesPage.currentModelSlugs
      : expected.examplesPage?.publishedModelSlugs ?? [];
    const expectedCurrentModelSlugs = expected.id === 'seedance'
      ? ['seedance-2-5', ...baselineCurrentModelSlugs]
      : expected.id === 'hailuo'
        ? ['minimax-h3']
        : baselineCurrentModelSlugs;
    assert.deepEqual(
      getModelFamilyExamplesPageConfig(expected.id)?.publishedModelSlugs,
      expectedPublishedModelSlugs,
    );
    assert.deepEqual(
      getModelFamilyExamplesPageConfig(expected.id)?.currentModelSlugs,
      expectedCurrentModelSlugs,
    );
  }
});
