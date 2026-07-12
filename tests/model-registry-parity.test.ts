import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  getRuntimeModelByCanonicalSlug,
  getRuntimeModelById,
  listRuntimeModels,
  resolveRuntimeEngineInput,
  resolveRuntimePublicSlug,
  toLegacyModelSurfaces,
} from '../frontend/config/model-runtime.ts';

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
  assert.equal(Object.hasOwn(runtime, 'tombstones'), false);
  assert.equal(runtime.models.every((model: object) => !Object.hasOwn(model, 'replacement')), true);
});
