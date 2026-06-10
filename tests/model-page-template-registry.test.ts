import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  getModelPageTemplateConfig,
  listModelPageTemplateSlugs,
} from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-registry.ts';
import type { ModelPageTemplateConfig } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-types.ts';

const engineCatalog = JSON.parse(readFileSync('frontend/config/engine-catalog.json', 'utf8')) as Array<{
  modelSlug: string;
}>;
const CATALOG_MODEL_SLUGS = new Set(engineCatalog.map((entry) => entry.modelSlug));

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
  const ltx2 = getModelPageTemplateConfig('ltx-2');
  const ltx2Fast = getModelPageTemplateConfig('ltx-2-fast');
  const ltxFast = getModelPageTemplateConfig('ltx-2-3-fast');
  const luma = getModelPageTemplateConfig('luma-ray-2');
  const lumaFlash = getModelPageTemplateConfig('luma-ray-2-flash');
  const lumaRay32 = getModelPageTemplateConfig('luma-ray-3-2');
  const lumaUni = getModelPageTemplateConfig('luma-uni-1');
  const lumaUniMax = getModelPageTemplateConfig('luma-uni-1-max');
  const happyHorse = getModelPageTemplateConfig('happy-horse-1-0');
  const hailuo = getModelPageTemplateConfig('minimax-hailuo-02-text');
  const pika = getModelPageTemplateConfig('pika-text-to-video');
  const gptImage = getModelPageTemplateConfig('gpt-image-2');
  const nano = getModelPageTemplateConfig('nano-banana');
  const nano2 = getModelPageTemplateConfig('nano-banana-2');
  const nanoPro = getModelPageTemplateConfig('nano-banana-pro');

  assert.ok(seedance);
  assert.ok(seedanceFast);
  assert.ok(ltx2);
  assert.ok(ltx2Fast);
  assert.ok(ltxFast);
  assert.ok(luma);
  assert.ok(lumaFlash);
  assert.ok(lumaRay32);
  assert.ok(lumaUni);
  assert.ok(lumaUniMax);
  assert.ok(happyHorse);
  assert.ok(hailuo);
  assert.ok(pika);
  assert.ok(gptImage);
  assert.ok(nano);
  assert.ok(nano2);
  assert.ok(nanoPro);
  assert.equal(seedance.intent, 'production');
  assert.equal(seedanceFast.intent, 'draft');
  assert.equal(ltx2.intent, 'specialized');
  assert.equal(ltx2Fast.intent, 'draft');
  assert.equal(ltxFast.intent, 'draft');
  assert.equal(luma.intent, 'production');
  assert.equal(lumaFlash.intent, 'draft');
  assert.equal(lumaRay32.intent, 'production');
  assert.equal(lumaUni.intent, 'reference-prep');
  assert.equal(lumaUniMax.intent, 'production');
  assert.equal(happyHorse.intent, 'production');
  assert.equal(hailuo.intent, 'draft');
  assert.equal(pika.intent, 'draft');
  assert.equal(gptImage.intent, 'specialized');
  assert.equal(nano.intent, 'draft');
  assert.equal(nano2.intent, 'production');
  assert.equal(nanoPro.intent, 'specialized');
  assert.equal(seedance.hero.primaryCtaHref, '/app?engine=seedance-2-0');
  assert.equal(seedanceFast.hero.primaryCtaHref, '/app?engine=seedance-2-0-fast');
  assert.equal(ltx2.hero.primaryCtaHref, '/app?engine=ltx-2');
  assert.equal(ltx2Fast.hero.primaryCtaHref, '/app?engine=ltx-2-fast');
  assert.equal(ltxFast.hero.primaryCtaHref, '/app?engine=ltx-2-3-fast');
  assert.equal(luma.hero.primaryCtaHref, '/app?engine=lumaRay2');
  assert.equal(lumaFlash.hero.primaryCtaHref, '/app?engine=lumaRay2_flash');
  assert.equal(lumaRay32.hero.primaryCtaHref, '/app?engine=luma-ray-3-2');
  assert.equal(lumaUni.hero.primaryCtaHref, '/app/image?engine=luma-uni-1');
  assert.equal(lumaUniMax.hero.primaryCtaHref, '/app/image?engine=luma-uni-1-max');
  assert.equal(happyHorse.hero.primaryCtaHref, '/app?engine=happy-horse-1-0');
  assert.equal(hailuo.hero.primaryCtaHref, '/app?engine=minimax-hailuo-02-text');
  assert.equal(pika.hero.primaryCtaHref, '/app?engine=pika-text-to-video');
  assert.equal(gptImage.hero.primaryCtaHref, '/app/image?engine=gpt-image-2');
  assert.equal(nano.hero.primaryCtaHref, '/app/image?engine=nano-banana');
  assert.equal(nano2.hero.primaryCtaHref, '/app/image?engine=nano-banana-2');
  assert.equal(nanoPro.hero.primaryCtaHref, '/app/image?engine=nano-banana-pro');
  assert.equal(seedance.pricing.anchorHref, '/pricing#seedance-2-0-pricing');
  assert.equal(seedanceFast.pricing.anchorHref, '/pricing#seedance-2-0-fast-pricing');
  assert.equal(ltx2.pricing.anchorHref, '/pricing#ltx-2-pricing');
  assert.equal(ltx2Fast.pricing.anchorHref, '/pricing#ltx-2-fast-pricing');
  assert.equal(ltxFast.pricing.anchorHref, '/pricing#ltx-2-3-fast-pricing');
  assert.equal(luma.pricing.anchorHref, '/pricing#luma-ray-2-pricing');
  assert.equal(lumaFlash.pricing.anchorHref, '/pricing#luma-ray-2-flash-pricing');
  assert.equal(lumaRay32.pricing.anchorHref, '/pricing#luma-ray-3-2-pricing');
  assert.equal(lumaUni.pricing.anchorHref, '/pricing#luma-uni-1-pricing');
  assert.equal(lumaUniMax.pricing.anchorHref, '/pricing#luma-uni-1-max-pricing');
  assert.equal(happyHorse.pricing.anchorHref, '/pricing#happy-horse-1-0-pricing');
  assert.equal(hailuo.pricing.anchorHref, '/pricing#minimax-hailuo-02-text-pricing');
  assert.equal(pika.pricing.anchorHref, '/pricing#pika-text-to-video-pricing');
  assert.equal(gptImage.pricing.anchorHref, '/pricing#gpt-image-2-pricing');
  assert.equal(nano.pricing.anchorHref, '/pricing#nano-banana-pricing');
  assert.equal(nano2.pricing.anchorHref, '/pricing#nano-banana-2-pricing');
  assert.equal(nanoPro.pricing.anchorHref, '/pricing#nano-banana-pro-pricing');
  assert.deepEqual(
    seedance.pricing.presets.map((preset) => preset.id),
    ['5s-480p', '8s-720p', '10s-1080p', 'audio-included', 'max-duration']
  );
  assert.deepEqual(
    seedanceFast.pricing.presets.map((preset) => preset.id),
    ['5s-480p', '8s-720p', '10s-720p', 'max-duration']
  );
  assert.deepEqual(
    ltx2.pricing.presets.map((preset) => preset.id),
    ['6s-1080p-audio', '8s-1440p-audio', '10s-4k-audio', 'max-duration']
  );
  assert.deepEqual(
    ltx2Fast.pricing.presets.map((preset) => preset.id),
    ['6s-1080p-audio', '10s-1080p-audio', '20s-1080p-audio', '10s-4k-audio', 'max-duration']
  );
  assert.deepEqual(
    ltxFast.pricing.presets.map((preset) => preset.id),
    ['10s-1080p', 'max-duration']
  );
  assert.deepEqual(
    luma.pricing.presets.map((preset) => preset.id),
    ['5s-720p', '9s-720p', '9s-1080p', 'max-duration']
  );
  assert.deepEqual(
    lumaFlash.pricing.presets.map((preset) => preset.id),
    ['5s-540p', '5s-720p', '9s-720p', '9s-1080p', 'max-duration']
  );
  assert.deepEqual(
    lumaRay32.pricing.presets.map((preset) => preset.id),
    ['5s-540p', '5s-720p', '10s-1080p', 'max-duration']
  );
  assert.deepEqual(
    lumaUni.pricing.presets.map((preset) => preset.id),
    ['2k-image', 'single-edit', 'reference-edit-set']
  );
  assert.deepEqual(
    lumaUniMax.pricing.presets.map((preset) => preset.id),
    ['2k-hero-image', 'hero-edit', 'reference-edit-set']
  );
  assert.deepEqual(
    happyHorse.pricing.presets.map((preset) => preset.id),
    ['5s-720p-audio', '10s-720p-audio', '15s-1080p-audio', 'max-duration']
  );
  assert.deepEqual(
    hailuo.pricing.presets.map((preset) => preset.id),
    ['6s-512p', '10s-768p', 'max-duration']
  );
  assert.deepEqual(
    pika.pricing.presets.map((preset) => preset.id),
    ['5s-720p', '10s-720p', '10s-1080p', 'max-duration']
  );
  assert.deepEqual(
    gptImage.pricing.presets.map((preset) => preset.id),
    ['1024x768-high', '3840x2160-high', '4x-1024x768-medium']
  );
  assert.deepEqual(
    nano.pricing.presets.map((preset) => preset.id),
    ['single-square', '4x-square', '8x-square']
  );
  assert.deepEqual(
    nano2.pricing.presets.map((preset) => preset.id),
    ['0-5k-image', '1k-image', '4k-image', '4x-1k-image']
  );
  assert.deepEqual(
    nanoPro.pricing.presets.map((preset) => preset.id),
    ['2k-image', '4k-image', '4x-2k-image']
  );
  assert.deepEqual(listModelPageTemplateSlugs().sort(), [
    'gpt-image-2',
    'happy-horse-1-0',
    'kling-2-5-turbo',
    'kling-2-6-pro',
    'kling-3-4k',
    'kling-3-pro',
    'kling-3-standard',
    'kling-o3-4k',
    'kling-o3-pro',
    'kling-o3-standard',
    'ltx-2',
    'ltx-2-3-fast',
    'ltx-2-3-pro',
    'ltx-2-fast',
    'luma-ray-2',
    'luma-ray-2-flash',
    'luma-ray-3-2',
    'luma-uni-1',
    'luma-uni-1-max',
    'minimax-hailuo-02-text',
    'nano-banana',
    'nano-banana-2',
    'nano-banana-pro',
    'pika-text-to-video',
    'seedance-1-5-pro',
    'seedance-2-0',
    'seedance-2-0-fast',
    'seedream',
    'sora-2',
    'sora-2-pro',
    'veo-3-1',
    'veo-3-1-fast',
    'veo-3-1-lite',
    'wan-2-5',
    'wan-2-6',
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

test('second-wave templates preserve model intent and app engine routes', () => {
  const expectations = [
    ['veo-3-1-fast', 'draft', '/app?engine=veo-3-1-fast'],
    ['veo-3-1-lite', 'draft', '/app?engine=veo-3-1-lite'],
    ['kling-3-standard', 'draft', '/app?engine=kling-3-standard'],
    ['kling-3-4k', 'production', '/app?engine=kling-3-4k'],
    ['ltx-2-3-pro', 'production', '/app?engine=ltx-2-3'],
  ] as const;

  for (const [slug, intent, primaryCtaHref] of expectations) {
    const config = getModelPageTemplateConfig(slug);
    assert.ok(config, `${slug} should be migrated to the template`);
    assert.equal(config.intent, intent);
    assert.equal(config.hero.primaryCtaHref, primaryCtaHref);
    assert.equal(config.pricing.anchorHref, `/pricing#${slug}-pricing`);
    assert.equal(config.hero.quickLinks.some((link) => link.href === '#prompting'), true);
  }
});

test('second-wave templates avoid cross-route overclaims', () => {
  const veo = getModelPageTemplateConfig('veo-3-1');
  const veoFast = getModelPageTemplateConfig('veo-3-1-fast');
  const veoLite = getModelPageTemplateConfig('veo-3-1-lite');
  const klingStandard = getModelPageTemplateConfig('kling-3-standard');
  const kling4k = getModelPageTemplateConfig('kling-3-4k');
  const ltxPro = getModelPageTemplateConfig('ltx-2-3-pro');

  assert.ok(veo);
  assert.ok(veoFast);
  assert.ok(veoLite);
  assert.ok(klingStandard);
  assert.ok(kling4k);
  assert.ok(ltxPro);

  assert.equal(veo.pricing.presets.some((preset) => preset.resolution === '4k'), true);
  assert.equal(veoFast.pricing.presets.some((preset) => preset.resolution === '4k'), true);
  assert.equal(veoLite.pricing.presets.every((preset) => preset.resolution !== '4k'), true);
  assert.equal(klingStandard.pricing.presets.every((preset) => preset.resolution !== '4k'), true);
  assert.equal(kling4k.pricing.presets.some((preset) => preset.resolution === '4k'), true);
  assert.equal(ltxPro.hero.primaryCtaHref, '/app?engine=ltx-2-3');
  assert.notEqual(ltxPro.hero.primaryCtaHref, '/app?engine=ltx-2-3-pro');
});

test('LTX 2 legacy templates stay distinct from current LTX 2.3 routes', () => {
  const ltx2 = getModelPageTemplateConfig('ltx-2');
  const ltx2Fast = getModelPageTemplateConfig('ltx-2-fast');

  assert.ok(ltx2);
  assert.ok(ltx2Fast);
  assert.equal(ltx2.intent, 'specialized');
  assert.equal(ltx2Fast.intent, 'draft');
  assert.equal(ltx2.hero.primaryCtaHref, '/app?engine=ltx-2');
  assert.equal(ltx2Fast.hero.primaryCtaHref, '/app?engine=ltx-2-fast');
  assert.equal(ltx2.hero.quickLinks.some((link) => link.href === '#prompting'), true);
  assert.equal(ltx2Fast.hero.quickLinks.some((link) => link.href === '#prompting'), true);
  assert.equal(ltx2.pricing.presets.every((preset) => preset.resolution !== '720p'), true);
  assert.equal(ltx2Fast.pricing.presets.some((preset) => preset.seconds === 20), true);
  assert.equal(ltx2Fast.pricing.presets.some((preset) => preset.resolution === '4k'), true);
});

test('Sora templates preserve standard and Pro route intent', () => {
  const sora = getModelPageTemplateConfig('sora-2');
  const soraPro = getModelPageTemplateConfig('sora-2-pro');

  assert.ok(sora);
  assert.ok(soraPro);
  assert.equal(sora.intent, 'draft');
  assert.equal(soraPro.intent, 'production');
  assert.equal(sora.hero.primaryCtaHref, '/app?engine=sora-2');
  assert.equal(soraPro.hero.primaryCtaHref, '/app?engine=sora-2-pro');
  assert.equal(sora.pricing.anchorHref, '/pricing#sora-2-pricing');
  assert.equal(soraPro.pricing.anchorHref, '/pricing#sora-2-pro-pricing');
  assert.deepEqual(
    sora.pricing.presets.map((preset) => preset.id),
    ['4s-720p', '8s-720p', '12s-720p', 'audio-included', 'max-duration']
  );
  assert.deepEqual(
    soraPro.pricing.presets.map((preset) => preset.id),
    ['4s-720p', '8s-1080p', '12s-1080p', 'audio-included', 'max-duration']
  );
  assert.equal(sora.pricing.presets.every((preset) => preset.resolution !== '1080p'), true);
  assert.equal(soraPro.pricing.presets.some((preset) => preset.resolution === '1080p'), true);
  assert.equal(sora.hero.quickLinks.some((link) => link.href === '#prompting'), true);
  assert.equal(soraPro.hero.quickLinks.some((link) => link.href === '#prompting'), true);
});

test('Seedance 1.5 Pro template preserves supported legacy route intent', () => {
  const seedance15 = getModelPageTemplateConfig('seedance-1-5-pro');

  assert.ok(seedance15);
  assert.equal(seedance15.intent, 'specialized');
  assert.equal(seedance15.hero.primaryCtaHref, '/app?engine=seedance-1-5-pro');
  assert.equal(seedance15.pricing.anchorHref, '/pricing#seedance-1-5-pro-pricing');
  assert.equal(seedance15.hero.quickLinks.some((link) => link.href === '#prompting'), true);
  assert.deepEqual(
    seedance15.pricing.presets.map((preset) => preset.id),
    ['5s-480p-audio', '8s-720p-audio', '10s-1080p-audio', 'max-duration']
  );
});

test('Kling legacy templates preserve supported older route intent', () => {
  const kling25 = getModelPageTemplateConfig('kling-2-5-turbo');
  const kling26 = getModelPageTemplateConfig('kling-2-6-pro');

  assert.ok(kling25);
  assert.ok(kling26);
  assert.equal(kling25.intent, 'draft');
  assert.equal(kling26.intent, 'specialized');
  assert.equal(kling25.hero.primaryCtaHref, '/app?engine=kling-2-5-turbo');
  assert.equal(kling26.hero.primaryCtaHref, '/app?engine=kling-2-6-pro');
  assert.equal(kling25.pricing.anchorHref, '/pricing#kling-2-5-turbo-pricing');
  assert.equal(kling26.pricing.anchorHref, '/pricing#kling-2-6-pro-pricing');
  assert.equal(kling25.hero.quickLinks.some((link) => link.href === '#prompting'), true);
  assert.equal(kling26.hero.quickLinks.some((link) => link.href === '#prompting'), true);
  assert.deepEqual(
    kling25.pricing.presets.map((preset) => preset.id),
    ['5s-1080p', '10s-1080p', 'max-duration']
  );
  assert.deepEqual(
    kling26.pricing.presets.map((preset) => preset.id),
    ['5s-1080p', '5s-1080p-audio', '10s-1080p-audio', 'max-duration']
  );
  assert.equal(kling25.pricing.presets.every((preset) => !preset.id.includes('audio')), true);
  assert.equal(kling26.pricing.presets.every((preset) => preset.resolution !== '4k'), true);
});

test('Wan templates separate reference-video route from shorter audio drafts', () => {
  const wan25 = getModelPageTemplateConfig('wan-2-5');
  const wan26 = getModelPageTemplateConfig('wan-2-6');

  assert.ok(wan25);
  assert.ok(wan26);
  assert.equal(wan25.intent, 'draft');
  assert.equal(wan26.intent, 'production');
  assert.equal(wan25.hero.primaryCtaHref, '/app?engine=wan-2-5');
  assert.equal(wan26.hero.primaryCtaHref, '/app?engine=wan-2-6');
  assert.equal(wan25.pricing.anchorHref, '/pricing#wan-2-5-pricing');
  assert.equal(wan26.pricing.anchorHref, '/pricing#wan-2-6-pricing');
  assert.equal(wan25.hero.quickLinks.some((link) => link.href === '#prompting'), true);
  assert.equal(wan26.hero.quickLinks.some((link) => link.href === '#prompting'), true);
  assert.deepEqual(
    wan25.pricing.presets.map((preset) => preset.id),
    ['5s-480p-audio', '10s-720p-audio', '10s-1080p-audio', 'max-duration']
  );
  assert.deepEqual(
    wan26.pricing.presets.map((preset) => preset.id),
    ['5s-720p-audio', '10s-720p-audio', '10s-1080p-audio', 'max-duration']
  );
});

test('Luma Ray 2 templates separate premium final route from fast draft route', () => {
  const luma = getModelPageTemplateConfig('luma-ray-2');
  const lumaFlash = getModelPageTemplateConfig('luma-ray-2-flash');

  assert.ok(luma);
  assert.ok(lumaFlash);
  assert.equal(luma.intent, 'production');
  assert.equal(lumaFlash.intent, 'draft');
  assert.equal(luma.hero.primaryCtaHref, '/app?engine=lumaRay2');
  assert.equal(lumaFlash.hero.primaryCtaHref, '/app?engine=lumaRay2_flash');
  assert.equal(luma.hero.quickLinks.some((link) => link.href === '#prompting'), true);
  assert.equal(lumaFlash.hero.quickLinks.some((link) => link.href === '#prompting'), true);
  assert.equal(luma.pricing.presets.every((preset) => preset.resolution !== '480p'), true);
  assert.equal(lumaFlash.pricing.presets.every((preset) => preset.resolution !== '480p'), true);
  assert.equal(luma.pricing.presets.some((preset) => preset.resolution === '1080p'), true);
  assert.equal(lumaFlash.pricing.presets.some((preset) => preset.resolution === '1080p'), true);
});

test('Luma Agents templates expose fallback-safe pricing presets and no image compare sections', () => {
  const lumaRay32 = getModelPageTemplateConfig('luma-ray-3-2');
  const lumaUni = getModelPageTemplateConfig('luma-uni-1');
  const lumaUniMax = getModelPageTemplateConfig('luma-uni-1-max');

  assert.ok(lumaRay32);
  assert.ok(lumaUni);
  assert.ok(lumaUniMax);
  assert.equal(lumaRay32.sections.compare, true);
  assert.equal(lumaUni.sections.compare, false);
  assert.equal(lumaUniMax.sections.compare, false);
  assert.equal(lumaRay32.hero.quickLinks.some((link) => link.icon === 'compare'), false);
  assert.equal(lumaRay32.hero.quickLinks.some((link) => link.href === '#specs'), true);
  assert.equal(lumaUni.hero.quickLinks.some((link) => link.icon === 'compare'), false);
  assert.equal(lumaUniMax.hero.quickLinks.some((link) => link.icon === 'compare'), false);
  assert.deepEqual(
    lumaRay32.pricing.presets.map((preset) => preset.id),
    ['5s-540p', '5s-720p', '10s-1080p', 'max-duration']
  );
  assert.deepEqual(
    lumaUni.pricing.presets.map((preset) => preset.id),
    ['2k-image', 'single-edit', 'reference-edit-set']
  );
  assert.deepEqual(
    lumaUniMax.pricing.presets.map((preset) => preset.id),
    ['2k-hero-image', 'hero-edit', 'reference-edit-set']
  );
});

test('template quick links avoid redirecting compare URLs', () => {
  const veo = getModelPageTemplateConfig('veo-3-1');
  assert.ok(veo);
  assert.equal(
    veo.hero.quickLinks[0]?.href,
    '/ai-video-engines/kling-3-pro-vs-veo-3-1?order=veo-3-1'
  );
});

test('template compare quick links only reference published compare catalog slugs', () => {
  for (const slug of listModelPageTemplateSlugs()) {
    const config = getModelPageTemplateConfig(slug);
    assert.ok(config, `${slug} should have a template config`);

    for (const link of config.hero.quickLinks) {
      if (!link.href.startsWith('/ai-video-engines/')) continue;

      const pairSlug = link.href.split('?')[0]?.split('/').pop() ?? '';
      const engineSlugs = pairSlug.split('-vs-');
      assert.equal(engineSlugs.length, 2, `${slug} quick link ${link.href} should be a two-engine compare URL`);

      for (const engineSlug of engineSlugs) {
        assert.ok(
          CATALOG_MODEL_SLUGS.has(engineSlug),
          `${slug} quick link ${link.href} references unpublished compare engine ${engineSlug}`
        );
      }
    }
  }
});
