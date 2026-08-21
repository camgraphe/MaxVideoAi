import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { buildPricingHubData } from '../frontend/app/(localized)/[locale]/(marketing)/pricing/_lib/pricingHubData.ts';
import { buildPayAsYouGoPageData } from '../frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_lib/payg-page-data.ts';
import { enPayAsYouGoContent } from '../frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_content/en.ts';
import { frPayAsYouGoContent } from '../frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_content/fr.ts';
import { esPayAsYouGoContent } from '../frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_content/es.ts';
import type { AppLocale } from '../frontend/i18n/locales.ts';

const root = process.cwd();
const videoMatrixPath = join(
  root,
  'frontend/app/(localized)/[locale]/(marketing)/pricing/_components/PricingVideoMatrixSection.tsx'
);
const otherSurfacesPath = join(
  root,
  'frontend/app/(localized)/[locale]/(marketing)/pricing/_components/PricingOtherSurfacesSection.tsx'
);

function getRow(locale: AppLocale, anchorId: string) {
  return buildPricingHubData(locale).video.rows.find((row) => row.anchorId === anchorId);
}

test('pay-as-you-go model choices lead with the localized Seedance 2.5 profile', () => {
  const matrix = [
    ['en', enPayAsYouGoContent, '/models/seedance-2-5'],
    ['fr', frPayAsYouGoContent, '/fr/modeles/seedance-2-5'],
    ['es', esPayAsYouGoContent, '/es/modelos/seedance-2-5'],
  ] as const;

  for (const [locale, content, target] of matrix) {
    const data = buildPayAsYouGoPageData({ locale, content });
    assert.equal(data.modelTesting.items[0]?.id, 'seedance-2-5');
    assert.equal(data.modelTesting.items[0]?.href, target);
    assert.ok(data.modelTesting.items.some((item) => item.id === 'seedance-2-0'));
  }
});

test('pricing video engine rows expose localized model hrefs for clickable engine names', () => {
  const seedance = getRow('en', 'seedance-2-0-pricing');
  const seedanceMini = getRow('en', 'dreamina-seedance-2-0-mini-pricing');
  const klingFr = getRow('fr', 'kling-3-pro-pricing');
  const veoEs = getRow('es', 'veo-3-1-pricing');
  const gptImage = buildPricingHubData('en').otherSurfaces.imageRows.find((row) => row.anchorId === 'gpt-image-2-pricing');

  assert.equal(seedance?.modelHref, '/models/seedance-2-0');
  assert.equal(seedanceMini?.modelHref, '/models/dreamina-seedance-2-0-mini');
  assert.ok(seedanceMini?.links.some((link) => link.href === '/app?engine=seedance-2-0-mini'));
  assert.equal(klingFr?.modelHref, '/fr/modeles/kling-3-pro');
  assert.equal(veoEs?.modelHref, '/es/modelos/veo-3-1');
  assert.equal(gptImage?.modelHref, '/models/gpt-image-2');
});

test('pricing video matrix links the rendered engine identity to its model page', () => {
  const source = readFileSync(videoMatrixPath, 'utf8');

  assert.match(source, /row\.modelHref \?/);
  assert.match(source, /href=\{row\.modelHref\}/);
});

test('pricing image matrix links the rendered engine identity to its model page', () => {
  const source = readFileSync(otherSurfacesPath, 'utf8');

  assert.match(source, /row\.modelHref \?/);
  assert.match(source, /href=\{row\.modelHref\}/);
});

test('every exposed video pricing row has at least one exact visible price', () => {
  const rows = buildPricingHubData('en').video.rows;
  const missingExactPrice = rows
    .filter((row) => !Object.values(row.quotes).some((quote) => quote.status === 'exact'))
    .map((row) => row.anchorId);

  assert.deepEqual(missingExactPrice, []);
});
