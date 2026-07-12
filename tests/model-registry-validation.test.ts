import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  resolveModelRegistryEngineInput,
  resolveModelRegistryPublicSlug,
} from '../frontend/config/model-registry.ts';
import {
  validateModelRegistryDocument,
  validateModelRegistryRepository,
} from '../frontend/config/model-registry-validation.ts';

const valid = JSON.parse(readFileSync('frontend/config/model-registry.json', 'utf8'));

function mutate(run: (copy: any) => void) {
  const copy = structuredClone(valid);
  run(copy);
  return copy;
}

function isolatedModel(id: string) {
  const source = validateModelRegistryDocument(valid);
  const model = structuredClone(source.models.find((candidate) => candidate.id === id)!);
  model.publication.compare.suggestedOpponentIds = [];
  model.publication.compare.publishedPairIds = [];
  return model;
}

function writeRepositoryFixture(
  models: Array<ReturnType<typeof isolatedModel>>,
  catalogIds = models.map((model) => model.id),
  locales: readonly string[] = ['en', 'fr', 'es']
) {
  const root = mkdtempSync(join(tmpdir(), 'model-registry-'));
  const catalogDirectory = join(root, 'frontend/config');
  mkdirSync(catalogDirectory, { recursive: true });
  writeFileSync(
    join(catalogDirectory, 'engine-catalog.json'),
    JSON.stringify(catalogIds.map((engineId) => ({ engineId })))
  );
  for (const model of models.filter((candidate) => candidate.publication.model.published)) {
    for (const locale of locales) {
      const directory = join(root, 'content/models', locale);
      mkdirSync(directory, { recursive: true });
      writeFileSync(join(directory, `${model.slug}.json`), '{}');
    }
  }
  return root;
}

function repositoryDocument(models: Array<ReturnType<typeof isolatedModel>>) {
  return { schemaVersion: 1 as const, models, tombstones: [] };
}

test('canonical registry validates the committed document', () => {
  assert.equal(validateModelRegistryDocument(valid).models.length, 41);
});

test('published model pages require localized content in en, fr, and es', () => {
  const published = isolatedModel('veo-3-1');
  const document = repositoryDocument([published]);
  const root = writeRepositoryFixture(document.models, undefined, ['en', 'fr']);
  assert.throws(() => validateModelRegistryRepository(document, root), /missing es content/i);
});

test('registry and engine catalog must contain the same canonical model ids', () => {
  const model = isolatedModel('veo-3-1');
  const document = repositoryDocument([model]);

  assert.throws(
    () => validateModelRegistryRepository(document, writeRepositoryFixture(document.models, [model.id, 'missing-model'])),
    /engine catalog references missing registry id "missing-model"/i
  );
  assert.throws(
    () => validateModelRegistryRepository(document, writeRepositoryFixture(document.models, [])),
    /registry model is missing from engine catalog "veo-3-1"/i
  );
});

test('sitemap publication requires an indexable model route', () => {
  const model = isolatedModel('veo-3-1');
  model.publication.model.indexable = false;
  model.publication.sitemap.published = true;
  const document = repositoryDocument([model]);
  assert.throws(
    () => validateModelRegistryRepository(document, writeRepositoryFixture(document.models)),
    /sitemap model must be indexable "veo-3-1"/i
  );
});

test('suggested and published-pair opponents must be comparison-published', () => {
  for (const relation of ['suggestedOpponentIds', 'publishedPairIds'] as const) {
    const source = isolatedModel('veo-3-1');
    const opponent = isolatedModel('sora-2');
    opponent.publication.compare.published = false;
    source.publication.compare[relation] = [opponent.id];
    const document = repositoryDocument([source, opponent]);
    assert.throws(
      () => validateModelRegistryRepository(document, writeRepositoryFixture(document.models)),
      /comparison opponent "sora-2" is not published for "veo-3-1"/i,
      relation
    );
  }
});

test('engine and public alias namespaces preserve context-specific veo3 behavior', () => {
  const document = validateModelRegistryDocument(valid);
  const internalOwner = document.models.find((model) => model.aliases.internal.includes('veo3'));
  const publicOwner = document.models.find((model) => model.aliases.publicSlugs.includes('veo3'));
  assert.equal(internalOwner?.id, 'veo-3-1-fast');
  assert.equal(publicOwner?.id, 'veo-3-1');
  assert.equal(resolveModelRegistryEngineInput('veo3')?.id, 'veo-3-1-fast');
  assert.equal(resolveModelRegistryPublicSlug('veo3')?.id, 'veo-3-1');
});

test('registry rejects duplicate identity and ambiguous aliases', () => {
  assert.throws(
    () => validateModelRegistryDocument(mutate((copy) => { copy.models[1].id = copy.models[0].id; })),
    /duplicate canonical id/i
  );
  assert.throws(
    () => validateModelRegistryDocument(mutate((copy) => {
      const aliasOwner = copy.models.find((model: any) => model.aliases.internal.length > 0);
      const otherModel = copy.models.find((model: any) => model.id !== aliasOwner.id);
      otherModel.aliases.internal.push(aliasOwner.aliases.internal[0]);
    })),
    /ambiguous internal alias/i
  );
});

test('registry rejects ambiguity within the public alias namespace', () => {
  assert.throws(
    () => validateModelRegistryDocument(mutate((copy) => {
      const aliasOwner = copy.models.find((model: any) => model.aliases.publicSlugs.length > 0);
      const otherModel = copy.models.find((model: any) => model.id !== aliasOwner.id);
      otherModel.aliases.publicSlugs.push(aliasOwner.aliases.publicSlugs[0]);
    })),
    /ambiguous public alias/i
  );
});

test('registry rejects blank and non-string optional publication labels', () => {
  const fields = [
    {
      path: 'variantGroup',
      set: (copy: any, value: unknown) => { copy.models[0].publication.app.variantGroup = value; },
    },
    {
      path: 'variantLabel',
      set: (copy: any, value: unknown) => { copy.models[0].publication.app.variantLabel = value; },
    },
    {
      path: 'featuredScenario',
      set: (copy: any, value: unknown) => { copy.models[0].publication.pricing.featuredScenario = value; },
    },
  ];

  for (const field of fields) {
    for (const malformed of [' ', 42]) {
      assert.throws(
        () => validateModelRegistryDocument(mutate((copy) => { field.set(copy, malformed); })),
        new RegExp(`${field.path} must be a non-blank string`, 'i')
      );
    }
  }
});

test('registry rejects broken references, chains, and tombstone collisions', () => {
  assert.throws(
    () => validateModelRegistryDocument(mutate((copy) => {
      copy.models[0].publication.compare.suggestedOpponentIds = ['missing-model'];
    })),
    /missing model reference/i
  );
  assert.throws(
    () => validateModelRegistryDocument(mutate((copy) => {
      copy.models[0].replacement = copy.models[1].id;
      copy.models[1].replacement = copy.models[2].id;
    })),
    /replacement chain/i
  );
  assert.throws(
    () => validateModelRegistryDocument(mutate((copy) => {
      copy.tombstones[0].slug = copy.models[0].slug;
    })),
    /tombstone collision/i
  );
});
