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
import { getImagePresetQuote, getPresetQuote } from '../frontend/app/(localized)/[locale]/(marketing)/pricing/_lib/pricingHubData.ts';
import { listFalEngines } from '../frontend/src/config/falEngines.ts';

function getEngine(engineId: string) {
  const entry = listFalEngines().find((candidate) => candidate.id === engineId);
  assert.ok(entry, `Missing engine ${engineId}`);
  return entry;
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
  assert.deepEqual(en.hero.subtitleHighlights, ['Native audio', 'multi-shot continuity', 'reference-guided video']);
  assert.deepEqual(fr.hero.subtitleHighlights, ['Audio natif', 'continuité multi-plans', 'vidéo guidée par références']);
  assert.deepEqual(es.hero.subtitleHighlights, ['Audio nativo', 'continuidad entre tomas', 'video guiado por referencias']);
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

test('Seedance 2.0 Fast returns draft-intent decision data distinct from Seedance 2.0', () => {
  const seedance = getEngine('seedance-2-0');
  const fast = getEngine('seedance-2-0-fast');
  const production = buildModelDecisionData({ engine: seedance, locale: 'en' });
  const en = buildModelDecisionData({ engine: fast, locale: 'en' });
  const fr = buildModelDecisionData({ engine: fast, locale: 'fr' });
  const es = buildModelDecisionData({ engine: fast, locale: 'es' });

  assert.ok(production);
  assert.ok(en);
  assert.ok(fr);
  assert.ok(es);

  assert.equal(en.hero.title, 'Seedance 2.0 Fast');
  assert.notEqual(en.hero.subtitle, production.hero.subtitle);
  assert.notEqual(en.meta.title, production.meta.title);
  assert.notEqual(en.meta.description, production.meta.description);
  assert.match(en.hero.subtitle, /draft passes/);
  assert.match(en.hero.subtitle, /timing tests/);
  assert.match(en.hero.subtitle, /A\/B motion checks/);
  assert.doesNotMatch(en.hero.subtitle, /Native audio/);
  assert.doesNotMatch(visibleDecisionText(en), /native audio|final-quality|polished ads|cinematic branded/i);
  assert.deepEqual(en.hero.subtitleHighlights, ['draft passes', 'timing tests', 'A/B motion checks']);
  assert.match(en.hero.paragraph, /faster Seedance draft route/);
  assert.match(en.meta.description, /rapid Seedance draft passes/);
  assert.deepEqual(
    en.pricing.scenarios.map((scenario) => scenario.id),
    ['5s-480p', '8s-720p', '10s-720p', 'max-duration']
  );
  assert.match(fr.hero.subtitle, /brouillons rapides/);
  assert.deepEqual(fr.hero.subtitleHighlights, ['brouillons rapides', 'tests de rythme', 'variantes de mouvement']);
  assert.match(es.hero.subtitle, /borradores rápidos/);
  assert.deepEqual(es.hero.subtitleHighlights, ['borradores rápidos', 'pruebas de ritmo', 'variantes de movimiento']);
});

test('LTX 2.3 Fast returns LTX-specific draft decision data', () => {
  const ltx = getEngine('ltx-2-3-fast');
  const en = buildModelDecisionData({ engine: ltx, locale: 'en' });
  const fr = buildModelDecisionData({ engine: ltx, locale: 'fr' });
  const es = buildModelDecisionData({ engine: ltx, locale: 'es' });

  assert.ok(en);
  assert.ok(fr);
  assert.ok(es);

  assert.equal(en.hero.title, 'LTX 2.3 Fast');
  assert.match(en.hero.subtitle, /visual exploration/);
  assert.match(en.hero.subtitle, /prompt testing/);
  assert.match(en.hero.subtitle, /vertical\/social drafts/);
  assert.deepEqual(en.hero.subtitleHighlights, ['visual exploration', 'prompt testing', 'vertical/social drafts']);
  assert.match(en.hero.paragraph, /fast text-to-video and image-to-video/);
  assert.doesNotMatch(en.hero.subtitle, /audio-to-video|retake|extend/i);
  assert.doesNotMatch(visibleDecisionText(en), /audio-to-video|retake|extend/i);
  assert.match(en.meta.description, /fast LTX 2.3 draft loops/);
  assert.deepEqual(
    en.pricing.scenarios.map((scenario) => scenario.id),
    ['10s-1080p', 'max-duration']
  );
  assert.match(en.pricing.scenarios.at(-1)?.note ?? '', /1080p/);
  assert.doesNotMatch(en.pricing.scenarios.at(-1)?.note ?? '', /4K/i);
  assert.match(fr.hero.subtitle, /exploration visuelle/);
  assert.deepEqual(fr.hero.subtitleHighlights, ['exploration visuelle', 'tests de prompts', 'brouillons verticaux/social']);
  assert.match(es.hero.subtitle, /exploración visual/);
  assert.deepEqual(es.hero.subtitleHighlights, ['exploración visual', 'pruebas de prompts', 'borradores verticales/sociales']);
});

test('Veo 3.1 returns production decision data without unsupported 4K claims', () => {
  const veo = getEngine('veo-3-1');
  const en = buildModelDecisionData({ engine: veo, locale: 'en' });
  const fr = buildModelDecisionData({ engine: veo, locale: 'fr' });
  const es = buildModelDecisionData({ engine: veo, locale: 'es' });

  assert.ok(en);
  assert.ok(fr);
  assert.ok(es);

  assert.equal(en.hero.title, 'Veo 3.1');
  assert.match(en.hero.subtitle, /short polished/i);
  assert.match(en.hero.subtitle, /native audio/i);
  assert.match(en.hero.subtitle, /reference/i);
  assert.match(visibleDecisionText(en), /first-last|extend/i);
  assert.equal(en.hero.primaryCta.href, '/app?engine=veo-3-1');
  assert.equal(en.features[0]?.tone, 'quality');
  assert.doesNotMatch(visibleDecisionText(en), /4K/i);
  assert.doesNotMatch(visibleDecisionText(fr), /4K/i);
  assert.doesNotMatch(visibleDecisionText(es), /4K/i);
});

test('Kling 3 Pro returns production decision data without unavailable route claims', () => {
  const kling = getEngine('kling-3-pro');
  const en = buildModelDecisionData({ engine: kling, locale: 'en' });
  const fr = buildModelDecisionData({ engine: kling, locale: 'fr' });
  const es = buildModelDecisionData({ engine: kling, locale: 'es' });

  assert.ok(en);
  assert.ok(fr);
  assert.ok(es);

  assert.equal(en.hero.title, 'Kling 3 Pro');
  assert.match(visibleDecisionText(en), /storyboard/i);
  assert.match(visibleDecisionText(en), /control/i);
  assert.match(visibleDecisionText(en), /native audio/i);
  assert.match(visibleDecisionText(en), /15s|15 seconds/i);
  assert.equal(en.hero.primaryCta.href, '/app?engine=kling-3-pro');
  assert.doesNotMatch(visibleDecisionText(en), /4K|Omni|voice IDs|Elements/i);
  assert.doesNotMatch(visibleDecisionText(fr), /4K|Omni|voice IDs|Elements/i);
  assert.doesNotMatch(visibleDecisionText(es), /4K|Omni|voice IDs|Elements/i);
});

test('Kling 2.x legacy templates stay distinct from current Kling 3 routes', () => {
  const kling25 = getEngine('kling-2-5-turbo');
  const kling26 = getEngine('kling-2-6-pro');
  const en25 = buildModelDecisionData({ engine: kling25, locale: 'en' });
  const fr25 = buildModelDecisionData({ engine: kling25, locale: 'fr' });
  const es25 = buildModelDecisionData({ engine: kling25, locale: 'es' });
  const en26 = buildModelDecisionData({ engine: kling26, locale: 'en' });
  const fr26 = buildModelDecisionData({ engine: kling26, locale: 'fr' });
  const es26 = buildModelDecisionData({ engine: kling26, locale: 'es' });

  assert.ok(en25);
  assert.ok(fr25);
  assert.ok(es25);
  assert.ok(en26);
  assert.ok(fr26);
  assert.ok(es26);

  assert.equal(en25.hero.title, 'Kling 2.5 Turbo');
  assert.match(en25.hero.subtitle, /Silent 1080p drafts/);
  assert.match(visibleDecisionText(en25), /silent|look-dev|negative prompt/i);
  assert.doesNotMatch(visibleDecisionText(en25), /native audio|Audio on|4K|Elements|voice IDs|15s/i);
  assert.deepEqual(en25.hero.subtitleHighlights, [
    'Silent 1080p drafts',
    'text or image starts',
    'negative prompt control',
  ]);
  assert.equal(en25.hero.primaryCta.href, '/app?engine=kling-2-5-turbo');
  assert.equal(en25.hero.quickLinks[2]?.href, '#prompting');
  assert.equal(en25.decisionCards[2]?.cta.href, '#prompting');
  assert.match(fr25.hero.subtitle, /Drafts muets 1080p/);
  assert.match(es25.hero.subtitle, /Borradores silenciosos 1080p/);

  assert.equal(en26.hero.title, 'Kling 2.6 Pro');
  assert.match(en26.hero.subtitle, /Native audio/);
  assert.match(en26.hero.subtitle, /1080p short clips/);
  assert.match(visibleDecisionText(en26), /supported older Kling route/i);
  assert.doesNotMatch(visibleDecisionText(en26), /4K|Elements|voice IDs|15s/i);
  assert.deepEqual(en26.hero.subtitleHighlights, [
    'Native audio',
    '1080p short clips',
    'text-to-video or image-to-video',
  ]);
  assert.equal(en26.hero.primaryCta.href, '/app?engine=kling-2-6-pro');
  assert.equal(en26.hero.quickLinks[2]?.href, '#prompting');
  assert.equal(en26.decisionCards[1]?.cta.href, '#prompting');
  assert.match(fr26.hero.subtitle, /Audio natif/);
  assert.match(es26.hero.subtitle, /Audio nativo/);
});

test('Seedream returns reference-prep decision data for still preparation', () => {
  const seedream = getEngine('seedream');
  const en = buildModelDecisionData({ engine: seedream, locale: 'en' });
  const fr = buildModelDecisionData({ engine: seedream, locale: 'fr' });
  const es = buildModelDecisionData({ engine: seedream, locale: 'es' });

  assert.ok(en);
  assert.ok(fr);
  assert.ok(es);

  assert.equal(en.hero.title, 'Seedream');
  assert.equal(en.hero.primaryCta.href, '/app/image?engine=seedream');
  assert.equal(en.hero.secondaryCta.href, '/models/seedance-2-0');
  assert.match(visibleDecisionText(en), /reference prep|still/i);
  assert.match(visibleDecisionText(en), /video/i);
  assert.match(en.hero.subtitle, /reference/i);
  assert.doesNotMatch(visibleDecisionText(en), /direct video generation|generate videos|text-to-video|image-to-video/i);
  assert.doesNotMatch(visibleDecisionText(fr), /direct video generation|generate videos|text-to-video|image-to-video/i);
  assert.doesNotMatch(visibleDecisionText(es), /direct video generation|generate videos|text-to-video|image-to-video/i);
});

test('second-wave model templates return distinct decision data without overclaims', () => {
  const veoFast = buildModelDecisionData({ engine: getEngine('veo-3-1-fast'), locale: 'en' });
  const veoLite = buildModelDecisionData({ engine: getEngine('veo-3-1-lite'), locale: 'en' });
  const klingStandard = buildModelDecisionData({ engine: getEngine('kling-3-standard'), locale: 'en' });
  const kling4k = buildModelDecisionData({ engine: getEngine('kling-3-4k'), locale: 'en' });
  const ltxPro = buildModelDecisionData({ engine: getEngine('ltx-2-3'), locale: 'en' });

  assert.ok(veoFast);
  assert.ok(veoLite);
  assert.ok(klingStandard);
  assert.ok(kling4k);
  assert.ok(ltxPro);

  assert.match(visibleDecisionText(veoFast), /draft|Fast|optional audio|first-last/i);
  assert.match(visibleDecisionText(veoFast), /Extend/i);
  assert.equal(veoFast.hero.primaryCta.href, '/app?engine=veo-3-1-fast');

  assert.match(visibleDecisionText(veoLite), /lower-cost|audio included|Lite/i);
  assert.doesNotMatch(visibleDecisionText(veoLite), /Extend/i);
  assert.equal(veoLite.hero.primaryCta.href, '/app?engine=veo-3-1-lite');

  assert.match(visibleDecisionText(klingStandard), /storyboard|1080p|draft/i);
  assert.doesNotMatch(visibleDecisionText(klingStandard), /4K|Omni|voice IDs|Elements/i);
  assert.equal(klingStandard.hero.primaryCta.href, '/app?engine=kling-3-standard');

  assert.match(visibleDecisionText(kling4k), /native 4K|delivery/i);
  assert.doesNotMatch(visibleDecisionText(kling4k), /upscale|upscal/i);
  assert.equal(kling4k.hero.primaryCta.href, '/app?engine=kling-3-4k');

  assert.match(visibleDecisionText(ltxPro), /audio-to-video|Extend|Retake|4K/i);
  assert.equal(ltxPro.hero.primaryCta.href, '/app?engine=ltx-2-3');
  assert.doesNotMatch(visibleDecisionText(ltxPro), /\/app\?engine=ltx-2-3-pro/i);
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

test('migrated model pricing scenarios return configured IDs and helper values', () => {
  const expectations = [
    [
      'veo-3-1',
      ['4s-720p-audio', '6s-1080p-audio', '8s-1080p-audio', 'max-duration'],
      ['$2.08', '$3.12', '$4.16', '8s'],
    ],
    [
      'kling-3-pro',
      ['5s-1080p-audio', '10s-1080p-audio', '15s-1080p-audio', 'max-duration'],
      ['$1.10', '$2.19', '$3.28', '15s'],
    ],
    ['seedream', ['2k-image', '4k-image', 'reference-images'], ['$0.06', '$0.06', '$0.24']],
  ] as const;

  for (const [slug, expectedIds, expectedValues] of expectations) {
    const engine = getEngine(slug);
    const template = getModelPageTemplateConfig(slug);
    assert.ok(template);

    const scenarios = buildModelDecisionPricingScenarios(engine, 'en', template.pricing.presets);
    const helperValues = template.pricing.presets.map((preset) => {
      if ('imageResolution' in preset && typeof preset.imageResolution === 'string') {
        return getImagePresetQuote(
          engine,
          {
            id: preset.id,
            resolution: preset.imageResolution,
            quality: preset.imageQuality,
            quantity: preset.quantity,
          },
          'en'
        ).display;
      }

      if ('seconds' in preset && typeof preset.seconds === 'number' && typeof preset.resolution === 'string') {
        return getPresetQuote(
          engine,
          {
            id: preset.id,
            label: `${preset.seconds}s ${preset.resolution}`,
            subLabel: preset.labelKey,
            resolution: preset.resolution,
            durationSec: preset.seconds,
            audio: preset.audio ?? false,
          },
          'en'
        ).display;
      }

      if ('fixedValueKey' in preset && preset.fixedValueKey === 'maxDurationValue') {
        return `${engine.engine.pricingDetails?.maxDurationSec ?? engine.engine.maxDurationSec}s`;
      }

      return null;
    });

    assert.deepEqual(
      scenarios.map((scenario) => scenario.id),
      expectedIds
    );
    assert.deepEqual(
      scenarios.map((scenario) => scenario.value),
      helperValues
    );
    assert.deepEqual(
      scenarios.map((scenario) => scenario.value),
      expectedValues
    );
    assert.equal(scenarios.every((scenario) => scenario.value.trim().length > 0 && scenario.value !== '—'), true);
    assert.equal(scenarios.every((scenario) => scenario.label.trim().length > 0), true);
  }
});

test('second-wave model pricing scenarios reuse pricing page helper values', () => {
  const expectations = [
    ['veo-3-1-fast', ['4s-720p', '6s-720p-audio', '8s-1080p-audio', 'max-duration']],
    ['veo-3-1-lite', ['4s-720p-audio', '6s-720p-audio', '8s-1080p-audio', 'max-duration']],
    ['kling-2-5-turbo', ['5s-1080p', '10s-1080p', 'max-duration']],
    ['kling-2-6-pro', ['5s-1080p', '5s-1080p-audio', '10s-1080p-audio', 'max-duration']],
    ['kling-3-standard', ['5s-1080p', '8s-1080p-audio', '15s-1080p-audio', 'max-duration']],
    ['kling-3-4k', ['5s-4k', '10s-4k', '15s-4k', 'max-duration']],
    ['ltx-2-3-pro', ['6s-1080p-audio', '8s-1440p-audio', '10s-4k-audio', 'max-duration']],
  ] as const;

  for (const [slug, expectedIds] of expectations) {
    const engine = getEngine(slug === 'ltx-2-3-pro' ? 'ltx-2-3' : slug);
    const template = getModelPageTemplateConfig(slug);
    assert.ok(template);

    const scenarios = buildModelDecisionPricingScenarios(engine, 'en', template.pricing.presets);
    const helperValues = template.pricing.presets.map((preset) => {
      if ('seconds' in preset && typeof preset.seconds === 'number' && typeof preset.resolution === 'string') {
        return getPresetQuote(
          engine,
          {
            id: preset.id,
            label: `${preset.seconds}s ${preset.resolution}`,
            subLabel: preset.labelKey,
            resolution: preset.resolution,
            durationSec: preset.seconds,
            audio: preset.audio ?? false,
          },
          'en'
        ).display;
      }

      if ('fixedValueKey' in preset && preset.fixedValueKey === 'maxDurationValue') {
        return `${engine.engine.pricingDetails?.maxDurationSec ?? engine.engine.maxDurationSec}s`;
      }

      return null;
    });

    assert.deepEqual(
      scenarios.map((scenario) => scenario.id),
      expectedIds
    );
    assert.deepEqual(
      scenarios.map((scenario) => scenario.value),
      helperValues
    );
    assert.equal(scenarios.every((scenario) => scenario.value.trim().length > 0 && scenario.value !== '—'), true);
  }
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
