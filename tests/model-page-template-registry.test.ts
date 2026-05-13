import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getModelPageTemplateConfig,
  listModelPageTemplateSlugs,
} from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-registry.ts';
import type { ModelPageTemplateConfig } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-types.ts';

test('model page template config separates SEO intent from shared layout slots', () => {
  const config: ModelPageTemplateConfig = {
    slug: 'example-engine',
    intent: 'production',
    hero: {
      eyebrow: 'CURRENT-GEN MODEL',
      subtitleHighlightTerms: ['Native audio'],
      primaryCtaHref: '/app?engine=example-engine',
      secondaryCtaHref: '/examples/example-engine',
      quickLinks: [{ labelKey: 'compareFast', href: '/ai-video-engines/example-vs-fast', icon: 'compare' }],
    },
    pricing: {
      anchorHref: '/pricing#example-engine-pricing',
      presets: [{ id: '10s-1080p', seconds: 10, resolution: '1080p', labelKey: 'commonProductionCheck' }],
    },
    sections: {
      examples: true,
      prompting: true,
      tips: true,
      compare: true,
      specs: true,
      safety: true,
      faq: true,
    },
  };

  assert.equal(config.intent, 'production');
  assert.equal(config.pricing.presets[0]?.seconds, 10);
  assert.equal(config.sections.prompting, true);
});

test('template registry enables Seedance production and draft model templates', () => {
  const seedance = getModelPageTemplateConfig('seedance-2-0');
  const seedanceFast = getModelPageTemplateConfig('seedance-2-0-fast');
  const ltxFast = getModelPageTemplateConfig('ltx-2-3-fast');

  assert.ok(seedance);
  assert.ok(seedanceFast);
  assert.ok(ltxFast);
  assert.equal(seedance.intent, 'production');
  assert.equal(seedanceFast.intent, 'draft');
  assert.equal(ltxFast.intent, 'draft');
  assert.equal(seedance.hero.primaryCtaHref, '/app?engine=seedance-2-0');
  assert.equal(seedanceFast.hero.primaryCtaHref, '/app?engine=seedance-2-0-fast');
  assert.equal(ltxFast.hero.primaryCtaHref, '/app?engine=ltx-2-3-fast');
  assert.equal(seedance.pricing.anchorHref, '/pricing#seedance-2-0-pricing');
  assert.equal(seedanceFast.pricing.anchorHref, '/pricing#seedance-2-0-fast-pricing');
  assert.equal(ltxFast.pricing.anchorHref, '/pricing#ltx-2-3-fast-pricing');
  assert.deepEqual(
    seedance.pricing.presets.map((preset) => preset.id),
    ['5s-480p', '8s-720p', '10s-1080p', 'audio-included', 'max-duration']
  );
  assert.deepEqual(
    seedanceFast.pricing.presets.map((preset) => preset.id),
    ['5s-480p', '8s-720p', '10s-720p', 'max-duration']
  );
  assert.deepEqual(
    ltxFast.pricing.presets.map((preset) => preset.id),
    ['10s-1080p', 'max-duration']
  );
  assert.deepEqual(listModelPageTemplateSlugs().sort(), [
    'kling-3-pro',
    'ltx-2-3-fast',
    'seedance-2-0',
    'seedance-2-0-fast',
    'seedream',
    'veo-3-1',
  ]);
});

test('Seedance template pricing presets are declarative and do not hardcode provider prices', () => {
  const seedance = getModelPageTemplateConfig('seedance-2-0');

  assert.ok(seedance);
  assert.equal(seedance.pricing.presets.some((preset) => preset.fixedValueKey === 'audioExtraValue'), true);
  assert.equal(seedance.pricing.presets.some((preset) => preset.seconds === 15 && preset.resolution === '1080p'), false);
});

test('priority production and reference-prep models have distinct template intent and routes', () => {
  const expectations = [
    ['veo-3-1', 'production', '/app?engine=veo-3-1'],
    ['kling-3-pro', 'production', '/app?engine=kling-3-pro'],
    ['seedream', 'reference-prep', '/app/image?engine=seedream'],
  ] as const;

  for (const [slug, intent, primaryCtaHref] of expectations) {
    const config = getModelPageTemplateConfig(slug);
    assert.ok(config, `${slug} should be migrated to the template`);
    assert.equal(config.intent, intent);
    assert.equal(config.hero.primaryCtaHref, primaryCtaHref);
    assert.equal(config.pricing.anchorHref, `/pricing#${slug}-pricing`);
  }
});

test('template quick links avoid redirecting compare URLs', () => {
  const veo = getModelPageTemplateConfig('veo-3-1');
  assert.ok(veo);
  assert.equal(
    veo.hero.quickLinks[0]?.href,
    '/ai-video-engines/kling-3-pro-vs-veo-3-1?order=veo-3-1'
  );
});
