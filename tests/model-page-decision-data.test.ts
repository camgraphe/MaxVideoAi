import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildModelDecisionData,
  buildModelDecisionPricingScenarios,
} from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-data.ts';
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
  assert.equal(en.hero.quickLinks[2]?.href, '#image-to-video');
  assert.equal(en.features.length, 6);
  assert.deepEqual(
    en.decisionCards.map((card) => card.title),
    ['Seedance 2.0 or Fast?', 'Upgrading from Seedance 1.5?', 'Need prompt examples?']
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

  const scenarios = buildModelDecisionPricingScenarios(seedance, 'en');

  assert.deepEqual(
    scenarios.map((scenario) => scenario.id),
    ['5s-720p', '8s-1080p', '10s-1080p', '10s-1080p-audio', 'max-duration']
  );
  assert.deepEqual(
    scenarios.map((scenario) => scenario.value),
    ['$1.97', '$7.08', '$8.84', '$8.84', '15s']
  );
  assert.match(scenarios.at(-1)?.note ?? '', /1080p/);
});
