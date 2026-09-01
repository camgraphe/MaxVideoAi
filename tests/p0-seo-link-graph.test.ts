import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import type { AppLocale } from '../frontend/i18n/locales.ts';
import * as runtime from '../frontend/config/model-runtime.ts';
import * as comparisons from '../frontend/lib/compare-hub/data.ts';
import * as llms from '../frontend/lib/seo/llms-text.ts';
import * as bestFor from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/best-for/[usecase]/_lib/best-for-detail-ranking.ts';
import { buildPublicBestForEntries } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/best-for/[usecase]/_lib/best-for-detail-config.ts';
import { buildSeoMetadata } from '../frontend/lib/seo/metadata.ts';
import { buildModelDecisionData } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-data.ts';
import { buildVideoPricingRowsFromEntries } from '../frontend/app/(localized)/[locale]/(marketing)/pricing/_lib/pricingHubData.ts';
import { selectCurrentModelCatalogSlugs } from '../frontend/lib/models/catalog.ts';
import { buildModelFamilyDefinitions, MODEL_FAMILIES } from '../frontend/config/model-families.ts';
import { createExampleFamilyResolver } from '../frontend/lib/model-families.ts';
import type { ModelLaunchReadinessEntry } from '../frontend/config/model-launch-readiness.ts';
import { listFalEngines, type FalEngineEntry } from '../frontend/src/config/falEngines.ts';
import mcpPublication from '../frontend/config/mcp-publication.json' with { type: 'json' };
import { buildPricingHubData } from '../frontend/app/(localized)/[locale]/(marketing)/pricing/_lib/pricingHubData.ts';
import { getPayAsYouGoContent } from '../frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_content/index.ts';
import { buildPayAsYouGoPageData } from '../frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_lib/payg-page-data.ts';
import { resolveComparePublicationRobots } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-metadata.ts';

const P0_IDS = [
  'wan-3',
  'wan-3-prime',
  'ltx-2-5-fast',
  'ltx-2-5-pro',
  'grok-imagine-video-1-5',
  'flux-3',
  'flux-3-draft',
] as const;
const P0_SET = new Set<string>(P0_IDS);
const DEEP_LEGACY_IDS = ['ltx-2', 'ltx-2-fast', 'wan-2-5'] as const;
const LEGACY_IDS = ['ltx-2-3', 'ltx-2-3-fast', 'wan-2-6'] as const;
const LOCALES = ['en', 'fr', 'es'] as const;
const frontendRequire = createRequire(new URL('../frontend/package.json', import.meta.url));

function ensureReactCacheForSitemapImports() {
  const react = frontendRequire('react') as {
    cache?: <TFunction extends (...args: never[]) => unknown>(fn: TFunction) => TFunction;
  };
  react.cache ??= (fn) => fn;
}

function publishedFixture(): runtime.RuntimeModelEntry[] {
  return runtime.listRuntimeModels().map((model) => {
    const copy = structuredClone(model);
    if (!P0_SET.has(model.id)) return copy;
    return {
      ...copy,
      publication: {
        ...copy.publication,
        model: { published: true, indexable: true },
        examples: {
          ...copy.publication.examples,
          published: true,
          includeInFamilyCopy: true,
          current: true,
          familyRank: model.id.endsWith('prime') || model.id.endsWith('pro') || model.id === 'flux-3' ? 0 : 1,
        },
        compare: { ...copy.publication.compare, published: true, indexed: true },
        pricing: { ...copy.publication.pricing, published: true },
        sitemap: { published: true },
      },
    };
  });
}

function readinessFixture(): ModelLaunchReadinessEntry[] {
  const familyById = new Map(P0_IDS.map((id) => [id, id.startsWith('wan') ? 'wan' : id.startsWith('ltx') ? 'ltx' : id.startsWith('grok') ? 'grok' : 'flux'] as const));
  return P0_IDS.map((modelId) => {
    const familyId = familyById.get(modelId)!;
    return {
      modelId,
      familyId,
      acceptedAssetCount: 2,
      familyPlaylistSlug: `family-${familyId}`,
      modelPlaylistSlug: `examples-${modelId}`,
    } as ModelLaunchReadinessEntry;
  });
}

function publishedFalEntries(): FalEngineEntry[] {
  return listFalEngines().map((entry) => {
    if (!P0_SET.has(entry.id)) return structuredClone(entry);
    return {
      ...structuredClone(entry),
      surfaces: {
        ...structuredClone(entry.surfaces),
        modelPage: { indexable: true, includeInSitemap: true },
        pricing: { ...entry.surfaces.pricing, includeInEstimator: true },
      },
    };
  });
}

function rosterFixture(models: readonly runtime.RuntimeModelEntry[]) {
  return models.map((model) => ({
    engineId: model.id,
    modelSlug: model.slug,
    lifecycle: model.lifecycle,
    surfaces: {
      modelPage: {
        indexable: model.publication.model.indexable,
        includeInSitemap: model.publication.sitemap.published,
      },
    },
  }));
}

function localizedDecision(modelId: string, locale: AppLocale) {
  return JSON.parse(readFileSync(join('content/models', locale, `${modelId}.json`), 'utf8')).decision;
}

test('the real hidden state omits every P0 from current and machine discovery owners', async () => {
  ensureReactCacheForSitemapImports();
  const sitemap = await import('../frontend/lib/sitemapData.ts');
  assert.deepEqual(runtime.listPublicCurrentRuntimeModels().filter((model) => P0_SET.has(model.id)), []);
  assert.deepEqual(selectCurrentModelCatalogSlugs(runtime.listRuntimeModels()).filter((slug) => P0_SET.has(slug)), []);

  const xml = await sitemap.buildModelsSitemapXml();
  const llmsText = llms.buildLlmsText(mcpPublication);
  const pricingRows = buildVideoPricingRowsFromEntries(listFalEngines(), 'en');
  const payg = buildPayAsYouGoPageData({
    locale: 'en',
    content: getPayAsYouGoContent('en'),
    pricingHub: buildPricingHubData('en'),
  });
  const paygLinks = JSON.stringify(payg);
  for (const id of P0_IDS) {
    assert.doesNotMatch(xml, new RegExp(`/models/${id}(?:<|$)`), id);
    assert.doesNotMatch(llmsText, new RegExp(`/models/${id}(?:\\)|$)`), id);
    assert.equal(pricingRows.some((row) => row.id === id), false, id);
    assert.doesNotMatch(paygLinks, new RegExp(`(?:/models/|#)${id}(?:["#)]|$)`), `PAYG ${id}`);
    assert.equal(
      MODEL_FAMILIES.some((family) => family.examplesPage?.publishedModelSlugs?.includes(id)),
      false,
      `family ${id}`,
    );
  }

  assert.deepEqual(
    comparisons.getHubComparisonSlugsForSitemap().filter((slug) => P0_IDS.some((id) => slug.includes(id))),
    [],
  );
});

test('hidden P0 comparison metadata remains noindex,follow', () => {
  assert.deepEqual(
    resolveComparePublicationRobots('en', 'flux-3-vs-grok-imagine-video-1-5'),
    { index: false, follow: true },
  );
});

test('one public-current predicate excludes hidden, legacy and deep-legacy models', () => {
  const visible = publishedFixture();
  assert.deepEqual(
    runtime.listPublicCurrentRuntimeModels(visible).filter((model) => P0_SET.has(model.id)).map((model) => model.id).sort(),
    [...P0_IDS].sort(),
  );
  for (const id of [...LEGACY_IDS, ...DEEP_LEGACY_IDS]) {
    assert.equal(runtime.isRuntimeModelPublicCurrent(visible.find((model) => model.id === id)), false, id);
  }

  const catalogue = selectCurrentModelCatalogSlugs(visible);
  for (const id of P0_IDS) assert.ok(catalogue.includes(id), id);
  for (const id of DEEP_LEGACY_IDS) assert.equal(catalogue.includes(id), false, id);
});

test('the supplied-roster sitemap fixture emits exactly one reciprocal canonical per locale', async () => {
  ensureReactCacheForSitemapImports();
  const sitemap = await import('../frontend/lib/sitemapData.ts');
  const routeDiscovery = await import('../frontend/lib/sitemap/route-discovery.ts');
  assert.equal(typeof sitemap.buildModelsSitemapXmlFromRoster, 'function');
  assert.equal(typeof routeDiscovery.buildModelRouteEntriesFromRoster, 'function');
  const visible = rosterFixture(publishedFixture());
  const xml = await sitemap.buildModelsSitemapXmlFromRoster(visible);
  const routeEntries = routeDiscovery.buildModelRouteEntriesFromRoster(visible);

  for (const id of P0_IDS) {
    const urls = {
      en: `https://maxvideoai.com/models/${id}`,
      fr: `https://maxvideoai.com/fr/modeles/${id}`,
      es: `https://maxvideoai.com/es/modelos/${id}`,
    } as const;
    assert.equal(routeEntries.filter((entry) => entry.englishPath === `/models/${id}`).length, 1, id);
    for (const locale of LOCALES) {
      assert.equal(xml.split(`<loc>${urls[locale]}</loc>`).length - 1, 1, `${id}:${locale}`);
      for (const alternate of LOCALES) {
        assert.match(xml, new RegExp(`hreflang="${alternate}" href="${urls[alternate]}"`));
      }
      assert.match(xml, new RegExp(`hreflang="x-default" href="${urls.en}"`));
    }
  }
});

test('published model fixtures have unique localized metadata and 2-4 rendered editorial outbounds', () => {
  const titles = new Set<string>();
  const descriptions = new Set<string>();
  const entries = new Map(publishedFalEntries().map((entry) => [entry.id, entry]));

  for (const locale of LOCALES) {
    for (const id of P0_IDS) {
      const decision = localizedDecision(id, locale);
      const metadata = buildSeoMetadata({
        locale,
        title: decision.meta.title,
        description: decision.meta.description,
        englishPath: `/models/${id}`,
        availableLocales: [...LOCALES],
        robots: { index: true, follow: true },
      });
      titles.add(String(metadata.title && typeof metadata.title === 'object' ? metadata.title.absolute : metadata.title));
      descriptions.add(String(metadata.description));
      assert.match(String(metadata.alternates?.canonical), new RegExp(locale === 'en' ? `/models/${id}$` : `/${locale}/(?:modeles|modelos)/${id}$`));
      assert.deepEqual(Object.keys(metadata.alternates?.languages ?? {}).sort(), ['en', 'es', 'fr', 'x-default']);

      const rendered = buildModelDecisionData({
        engine: entries.get(id)!,
        locale,
        decisionContent: decision,
        isComparisonPublished: () => true,
      });
      assert.ok(rendered);
      const editorial = [
        rendered.hero.secondaryCta,
        ...rendered.hero.quickLinks,
        ...rendered.decisionCards.map((card) => card.cta),
      ]
        .map((link) => link.href.split(/[?#]/, 1)[0])
        .filter((href) => href.startsWith('/') && !href.startsWith('/app') && !/\/(?:pricing|tarifs|precios)$/.test(href));
      const uniqueEditorial = new Set(editorial);
      assert.ok(uniqueEditorial.size >= 2 && uniqueEditorial.size <= 4, `${locale}:${id}:${[...uniqueEditorial]}`);
    }
  }
  assert.equal(titles.size, P0_IDS.length * LOCALES.length);
  assert.equal(descriptions.size, P0_IDS.length * LOCALES.length);
});

test('published fixtures have model, family, pricing and evidence-backed best-for inbound owners', () => {
  const models = publishedFixture();
  const catalogue = new Set(selectCurrentModelCatalogSlugs(models));
  const families = buildModelFamilyDefinitions(models, readinessFixture());
  const familyResolver = createExampleFamilyResolver({ families, engines: publishedFalEntries() });
  const pricingRows = buildVideoPricingRowsFromEntries(publishedFalEntries(), 'en');
  const scores = new Map(P0_IDS.map((id, index) => [id, { modelSlug: id, fidelity: 9 - index / 10, motion: 8 }]));
  const ranked = bestFor.resolveTopPicks(
    { slug: 'cinematic-realism', title: 'Fixture', tier: 1, topPicks: [...P0_IDS] },
    scores,
    { models, catalog: publishedFalEntries().map((entry) => ({ engineId: entry.id, modelSlug: entry.modelSlug, marketingName: entry.marketingName })) },
  );

  for (const id of P0_IDS) {
    const model = models.find((entry) => entry.id === id)!;
    assert.ok(catalogue.has(model.slug), `models inbound ${id}`);
    assert.ok(familyResolver.getModelSlugs(model.family!).includes(model.slug), `family inbound ${id}`);
    assert.ok(pricingRows.some((row) => row.id === id && row.modelHref === `/models/${id}`), `pricing inbound ${id}`);
    assert.ok(ranked.includes(id), `evidence-backed best-for inbound ${id}`);
  }
});

test('best-for explicit and fallback ranking rejects hidden, legacy, deep-legacy and unscored P0', () => {
  const visible = publishedFixture();
  const oneScore = new Map([[P0_IDS[0], { modelSlug: P0_IDS[0], fidelity: 9, motion: 9 }]]);
  const catalog = publishedFalEntries().map((entry) => ({ engineId: entry.id, modelSlug: entry.modelSlug, marketingName: entry.marketingName }));
  const explicit = bestFor.resolveTopPicks(
    { slug: 'cinematic-realism', title: 'Fixture', tier: 1, topPicks: [...P0_IDS, ...LEGACY_IDS, ...DEEP_LEGACY_IDS] },
    oneScore,
    { models: visible, catalog },
  );
  const fallback = bestFor.resolveTopPicks(
    { slug: 'cinematic-realism', title: 'Fixture', tier: 1 },
    oneScore,
    { models: visible, catalog },
  );
  assert.deepEqual(explicit, [P0_IDS[0]]);
  assert.deepEqual(fallback, [P0_IDS[0]]);
  assert.deepEqual(
    buildPublicBestForEntries(
      [{ slug: 'cinematic-realism', title: 'Fixture', tier: 1, topPicks: [...P0_IDS, ...LEGACY_IDS, ...DEEP_LEGACY_IDS] }],
      visible,
    )[0]?.topPicks,
    [...P0_IDS],
  );
  assert.deepEqual(bestFor.resolveTopPicks(
    { slug: 'cinematic-realism', title: 'Fixture', tier: 1, topPicks: [...P0_IDS] },
    oneScore,
    { models: runtime.listRuntimeModels(), catalog },
  ), []);
});

test('symmetric comparison publication requires both endpoint flags and a complete localized scoreboard', () => {
  const model = (id: string, opponent: string, published = true, indexed = true) => ({
    id,
    slug: id,
    publication: { compare: { published, indexed, publishedPairIds: [opponent] } },
  });
  const pair = comparisons.buildCanonicalCompareSlug('fixture-alpha', 'fixture-beta');
  const complete = () => true;
  assert.deepEqual(comparisons.buildPublishedComparisonSlugsFromModels([
    model('fixture-alpha', 'fixture-beta'),
    model('fixture-beta', 'fixture-alpha'),
  ], complete), [pair]);
  assert.deepEqual(comparisons.buildPublishedComparisonSlugsFromModels([
    model('fixture-alpha', 'fixture-beta'),
    model('fixture-beta', 'fixture-alpha', false, false),
  ], complete), []);
  assert.deepEqual(comparisons.buildPublishedComparisonSlugsFromModels([
    model('fixture-alpha', 'fixture-beta'),
    model('fixture-beta', 'fixture-alpha'),
  ], () => false), []);
});

test('LLMS accepts a registry-derived projection while the real output stays P0-free', () => {
  const realProjection = llms.buildLlmsModelDiscoveryProjection();
  const realText = llms.buildLlmsText(mcpPublication, realProjection);
  for (const id of P0_IDS) assert.doesNotMatch(realText, new RegExp(`/models/${id}(?:\\)|$)`));
  assert.match(realText, /LTX 2\.3 Pro \(previous generation\)/);
  assert.match(realText, /Wan 2\.6 \(previous generation\)/);

  const fixtureProjection = llms.buildLlmsModelDiscoveryProjection({
    models: publishedFixture(),
    families: buildModelFamilyDefinitions(publishedFixture(), readinessFixture()),
    catalog: publishedFalEntries().map((entry) => ({ engineId: entry.id, modelSlug: entry.modelSlug, marketingName: entry.marketingName })),
    primaryComparisons: [{ slug: 'fixture-alpha-vs-fixture-beta', label: 'Fixture Alpha vs Fixture Beta' }],
  });
  const fixtureText = llms.buildLlmsText(mcpPublication, fixtureProjection);
  for (const id of P0_IDS) {
    assert.equal(fixtureText.split(`](https://maxvideoai.com/models/${id})`).length - 1, 1, id);
  }
  for (const family of ['ltx', 'wan', 'grok', 'flux']) {
    assert.equal(fixtureText.split(`/examples/${family}`).length - 1, 1, family);
  }
  assert.equal(fixtureText.split('/ai-video-engines/fixture-alpha-vs-fixture-beta').length - 1, 1);
  for (const id of DEEP_LEGACY_IDS) assert.doesNotMatch(fixtureText, new RegExp(`/models/${id}(?:\\)|$)`));
});
