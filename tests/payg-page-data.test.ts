import assert from 'node:assert/strict';
import test from 'node:test';
import { getPayAsYouGoContent } from '../frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_content/index.ts';
import { buildPayAsYouGoPageData } from '../frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_lib/payg-page-data.ts';
import { buildPricingHubData } from '../frontend/app/(localized)/[locale]/(marketing)/pricing/_lib/pricingHubData.ts';

test('Pay-as-you-go data is render-ready and does not mutate content or pricing input', () => {
  const content = structuredClone(getPayAsYouGoContent('en'));
  const pricingHub = structuredClone(buildPricingHubData('en'));
  const contentBefore = structuredClone(content);
  const pricingBefore = structuredClone(pricingHub);
  const data = buildPayAsYouGoPageData({ locale: 'en', content, pricingHub });

  assert.deepEqual(content, contentBefore);
  assert.deepEqual(pricingHub, pricingBefore);
  assert.equal(data.hero.title, content.hero.title);
  assert.equal(data.workflow.items[0].icon, 'engine');
  assert.ok(data.hero.quote.previewRows.length <= 4);
  assert.ok(data.pricing.rows.every((row) => row.priceCells.every((cell) => cell.displayValue.trim())));
});

test('displayed pricing remains a live projection of the pricing hub', () => {
  const content = getPayAsYouGoContent('en');
  const pricingHub = structuredClone(buildPricingHubData('en'));
  const sourceRow = pricingHub.video.rows.find((row) => row.id === 'seedance-2-0');
  assert.ok(sourceRow);
  assert.equal(sourceRow.quotes['5s-720p'].status, 'exact');
  sourceRow.quotes['5s-720p'] = { ...sourceRow.quotes['5s-720p'], display: '$987.65' };

  const data = buildPayAsYouGoPageData({ locale: 'en', content, pricingHub });
  const cell = data.pricing.rows
    .find((row) => row.id === 'seedance-2-0')
    ?.priceCells.find((item) => item.presetId === '5s-720p');

  assert.equal(cell?.value, '$987.65');
  assert.equal(cell?.displayValue, 'Example : $987.65');
  assert.equal(cell?.renderReady, true);
  assert.equal(
    data.hero.quote.previewRows.find((row) => row.id === 'seedance-2-0')?.quoteLabel,
    '$987.65',
  );
  assert.equal(
    data.priceLookups.items.find((item) => item.id === 'seedance-2-0')?.price,
    '$987.65',
  );
  assert.equal(
    data.exampleCosts.items.find((item) => item.id === 'seedance-2-0')?.price,
    '$987.65',
  );
  assert.equal(data.hero.quote.sampleCost?.price, '$987.65');
  assert.doesNotMatch(JSON.stringify(content), /987\.65/);
});

test('live-quote status stays invisible independently of localized display prose', () => {
  const content = getPayAsYouGoContent('fr');
  const pricingHub = structuredClone(buildPricingHubData('fr'));
  const sourceRow = pricingHub.video.rows.find((row) => row.id === 'seedance-2-0');
  assert.ok(sourceRow);
  sourceRow.quotes['5s-720p'] = { status: 'live_quote', display: 'Devis en direct' };
  sourceRow.quotes['8s-1080p'] = { status: 'closest', display: '$12.34' };
  sourceRow.quotes['10s-1080p'] = { status: 'unsupported', display: '—' };

  const data = buildPayAsYouGoPageData({ locale: 'fr', content, pricingHub });
  const row = data.pricing.rows.find((candidate) => candidate.id === 'seedance-2-0');
  const liveQuoteCell = row?.priceCells.find((cell) => cell.presetId === '5s-720p');
  const closestCell = row?.priceCells.find((cell) => cell.presetId === '8s-1080p');
  const unsupportedCell = row?.priceCells.find((cell) => cell.presetId === '10s-1080p');

  assert.equal(liveQuoteCell?.value, 'Devis en direct');
  assert.equal(liveQuoteCell?.displayValue, 'Devis en direct');
  assert.equal(liveQuoteCell?.renderReady, false);
  assert.doesNotMatch(liveQuoteCell?.displayValue ?? '', /Exemple\s*:/);
  assert.equal(closestCell?.displayValue, 'Exemple : $12.34');
  assert.equal(closestCell?.renderReady, true);
  assert.equal(unsupportedCell?.displayValue, '—');
  assert.equal(unsupportedCell?.renderReady, false);
  assert.equal(
    data.hero.quote.previewRows.find((candidate) => candidate.id === 'seedance-2-0')?.quoteLabel,
    '$12.34',
  );
});

test('missing quotes preserve the current exact-locale live-quote fallback', () => {
  for (const locale of ['en', 'fr', 'es'] as const) {
    const content = getPayAsYouGoContent(locale);
    const pricingHub = structuredClone(buildPricingHubData(locale));
    const sourceRow = pricingHub.video.rows.find((row) => row.id === 'seedance-2-0');
    assert.ok(sourceRow);
    delete (sourceRow.quotes as Partial<typeof sourceRow.quotes>)['5s-720p'];

    const data = buildPayAsYouGoPageData({ locale, content, pricingHub });
    const cell = data.pricing.rows
      .find((row) => row.id === 'seedance-2-0')
      ?.priceCells.find((item) => item.presetId === '5s-720p');

    assert.equal(cell?.value, content.common.liveQuote);
    assert.equal(cell?.displayValue, content.common.liveQuote);
    assert.equal(cell?.renderReady, false);
  }
});
