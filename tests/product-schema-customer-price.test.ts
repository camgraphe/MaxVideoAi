import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { listFalEngines } from '../frontend/src/config/falEngines';
import { getImagePresetQuote, getPresetQuote } from '../frontend/app/(localized)/[locale]/(marketing)/pricing/_lib/pricingHubData';
import { buildProductSchema, resolveModelOfferAmountCents } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-schema';

const matrix = JSON.parse(readFileSync('tests/fixtures/product-schema-customer-price-fix-2026-09-21.json', 'utf8'));
const engines = listFalEngines();

test('repaired model Product offers match exact public customer quotes in all locales', () => {
  for (const row of matrix.rows) {
    const engine = engines.find((entry) => entry.id === row.engineId)!;
    assert.ok(engine, row.engineId);
    assert.equal(resolveModelOfferAmountCents(engine, engine.engine), row.totalCents, row.engineId);
    for (const locale of ['en', 'fr', 'es'] as const) {
      const quote = row.mode === 't2i'
        ? getImagePresetQuote(engine, {
            id: 'controlled-schema-image', quantity: 1, resolution: row.resolution,
            quality: row.quality, mode: 't2i', referenceImageCount: 0,
          }, locale)
        : getPresetQuote(engine, {
            id: 'controlled-schema-video', label: 'Same scenario', subLabel: '',
            durationSec: row.durationSec, resolution: row.resolution, mode: row.mode, audio: row.audio,
            referenceImageCount: 0,
          }, locale);
      assert.equal(quote.status, 'exact', row.id);
      assert.equal(quote.amountCents, row.totalCents, row.id);
      const prefix = locale === 'en' ? '/models' : locale === 'fr' ? '/fr/modeles' : '/es/modelos';
      const product = buildProductSchema({ engine, pricingEngine: engine.engine,
        canonical: `https://maxvideoai.com${prefix}/${engine.modelSlug}`,
        description: 'Same model and customer scenario.', heroTitle: engine.marketingName, heroPosterAbsolute: null,
      });
      assert.equal(product?.offers?.price, (quote.amountCents! / 100).toFixed(2));
    }
  }
});

test('Seedance 2.5 keeps its already-correct customer offer', () => {
  const engine = engines.find((entry) => entry.id === 'seedance-2-5')!;
  const quote = getPresetQuote(engine, { id: 'control', label: '', subLabel: '', durationSec: 4, resolution: '480p', mode: 't2v', audio: true }, 'en');
  assert.equal(quote.status, 'exact');
  assert.equal(resolveModelOfferAmountCents(engine, engine.engine), quote.amountCents);
  assert.equal(quote.amountCents, 103);
});
