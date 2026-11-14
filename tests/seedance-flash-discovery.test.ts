import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { listRuntimeModels } from '../frontend/config/model-runtime';
import { buildMarketingModelMenu, buildMarketingCompareMenu } from '../frontend/config/navigation';
import { FOOTER_MODELS, FOOTER_COMPARISONS } from '../frontend/config/marketing-footer';
import { buildModelFamilyDefinitions } from '../frontend/config/model-families';
import { getLocalizedModelData } from '../frontend/lib/examples/modelLandingData';
import { getPublishedComparisonSlugs, getHubComparisonSlugsForSitemap } from '../frontend/lib/compare-hub/data';
import { getIndexableComparisonLocales } from '../frontend/lib/compare-hub/indexation';
import { buildLlmsModelDiscoveryProjection } from '../frontend/lib/seo/llms-text';
import { loadBenchmarkLabStaticData } from '../frontend/server/benchmark-lab-data';
import { buildBenchmarkPageData } from '../frontend/app/(localized)/[locale]/(marketing)/benchmarks/_lib/benchmark-page-data';
import { buildComparisonMetrics } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-scorecard';
import { parseComparePageContentDocument } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides';
import { BEST_FOR_PAGES } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/best-for/[usecase]/_lib/best-for-detail-config';
import { getModelGuidance } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/best-for/[usecase]/_lib/best-for-model-guidance';
import { DEFAULT_PAYG_DISCOVERY_CONFIGS } from '../frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_lib/payg-discovery-config';
import compareConfig from '../frontend/config/compare-config.json';
import trainingPolicy from '../frontend/config/ai-training-public-policy.json';

const flash = 'seedance-2-5-flash';
const pairs = [
  'seedance-2-5-vs-seedance-2-5-flash',
  'seedance-2-0-fast-vs-seedance-2-5-flash',
  'kling-v4-flash-vs-seedance-2-5-flash',
  'seedance-2-5-flash-vs-veo-3-1-fast',
  'ltx-2-5-fast-vs-seedance-2-5-flash',
  'minimax-h3-vs-seedance-2-5-flash',
];
const uses = ['fast-drafts', 'image-to-video', 'character-reference', 'reference-to-video', 'multi-shot-video', 'ads', 'ugc-ads', 'product-videos'];

test('six complete Flash comparisons reach discovery, localized indexing and assistant paths', () => {
  const published = getPublishedComparisonSlugs();
  const sitemap = getHubComparisonSlugsForSitemap();
  const assistant = buildLlmsModelDiscoveryProjection();
  assert.ok(assistant.currentModels.some(model => model.id === flash));
  for (const pair of pairs) {
    const file = `content/comparisons/${pair}.json`;
    const document = parseComparePageContentDocument(readFileSync(file, 'utf8'), pair, file);
    assert.ok(published.includes(pair));
    assert.ok(sitemap.includes(pair));
    assert.ok(assistant.primaryComparisons.some(item => item.slug === pair));
    assert.ok(compareConfig.scoreboardOnlyComparisons.includes(pair));
    assert.deepEqual(getIndexableComparisonLocales(pair), ['en', 'fr', 'es']);
    for (const [locale, prefix] of [['en', '/ai-video-engines/'], ['fr', '/fr/comparatif/'], ['es', '/es/comparativa/']] as const) {
      const content = document[locale];
      assert.ok(content.meta?.title && content.meta.description && content.heroIntro && content.quickVerdict);
      assert.equal(content.topCards?.length, 4);
      assert.equal(content.faq?.items.length, 5);
      assert.ok(content.primaryLinks!.some(link => link.href.endsWith(`/models/${flash}`) || link.href.endsWith(`/modeles/${flash}`) || link.href.endsWith(`/modelos/${flash}`)));
      assert.ok(trainingPolicy.pageTargets.includes(prefix + pair));
      assert.doesNotMatch(JSON.stringify(content), /\$\s*\d|\d+(?:\.\d+)?\s*(?:USD|EUR)|\.mp4|\.webm/);
    }
  }
});

test('menus, footer and PAYG make Flash reachable while retaining standard Seedance', () => {
  const menu = buildMarketingModelMenu(listRuntimeModels());
  for (const id of [flash, 'seedance-2-5']) assert.ok(menu.some(item => item.slug === id));
  assert.ok(buildMarketingCompareMenu(listRuntimeModels()).some(item => item.slug === pairs[0]));
  assert.ok(FOOTER_MODELS.some(item => item.key === flash));
  assert.ok(FOOTER_COMPARISONS.some(item => item.key === pairs[0]));
  for (const group of Object.values(DEFAULT_PAYG_DISCOVERY_CONFIGS)) {
    assert.ok(group.some(item => item.id === flash));
    assert.ok(group.some(item => item.id === 'seedance-2-5'));
  }
});

test('Best for adds a workflow option to eight uses without a 4K or measured-quality recommendation', () => {
  assert.deepEqual(BEST_FOR_PAGES.filter(entry => entry.topPicks?.includes(flash)).map(entry => entry.slug).sort(), [...uses].sort());
  for (const use of uses) {
    const entry = BEST_FOR_PAGES.find(entry => entry.slug === use)!;
    assert.equal(entry.topPicks!.at(-1), flash, 'keep established editorial order');
    assert.ok(entry.relatedComparisons?.some(pair => pairs.includes(pair)));
    for (const locale of ['en', 'fr', 'es'] as const) {
      const guidance = getModelGuidance(flash, locale, use)!;
      assert.match(guidance.reason, /480p|720p/);
      assert.match(guidance.limit, /4K/);
      assert.ok(guidance.tag && guidance.limit);
    }
  }
});

test('Seedance family copy keeps canonical identity, earlier explanations and exact media attribution', () => {
  const models = listRuntimeModels().map(model => structuredClone(model));
  const closed = structuredClone(models);
  closed.find(model => model.id === flash)!.publication.examples.includeInFamilyCopy = false;
  const families = buildModelFamilyDefinitions(models);
  assert.equal(families.find(family => family.id === 'seedance')!.defaultModelSlug, 'seedance-2-0');
  for (const locale of ['en', 'fr', 'es'] as const) {
    const baseline = getLocalizedModelData(locale, families, closed).seedance!;
    const current = getLocalizedModelData(locale, families, models).seedance!;
    assert.match(current.summary!, /Seedance 2\.5 Flash/);
    assert.equal(current.metaTitle, baseline.metaTitle);
    assert.deepEqual(current.faq.slice(0, baseline.faq.length), baseline.faq);
    assert.equal(current.faq.length, baseline.faq.length + 1);
  }
});

test('benchmark exposes Flash estimates and factual specs, keeps missing metrics empty and respects registry removal', async () => {
  const data = await loadBenchmarkLabStaticData();
  const latency = { status: 'unavailable', windowDays: 30, asOf: null, rows: [] } as const;
  const page = buildBenchmarkPageData(data, { ...latency, rows: [] });
  const score = page.scores.find(score => score.modelSlug === flash)!;
  assert.ok(score);
  assert.equal(score.overall, 8.0);
  assert.equal(score.review?.status, 'editorial-estimated');
  const spec = page.specs.find(spec => spec.modelSlug === flash)!;
  assert.ok(spec);
  assert.equal(spec.maxResolution, '480p / 720p');
  assert.equal(spec.maxDuration, '4–30s');
  assert.equal(spec.references, 'Up to 10 image references');
  const metrics = buildComparisonMetrics({ compareCopy: {}, leftScore: null, rightScore: null, pairHasNativeAudio: true, speedScores: { leftScore: null, rightScore: null } });
  assert.equal(metrics.length, 10);
  assert.ok(metrics.every(metric => metric.leftValue === null && metric.rightValue === null));
  const models = listRuntimeModels().map(model => structuredClone(model));
  models.find(model => model.id === flash)!.publication.model.published = false;
  const removed = buildBenchmarkPageData(data, { ...latency, rows: [] }, models);
  assert.equal(removed.specs.some(spec => spec.modelSlug === flash), false);
  assert.equal(removed.scores.some(score => score.modelSlug === flash), false);
});
