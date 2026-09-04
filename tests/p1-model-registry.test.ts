import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import engineCatalog from '../frontend/config/engine-catalog.json' with { type: 'json' };
import registry from '../frontend/config/model-registry.json' with { type: 'json' };
import modelRoster from '../frontend/config/model-roster.json' with { type: 'json' };
import { getModelFamilyDefinition } from '../frontend/config/model-families.ts';
import { buildModelRegistryRedirects } from '../frontend/config/model-registry-redirects.cjs';
import { validateModelRegistryDocument } from '../frontend/config/model-registry-validation.ts';
import { listRuntimeModels, resolveRuntimePublicSlug } from '../frontend/config/model-runtime.ts';
import { listFalEngines } from '../frontend/src/config/falEngines.ts';

const GEMINI_ALIASES = [
  'gemini-omni-flash-1-1',
  'gemini-omni-1-1-flash',
] as const;

const PUBLISHED_P1_MODELS = {
  'kling-3-turbo-standard': {
    family: 'kling',
    label: 'Kling 3.0 Turbo Standard',
    opponents: ['kling-3-turbo-pro'],
  },
  'kling-3-turbo-pro': {
    family: 'kling',
    label: 'Kling 3.0 Turbo Pro',
    opponents: ['kling-3-turbo-standard', 'kling-3-pro', 'gemini-omni-flash'],
  },
  'minimax-h3-max': {
    family: 'hailuo',
    label: 'MiniMax H3 Max',
    opponents: ['minimax-h3', 'seedance-2-5'],
  },
} as const;

const localizedBases = [
  { prefix: '/models', destinationPrefix: '/models' },
  { prefix: '/fr/modeles', destinationPrefix: '/fr/modeles' },
  { prefix: '/es/modelos', destinationPrefix: '/es/modelos' },
] as const;

test('Gemini 1.1 compatibility aliases resolve directly to the existing canonical model', () => {
  const gemini = registry.models.find((model) => model.id === 'gemini-omni-flash');
  assert.ok(gemini);
  assert.equal(gemini.slug, 'gemini-omni-flash');
  assert.equal(gemini.family, 'veo');
  assert.equal(gemini.category, 'video');

  const versionedGeminiAliases = gemini.aliases.publicSlugs
    .filter((alias) => /^gemini-omni.*(?:1-1|1\.1|1-0|1\.0)/.test(alias))
    .sort();
  assert.deepEqual(versionedGeminiAliases, [...GEMINI_ALIASES].sort());
  assert.deepEqual(
    gemini.aliases.internal.filter((alias) => alias.startsWith('gemini-omni')),
    [],
  );
  assert.equal(getModelFamilyDefinition('veo')?.aliases?.includes(GEMINI_ALIASES[0]), true);
  assert.equal(getModelFamilyDefinition('veo')?.aliases?.includes(GEMINI_ALIASES[1]), true);
});

test('P1 video identities are current published members with no replacement graph', () => {
  for (const [id, expected] of Object.entries(PUBLISHED_P1_MODELS)) {
    const model = registry.models.find((candidate) => candidate.id === id);
    assert.ok(model, `missing registry identity ${id}`);
    assert.equal(model.slug, id, id);
    assert.equal(model.label, expected.label, id);
    assert.equal(model.family, expected.family, id);
    assert.equal(model.category, 'video', id);
    assert.deepEqual(model.aliases, { internal: [], publicSlugs: [] }, id);
    assert.deepEqual(model.publication.model, { published: true, indexable: true }, id);
    assert.deepEqual(model.publication.examples, {
      published: true,
      includeInFamilyCopy: true,
      current: true,
    }, id);
    assert.equal(model.publication.compare.published, true, id);
    assert.equal(model.publication.compare.indexed, true, id);
    assert.deepEqual(model.publication.compare.suggestedOpponentIds, expected.opponents, id);
    assert.deepEqual(model.publication.compare.publishedPairIds, expected.opponents, id);
    assert.equal(model.publication.app.published, true, id);
    assert.equal(model.publication.pricing.published, true, id);
    assert.equal(model.publication.sitemap.published, true, id);
    assert.equal(model.lifecycle, 'current', id);
    assert.equal(model.successorId, null, id);
    assert.equal(model.replacement, null, id);
  }

  for (const establishedId of ['kling-3-standard', 'kling-3-pro', 'minimax-h3']) {
    const established = registry.models.find((model) => model.id === establishedId);
    assert.ok(established, establishedId);
    assert.equal(established.replacement, null, `${establishedId} must not be replaced by P1`);
  }
});

test('Gemini compatibility URLs are explicit one-hop redirects in every locale', () => {
  const redirects = buildModelRegistryRedirects(validateModelRegistryDocument(registry));
  const bySource = new Map(redirects.map((redirect) => [redirect.source, redirect]));
  const redirectSources = new Set(redirects.map((redirect) => redirect.source));

  for (const alias of GEMINI_ALIASES) {
    for (const base of localizedBases) {
      const source = `${base.prefix}/${alias}`;
      assert.deepEqual(bySource.get(source), {
        source,
        destination: `${base.destinationPrefix}/gemini-omni-flash`,
        statusCode: 301,
      });
      assert.equal(redirectSources.has(`${base.destinationPrefix}/gemini-omni-flash`), false, source);
    }
  }
});

test('runtime resolution preserves self-canonical paths and includes the published P1 identities', () => {
  const runtimeIds = new Set(listRuntimeModels().map((model) => model.id));
  for (const model of registry.models) {
    assert.equal(resolveRuntimePublicSlug(model.slug)?.id, model.id, model.slug);
  }
  for (const id of Object.keys(PUBLISHED_P1_MODELS)) {
    assert.equal(runtimeIds.has(id), true, `runtime identity missing ${id}`);
  }
});

test('build catalog projects the P1 engines on public product surfaces', () => {
  const catalogById = new Map(engineCatalog.map((entry) => [entry.engineId, entry]));
  const publicEngineIds = new Set(listFalEngines().map((engine) => engine.id));
  const rosterIds = new Set(modelRoster.map((entry) => entry.engineId));

  for (const [id, expected] of Object.entries(PUBLISHED_P1_MODELS)) {
    const entry = catalogById.get(id);
    assert.ok(entry, `missing public catalog entry ${id}`);
    assert.equal(entry.modelSlug, id, id);
    assert.equal(entry.family, expected.family, id);
    assert.equal(entry.lifecycle, 'current', id);
    assert.deepEqual(entry.surfaces.modelPage, { indexable: true, includeInSitemap: true }, id);
    assert.deepEqual(entry.surfaces.examples, {
      includeInFamilyResolver: true,
      includeInFamilyCopy: true,
    }, id);
    assert.deepEqual(entry.surfaces.compare, {
      suggestOpponents: expected.opponents,
      publishedPairs: expected.opponents,
      includeInHub: true,
    }, id);
    assert.equal(entry.surfaces.app.enabled, true, id);
    assert.equal(entry.surfaces.pricing.includeInEstimator, true, id);
    assert.equal(publicEngineIds.has(id), true, `public engine missing ${id}`);
    assert.equal(rosterIds.has(id), true, `published roster missing ${id}`);
  }
});

test('P1 registration excludes Runway, Gemini 1.0, and H3 Max Turbo identities', () => {
  const ids = new Set(registry.models.map((model) => model.id));
  assert.equal(Array.from(ids).some((id) => id.toLowerCase().includes('runway')), false);
  assert.equal(ids.has('minimax-h3-max-turbo'), false);

  const gemini = registry.models.find((model) => model.id === 'gemini-omni-flash');
  assert.ok(gemini);
  assert.equal(gemini.aliases.publicSlugs.some((alias) => /gemini-omni.*(?:1-0|1\.0)/.test(alias)), false);

  const baseline = JSON.parse(readFileSync('tests/fixtures/model-registry-baseline.json', 'utf8')) as {
    models: Array<{ slug: string }>;
  };
  for (const model of baseline.models) {
    assert.equal(resolveRuntimePublicSlug(model.slug)?.slug, model.slug, model.slug);
  }
});
