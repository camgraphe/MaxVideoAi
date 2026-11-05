import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { build } from 'esbuild';
import { mountToolFixture } from './helpers/tool-selection-fixture';
import { buildSeoMetadata } from '../frontend/lib/seo/metadata';
import { buildFAQJsonLd } from '../frontend/components/seo/FAQSchema';
import { buildToolHowToJsonLd } from '../frontend/src/components/tools/landing/tool-marketing-json-ld';

const files = ['en', 'fr', 'es'] as const;
const root = 'frontend/src/components/tools/';
const paths = ['/tools/character-builder', '/fr/outils/character-builder', '/es/herramientas/character-builder'];
const stubs = {
  'next/image': `import React from 'react';export default function Image({fill,priority,sizes,...p}){return React.createElement('img',{...p,sizes,'data-priority':priority||undefined})}`,
  '@/i18n/navigation': `import React from 'react';export const Link=({prefetch,...p})=>React.createElement('a',p)`,
  './CharacterStudioLanding.module.css': `export default new Proxy({},{get:(_,key)=>key})`,
};

for (const [index, locale] of files.entries()) {
  test(`Character Studio ${locale}: canonical intent, visible answers, step anchors and actual proof survive`, async () => {
    const dictionary = JSON.parse(readFileSync(`frontend/messages/${locale}.json`, 'utf8'));
    const c = dictionary.toolMarketing.characterBuilder;
    const before = JSON.parse(readFileSync('docs/redesign/2026-11-05-character-studio-marketing/seo-before.json','utf8')).pages.find((p: {path:string}) => p.path === paths[index]);
    assert.equal(c.meta.title, before.title);
    const metadata = buildSeoMetadata({ locale, title: c.meta.title, description: c.meta.description, englishPath: '/tools/character-builder' });
    assert.equal(metadata.description, before.description);
    assert.equal(new URL(String(metadata.alternates?.canonical)).pathname, paths[index]);
    for (const [i, l] of files.entries()) assert.equal(new URL(String(metadata.alternates?.languages?.[l])).pathname, paths[i]);
    const f = await mountToolFixture(`import {CharacterBuilderLandingSections} from './src/components/tools/character-builder/landing/CharacterBuilderLandingSections';import dictionary from './messages/${locale}.json';function App(){return <CharacterBuilderLandingSections content={dictionary.toolMarketing.characterBuilder}/>}`, stubs);
    try {
      const doc = f.w.document;
      assert.equal(doc.querySelectorAll('h1').length, 1);
      assert.equal(doc.querySelector('h1').textContent, c.hero.title);
      for (const anchor of ['create', 'looks', 'outputs', 'recast', 'step-1', 'step-2', 'step-3']) assert.ok(doc.getElementById(anchor));
      assert.equal(doc.querySelectorAll('img[data-priority]').length, 1);
      const sheet = doc.querySelector('#outputs img[alt="' + c.studio.sheetAlt + '"]');
      assert.equal(sheet.className, 'contain');
      assert.equal(sheet.getAttribute('loading'), 'lazy');
      assert.equal(doc.querySelectorAll('video').length, 0, 'unpublished films remain explicitly labeled stills');
      assert.match(doc.querySelector('#recast').textContent, new RegExp(c.studio.frameLabel));
      const faq = buildFAQJsonLd(c.faq.items);
      assert.deepEqual([...doc.querySelectorAll('details summary')].map((node: any) => node.textContent.slice(0, -1)), faq.mainEntity.map((item: any) => item.name));
      const howTo = buildToolHowToJsonLd({ canonicalUrl: String(metadata.alternates?.canonical), name: c.meta.howToTitle, description: c.meta.howToDescription, steps: c.howItWorks.steps });
      assert.equal(howTo.step.length, 3);
      for (const link of c.related.guideLinks) assert.ok(doc.querySelector(`a[href="${link.href}"]`));
      assert.ok(doc.querySelector('a[href="/app/tools/character-builder"][data-analytics-event="tool_cta_click"]'));
      assert.equal(doc.querySelector('#recast a[data-analytics-event="tool_cta_click"]').getAttribute('href'), '/app/tools/character-builder?mode=recast');
      assert.equal(f.w.requests.length, 0);
    } finally { await f.close(); }
  });
}

test('Tools presents Character Studio among the large tools before quick and creator cards', async () => {
  const source = readFileSync(root + 'ToolsMarketingHubPage.tsx', 'utf8');
  assert.ok(source.indexOf('<section id="workshops"') < source.indexOf('<CreatorToolsCollection'));
  const f = await mountToolFixture(`import {ToolboxCatalogue} from './src/components/tools/ToolboxCatalogue';function App(){return <ToolboxCatalogue locale="en"/>}`, {
    'next/image': stubs['next/image'],
    'next/link': `import React from 'react';export default ({prefetch,...p})=>React.createElement('a',p)`,
    'next/dynamic': 'export default ()=>()=>null',
    './tools-catalogue.module.css': 'export default new Proxy({},{get:(_,key)=>key})',
  });
  try {
    const first = f.w.document.querySelector('ul a');
    assert.equal(first.getAttribute('href'), '/app/tools/character-builder');
    assert.match(first.textContent, /Character Studio/);
    const video = [...f.w.document.querySelectorAll('button')].find((b: any) => b.textContent === 'Video') as any;
    await f.act(() => video.click());
    assert.equal(video.getAttribute('aria-pressed'), 'true');
    assert.ok(f.w.document.querySelector('a[href="/app/tools/upscale?kind=video"]'));
  } finally { await f.close(); }
});

test('optional demo reader only exposes reviewed public marketing copies and tolerates a catalog failure', async () => {
  const source = await build({ entryPoints: ['frontend/server/character-studio/marketing-demos.ts'], bundle: true, platform: 'node', format: 'cjs', write: false, plugins: [{ name: 'boundaries', setup(b) {
    b.onResolve({filter: /^(server-only|@\/lib\/db|@\/server\/videos)$/}, args => ({path: args.path, namespace: 'test'}));
    b.onLoad({filter: /.*/, namespace: 'test'}, args => ({contents: args.path === 'server-only' ? '' : args.path === '@/lib/db' ? 'export const isDatabaseConfigured=()=>globalThis.fixture.configured;' : 'export const listPlaylistVideos=(...args)=>globalThis.fixture.read(...args);'}));
  }}] });
  const m = {exports: {} as {getCharacterStudioMarketingVideos: () => Promise<unknown[]>}};
  new Function('module', 'exports', source.outputFiles[0].text)(m, m.exports);
  const g = globalThis as any;
  const publicVideo = { id:'5833eee1-6c61-451c-a455-a5b08716cffc',videoUrl:'https://media.maxvideoai.com/marketing-media/copy/video.mp4',thumbUrl:'https://media.maxvideoai.com/marketing-media/copy/poster.webp',visibility:'public'};
  try {
    g.fixture = { configured: false, read: () => { throw Error('unexpected query'); } };
    assert.deepEqual(await m.exports.getCharacterStudioMarketingVideos(), []);
    g.fixture = { configured: true, read: async (slug: string, limit: number) => { assert.equal(slug,'character-studio-recast'); assert.equal(limit,6); return [publicVideo,{...publicVideo,visibility:'private'},{...publicVideo,videoUrl:'https://media.maxvideoai.com/renders/private/video.mp4'},{...publicVideo,id:'unreviewed'},{...publicVideo,thumbUrl:undefined}]; } };
    assert.deepEqual(await m.exports.getCharacterStudioMarketingVideos(), [{key:'dixie',video:publicVideo.videoUrl,poster:publicVideo.thumbUrl}]);
    g.fixture.read = async () => { throw Error('catalog offline'); };
    assert.deepEqual(await m.exports.getCharacterStudioMarketingVideos(), []);
    g.fixture.read = () => new Promise(() => {});
    assert.deepEqual(await m.exports.getCharacterStudioMarketingVideos(), []);
  } finally { delete g.fixture; }
});
