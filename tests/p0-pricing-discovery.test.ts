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
  const hiddenRows = buildVideoPricingRowsFromEntries(entries, 'en');
  const visibleRows = buildVideoPricingRowsFromEntries(publishedP0Entries(), 'en');

  assert.deepEqual(p0IdsIn(hiddenRows), []);
  assert.deepEqual(
    P0_IDS.filter((id) => visibleRows.some((row) => row.id === id)),
    P0_IDS,
  );
  assert.deepEqual(
    DEEP_LEGACY_IDS.filter((id) => hiddenRows.some((row) => row.id === id)),
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

test('hidden P0 never leaks into any PAYG data fallback', () => {
  for (const locale of ['en', 'fr', 'es'] as const) {
    const content = getPayAsYouGoContent(locale);
    const data = buildPayAsYouGoPageData({ locale, content });
    assert.deepEqual(p0IdsIn(data.pricing.rows), [], `${locale}:pricing`);
    assert.deepEqual(p0IdsIn(data.hero.quote.previewRows), [], `${locale}:hero`);
    assert.deepEqual(p0IdsIn(data.modelTesting.items), [], `${locale}:models`);
    assert.deepEqual(p0IdsIn(data.priceLookups.items), [], `${locale}:lookups`);
    assert.deepEqual(p0IdsIn(data.exampleCosts.items), [], `${locale}:examples`);
    assert.doesNotMatch(
      JSON.stringify(data),
      /\/(?:models|modeles|modelos)\/(?:ltx-2-5|wan-3|grok-imagine-video-1-5|flux-3)/,
      `${locale}:fallback href`,
    );
    assert.doesNotMatch(
      JSON.stringify(data.pricing.rows),
      /(?:ltx-2-5|wan-3|grok-imagine-video-1-5|flux-3).*?-vs-|(?:-vs-).*?(?:ltx-2-5|wan-3|grok-imagine-video-1-5|flux-3)/,
      `${locale}:comparison`,
    );
  }
});

test('sparse PAYG data never relabels generic checks as hidden P0 examples', () => {
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

test('unpublished comparison suggestions cannot leak a hidden P0 opponent', () => {
  const entriesWithHiddenSuggestion = entries.map((entry) => entry.id === 'ltx-2-3' ? {
    ...structuredClone(entry),
    surfaces: {
      ...structuredClone(entry.surfaces),
      compare: {
        ...structuredClone(entry.surfaces.compare),
        includeInHub: true,
        suggestOpponents: ['ltx-2-5-pro'],
        publishedPairs: [],
      },
    },
  } : entry);
  const ltxLegacy = buildVideoPricingRowsFromEntries(entriesWithHiddenSuggestion, 'en')
    .find((row) => row.id === 'ltx-2-3');
  assert.ok(ltxLegacy);
  assert.doesNotMatch(JSON.stringify(ltxLegacy.links), /ltx-2-5-pro/);

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
