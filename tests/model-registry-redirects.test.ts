import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import registry from '../frontend/config/model-registry.json' with { type: 'json' };

const require = createRequire(import.meta.url);
const nextConfig = require('../frontend/next.config.js');
const baseline = JSON.parse(readFileSync('tests/fixtures/model-registry-baseline.json', 'utf8'));

const bases = {
  en: { prefix: '/models', index: '/models' },
  fr: { prefix: '/fr/modeles', index: '/fr/modeles' },
  es: { prefix: '/es/modelos', index: '/es/modelos' },
} as const;

test('next config projects every model alias and tombstone in all locales as one-hop 301', async () => {
  const redirects = await nextConfig.redirects();
  const bySource = new Map(redirects.map((rule: any) => [rule.source, rule]));
  const expectedSources = new Set<string>();

  for (const model of registry.models) {
    for (const alias of model.aliases.publicSlugs) {
      for (const route of Object.values(bases)) {
        const source = `${route.prefix}/${alias}`;
        expectedSources.add(source);
        assert.deepEqual(bySource.get(source), {
          source,
          destination: `${route.prefix}/${model.slug}`,
          statusCode: 301,
        });
      }
    }
  }
  for (const tombstone of registry.tombstones) {
    for (const route of Object.values(bases)) {
      const source = `${route.prefix}/${tombstone.slug}`;
      expectedSources.add(source);
      assert.deepEqual(bySource.get(source), {
        source,
        destination: route.index,
        statusCode: 301,
      });
    }
  }

  assert.equal(expectedSources.size, 141);
  for (const previous of baseline.modelRedirects) {
    const actual = bySource.get(previous.source);
    assert.ok(actual, `missing historical redirect ${previous.source}`);
    assert.equal(actual.destination, previous.destination, previous.source);
    assert.equal(actual.statusCode, 301, previous.source);
  }
  for (const source of expectedSources) {
    const destination = bySource.get(source).destination;
    assert.equal(expectedSources.has(destination), false, `redirect chain: ${source} -> ${destination}`);
  }
});
