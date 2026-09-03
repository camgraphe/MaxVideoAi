import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import type { AppLocale } from '../frontend/i18n/locales.ts';
import {
  getPayAsYouGoContent,
} from '../frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_content/index.ts';
import {
  buildPayAsYouGoPageData,
} from '../frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_lib/payg-page-data.ts';
import {
  buildPricingHubData,
  buildVideoPricingRowsFromEntries,
} from '../frontend/app/(localized)/[locale]/(marketing)/pricing/_lib/pricingHubData.ts';
import { listFalEngines, type FalEngineEntry } from '../frontend/src/config/falEngines.ts';

const P0_IDS = [
  'ltx-2-5-pro',
  'ltx-2-5-fast',
  'wan-3-prime',
  'wan-3',
  'grok-imagine-video-1-5',
  'flux-3',
  'flux-3-draft',
] as const;
const P0_ID_SET = new Set<string>(P0_IDS);
const DEEP_LEGACY_IDS = ['ltx-2', 'ltx-2-fast', 'wan-2-5'] as const;
const P0_REPRESENTATIVE_IDS = [
  'ltx-2-5-pro',
  'wan-3-prime',
  'grok-imagine-video-1-5',
  'flux-3',
] as const;
const entries = listFalEngines();

function publishedP0Entries(): FalEngineEntry[] {
  return entries.map((entry) => {
    if (!P0_ID_SET.has(entry.id)) return structuredClone(entry);
    return {
      ...structuredClone(entry),
      surfaces: {
        ...structuredClone(entry.surfaces),
        modelPage: {
          ...entry.surfaces.modelPage,
          indexable: true,
        },
        pricing: {
          ...entry.surfaces.pricing,
          includeInEstimator: true,
        },
      },
    };
  });
}

function pricingHubWithEntries(locale: AppLocale, sourceEntries: FalEngineEntry[]) {
  const hub = structuredClone(buildPricingHubData(locale));
  hub.video.rows = buildVideoPricingRowsFromEntries(sourceEntries, locale);
  return hub;
}

function p0IdsIn(values: readonly { id: string }[]) {
  return values.map((value) => value.id).filter((id) => P0_ID_SET.has(id));
}

test('pricing discovery is controlled only by lifecycle and pricing publication', () => {
  const publicRows = buildVideoPricingRowsFromEntries(entries, 'en');
  const visibleRows = buildVideoPricingRowsFromEntries(publishedP0Entries(), 'en');

  assert.deepEqual([...p0IdsIn(publicRows)].sort(), [...P0_IDS].sort());
  assert.deepEqual(
    P0_IDS.filter((id) => visibleRows.some((row) => row.id === id)),
    P0_IDS,
  );
  assert.deepEqual(
    DEEP_LEGACY_IDS.filter((id) => publicRows.some((row) => row.id === id)),
    [],
  );

  const deepLegacyWithEveryDiscoverySurface = entries.map((entry) => {
    if (!DEEP_LEGACY_IDS.includes(entry.id as (typeof DEEP_LEGACY_IDS)[number])) return entry;
    return {
      ...structuredClone(entry),
      surfaces: {
        ...structuredClone(entry.surfaces),
        modelPage: { ...entry.surfaces.modelPage, indexable: true },
        compare: { ...entry.surfaces.compare, includeInHub: true },
        app: { ...entry.surfaces.app, enabled: true },
        pricing: { ...entry.surfaces.pricing, includeInEstimator: true },
      },
    };
  });
  assert.deepEqual(
    DEEP_LEGACY_IDS.filter((id) =>
      buildVideoPricingRowsFromEntries(deepLegacyWithEveryDiscoverySurface, 'en')
        .some((row) => row.id === id)),
    [],
  );
});

test('visible pricing fixtures keep current family variants before legacy history', () => {
  const rows = buildVideoPricingRowsFromEntries(publishedP0Entries(), 'en');
  const reversedRows = buildVideoPricingRowsFromEntries(publishedP0Entries().reverse(), 'en');
  const idsByFamily = (family: string) => rows.filter((row) => row.family === family).map((row) => row.id);

  assert.deepEqual(
    reversedRows.map((row) => row.id),
    rows.map((row) => row.id),
    'pricing order must not depend on registry input order',
  );

  assert.deepEqual(idsByFamily('ltx'), [
    'ltx-2-5-pro',
    'ltx-2-5-fast',
    'ltx-2-3',
    'ltx-2-3-fast',
  ]);
  assert.deepEqual(idsByFamily('wan'), ['wan-3-prime', 'wan-3', 'wan-2-6']);
  assert.deepEqual(idsByFamily('grok'), ['grok-imagine-video-1-5']);
  assert.deepEqual(idsByFamily('flux'), ['flux-3', 'flux-3-draft']);

  for (const id of ['ltx-2-3', 'ltx-2-3-fast', 'wan-2-6']) {
    assert.equal(rows.find((row) => row.id === id)?.pricingGroup, 'legacy');
  }
  for (const id of P0_IDS) {
    assert.equal(rows.find((row) => row.id === id)?.pricingGroup, 'recommended');
  }
});

test('P0 pricing rows derive canonical anchors and locale-aware model links', () => {
  const expectedPrefixes: Record<AppLocale, string> = {
    en: '/models/',
    fr: '/fr/modeles/',
    es: '/es/modelos/',
  };

  for (const locale of ['en', 'fr', 'es'] as const) {
    const rows = buildVideoPricingRowsFromEntries(publishedP0Entries(), locale);
    for (const id of P0_IDS) {
      const row = rows.find((candidate) => candidate.id === id);
      assert.ok(row, `${locale}:${id}`);
      assert.equal(row.anchorId, `${id}-pricing`, `${locale}:${id}:anchor`);
      assert.equal(row.modelHref, `${expectedPrefixes[locale]}${id}`, `${locale}:${id}:model`);
      assert.ok(
        row.links.some((link) => link.href === `${expectedPrefixes[locale]}${id}`),
        `${locale}:${id}:model-link`,
      );
      assert.ok(
        Object.values(row.quotes).some((quote) => quote.status === 'exact'),
        `${locale}:${id}:canonical-quote`,
      );
    }
  }
});

test('published P0 representatives and pricing data project consistently into PAYG', () => {
  for (const locale of ['en', 'fr', 'es'] as const) {
    const content = getPayAsYouGoContent(locale);
    const data = buildPayAsYouGoPageData({ locale, content });
    assert.deepEqual(p0IdsIn(data.pricing.rows), P0_REPRESENTATIVE_IDS, `${locale}:pricing`);
    assert.deepEqual(p0IdsIn(data.hero.quote.previewRows), P0_REPRESENTATIVE_IDS, `${locale}:hero`);
    assert.deepEqual(p0IdsIn(data.modelTesting.items), P0_IDS, `${locale}:models`);
    assert.deepEqual(p0IdsIn(data.priceLookups.items), P0_IDS, `${locale}:lookups`);
    assert.deepEqual(p0IdsIn(data.exampleCosts.items), P0_REPRESENTATIVE_IDS, `${locale}:examples`);
    for (const id of P0_REPRESENTATIVE_IDS) {
      assert.match(
        data.pricing.rows.find((row) => row.id === id)?.compareHref ?? '',
        /^\/(?:fr\/comparatif|es\/comparativa|ai-video-engines)\/[a-z0-9-]+-vs-[a-z0-9-]+$/,
        `${locale}:${id}:comparison`,
      );
    }
  }
});

test('sparse PAYG data never relabels generic checks as P0 examples', () => {
  const pricingHub = structuredClone(buildPricingHubData('en'));
  const seedance = pricingHub.video.rows.find((row) => row.id === 'seedance-2-0');
  assert.ok(seedance);
  pricingHub.video.rows = [seedance];

  const data = buildPayAsYouGoPageData({
    locale: 'en',
    content: getPayAsYouGoContent('en'),
    pricingHub,
  });
  assert.deepEqual(data.exampleCosts.items.map((item) => item.id), ['seedance-2-0']);
  assert.deepEqual(p0IdsIn(data.exampleCosts.items), []);
});

test('a future PAYG config fails closed until its canonical pricing row is visible', () => {
  const futureId = 'future-video-model';
  const content = structuredClone(getPayAsYouGoContent('en')) as any;
  content.modelTesting.models[futureId] = {
    family: 'Future',
    title: 'Future Video Model',
    body: 'Future model card.',
  };
  content.priceLookups.items[futureId] = {
    query: 'How much does Future Video Model cost?',
    title: 'Future Video Model pricing',
    body: 'Future model lookup.',
  };
  content.exampleCosts.labels[futureId] = 'Future model example';

  const discoveryConfigs = {
    priceLookups: [{ id: futureId, presetId: '5s-720p' }],
    examples: [{ id: futureId, presetId: '5s-720p' }],
    supportedModels: [{ id: futureId, fallbackLabel: 'Future Video Model' }],
  };
  const hiddenPricingHub = structuredClone(buildPricingHubData('en'));
  hiddenPricingHub.video.rows = [];
  const hidden = buildPayAsYouGoPageData({
    locale: 'en',
    content,
    pricingHub: hiddenPricingHub,
    discoveryConfigs,
  } as any);

  assert.deepEqual(hidden.modelTesting.items, []);
  assert.deepEqual(hidden.priceLookups.items, []);
  assert.deepEqual(hidden.exampleCosts.items, []);
  assert.doesNotMatch(JSON.stringify({
    models: hidden.modelTesting.items,
    lookups: hidden.priceLookups.items,
    examples: hidden.exampleCosts.items,
  }), /future-video-model|pricing#video-pricing/);

  const visiblePricingHub = structuredClone(buildPricingHubData('en'));
  const visibleRow = structuredClone(visiblePricingHub.video.rows.find((row) => row.id === 'seedance-2-0'));
  assert.ok(visibleRow);
  visibleRow.id = futureId;
  visibleRow.engineName = 'Future Video Model';
  visibleRow.family = 'future';
  visibleRow.anchorId = `${futureId}-pricing`;
  visibleRow.modelHref = `/models/${futureId}`;
  visibleRow.links = [{ label: 'Future Video Model', href: `/models/${futureId}` }];
  visiblePricingHub.video.rows = [visibleRow];

  const visible = buildPayAsYouGoPageData({
    locale: 'en',
    content,
    pricingHub: visiblePricingHub,
    discoveryConfigs,
  } as any);
  assert.deepEqual(visible.modelTesting.items.map((item) => item.id), [futureId]);
  assert.deepEqual(visible.priceLookups.items.map((item) => item.id), [futureId]);
  assert.deepEqual(visible.exampleCosts.items.map((item) => item.id), [futureId]);
  assert.equal(visible.modelTesting.items[0]?.href, `/models/${futureId}`);
  assert.equal(visible.priceLookups.items[0]?.href, `/pricing#${futureId}-pricing`);
  assert.equal(visible.exampleCosts.items[0]?.href, `/pricing#${futureId}-pricing`);
});

test('explicit published model fallbacks remain available without a pricing row', () => {
  const pricingHub = structuredClone(buildPricingHubData('en'));
  pricingHub.video.rows = [];
  const data = buildPayAsYouGoPageData({
    locale: 'en',
    content: getPayAsYouGoContent('en'),
    pricingHub,
  });

  assert.deepEqual(data.priceLookups.items, []);
  assert.deepEqual(data.exampleCosts.items, []);
  assert.deepEqual(
    data.modelTesting.items.map((item) => item.id),
    [
      'gemini-omni-flash',
      'seedance-2-5',
      'seedance-2-0',
      'kling-3-pro',
      'veo-3-1',
      'happy-horse-1-1',
      'seedance-2-0-mini',
      'ltx-2-3-fast',
      'wan-2-6',
    ],
  );
});

test('unpublished comparison suggestions cannot leak an unknown opponent', () => {
  const entriesWithHiddenSuggestion = entries.map((entry) => entry.id === 'ltx-2-3' ? {
    ...structuredClone(entry),
    surfaces: {
      ...structuredClone(entry.surfaces),
      compare: {
        ...structuredClone(entry.surfaces.compare),
        includeInHub: true,
        suggestOpponents: ['future-video-model'],
        publishedPairs: [],
      },
    },
  } : entry);
  const ltxLegacy = buildVideoPricingRowsFromEntries(entriesWithHiddenSuggestion, 'en')
    .find((row) => row.id === 'ltx-2-3');
  assert.ok(ltxLegacy);
  assert.doesNotMatch(JSON.stringify(ltxLegacy.links), /future-video-model/);

  const pricingHub = structuredClone(buildPricingHubData('en'));
  const ltxPaygRow = pricingHub.video.rows.find((row) => row.id === 'ltx-2-3-fast');
  assert.ok(ltxPaygRow);
  ltxPaygRow.links.push({
    label: 'Compare',
    href: '/ai-video-engines/ltx-2-3-pro-vs-ltx-2-5-pro',
  });
  const data = buildPayAsYouGoPageData({
    locale: 'en',
    content: getPayAsYouGoContent('en'),
    pricingHub,
  });
  assert.equal(data.pricing.rows.find((row) => row.id === 'ltx-2-3-fast')?.compareHref, undefined);
});

test('published fixtures expose all P0 model cards and one current row per family', () => {
  for (const locale of ['en', 'fr', 'es'] as const) {
    const pricingHub = pricingHubWithEntries(locale, publishedP0Entries());
    const data = buildPayAsYouGoPageData({
      locale,
      content: getPayAsYouGoContent(locale),
      pricingHub,
    });

    assert.deepEqual(
      P0_IDS.filter((id) => data.modelTesting.items.some((item) => item.id === id)),
      P0_IDS,
    );
    assert.deepEqual(
      P0_IDS.filter((id) => data.priceLookups.items.some((item) => item.id === id)),
      P0_IDS,
    );
    assert.deepEqual(
      P0_REPRESENTATIVE_IDS.filter((id) => data.pricing.rows.some((row) => row.id === id)),
      P0_REPRESENTATIVE_IDS,
    );
    assert.deepEqual(p0IdsIn(data.hero.quote.previewRows), P0_REPRESENTATIVE_IDS);
    for (const id of P0_IDS) {
      const sourceQuote = pricingHub.video.rows.find((row) => row.id === id)?.quotes['5s-720p'];
      assert.ok(sourceQuote?.display, `${locale}:${id}:5s-source-quote`);
      assert.equal(
        data.priceLookups.items.find((item) => item.id === id)?.price,
        sourceQuote.display,
        `${locale}:${id}:lookup-quote`,
      );
    }
    for (const id of P0_REPRESENTATIVE_IDS) {
      const sourceQuote = pricingHub.video.rows.find((row) => row.id === id)?.quotes['5s-720p'];
      assert.equal(
        data.exampleCosts.items.find((item) => item.id === id)?.price,
        sourceQuote?.display,
        `${locale}:${id}:example-quote`,
      );
    }
  }
});

test('PAYG copies a P0 canonical quote instead of an authored amount', () => {
  const content = getPayAsYouGoContent('en');
  const pricingHub = pricingHubWithEntries('en', publishedP0Entries());
  const sourceRow = pricingHub.video.rows.find((row) => row.id === 'ltx-2-5-pro');
  assert.ok(sourceRow);
  sourceRow.quotes['5s-720p'] = {
    ...sourceRow.quotes['5s-720p'],
    status: 'exact',
    amountCents: 43_210,
    display: '$432.10',
  };

  const data = buildPayAsYouGoPageData({ locale: 'en', content, pricingHub });
  assert.equal(
    data.pricing.rows.find((row) => row.id === 'ltx-2-5-pro')
      ?.priceCells.find((cell) => cell.presetId === '5s-720p')?.value,
    '$432.10',
  );
  assert.equal(
    data.priceLookups.items.find((item) => item.id === 'ltx-2-5-pro')?.price,
    '$432.10',
  );
  assert.equal(
    data.exampleCosts.items.find((item) => item.id === 'ltx-2-5-pro')?.price,
    '$432.10',
  );
  assert.equal(
    data.hero.quote.previewRows.find((row) => row.id === 'ltx-2-5-pro')?.quoteLabel,
    '$432.10',
  );
  assert.doesNotMatch(JSON.stringify(content), /432\.10/);
});

test('P0 discovery config and localized content own no finished price or rate', () => {
  const root = process.cwd();
  const pricingSource = readFileSync(join(
    root,
    'frontend/app/(localized)/[locale]/(marketing)/pricing/_lib/pricingHubData.ts',
  ), 'utf8');
  const paygDataSource = readFileSync(join(
    root,
    'frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_lib/payg-page-data.ts',
  ), 'utf8');
  const localeSource = ['en', 'fr', 'es'].map((locale) => readFileSync(join(
    root,
    `frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_content/${locale}.ts`,
  ), 'utf8')).join('\n');
  const jsonLdSource = readFileSync(join(
    root,
    'frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_lib/payg-jsonld.ts',
  ), 'utf8');

  for (const source of [pricingSource, paygDataSource, localeSource]) {
    assert.doesNotMatch(source, /P0_[A-Z_]*(?:PRICE|RATE)|p0Price|p0Rate/i);
  }
  assert.doesNotMatch(paygDataSource, /(?:amount|total|rate)Cents\s*:/);
  assert.doesNotMatch(localeSource, /\$(?:0|[1-9]\d*\.\d)|\b\d+(?:\.\d+)?\s*cents?\b/i);
  assert.equal((jsonLdSource.match(/price: '10\.00'/g) ?? []).length, 2);
  assert.doesNotMatch(jsonLdSource, /ltx-2-5|wan-3|grok-imagine-video-1-5|flux-3/);
});
