import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { mergeEngineLocalizedContent } from '../frontend/lib/models/i18n-normalization';
import { I18nProvider } from '../frontend/lib/i18n/I18nProvider';
import { ModelDefaultExamplesSection } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelDefaultExamplesSection';
import { ModelDecisionExamplesGallery } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelDecisionExamplesGallery.client';
import { makeModelPagePricingHarness, findModelLayoutElements } from './helpers/model-page-pricing-harness';

const locales = ['en', 'fr', 'es'] as const;
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const requireFrontend = createRequire(resolve('frontend/package.json'));
const {ImageConfigContext} = requireFrontend('next/dist/shared/lib/image-config-context.shared-runtime');
const {imageConfigDefault} = requireFrontend('next/dist/shared/lib/image-config');
const imageConfig = {...imageConfigDefault,...requireFrontend('./next.config.js').images};

async function fixture(modelId: string, locale: typeof locales[number]) {
  const engine = getFalEngineById(modelId)!;
  assert.ok(engine, modelId);
  const english = JSON.parse(await readFile(`content/models/en/${engine.modelSlug}.json`, 'utf8'));
  const local = JSON.parse(await readFile(`content/models/${locale}/${engine.modelSlug}.json`, 'utf8'));
  const localizedContent = mergeEngineLocalizedContent(english, local);
  const isImage = engine.category === 'image';
  const video = (id: string, aspectRatio: string) => ({
    id, engineId: engine.id, engineLabel: 'Fixture model', prompt: 'A product on a tabletop',
    promptExcerpt: 'A product on a tabletop', durationSec: isImage ? 0 : 5, aspectRatio,
    hasAudio: !isImage, thumbUrl: `https://media.maxvideoai.com/fixture/${id}.webp`,
    videoUrl: isImage ? null : `/fixtures/${id}.mp4`, previewVideoUrl: isImage ? null : `/fixtures/${id}-preview.mp4`,
    finalPriceCents: 9999, currency: 'USD',
  });
  const portrait = video('fixture-portrait', '9:16'), landscape = video('fixture-landscape', '16:9');
  return { engine, localizedContent, locale, managed: true,
    detailCopy: { backLabel: 'Back', pricingLinkLabel: 'Pricing', breadcrumb: {home:'Home',models:'Models'} },
    examples: [portrait, {...portrait, id:'wrong-model', engineId:'wan-3'}, {...portrait, id:'not-public'}, landscape],
    // Reverse lookup order deliberately: managed playlist order still owns the cards.
    publicVideos: [landscape, portrait], expectedVideos: [portrait, landscape] };
}

async function layoutProjection(h: any, props: any) {
  const elements = findModelLayoutElements(await h.layout(props));
  const section = elements.find(element => element.name === 'ModelPageContentSections');
  assert.ok(section, 'the real layout must build the examples view model');
  const offer = elements.find(element => ['ModelDecisionPricingCard','ModelPublicOfferLine'].includes(element.name));
  assert.ok(offer?.props.offer, 'this current model retains a visible canonical offer');
  return { viewModel: section.props.examplesProps.viewModel, offer: offer.props.offer,
    pricing: elements.filter(element => element.name === 'ModelDecisionPricingCard').map(element => element.props.pricing),
    schemas: elements.filter(element => element.name === 'script').map(element => JSON.parse(element.props.dangerouslySetInnerHTML.__html)) };
}

test('the real model gallery callback validates and orders cards without requesting unused card quotes', async t => {
  const {harness:h, dispose} = await makeModelPagePricingHarness({executeGallery:true});
  try {
    for (const modelId of ['seedance-2-5', 'gpt-image-2']) for (const locale of locales) await t.test(`${modelId}/${locale}`, async () => {
      const input = await fixture(modelId, locale);
      h.configure(input);
      h.setPublicQuote(async () => ({status:'exact',amountCents:123,currency:'USD'}));
      const result = await h.render(input);
      assert.deepEqual(h.playlistReads, [[`examples-${input.engine.modelSlug}`,200]]);
      assert.deepEqual(h.publicReads, [['fixture-portrait','not-public','fixture-landscape']],
        'wrong models are filtered before public validation; managed media has no static reinjection');
      const base = {en:'models',fr:'modeles',es:'modelos'}[locale];
      const backPath = `${locale === 'en' ? '' : '/'+locale}/${base}/${input.engine.modelSlug}`;
      assert.equal(result.props.canonicalUrl, `https://maxvideoai.com${backPath}`);
      const appPath = input.engine.category === 'image' ? '/app/image' : '/app';
      const consumedCards = result.props.galleryVideos.map(({priceLabel: _unused, ...card}: any) => card);
      assert.deepEqual(consumedCards, input.expectedVideos.map(video => ({
        id:video.id,
        href:appPath === '/app/image' ? `/app/image?job=${video.id}` : `/video/${video.id}?from=${encodeURIComponent(backPath)}`,
        engineLabel:'Fixture model', engineIconId:input.engine.modelSlug, engineBrandId:input.engine.brandId,
        prompt:'A product on a tabletop', promptFull:'A product on a tabletop',
        aspectRatio:video.aspectRatio, durationSec:video.durationSec, hasAudio:video.hasAudio,
        optimizedPosterUrl:video.thumbUrl, rawPosterUrl:video.thumbUrl, videoUrl:video.videoUrl,
        previewVideoUrl:video.previewVideoUrl, recreateHref:`${appPath}?engine=${encodeURIComponent(input.engine.id)}&from=${video.id}`,
      })), 'every card field consumed by the model media and examples readers stays unchanged');
      if (appPath === '/app') assert.equal(result.props.heroMedia.id, 'fixture-portrait', 'managed order also owns the video hero');
      const projection = await layoutProjection(h,result.props);
      const metadata = await h.generateMetadata({params:Promise.resolve({slug:input.engine.modelSlug,locale})});
      assert.equal(metadata.alternates.canonical,result.props.canonicalUrl);
      assert.ok(Object.keys(metadata.alternates.languages).length >= 3);
      assert.equal(h.exampleQuoteCalls.length,0, 'Model examples do not consume card prices; do not quote them after public validation.');
      assert.ok(h.calls.length > 0, 'visible model unit/spec pricing still uses its canonical reader');
      assert.equal(projection.offer.amountCents,123);
      assert.ok(JSON.stringify(projection.schemas).includes('1.23'), 'the current visible offer still reaches JSON-LD');
      h.configure({...input,rate:20});
      h.setPublicQuote(async () => ({status:'exact',amountCents:246,currency:'USD'}));
      const repriced = await h.render(input), repricedProjection = await layoutProjection(h,repriced.props);
      assert.notDeepEqual(repriced.props.keySpecRows,result.props.keySpecRows, 'current visible specs remain sensitive to canonical prices');
      assert.equal(repricedProjection.offer.amountCents,246);
      assert.ok(JSON.stringify(repricedProjection.schemas).includes('2.46'));
      const pricedPresetIds = modelId === 'seedance-2-5'
        ? ['4s-480p','15s-720p-audio','24s-1080p']
        : ['1024x768-high','3840x2160-high'];
      const presetValues = (pricing: any[]) => pricing.flatMap(card => card.scenarios)
        .filter(scenario => pricedPresetIds.includes(scenario.id))
        .map(({id,value}) => ({id,value}));
      assert.deepEqual(presetValues(projection.pricing), pricedPresetIds.map(id => ({id,
        value:{en:'$1.23',fr:'1,23\u00a0$US',es:'USD\u00a01.23'}[locale]})));
      assert.deepEqual(presetValues(repricedProjection.pricing), pricedPresetIds.map(id => ({id,
        value:{en:'$2.46',fr:'2,46\u00a0$US',es:'USD\u00a02.46'}[locale]})),
        'visible decision scenario prices still follow the canonical current quote');
      const otherPresets = (pricing: any[]) => pricing.flatMap(card => card.scenarios)
        .filter(scenario => !pricedPresetIds.includes(scenario.id));
      assert.deepEqual(otherPresets(repricedProjection.pricing),otherPresets(projection.pricing),
        'fixed duration and unavailable multi-image quotes retain their existing presentation');
      assert.deepEqual(repricedProjection.viewModel,projection.viewModel, 'model examples have no dependency on visible price changes');
    });
  } finally {
    await dispose();
  }
});

test('real localized video and image examples readers render identically with and without card price labels', async t => {
  const {harness:h,dispose} = await makeModelPagePricingHarness({executeGallery:true});
  const previousReact = Object.getOwnPropertyDescriptor(globalThis,'React');
  Object.defineProperty(globalThis,'React',{configurable:true,value:React});
  try {
    const fallback = JSON.parse(await readFile('frontend/messages/en.json','utf8'));
    for (const modelId of ['seedance-2-5','gpt-image-2']) for (const locale of locales) await t.test(`${modelId}/${locale}`, async () => {
      const input = await fixture(modelId,locale), dictionary = JSON.parse(await readFile(`frontend/messages/${locale}.json`,'utf8'));
      h.configure(input);
      const result = await h.render(input);
      const priced = await layoutProjection(h,{...result.props,galleryVideos:result.props.galleryVideos.map((card:any)=>({...card,priceLabel:'UNUSED_CARD_PRICE_777'}))});
      const unpriced = await layoutProjection(h,{...result.props,galleryVideos:result.props.galleryVideos.map((card:any)=>({...card,priceLabel:null}))});
      assert.deepEqual(priced.viewModel,unpriced.viewModel);
      const render = (viewModel: any) => renderToStaticMarkup(React.createElement(ImageConfigContext.Provider,{value:imageConfig},React.createElement(I18nProvider,{locale,dictionary,fallback},React.createElement(React.Fragment,null,
        React.createElement(ModelDefaultExamplesSection,{viewModel}),
        React.createElement(ModelDecisionExamplesGallery,{title:viewModel.section.title,intro:viewModel.section.intro,filters:viewModel.filters,...viewModel.decision})))));
      const withPrice = render(priced.viewModel), withoutPrice = render(unpriced.viewModel);
      assert.equal(withPrice,withoutPrice);
      assert.doesNotMatch(withPrice,/UNUSED_CARD_PRICE_777/);
      assert.match(withPrice,/fixture-portrait/);
      assert.match(withPrice,/fixture-landscape/);
      t.diagnostic(`unchanged real readers: ${digest(withPrice)}`);
    });
  } finally {
    previousReact ? Object.defineProperty(globalThis,'React',previousReact) : Reflect.deleteProperty(globalThis,'React');
    await dispose();
  }
});
