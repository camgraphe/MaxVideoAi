import assert from 'node:assert/strict';
import test from 'node:test';
import { mountToolFixture } from './helpers/tool-selection-fixture';

const characterOriginal = 'https://private.invalid/character/original.png';
const characterThumbnail = 'https://private.invalid/character/thumbnail.png?signature=temporary';
const recastOriginal = 'https://private.invalid/recast/original.mp4';
const recastPreview = 'https://private.invalid/recast/preview.mp4?signature=temporary';
const canonicalId = `ma_${'a'.repeat(32)}`;
const copiedOriginal = 'https://private.invalid/library/saved-original';
const stubs = {
  '@/hooks/useRequireAuth': 'export const useRequireAuth=()=>({user:{id:window.account},session:{access_token:`token-${window.account}`},loading:false});',
  '@/lib/i18n/I18nProvider': 'export const useI18n=()=>({locale:"en"});',
  '@/lib/supabaseClientLoader': 'export const loadSupabaseClient=async()=>({auth:{getSession:()=>window.getSession()}});',
  '@/lib/authFetch': 'export const authFetch=(url,init)=>window.fixtureFetch(url,init);',
  '@/content/feature-flags': 'export const FEATURES={studio:{maxVideoAiEditor:true}};',
  'next/navigation': 'export const useRouter=()=>({push:url=>window.navigations.push(url)});',
  'next/link': 'import React from "react";export default p=>React.createElement("a",{href:p.href},p.children);',
  'next/dynamic': 'import React,{lazy,Suspense} from "react";export default load=>{const Component=lazy(()=>load().then(value=>({default:value})));return props=>React.createElement(Suspense,{fallback:null},React.createElement(Component,props));};',
  './SeedanceDraftFinalAction.client': 'export const SeedanceDraftFinalAction=()=>null;',
};

function mount(surface: 'character' | 'recast' = 'character', resultId = 'character-job:result:2') {
  return mountToolFixture(`
    import {CharacterContinuation} from './src/components/tools/character-builder/_components/CharacterContinuation.client';
    import {GalleryMediaActionPanel} from './components/library/GalleryMediaActionPanel.client';
    import {galleryMediaAssets} from './components/library/gallery-media-assets';
    function App() {
      if (window.surface === 'recast') {
        const assets = galleryMediaAssets({id:'recast-job',members:[{id:'recast-job',jobId:'recast-job',status:'completed',videoUrl:'${recastOriginal}',thumbUrl:'${recastPreview}'}]}, 'video');
        return <GalleryMediaActionPanel assets={assets} onClose={noop} onPreview={noop} />;
      }
      return <CharacterContinuation result={{id:window.resultId,jobId:'character-job',url:window.original,thumbUrl:'${characterThumbnail}',engineId:'nano-banana-2-1',runId:'run',createdAt:'2026-11-06',action:'generate',outputMode:'portrait-reference',qualityMode:'final'}} />;
    }
  `, stubs, w => {
    w.account = 'account-a';
    w.sessionOwner = 'account-a';
    w.getSession = async () => ({data:{session:{user:{id:w.sessionOwner},access_token:`token-${w.sessionOwner}`}}});
    w.navigations = [];
    w.surface = surface;
    w.resultId = resultId;
    w.original = characterOriginal;
  });
}

type Fixture = Awaited<ReturnType<typeof mount>>;

function studioSummary(f: Fixture): HTMLElement {
  const summary = Array.from(f.w.document.querySelectorAll('summary') as NodeListOf<HTMLElement>).find(item => item.textContent === 'Use in Studio');
  assert.ok(summary, 'an owned job with an original should offer Studio');
  return summary;
}

async function openStudio(f: Fixture) {
  await f.act(async () => {
    studioSummary(f).click();
    await new Promise(resolve => setTimeout(resolve, 0));
  });
}

function assertOwner(request: any, owner = 'account-a') {
  assert.equal(request.init.headers.get('Authorization'), `Bearer token-${owner}`);
  assert.equal(request.init.credentials, 'same-origin');
  assert.equal(request.init.headers.get('x-maxvideoai-auth-mode'), 'bearer');
}

function originalRequest(f: Fixture, jobId: string, kind: string) {
  const request = f.w.requests.at(-1);
  const url = new URL(request.url, 'https://app.invalid');
  assert.equal(url.pathname, '/api/media-library/recent-outputs');
  assert.equal(url.searchParams.get('jobId'), jobId);
  assert.equal(url.searchParams.get('kind'), kind);
  return request;
}

async function promote(f: Fixture, jobId: string, outputId: string, kind: string, owner = 'account-a') {
  const save = f.w.requests.at(-1);
  assert.equal(save.url, '/api/media-library/save-output');
  assert.deepEqual(JSON.parse(save.init.body), {jobId, outputId});
  assertOwner(save, owner);
  await f.respond(save, {ok:true,asset:{id:`output:${outputId}`,url:copiedOriginal,jobId,sourceOutputId:outputId}});
  const assets = f.w.requests.at(-1);
  const url = new URL(assets.url, 'https://app.invalid');
  assert.equal(url.pathname, '/api/media-library/assets');
  assert.equal(url.searchParams.get('originUrl'), copiedOriginal);
  assert.equal(url.searchParams.get('kind'), kind);
  assertOwner(assets, owner);
  return assets;
}

async function chooseFilmAndApply(f: Fixture, kind: 'image' | 'video', offset: number) {
  const [projects, media] = f.w.requests.slice(offset);
  assert.equal(f.w.requests.length, offset + 2);
  assert.equal(projects.url, '/api/studio/conversation-projects');
  assert.equal(media.url, '/api/studio/media/resolve');
  const ref = {type:'asset',assetId:canonicalId,kind};
  assert.deepEqual(JSON.parse(media.init.body), {refs:[ref]});
  assertOwner(projects);
  assertOwner(media);
  await f.respond(projects, {ok:true,projects:[{id:'film',name:'Film'}]});
  await f.respond(media, {ok:true,assets:[{ref,kind,url:copiedOriginal,mediaFacts:{source:'probe',durationSec:7}}]});
  const filmSelect = studioSummary(f).parentElement!.querySelector('select')!;
  assert.equal(filmSelect.value, '', 'film must be selected by the user');
  await f.act(async () => {
    filmSelect.value = 'film';
    filmSelect.dispatchEvent(new f.w.Event('change',{bubbles:true}));
  });
  const timeline = f.w.requests.at(-1);
  assert.equal(timeline.url, '/api/studio/projects/film/conversation-timeline?preview=1');
  assertOwner(timeline);
  await f.respond(timeline, {ok:true,result:{data:{sequenceId:'sequence',revision:3},settings:{fps:24},items:[]}});
  assert.equal(f.w.requests.length, offset + 3, 'choosing a film cannot edit it');
  const apply = Array.from(studioSummary(f).parentElement!.querySelectorAll('button')).find(button => button.textContent === 'Apply to film');
  assert.ok(apply && !apply.disabled);
  await f.act(async () => apply.click());
  const request = f.w.requests.at(-1);
  assert.equal(request.url, '/api/studio/projects/film/conversation-timeline');
  assertOwner(request);
  const body = JSON.parse(request.init.body);
  assert.equal(body.sequenceId, 'sequence');
  assert.equal(body.expectedRevision, 3);
  assert.deepEqual(body.edit, {kind:'insert',ref,startFrame:0,durationFrames:kind === 'image' ? 120 : 168});
  await f.respond(request, {ok:true,result:{revision:4}});
  assert.match(studioSummary(f).parentElement!.textContent!, /Saved in the film/);
  assert.equal(f.w.requests.length, offset + 4, 'applying requests only the Studio edit');
  assert.deepEqual(f.w.navigations, []);
}

for (const id of ['character-job:result:2', 'character-job:historical:2']) {
  test(`Character ${id} promotes the selected ready original and requires explicit Studio apply`, async () => {
    const f = await mount('character', id);
    try {
      assert.ok(studioSummary(f));
      assert.equal(f.w.requests.length, 0);
      await openStudio(f);
      const request = originalRequest(f, 'character-job', 'image');
      assertOwner(request);
      assert.equal(f.w.requests.length, 1);
      assert.equal(studioSummary(f).parentElement!.querySelector('select'), null);
      await f.respond(request, {ok:true,outputs:[
        {id:'sibling-output',jobId:'character-job',kind:'image',url:'https://private.invalid/character/sibling.png',status:'ready'},
        {id:'thumbnail-output',jobId:'character-job',kind:'image',url:characterThumbnail,status:'ready'},
        {id:'selected-output',jobId:'character-job',kind:'image',url:characterOriginal,status:'ready'},
      ]});
      const library = await promote(f, 'character-job', 'selected-output', 'image');
      await f.respond(library, {ok:true,assets:[{assetId:canonicalId,url:copiedOriginal,kind:'image',jobId:'character-job',sourceOutputId:'selected-output'}]});
      await chooseFilmAndApply(f, 'image', 3);
    } finally { await f.close(); }
  });
}

test('completed Recast gallery dialog opens the same picker with the saved video original', async () => {
  const f = await mount('recast');
  try {
    assert.ok(f.w.document.querySelector('[role="dialog"]'));
    assert.ok(studioSummary(f));
    assert.deepEqual(f.w.requests.map((request: any) => request.url), ['/api/engines']);
    await f.respond(f.w.requests[0], {ok:true,engines:[]});
    await openStudio(f);
    const request = originalRequest(f, 'recast-job', 'video');
    await f.respond(request, {ok:true,outputs:[
      {id:'playback-preview',jobId:'recast-job',kind:'video',url:recastPreview,status:'ready'},
      {id:'recast-output',jobId:'recast-job',kind:'video',url:recastOriginal,status:'ready'},
    ]});
    const library = await promote(f, 'recast-job', 'recast-output', 'video');
    await f.respond(library, {ok:true,assets:[{assetId:canonicalId,url:copiedOriginal,kind:'video',jobId:'recast-job',sourceOutputId:'recast-output'}]});
    await chooseFilmAndApply(f, 'video', 4);
  } finally { await f.close(); }
});

test('missing exact originals and unrelated promoted assets fail visibly without opening the picker', async () => {
  const f = await mount();
  try {
    await openStudio(f);
    const initial = originalRequest(f, 'character-job', 'image');
    await f.respond(initial, {ok:true,outputs:[{id:'thumb',jobId:'character-job',kind:'image',url:characterThumbnail,status:'ready'},
      {id:'pending',jobId:'character-job',kind:'image',url:characterOriginal,status:'pending'}]});
    const picker = studioSummary(f).parentElement!;
    assert.ok(picker.querySelector('[role="alert"]'));
    assert.equal(picker.querySelector('select'), null);
    assert.equal(f.w.requests.length, 1);
    const reload = Array.from(picker.querySelectorAll('button')).find(button => button.textContent === 'Reload');
    assert.ok(reload);
    await f.act(async () => reload.click());
    await f.respond(originalRequest(f, 'character-job', 'image'), {ok:true,outputs:[{id:'selected-output',jobId:'character-job',kind:'image',url:characterOriginal,status:'ready'}]});
    const library = await promote(f, 'character-job', 'selected-output', 'image');
    await f.respond(library, {ok:true,assets:[{assetId:canonicalId,url:copiedOriginal,kind:'image',jobId:'character-job',sourceOutputId:'wrong-output'}]});
    assert.ok(picker.querySelector('[role="alert"]'));
    assert.equal(picker.querySelector('select'), null);
    assert.equal(f.w.requests.length, 4);
  } finally { await f.close(); }
});

test('account change aborts a pending lookup and leaves the new account free to choose Studio', async () => {
  const f = await mount();
  try {
    await openStudio(f);
    const previous = originalRequest(f, 'character-job', 'image');
    f.w.account = f.w.sessionOwner = 'account-b';
    await f.render();
    assert.equal(previous.init.signal.aborted, true);
    await f.respond(previous, {ok:true,outputs:[{id:'old-output',jobId:'character-job',kind:'image',url:characterOriginal,status:'ready'}]});
    assert.equal(f.w.requests.length, 1);
    await openStudio(f);
    assertOwner(originalRequest(f, 'character-job', 'image'), 'account-b');
    assert.equal(f.w.requests.length, 2);
  } finally { await f.close(); }
});

test('late promotion cannot load the picker after the source changes or unmounts', async () => {
  const f = await mount();
  try {
    await openStudio(f);
    await f.respond(originalRequest(f, 'character-job', 'image'), {ok:true,outputs:[{id:'old-output',jobId:'character-job',kind:'image',url:characterOriginal,status:'ready'}]});
    const save = f.w.requests.at(-1);
    assert.equal(save.url, '/api/media-library/save-output');
    f.w.original = 'https://private.invalid/character/replacement.png';
    await f.render();
    assert.equal(save.init.signal.aborted, true);
    await f.respond(save, {ok:true,asset:{id:'output:old-output',url:copiedOriginal,jobId:'character-job',sourceOutputId:'old-output'}});
    assert.equal(f.w.requests.length, 2);
    await openStudio(f);
    const original = originalRequest(f, 'character-job', 'image');
    await f.act(async () => f.w.fx.unmount());
    assert.equal(original.init.signal.aborted, true);
    await f.respond(original, {ok:true,outputs:[{id:'new-output',jobId:'character-job',kind:'image',url:f.w.original,status:'ready'}]});
    assert.equal(f.w.requests.length, 3);
  } finally { await f.close(); }
});

test('a canonical asset skips job lookup and library promotion', async () => {
  const f = await mount('character', canonicalId);
  try {
    f.w.AbortSignal.any = undefined;
    assert.equal(f.w.requests.length, 0);
    await openStudio(f);
    assert.equal(f.w.requests.length, 2);
    assert.equal(f.w.requests[0].url, '/api/studio/conversation-projects');
    assert.equal(f.w.requests[1].url, '/api/studio/media/resolve');
    assert.deepEqual(JSON.parse(f.w.requests[1].init.body), {refs:[{type:'asset',assetId:canonicalId,kind:'image'}]});
  } finally { await f.close(); }
});
