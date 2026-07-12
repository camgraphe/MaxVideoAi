import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const fixturePath = 'tests/fixtures/model-registry-baseline.json';

test('model registry baseline freezes the complete pre-migration contract', () => {
  const baseline = JSON.parse(readFileSync(fixturePath, 'utf8')) as {
    models: Array<{ id: string; slug: string }>;
    internalAliases: Array<{ alias: string; targetId: string }>;
    publicSlugAliases: Array<{ alias: string; targetSlug: string }>;
    familyDefinitions: Array<{ id: string }>;
    modelRedirects: Array<{ source: string; destination: string; statusCode: number }>;
    tombstones: Array<{ slug: string; destination: 'models-index' }>;
  };

  assert.equal(baseline.models.length, 41);
  assert.equal(new Set(baseline.models.map((model) => model.id.toLowerCase())).size, 41);
  assert.equal(new Set(baseline.models.map((model) => model.slug)).size, 41);
  assert.equal(baseline.internalAliases.length, 87);
  assert.equal(baseline.publicSlugAliases.length, 45);
  assert.ok(baseline.familyDefinitions.length >= 10);
  assert.ok(baseline.modelRedirects.length >= 35);
  assert.deepEqual(baseline.tombstones, [
    { slug: 'hunyuan-video', destination: 'models-index' },
    { slug: 'luma-dream-machine', destination: 'models-index' },
  ]);
});
