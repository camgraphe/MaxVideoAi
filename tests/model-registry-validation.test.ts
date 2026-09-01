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
  return { schemaVersion: 2 as const, models, tombstones: [] };
}

function lifecycleDocument() {
  const copy = structuredClone(valid);
  copy.schemaVersion = 2;
  for (const model of copy.models) {
    model.lifecycle = 'current';
    model.successorId = null;
  }
  return copy;
}

function retire(model: any, replacement: string) {
  model.label = `Retired ${model.id}`;
  model.lifecycle = 'retired';
  model.successorId = null;
  model.replacement = replacement;
  model.publication = {
    model: { published: false, indexable: false },
    examples: { published: false, includeInFamilyCopy: false, current: false },
    compare: { published: false, indexed: false, suggestedOpponentIds: [], publishedPairIds: [] },
    app: { published: false },
    pricing: { published: false },
    sitemap: { published: false },
  };
}

test('schema v2 accepts every lifecycle state and a direct current successor', () => {
  const document = lifecycleDocument();
  const current = document.models.find((model: any) => model.id === 'happy-horse-1-1');
  const legacy = document.models.find((model: any) => model.id === 'happy-horse-1-0');
  const deepLegacy = document.models.find((model: any) => model.id === 'ltx-2');
  const retired = document.models.find((model: any) => model.id === 'lumaRay2');

  legacy.lifecycle = 'legacy';
  legacy.successorId = current.id;
  deepLegacy.lifecycle = 'deep_legacy';
  deepLegacy.successorId = current.id;
  deepLegacy.publication.app = { published: false };
  deepLegacy.publication.pricing = { published: false };
  deepLegacy.publication.examples.current = false;
  retire(retired, current.id);

  assert.doesNotThrow(() => validateModelRegistryDocument(document));
});

test('registry requires a known lifecycle and nullable canonical successor identity', () => {
  for (const [label, mutateLifecycle, expected] of [
    ['missing lifecycle', (model: any) => { delete model.lifecycle; }, /invalid lifecycle/i],
    ['unknown lifecycle', (model: any) => { model.lifecycle = 'deprecated'; }, /invalid lifecycle/i],
    ['missing successor field', (model: any) => { delete model.successorId; }, /invalid successorId/i],
    ['non-string successor', (model: any) => { model.successorId = 42; }, /invalid successorId/i],
  ] as const) {
    const document = lifecycleDocument();
    mutateLifecycle(document.models[0]);
    assert.throws(() => validateModelRegistryDocument(document), expected, label);
  }
});

test('lifecycle successors are direct non-self references to current models in the same category', () => {
  const cases = [
    {
      label: 'self successor',
      mutate(document: any) {
        const source = document.models[0];
        source.lifecycle = 'legacy';
        source.successorId = source.id;
      },
      expected: /successor self-reference/i,
    },
    {
      label: 'missing successor',
      mutate(document: any) {
        document.models[0].lifecycle = 'legacy';
        document.models[0].successorId = 'missing-model';
      },
      expected: /missing model reference .*successorId/i,
    },
    {
      label: 'successor chain',
      mutate(document: any) {
        document.models[0].lifecycle = 'legacy';
        document.models[0].successorId = document.models[1].id;
        document.models[1].lifecycle = 'legacy';
        document.models[1].successorId = document.models[2].id;
      },
      expected: /successor target .* must be current/i,
    },
    {
      label: 'category mismatch',
      mutate(document: any) {
        const source = document.models.find((model: any) => model.category === 'video');
        const target = document.models.find((model: any) => model.category === 'image');
        source.lifecycle = 'legacy';
        source.successorId = target.id;
      },
      expected: /successor category mismatch/i,
    },
  ];

  for (const scenario of cases) {
    const document = lifecycleDocument();
    scenario.mutate(document);
    assert.throws(() => validateModelRegistryDocument(document), scenario.expected, scenario.label);
  }
});

test('current and retired models cannot have lifecycle successors', () => {
  const currentDocument = lifecycleDocument();
  currentDocument.models[0].successorId = currentDocument.models[1].id;
  assert.throws(
    () => validateModelRegistryDocument(currentDocument),
    /current model .* cannot have a successor/i,
  );

  const retiredDocument = lifecycleDocument();
  const retired = retiredDocument.models[0];
  retire(retired, retiredDocument.models[1].id);
  retired.successorId = retiredDocument.models[2].id;
  assert.throws(
    () => validateModelRegistryDocument(retiredDocument),
    /retired model .* cannot have a successor/i,
  );
});

test('deep-legacy models cannot publish current app, pricing, or example discovery', () => {
  for (const [label, enable] of [
    ['app', (model: any) => { model.publication.app.published = true; }],
    ['pricing', (model: any) => { model.publication.pricing.published = true; }],
    ['current examples', (model: any) => { model.publication.examples.current = true; }],
  ] as const) {
    const document = lifecycleDocument();
    const model = document.models[0];
    model.lifecycle = 'deep_legacy';
    model.publication.app = { published: false };
    model.publication.pricing = { published: false };
    model.publication.examples.current = false;
    enable(model);
    assert.throws(
      () => validateModelRegistryDocument(document),
      /deep-legacy model .* must disable app, pricing, and current examples/i,
      label,
    );
  }
});

test('retired lifecycle and replacement retirement remain one canonical contract', () => {
  const missingReplacement = lifecycleDocument();
  missingReplacement.models[0].label = `Retired ${missingReplacement.models[0].id}`;
  missingReplacement.models[0].lifecycle = 'retired';
  assert.throws(
    () => validateModelRegistryDocument(missingReplacement),
    /retired model .* requires a replacement/i,
  );

  const activeReplacement = lifecycleDocument();
  activeReplacement.models[0].replacement = activeReplacement.models[1].id;
  assert.throws(
    () => validateModelRegistryDocument(activeReplacement),
    /replacement model .* must be retired/i,
  );
});

test('canonical registry validates the committed document', () => {
  assert.equal(validateModelRegistryDocument(valid).models.length, 50);
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

test('presentation-only models may publish a noindex route without an engine catalog entry', () => {
  const model = isolatedModel('veo-3-1');
  model.presentationOnly = true;
  model.publication = {
    model: { published: true, indexable: false },
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
  };
  const document = repositoryDocument([model]);

  assert.doesNotThrow(() =>
    validateModelRegistryRepository(
      document,
      writeRepositoryFixture(document.models, []),
    ),
  );
});

test('presentation-only models reject every executable or discovery surface', () => {
  const fields = [
    (model: any) => { model.publication.model.indexable = true; },
    (model: any) => { model.publication.app.published = true; },
    (model: any) => { model.publication.pricing.published = true; },
    (model: any) => { model.publication.examples.published = true; },
    (model: any) => { model.publication.compare.published = true; },
    (model: any) => { model.publication.sitemap.published = true; },
  ];

  for (const mutatePresentationModel of fields) {
    const model = isolatedModel('veo-3-1');
    model.presentationOnly = true;
    model.publication = {
      model: { published: true, indexable: false },
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
    };
    mutatePresentationModel(model);

    assert.throws(
      () => validateModelRegistryDocument(repositoryDocument([model])),
      /presentation-only/i,
    );
  }
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

test('registry launch badges require a published app surface and the supported value', () => {
  assert.doesNotThrow(() => validateModelRegistryDocument(mutate((copy) => {
    const model = copy.models.find((candidate: any) => candidate.id === 'veo-3-1');
    model.publication.app.launchBadge = 'new';
  })));

  assert.throws(
    () => validateModelRegistryDocument(mutate((copy) => {
      const model = copy.models.find((candidate: any) => candidate.id === 'veo-3-1');
      model.publication.app.launchBadge = 'featured';
    })),
    /launchBadge must equal "new"/i
  );

  assert.throws(
    () => validateModelRegistryDocument(mutate((copy) => {
      const model = copy.models.find((candidate: any) => candidate.id === 'veo-3-1');
      model.publication.app.published = false;
      model.publication.app.launchBadge = 'new';
    })),
    /launchBadge requires a published app surface/i
  );
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

test('replacement models are fully retired and point directly to an active model page', () => {
  assert.throws(
    () => validateModelRegistryDocument(mutate((copy) => {
      copy.models[0].replacement = 'missing-model';
    })),
    /missing model reference .*replacement/i
  );
  assert.throws(
    () => validateModelRegistryDocument(mutate((copy) => {
      copy.models[0].replacement = copy.models[1].id;
    })),
    /replacement model .* must be retired/i
  );

  assert.throws(
    () => validateModelRegistryDocument(mutate((copy) => {
      const retired = copy.models[0];
      const target = copy.models[1];
      retired.label = `Retired ${retired.id}`;
      retired.lifecycle = 'retired';
      retired.replacement = target.id;
      retired.publication = {
        model: { published: false, indexable: false },
        examples: { published: false, includeInFamilyCopy: false, current: false },
        compare: { published: false, indexed: false, suggestedOpponentIds: [], publishedPairIds: [] },
        app: { published: false },
        pricing: { published: false },
        sitemap: { published: false },
      };
      target.publication.model.published = false;
      target.publication.model.indexable = false;
      target.publication.sitemap.published = false;
    })),
    /replacement target .* must publish a model page/i
  );
});

test('registry rejects replacement cycles as well as longer chains', () => {
  const retire = (model: any, replacement: string) => {
    model.label = `Retired ${model.id}`;
    model.lifecycle = 'retired';
    model.successorId = null;
    model.replacement = replacement;
    model.publication = {
      model: { published: false, indexable: false },
      examples: { published: false, includeInFamilyCopy: false, current: false },
      compare: { published: false, indexed: false, suggestedOpponentIds: [], publishedPairIds: [] },
      app: { published: false },
      pricing: { published: false },
      sitemap: { published: false },
    };
  };

  assert.throws(
    () => validateModelRegistryDocument(mutate((copy) => {
      retire(copy.models[0], copy.models[1].id);
      retire(copy.models[1], copy.models[0].id);
    })),
    /replacement cycle/i
  );
  assert.throws(
    () => validateModelRegistryDocument(mutate((copy) => {
      retire(copy.models[0], copy.models[1].id);
      retire(copy.models[1], copy.models[2].id);
    })),
    /replacement chain/i
  );
});
