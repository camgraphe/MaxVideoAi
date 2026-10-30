import assert from 'node:assert/strict';
import test from 'node:test';
import { buildModelFamilyDefinitions } from '../frontend/config/model-families';
import { MODEL_LAUNCH_READY_MODELS, type ModelLaunchReadinessEntry } from '../frontend/config/model-launch-readiness';
import { listRuntimeModels } from '../frontend/config/model-runtime';
import { getLocalizedModelData } from '../frontend/lib/examples/modelLandingData';
import { buildCanonicalCompareSlug, getPublishedComparisonSlugs } from '../frontend/lib/compare-hub/data';
import { buildExamplesNextStepLinks } from '../frontend/app/(localized)/[locale]/(marketing)/examples/_lib/examples-page-copy';
import { buildPayAsYouGoPageData } from '../frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_lib/payg-page-data';
import { getPayAsYouGoContent } from '../frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_content';
import { buildPricingHubData } from '../frontend/app/(localized)/[locale]/(marketing)/pricing/_lib/pricingHubData';

const locales = ['en', 'fr', 'es'] as const;
const klingReadiness: ModelLaunchReadinessEntry = {
  waveId: 'kling-v4', modelId: 'kling-v4', familyId: 'kling', acceptedAssetCount: 2,
  familyPlaylistSlug: 'family-kling', modelPlaylistSlug: 'examples-kling-v4',
};

test('Kling V4 has no PAYG model cards or price links when absent from the supplied pricing catalog', () => {
  for (const locale of locales) {
    const content = getPayAsYouGoContent(locale);
    assert.ok(content.modelTesting.models['kling-v4']);
    assert.ok(content.priceLookups.items['kling-v4']);
    const pricingHub=structuredClone(buildPricingHubData(locale));
    pricingHub.video.rows=pricingHub.video.rows.filter(row=>row.id!=='kling-v4');
    const data = buildPayAsYouGoPageData({ locale, content, pricingHub });
    for(const items of [data.modelTesting.items,data.priceLookups.items,data.exampleCosts.items]) {
      assert.ok(items.every(item=>item.id!=='kling-v4'));
    }
  }
});

test('PAYG selects Kling V4 copy only when the pricing owner supplies a row and preserves its bounded examples', () => {
  for (const locale of locales) {
    const pricingHub = structuredClone(buildPricingHubData(locale));
    // Inject one current quote without changing a real tariff.
    const row = structuredClone(pricingHub.video.rows[0]);
    Object.assign(row, { id: 'kling-v4', engineName: 'Kling 4.0', modelHref: '/models/kling-v4', anchorId: 'kling-v4-pricing' });
    row.quotes['5s-720p'] = { status: 'exact', display: '$9.87' };
    pricingHub.video.rows=pricingHub.video.rows.filter(item=>item.id!=='kling-v4');
    pricingHub.video.rows.push(row);
    const content = getPayAsYouGoContent(locale);
    const data = buildPayAsYouGoPageData({ locale, content, pricingHub });
    assert.equal(data.modelTesting.items.find((item) => item.id === 'kling-v4')?.body, content.modelTesting.models['kling-v4'].body);
    assert.equal(data.priceLookups.items.find((item) => item.id === 'kling-v4')?.price, '$9.87');
    assert.equal(data.exampleCosts.items.find((item) => item.id === 'kling-v4')?.price, '$9.87');
    assert.ok(data.exampleCosts.items.length <= 6);
  }
});

test('family discovery and additive copy require both publication and accepted Kling V4 media', () => {
  const models = listRuntimeModels().map((model) => structuredClone(model));
  const closedModels = structuredClone(models);
  const closed = closedModels.find(model => model.id === 'kling-v4')!;
  closed.publication.examples.current = false;
  closed.publication.examples.includeInFamilyCopy = false;
  const withoutKlingMedia = MODEL_LAUNCH_READY_MODELS.filter(model => model.modelId !== 'kling-v4');
  const originalFamilies = buildModelFamilyDefinitions(closedModels, withoutKlingMedia);
  const originalKling = originalFamilies.find((family) => family.id === 'kling')!;
  const model = models.find((entry) => entry.id === 'kling-v4')!;
  const ready = [...withoutKlingMedia, klingReadiness];
  const mediaOnlyFamilies = buildModelFamilyDefinitions(closedModels, ready);
  model.publication.model.published = true;
  model.publication.model.indexable = true;
  model.publication.examples.published = true;
  model.publication.examples.current = true;
  model.publication.examples.includeInFamilyCopy = true;
  const publicationOnlyFamilies = buildModelFamilyDefinitions(models, withoutKlingMedia);
  const completeFamilies = buildModelFamilyDefinitions(models, ready);
  const completeKling = completeFamilies.find((family) => family.id === 'kling')!;
  assert.equal(completeKling.defaultModelSlug, originalKling.defaultModelSlug);
  assert.deepEqual(completeKling.routeAliases, originalKling.routeAliases);
  assert.deepEqual(completeKling.examplesPage?.publishedModelSlugs, ['kling-v4', ...originalKling.examplesPage!.publishedModelSlugs!]);

  for (const locale of locales) {
    const baseline = getLocalizedModelData(locale, originalFamilies);
    const baselineSnapshot = structuredClone(baseline);
    assert.doesNotMatch(JSON.stringify(baseline.kling), /Kling 4\.0/);
    assert.deepEqual(getLocalizedModelData(locale, mediaOnlyFamilies, closedModels), baseline, 'media alone cannot activate family copy');
    assert.deepEqual(getLocalizedModelData(locale, publicationOnlyFamilies, models), baseline, 'publication alone cannot invent examples');
    const copyDisabled = models.map((entry) => structuredClone(entry));
    copyDisabled.find((entry) => entry.id === 'kling-v4')!.publication.examples.includeInFamilyCopy = false;
    assert.deepEqual(getLocalizedModelData(locale, completeFamilies, copyDisabled), baseline, 'family publication does not grant family copy');
    const noindex = models.map((entry) => structuredClone(entry));
    noindex.find((entry) => entry.id === 'kling-v4')!.publication.model.indexable = false;
    assert.deepEqual(getLocalizedModelData(locale, completeFamilies, noindex), baseline, 'a private/noindex page must not receive public discovery copy');
    const qualified = getLocalizedModelData(locale, completeFamilies, models);
    assert.match(qualified.kling!.summary!, /Kling 4\.0/);
    assert.ok(qualified.kling!.summary!.includes(baseline.kling!.summary!));
    assert.ok(qualified.kling!.promptPatterns.startsWith(baseline.kling!.promptPatterns));
    assert.ok(qualified.kling!.strengthsLimits.startsWith(baseline.kling!.strengthsLimits));
    assert.deepEqual(qualified.kling!.faq.slice(0, baseline.kling!.faq.length), baseline.kling!.faq);
    assert.equal(qualified.kling!.faq.length, baseline.kling!.faq.length + 1);
    assert.equal(new Set(qualified.kling!.faq.map((item) => item.question)).size, qualified.kling!.faq.length);
    for (const key of ['metaTitle', 'metaDescription', 'heroTitle', 'subtitle', 'intro', 'pricingNotes'] as const) {
      assert.equal(qualified.kling![key], baseline.kling![key], `${locale}: preserve ${key}`);
    }
    assert.deepEqual(qualified.veo, baseline.veo, 'unrelated family stays unchanged');
    assert.deepEqual(getLocalizedModelData(locale, completeFamilies, models), qualified, 'repeated page/metadata reads must not duplicate added copy');
    assert.deepEqual(baseline, baselineSnapshot, 'activation must not mutate the authored historical data');
  }
});

test('all family onward links preserve authored order, including reversed pairs, for every published historical destination', () => {
  const historicalCandidates = {
    ltx: ['ltx-2-5-fast-vs-ltx-2-5-pro', 'ltx-2-5-pro-vs-seedance-2-5', 'ltx-2-5-pro-vs-veo-3-1', 'ltx-2-3-fast-vs-ltx-2-3-pro'],
    kling: ['kling-v4-vs-seedance-2-5', 'kling-v4-vs-wan-3-prime', 'kling-3-pro-vs-kling-3-standard', 'kling-3-pro-vs-seedance-2-5', 'kling-3-pro-vs-minimax-h3', 'kling-3-pro-vs-veo-3-1'],
    seedance: ['kling-v4-vs-seedance-2-5', 'seedance-2-5-vs-minimax-h3', 'seedance-2-5-vs-kling-3-pro', 'seedance-2-0-vs-seedance-2-0-fast', 'seedance-2-5-vs-veo-3-1'],
    veo: ['gemini-omni-flash-vs-veo-3-1', 'veo-3-1-vs-seedance-2-5', 'veo-3-1-vs-minimax-h3', 'veo-3-1-vs-veo-3-1-fast'],
    hailuo: ['minimax-h3-vs-minimax-h3-max', 'minimax-h3-vs-veo-3-1', 'minimax-h3-max-vs-seedance-2-5', 'minimax-hailuo-02-text-vs-veo-3-1-fast'],
    wan: ['kling-v4-vs-wan-3-prime', 'wan-3-vs-wan-3-prime', 'wan-3-prime-vs-seedance-2-5', 'wan-3-vs-kling-3-pro'],
  };
  const published = new Set(getPublishedComparisonSlugs());
  for (const locale of locales) for (const [family, candidates] of Object.entries(historicalCandidates)) {
    const expected = candidates.filter((slug) => {
      const [left, right] = slug.split('-vs-');
      return published.has(buildCanonicalCompareSlug(left, right));
    }).slice(0, 4);
    const links = buildExamplesNextStepLinks({
      appLocale: locale, locale, pricingPath: '/pricing', familySlug: family,
      isKlingLanding: family === 'kling', isLtxLanding: family === 'ltx',
      isSeedanceLanding: family === 'seedance', isVeoLanding: family === 'veo',
    });
    assert.deepEqual(links.map((link) => link.href.split('/').pop()), expected, `${locale}/${family}`);
    assert.ok(links.length <= 4);
    assert.equal(new Set(links.map((link) => link.href)).size, links.length);
    for (const link of links) assert.deepEqual(link.comparison, link.href.split('/').pop()!.split('-vs-'));
  }
});

test('the two current V4 comparisons lead the bounded family links while historical Kling destinations remain', () => {
  for (const locale of locales) {
    const links = buildExamplesNextStepLinks({
      appLocale: locale, locale, pricingPath: '/pricing', familySlug: 'kling',
      isKlingLanding: true, isLtxLanding: false, isSeedanceLanding: false, isVeoLanding: false,
    });
    assert.deepEqual(links.map((link) => link.href.split('/').pop()), [
      'kling-v4-vs-seedance-2-5',
      'kling-v4-vs-wan-3-prime',
      'kling-3-pro-vs-kling-3-standard',
      'kling-3-pro-vs-seedance-2-5',
    ]);
    assert.equal(getPublishedComparisonSlugs().includes('kling-3-pro-vs-kling-3-standard'), true);
    assert.equal(getPublishedComparisonSlugs().includes('kling-o3-pro-vs-kling-v4'), false);
    assert.ok(links.length <= 4);
  }
});
