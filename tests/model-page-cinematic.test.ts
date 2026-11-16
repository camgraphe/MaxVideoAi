import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import seedreamRecords from '../frontend/config/seedream-editorial-images.json';
import createMedia from '../frontend/config/model-cinematic-create-media.json';
import finalMedia from '../frontend/config/model-cinematic-final-media.json';
import startFrames from '../frontend/config/model-cinematic-start-frames.json';
import publicProofs from '../frontend/config/model-cinematic-public-proofs.json';
import heroDisplays from '../frontend/config/model-cinematic-hero-displays.json';
import { parseSeedreamEditorialImages } from '../frontend/lib/seedream-editorial-images';
import { mergeEngineLocalizedContent } from '../frontend/lib/models/i18n-normalization';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { parseModelCinematicContent } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-cinematic-content';
import { parseModelExamplesContent } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-examples-content';
import { buildCinematicPresentation } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-cinematic-data';
import { listModelEditorialImages } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-editorial-images';
import { buildModelDecisionData } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-data';
import { ModelCinematicOverview } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelCinematicOverview';
import { ModelCinematicHero } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelCinematicHero';
import { ModelCinematicPrompt } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelCinematicAsset';
import { ModelCinematicWorkflowProofs } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelCinematicWorkflowProofs';
import { ModelCinematicZoom, ModelCinematicDetailCrop } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelCinematicZoom.client';
import { ModelCinematicPromptAssistant } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelCinematicPromptAssistant';
import { ModelCinematicPricing } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelCinematicPricing';
import { ModelCinematicExamples } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelCinematicExamples';
import { buildCinematicFamilyLinks } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-cinematic-discovery';
import type { ModelExamplesViewModel } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-examples-view-model';
import { getPricingHubCopy } from '../frontend/app/(localized)/[locale]/(marketing)/pricing/_lib/pricingHubCopy';
import { parseModelPromptingContent } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prompting-content';

const requireFrontend = createRequire(path.resolve('frontend/package.json'));
const React = requireFrontend('react');
const { renderToStaticMarkup } = requireFrontend('react-dom/server');
const { NextIntlClientProvider } = requireFrontend('next-intl');
const sharp = requireFrontend('sharp');
(globalThis as typeof globalThis & { React: typeof React }).React = React;
const locales = ['en', 'fr', 'es'] as const;
const read = (slug: string, locale = 'en') => JSON.parse(readFileSync(`content/models/${locale}/${slug}.json`, 'utf8'));
const filePath = (url: string) => path.join('frontend/public', url);

test('a video gallery entry survives without Flash renders and keeps concept frames out of video evidence', () => {
  for (const locale of locales) {
    const copy = read('seedance-2-5-flash', locale);
    const examples = parseModelExamplesContent(copy.examples, 'seedance-2-5-flash', locale);
    const presentation = buildCinematicPresentation(parseModelCinematicContent(copy.cinematic, 'seedance-2-5-flash'), examples, [], locale)!;
    const viewModel = { section: examples.section, decision: { examplesLinkHref: { pathname: '/examples/[model]', params: { model: 'seedance' } } } } as ModelExamplesViewModel;
    const doc = new JSDOM(renderToStaticMarkup(React.createElement(NextIntlClientProvider, {locale,messages:{},timeZone:'UTC'},
      React.createElement(ModelCinematicExamples, {presentation,viewModel,hasRenderedVideos:false,galleryOnly:true})))).window.document;
    assert.ok(doc.querySelector('#rendered-examples h2'));
    assert.equal(doc.querySelectorAll('img').length, 1);
    assert.equal(doc.querySelector('img')?.getAttribute('loading'), 'lazy');
    assert.equal(doc.querySelector('figcaption')?.textContent, examples.cinematic!.gallery!.previewLabel);
    assert.ok(doc.querySelector('a[data-analytics-cta-name="see_examples"]')?.getAttribute('href')?.endsWith('/seedance'));
    assert.equal(doc.querySelectorAll('video, script[type="application/ld+json"]').length, 0);
    const links = buildCinematicFamilyLinks('seedance-2-5-flash', locale);
    assert.deepEqual(links.map(link => link.href.split('/').pop()), ['seedance-2-5', 'seedance-2-0', 'seedance-2-0-fast']);
    assert.ok(links.every(link => link.label));
    const duplicate = structuredClone(examples);
    duplicate.cinematic!.gallery!.previewAssetId = presentation.hero.id;
    assert.throws(() => buildCinematicPresentation(presentation.content, duplicate, [], locale), /one placement/);
  }
});

test('video workflows distinguish real films from the illustrated extension and preserve prompt handoffs', () => {
  for (const locale of locales) {
    const copy = read('seedance-2-5-flash', locale);
    const examples = parseModelExamplesContent(copy.examples, 'seedance-2-5-flash', locale);
    const presentation = buildCinematicPresentation(parseModelCinematicContent(copy.cinematic, 'seedance-2-5-flash'), examples, [], locale)!;
    const html = renderToStaticMarkup(React.createElement(NextIntlClientProvider, {locale,messages:{},timeZone:'UTC'},
      React.createElement(ModelCinematicWorkflowProofs, {presentation,workspaceHref:'/app?engine=seedance-2-5-flash'})));
    const doc = new JSDOM(html).window.document;
    const panels = [...doc.querySelectorAll('.cinema-workflow-proof')];
    assert.deepEqual(panels.map(panel => panel.id), ['proof-create', 'proof-modify', 'proof-extend']);
    assert.ok(panels.every(panel => !panel.hasAttribute('hidden')));
    assert.deepEqual(panels.map(panel => new URL(panel.querySelector('a.cinema-button')!.getAttribute('href')!, 'https://maxvideoai.com').searchParams.get('mode')), ['t2v', 'v2v', 'extend']);
    for (const panel of panels) {
      assert.ok(panel.querySelector('img[loading="lazy"]'));
      assert.equal(panel.querySelectorAll('.cinema-workflow-limits>div').length, 3);
      const workflow = copy.cinematic.workflows.items.find((item: { id: string }) => `proof-${item.id}` === panel.id);
      assert.ok(panel.textContent?.includes(workflow.proofLabel ?? workflow.timeline.note));
      assert.equal([...panel.querySelectorAll('button[aria-haspopup="dialog"]')].filter(button => !button.closest('.cinema-workflow-focus')).length, 1, 'Only one primary video prompt entry per workflow');
      assert.ok(panel.querySelector('dialog .cinema-prompt-text')?.textContent?.trim());
      const reuse = new URL(panel.querySelector('dialog a[data-analytics-cta-name="reuse_example"]')!.getAttribute('href')!, 'https://maxvideoai.com');
      const refine = new URL(panel.querySelector('dialog a[data-analytics-cta-name="milo_try"]')!.getAttribute('href')!, 'https://maxvideoai.com');
      assert.equal(reuse.searchParams.get('engine'), 'seedance-2-5-flash');
      assert.equal(reuse.searchParams.get('videoPrompt'), panel.id.replace('proof-', ''));
      assert.equal(refine.searchParams.get('videoPrompt'), reuse.searchParams.get('videoPrompt'));
      assert.equal(refine.searchParams.get('assistant'), 'milo');
      assert.equal(refine.searchParams.get('refine'), 'example');
      assert.equal(panel.querySelector('.cinema-workflow-copy .cinema-prompt:not(.cinema-video-prompt)'), null, 'A separate image-prompt entry cannot compete with the video prompt');
    }
    assert.equal(doc.querySelector('#proof-modify input[type="range"]')?.getAttribute('value'), '50');
    const focus = doc.querySelector('#proof-create #focus-motion-control');
    assert.ok(focus, 'Motion guidance stays inside Create');
    assert.equal(focus.querySelectorAll('.cinema-motion-player button').length, 1, 'One shared play control, without per-video or audio buttons');
    assert.ok([...focus.querySelectorAll('video')].every(video => video.hasAttribute('muted')), 'Motion comparison is silent from the server render');
    assert.equal(doc.querySelectorAll('.cinema-workflow-focus').length, 1);
    assert.ok(focus.querySelector('h3')?.textContent?.includes(copy.cinematic.workflows.items[0].focus.title));
    assert.equal(focus.querySelector('p[lang="en"]')?.textContent, copy.cinematic.workflows.items[0].focus.prompt);
    assert.equal(focus.querySelector('.cinema-focus-actions button')?.getAttribute('data-analytics-cta-location'), 'model_workflow');
    const focusImage = focus.querySelector('img')!;
    assert.equal(focusImage.getAttribute('loading'), 'lazy');
    assert.equal([...doc.querySelectorAll('img')].filter(img => img.getAttribute('src') === focusImage.getAttribute('src')).length, 1, 'The focus uses an otherwise unused still');
    const invalidFocus = structuredClone(presentation.content);
    invalidFocus.workflows!.items[0].focus!.assetId = 'missing-frame';
    assert.throws(() => buildCinematicPresentation(invalidFocus, examples, [], locale), /reviewed assets/);
    const repeatedFocus = structuredClone(presentation.content);
    repeatedFocus.workflows!.items[0].focus!.assetId = 'after-the-beat';
    assert.throws(() => buildCinematicPresentation(repeatedFocus, examples, [], locale), /one placement/);
    const videos = [...doc.querySelectorAll('#proof-create video')];
    assert.equal(videos.length, 3, 'The drummer, approved ballet source and transfer are the only real films');
    assert.equal(new Set(videos.map(video => video.getAttribute('src'))).size, 3);
    assert.ok(videos.every(video => video.getAttribute('preload') === 'none' && !video.hasAttribute('autoplay') && !video.hasAttribute('controls')));
    assert.ok(doc.querySelector('.cinema-editorial-media--create video'), 'The approved editorial mask owns the film as it owned the image');
    const editVideos = [...doc.querySelectorAll('#proof-modify video')];
    assert.equal(editVideos.length, 2);
    assert.ok(editVideos.every(video => video.hasAttribute('muted') && video.getAttribute('preload') === 'none' && !video.hasAttribute('autoplay')));
    assert.equal(doc.querySelectorAll('#proof-modify .cinema-edit-toggle').length, 1);
    assert.equal(doc.querySelectorAll('#proof-extend video, script[type="application/ld+json"]').length, 0, 'An illustrated timeline cannot become video evidence');
    assert.ok(doc.querySelector('#proof-extend .cinema-extend-timeline[aria-label]'));
    assert.equal(doc.querySelector('#proof-extend')?.textContent?.includes(copy.cinematic.workflows.conceptLabel), false);
  }
});

test('reviewed Create media preserves exact originals and uses separate immutable posters', () => {
  for (const clip of [createMedia.create, createMedia.motionSource, createMedia.motionResult, ...Object.values(finalMedia.clips)]) {
    assert.equal(createHash('sha256').update(readFileSync(filePath(clip.src))).digest('hex'), clip.sha256);
    assert.equal(createHash('sha256').update(readFileSync(filePath(clip.poster))).digest('hex'), clip.posterSha256);
    assert.notEqual(clip.src, clip.poster);
  }
  assert.equal(createMedia.character.modelId, 'seedream-5-5');
  assert.equal(createHash('sha256').update(readFileSync(filePath(createMedia.character.original))).digest('hex'), createMedia.character.sha256);
});

test('portrait inspection defers the original and Milo opens the correct model without auto submission', () => {
  for (const locale of locales) for (const slug of ['seedream-5-5', 'seedance-2-5-flash']) {
    const content = read(slug, locale);
    const examples = parseModelExamplesContent(content.examples, slug, locale);
    const images = slug === 'seedream-5-5' ? listModelEditorialImages(slug, locale, examples.editorialImages) : [];
    const presentation = buildCinematicPresentation(parseModelCinematicContent(content.cinematic, slug), examples, images, locale)!;
    const workspace = new JSDOM(renderToStaticMarkup(React.createElement(ModelCinematicPromptAssistant, {copy:presentation.content.promptAssistant,href:presentation.assistantHref}))).window.document;
    const href = new URL(workspace.querySelector('a')!.href, 'https://maxvideoai.com');
    assert.equal(href.pathname, slug === 'seedream-5-5' ? '/app/image' : '/app');
    assert.equal(href.searchParams.get('engine'), slug);
    assert.equal(href.searchParams.get('assistant'), 'milo');
    assert.equal(href.searchParams.get('lang'), locale);
    assert.equal(href.searchParams.has('prompt'), false);
    assert.equal(href.searchParams.get('mode'), slug === 'seedream-5-5' ? null : 't2v');
    if (slug === 'seedream-5-5') {
      const asset = presentation.assets.find(item => item.id === 'after-the-race')!;
      const doc = new JSDOM(renderToStaticMarkup(React.createElement(ModelCinematicZoom, {asset,ui:presentation.ui}))).window.document;
      assert.equal(doc.querySelectorAll('img').length, 1);
      assert.equal(doc.querySelector('img')!.getAttribute('loading'), 'lazy');
      assert.equal(doc.querySelector('.cinema-detail-original'), null);
      assert.equal(doc.querySelector('a')!.getAttribute('href'), asset.original.url);
      const crop = new JSDOM(renderToStaticMarkup(React.createElement(ModelCinematicDetailCrop, {asset,ui:presentation.ui}))).window.document;
      assert.ok(crop.querySelector('.cinema-detail-crop img'), 'The detail is visible before any click');
      assert.equal(crop.querySelector('img')!.getAttribute('loading'), 'lazy');
      assert.equal(new URL(crop.querySelector('img')!.getAttribute('src')!, 'https://maxvideoai.com').searchParams.get('url'), asset.display.url, 'The detail uses the same reviewed image, not a new generation');
      assert.equal(crop.querySelector('[hidden]'), null);
    }
  }
});

test('cinematic pricing removes unavailable repetitions and preserves each exact quoted amount', () => {
  for (const locale of locales) {
    const pricing = { title:'Your settings. Your price.', subtitle:'Choose your settings.', footnote:'Review before creating.', cta:{label:'Pricing',href:'/pricing'}, scenarios:[] };
    const create = {label:'Create',href:'/app/image?engine=seedream-5-5'};
    const unavailable = getPricingHubCopy(locale).liveQuote;
    const missing = ['1K','1.5K','2K'].map(id => ({id,label:id,value:unavailable,note:'Single image'}));
    const render = (scenarios: typeof missing) => new JSDOM(renderToStaticMarkup(React.createElement(NextIntlClientProvider, {locale,messages:{},timeZone:'UTC'},
      React.createElement(ModelCinematicPricing, {pricing,scenarios,create,locale,offer:null})))).window.document;
    const empty = render(missing);
    assert.equal(empty.querySelector('.cinema-price-list'), null);
    assert.equal(empty.body.textContent!.includes(unavailable), false);
    assert.ok(empty.querySelector('a[href="/app/image?engine=seedream-5-5"]'));
    const amounts = ['$0.13', '$0.28'];
    const exact = render(missing.map((item,index) => index < 2 ? {...item,value:amounts[index]} : item));
    assert.deepEqual([...exact.querySelectorAll('.cinema-price-list dd')].map(el => el.textContent), amounts);
    assert.equal(exact.body.textContent!.includes(unavailable), false);
  }
});

test('cinematic content is opt-in and never falls back to another locale', () => {
  const en = read('seedream-5-5');
  assert.equal(mergeEngineLocalizedContent(en, {}).cinematic, undefined);
  assert.equal(parseModelCinematicContent(undefined, 'seedream-5-5'), null);
  assert.throws(() => parseModelCinematicContent(en.cinematic, 'seedream-5-0-pro'));
  for (const locale of locales) {
    const local = read('seedream-5-5', locale);
    const content = parseModelCinematicContent(local.cinematic, 'seedream-5-5')!;
    const examples = parseModelExamplesContent(local.examples, 'seedream-5-5', locale);
    const images = listModelEditorialImages('seedream-5-5', locale, examples.editorialImages);
    const presentation = buildCinematicPresentation(content, examples, images, locale)!;
    assert.equal(presentation.hero.id, '55-above-the-clouds');
    assert.equal(presentation.assets.length, 9);
    for (const placement of ['prompting', 'details']) {
      const placed = presentation.examples.panels.filter(panel => panel.placement === placement);
      assert.equal(placed.length, 1);
      assert.equal(placed[0].assetIds.length, 1);
    }
    assert.throws(() => buildCinematicPresentation(content, { ...examples, cinematic: undefined }, images, locale));
    assert.throws(() => buildCinematicPresentation(content, examples, images.filter(image => image.id !== 'backstage-wardrobe'), locale));
    const duplicate = structuredClone(examples);
    duplicate.cinematic!.panels[1].assetIds = [content.heroAssetId];
    assert.throws(() => buildCinematicPresentation(content, duplicate, images, locale), /one placement/);
    const placements = [content.heroAssetId, ...examples.cinematic!.panels.flatMap(panel => panel.assetIds)];
    assert.deepEqual(new Set(placements), new Set(images.map(image => image.id)), 'All nine reviewed results have a visible placement');
    for (const item of local.prompting.imageExamples.items) {
      assert.equal(presentation.assets.find(asset => asset.id === item.id)?.prompt, item.prompt, 'The text-only Prompt Lab keeps the same original brief as its visual result');
    }
    if (locale !== 'en') assert.notDeepEqual(local.cinematic.subtitle, en.cinematic.subtitle);
  }
});

test('every cinematic pilot retains its complete localized prompt-guide contract', () => {
  for (const locale of locales) for (const slug of ['seedream-5-5', 'seedance-2-5-flash']) {
    assert.ok(parseModelPromptingContent(read(slug, locale).prompting, slug, locale));
  }
});

test('the image introduction and proof links belong to a single enriched hero', () => {
  for (const locale of locales) {
    const local = read('seedream-5-5', locale);
    const content = parseModelCinematicContent(local.cinematic, 'seedream-5-5')!;
    const examples = parseModelExamplesContent(local.examples, 'seedream-5-5', locale);
    const images = listModelEditorialImages('seedream-5-5', locale, examples.editorialImages);
    const presentation = buildCinematicPresentation(content, examples, images, locale)!;
    const decision = buildModelDecisionData({engine:getFalEngineById('seedream-5-5')!,locale,decisionContent:local.decision})!;
    const doc = new JSDOM(renderToStaticMarkup(React.createElement(NextIntlClientProvider, {locale,messages:{},timeZone:'UTC'},
      React.createElement(ModelCinematicHero, {presentation,decision})))).window.document;
    assert.equal(doc.querySelectorAll('.cinema-hero').length, 1);
    assert.equal(doc.querySelectorAll('#overview').length, 1);
    assert.equal(doc.querySelectorAll('.cinema-overview-band').length, 0);
    assert.equal(doc.querySelector('.cinema-hero-intro')?.textContent, content.intro);
    assert.equal(doc.querySelectorAll('.cinema-hero .cinema-benefits a').length, 4);
    for (const link of doc.querySelectorAll('.cinema-benefits a')) {
      const id = link.getAttribute('href')!.replace('#proof-', '');
      assert.ok(examples.cinematic!.panels.some(panel => panel.id === id && !panel.placement));
    }
    assert.equal(doc.querySelectorAll('img').length, 1, 'One optimized hero image');
    assert.equal(doc.querySelector('.cinema-overview-detail'), null, 'No artificial magnification of the hero image');
    assert.equal(doc.querySelector('.cinema-hero-caption a, .cinema-hero dialog, .cinema-hero details'), null);
    const evidence = new JSDOM(renderToStaticMarkup(React.createElement(ModelCinematicOverview, {presentation}))).window.document;
    assert.ok(evidence.querySelector('dialog p[lang=en]')!.textContent!.includes(presentation.hero.prompt));
    assert.equal(evidence.querySelector('dialog')!.hasAttribute('open'), false);
    assert.ok(evidence.querySelector('dialog')!.textContent!.includes(presentation.examples.provenance));
    assert.equal(evidence.querySelector('.cinema-overview-source')!.getAttribute('href'), 'https://seed.bytedance.com/en/seedream5_5');
    assert.ok(!doc.body.textContent?.includes('First light'), 'The old opening is not repeated');
    const missing = structuredClone(content);
    missing.overview!.benefits[0].panelId = 'missing-proof';
    assert.throws(() => buildCinematicPresentation(missing, examples, images, locale), /visible proof panels/);
    const duplicate = structuredClone(content);
    duplicate.overview!.benefits[0].panelId = duplicate.overview!.benefits[1].panelId;
    assert.throws(() => buildCinematicPresentation(duplicate, examples, images, locale), /distinct visible proof panels/);
  }
});

test('each successive edit uses its exact preceding original, not a shared first image', () => {
  const records = parseSeedreamEditorialImages(seedreamRecords);
  const light = records.find(image => image.id === 'backstage-light')!;
  const wardrobe = records.find(image => image.id === 'backstage-wardrobe')!;
  assert.equal(light.sourceImageId, wardrobe.id);
  assert.equal(light.sourceOriginalSha256, wardrobe.original.sha256);
  const wrong = structuredClone(records);
  wrong.find(image => image.id === light.id)!.sourceOriginalSha256 = records.find(image => image.id === 'backstage-original')!.original.sha256;
  assert.throws(() => parseSeedreamEditorialImages(wrong), /exact Seedream edit source/);
  const unverified = structuredClone(records);
  unverified.find(image => image.id === 'free-to-move')!.alphaVerified = false;
  assert.throws(() => parseSeedreamEditorialImages(unverified), /verified native/);
});

test('Flash replaces reviewed start frames with accurately attributed films and retains workspace actions in every locale', () => {
  for (const locale of locales) {
    const content = read('seedance-2-5-flash', locale);
    const examples = parseModelExamplesContent(content.examples, 'seedance-2-5-flash', locale);
    const presentation = buildCinematicPresentation(parseModelCinematicContent(content.cinematic, 'seedance-2-5-flash'), examples, [], locale)!;
    const placements = [presentation.hero.id, ...presentation.examples.panels.flatMap(panel => panel.assetIds)];
    assert.equal(new Set(placements).size, 6);
    assert.equal(placements.length, 6);
    assert.deepEqual(new Set(placements), new Set(startFrames.map(frame => frame.id)));
    assert.ok(presentation.assets.filter(asset => !asset.video).every(asset => asset.metadataLabel.includes('GPT Image 2.6 Sunburst')));
    assert.equal(presentation.assets.filter(asset => asset.video).length, 2);
    assert.ok(presentation.assets.filter(asset => asset.video).every(asset => asset.metadataLabel.includes('Seedance 2.5 Flash') && !asset.creation));
    assert.deepEqual(new Set(presentation.examples.shotPlans!.map(plan => plan.assetId)), new Set(placements.slice(1)));
    const missingTitle = structuredClone(examples);
    missingTitle.cinematic!.assetTitles = [];
    assert.throws(() => buildCinematicPresentation(presentation.content, missingTitle, [], locale), /localized start-frame title/);
    const decision = buildModelDecisionData({engine:getFalEngineById('seedance-2-5-flash')!,locale,decisionContent:content.decision})!;
    const html = renderToStaticMarkup(React.createElement(NextIntlClientProvider, {locale,messages:{},timeZone:'UTC'},
      React.createElement(ModelCinematicHero, {presentation,decision})));
    const doc = new JSDOM(html).window.document;
    assert.equal(doc.querySelectorAll('h1').length, 1);
    assert.equal(doc.querySelectorAll('img').length, 1);
    assert.ok([...doc.querySelectorAll('a')].some(a => a.href.includes('/app?engine=seedance-2-5-flash')));
    assert.equal(doc.querySelector('.cinema-hero-caption'), null);
    assert.equal(doc.querySelector('.cinema-hero-intro')?.textContent, content.cinematic.intro);
    assert.equal(doc.querySelectorAll('.cinema-workflow-nav a').length, 3);
    assert.ok(doc.querySelector('#overview'));
    assert.equal(doc.querySelector('.cinema-hero dialog, .cinema-hero details'), null);
    const provenance = new JSDOM(renderToStaticMarkup(React.createElement(ModelCinematicOverview, {presentation}))).window.document;
    assert.ok(provenance.querySelector('dialog')!.textContent?.includes('GPT Image 2.6 Sunburst'), 'The full image source remains in the server-rendered evidence dialog');
    assert.equal(doc.querySelectorAll('video, script[type="application/ld+json"]').length, 0);
  }
});

test('originals and displays retain measured geometry, immutable hashes and real alpha', async () => {
  for (const image of parseSeedreamEditorialImages(seedreamRecords)) {
    for (const file of [image.original, image.display]) {
      const bytes = readFileSync(filePath(file.url));
      const metadata = await sharp(bytes).metadata();
      assert.equal(metadata.width, file.width, file.url);
      assert.equal(metadata.height, file.height, file.url);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256);
      if (image.alphaVerified) {
        assert.ok(metadata.hasAlpha, file.url);
        const stats = await sharp(bytes).stats();
        assert.equal(stats.isOpaque, false, file.url);
      }
    }
  }
  for (const frame of startFrames) {
    const bytes = readFileSync(filePath(frame.display.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), frame.display.sha256);
    assert.equal(frame.sourceEngineId, 'gpt-image-2-6-sunburst');
    assert.equal(frame.videoUrl, null);
    assert.equal(new URL(frame.original.url).search, '');
  }
});

test('responsive cinematic hero displays retain their exact sources and immutable geometry', async () => {
  const originals = [...parseSeedreamEditorialImages(seedreamRecords), ...startFrames, ...publicProofs];
  for (const asset of heroDisplays.assets) {
    assert.equal(asset.originalSha256, originals.find(original => original.id === asset.id)?.original.sha256);
    assert.equal(asset.desktop.length, 3);
    assert.equal(asset.mobile.length, 2);
    for (const file of [...asset.desktop, ...asset.mobile]) {
      const bytes = readFileSync(filePath(file.url));
      const meta = await sharp(bytes).metadata();
      assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256);
      assert.equal(bytes.length, file.bytes);
      assert.equal(meta.width, file.width);
      assert.equal(meta.height, file.height);
    }
    assert.ok(asset.mobile.every(file => Math.abs(file.width / file.height - asset.crop.width / asset.crop.height) < 0.002));
  }
});

test('cinematic hero remains server-readable with one priority display and canonical actions', () => {
  for (const locale of locales) {
    const content = read('seedream-5-5', locale);
    const examples = parseModelExamplesContent(content.examples, 'seedream-5-5', locale);
    const images = listModelEditorialImages('seedream-5-5', locale, examples.editorialImages);
    const presentation = buildCinematicPresentation(parseModelCinematicContent(content.cinematic, 'seedream-5-5'), examples, images, locale)!;
    const decision = buildModelDecisionData({engine:getFalEngineById('seedream-5-5')!,locale,decisionContent:content.decision})!;
    const html = renderToStaticMarkup(React.createElement(NextIntlClientProvider, {locale,messages:{},timeZone:'UTC'},
      React.createElement(ModelCinematicHero, {presentation,decision})));
    const doc = new JSDOM(html).window.document;
    assert.equal(doc.querySelectorAll('h1').length, 1);
    assert.equal(doc.querySelector('h1')?.textContent, content.cinematic.titleLines.join(' '));
    assert.equal(doc.querySelectorAll('img').length, 1);
    assert.equal(doc.querySelectorAll('img[fetchPriority=high]').length, 1);
    assert.notEqual(doc.querySelector('img')?.getAttribute('loading'), 'lazy');
    assert.equal(doc.querySelector('img')?.getAttribute('fetchPriority'), 'high');
    assert.equal(doc.querySelectorAll('picture source').length, 2);
    const preloads = [...doc.querySelectorAll('link[rel="preload"][as="image"]')];
    assert.equal(preloads.length, 2, 'The picture preloads are mutually exclusive; no competing WebP preload');
    assert.deepEqual(preloads.map(link => link.getAttribute('media')), ['(max-width: 767px)', '(min-width: 768px)']);
    assert.ok(preloads.every(link => link.getAttribute('type') === 'image/avif'));
    assert.ok(doc.querySelector('a[href="#examples"]'));
    assert.ok([...doc.querySelectorAll('a')].some(a => a.href.includes('/app/image?engine=seedream-5-5')));
    assert.equal(doc.querySelectorAll('video, script[type="application/ld+json"]').length, 0);
    const light = presentation.assets.find(asset => asset.id === 'backstage-light')!;
    const promptHtml = renderToStaticMarkup(React.createElement(ModelCinematicPrompt, { asset: light, ui: presentation.ui }));
    const promptDoc = new JSDOM(promptHtml).window.document;
    assert.equal(promptDoc.querySelector('p[lang="en"]')?.textContent, light.prompt);
    assert.ok(promptDoc.querySelector(`a[href="${light.source!.original.url}"]`));
    const reuse = promptDoc.querySelector('.cinema-prompt-dialog-footer a')!;
    assert.equal(new URL(reuse.getAttribute('href')!, 'https://maxvideoai.com').searchParams.get('example'), light.id);
    assert.equal(promptDoc.querySelectorAll('.cinema-prompt-dialog-footer button').length, 1, 'Copy stays available beside reuse');
    const refineHref=new URL(promptDoc.querySelector('.cinema-prompt-refine')!.getAttribute('href')!,'https://maxvideoai.com');
    assert.equal(refineHref.searchParams.get('example'),light.id);
    assert.equal(refineHref.searchParams.get('assistant'),'milo');
    assert.equal(refineHref.searchParams.get('refine'),'example');
    assert.ok(promptDoc.querySelector('.cinema-prompt-settings .cinema-prompt-price'), 'Price belongs with the setting chips');
  }
});

test('cinematic pilots own a separate composition while the legacy model renderer stays isolated', () => {
  const root = 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/';
  const source = (name: string) => readFileSync(root + name, 'utf8');
  const layout = source('MarketingModelPageLayout.tsx');
  const renderer = source('ModelCinematicPage.tsx');
  assert.match(layout, /if \(cinematic && templateData\) return <ModelCinematicPage/);
  assert.match(layout, /<ModelCurrentDetails/);
  assert.doesNotMatch(source('ModelExamplesSection.tsx'), /[Cc]inematic/);
  assert.doesNotMatch(renderer, /ModelPageContentSections|ModelCurrentDetails|ModelDecisionHeroSection|container-page|model-editorial/);
  assert.match(renderer, /content\.variant === 'video' \? <Suspense/, 'Only video details stream; image details remain in the initial visible HTML');
  for (const section of ['ModelCinematicHero', 'ModelCinematicExamples', 'ModelCinematicPrompting', 'ModelCinematicDetails']) assert.match(renderer, new RegExp('<' + section));
  assert.doesNotMatch(source('ModelCinematicHero.tsx'), /<ModelCinematicOverview/, 'The hero has no expanding provenance controls');
  assert.doesNotMatch(source('ModelCinematicExamples.tsx'), /cinema-provenance|<ModelCinematicOverview/, 'No extra disclosure interrupts the visual sequence');
  assert.match(source('ModelCinematicDetails.tsx'), /<ModelCinematicOverview/, 'Supplementary hero evidence remains available with the technical details');
  assert.doesNotMatch(renderer, /<ModelCinematicOverview/, 'No separate provenance band interrupts the transition to examples');
  const details = source('ModelCinematicDetails.tsx');
  assert.match(details, /Promise\.all\(\[pricing, commercial\]\)/);
  assert.match(details, /buildModelSchemaPayloads\(\{ \.\.\.schema, pricingEngine, publicOffer \}\)/);
  assert.match(details, /scenarios \?\? decision\.pricing\.scenarios/);
  assert.match(details, /current\.keySpecRows/);
  assert.match(details, /FAQSchema questions=\{faqList\}/);
  const css = readFileSync('frontend/src/styles/marketing-models-cinematic.css', 'utf8');
  assert.doesNotMatch(css, /\.model-editorial|\.model-page[\s.{]|\.home-monochrome/);
  for (const line of css.split('\n').filter(line => line.includes('>header') && !line.includes('.cinema-faq-grid'))) assert.ok(line.includes(':has(.model-cinematic-page)'), line);
});
