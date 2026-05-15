import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { buildPricingHubData } from '../frontend/app/(localized)/[locale]/(marketing)/pricing/_lib/pricingHubData.ts';
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

test('pricing video engine rows expose localized model hrefs for clickable engine names', () => {
  const seedance = getRow('en', 'seedance-2-0-pricing');
  const klingFr = getRow('fr', 'kling-3-pro-pricing');
  const veoEs = getRow('es', 'veo-3-1-pricing');
  const gptImage = buildPricingHubData('en').otherSurfaces.imageRows.find((row) => row.anchorId === 'gpt-image-2-pricing');

  assert.equal(seedance?.modelHref, '/models/seedance-2-0');
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
