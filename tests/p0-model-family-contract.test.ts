import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { getModelFamilyDefinition, getModelFamilyExamplesPageConfig } from '../frontend/config/model-families';
import {
  getRuntimeModelById,
  listPublishedRuntimeModels,
} from '../frontend/config/model-runtime';
import { listFalEngines } from '../frontend/src/config/falEngines';
import { getBaseEngines } from '../frontend/src/lib/engines';
import { getModelRoster } from '../frontend/src/lib/model-roster';
import { getSeoFamilyDictionary } from '../frontend/lib/seo/seo-intents';
import {
  listPublicAgentGenerationEngines,
  type AgentModelCatalogDeps,
} from '../frontend/src/server/agent-api/model-catalog';

const P0_MODELS = {
  'wan-3': 'wan',
  'wan-3-prime': 'wan',
  'ltx-2-5-fast': 'ltx',
  'ltx-2-5-pro': 'ltx',
  'grok-imagine-video-1-5': 'grok',
  'flux-3': 'flux',
  'flux-3-draft': 'flux',
} as const;

const SUCCESSORS = {
  'ltx-2-3': 'ltx-2-5-pro',
  'ltx-2-3-fast': 'ltx-2-5-fast',
  'ltx-2': 'ltx-2-5-pro',
  'ltx-2-fast': 'ltx-2-5-fast',
  'wan-2-6': 'wan-3',
  'wan-2-5': 'wan-3',
} as const;

const FAMILY_DEFAULTS = {
  ltx: 'ltx-2-5-pro',
  wan: 'wan-3-prime',
  grok: 'grok-imagine-video-1-5',
  flux: 'flux-3',
} as const;

const p0Ids = Object.keys(P0_MODELS);

test('registry owns exactly seven hidden current P0 identities with no launch metadata', () => {
  const registry = JSON.parse(readFileSync('frontend/config/model-registry.json', 'utf8'));
  const rows = registry.models.filter((model: { id: string }) => p0Ids.includes(model.id));

  assert.equal(rows.length, 7);
  for (const row of rows) {
    assert.equal(row.slug, row.id, row.id);
    assert.equal(row.family, P0_MODELS[row.id as keyof typeof P0_MODELS], row.id);
    assert.equal(row.category, 'video', row.id);
    assert.equal(row.lifecycle, 'current', row.id);
    assert.equal(row.successorId, null, row.id);
    assert.equal(row.replacement, null, row.id);
    assert.deepEqual(row.aliases, { internal: [], publicSlugs: [] }, row.id);
    assert.deepEqual(row.publication, {
      model: { published: false, indexable: false },
      examples: { published: false, includeInFamilyCopy: false, current: false },
      compare: {
        published: false,
        indexed: false,
        suggestedOpponentIds: [],
        publishedPairIds: [],
      },
      app: { published: false },
      pricing: { published: false },
      sitemap: { published: false },
    }, row.id);
  }
});

test('legacy and deep-legacy P0 predecessors have the exact direct successor graph', () => {
  for (const [sourceId, targetId] of Object.entries(SUCCESSORS)) {
    const source = getRuntimeModelById(sourceId);
    assert.ok(source, sourceId);
    assert.equal(source.successorId, targetId, sourceId);
    assert.equal(source.successorSlug, targetId, sourceId);
    assert.equal(Object.hasOwn(source, 'replacement'), false, sourceId);
  }

  for (const id of p0Ids) {
    assert.equal(getRuntimeModelById(id)?.successorId, null, id);
  }
});

test('all seven concrete raw contracts are materialized by the Fal aggregate', () => {
  const engines = new Map(listFalEngines().map((engine) => [engine.id, engine]));

  for (const id of p0Ids) {
    const engine = engines.get(id);
    assert.ok(engine, id);
    assert.equal(engine.lifecycle, 'current', id);
    assert.equal(engine.successorId, null, id);
    assert.equal(engine.surfaces.app.enabled, false, id);
  }
});

test('P0 family defaults are canonical while new family example routes stay hidden', () => {
  for (const [familyId, defaultModelSlug] of Object.entries(FAMILY_DEFAULTS)) {
    assert.equal(getModelFamilyDefinition(familyId)?.defaultModelSlug, defaultModelSlug, familyId);
  }

  assert.deepEqual(getModelFamilyExamplesPageConfig('grok'), {
    stage: 'hidden',
    showInNav: false,
    publishedModelSlugs: [],
    currentModelSlugs: [],
  });
  assert.deepEqual(getModelFamilyExamplesPageConfig('flux'), {
    stage: 'hidden',
    showInNav: false,
    publishedModelSlugs: [],
    currentModelSlugs: [],
  });
});

test('hidden P0 identities stay out of public model, workspace, MCP, roster, family, and SEO discovery', async () => {
  const publicModelIds = new Set(listPublishedRuntimeModels().map((model) => model.id));
  const workspaceIds = new Set(getBaseEngines().map((engine) => engine.id));
  const rosterIds = new Set(getModelRoster().map((entry) => entry.engineId));
  const publicEngines = getBaseEngines();
  const mcpDeps: AgentModelCatalogDeps = {
    async listEngines() {
      return publicEngines;
    },
    surfaceByEngineId(engineId) {
      return listFalEngines().find((engine) => engine.id === engineId)?.category === 'image'
        ? 'image'
        : 'video';
    },
    isEngineExecutable: () => true,
    isModeExecutable: () => true,
  };
  const mcpIds = new Set((await listPublicAgentGenerationEngines(mcpDeps)).map(({ engine }) => engine.id));
  const seoFamilies = getSeoFamilyDictionary();

  for (const id of p0Ids) {
    assert.equal(publicModelIds.has(id), false, `model publication leaked ${id}`);
    assert.equal(workspaceIds.has(id), false, `workspace leaked ${id}`);
    assert.equal(mcpIds.has(id), false, `MCP leaked ${id}`);
    assert.equal(rosterIds.has(id), false, `roster leaked ${id}`);

    const familyId = P0_MODELS[id as keyof typeof P0_MODELS];
    const family = getModelFamilyExamplesPageConfig(familyId);
    assert.equal(family?.publishedModelSlugs.includes(id), false, `family publication leaked ${id}`);
    assert.equal(family?.currentModelSlugs.includes(id), false, `family current list leaked ${id}`);

    const seoFamily = seoFamilies.find((entry) => entry.id === familyId);
    assert.equal(seoFamily?.publishedModelSlugs.includes(id), false, `SEO publication leaked ${id}`);
    assert.equal(seoFamily?.currentModelSlugs.includes(id), false, `SEO current list leaked ${id}`);
  }
});
