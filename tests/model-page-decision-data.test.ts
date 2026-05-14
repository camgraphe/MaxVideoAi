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
  const entry = listFalEngines().find((candidate) => candidate.id === engineId || candidate.modelSlug === engineId);
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

test('LTX 2 legacy templates keep older route positioning distinct from LTX 2.3', () => {
  const ltx2 = getEngine('ltx-2');
  const ltx2Fast = getEngine('ltx-2-fast');
  const en = buildModelDecisionData({ engine: ltx2, locale: 'en' });
  const fast = buildModelDecisionData({ engine: ltx2Fast, locale: 'en' });
  const fr = buildModelDecisionData({ engine: ltx2, locale: 'fr' });
  const es = buildModelDecisionData({ engine: ltx2Fast, locale: 'es' });

  assert.ok(en);
  assert.ok(fast);
  assert.ok(fr);
  assert.ok(es);

  assert.equal(en.hero.title, 'LTX 2');
  assert.match(en.hero.subtitle, /High-fidelity 16:9 clips/);
  assert.match(en.hero.subtitle, /1080p to 4K checks/);
  assert.equal(en.hero.primaryCta.href, '/app?engine=ltx-2');
  assert.equal(en.hero.quickLinks[2]?.href, '#prompting');
  assert.equal(en.decisionCards[1]?.cta.href, '/models/ltx-2-fast');
  assert.doesNotMatch(visibleDecisionText(en), /audio-to-video|Extend|Retake|vertical\/social|9:16/i);
  assert.match(fr.hero.subtitle, /Clips 16:9 haute fidélité/);

  assert.equal(fast.hero.title, 'LTX 2 Fast');
  assert.match(fast.hero.subtitle, /Fast 16:9 drafts/);
  assert.match(fast.hero.subtitle, /up to 20s/);
  assert.equal(fast.hero.primaryCta.href, '/app?engine=ltx-2-fast');
  assert.equal(fast.hero.quickLinks[2]?.href, '#prompting');
  assert.doesNotMatch(visibleDecisionText(fast), /audio-to-video|Extend|Retake|vertical\/social|9:16/i);
  assert.match(es.hero.subtitle, /Borradores 16:9 rápidos/);
});

test('Luma Ray 2 templates keep premium and Flash draft intent distinct', () => {
  const luma = getEngine('luma-ray-2');
  const flash = getEngine('luma-ray-2-flash');
  const en = buildModelDecisionData({ engine: luma, locale: 'en' });
  const fast = buildModelDecisionData({ engine: flash, locale: 'en' });
  const fr = buildModelDecisionData({ engine: luma, locale: 'fr' });
  const es = buildModelDecisionData({ engine: flash, locale: 'es' });

  assert.ok(en);
  assert.ok(fast);
  assert.ok(fr);
  assert.ok(es);

  assert.equal(en.hero.title, 'Luma Ray 2');
  assert.match(en.hero.subtitle, /Premium cinematic shots/);
  assert.match(en.hero.subtitle, /Modify/);
  assert.match(en.hero.subtitle, /Reframe/);
  assert.equal(en.hero.primaryCta.href, '/app?engine=lumaRay2');
  assert.equal(en.hero.quickLinks[2]?.href, '#prompting');
  assert.deepEqual(
    en.pricing.scenarios.map((scenario) => scenario.id),
    ['5s-720p', '9s-720p', '9s-1080p', 'max-duration']
  );
  assert.equal(en.pricing.scenarios.every((scenario) => scenario.value !== '—'), true);
  assert.doesNotMatch(
    visibleDecisionText(en),
    /Seedance 2\.0|Native audio|Audio on|Dialogue, ambience|SFX generated|Armored skull|Motorcycle|Fal workflow|active Fal route|draft speed/i
  );
  assert.match(fr.hero.subtitle, /Plans cinématographiques premium/);

  assert.equal(fast.hero.title, 'Luma Ray 2 Flash');
  assert.match(fast.hero.subtitle, /Fast Luma drafts/);
  assert.match(fast.hero.subtitle, /lower-cost iteration/);
  assert.equal(fast.hero.primaryCta.href, '/app?engine=lumaRay2_flash');
  assert.equal(fast.hero.quickLinks[2]?.href, '#prompting');
  assert.notEqual(fast.meta.title, en.meta.title);
  assert.doesNotMatch(visibleDecisionText(fast), /premium cinematic generation workflow|delivery-ready Luma variants/i);
  assert.doesNotMatch(
    visibleDecisionText(fast),
    /Seedance 2\.0|Native audio|Audio on|Dialogue, ambience|SFX generated|Fal workflow|active Fal route/i
  );
  assert.match(es.hero.subtitle, /Borradores Luma rápidos/);
});

test('remaining video templates preserve Happy Horse, Hailuo, and Pika route intent', () => {
  const happyHorse = buildModelDecisionData({ engine: getEngine('happy-horse-1-0'), locale: 'en' });
  const hailuo = buildModelDecisionData({ engine: getEngine('minimax-hailuo-02-text'), locale: 'en' });
  const pika = buildModelDecisionData({ engine: getEngine('pika-text-to-video'), locale: 'en' });
  const frHailuo = buildModelDecisionData({ engine: getEngine('minimax-hailuo-02-text'), locale: 'fr' });
  const esPika = buildModelDecisionData({ engine: getEngine('pika-text-to-video'), locale: 'es' });

  assert.ok(happyHorse);
  assert.ok(hailuo);
  assert.ok(pika);
  assert.ok(frHailuo);
  assert.ok(esPika);

  assert.equal(happyHorse.hero.title, 'Happy Horse 1.0');
  assert.match(happyHorse.hero.subtitle, /Native audio/);
  assert.match(happyHorse.hero.subtitle, /R2V references/);
  assert.equal(happyHorse.hero.primaryCta.href, '/app?engine=happy-horse-1-0');
  assert.equal(happyHorse.hero.quickLinks[2]?.href, '#prompting');
  assert.deepEqual(
    happyHorse.pricing.scenarios.map((scenario) => scenario.id),
    ['5s-720p-audio', '10s-720p-audio', '15s-1080p-audio', 'max-duration']
  );
  assert.doesNotMatch(visibleDecisionText(happyHorse), /silent storyboard|budget motion drafts|stylized social loops/i);

  assert.equal(hailuo.hero.title, 'MiniMax Hailuo 02');
  assert.match(hailuo.hero.subtitle, /Budget motion drafts/);
  assert.match(hailuo.hero.subtitle, /silent storyboard clips/);
  assert.equal(hailuo.hero.primaryCta.href, '/app?engine=minimax-hailuo-02-text');
  assert.equal(hailuo.hero.quickLinks[2]?.href, '#prompting');
  assert.deepEqual(
    hailuo.pricing.scenarios.map((scenario) => scenario.id),
    ['6s-512p', '10s-768p', 'max-duration']
  );
  assert.doesNotMatch(visibleDecisionText(hailuo), /native audio|lip-sync|R2V references|negative prompts/i);
  assert.match(frHailuo.hero.subtitle, /Brouillons mouvement économiques/);

  assert.equal(pika.hero.title, 'Pika 2.2 Text-to-Video');
  assert.match(pika.hero.subtitle, /Text-to-Video social loops/);
  assert.match(pika.hero.subtitle, /seeds/);
  assert.equal(pika.hero.primaryCta.href, '/app?engine=pika-text-to-video');
  assert.equal(pika.hero.quickLinks[2]?.href, '#prompting');
  assert.deepEqual(
    pika.pricing.scenarios.map((scenario) => scenario.id),
    ['5s-720p', '10s-720p', '10s-1080p', 'max-duration']
  );
  assert.doesNotMatch(visibleDecisionText(pika), /native audio|audio on|lip-sync|R2V references|physics-aware tests|image-to-video starts|Armored skull|Motorcycle/i);
  assert.match(esPika.hero.subtitle, /Loops sociales Text-to-Video/);
});

test('image templates preserve GPT Image 2 and Nano Banana route intent', () => {
  const gptImage = buildModelDecisionData({ engine: getEngine('gpt-image-2'), locale: 'en' });
  const nano = buildModelDecisionData({ engine: getEngine('nano-banana'), locale: 'en' });
  const nano2 = buildModelDecisionData({ engine: getEngine('nano-banana-2'), locale: 'en' });
  const nanoPro = buildModelDecisionData({ engine: getEngine('nano-banana-pro'), locale: 'en' });
  const frNano2 = buildModelDecisionData({ engine: getEngine('nano-banana-2'), locale: 'fr' });
  const esNanoPro = buildModelDecisionData({ engine: getEngine('nano-banana-pro'), locale: 'es' });

  assert.ok(gptImage);
  assert.ok(nano);
  assert.ok(nano2);
  assert.ok(nanoPro);
  assert.ok(frNano2);
  assert.ok(esNanoPro);

  assert.equal(gptImage.hero.title, 'GPT Image 2');
  assert.match(gptImage.hero.subtitle, /readable text/);
  assert.match(gptImage.hero.subtitle, /controlled edits/);
  assert.equal(gptImage.hero.primaryCta.href, '/app/image?engine=gpt-image-2');
  assert.equal(gptImage.hero.quickLinks[2]?.href, '#prompting');
  assert.deepEqual(
    gptImage.pricing.scenarios.map((scenario) => scenario.id),
    ['1024x768-high', '3840x2160-high', '4x-1024x768-medium']
  );

  assert.equal(nano.hero.title, 'Nano Banana');
  assert.match(nano.hero.subtitle, /Fast still drafts/);
  assert.match(nano.hero.subtitle, /batch image variants/);
  assert.equal(nano.hero.primaryCta.href, '/app/image?engine=nano-banana');
  assert.deepEqual(
    nano.pricing.scenarios.map((scenario) => scenario.id),
    ['single-square', '4x-square', '8x-square']
  );

  assert.equal(nano2.hero.title, 'Nano Banana 2');
  assert.match(nano2.hero.subtitle, /Grounded image generation/);
  assert.match(nano2.hero.subtitle, /wide aspect ratios/);
  assert.equal(nano2.hero.primaryCta.href, '/app/image?engine=nano-banana-2');
  assert.deepEqual(
    nano2.pricing.scenarios.map((scenario) => scenario.id),
    ['0-5k-image', '1k-image', '4k-image', '4x-1k-image']
  );
  assert.match(frNano2.hero.subtitle, /Génération d’images guidée/);

  assert.equal(nanoPro.hero.title, 'Nano Banana Pro');
  assert.match(nanoPro.hero.subtitle, /4K campaign stills/);
  assert.match(nanoPro.hero.subtitle, /typography-focused edits/);
  assert.equal(nanoPro.hero.primaryCta.href, '/app/image?engine=nano-banana-pro');
  assert.deepEqual(
    nanoPro.pricing.scenarios.map((scenario) => scenario.id),
    ['2k-image', '4k-image', '4x-2k-image']
  );
  assert.match(esNanoPro.hero.subtitle, /Stills de campaña 4K/);
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

test('Wan templates separate 2.6 reference-video workflow from 2.5 audio checks', () => {
  const wan25 = getEngine('wan-2-5');
  const wan26 = getEngine('wan-2-6');
  const en25 = buildModelDecisionData({ engine: wan25, locale: 'en' });
  const fr25 = buildModelDecisionData({ engine: wan25, locale: 'fr' });
  const es25 = buildModelDecisionData({ engine: wan25, locale: 'es' });
  const en26 = buildModelDecisionData({ engine: wan26, locale: 'en' });
  const fr26 = buildModelDecisionData({ engine: wan26, locale: 'fr' });
  const es26 = buildModelDecisionData({ engine: wan26, locale: 'es' });

  assert.ok(en25);
  assert.ok(fr25);
  assert.ok(es25);
  assert.ok(en26);
  assert.ok(fr26);
  assert.ok(es26);

  assert.equal(en25.hero.title, 'Wan 2.5');
  assert.match(en25.hero.subtitle, /Audio-ready 5-10s clips/);
  assert.match(visibleDecisionText(en25), /prompt expansion|soundtrack/i);
  assert.doesNotMatch(en25.hero.subtitle, /15s|reference-to-video/i);
  assert.deepEqual(en25.hero.subtitleHighlights, [
    'Audio-ready 5-10s clips',
    'text or image starts',
    '480p to 1080p checks',
  ]);
  assert.equal(en25.hero.primaryCta.href, '/app?engine=wan-2-5');
  assert.equal(en25.hero.quickLinks[2]?.href, '#prompting');
  assert.equal(en25.decisionCards[1]?.cta.href, '#prompting');
  assert.match(fr25.hero.subtitle, /Clips audio-ready de 5 à 10 s/);
  assert.match(es25.hero.subtitle, /Clips con audio de 5 a 10 s/);

  assert.equal(en26.hero.title, 'Wan 2.6');
  assert.match(en26.hero.subtitle, /15s multi-shot clips/);
  assert.match(en26.hero.subtitle, /5s\/10s reference-video consistency/);
  assert.match(visibleDecisionText(en26), /reference videos|15 second/i);
  assert.match(visibleDecisionText(en26), /audio is off in this mode/i);
  assert.doesNotMatch(visibleDecisionText(en26), /lip[- ]sync/i);
  assert.deepEqual(en26.hero.subtitleHighlights, [
    '15s multi-shot clips',
    '5s/10s reference-video consistency',
    'optional audio for text or image starts',
  ]);
  assert.equal(en26.hero.primaryCta.href, '/app?engine=wan-2-6');
  assert.equal(en26.hero.quickLinks[2]?.href, '#prompting');
  assert.equal(en26.decisionCards[1]?.cta.href, '#prompting');
  assert.match(fr26.hero.subtitle, /Clips multi-plans jusqu’à 15 s/);
  assert.match(es26.hero.subtitle, /Clips multi-shot de hasta 15 s/);
});

test('Seedream returns reference-prep decision data for still preparation', () => {
  const seedream = getEngine('seedream');
  const en = buildModelDecisionData({ engine: seedream, locale: 'en' });
  const fr = buildModelDecisionData({ engine: seedream, locale: 'fr' });
  const es = buildModelDecisionData({ engine: seedream, locale: 'es' });

  assert.ok(en);
  assert.ok(fr);
  assert.ok(es);

  assert.equal(en.hero.title, 'Seedream 5.0 Lite');
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
    ['ltx-2', ['6s-1080p-audio', '8s-1440p-audio', '10s-4k-audio', 'max-duration']],
    [
      'ltx-2-fast',
      ['6s-1080p-audio', '10s-1080p-audio', '20s-1080p-audio', '10s-4k-audio', 'max-duration'],
    ],
    ['ltx-2-3-pro', ['6s-1080p-audio', '8s-1440p-audio', '10s-4k-audio', 'max-duration']],
    ['wan-2-5', ['5s-480p-audio', '10s-720p-audio', '10s-1080p-audio', 'max-duration']],
    ['wan-2-6', ['5s-720p-audio', '10s-720p-audio', '10s-1080p-audio', 'max-duration']],
    ['luma-ray-2', ['5s-720p', '9s-720p', '9s-1080p', 'max-duration']],
    ['luma-ray-2-flash', ['5s-540p', '5s-720p', '9s-720p', '9s-1080p', 'max-duration']],
    ['happy-horse-1-0', ['5s-720p-audio', '10s-720p-audio', '15s-1080p-audio', 'max-duration']],
    ['minimax-hailuo-02-text', ['6s-512p', '10s-768p', 'max-duration']],
    ['pika-text-to-video', ['5s-720p', '10s-720p', '10s-1080p', 'max-duration']],
    ['gpt-image-2', ['1024x768-high', '3840x2160-high', '4x-1024x768-medium']],
    ['nano-banana', ['single-square', '4x-square', '8x-square']],
    ['nano-banana-2', ['0-5k-image', '1k-image', '4k-image', '4x-1k-image']],
    ['nano-banana-pro', ['2k-image', '4k-image', '4x-2k-image']],
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
