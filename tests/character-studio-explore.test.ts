import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { build } from 'esbuild';
import { mountToolFixture } from './helpers/tool-selection-fixture';

const films = [
  { key: 'dixie', video: 'https://media.maxvideoai.com/marketing-media/dixie/video.mp4', poster: '/dixie.webp' },
  { key: 'vesper', video: 'https://media.maxvideoai.com/marketing-media/vesper/video.mp4', poster: '/vesper.webp' },
];
const stubs = {
  '@/i18n/navigation': `import React from 'react';export const Link=({prefetch,...props})=>React.createElement('a',props)`,
  '@/lib/i18n/I18nProvider': `export const useOptionalI18n=()=>({locale:window.locale});`,
};
const contentImport = "import {CharacterStudioRecastExamples} from './src/components/tools/character-builder/landing/CharacterStudioRecastExamples.client';";

for (const locale of ['en', 'fr', 'es']) {
  test(`Recast proof in ${locale} keeps two original manual readers and an honest app handoff`, async () => {
    const f = await mountToolFixture(`${contentImport}function App(){return <CharacterStudioRecastExamples films={window.films} showLink/>}`, stubs, w => {
      w.films = films; w.locale = locale; w.plays = [];
      w.IntersectionObserver = class { observe(){} disconnect(){} };
      w.HTMLMediaElement.prototype.pause = () => {};
      w.HTMLMediaElement.prototype.load = () => {};
      w.HTMLMediaElement.prototype.play = function(){w.plays.push(this.src);return Promise.resolve();};
    });
    try {
      const doc = f.w.document;
      const readers = [...doc.querySelectorAll('video')];
      assert.equal(readers.length, 2);
      readers.forEach((video: any, i) => {
        assert.equal(video.getAttribute('src'), films[i].video);
        assert.equal(video.getAttribute('preload'), 'none');
        assert.equal(video.getAttribute('poster'), null, 'native poster waits for visibility');
        assert.equal(video.hasAttribute('controls'), true);
        assert.equal(video.hasAttribute('autoplay'), false);
      });
      assert.equal(doc.querySelectorAll('h3').length, 2);
      assert.match(doc.body.textContent, /Dixie/);
      assert.match(doc.body.textContent, /Vesper/);
      assert.doesNotMatch(doc.body.textContent, /Kling|Seedance|\$|1080p|recreat|recréer|recrear/i);
      assert.equal(doc.querySelector('a')?.getAttribute('href'), '/app/tools/character-builder?mode=recast');
      assert.equal(doc.querySelector('[fetchpriority="high"],link[rel="preload"]'), null);
      assert.deepEqual(f.w.plays, []);
      assert.deepEqual(f.w.requests, []);
      f.w.films = [];
      await f.render();
      assert.equal(doc.querySelector('section'), null, 'unavailable public proof stays absent');
    } finally { await f.close(); }
  });
}

test('Explorer opens Recast without applying an inspiration or creating a new character', async () => {
  const f = await mountToolFixture(`
    import {CharacterStudioExplore} from './src/components/tools/character-builder/_components/CharacterStudioExplore.client';
    import {getCharacterStudioCopy} from './src/components/tools/character-builder/_lib/character-studio-copy';
    function App(){return <CharacterStudioExplore copy={getCharacterStudioCopy('fr')} recastExamples={<p data-films>Dixie et Vesper</p>} onNew={()=>window.events.push('new')} onChoose={name=>window.events.push(name)} onRecast={()=>window.events.push('recast')}/>}
  `, {}, w => { w.events = []; });
  try {
    const doc = f.w.document;
    assert.ok(doc.querySelector('[data-films]'));
    const button = [...doc.querySelectorAll('button')].find((node: any) => node.textContent.trim() === 'Recast') as any;
    await f.act(() => button.click());
    assert.deepEqual([...f.w.events], ['recast']);
    assert.equal(f.w.requests.length, 0);
  } finally { await f.close(); }
});

test('public films remove gallery duplicates without changing the public catalog or requiring unavailable proof', async () => {
  const result = await build({
    entryPoints: ['frontend/src/components/tools/character-builder/landing/CharacterStudioPublicFilms.tsx'],
    bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', write: false,
    plugins: [{ name: 'public-proof', setup(b) {
      b.onResolve({ filter: /^(?:@\/server\/character-studio\/marketing-demos|\.\/CharacterStudioRecastExamples.client)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: args.path.includes('marketing-demos')
        ? 'export const getCharacterStudioMarketingVideos=async()=>globalThis.__exploreFilms;'
        : 'export const CharacterStudioRecastExamples=()=>null;' }));
    }}],
  });
  const m = { exports: {} as { CharacterStudioPublicFilms: (props: Record<string, unknown>) => Promise<any> } };
  new Function('module', 'exports', 'require', result.outputFiles[0].text)(m, m.exports, () => { throw Error('unexpected dependency'); });
  const g = globalThis as typeof globalThis & { __exploreFilms?: typeof films };
  try {
    g.__exploreFilms = films;
    const view = await m.exports.CharacterStudioPublicFilms({ locale: 'es', showLink: true, excludedVideoUrls: [films[0].video] });
    assert.deepEqual(view.props.films, [films[1]]);
    assert.equal(view.props.locale, 'es');
    assert.equal(view.props.showLink, true);
    assert.equal(await m.exports.CharacterStudioPublicFilms({ excludedVideoUrls: films.map(film => film.video) }), null);
    g.__exploreFilms = [];
    assert.equal(await m.exports.CharacterStudioPublicFilms({}), null);
  } finally { delete g.__exploreFilms; }
});

test('optional public proof streams after the unchanged gallery and never gates workspace entry', () => {
  const route = readFileSync('frontend/app/(core)/(workspace)/app/tools/character-builder/page.tsx', 'utf8');
  const view = readFileSync('frontend/app/(localized)/[locale]/(marketing)/examples/_components/examples-page-view.tsx', 'utf8');
  assert.match(route, /recastExamples=\{<Suspense fallback=\{null\}><CharacterStudioPublicFilms/);
  assert.doesNotMatch(route, /await|getCharacterStudioMarketingVideos/);
  assert.ok(view.indexOf('<ExamplesGallerySection') < view.indexOf('<ExamplesPaginationNav'));
  assert.ok(view.indexOf('<ExamplesPaginationNav') < view.indexOf('<CharacterStudioPublicFilms'));
  assert.match(view, /!isModelLanding && !selectedEngine && currentPage === 1 && sort === 'playlist'/);
  assert.match(view, /excludedVideoUrls=\{initialExamples\.flatMap/);
  assert.match(view, /id="character-studio" className="scroll-mt-24"/);
  assert.match(view, /<Suspense fallback=\{null\}>/);
});

for (const locale of ['en', 'fr', 'es']) test(`the ${locale} new-character editor exposes inspirations before any generation`, async () => {
  const f = await mountToolFixture(`
    import {CharacterStudioComposer} from './src/components/tools/character-builder/_components/CharacterStudioComposer.client';
    import {CharacterStudioExplore} from './src/components/tools/character-builder/_components/CharacterStudioExplore.client';
    import {getCharacterStudioCopy} from './src/components/tools/character-builder/_lib/character-studio-copy';
    import {DEFAULT_CHARACTER_COPY} from './src/components/tools/character-builder/_lib/character-builder-copy';
    import {createDefaultCharacterBuilderState} from './src/lib/character-builder';
    function App(){const [exploring,setExploring]=React.useState(false);const copy=getCharacterStudioCopy(window.locale);return exploring
      ? <CharacterStudioExplore copy={copy} onNew={()=>{}} onChoose={name=>window.chosen=name}/>
      : <CharacterStudioComposer state={{...createDefaultCharacterBuilderState(),characterId:window.characterId}} setState={()=>{}}
          copy={DEFAULT_CHARACTER_COPY} labels={copy} locale={window.locale} navigation={null} identitySlot={null} styleSlot={null}
          onExplore={()=>setExploring(true)} price={0.07} busy={false} canGenerate onGenerate={()=>window.generated=true}/>}
  `, {}, w => {w.locale=locale;w.characterId=null;});
  try {
    const doc=f.w.document;
    const text=locale==='fr'?'Voir des inspirations':locale==='es'?'Ver inspiraciones':'Explore inspirations';
    const button=[...doc.querySelectorAll('button')].find((node:any)=>node.textContent===text) as any;
    assert.ok(button,'a named inspiration action is available in the editor');
    await f.act(()=>button.click());
    const noor=[...doc.querySelectorAll('button')].find((node:any)=>node.getAttribute('aria-label')?.endsWith('Noor')) as any;
    assert.ok(noor,'the action opens the actual inspiration list');
    await f.act(()=>noor.click());
    assert.equal(f.w.chosen,'Noor');
    assert.equal(f.w.generated,undefined);
    assert.equal(f.w.requests.length,0);
  } finally {await f.close();}
});
