import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { listFalEngines } from '../frontend/src/config/falEngines';
import { isMinimaxH3MaxRuntimeModeAvailable } from '../frontend/src/lib/minimax-h3-max';
import { buildProductSchema, resolveModelOfferAmountCents } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-schema';
import { buildSpecValues as modelSpecs } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-spec-values';
import { localizeSpecStatus } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-spec-status';
import { resolveSupported } from '../frontend/app/(localized)/[locale]/(marketing)/models/_lib/models-catalog-utils';
import { buildSpecValues as compareSpecs } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-spec-values';
import type { EngineCatalogEntry } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-types';
import { getAgentModelGuidance } from '../frontend/src/server/agent-api/model-guidance';

const specs = JSON.parse(readFileSync('data/benchmarks/engine-key-specs.v1.json', 'utf8')) as {
  specs: Array<{ modelSlug: string; keySpecs: Record<string, unknown> }>;
};
const catalog = JSON.parse(readFileSync('frontend/config/engine-catalog.json', 'utf8')) as EngineCatalogEntry[];
const h3Max = listFalEngines().find((entry) => entry.id === 'minimax-h3-max')!;
const h3 = listFalEngines().find((entry) => entry.id === 'minimax-h3')!;
const availableCapabilities = ['imageToVideo', 'firstLastFrame', 'referenceImageStyle', 'referenceVideo'] as const;

test('H3 Max public specs and comparisons expose its executable image and reference workflows', () => {
  assert.deepEqual(h3Max.engine.modes.filter(isMinimaxH3MaxRuntimeModeAvailable), ['t2v', 'i2v', 'ref2v']);
  const authored = specs.specs.find((entry) => entry.modelSlug === h3Max.modelSlug)!.keySpecs;
  const comparisons = compareSpecs(catalog.find((entry) => entry.modelSlug === h3Max.modelSlug)!, authored);
  const model = modelSpecs(h3Max, authored);
  for (const key of availableCapabilities) {
    assert.equal(resolveSupported(model[key]), true, key);
    assert.equal(resolveSupported(comparisons[key]), true, key);
    assert.doesNotMatch(localizeSpecStatus(model[key], 'fr'), /Non disponible dans MaxVideoAI actuellement/);
    assert.doesNotMatch(localizeSpecStatus(model[key], 'es'), /No disponible actualmente en MaxVideoAI/);
  }
  assert.equal(resolveSupported(model.textToVideo), true);
  assert.equal(resolveSupported(model.audioOutput), true);
  assert.equal(resolveSupported(model.nativeAudioGeneration), true);
  assert.deepEqual(h3Max.engine.resolutions, ['480P', '768P', '1080P']);
  assert.equal(h3Max.engine.maxDurationSec, 15);
  assert.ok((resolveModelOfferAmountCents(h3Max, h3Max.engine) ?? 0) > 0);

  const h3Facts = modelSpecs(h3, specs.specs.find((entry) => entry.modelSlug === h3.modelSlug)!.keySpecs);
  assert.equal(resolveSupported(h3Facts.imageToVideo), true);
  assert.match(h3Facts.referenceImageStyle, /image references/i);
  assert.ok(h3.engine.modes.includes('ref2v'));
});

test('localized H3 Max metadata and Product descriptions agree on multimodal availability', () => {
  for (const locale of ['en', 'fr', 'es'] as const) {
    const document = JSON.parse(readFileSync(`content/models/${locale}/minimax-h3-max.json`, 'utf8'));
    assert.deepEqual(document.seo, document.decision.meta);
    assert.match(JSON.stringify(document.seo), /references|références|referencias/i);
    assert.match(document.seo.description, /1080P/);
    assert.match(document.decision.hero.paragraph, /MCP/);
    assert.ok(document.decision.referenceWorkflows.length >= 3);
    assert.equal(document.examples.filters.some((filter: { id: string }) => filter.id === 'reference'), true);
    const product = buildProductSchema({
      engine: h3Max,
      canonical: `https://maxvideoai.com/${locale === 'en' ? 'models' : locale === 'fr' ? 'fr/modeles' : 'es/modelos'}/minimax-h3-max`,
      description: document.decision.meta.description,
      heroTitle: document.decision.hero.title,
      heroPosterAbsolute: 'https://maxvideoai.com/hero/showcase-minimax-h3-max-12s.webp',
      pricingEngine: h3Max.engine,
    });
    assert.ok(product?.offers);
    assert.equal(product.description, document.seo.description);
    assert.ok(Number(product.offers.price) > 0);
  }
  assert.match(h3Max.seo.description, /references/i);
  assert.match(h3Max.type!, /References/i);
  const guidance = getAgentModelGuidance(h3Max.id)!;
  assert.ok(guidance.considerations.every((value) => !value.includes('image and mixed-reference modes are not enabled')));
});
