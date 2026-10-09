import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import test from 'node:test';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import * as React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {HomeHero} from '../frontend/components/marketing/home/HomeHeroSection';
import {HomeCreativeWorlds} from '../frontend/components/marketing/home/HomeCreativeWorlds';
import {I18nProvider} from '../frontend/lib/i18n/I18nProvider';
import {buildHeroContent} from '../frontend/app/(localized)/[locale]/(marketing)/(home)/_lib/home-route-data/hero';
import {assembleHomepageExampleCards} from '../frontend/app/(localized)/[locale]/(marketing)/(home)/_lib/home-route-data/examples';
import type {RedesignContent} from '../frontend/app/(localized)/[locale]/(marketing)/(home)/_lib/home-route-data/types';
import type {HomeExampleCard} from '../frontend/components/marketing/home/home-redesign-types';
import type {GalleryVideo} from '../frontend/server/videos';
import type {CurrentExamplePrice} from '../frontend/server/current-example-price';
import type {loadHomePageData} from '../frontend/app/(localized)/[locale]/(marketing)/(home)/_lib/home-page-data';

const requireFrontend = createRequire(resolve('frontend/package.json'));
const {ImageConfigContext} = requireFrontend('next/dist/shared/lib/image-config-context.shared-runtime');
const {imageConfigDefault} = requireFrontend('next/dist/shared/lib/image-config');
const imageConfig = {...imageConfigDefault, ...requireFrontend('./next.config.js').images};
const videos = ['kling-3-pro', 'seedance-2-0', 'veo-3-1'].map((engineId) => ({
  id: 'fixture-'+engineId, engineId, engineLabel: engineId, thumbUrl: 'https://media.maxvideoai.com/fixture/'+engineId+'.webp',
  videoUrl: 'https://media.maxvideoai.com/fixture/'+engineId+'.mp4', durationSec: 5, aspectRatio: '16:9',
  finalPriceCents: 9999, currency: 'USD', prompt: 'Public fixture',
})) as GalleryVideo[];

async function bundle() {
  const directory = await mkdtemp(join(tmpdir(), 'home-unused-example-pricing-'));
  const output = join(directory, 'home.cjs');
  const mocks: Record<string, string> = {
    probe: `export const quoteCalls=[], demoCalls=[];export const videos=${JSON.stringify(videos)};`,
    '@/server/videos': `import {videos} from 'probe';export const listExamples=async()=>videos;export const listExampleFamilyPage=async()=>({items:[],total:0,limit:24,offset:0,hasMore:false});export const listPlaylistVideos=async()=>[];`,
    '@/server/model-launch-assets': `export const ACCEPTED_DURABLE_MODEL_ASSETS=[];`,
    '@/server/current-example-price': `import {quoteCalls} from 'probe';export async function quoteCurrentExamplePrices(rows){quoteCalls.push(rows);return new Map(rows.map(row=>[row.id,{kind:'reference',amountCents:777,currency:'USD',modelId:row.engineId,scenarioLabel:'Text to video · 5s · 1080p'}]));}`,
    '@/server/pricing/quote-public-model-scenario': `import {demoCalls} from 'probe';export async function quotePublicModelScenario(input){demoCalls.push(input);return {status:'exact',amountCents:input.durationSec*100,currency:'USD',revision:'fixture',scenarioLabel:'Public fixture'};}`,
  };
  try {
    await build({
      stdin: {contents: `export {loadHomepageExamples} from './frontend/app/(localized)/[locale]/(marketing)/(home)/_lib/home-route-data/examples';export {loadHomePageData} from './frontend/app/(localized)/[locale]/(marketing)/(home)/_lib/home-page-data';export * from 'probe';`, resolveDir: process.cwd()},
      outfile: output, bundle: true, platform: 'node', format: 'cjs', packages: 'external', tsconfig: 'frontend/tsconfig.json',
      define: {'import.meta.url': JSON.stringify(pathToFileURL(resolve('frontend/server/video-keyframes.ts')).href)},
      plugins: [{name: 'home-network-boundaries', setup(builder) {
        builder.onResolve({filter: /.*/}, args => {
          if (args.path in mocks) return {path: args.path, namespace: 'boundary'};
          if (/home-route-data\/hero$/.test(args.path)) return {path: 'hero-slots', namespace: 'boundary'};
          if (/compare-page-data-loaders$/.test(args.path)) return {path: 'scores', namespace: 'boundary'};
          if (!args.path.startsWith('.') && !args.path.startsWith('/') && !args.path.startsWith('@/') && !args.path.startsWith('node:')) return {path: requireFrontend.resolve(args.path), external: true};
        });
        builder.onLoad({filter: /.*/, namespace: 'boundary'}, args => ({loader: 'js', resolveDir: process.cwd(), contents: mocks[args.path]
          ?? (args.path === 'hero-slots' ? `export const loadProgrammedHomepageHeroSlots=async()=>[];` : `export const loadEngineScores=async()=>new Map();`)}));
      }}],
    });
    return {directory, reader: requireFrontend(output) as {
      quoteCalls: GalleryVideo[][]; demoCalls: Array<{modelId: string; mode: string; durationSec: number; resolution: string; audio: boolean}>;
      loadHomepageExamples: typeof import('../frontend/app/(localized)/[locale]/(marketing)/(home)/_lib/home-route-data/examples').loadHomepageExamples;
      loadHomePageData: typeof loadHomePageData;
    }};
  } catch (failure) {await rm(directory, {recursive: true, force: true});throw failure;}
}

test('home example selection never quotes card prices while hero and demonstration retain their own quotes', async (t) => {
  const {directory, reader} = await bundle();
  try {
    for (const locale of ['en', 'fr', 'es'] as const) await t.test(locale, async () => {
      const content = JSON.parse(await readFile('frontend/messages/'+locale+'.json', 'utf8')).home.redesign as RedesignContent;
      reader.quoteCalls.length = 0;
      const phases: string[] = [];
      const cards = await reader.loadHomepageExamples(locale, content, {acceptedAssets: [], measure: async (phase, load) => {phases.push(phase);return load();}});
      assert.equal(reader.quoteCalls.length, 0, 'The current homepage readers do not consume these card prices.');
      assert.deepEqual(cards, assembleHomepageExampleCards({locale, content, globalCandidates: [...videos, ...videos], familyVideos: new Map(), acceptedAssets: []}));
      assert.deepEqual(phases, ['example-latest', 'example-playlist', 'example-families', 'example-promotions']);
      assert.ok(cards.some(card => card.sourceVideoId?.startsWith('fixture-')), 'The proof must include a selected real candidate, not only fallbacks.');
      reader.quoteCalls.length = 0;reader.demoCalls.length = 0;
      const data = await reader.loadHomePageData(locale, content);
      assert.deepEqual(data.examples, cards);
      assert.deepEqual(reader.quoteCalls.map(rows => rows.map(row => [row.id, row.engineId, row.durationSec])), [
        content.hero.mockup.engineRecommendations.map(item => [item.engineId, item.engineId, 0]),
      ], 'Hero quotes still receive their same model-based reference scenarios.');
      assert.ok([...data.currentHeroPrices.values()].every(price => price.kind === 'reference' && price.amountCents === 777));
      assert.deepEqual(reader.demoCalls, [
        {modelId: 'wan-3', mode: 't2v', durationSec: 5, resolution: '720p', audio: true},
        {modelId: 'wan-3', mode: 't2v', durationSec: 15, resolution: '720p', audio: true},
        {modelId: 'wan-3', mode: 't2v', durationSec: 15, resolution: '1080p', audio: true},
      ]);
      assert.deepEqual(data.currentPriceModels[0].steps.map(step => step.amountCents), [500, 1500, 1500]);
    });
  } finally {await rm(directory, {recursive: true, force: true});}
});

test('real localized home consumers ignore example-card prices and still render current hero prices', async (t) => {
  const previousReact = Object.getOwnPropertyDescriptor(globalThis, 'React');
  Object.defineProperty(globalThis, 'React', {configurable: true, value: React});
  try {
    const english = JSON.parse(await readFile('frontend/messages/en.json', 'utf8'));
    for (const locale of ['en', 'fr', 'es'] as const) await t.test(locale, async () => {
      const dictionary = JSON.parse(await readFile('frontend/messages/'+locale+'.json', 'utf8'));
      const content = dictionary.home.redesign as RedesignContent;
      const cards = assembleHomepageExampleCards({locale, content, globalCandidates: videos, familyVideos: new Map(), acceptedAssets: []});
      const quote: CurrentExamplePrice = {kind: 'reference', amountCents: 141, currency: 'USD', modelId: 'minimax-h3-max', scenarioLabel: 'Text to video · 5s · 1080p'};
      const heroPrices = new Map([['minimax-h3-max', quote]]);
      const render = (examples: HomeExampleCard[], prices = heroPrices) => renderToStaticMarkup(React.createElement(ImageConfigContext.Provider, {value: imageConfig}, React.createElement(I18nProvider,
        {locale, dictionary, fallback: english}, React.createElement(React.Fragment, null,
          React.createElement(HomeHero, {locale, copy: buildHeroContent(locale, content), previews: examples, currentHeroPrices: prices}),
          React.createElement(HomeCreativeWorlds, {locale, cards: [], examples, providers: [], examplesCopy: content.examples})))));
      const unpriced = render(cards.map(card => ({...card, price: null})));
      const priced = render(cards.map(card => ({...card, price: 'UNUSED_CARD_PRICE_777'})));
      assert.equal(priced, unpriced, 'The real hero, gallery and discovery markup cannot depend on example card prices.');
      assert.doesNotMatch(priced, /UNUSED_CARD_PRICE_777/);
      assert.match(priced, /data-analytics-event="example_category_click"/);
      assert.match(priced, /data-analytics-event="hero_start_render_click"/);
      assert.notEqual(render(cards, new Map([['minimax-h3-max', {...quote, amountCents: 321}]])), unpriced, 'The current hero price is still a rendered input.');
    });
  } finally {previousReact ? Object.defineProperty(globalThis, 'React', previousReact) : Reflect.deleteProperty(globalThis, 'React');}
});
