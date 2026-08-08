import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { parseModelDecisionContent } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-content.ts';
import { parseModelExamplesContent } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-examples-content.ts';
import { parseModelPromptingContent } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prompting-content.ts';
import {
  getModelPageTemplateConfig,
  isPrelaunchModelPageTemplateSlug,
} from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-registry.ts';

const slug = 'minimax-h3';
const locales = ['en', 'fr', 'es'] as const;

const expected = {
  en: {
    cta: 'Generate with MiniMax H3',
    examplesHref: '/examples/minimax-h3',
    compareHref: '/ai-video-engines/kling-o3-pro-vs-minimax-h3?order=minimax-h3',
    pricingHref: '/pricing#minimax-h3-pricing',
  },
  fr: {
    cta: 'Générer avec MiniMax H3',
    examplesHref: '/fr/galerie/minimax-h3',
    compareHref: '/fr/comparatif/kling-o3-pro-vs-minimax-h3?order=minimax-h3',
    pricingHref: '/fr/tarifs#minimax-h3-pricing',
  },
  es: {
    cta: 'Generar con MiniMax H3',
    examplesHref: '/es/galeria/minimax-h3',
    compareHref: '/es/comparativa/kling-o3-pro-vs-minimax-h3?order=minimax-h3',
    pricingHref: '/es/precios#minimax-h3-pricing',
  },
} as const;

test('MiniMax H3 uses a visible production model-page template with all three workflows', () => {
  const template = getModelPageTemplateConfig(slug);
  assert.ok(template);
  assert.equal(template.intent, 'production');
  assert.equal(isPrelaunchModelPageTemplateSlug(slug), false);
  assert.equal(template.hero.primaryCtaHref, '/app?engine=minimax-h3');
  assert.equal(template.hero.secondaryCtaHref, '/examples/minimax-h3');
  assert.equal(template.pricing.enabled, true);
  assert.deepEqual(
    template.pricing.presets.map((preset) => preset.id),
    ['5s-768p-text', '10s-2k-image', '15s-4k-reference', '9-reference-images'],
  );
  assert.deepEqual(
    template.pricing.presets.slice(0, 3).map((preset) => 'mode' in preset ? preset.mode : null),
    ['t2v', 'i2v', 'ref2v'],
  );
  assert.ok(Object.values(template.sections).every(Boolean));
});
test('MiniMax H3 ships complete localized conversion content without rollout disclaimers', () => {
  for (const locale of locales) {
    const path = `content/models/${locale}/${slug}.json`;
    const source = readFileSync(path, 'utf8');
    const document = JSON.parse(source) as {
      seo: { title: string; description: string; image?: string };
      hero: { ctaPrimary: { label: string; href: string } };
      decision?: unknown;
      prompting?: unknown;
      examples?: unknown;
    };
    const decision = parseModelDecisionContent(document.decision, slug, locale, `${path}#decision`);
    const prompting = parseModelPromptingContent(document.prompting, slug, locale, `${path}#prompting`);
    const examples = parseModelExamplesContent(document.examples, slug, locale, `${path}#examples`);
    const copy = expected[locale];

    assert.equal(document.hero.ctaPrimary.label, copy.cta);
    assert.equal(document.hero.ctaPrimary.href, '/app?engine=minimax-h3');
    assert.equal(document.seo.image, '/models/minimax-h3-launch.jpg');
    assert.equal(decision.hero.primaryCta.label, copy.cta);
    assert.equal(decision.hero.primaryCta.href, '/app?engine=minimax-h3');
    assert.equal(decision.hero.secondaryCta.href, copy.examplesHref);
    assert.equal(decision.hero.quickLinks[0]?.href, copy.compareHref);
    assert.equal(decision.hero.quickLinks[1]?.href, copy.pricingHref);
    assert.equal(decision.hero.quickLinks[2]?.href, '#prompting');
    assert.equal(prompting.modelSlug, slug);
    assert.equal(examples.modelSlug, slug);
    assert.equal(examples.showWhenEmpty, false);
    assert.ok(decision.features.length >= 4);
    assert.ok(decision.referenceWorkflows.length >= 3);
    assert.match(source, /768P/);
    assert.match(source, /2K/);
    assert.match(source, /4K/);
    assert.match(source, /24 FPS/);
    assert.match(source, /5.{0,3}15/);
    assert.match(source, /9/);
    assert.match(source, /3/);
    assert.doesNotMatch(source, /pre-?launch|rollout|waitlist|coming soon|provisional|estimated|disclaimer/i);
  }
});
