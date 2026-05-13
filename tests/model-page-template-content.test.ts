import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { listFalEngines } from '../frontend/src/config/falEngines.ts';
import { buildModelDecisionData } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-data.ts';
import { buildModelSchemaPayloads } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-schema-payloads.ts';
import { buildSoraCopy } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-copy.ts';

const MIGRATED_TEMPLATE_SLUGS = [
  'seedance-1-5-pro',
  'seedance-2-0',
  'seedance-2-0-fast',
  'ltx-2',
  'ltx-2-fast',
  'ltx-2-3-fast',
  'veo-3-1',
  'veo-3-1-fast',
  'veo-3-1-lite',
  'kling-2-5-turbo',
  'kling-2-6-pro',
  'kling-3-pro',
  'kling-3-standard',
  'kling-3-4k',
  'ltx-2-3-pro',
  'seedream',
  'sora-2',
  'sora-2-pro',
  'wan-2-5',
  'wan-2-6',
  'luma-ray-2',
  'luma-ray-2-flash',
  'happy-horse-1-0',
  'minimax-hailuo-02-text',
  'pika-text-to-video',
  'gpt-image-2',
  'nano-banana',
  'nano-banana-2',
  'nano-banana-pro',
] as const;

const LOCALES = ['en', 'fr', 'es'] as const;
const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function getEngine(slug: (typeof MIGRATED_TEMPLATE_SLUGS)[number]) {
  const engine = listFalEngines().find((candidate) => candidate.id === slug || candidate.modelSlug === slug);
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

test('migrated template app links use the active engine id, not only the SEO slug', () => {
  for (const slug of MIGRATED_TEMPLATE_SLUGS) {
    const engine = getEngine(slug);
    const expectedHref = `${engine.category === 'image' ? '/app/image' : '/app'}?engine=${engine.id}`;

    for (const locale of LOCALES) {
      const decision = buildModelDecisionData({ engine, locale });
      assert.ok(decision, `${slug}/${locale} decision data should exist`);
      assert.equal(decision.hero.primaryCta.href, expectedHref, `${slug}/${locale} primary CTA should use engine.id`);
    }
  }
});

test('image model prompt actions route to the image workspace', () => {
  const promptTabsSource = readFileSync(
    join(
      PROJECT_ROOT,
      'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelDecisionPromptTabs.client.tsx'
    ),
    'utf8'
  );

  assert.match(
    promptTabsSource,
    /isImageEngine\s*\?\s*'\/app\/image'\s*:\s*'\/app'/,
    'decision Prompt Lab should route image engines to /app/image'
  );
});

test('Nano Banana Pro uses image-specific pricing scenario labels', () => {
  const nanoPro = buildModelDecisionData({ engine: getEngine('nano-banana-pro'), locale: 'en' });
  assert.ok(nanoPro);

  assert.deepEqual(
    nanoPro.pricing.scenarios.map((scenario) => scenario.label),
    ['2K still', '4K still', 'Reference edit set']
  );
});

test('Nano Banana 2 uses display pricing and still-image scenario labels', () => {
  const nano2 = buildModelDecisionData({ engine: getEngine('nano-banana-2'), locale: 'en' });
  assert.ok(nano2);

  assert.deepEqual(
    nano2.pricing.scenarios.map((scenario) => [scenario.label, scenario.value]),
    [
      ['Entry draft', '$0.06'],
      ['Standard preview', '$0.11'],
      ['4K still', '$0.21'],
      ['Reference edit set', '$0.44'],
    ]
  );

  for (const locale of LOCALES) {
    const contentPath = join(PROJECT_ROOT, 'content', 'models', locale, 'nano-banana-2.json');
    const rawContent = readFileSync(contentPath, 'utf8');
    assert.doesNotMatch(rawContent, /\$0\.04|\$0\.08|\$0\.12|0,04 \$|0,08 \$|0,12 \$/);
    assert.match(rawContent, /still images only|images fixes uniquement|solo para imágenes fijas/i);
  }
});

test('migrated localized model content avoids placeholder media copy', () => {
  for (const slug of MIGRATED_TEMPLATE_SLUGS) {
    for (const locale of LOCALES) {
      const contentPath = join(PROJECT_ROOT, 'content', 'models', locale, `${slug}.json`);
      const rawContent = readFileSync(contentPath, 'utf8');
      const content = JSON.parse(rawContent) as {
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
      assert.doesNotMatch(
        rawContent,
        /<img[^>]+src=["']image["']|src=["']\s*image\s*["']/i,
        `${slug}/${locale} should not contain broken img src=image placeholders`
      );
    }
  }
});

test('shared decision sections do not hardcode Seedance identity fallbacks', () => {
  const decisionSectionPaths = [
    'ModelDecisionPromptingSection.tsx',
    'ModelDecisionTipsSection.tsx',
    'ModelDecisionSafetyFaqSection.tsx',
  ].map((file) =>
    join(
      PROJECT_ROOT,
      'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components',
      file
    )
  );
  const sharedSource = decisionSectionPaths.map((path) => readFileSync(path, 'utf8')).join('\n');

  assert.doesNotMatch(
    sharedSource,
    /Prompt Lab — Seedance 2\.0|How Seedance 2\.0 uses references|strongest results with Seedance 2\.0|responsible creation with Seedance 2\.0|engine:\s*['"]Seedance 2\.0['"]/,
    'shared decision components should derive identity fallback copy from the active model name'
  );
});

test('localized model pages do not inherit English recreate labels from base content', () => {
  const localizedContent = {
    seo: {},
    prompts: [],
    faqs: [],
    custom: {
      recreateLabel: 'Recreate this shot →',
    },
  };

  const frCopy = buildSoraCopy(localizedContent, 'example-model', 'fr');
  const esCopy = buildSoraCopy(localizedContent, 'example-model', 'es');

  assert.equal(frCopy.recreateLabel, 'Recréer ce rendu →');
  assert.equal(esCopy.recreateLabel, 'Recrear este resultado →');
});

test('migrated template metadata preserves non-cannibalizing route intent', () => {
  const seedance = buildModelDecisionData({ engine: getEngine('seedance-2-0'), locale: 'en' });
  const seedanceFast = buildModelDecisionData({ engine: getEngine('seedance-2-0-fast'), locale: 'en' });
  const seedance15 = buildModelDecisionData({ engine: getEngine('seedance-1-5-pro'), locale: 'en' });
  const veo = buildModelDecisionData({ engine: getEngine('veo-3-1'), locale: 'en' });
  const veoFast = buildModelDecisionData({ engine: getEngine('veo-3-1-fast'), locale: 'en' });
  const veoLite = buildModelDecisionData({ engine: getEngine('veo-3-1-lite'), locale: 'en' });
  const kling25 = buildModelDecisionData({ engine: getEngine('kling-2-5-turbo'), locale: 'en' });
  const kling26 = buildModelDecisionData({ engine: getEngine('kling-2-6-pro'), locale: 'en' });
  const kling = buildModelDecisionData({ engine: getEngine('kling-3-pro'), locale: 'en' });
  const klingStandard = buildModelDecisionData({ engine: getEngine('kling-3-standard'), locale: 'en' });
  const kling4k = buildModelDecisionData({ engine: getEngine('kling-3-4k'), locale: 'en' });
  const ltx2 = buildModelDecisionData({ engine: getEngine('ltx-2'), locale: 'en' });
  const ltx2Fast = buildModelDecisionData({ engine: getEngine('ltx-2-fast'), locale: 'en' });
  const ltxPro = buildModelDecisionData({ engine: getEngine('ltx-2-3-pro'), locale: 'en' });
  const seedream = buildModelDecisionData({ engine: getEngine('seedream'), locale: 'en' });
  const sora = buildModelDecisionData({ engine: getEngine('sora-2'), locale: 'en' });
  const soraPro = buildModelDecisionData({ engine: getEngine('sora-2-pro'), locale: 'en' });
  const wan25 = buildModelDecisionData({ engine: getEngine('wan-2-5'), locale: 'en' });
  const wan26 = buildModelDecisionData({ engine: getEngine('wan-2-6'), locale: 'en' });
  const luma = buildModelDecisionData({ engine: getEngine('luma-ray-2'), locale: 'en' });
  const lumaFlash = buildModelDecisionData({ engine: getEngine('luma-ray-2-flash'), locale: 'en' });
  const happyHorse = buildModelDecisionData({ engine: getEngine('happy-horse-1-0'), locale: 'en' });
  const hailuo = buildModelDecisionData({ engine: getEngine('minimax-hailuo-02-text'), locale: 'en' });
  const pika = buildModelDecisionData({ engine: getEngine('pika-text-to-video'), locale: 'en' });
  const gptImage = buildModelDecisionData({ engine: getEngine('gpt-image-2'), locale: 'en' });
  const nano = buildModelDecisionData({ engine: getEngine('nano-banana'), locale: 'en' });
  const nano2 = buildModelDecisionData({ engine: getEngine('nano-banana-2'), locale: 'en' });
  const nanoPro = buildModelDecisionData({ engine: getEngine('nano-banana-pro'), locale: 'en' });

  assert.ok(seedance);
  assert.ok(seedanceFast);
  assert.ok(seedance15);
  assert.ok(veo);
  assert.ok(veoFast);
  assert.ok(veoLite);
  assert.ok(kling25);
  assert.ok(kling26);
  assert.ok(kling);
  assert.ok(klingStandard);
  assert.ok(kling4k);
  assert.ok(ltx2);
  assert.ok(ltx2Fast);
  assert.ok(ltxPro);
  assert.ok(seedream);
  assert.ok(sora);
  assert.ok(soraPro);
  assert.ok(wan25);
  assert.ok(wan26);
  assert.ok(luma);
  assert.ok(lumaFlash);
  assert.ok(luma);
  assert.ok(lumaFlash);
  assert.ok(luma);
  assert.ok(lumaFlash);
  assert.ok(happyHorse);
  assert.ok(hailuo);
  assert.ok(pika);
  assert.ok(gptImage);
  assert.ok(nano);
  assert.ok(nano2);
  assert.ok(nanoPro);

  assert.equal(seedance.meta.title, 'Seedance 2.0: Pricing, Native Audio & Examples | MaxVideoAI');
  assert.equal(
    seedance.meta.description,
    'Explore Seedance 2.0 pricing, examples, native audio, multi-shot video and reference-guided workflows. Compare Seedance 2.0 vs Fast and older versions.'
  );
  assert.notEqual(seedanceFast.meta.title, seedance.meta.title);
  assert.notEqual(seedanceFast.meta.description, seedance.meta.description);

  const routeTitles = new Map([
    ['veo-3-1', veo.meta.title],
    ['veo-3-1-fast', veoFast.meta.title],
    ['veo-3-1-lite', veoLite.meta.title],
    ['kling-2-5-turbo', kling25.meta.title],
    ['kling-2-6-pro', kling26.meta.title],
    ['kling-3-pro', kling.meta.title],
    ['kling-3-standard', klingStandard.meta.title],
    ['kling-3-4k', kling4k.meta.title],
    ['ltx-2', ltx2.meta.title],
    ['ltx-2-fast', ltx2Fast.meta.title],
    ['ltx-2-3-pro', ltxPro.meta.title],
    ['seedream', seedream.meta.title],
    ['seedance-1-5-pro', seedance15.meta.title],
    ['sora-2', sora.meta.title],
    ['sora-2-pro', soraPro.meta.title],
    ['wan-2-5', wan25.meta.title],
    ['wan-2-6', wan26.meta.title],
    ['luma-ray-2', luma.meta.title],
    ['luma-ray-2-flash', lumaFlash.meta.title],
    ['happy-horse-1-0', happyHorse.meta.title],
    ['minimax-hailuo-02-text', hailuo.meta.title],
    ['pika-text-to-video', pika.meta.title],
    ['gpt-image-2', gptImage.meta.title],
    ['nano-banana', nano.meta.title],
    ['nano-banana-2', nano2.meta.title],
    ['nano-banana-pro', nanoPro.meta.title],
  ]);
  assert.equal(new Set(routeTitles.values()).size, routeTitles.size, 'priority migrated title tags should be distinct');
  assert.match(veo.meta.title, /Pricing|References|Native Audio/i);
  assert.match(kling25.meta.title, /Pricing|Silent Drafts/i);
  assert.match(kling26.meta.title, /Pricing|Audio|Examples/i);
  assert.match(kling.meta.title, /Pricing|Control|15s/i);
  assert.match(ltx2.meta.title, /Pricing|4K Clips/i);
  assert.match(ltx2Fast.meta.title, /Pricing|20s Drafts/i);
  assert.match(seedream.meta.title, /Image Pricing|Reference Prep/i);
  assert.match(seedance15.meta.title, /Pricing|Camera Fixed/i);
  assert.match(sora.meta.title, /Pricing|Native Audio|Examples/i);
  assert.match(soraPro.meta.title, /Pricing|1080p|Examples/i);
  assert.match(wan25.meta.title, /Pricing|Audio Drafts|Examples/i);
  assert.match(wan26.meta.title, /Pricing|References|Examples/i);
  assert.match(luma.meta.title, /Pricing|Modify|Reframe/i);
  assert.match(lumaFlash.meta.title, /Pricing|Drafts|Examples/i);
  assert.match(happyHorse.meta.title, /Pricing|Native Audio|R2V/i);
  assert.match(hailuo.meta.title, /Pricing|Motion Drafts|Examples/i);
  assert.match(pika.meta.title, /Pricing|Stylized Clips|Examples/i);
  assert.match(gptImage.meta.title, /Pricing|Text Rendering|Editing/i);
  assert.match(nano.meta.title, /Pricing|Fast Image Drafts|Edits/i);
  assert.match(nano2.meta.title, /Pricing|Grounded Images|Editing/i);
  assert.match(nanoPro.meta.title, /Pricing|4K Images|Typography/i);
  assert.notEqual(sora.meta.title, soraPro.meta.title);
  assert.notEqual(sora.meta.description, soraPro.meta.description);
  assert.notEqual(wan25.meta.title, wan26.meta.title);
  assert.notEqual(wan25.meta.description, wan26.meta.description);
  assert.notEqual(luma.meta.title, lumaFlash.meta.title);
  assert.notEqual(luma.meta.description, lumaFlash.meta.description);
});

test('migrated template visible copy avoids route cannibalization claims', () => {
  const seedanceFast = buildModelDecisionData({ engine: getEngine('seedance-2-0-fast'), locale: 'en' });
  const seedance15 = buildModelDecisionData({ engine: getEngine('seedance-1-5-pro'), locale: 'en' });
  const seedance = buildModelDecisionData({ engine: getEngine('seedance-2-0'), locale: 'en' });
  const ltx2 = buildModelDecisionData({ engine: getEngine('ltx-2'), locale: 'en' });
  const ltx2Fast = buildModelDecisionData({ engine: getEngine('ltx-2-fast'), locale: 'en' });
  const ltxFast = buildModelDecisionData({ engine: getEngine('ltx-2-3-fast'), locale: 'en' });
  const ltxPro = buildModelDecisionData({ engine: getEngine('ltx-2-3-pro'), locale: 'en' });
  const kling25 = buildModelDecisionData({ engine: getEngine('kling-2-5-turbo'), locale: 'en' });
  const kling26 = buildModelDecisionData({ engine: getEngine('kling-2-6-pro'), locale: 'en' });
  const sora = buildModelDecisionData({ engine: getEngine('sora-2'), locale: 'en' });
  const soraPro = buildModelDecisionData({ engine: getEngine('sora-2-pro'), locale: 'en' });
  const wan25 = buildModelDecisionData({ engine: getEngine('wan-2-5'), locale: 'en' });
  const wan26 = buildModelDecisionData({ engine: getEngine('wan-2-6'), locale: 'en' });
  const luma = buildModelDecisionData({ engine: getEngine('luma-ray-2'), locale: 'en' });
  const lumaFlash = buildModelDecisionData({ engine: getEngine('luma-ray-2-flash'), locale: 'en' });
  const happyHorse = buildModelDecisionData({ engine: getEngine('happy-horse-1-0'), locale: 'en' });
  const hailuo = buildModelDecisionData({ engine: getEngine('minimax-hailuo-02-text'), locale: 'en' });
  const pika = buildModelDecisionData({ engine: getEngine('pika-text-to-video'), locale: 'en' });
  const gptImage = buildModelDecisionData({ engine: getEngine('gpt-image-2'), locale: 'en' });
  const nano = buildModelDecisionData({ engine: getEngine('nano-banana'), locale: 'en' });
  const nano2 = buildModelDecisionData({ engine: getEngine('nano-banana-2'), locale: 'en' });
  const nanoPro = buildModelDecisionData({ engine: getEngine('nano-banana-pro'), locale: 'en' });

  assert.ok(seedanceFast);
  assert.ok(seedance15);
  assert.ok(seedance);
  assert.ok(ltx2);
  assert.ok(ltx2Fast);
  assert.ok(ltxFast);
  assert.ok(ltxPro);
  assert.ok(kling25);
  assert.ok(kling26);
  assert.ok(sora);
  assert.ok(soraPro);
  assert.ok(wan25);
  assert.ok(wan26);
  assert.ok(luma);
  assert.ok(lumaFlash);
  assert.ok(happyHorse);
  assert.ok(hailuo);
  assert.ok(pika);
  assert.ok(gptImage);
  assert.ok(nano);
  assert.ok(nano2);
  assert.ok(nanoPro);

  assert.doesNotMatch(
    visibleDecisionText(seedanceFast),
    /final-quality|native audio|polished ads|current (?:seedance )?production route/i
  );
  assert.match(visibleDecisionText(seedance), /current Seedance production route/i);
  assert.match(visibleDecisionText(seedance), /native audio/i);
  assert.match(visibleDecisionText(seedance), /multi-shot/i);
  assert.match(visibleDecisionText(seedance15), /older supported Seedance route|legacy-compatible/i);
  assert.match(visibleDecisionText(seedance15), /camera-fixed|seed/i);
  assert.doesNotMatch(
    visibleDecisionText(seedance15),
    /current Seedance production route|broader reference workflows/i,
    'Seedance 1.5 Pro should not cannibalize Seedance 2.0 production-route copy'
  );
  assert.doesNotMatch(visibleDecisionText(ltxFast), /audio-to-video|retake|extend/i);
  assert.match(visibleDecisionText(ltxPro), /audio-to-video|retake|extend/i);
  assert.doesNotMatch(visibleDecisionText(ltxPro), /\/app\?engine=ltx-2-3-pro/i);
  assert.match(visibleDecisionText(ltx2), /supported older Pro LTX route|16:9 clips/i);
  assert.match(visibleDecisionText(ltx2Fast), /supported older fast LTX route|20s timing checks/i);
  assert.doesNotMatch(visibleDecisionText(ltx2), /audio-to-video|retake|extend|vertical\/social|9:16/i);
  assert.doesNotMatch(visibleDecisionText(ltx2Fast), /audio-to-video|retake|extend|vertical\/social|9:16/i);
  assert.match(visibleDecisionText(kling25), /silent|look-dev|negative prompt/i);
  assert.doesNotMatch(visibleDecisionText(kling25), /native audio|Audio on|4K|Elements|15s|voice IDs/i);
  assert.match(visibleDecisionText(kling26), /supported older Kling route|native audio|1080p/i);
  assert.doesNotMatch(visibleDecisionText(kling26), /4K|Elements|15s|voice IDs/i);
  assert.doesNotMatch(
    visibleDecisionText(sora),
    /1080p delivery|higher-resolution finals|Pro route/i,
    'Sora 2 copy should not cannibalize Sora 2 Pro final-delivery intent'
  );
  assert.doesNotMatch(
    visibleDecisionText(soraPro),
    /fast 720p concept passes|faster 720p concept|idea machine/i,
    'Sora 2 Pro copy should not cannibalize Sora 2 concept-pass intent'
  );
  assert.match(visibleDecisionText(wan26), /15s multi-shot|reference-to-video/i);
  assert.match(visibleDecisionText(wan25), /Audio-ready 5-10s|prompt expansion/i);
  assert.doesNotMatch(
    wan25.hero.subtitle,
    /15s|reference-to-video/i,
    'Wan 2.5 hero should not cannibalize Wan 2.6 reference-video positioning'
  );
  assert.match(visibleDecisionText(luma), /premium|Modify|Reframe/i);
  assert.match(visibleDecisionText(lumaFlash), /draft|lower-cost|Flash/i);
  assert.doesNotMatch(
    visibleDecisionText(lumaFlash),
    /higher-confidence finals|delivery-ready Luma variants|premium cinematic generation workflow/i,
    'Luma Ray 2 Flash should not cannibalize Ray 2 premium-final positioning'
  );
  assert.doesNotMatch(
    visibleDecisionText(luma),
    /lower-cost iteration|draft speed|fast Luma drafts/i,
    'Luma Ray 2 should not cannibalize Flash draft-route positioning'
  );
  assert.match(visibleDecisionText(happyHorse), /native audio|lip-sync|R2V references|video edit/i);
  assert.doesNotMatch(
    visibleDecisionText(happyHorse),
    /silent storyboard|budget motion drafts|stylized social loops/i,
    'Happy Horse should stay audio/reference/edit-route focused'
  );
  assert.match(visibleDecisionText(hailuo), /budget motion|physics|silent|512P|768P/i);
  assert.doesNotMatch(
    visibleDecisionText(hailuo),
    /native audio|lip-sync|R2V references|seeds|negative prompts/i,
    'Hailuo 02 should stay silent budget-motion focused'
  );
  assert.match(visibleDecisionText(pika), /stylized|seeds|negative prompts|social loops|silent/i);
  assert.doesNotMatch(
    visibleDecisionText(pika),
    /native audio|lip-sync|physics-aware tests|R2V references/i,
    'Pika should stay stylized social-loop focused'
  );
  assert.match(visibleDecisionText(gptImage), /readable text|product stills|controlled edits/i);
  assert.doesNotMatch(
    visibleDecisionText(gptImage),
    /web grounding|wide aspect ratios|batch image variants|4K campaign stills/i,
    'GPT Image 2 should stay text/product/edit focused'
  );
  assert.match(visibleDecisionText(nano), /fast still drafts|reference edits|batch image variants/i);
  assert.doesNotMatch(
    visibleDecisionText(nano),
    /web grounding|typography-focused|4K campaign stills/i,
    'Nano Banana should stay fast batch-route focused'
  );
  assert.match(visibleDecisionText(nano2), /grounded image generation|wide aspect ratios|multi-reference edits/i);
  assert.doesNotMatch(
    visibleDecisionText(nano2),
    /typography-focused 4K campaign|OpenAI image generation model/i,
    'Nano Banana 2 should stay grounded image-route focused'
  );
  assert.match(visibleDecisionText(nanoPro), /4K campaign stills|typography-focused edits|multi-image references/i);
  assert.doesNotMatch(
    visibleDecisionText(nanoPro),
    /web grounding|cheap fast batches|fast still drafts/i,
    'Nano Banana Pro should stay pro campaign-route focused'
  );

  for (const locale of LOCALES) {
    const veo = buildModelDecisionData({ engine: getEngine('veo-3-1'), locale });
    const veoLite = buildModelDecisionData({ engine: getEngine('veo-3-1-lite'), locale });
    const localizedKling25 = buildModelDecisionData({ engine: getEngine('kling-2-5-turbo'), locale });
    const localizedKling26 = buildModelDecisionData({ engine: getEngine('kling-2-6-pro'), locale });
    const kling = buildModelDecisionData({ engine: getEngine('kling-3-pro'), locale });
    const klingStandard = buildModelDecisionData({ engine: getEngine('kling-3-standard'), locale });
    const kling4k = buildModelDecisionData({ engine: getEngine('kling-3-4k'), locale });
    const seedream = buildModelDecisionData({ engine: getEngine('seedream'), locale });
    const localizedSora = buildModelDecisionData({ engine: getEngine('sora-2'), locale });
    const localizedSoraPro = buildModelDecisionData({ engine: getEngine('sora-2-pro'), locale });
    const localizedWan25 = buildModelDecisionData({ engine: getEngine('wan-2-5'), locale });
    const localizedWan26 = buildModelDecisionData({ engine: getEngine('wan-2-6'), locale });
    const localizedLtx2 = buildModelDecisionData({ engine: getEngine('ltx-2'), locale });
    const localizedLtx2Fast = buildModelDecisionData({ engine: getEngine('ltx-2-fast'), locale });
    const localizedLuma = buildModelDecisionData({ engine: getEngine('luma-ray-2'), locale });
    const localizedLumaFlash = buildModelDecisionData({ engine: getEngine('luma-ray-2-flash'), locale });
    const localizedHappyHorse = buildModelDecisionData({ engine: getEngine('happy-horse-1-0'), locale });
    const localizedHailuo = buildModelDecisionData({ engine: getEngine('minimax-hailuo-02-text'), locale });
    const localizedPika = buildModelDecisionData({ engine: getEngine('pika-text-to-video'), locale });
    const localizedGptImage = buildModelDecisionData({ engine: getEngine('gpt-image-2'), locale });
    const localizedNano = buildModelDecisionData({ engine: getEngine('nano-banana'), locale });
    const localizedNano2 = buildModelDecisionData({ engine: getEngine('nano-banana-2'), locale });
    const localizedNanoPro = buildModelDecisionData({ engine: getEngine('nano-banana-pro'), locale });

    assert.ok(veo);
    assert.ok(veoLite);
    assert.ok(localizedKling25);
    assert.ok(localizedKling26);
    assert.ok(kling);
    assert.ok(klingStandard);
    assert.ok(kling4k);
    assert.ok(seedream);
    assert.ok(localizedSora);
    assert.ok(localizedSoraPro);
    assert.ok(localizedWan25);
    assert.ok(localizedWan26);
    assert.ok(localizedLtx2);
    assert.ok(localizedLtx2Fast);
    assert.ok(localizedLuma);
    assert.ok(localizedLumaFlash);
    assert.ok(localizedHappyHorse);
    assert.ok(localizedHailuo);
    assert.ok(localizedPika);
    assert.ok(localizedGptImage);
    assert.ok(localizedNano);
    assert.ok(localizedNano2);
    assert.ok(localizedNanoPro);

    assert.doesNotMatch(visibleDecisionText(veo), /4K/i, `Veo 3.1 ${locale} copy should not claim 4K`);
    assert.doesNotMatch(visibleDecisionText(veoLite), /extend/i, `Veo 3.1 Lite ${locale} copy should not claim Extend`);
    assert.doesNotMatch(
      visibleDecisionText(localizedKling25),
      /native audio|Audio on|Audio activ|Audio nativo|4K|Omni|voice IDs|Elements/i,
      `Kling 2.5 Turbo ${locale} copy should stay silent legacy draft focused`
    );
    assert.doesNotMatch(
      visibleDecisionText(localizedKling26),
      /4K|Omni|voice IDs|Elements|15s/i,
      `Kling 2.6 Pro ${locale} copy should not claim Kling 3 or unavailable routes`
    );
    assert.doesNotMatch(
      visibleDecisionText(kling),
      /4K|Omni|voice IDs|Elements/i,
      `Kling 3 Pro ${locale} copy should not claim unavailable routes`
    );
    assert.doesNotMatch(
      visibleDecisionText(klingStandard),
      /4K|Omni|voice IDs|Elements/i,
      `Kling 3 Standard ${locale} copy should not claim unavailable routes`
    );
    assert.doesNotMatch(
      visibleDecisionText(kling4k),
      /upscale|upscal/i,
      `Kling 3 4K ${locale} copy should frame native 4K without upscale language`
    );
    assert.doesNotMatch(
      visibleDecisionText(seedream),
      /direct video generation|generate videos|text-to-video|image-to-video/i,
      `Seedream ${locale} copy should not imply direct video generation`
    );
    assert.doesNotMatch(
      visibleDecisionText(localizedSora),
      /higher-resolution finals|Pro route/i,
      `Sora 2 ${locale} copy should stay 720p-focused`
    );
    assert.doesNotMatch(
      visibleDecisionText(localizedSoraPro),
      /longer AI videos|long-form/i,
      `Sora 2 Pro ${locale} copy should not claim longer or long-form output`
    );
    assert.doesNotMatch(
      localizedWan25.hero.subtitle,
      /15s|15 s|reference-to-video/i,
      `Wan 2.5 ${locale} hero should stay shorter audio-check focused`
    );
    assert.match(
      visibleDecisionText(localizedWan26),
      /15s|15 s|reference-to-video/i,
      `Wan 2.6 ${locale} copy should own the 15s/reference-video intent`
    );
    assert.doesNotMatch(
      visibleDecisionText(localizedLtx2),
      /audio-to-video|retake|extend|vertical\/social|9:16/i,
      `LTX 2 ${locale} copy should not claim current LTX 2.3 production or format capabilities`
    );
    assert.doesNotMatch(
      visibleDecisionText(localizedLtx2Fast),
      /audio-to-video|retake|extend|vertical\/social|9:16/i,
      `LTX 2 Fast ${locale} copy should not claim current LTX 2.3 fast capabilities`
    );
    assert.doesNotMatch(
      visibleDecisionText(localizedLuma),
      /audio native|audio natif|audio nativo|lower-cost iteration|iteración de menor coste/i,
      `Luma Ray 2 ${locale} copy should stay premium/edit-route focused without audio or Flash positioning`
    );
    assert.doesNotMatch(
      visibleDecisionText(localizedLumaFlash),
      /premium final|rendus finaux premium|finales premium|higher-confidence finals/i,
      `Luma Ray 2 Flash ${locale} copy should stay draft-route focused`
    );
    assert.doesNotMatch(
      visibleDecisionText(localizedHappyHorse),
      /silent storyboard|storyboard silencieux|storyboard sin audio|budget motion drafts|brouillons mouvement économiques|borradores de movimiento económicos/i,
      `Happy Horse ${locale} copy should not cannibalize Hailuo draft positioning`
    );
    assert.doesNotMatch(
      visibleDecisionText(localizedHailuo),
      /lip-sync|R2V references|références R2V|referencias R2V|seeds|negative prompts|prompts négatifs|prompts negativos/i,
      `Hailuo 02 ${locale} copy should stay budget silent-motion focused`
    );
    assert.doesNotMatch(
      visibleDecisionText(localizedPika),
      /native audio|audio natif|audio nativo|lip-sync|R2V references|références R2V|referencias R2V|physics-aware tests|tests physiques|pruebas físicas/i,
      `Pika ${locale} copy should stay stylized silent-loop focused`
    );
    assert.doesNotMatch(
      visibleDecisionText(localizedGptImage),
      /web grounding|grounding web|4K campaign stills|visuels campagne 4K|stills de campaña 4K|batch image variants|variantes en lot/i,
      `GPT Image 2 ${locale} copy should stay text/product/edit focused`
    );
    assert.doesNotMatch(
      visibleDecisionText(localizedNano),
      /web grounding|grounding web|typography-focused|typographie|tipografía|4K campaign stills|visuels campagne 4K|stills de campaña 4K/i,
      `Nano Banana ${locale} copy should stay fast batch-route focused`
    );
    assert.doesNotMatch(
      visibleDecisionText(localizedNano2),
      /typography-focused 4K campaign|retouches orientées typographie|ediciones enfocadas en tipografía|OpenAI image generation model|modèle image OpenAI|modelo de imagen OpenAI/i,
      `Nano Banana 2 ${locale} copy should stay grounded image-route focused`
    );
    assert.doesNotMatch(
      visibleDecisionText(localizedNanoPro),
      /web grounding|grounding web|cheap fast batches|fast still drafts|brouillons image rapides|borradores rápidos de imagen/i,
      `Nano Banana Pro ${locale} copy should stay pro campaign-route focused`
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
