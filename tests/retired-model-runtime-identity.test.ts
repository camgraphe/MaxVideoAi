import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  validateModelRegistryDocument,
  validateModelRegistryRepository,
  type ModelRegistryDocument,
} from '../frontend/config/model-registry-validation';
import { createRuntimeModelResolver } from '../frontend/config/model-runtime';
import { listAgentModels } from '../frontend/src/server/agent-api/model-catalog';
import { getAgentModelDetails } from '../frontend/src/server/agent-api/model-details';
import { recommendAgentModels } from '../frontend/src/server/agent-api/model-recommendations';
import { buildModelRuntimeProjection } from '../scripts/lib/model-runtime-projection.mjs';

function hiddenPublication() {
  return {
    model: { published: false, indexable: false },
    examples: { published: false, includeInFamilyCopy: false, current: false },
    compare: { published: false, indexed: false, suggestedOpponentIds: [], publishedPairIds: [] },
    app: { published: false },
    pricing: { published: false },
    sitemap: { published: false },
  };
}

function registryFixture(): ModelRegistryDocument {
  return {
    schemaVersion: 2,
    models: [
      {
        id: 'active-video-fixture',
        slug: 'active-video-fixture',
        family: 'fixture',
        category: 'video',
        lifecycle: 'current',
        successorId: null,
        aliases: { internal: [], publicSlugs: [] },
        publication: {
          ...hiddenPublication(),
          model: { published: true, indexable: false },
        },
        replacement: null,
      },
      {
        id: 'retired-video-fixture',
        label: 'Retired Video Fixture',
        slug: 'retired-video-fixture',
        family: 'fixture',
        category: 'video',
        lifecycle: 'retired',
        successorId: null,
        aliases: { internal: ['retired-video-v1'], publicSlugs: ['retired-video-v1'] },
        publication: hiddenPublication(),
        replacement: 'active-video-fixture',
      },
    ],
    tombstones: [],
  };
}

function repositoryFixture(
  document: ModelRegistryDocument,
  catalogIds: readonly string[] = ['active-video-fixture'],
): string {
  const root = mkdtempSync(join(tmpdir(), 'retired-runtime-'));
  mkdirSync(join(root, 'frontend/config'), { recursive: true });
  writeFileSync(
    join(root, 'frontend/config/engine-catalog.json'),
    JSON.stringify(catalogIds.map((engineId) => ({ engineId }))),
  );
  for (const model of document.models.filter((entry) => entry.publication.model.published)) {
    for (const locale of ['en', 'fr', 'es']) {
      const directory = join(root, 'content/models', locale);
      mkdirSync(directory, { recursive: true });
      writeFileSync(join(directory, `${model.slug}.json`), '{}');
    }
  }
  return root;
}

function validateRepository(
  input: ModelRegistryDocument,
  catalogIds?: readonly string[],
): ModelRegistryDocument {
  const document = validateModelRegistryDocument(input);
  const root = repositoryFixture(document, catalogIds);
  try {
    validateModelRegistryRepository(document, root);
    return document;
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('a schema-valid engine-less retired registry identity survives the real runtime projection and exact MCP details', async () => {
  const document = validateRepository(registryFixture());
  const runtimeDocument = buildModelRuntimeProjection(document);
  const resolver = createRuntimeModelResolver(runtimeDocument);
  let executableCatalogCalls = 0;
  const deps = {
    async listEngines() { executableCatalogCalls += 1; return []; },
    async getEngineIncludingHidden() { executableCatalogCalls += 1; return undefined; },
    surfaceByEngineId() { executableCatalogCalls += 1; return null; },
    resolveRuntimeModel: resolver.getById,
  };

  assert.deepEqual(await listAgentModels({}, deps), []);
  assert.deepEqual((await recommendAgentModels({}, deps)).recommendations, []);
  const catalogCallsBeforeDetails = executableCatalogCalls;
  const details = await getAgentModelDetails('retired-video-fixture', deps);

  assert.deepEqual(details, {
    id: 'retired-video-fixture',
    label: 'Retired Video Fixture',
    slug: 'retired-video-fixture',
    surface: 'video',
    availability: 'retired',
    generationEnabled: false,
    lifecycle: 'retired',
    successor: { id: 'active-video-fixture', slug: 'active-video-fixture' },
    recommendedByDefault: false,
    prelaunch: false,
    modes: [],
    guidance: null,
    promptingSources: [],
    links: { model: null, pricing: null, examples: null },
    catalogUpdatedAt: null,
  });
  assert.equal(executableCatalogCalls, catalogCallsBeforeDetails);
});

test('only a fully retired, labelled replacement identity may omit engine catalog ownership', () => {
  for (const lifecycle of ['current', 'legacy', 'deep_legacy'] as const) {
    const fixture = registryFixture();
    const retired = fixture.models[1];
    retired.lifecycle = lifecycle;
    retired.replacement = null;
    if (lifecycle !== 'current') retired.successorId = fixture.models[0].id;
    assert.throws(
      () => validateRepository(fixture),
      /missing from engine catalog/i,
      lifecycle,
    );
  }

  const missingLabel = registryFixture();
  delete missingLabel.models[1].label;
  assert.throws(() => validateRepository(missingLabel), /retired.*label/i);

  const missingReplacement = registryFixture();
  missingReplacement.models[1].replacement = null;
  assert.throws(
    () => validateRepository(missingReplacement),
    /retired model .* requires a replacement/i,
  );

  const publishedMutations: Array<(fixture: ModelRegistryDocument) => void> = [
    (fixture) => { fixture.models[1].publication.model.published = true; },
    (fixture) => { fixture.models[1].publication.examples.published = true; },
    (fixture) => { fixture.models[1].publication.compare.published = true; },
    (fixture) => { fixture.models[1].publication.app.published = true; },
    (fixture) => { fixture.models[1].publication.pricing.published = true; },
    (fixture) => { fixture.models[1].publication.sitemap.published = true; },
    (fixture) => { fixture.models[1].publication.app.discoveryRank = 1; },
  ];
  for (const publish of publishedMutations) {
    const fixture = registryFixture();
    publish(fixture);
    assert.throws(
      () => validateRepository(fixture),
      /fully retired|disable every|retired on every/i,
    );
  }

  const presentationOnly = registryFixture();
  presentationOnly.models[1].presentationOnly = true;
  assert.throws(() => validateRepository(presentationOnly), /presentation-only/i);

  const nonCurrentTarget = registryFixture();
  nonCurrentTarget.models[0].lifecycle = 'legacy';
  assert.throws(() => validateRepository(nonCurrentTarget), /replacement target .* current/i);

  const missingTarget = registryFixture();
  missingTarget.models[1].replacement = 'unknown-target';
  assert.throws(() => validateRepository(missingTarget), /missing model reference/i);
});

test('engine catalog presence does not waive the retired authoritative label', () => {
  const fixture = registryFixture();
  delete fixture.models[1].label;
  assert.throws(
    () => validateRepository(fixture, ['active-video-fixture', 'retired-video-fixture']),
    /retired.*label/i,
  );
});
