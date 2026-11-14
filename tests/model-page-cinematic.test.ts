import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import seedreamRecords from '../frontend/config/seedream-editorial-images.json';
import startFrames from '../frontend/config/model-cinematic-start-frames.json';
import heroDisplays from '../frontend/config/model-cinematic-hero-displays.json';
import { parseSeedreamEditorialImages } from '../frontend/lib/seedream-editorial-images';
import { mergeEngineLocalizedContent } from '../frontend/lib/models/i18n-normalization';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { parseModelCinematicContent } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-cinematic-content';
import { parseModelExamplesContent } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-examples-content';
import { buildCinematicPresentation } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-cinematic-data';
import { listModelEditorialImages } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-editorial-images';
import { buildModelDecisionData } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-data';
import { ModelCinematicHero } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelCinematicHero';
import { ModelCinematicPrompt } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelCinematicAsset';
import { ModelCinematicWorkflows } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelCinematicWorkflows.client';
import { ModelCinematicZoom } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelCinematicZoom.client';
import { ModelCinematicPromptAssistant } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelCinematicPromptAssistant';

const requireFrontend = createRequire(path.resolve('frontend/package.json'));
const React = requireFrontend('react');
const { renderToStaticMarkup } = requireFrontend('react-dom/server');
const { NextIntlClientProvider } = requireFrontend('next-intl');
const sharp = requireFrontend('sharp');
(globalThis as typeof globalThis & { React: typeof React }).React = React;
const locales = ['en', 'fr', 'es'] as const;
const read = (slug: string, locale = 'en') => JSON.parse(readFileSync(`content/models/${locale}/${slug}.json`, 'utf8'));
const filePath = (url: string) => path.join('frontend/public', url);

test('workflow descriptions remain in server HTML with exact mode entry links', () => {
  for (const locale of locales) {
    const content = read('seedance-2-5-flash', locale).cinematic.workflows;
    const html = renderToStaticMarkup(React.createElement(NextIntlClientProvider, {locale,messages:{},timeZone:'UTC'},
      React.createElement(ModelCinematicWorkflows, {content,workspaceHref:'/app?engine=seedance-2-5-flash'})));
    const doc = new JSDOM(html).window.document;
    const panels = [...doc.querySelectorAll('.cinema-path-body')];
    assert.equal(panels.length, 3);
    assert.deepEqual(panels.map(panel => panel.hasAttribute('hidden')), [false, true, true]);
    assert.deepEqual(panels.map(panel => new URL(panel.querySelector('a')!.href, 'https://maxvideoai.com').searchParams.get('mode')), ['t2v', 'extend', 'v2v']);
    for (const item of content.items) assert.ok(doc.body.textContent?.includes(item.body));
  }
});

test('portrait inspection defers the original and Milo opens the correct model without auto submission', () => {
  for (const locale of locales) for (const slug of ['seedream-5-5', 'seedance-2-5-flash']) {
    const content = read(slug, locale);
    const examples = parseModelExamplesContent(content.examples, slug, locale);
    const images = slug === 'seedream-5-5' ? listModelEditorialImages(slug, locale, examples.editorialImages) : [];
    const presentation = buildCinematicPresentation(parseModelCinematicContent(content.cinematic, slug), examples, images, locale)!;
    const workspace = new JSDOM(renderToStaticMarkup(React.createElement(ModelCinematicPromptAssistant, {content:presentation.content,locale}))).window.document;
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
    }
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
    assert.equal(presentation.hero.id, 'first-light');
    assert.equal(presentation.assets.length, 9);
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

test('Flash uses six unique attributed start frames and retains its video workspace action in every locale', () => {
  for (const locale of locales) {
    const content = read('seedance-2-5-flash', locale);
    const examples = parseModelExamplesContent(content.examples, 'seedance-2-5-flash', locale);
    const presentation = buildCinematicPresentation(parseModelCinematicContent(content.cinematic, 'seedance-2-5-flash'), examples, [], locale)!;
    const placements = [presentation.hero.id, ...presentation.examples.panels.flatMap(panel => panel.assetIds)];
    assert.equal(new Set(placements).size, 6);
    assert.equal(placements.length, 6);
    assert.deepEqual(new Set(placements), new Set(startFrames.map(frame => frame.id)));
    assert.ok(presentation.assets.every(asset => asset.metadataLabel.includes('GPT Image 2.6 Sunburst')));
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
    assert.ok(doc.body.textContent?.includes(content.cinematic.caption));
    const provenance = new JSDOM(renderToStaticMarkup(React.createElement(ModelCinematicPrompt, {asset:presentation.hero,ui:presentation.ui}))).window.document;
    assert.ok(provenance.body.textContent?.includes('GPT Image 2.6 Sunburst'), 'The source remains in the visible hero prompt disclosure below the opening image');
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
  const originals = [...parseSeedreamEditorialImages(seedreamRecords), ...startFrames];
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
    assert.ok(asset.mobile.every(file => asset.id === 'first-light' ? file.height === file.width * 2 : file.width * 9 === file.height * 16));
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
  const details = source('ModelCinematicDetails.tsx');
  assert.match(details, /Promise\.all\(\[pricing, commercial\]\)/);
  assert.match(details, /buildModelSchemaPayloads\(\{ \.\.\.schema, pricingEngine, publicOffer \}\)/);
  assert.match(details, /scenarios \?\? decision\.pricing\.scenarios/);
  assert.match(details, /current\.keySpecRows/);
  assert.match(details, /FAQSchema questions=\{faqList\.slice\(0, 6\)\}/);
  const css = readFileSync('frontend/src/styles/marketing-models-cinematic.css', 'utf8');
  assert.doesNotMatch(css, /\.model-editorial|\.model-page[\s.{]|\.home-monochrome/);
  for (const line of css.split('\n').filter(line => line.includes('>header') && !line.includes('.cinema-faq-grid'))) assert.ok(line.includes(':has(.model-cinematic-page)'), line);
});
