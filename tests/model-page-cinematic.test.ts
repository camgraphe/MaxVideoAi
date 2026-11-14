import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import seedreamRecords from '../frontend/config/seedream-editorial-images.json';
import startFrames from '../frontend/config/model-cinematic-start-frames.json';
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

const requireFrontend = createRequire(path.resolve('frontend/package.json'));
const React = requireFrontend('react');
const { renderToStaticMarkup } = requireFrontend('react-dom/server');
const { NextIntlClientProvider } = requireFrontend('next-intl');
const sharp = requireFrontend('sharp');
(globalThis as typeof globalThis & { React: typeof React }).React = React;
const locales = ['en', 'fr', 'es'] as const;
const read = (slug: string, locale = 'en') => JSON.parse(readFileSync(`content/models/${locale}/${slug}.json`, 'utf8'));
const filePath = (url: string) => path.join('frontend/public', url);

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
    const promptingImages = local.prompting.imageExamples.items.map((item: {id:string}) => item.id);
    assert.ok(examples.cinematic!.panels.flatMap(panel => panel.assetIds).every(id => !promptingImages.includes(id)), 'Prompt Lab retains its own unique visuals');
    if (locale !== 'en') assert.notDeepEqual(local.cinematic.headline, en.cinematic.headline);
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
      React.createElement(ModelCinematicHero, {presentation,decision,modelName:'Seedance 2.5 Flash',modelsLabel:'Models',modelsHref:'/models'})));
    const doc = new JSDOM(html).window.document;
    assert.equal(doc.querySelectorAll('h1').length, 1);
    assert.equal(doc.querySelectorAll('img').length, 1);
    assert.ok([...doc.querySelectorAll('a')].some(a => a.href.includes('/app?engine=seedance-2-5-flash')));
    assert.ok(doc.body.textContent?.includes('GPT Image 2.6 Sunburst'));
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

test('cinematic hero remains server-readable with one priority display and canonical actions', () => {
  for (const locale of locales) {
    const content = read('seedream-5-5', locale);
    const examples = parseModelExamplesContent(content.examples, 'seedream-5-5', locale);
    const images = listModelEditorialImages('seedream-5-5', locale, examples.editorialImages);
    const presentation = buildCinematicPresentation(parseModelCinematicContent(content.cinematic, 'seedream-5-5'), examples, images, locale)!;
    const decision = buildModelDecisionData({engine:getFalEngineById('seedream-5-5')!,locale,decisionContent:content.decision})!;
    const html = renderToStaticMarkup(React.createElement(NextIntlClientProvider, {locale,messages:{},timeZone:'UTC'},
      React.createElement(ModelCinematicHero, {presentation,decision,modelName:'Seedream 5.5',modelsLabel:'Models',modelsHref:'/models'})));
    const doc = new JSDOM(html).window.document;
    assert.equal(doc.querySelectorAll('h1').length, 1);
    assert.equal(doc.querySelector('h1')?.textContent, content.decision.hero.title);
    assert.equal(doc.querySelectorAll('img').length, 1);
    assert.notEqual(doc.querySelector('img')?.getAttribute('loading'), 'lazy');
    assert.ok(doc.querySelector('a[href="#examples"]'));
    assert.ok(doc.querySelector('a[href="#decision-pricing"]'));
    assert.ok([...doc.querySelectorAll('a')].some(a => a.href.includes('/app/image?engine=seedream-5-5')));
    assert.equal(doc.querySelectorAll('video, script[type="application/ld+json"]').length, 0);
    const light = presentation.assets.find(asset => asset.id === 'backstage-light')!;
    const promptHtml = renderToStaticMarkup(React.createElement(ModelCinematicPrompt, { asset: light, ui: presentation.ui }));
    const promptDoc = new JSDOM(promptHtml).window.document;
    assert.equal(promptDoc.querySelector('p[lang="en"]')?.textContent, light.prompt);
    assert.ok(promptDoc.querySelector(`a[href="${light.source!.original.url}"]`));
  }
});
