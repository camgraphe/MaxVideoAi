import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { listFalEngines } from '../frontend/src/config/falEngines.ts';
import { buildModelDecisionData } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-data.ts';
import { buildModelSchemaPayloads } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-schema-payloads.ts';

const MIGRATED_TEMPLATE_SLUGS = [
  'seedance-2-0',
  'seedance-2-0-fast',
  'ltx-2-3-fast',
  'veo-3-1',
  'kling-3-pro',
  'seedream',
] as const;

const LOCALES = ['en', 'fr', 'es'] as const;
const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function getEngine(slug: (typeof MIGRATED_TEMPLATE_SLUGS)[number]) {
  const engine = listFalEngines().find((candidate) => candidate.id === slug);
  assert.ok(engine, `Missing engine ${slug}`);
  return engine;
}

function visibleDecisionText(decision: NonNullable<ReturnType<typeof buildModelDecisionData>>) {
  return JSON.stringify(
    {
      decisionCards: decision.decisionCards,
      features: decision.features,
      hero: decision.hero,
      media: decision.media,
      meta: decision.meta,
      pricing: decision.pricing,
      referenceWorkflows: decision.referenceWorkflows,
    },
    null,
    2
  );
}

function assertNonEmptyString(value: string, label: string) {
  assert.equal(typeof value, 'string', `${label} should be a string`);
  assert.ok(value.trim().length > 0, `${label} should not be empty`);
}

test('migrated model templates provide complete localized decision data', () => {
  for (const slug of MIGRATED_TEMPLATE_SLUGS) {
    const engine = getEngine(slug);
    const en = buildModelDecisionData({ engine, locale: 'en' });
    assert.ok(en, `${slug}/en decision data should exist`);

    for (const locale of LOCALES) {
      const decision = buildModelDecisionData({ engine, locale });
      assert.ok(decision, `${slug}/${locale} decision data should exist`);

      assertNonEmptyString(decision.meta.title, `${slug}/${locale} meta title`);
      assertNonEmptyString(decision.meta.description, `${slug}/${locale} meta description`);
      assertNonEmptyString(decision.hero.subtitle, `${slug}/${locale} hero subtitle`);
      assertNonEmptyString(decision.hero.primaryCta.label, `${slug}/${locale} primary CTA label`);
      assertNonEmptyString(decision.hero.primaryCta.href, `${slug}/${locale} primary CTA href`);
      assertNonEmptyString(decision.hero.secondaryCta.label, `${slug}/${locale} secondary CTA label`);
      assertNonEmptyString(decision.hero.secondaryCta.href, `${slug}/${locale} secondary CTA href`);

      assert.ok(decision.features.length > 0, `${slug}/${locale} should have features`);
      assert.ok(decision.decisionCards.length > 0, `${slug}/${locale} should have decision cards`);
      assert.ok(decision.referenceWorkflows.length > 0, `${slug}/${locale} should have reference workflows`);
      assert.ok(
        decision.hero.subtitleHighlights.length > 0,
        `${slug}/${locale} should have hero subtitle highlights`
      );

      for (const [index, highlight] of decision.hero.subtitleHighlights.entries()) {
        assert.ok(
          decision.hero.subtitle.toLocaleLowerCase(locale).includes(highlight.toLocaleLowerCase(locale)),
          `${slug}/${locale} subtitle highlight ${index + 1} should appear in the localized subtitle`
        );
      }

      assert.ok(
        decision.features.every((feature) => feature.title.trim().length > 0 && feature.body.trim().length > 0),
        `${slug}/${locale} features should have visible title and body copy`
      );
      assert.ok(
        decision.decisionCards.every(
          (card) =>
            card.title.trim().length > 0 &&
            card.body.trim().length > 0 &&
            card.cta.label.trim().length > 0 &&
            card.cta.href.trim().length > 0
        ),
        `${slug}/${locale} decision cards should have visible copy and CTAs`
      );
      assert.ok(
        decision.referenceWorkflows.every(
          (workflow) => workflow.title.trim().length > 0 && workflow.body.trim().length > 0
        ),
        `${slug}/${locale} reference workflows should have visible copy`
      );

      if (locale !== 'en') {
        assert.notEqual(decision.hero.subtitle, en.hero.subtitle, `${slug}/${locale} subtitle should be localized`);
        assert.notEqual(
          decision.meta.description,
          en.meta.description,
          `${slug}/${locale} meta description should be localized`
        );
      }
    }
  }
});

test('Spanish migrated template copy avoids Spain-only second-person and device phrasing', () => {
  for (const slug of MIGRATED_TEMPLATE_SLUGS) {
    const decision = buildModelDecisionData({ engine: getEngine(slug), locale: 'es' });
    assert.ok(decision, `${slug}/es decision data should exist`);

    assert.doesNotMatch(
      visibleDecisionText(decision),
      /\b(?:ordenador|vosotros|vosotras|vuestro|vuestra|vuestros|vuestras)\b/i,
      `${slug}/es should avoid Spain-only phrasing in visible copy`
    );
  }
});

test('migrated template prompt links keep users on the Prompt Lab section', () => {
  for (const slug of MIGRATED_TEMPLATE_SLUGS) {
    for (const locale of LOCALES) {
      const decision = buildModelDecisionData({ engine: getEngine(slug), locale });
      assert.ok(decision, `${slug}/${locale} decision data should exist`);

      const promptQuickLinks = decision.hero.quickLinks.filter((link) => /prompt/i.test(link.label));
      const promptCardCtas = decision.decisionCards
        .map((card) => card.cta)
        .filter((link) => /prompt lab|prompt/i.test(link.label));

      assert.ok(promptQuickLinks.length > 0, `${slug}/${locale} should expose a prompt quick link`);
      assert.ok(promptCardCtas.length > 0, `${slug}/${locale} should expose a Prompt Lab card CTA`);
      assert.ok(
        [...promptQuickLinks, ...promptCardCtas].every((link) => link.href === '#prompting'),
        `${slug}/${locale} prompt links should stay anchored to #prompting`
      );
    }
  }
});

test('migrated localized model content avoids placeholder media copy', () => {
  for (const slug of MIGRATED_TEMPLATE_SLUGS) {
    for (const locale of LOCALES) {
      const contentPath = join(PROJECT_ROOT, 'content', 'models', locale, `${slug}.json`);
      const content = JSON.parse(readFileSync(contentPath, 'utf8')) as {
        seo?: { image?: string };
        custom?: { galleryIntro?: string };
      };
      const seoImage = content.seo?.image ?? '';
      const galleryIntro = content.custom?.galleryIntro ?? '';

      assert.doesNotMatch(
        seoImage,
        /\/assets\/placeholders\/|placeholder/i,
        `${slug}/${locale} SEO image should not point to placeholder media`
      );
      assert.doesNotMatch(
        galleryIntro,
        /placeholder/i,
        `${slug}/${locale} gallery intro should not expose branch placeholder copy`
      );
    }
  }
});

test('migrated template metadata preserves non-cannibalizing route intent', () => {
  const seedance = buildModelDecisionData({ engine: getEngine('seedance-2-0'), locale: 'en' });
  const seedanceFast = buildModelDecisionData({ engine: getEngine('seedance-2-0-fast'), locale: 'en' });
  const veo = buildModelDecisionData({ engine: getEngine('veo-3-1'), locale: 'en' });
  const kling = buildModelDecisionData({ engine: getEngine('kling-3-pro'), locale: 'en' });
  const seedream = buildModelDecisionData({ engine: getEngine('seedream'), locale: 'en' });

  assert.ok(seedance);
  assert.ok(seedanceFast);
  assert.ok(veo);
  assert.ok(kling);
  assert.ok(seedream);

  assert.equal(seedance.meta.title, 'Seedance 2.0: Pricing, Native Audio & Examples | MaxVideoAI');
  assert.equal(
    seedance.meta.description,
    'Explore Seedance 2.0 pricing, examples, native audio, multi-shot video and reference-guided workflows. Compare Seedance 2.0 vs Fast and older versions.'
  );
  assert.notEqual(seedanceFast.meta.title, seedance.meta.title);
  assert.notEqual(seedanceFast.meta.description, seedance.meta.description);

  const routeTitles = new Map([
    ['veo-3-1', veo.meta.title],
    ['kling-3-pro', kling.meta.title],
    ['seedream', seedream.meta.title],
  ]);
  assert.equal(new Set(routeTitles.values()).size, routeTitles.size, 'priority migrated title tags should be distinct');
  assert.match(veo.meta.title, /Pricing|References|Native Audio/i);
  assert.match(kling.meta.title, /Pricing|Control|15s/i);
  assert.match(seedream.meta.title, /Image Pricing|Reference Prep/i);
});

test('migrated template visible copy avoids route cannibalization claims', () => {
  const seedanceFast = buildModelDecisionData({ engine: getEngine('seedance-2-0-fast'), locale: 'en' });
  const seedance = buildModelDecisionData({ engine: getEngine('seedance-2-0'), locale: 'en' });
  const ltxFast = buildModelDecisionData({ engine: getEngine('ltx-2-3-fast'), locale: 'en' });

  assert.ok(seedanceFast);
  assert.ok(seedance);
  assert.ok(ltxFast);

  assert.doesNotMatch(
    visibleDecisionText(seedanceFast),
    /final-quality|native audio|polished ads|current (?:seedance )?production route/i
  );
  assert.match(visibleDecisionText(seedance), /current Seedance production route/i);
  assert.match(visibleDecisionText(seedance), /native audio/i);
  assert.match(visibleDecisionText(seedance), /multi-shot/i);
  assert.doesNotMatch(visibleDecisionText(ltxFast), /audio-to-video|retake|extend/i);

  for (const locale of LOCALES) {
    const veo = buildModelDecisionData({ engine: getEngine('veo-3-1'), locale });
    const kling = buildModelDecisionData({ engine: getEngine('kling-3-pro'), locale });
    const seedream = buildModelDecisionData({ engine: getEngine('seedream'), locale });

    assert.ok(veo);
    assert.ok(kling);
    assert.ok(seedream);

    assert.doesNotMatch(visibleDecisionText(veo), /4K/i, `Veo 3.1 ${locale} copy should not claim 4K`);
    assert.doesNotMatch(
      visibleDecisionText(kling),
      /4K|Omni|voice IDs|Elements/i,
      `Kling 3 Pro ${locale} copy should not claim unavailable routes`
    );
    assert.doesNotMatch(
      visibleDecisionText(seedream),
      /direct video generation|generate videos|text-to-video|image-to-video/i,
      `Seedream ${locale} copy should not imply direct video generation`
    );
  }
});

test('migrated template product schemas avoid free price offers', () => {
  for (const slug of MIGRATED_TEMPLATE_SLUGS) {
    const engine = getEngine(slug);
    const decision = buildModelDecisionData({ engine, locale: 'en' });
    assert.ok(decision, `${slug}/en decision data should exist`);

    const schemas = buildModelSchemaPayloads({
      canonical: `https://maxvideoai.com/models/${slug}`,
      description: decision.meta.description,
      engine,
      heroPosterAbsolute: `https://maxvideoai.com/hero/${slug}.jpg`,
      heroTitle: decision.hero.title,
      inLanguage: 'en-US',
      localizedCanonical: `https://maxvideoai.com/models/${slug}`,
      localizedHomeUrl: 'https://maxvideoai.com/',
      localizedModelsUrl: 'https://maxvideoai.com/models',
      pageTitle: decision.meta.title,
      resolvedBreadcrumb: {
        home: 'Home',
        models: 'Models',
      },
    }) as Array<Record<string, unknown>>;

    const product = schemas.find((schema) => schema['@type'] === 'Product');

    assert.ok(product, `${slug} should emit Product schema`);
    assert.ok(!('offers' in product), `${slug} Product schema should not emit a free price offer`);
  }
});
