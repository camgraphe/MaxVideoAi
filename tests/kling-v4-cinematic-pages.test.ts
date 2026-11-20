import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getImageEditorialPreset } from '../frontend/lib/image/editorial-presets';
import { buildCinematicPresentation } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-cinematic-data';
import { parseModelCinematicContent } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-cinematic-content';
import { parseModelDecisionContent } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-content';
import { listModelEditorialImages } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-editorial-images';
import { parseModelExamplesContent } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-examples-content';
import { parseModelPromptingContent } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prompting-content';
import { getModelPageTemplateConfig } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-registry';
import { resolveCinematicHeroDisplay } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-cinematic-hero-display';
import videoPack from '../docs/model-launch/kling-v4-video-example-pack.json';

const locales = ['en', 'fr', 'es'] as const;

function localizedPage(slug: string, locale: typeof locales[number]) {
  const raw = JSON.parse(readFileSync(`content/models/${locale}/${slug}.json`, 'utf8'));
  const content = parseModelCinematicContent(raw.cinematic, slug);
  assert.ok(content, `${locale}/${slug} must opt in to the cinematic page`);
  const examples = parseModelExamplesContent(raw.examples, slug, locale);
  const decision = parseModelDecisionContent(raw.decision, slug, locale);
  const prompting = parseModelPromptingContent(raw.prompting, slug, locale);
  const images = listModelEditorialImages(slug, locale, examples.editorialImages);
  const presentation = buildCinematicPresentation(content, examples, images, locale);
  assert.ok(presentation);
  const hero = resolveCinematicHeroDisplay(presentation.hero);
  assert.match(hero.desktop, /cinematic-heroes\/.+\.avif/);
  assert.match(hero.mobile, /cinematic-heroes\/.+\.avif/);
  return { content, presentation, decision, prompting };
}

test('Kling 4.0 video surfaces the full mode matrix alongside its own original 720p films', () => {
  for (const locale of locales) {
    const { content, presentation, decision } = localizedPage('kling-v4', locale);
    assert.equal(content.variant, 'video');
    assert.equal(presentation.media?.heroAutoplay, false);
    assert.equal(decision.hero.primaryCta.href, '/app?engine=kling-v4');
    assert.deepEqual(presentation.capabilities?.items.flatMap(item => item.actions.map(action => action.mode)),
      ['t2v', 'i2v', 'ref2v', 'v2v']);
    for (const action of presentation.capabilities?.items.flatMap(item => item.actions) ?? []) {
      const target = new URL(action.href, 'https://maxvideoai.com');
      assert.equal(target.pathname, '/app');
      assert.equal(target.searchParams.get('lang'), locale);
      assert.equal(target.searchParams.get('engine'), 'kling-v4');
    }
    assert.deepEqual(presentation.assets.map(asset => asset.video?.src).sort(), videoPack.assets.map(asset => asset.videoUrl).sort());
    for (const asset of presentation.assets) {
      assert.match(asset.metadataLabel, /720p/);
      assert.equal(asset.engineId, 'kling-v4');
      const job = videoPack.assets.find(proof => proof.videoUrl === asset.video?.src);
      assert.equal(asset.watchHref, `/video/${job?.jobId}`);
      assert.equal(asset.prompt, job?.prompt);
      assert.equal(new URL(asset.videoCreation?.href ?? '', 'https://maxvideoai.com').searchParams.get('from'), job?.jobId);
    }
    assert.match(content.intro, /4K/);
  }
  const template = getModelPageTemplateConfig('kling-v4');
  assert.equal(template?.pricing.enabled, true);
  assert.deepEqual(template?.pricing.presets.map(preset => preset.resolution), ['720p', '1080p', '4k']);
});

test('Kling Image 4.0 uses distinct labelled illustrations and exact image-workspace handoffs', () => {
  for (const locale of locales) {
    const { content, presentation, decision, prompting } = localizedPage('kling-image-v4', locale);
    assert.equal(content.variant, 'image');
    assert.match(content.caption, /ImageGen/);
    assert.equal(decision.hero.primaryCta.href, '/app/image?engine=kling-image-v4');
    assert.match(presentation.assistantHref, /^\/app\/image\?/);
    assert.equal(new URL(presentation.assistantHref, 'https://maxvideoai.com').searchParams.get('engine'), 'kling-image-v4');
    assert.match(presentation.examples.provenance, /ImageGen/);
    assert.equal(presentation.examples.source?.href, 'https://fal.ai/kling-image-4');
    assert.equal(prompting.section.guide?.href, 'https://fal.ai/learn/tools/kling-image-4-prompting-guide');
    assert.ok(presentation.assets.length >= 4);
    assert.ok(presentation.assets.every(asset => !asset.video && !asset.watchHref && asset.metadataLabel.includes('ImageGen')));
    for (const asset of presentation.assets) {
      assert.match(asset.display.url, /^\/assets\/model-examples\/kling-image-v4\//);
      if (!asset.creation) continue;
      const target = new URL(asset.creation.href, 'https://maxvideoai.com');
      assert.equal(target.pathname, '/app/image');
      assert.equal(target.searchParams.get('engine'), 'kling-image-v4');
      assert.equal(target.searchParams.get('lang'), locale);
      const preset = getImageEditorialPreset('kling-image-v4', asset.id);
      assert.equal(preset?.snapshot.prompt, asset.prompt);
      assert.deepEqual(preset?.snapshot.refs.imageUrls, []);
    }
    assert.ok(presentation.assets.some(asset => asset.creation?.quoteInput.resolution === '2K'));
  }
  const template = getModelPageTemplateConfig('kling-image-v4');
  assert.deepEqual(template?.pricing.presets.map(preset => preset.imageResolution), ['2K', '4K', '8K']);
});
