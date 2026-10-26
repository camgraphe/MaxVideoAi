import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { listRuntimeModels } from '../frontend/config/model-runtime';
import { buildMarketingCompareMenu, buildMarketingModelMenu } from '../frontend/config/navigation';
import { selectCurrentModelCatalogSlugs } from '../frontend/lib/models/catalog';
import { buildPublishedComparisonSlugsFromModels } from '../frontend/lib/compare-hub/pairs';
import {
  buildDefaultModelCompareHref,
  buildModelsCatalogHeroData,
  type ModelsCatalogHeroCard,
} from '../frontend/app/(localized)/[locale]/(marketing)/models/_lib/models-catalog-decision-data';
import { parseComparePageContentDocument } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides';

const PAIR = 'kling-o3-pro-vs-kling-v4';
const currentModels = () => structuredClone(listRuntimeModels());

test('private model previews cannot acquire a New menu badge or displace public discovery', () => {
  const models = currentModels();
  const current = buildMarketingModelMenu(models);
  assert.equal(current.some(item => item.slug === 'kling-v4'), false);
  assert.equal(selectCurrentModelCatalogSlugs(models).includes('kling-v4'), false);
  // Exercise the generic rule on a current candidate, independently of V4 placement.
  models.find(model => model.id === 'flux-3-max')!.publication.model.indexable = false;
  assert.equal(buildMarketingModelMenu(models).some(item => item.slug === 'flux-3-max'), false);
  assert.ok(current.some(item => item.slug === 'kling-3-pro'));
  const older = models.find(model => model.id === 'kling-3-pro')!;
  older.lifecycle = 'legacy';
  older.successorId = 'kling-v4';
  assert.ok(buildMarketingModelMenu(models).some(item => item.slug === older.slug), 'A private successor cannot displace a public predecessor');
});

test('prepared comparison content passes the existing localized route contract', () => {
  const document = parseComparePageContentDocument(readFileSync(`content/comparisons/${PAIR}.json`, 'utf8'), PAIR);
  for (const locale of ['en', 'fr', 'es'] as const) {
    assert.deepEqual(document[locale].primaryLinks?.map(link => link.href), ['/models/kling-v4', '/models/kling-o3-pro']);
    assert.ok(document[locale].quickVerdict?.body);
  }
});

test('future published V4 gains exactly one New menu card without expanding the menu', () => {
  const models = currentModels();
  models.find(model => model.id === 'kling-v4')!.publication.model.indexable = true;
  const menu = buildMarketingModelMenu(models);
  assert.equal(menu.filter(item => item.slug === 'kling-v4').length, 1);
  assert.equal(menu.find(item => item.slug === 'kling-v4')?.badge, 'new');
  assert.equal(menu.find(item => item.slug === 'kling-v4')?.brandId, 'kling');
  assert.ok(menu.length <= 11);
  assert.ok(menu.some(item => item.slug === 'kling-3-pro'));
  const catalog = selectCurrentModelCatalogSlugs(models);
  assert.ok(catalog.indexOf('kling-v4') < catalog.indexOf('kling-3-pro'));
  assert.ok(catalog.includes('flux-3-max'));
});

test('the prepared same-family comparison remains hidden until publication and review', () => {
  const models = currentModels();
  assert.equal(buildMarketingCompareMenu(models).some(item => item.slug === PAIR), false);
  assert.equal(buildDefaultModelCompareHref('kling-v4'), null);
  const model = models.find(entry => entry.id === 'kling-v4')!;
  model.publication.compare = {
    published: true, indexed: true,
    suggestedOpponentIds: ['kling-o3-pro'], publishedPairIds: ['kling-o3-pro'],
  };
  assert.ok(buildMarketingCompareMenu(models).some(item => item.slug === PAIR));
  assert.ok(buildMarketingCompareMenu(models).length <= 10);
  assert.equal(buildPublishedComparisonSlugsFromModels(models, () => false).includes(PAIR), false);
  assert.ok(buildPublishedComparisonSlugsFromModels(models, () => true).includes(PAIR));
});

test('catalogue promotion stays bounded and localized without inventing a review score', () => {
  const makeCards = (ids: string[]): ModelsCatalogHeroCard[] => ids.map(id => ({
    id, label: id, overallScore: null,
    href: { pathname: '/models/[slug]', params: { slug: id } },
  }));
  const existing = ['ltx-2-5-pro', 'wan-3-prime', 'grok-imagine-video-1-5', 'flux-3-max', 'seedance-2-5'];
  assert.deepEqual(buildModelsCatalogHeroData({activeLocale: 'en', cards: makeCards(existing)}).topPicks.map(item => item.id), existing);
  const reasons = new Set<string>();
  for (const activeLocale of ['en', 'fr', 'es'] as const) {
    const hero = buildModelsCatalogHeroData({activeLocale, cards: makeCards([...existing, 'kling-v4'])});
    const card = hero.topPicks.find(item => item.id === 'kling-v4');
    assert.ok(card);
    assert.equal(hero.topPicks.length, 5);
    assert.equal(card.score, null);
    assert.equal(card.scoreReviewLabel, null);
    reasons.add(card.reason);
    assert.ok(hero.topPicks.some(item => item.id === 'flux-3-max'));
  }
  assert.equal(reasons.size, 3);
});
