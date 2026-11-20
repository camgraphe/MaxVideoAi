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
import { cinematicWorkflowHref } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-workflow-proofs';
import videoPack from '../docs/model-launch/kling-v4-video-example-pack.json';
import imageRecipes from '../frontend/config/model-kling-image-4-recipes.json';

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
  return { content, presentation, decision, prompting };
}

test('Kling 4.0 video surfaces the full mode matrix alongside its own original 720p films', () => {
  for (const locale of locales) {
    const { content, presentation, decision, prompting } = localizedPage('kling-v4', locale);
    assert.equal(content.variant, 'video');
    assert.ok(presentation.hero);
    const hero = resolveCinematicHeroDisplay(presentation.hero);
    assert.match(hero.desktop, /cinematic-heroes\/.+\.avif/);
    assert.match(hero.mobile, /cinematic-heroes\/.+\.avif/);
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
    assert.equal(content.workflows?.source, undefined);
    assert.equal(prompting.section.guide, null);
    const videoAssets = presentation.assets.filter(asset => asset.video);
    assert.deepEqual(videoAssets.map(asset => asset.video?.src).sort(), videoPack.assets.map(asset => asset.videoUrl).sort());
    const visuals = presentation.capabilities?.items.map(item => item.visual);
    assert.deepEqual(visuals?.map(visual => visual?.images.length), [1, 2, 2, 2]);
    assert.ok(visuals?.[3]?.reveal);
    assert.match(visuals[3].caption, /ImageGen/);
    const create = content.workflows?.items.find(item => item.id === 'create');
    const film = presentation.assets.find(asset => asset.video?.src === presentation.media?.create.src);
    assert.ok(create?.shotBreakdown && create.createMode && film?.videoCreation?.href);
    assert.equal(create.shotBreakdown.shots.length, 5);
    assert.deepEqual(create.shotBreakdown.shots.map(shot => shot.id), presentation.media?.createStills?.map(frame => frame.id));
    const reuse = new URL(cinematicWorkflowHref(film.videoCreation.href, 'create', create.createMode), 'https://maxvideoai.com');
    assert.equal(reuse.searchParams.get('mode'), 'ref2v');
    assert.equal(reuse.searchParams.get('lang'), locale);
    assert.equal(reuse.searchParams.get('from'), videoPack.assets.find(proof => proof.videoUrl === film.video?.src)?.jobId);
    const promptPanel = presentation.examples.panels.find(panel => panel.placement === 'prompting');
    const frame = presentation.assets.find(asset => asset.id === promptPanel?.assetIds[0]);
    assert.ok(frame && frame.videoCreation);
    assert.equal(frame.video, undefined);
    assert.equal(frame.watchHref, '#proof-create');
    assert.equal(frame.prompt, film.prompt);
    assert.ok(frame.prompt.includes(prompting.recipe!.excerpt));
    assert.equal(frame.videoCreation.href, reuse.pathname + reuse.search);
    for (const asset of videoAssets) {
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

test('Kling Image 4.0 publishes its prepared briefs without substituting example media', () => {
  for (const locale of locales) {
    const { content, presentation, decision, prompting } = localizedPage('kling-image-v4', locale);
    assert.equal(content.variant, 'image');
    assert.equal(content.heroAssetId, null);
    assert.equal(presentation.hero, undefined);
    assert.equal(decision.hero.primaryCta.href, '/app/image?engine=kling-image-v4');
    assert.match(presentation.assistantHref, /^\/app\/image\?/);
    assert.equal(new URL(presentation.assistantHref, 'https://maxvideoai.com').searchParams.get('engine'), 'kling-image-v4');
    assert.equal(presentation.examples.source, undefined);
    assert.equal(prompting.section.guide, null);
    assert.deepEqual(presentation.assets, []);
    assert.deepEqual(presentation.examples.panels, []);
    assert.equal(getImageEditorialPreset('kling-image-v4', 'kling-image-4-typography'), null);
    const briefs = presentation.imageBriefs?.items;
    assert.ok(briefs);
    assert.deepEqual(briefs.map(brief => brief.recipeId), imageRecipes.recipes.map(recipe => recipe.id));
    assert.deepEqual(prompting.imageExamples?.items.map(item => [item.id, item.prompt]),
      imageRecipes.recipes.map(recipe => [recipe.id, recipe.prompt]));
    for (const brief of briefs) {
      const recipe = imageRecipes.recipes.find(item => item.id === brief.recipeId);
      assert.ok(recipe);
      const target = new URL(brief.href, 'https://maxvideoai.com');
      assert.equal(target.pathname, '/app/image');
      assert.equal(target.searchParams.get('engine'), 'kling-image-v4');
      assert.equal(target.searchParams.get('lang'), locale);
      assert.equal(target.searchParams.get('example'), recipe.id);
      const preset = getImageEditorialPreset('kling-image-v4', recipe.id);
      assert.equal(preset?.snapshot.prompt, brief.prompt);
      assert.equal(brief.prompt, recipe.prompt);
      assert.equal(preset?.snapshot.inputMode, recipe.mode);
      assert.deepEqual(preset?.snapshot.core, { resolution: recipe.resolution, aspectRatio: recipe.aspectRatio, numImages: recipe.numImages });
      assert.deepEqual(preset?.snapshot.refs.imageUrls, []);
    }
  }
  const template = getModelPageTemplateConfig('kling-image-v4');
  assert.deepEqual(template?.pricing.presets.map(preset => preset.imageResolution), ['2K', '4K', '8K']);
});

test('a first native proof leaves the other Kling Image briefs available', () => {
  const slug = 'kling-image-v4';
  const raw = JSON.parse(readFileSync(`content/models/fr/${slug}.json`, 'utf8'));
  const content = parseModelCinematicContent(raw.cinematic, slug);
  const [poster, ...remaining] = imageRecipes.recipes;
  const posterBrief = raw.examples.cinematic.imageBriefs.items[0];
  const media = { url: '/assets/model-examples/kling-image-v4/test-poster.webp', sha256: 'a'.repeat(64), width: 1360, height: 2040 };
  raw.examples.cinematic.panels = [{
    id: 'poster', layout: 'feature', eyebrow: 'Typographie', title: posterBrief.title,
    body: posterBrief.body, note: 'Format 2:3.', assetIds: [poster.id],
  }];
  const examples = parseModelExamplesContent(raw.examples, slug, 'fr');
  const presentation = buildCinematicPresentation(content, examples, [{
    id: poster.id, engineId: slug, title: posterBrief.title, prompt: poster.prompt,
    original: media, display: media, metadataLabel: 'Kling Image 4.0 · 2K · 2:3',
    workspaceHref: '/app/image?engine=kling-image-v4',
  }], 'fr');
  assert.deepEqual(presentation?.imageBriefs?.items.map(brief => brief.recipeId), remaining.map(recipe => recipe.id));
  assert.equal(presentation?.assets[0]?.creation?.href, `/app/image?engine=${slug}&example=${poster.id}&lang=fr`);
});
