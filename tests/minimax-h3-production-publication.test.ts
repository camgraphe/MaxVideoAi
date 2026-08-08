import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { getModelFamilyDefinition } from '../frontend/config/model-families.ts';
import { getRuntimeModelById, resolveRuntimeEngineInput } from '../frontend/config/model-runtime.ts';
import { getFalEngineById } from '../frontend/src/config/falEngines.ts';

const slug = 'minimax-h3';

test('MiniMax H3 is one canonical executable production model on every public surface', () => {
  const model = getRuntimeModelById(slug);
  const engine = getFalEngineById(slug);

  assert.ok(model);
  assert.ok(engine);
  assert.equal(model.presentationOnly, undefined);
  assert.equal(engine.id, slug);
  assert.equal(engine.modelSlug, slug);
  assert.deepEqual(model.aliases, { internal: [], publicSlugs: [] });
  assert.equal(resolveRuntimeEngineInput(slug)?.id, slug);
  assert.deepEqual(model.publication.model, { published: true, indexable: true });
  assert.deepEqual(model.publication.examples, {
    published: true,
    includeInFamilyCopy: true,
    current: true,
    familyRank: 0,
  });
  assert.deepEqual(model.publication.app, {
    published: true,
    discoveryRank: -4,
    variantGroup: 'hailuo',
    variantLabel: 'H3',
    launchBadge: 'new',
  });
  assert.equal(model.publication.pricing.published, true);
  assert.deepEqual(model.publication.sitemap, { published: true });
  assert.deepEqual(model.publication.compare.suggestedOpponentIds, [
    'seedance-2-5',
    'kling-o3-pro',
    'veo-3-1',
  ]);
  assert.deepEqual(model.publication.compare.publishedPairIds, [
    'seedance-2-5',
    'kling-o3-pro',
    'veo-3-1',
  ]);
});

test('MiniMax family makes H3 current while retaining Hailuo 02 as a published older model', () => {
  const family = getModelFamilyDefinition('hailuo');
  const hailuo02 = getRuntimeModelById('minimax-hailuo-02-text');

  assert.ok(family);
  assert.ok(hailuo02);
  assert.equal(family.defaultModelSlug, slug);
  assert.deepEqual(family.examplesPage.publishedModelSlugs, [slug, 'minimax-hailuo-02-text']);
  assert.deepEqual(family.examplesPage.currentModelSlugs, [slug]);
  assert.equal(hailuo02.publication.examples.current, false);
  assert.equal(hailuo02.publication.examples.familyRank, 1);
  assert.ok(family.routeAliases.includes(slug));
  assert.ok(family.routeAliases.includes('minimax-hailuo-02-text'));
  assert.deepEqual(family.aliases, ['minimax-h3', 'hailuo-h3', 'hailuo-03', 'minimax-hailuo-02']);
  assert.deepEqual(family.prefixes, ['minimax/h3', 'minimax-h3', 'hailuo-h3', 'minimax-hailuo-02']);
});

test('localized Hailuo 02 pages link crawlably to the current MiniMax H3 model', () => {
  const hrefs = {
    en: '/models/minimax-h3',
    fr: '/fr/modeles/minimax-h3',
    es: '/es/modelos/minimax-h3',
  } as const;

  for (const [locale, href] of Object.entries(hrefs)) {
    const source = readFileSync(`content/models/${locale}/minimax-hailuo-02-text.json`, 'utf8');
    assert.match(source, new RegExp(`"href"\\s*:\\s*"${href}"`), `${locale} Hailuo 02 → H3 link`);
  }
});

test('priority comparison publication is reciprocal for H3', () => {
  for (const opponentId of ['seedance-2-5', 'kling-o3-pro', 'veo-3-1']) {
    const opponent = getRuntimeModelById(opponentId);
    assert.ok(opponent, `missing ${opponentId}`);
    assert.ok(opponent.publication.compare.publishedPairIds.includes(slug), `${opponentId} must publish H3 pair`);
  }
});
