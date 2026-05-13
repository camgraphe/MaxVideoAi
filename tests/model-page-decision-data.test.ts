import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildModelDecisionData,
  buildModelDecisionPricingScenarios,
} from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-data.ts';
import { getModelPageTemplateConfig } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-registry.ts';
import { buildDecisionTocItems } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-toc.ts';
import { normalizeMediaUrl } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-media.ts';
import { buildModelSchemaPayloads } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-schema-payloads.ts';
import { resolveSectionLabels } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-specs.ts';
import { listFalEngines } from '../frontend/src/config/falEngines.ts';

function getEngine(engineId: string) {
  const entry = listFalEngines().find((candidate) => candidate.id === engineId);
  assert.ok(entry, `Missing engine ${engineId}`);
  return entry;
}

test('Seedance 2.0 decision data returns localized hero, links, features, cards, and metadata', () => {
  const seedance = getEngine('seedance-2-0');
  const en = buildModelDecisionData({ engine: seedance, locale: 'en' });
  const fr = buildModelDecisionData({ engine: seedance, locale: 'fr' });
  const es = buildModelDecisionData({ engine: seedance, locale: 'es' });

  assert.ok(en);
  assert.ok(fr);
  assert.ok(es);

  assert.equal(en.hero.title, 'Seedance 2.0');
  assert.match(en.hero.subtitle, /Native audio/);
  assert.match(en.hero.subtitle, /multi-shot continuity/);
  assert.match(en.hero.subtitle, /reference-guided video/);
  assert.ok(en.hero.paragraph.split(/\s+/).filter(Boolean).length <= 55);
  assert.deepEqual(en.hero.primaryCta, {
    label: 'Generate with Seedance 2.0',
    href: '/app?engine=seedance-2-0',
  });
  assert.equal(en.hero.secondaryCta.label, 'View examples');
  assert.equal(en.hero.secondaryCta.href, '/examples/seedance');
  assert.deepEqual(
    en.hero.quickLinks.map((link) => link.label),
    ['Compare vs Fast', 'View pricing', 'Prompt examples']
  );
  assert.deepEqual(
    en.pricing.scenarios.map((scenario) => scenario.id),
    ['5s-480p', '8s-720p', '10s-1080p', 'audio-included', 'max-duration']
  );
  assert.equal(en.hero.quickLinks[2]?.href, '#prompting');
  assert.equal(en.decisionCards[2]?.cta.href, '#prompting');
  assert.equal(fr.media.badges[0], 'Audio activé');
  assert.equal(es.media.badges[0], 'Audio activado');
  assert.match(fr.hero.subtitle, /continuité multi-plans/);
  assert.match(fr.hero.primaryCta.label, /Générer/);
  assert.match(es.hero.subtitle, /continuidad entre tomas/);
  assert.match(es.media.renderLabel, /resultado/);
  assert.equal(en.features.length, 6);
  assert.deepEqual(
    en.decisionCards.map((card) => card.title),
    ['Seedance 2.0 or Fast?', 'Upgrading from Seedance 1.5?', 'Need prompt examples?']
  );
  assert.deepEqual(
    en.referenceWorkflows.map((workflow) => workflow.title),
    ['Text prompt', 'Image reference', 'Video reference', 'Audio reference', 'Continuity anchors']
  );
  assert.equal(en.referenceWorkflows.length, 5);
  assert.equal(fr.referenceWorkflows.length, 5);
  assert.equal(es.referenceWorkflows.length, 5);
  assert.ok(fr.referenceWorkflows.every((workflow) => workflow.title.trim().length > 0));
  assert.ok(es.referenceWorkflows.every((workflow) => workflow.title.trim().length > 0));
  assert.notDeepEqual(
    fr.referenceWorkflows.map((workflow) => workflow.title),
    en.referenceWorkflows.map((workflow) => workflow.title)
  );
  assert.notDeepEqual(
    es.referenceWorkflows.map((workflow) => workflow.title),
    en.referenceWorkflows.map((workflow) => workflow.title)
  );
  assert.equal(en.meta.title, 'Seedance 2.0: Pricing, Native Audio & Examples | MaxVideoAI');
  assert.equal(
    en.meta.description,
    'Explore Seedance 2.0 pricing, examples, native audio, multi-shot video and reference-guided workflows. Compare Seedance 2.0 vs Fast and older versions.'
  );
  assert.notEqual(fr.hero.subtitle, en.hero.subtitle);
  assert.notEqual(es.hero.subtitle, en.hero.subtitle);
  assert.doesNotMatch(fr.hero.subtitle, /Native audio/);
  assert.doesNotMatch(es.hero.subtitle, /Native audio/);
});

test('Seedance 2.0 Fast does not return decision data', () => {
  const fast = getEngine('seedance-2-0-fast');

  assert.equal(buildModelDecisionData({ engine: fast, locale: 'en' }), null);
});

test('Seedance 2.0 decision pricing scenarios reuse pricing page quotes', () => {
  const seedance = getEngine('seedance-2-0');
  const template = getModelPageTemplateConfig('seedance-2-0');
  assert.ok(template);

  const scenarios = buildModelDecisionPricingScenarios(seedance, 'en', template.pricing.presets);

  assert.deepEqual(
    scenarios.map((scenario) => scenario.id),
    ['5s-480p', '8s-720p', '10s-1080p', 'audio-included', 'max-duration']
  );
  assert.deepEqual(
    scenarios.map((scenario) => scenario.value),
    ['$0.88', '$3.15', '$8.84', '$0 extra', '15s']
  );
  assert.deepEqual(
    scenarios.map((scenario) => scenario.label),
    ['Entry draft', 'Standard preview', 'Common production check', 'Audio', 'Max duration']
  );
  assert.match(scenarios[3]?.note ?? '', /Native audio included/);
  assert.match(scenarios.at(-1)?.note ?? '', /1080p/);
});

test('Seedance 2.0 decision TOC labels the specs anchor accurately', () => {
  const items = buildDecisionTocItems({
    locale: 'en',
    sectionLabels: resolveSectionLabels('en'),
    textAnchorId: 'text-to-video',
    imageAnchorId: 'prompting',
    compareAnchorId: 'compare',
    hasExamples: true,
    hasSpecs: true,
    hasTextSection: true,
    hasTipsSection: true,
    hasCompareSection: true,
    hasSafetySection: true,
    hasFaqSection: true,
  });

  assert.deepEqual(
    items.map((item) => [item.id, item.label]),
    [
      ['decision-pricing', 'Pricing'],
      ['text-to-video', 'Examples'],
      ['prompting', 'Prompting'],
      ['tips', 'Tips'],
      ['compare', 'Compare'],
      ['specs', 'Specs'],
      ['safety', 'Safety'],
      ['faq', 'FAQ'],
    ]
  );
});

test('model page media helper rejects broken placeholder media URLs', () => {
  assert.equal(normalizeMediaUrl('image'), null);
  assert.equal(normalizeMediaUrl(' video '), null);
  assert.equal(normalizeMediaUrl('https://media.maxvideoai.com/thumb.webp'), 'https://media.maxvideoai.com/thumb.webp');
  assert.equal(normalizeMediaUrl('/hero/seedance-2-0.jpg'), '/hero/seedance-2-0.jpg');
});

test('Seedance 2.0 schema can use decision metadata without a free price offer', () => {
  const seedance = getEngine('seedance-2-0');
  const decision = buildModelDecisionData({ engine: seedance, locale: 'en' });
  assert.ok(decision);

  const schemas = buildModelSchemaPayloads({
    canonical: 'https://maxvideoai.com/models/seedance-2-0',
    description: decision.meta.description,
    engine: seedance,
    heroPosterAbsolute: 'https://maxvideoai.com/hero/seedance-2-0.jpg',
    heroTitle: decision.hero.title,
    inLanguage: 'en-US',
    localizedCanonical: 'https://maxvideoai.com/models/seedance-2-0',
    localizedHomeUrl: 'https://maxvideoai.com/',
    localizedModelsUrl: 'https://maxvideoai.com/models',
    pageTitle: decision.meta.title,
    resolvedBreadcrumb: {
      home: 'Home',
      models: 'Models',
    },
  }) as Array<Record<string, unknown>>;

  const webPage = schemas.find((schema) => schema['@type'] === 'WebPage');
  const product = schemas.find((schema) => schema['@type'] === 'Product');

  assert.equal(webPage?.name, decision.meta.title);
  assert.equal(webPage?.description, decision.meta.description);
  assert.equal(product?.description, decision.meta.description);
  assert.ok(product && !('offers' in product), 'variable pay-as-you-go model schema should not emit a price: 0 offer');
});
