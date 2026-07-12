import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import registry from '../frontend/config/model-registry.json' with { type: 'json' };
import { buildModelRegistryRedirects } from '../frontend/config/model-registry-redirects.cjs';
import { validateModelRegistryDocument } from '../frontend/config/model-registry-validation.ts';

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

test('replacement canonical slugs and aliases redirect directly to the localized replacement', () => {
  const fixture = structuredClone(registry) as any;
  const retired = fixture.models.find((model: any) => model.aliases.publicSlugs.length > 0);
  const target = fixture.models.find((model: any) => model.id !== retired.id && model.replacement === null);
  retired.replacement = target.id;
  retired.publication = {
    model: { published: false, indexable: false },
    examples: { published: false, includeInFamilyCopy: false, current: false },
    compare: { published: false, indexed: false, suggestedOpponentIds: [], publishedPairIds: [] },
    app: { published: false },
    pricing: { published: false },
    sitemap: { published: false },
  };

  const validated = validateModelRegistryDocument(fixture);
  const redirects = buildModelRegistryRedirects(validated);
  const bySource = new Map(redirects.map((rule: any) => [rule.source, rule]));

  for (const route of Object.values(bases)) {
    for (const sourceSlug of [retired.slug, ...retired.aliases.publicSlugs]) {
      assert.deepEqual(bySource.get(`${route.prefix}/${sourceSlug}`), {
        source: `${route.prefix}/${sourceSlug}`,
        destination: `${route.prefix}/${target.slug}`,
        statusCode: 301,
      });
    }
  }
  const sources = new Set(redirects.map((rule: any) => rule.source));
  for (const rule of redirects) {
    assert.equal(sources.has(rule.destination), false, `${rule.source} must redirect in one hop`);
  }
});
