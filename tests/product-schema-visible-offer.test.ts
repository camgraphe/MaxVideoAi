import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { listFalEngines } from '../frontend/src/config/falEngines';
import { buildProductSchema, resolveModelOfferAmountCents, resolveModelPublicOffer } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-schema';
import { formatModelPublicOffer } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-offer-display';
import { ModelPublicOfferLine } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelPublicOfferLine';

const engines = listFalEngines();
const matrix = JSON.parse(readFileSync('tests/fixtures/product-schema-customer-price-fix-2026-09-21.json', 'utf8'));

test('visible offer and Product consume the same price and selected scenario for every repaired model', () => {
  for (const row of matrix.rows) {
    const engine = engines.find((entry) => entry.id === row.engineId)!;
    // The frozen repair matrix predates the Sora retirement; archived models cannot sell an offer.
    if (['sora-2', 'sora-2-pro'].includes(engine.id)) {
      assert.equal(engine.surfaces.app.enabled, false);
      assert.equal(buildProductSchema({ engine, pricingEngine: engine.engine,
        canonical: `https://maxvideoai.com/models/${engine.modelSlug}`,
        description: 'Archived model', heroTitle: engine.marketingName, heroPosterAbsolute: null }), null);
      continue;
    }
    const offer = resolveModelPublicOffer(engine, engine.engine)!;
    assert.ok(offer, row.id);
    assert.equal(offer.amountCents, row.totalCents, row.id);
    assert.equal(resolveModelOfferAmountCents(engine, engine.engine), row.totalCents, row.id);
    assert.equal(offer.scenario.mode, row.mode, row.id);
    assert.equal(offer.scenario.resolution, row.resolution, row.id);
    if (row.mode === 't2v') {
      assert.equal(offer.scenario.durationSeconds, row.durationSec, row.id);
      assert.equal(offer.scenario.audio, row.audio, row.id);
    } else {
      assert.equal(offer.scenario.quantity, 1, row.id);
      if (engine.id.startsWith('gpt-image')) assert.equal(offer.scenario.quality, row.quality, row.id);
    }
    for (const locale of ['en', 'fr', 'es'] as const) {
      const display = formatModelPublicOffer(offer, locale);
      const product = buildProductSchema({ engine, pricingEngine: engine.engine, publicOffer: offer, locale,
        canonical: `https://maxvideoai.com/models/${engine.modelSlug}`, description: 'Model', heroTitle: engine.marketingName, heroPosterAbsolute: null });
      assert.equal(product?.offers?.name, display.name, row.id);
      assert.equal(product?.offers?.price, (offer.amountCents / 100).toFixed(2), row.id);
      const html = renderToStaticMarkup(React.createElement(ModelPublicOfferLine, { offer, locale }));
      assert.ok(html.includes(display.name), `${row.id}: ${locale} visible scenario`);
      assert.ok(html.includes(display.price), `${row.id}: ${locale} visible price`);
      assert.doesNotMatch(html, /JSON|schema|SEO|starting at|à partir|desde/i);
    }
  }
});

test('examples name their real options without pretending to be the lowest price', () => {
  const engine = engines.find((entry) => entry.id === 'minimax-h3-max')!;
  const offer = resolveModelPublicOffer(engine, engine.engine)!;
  assert.deepEqual(offer.scenario, { mode: 't2v', resolution: '768P', durationSeconds: 5, audio: true, quantity: 1, referenceImageCount: 0 });
  for (const [locale, expected] of [
    ['en', 'Generation example: 5 s · 768P · Text to video · Audio included'],
    ['fr', 'Exemple de génération: 5 s · 768P · Texte vers vidéo · Audio inclus'],
    ['es', 'Ejemplo de generación: 5 s · 768P · Texto a vídeo · Audio incluido'],
  ] as const) assert.equal(formatModelPublicOffer(offer, locale).name, expected);
  const luma = engines.find((entry) => entry.id === 'luma-ray-3-2')!;
  const lumaOffer = resolveModelPublicOffer(luma, luma.engine)!;
  assert.equal(lumaOffer.scenario.resolution, '540p');
  assert.equal(lumaOffer.scenario.durationSeconds, 5);
  assert.equal(lumaOffer.amountCents, 65);
  assert.match(formatModelPublicOffer(lumaOffer, 'en').name, /Silent/);
  const seed = engines.find((entry) => entry.id === 'seedance-2-5')!;
  const seedOffer = resolveModelPublicOffer(seed, seed.engine)!;
  assert.equal(seedOffer.amountCents, 103);
  assert.match(formatModelPublicOffer(seedOffer, 'en').name, /16:9/);
});

test('disabled app models have neither a purchasable Product nor a visible offer line', () => {
  for (const engine of engines.filter((entry) => !entry.surfaces.app.enabled)) {
    const offer = resolveModelPublicOffer(engine, engine.engine);
    assert.equal(offer, null, engine.id);
    assert.equal(buildProductSchema({ engine, pricingEngine: engine.engine, publicOffer: offer,
      canonical: `https://maxvideoai.com/models/${engine.modelSlug}`, description: 'Historical model', heroTitle: engine.marketingName, heroPosterAbsolute: null }), null);
    for (const locale of ['en', 'fr', 'es'] as const) {
      assert.equal(renderToStaticMarkup(React.createElement(ModelPublicOfferLine, { offer, locale })), '');
    }
  }
});

test('route passes one offer to both structured data and visible pricing, including legacy layouts', () => {
  const root = 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]';
  const layout = readFileSync(`${root}/_components/MarketingModelPageLayout.tsx`, 'utf8');
  assert.equal((layout.match(/resolveModelPublicOffer\(engine, pricingEngine\)/g) ?? []).length, 1);
  assert.match(layout, /pricingEngine, publicOffer,/);
  assert.match(layout, /ModelDecisionPricingCard[^>]*offer=\{publicOffer\}[^>]*locale=\{locale\}/);
  assert.match(layout, /!templateData \? <ModelPublicOfferLine offer=\{publicOffer\} locale=\{locale\}/);
  const card = readFileSync(`${root}/_components/ModelDecisionPricingCard.tsx`, 'utf8');
  assert.match(card, /<ModelPublicOfferLine offer=\{offer\} locale=\{locale\}/);
});
