import assert from 'node:assert/strict';
import test from 'node:test';
import * as familyConfig from '../frontend/config/model-families';
import { listRuntimeModels } from '../frontend/config/model-runtime';
import { createExampleFamilyResolver, getExampleNavFamilyIds as legacyNavIds } from '../frontend/lib/model-families';

const lightweight = familyConfig as typeof familyConfig & {
  buildExampleNavFamilyIds: (families: readonly familyConfig.ModelFamilyDefinition[]) => familyConfig.ModelFamilyId[];
  getExampleNavFamilyIds: () => familyConfig.ModelFamilyId[];
};

function project(families: readonly familyConfig.ModelFamilyDefinition[]) {
  assert.equal(typeof lightweight.buildExampleNavFamilyIds, 'function', 'the lightweight family owner must expose the supplied-family projection');
  return lightweight.buildExampleNavFamilyIds(families);
}

function family(id: string, examplesPage?: familyConfig.ModelFamilyDefinition['examplesPage']): familyConfig.ModelFamilyDefinition {
  return { id, label: id, navLabel: id, examplesPage };
}

test('family menus retain public-noindex entries while respecting hidden and explicit navigation opt-outs', () => {
  const families = [
    family('sora', { stage: 'hidden', showInNav: true }),
    family('pika', { stage: 'public_noindex', showInNav: true }),
    family('veo', { stage: 'indexed', showInNav: false }),
    family('kling', { stage: 'indexed', showInNav: true }),
    family('wan'),
    family('ltx', { stage: 'indexed' }),
    family('grok', { showInNav: true }),
  ];
  const snapshot = structuredClone(families);
  assert.deepEqual(project(families), ['pika', 'kling']);
  assert.deepEqual(createExampleFamilyResolver({ families, engines: [] }).getNavFamilyIds(), ['pika', 'kling']);
  assert.deepEqual(families, snapshot, 'selection must not mutate supplied family configuration');
});

test('projection and custom resolvers preserve input order and return defensive arrays', () => {
  const families = [
    family('wan', { stage: 'indexed', showInNav: true }),
    family('kling', { stage: 'indexed', showInNav: true }),
    family('wan', { stage: 'public_noindex', showInNav: true }),
  ];
  const expected = ['wan', 'kling', 'wan'];
  const resolver = createExampleFamilyResolver({ families, engines: [] });
  assert.deepEqual(project(families), expected);
  assert.deepEqual(resolver.getNavFamilyIds(), expected);
  project(families).reverse().pop();
  resolver.getNavFamilyIds().reverse().pop();
  assert.deepEqual(project(families), expected);
  assert.deepEqual(resolver.getNavFamilyIds(), expected);
  families[0].examplesPage!.showInNav = false;
  assert.deepEqual(resolver.getNavFamilyIds(), expected, 'the resolver retains its creation-time projection');
  assert.deepEqual(project(families), ['kling', 'wan']);
});

test('lightweight default getter preserves the legacy resolver result and defensive copies for real families', (t) => {
  assert.equal(typeof lightweight.getExampleNavFamilyIds, 'function');
  const original = legacyNavIds();
  t.diagnostic(`real family IDs: ${JSON.stringify(original)}`);
  assert.deepEqual(lightweight.getExampleNavFamilyIds(), original);
  assert.deepEqual(project(familyConfig.MODEL_FAMILIES), original);
  assert.deepEqual(createExampleFamilyResolver({ families: familyConfig.MODEL_FAMILIES, engines: [] }).getNavFamilyIds(), original);
  lightweight.getExampleNavFamilyIds().reverse().pop();
  legacyNavIds().reverse().pop();
  assert.deepEqual(lightweight.getExampleNavFamilyIds(), original);
  assert.deepEqual(legacyNavIds(), original);
});

test('archive-only families retain their published page while leaving navigation through materialized policy', () => {
  const models = listRuntimeModels().map((model) => model.family === 'veo' ? {
    ...model,
    lifecycle: 'deep_legacy' as const,
    publication: {
      ...model.publication,
      examples: { ...model.publication.examples, current: false },
    },
  } : model);
  const families = familyConfig.buildModelFamilyDefinitions(models);
  const archived = families.find((entry) => entry.id === 'veo')!;
  assert.equal(archived.examplesPage?.stage, 'indexed');
  assert.ok(archived.examplesPage!.publishedModelSlugs!.length > 0);
  assert.deepEqual(archived.examplesPage?.currentModelSlugs, []);
  assert.equal(project(families).includes('veo'), false);
  assert.equal(createExampleFamilyResolver({ families, engines: [] }).getNavFamilyIds().includes('veo'), false);
  assert.equal(project(familyConfig.MODEL_FAMILIES).includes('sora'), false);
});

test('family selection reuses existing launch readiness and publication admission without promoting gated models', () => {
  const models = listRuntimeModels();
  const withoutEvidence = familyConfig.buildModelFamilyDefinitions(models, []);
  for (const id of ['grok', 'flux'] as const) {
    assert.equal(withoutEvidence.find((entry) => entry.id === id)?.examplesPage?.stage, 'hidden');
    assert.equal(project(withoutEvidence).includes(id), false);
    assert.equal(project(familyConfig.MODEL_FAMILIES).includes(id), true);
  }
  assert.deepEqual(project(withoutEvidence), createExampleFamilyResolver({ families: withoutEvidence, engines: [] }).getNavFamilyIds());
  const unpublishedModels = models.map((model) => model.family === 'grok' ? {
    ...model,
    publication: { ...model.publication, examples: { ...model.publication.examples, published: false } },
  } : model);
  const unpublished = familyConfig.buildModelFamilyDefinitions(unpublishedModels);
  assert.equal(unpublished.find((entry) => entry.id === 'grok')?.examplesPage?.stage, 'hidden');
  assert.equal(project(unpublished).includes('grok'), false);
});
