import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  resolveModelRegistryEngineInput,
  resolveModelRegistryPublicSlug,
} from '../frontend/config/model-registry.ts';
import { validateModelRegistryDocument } from '../frontend/config/model-registry-validation.ts';

const valid = JSON.parse(readFileSync('frontend/config/model-registry.json', 'utf8'));

function mutate(run: (copy: any) => void) {
  const copy = structuredClone(valid);
  run(copy);
  return copy;
}

test('canonical registry validates the committed document', () => {
  assert.equal(validateModelRegistryDocument(valid).models.length, 41);
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
