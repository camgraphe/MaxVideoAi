import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { bundleClientFlow, createClientFlowDom } from './helpers/client-flow-dom';
import { deferred } from './helpers/auth-legal-client-fixture';

const bundle = bundleClientFlow(`
import React,{act,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {I18nProvider} from './lib/i18n/I18nProvider';
import {getBaseEngineIncludingHidden} from './src/lib/engines';
import {getVideoExcerptLimits} from './lib/video-excerpt';
import {getVideoWorkflowSourceState} from './lib/video-source-workflow';
import {useWorkspaceAssetState} from './app/(core)/(workspace)/app/_hooks/useWorkspaceAssetState';
import {useWorkspaceVideoExcerpt} from './app/(core)/(workspace)/app/_hooks/useWorkspaceVideoExcerpt';
import {summarizeWorkspaceInputSchema} from './app/(core)/(workspace)/app/_lib/workspace-input-schema';
import {LumaRay32KeyframeEditor} from './app/(core)/(workspace)/app/_components/LumaRay32KeyframeEditor';
function Main(){
  const engine=getBaseEngineIncludingHidden('luma-ray-3-2');
  const state=useWorkspaceAssetState('owner');
  const [form,setForm]=useState({engineId:engine.id,mode:'v2v',durationSec:5,resolution:'720p',aspectRatio:'16:9',fps:24,iterations:1,audio:false,
    extraInputValues:{edit_keyframe_slot_indexes:'0:24',edit_keyframe_indexes:'24',modify_strength:0.7}});
  const actions=useWorkspaceVideoExcerpt({accountScope:'owner',engine,mode:'v2v',inputAssets:state.inputAssets,commitInputAssetMutation:state.commitInputAssetMutation});
  const summary=summarizeWorkspaceInputSchema({selectedEngine:engine,activeMode:'v2v',uiLocale:'en',allowsUnifiedVeoFirstLast:false,isUnifiedHappyHorse:false,isUnifiedSeedance:false,isUnifiedGeminiOmni:false});
  window.probe={...state,form,sourceState:getVideoWorkflowSourceState(engine.inputSchema,state.inputAssets,'v2v',getVideoExcerptLimits(engine,'v2v'))};
  return <I18nProvider locale="en" dictionary={{}} fallback={{}}><LumaRay32KeyframeEditor
    engine={engine} form={form} setForm={setForm} assetFields={summary.assetFields} inputAssets={state.inputAssets}
    onAssetAdd={(field,file,index,meta)=>window.added.push({field:field.id,name:file.name,index,meta})}
    onAssetRemove={()=>{}} onOpenLibrary={()=>{}} onNotice={message=>window.notices.push(message)}
    onPrepareVideoExcerpt={window.excerptsEnabled?actions.handlePrepareVideoExcerpt:undefined}
    onVideoExcerptEditorChange={window.excerptsEnabled?actions.handleVideoExcerptEditorChange:undefined}
  /></I18nProvider>;
}
const root=createRoot(document.getElementById('root'));window.IS_REACT_ACT_ENVIRONMENT=true;
window.fx={act,render:()=>root.render(<Main/>),unmount:()=>root.unmount()};`, {
  '@/lib/supabaseClient': 'export const supabase={auth:{getSession:async()=>({data:{session:{user:{id:"owner"},access_token:"owner-token"}},error:null})}};',
  '@/components/asset-dropzone/asset-dropzone-helpers': `export * from './components/asset-dropzone/asset-dropzone-helpers';export async function readMediaDuration(){return window.measuredDuration;}`,
});

const source = {
  id: 'source', assetId: 'owned-source', ref: { type: 'asset', assetId: 'owned-source', kind: 'video' },
  fieldId: 'video_url', kind: 'video', name: 'source.mp4', type: 'video/mp4', size: 100,
  url: 'https://example.invalid/original.mp4', previewUrl: 'https://example.invalid/short.mp4', durationSec: 60, status: 'ready',
};
const keyframe = {
  id: 'keyframe', fieldId: 'edit_keyframe_urls', kind: 'image', name: 'keyframe.png', type: 'image/png', size: 10,
  url: 'https://example.invalid/keyframe.png', previewUrl: 'https://example.invalid/keyframe.png', status: 'ready',
};

async function mount(selected = true) {
  const dom = createClientFlowDom('/app');
  const w = dom.window as any;
  w.sessionStorage.setItem('last-known:user-id', 'owner');
  w.excerptsEnabled = true;
  w.measuredDuration = 60;
  w.added = [];
  w.notices = [];
  w.HTMLMediaElement.prototype.pause = () => {};
  w.HTMLMediaElement.prototype.load = () => {};
  const requests: Array<{ url: string; init: RequestInit; response: ReturnType<typeof deferred<any>> }> = [];
  w.fetch = (url: string, init: RequestInit) => {
    if (url === '/api/uploads/video/excerpt/source') {
      return Promise.resolve({ ok: true, json: async () => ({ ok: true, previewUrl: 'https://example.invalid/full.mp4' }) });
    }
    const response = deferred<any>();
    requests.push({ url, init, response });
    return response.promise;
  };
  w.eval(await bundle);
  await w.fx.act(async () => w.fx.render());
  await w.fx.act(async () => w.probe.setInputAssets({ video_url: selected ? [source] : [], edit_keyframe_urls: [keyframe] }));
  const button = (name: string) => Array.from(w.document.querySelectorAll('button')).find((node: any) => node.textContent.trim() === name) as HTMLButtonElement | undefined;
  return { w, requests, button, async dispose() { await w.fx.act(async () => w.fx.unmount()); dom.window.close(); } };
}

test('Luma keyframe range follows a selected 4s or 18s source instead of stale presets', async () => {
  const f = await mount();
  try {
    for (const durationSec of [4, 18, 5.558]) {
      await f.w.fx.act(async () => f.w.probe.setInputAssets({ video_url: [{ ...source, durationSec }], edit_keyframe_urls: [keyframe] }));
      assert.ok(f.w.document.body.textContent.includes(`Source video · ${durationSec}s`));
      assert.ok(f.w.document.body.textContent.includes(`f0-f${Math.floor(durationSec * 24) - 1}`));
      assert.doesNotMatch(f.w.document.body.textContent, /Video includes audio|5s @ 24fps/);
      assert.equal(f.w.probe.inputAssets.edit_keyframe_urls[0].url, keyframe.url);
      assert.equal(f.w.probe.form.extraInputValues.modify_strength, 0.7);
    }
  } finally { await f.dispose(); }
});

test('specialized Luma source opens and applies the real excerpt flow without changing keyframes or options', async () => {
  const f = await mount();
  try {
    assert.match(f.w.document.body.textContent, /Ray 3.2 Modify/);
    assert.equal(f.w.probe.sourceState, 'error', 'the uncut 60-second source is not generation-ready');
    const beforeKeyframes = JSON.stringify(f.w.probe.inputAssets.edit_keyframe_urls);
    const beforeOptions = JSON.stringify(f.w.probe.form.extraInputValues);
    const choose = f.button('Choose section');
    assert.ok(choose, 'the actual specialized source must expose the shared excerpt control');
    await f.w.fx.act(async () => choose.click());
    assert.equal(f.w.probe.sourceState, 'uploading', 'opening masks source eligibility through the existing route hook');
    const dialog = f.w.document.querySelector('[role=dialog]');
    assert.ok(dialog);
    assert.equal(dialog.querySelector('video')?.getAttribute('src'), 'https://example.invalid/full.mp4');
    assert.equal(dialog.querySelector('video')?.getAttribute('preload'), 'none');
    assert.equal(f.requests.length, 0, 'opening performs no preparation');
    await f.w.fx.act(async () => f.button('Cancel')!.click());
    assert.equal(f.w.probe.sourceState, 'error');
    assert.equal(f.requests.length, 0, 'cancelling performs no preparation');

    await f.w.fx.act(async () => f.button('Choose section')!.click());
    for (const [label, value] of [['Start (seconds)', '20'], ['End (seconds)', '38']]) {
      const input = f.w.document.querySelector(`input[aria-label="${label}"]`);
      assert.ok(input);
      await f.w.fx.act(async () => {
        Object.getOwnPropertyDescriptor(f.w.HTMLInputElement.prototype, 'value')!.set!.call(input, value);
        input.dispatchEvent(new f.w.Event('input', { bubbles: true }));
      });
    }
    const apply = f.button('Use this section');
    assert.ok(apply && !apply.disabled);
    await f.w.fx.act(async () => apply.click());
    assert.equal(f.requests.length, 1);
    assert.equal(f.requests[0].url, '/api/uploads/video/excerpt');
    assert.deepEqual(JSON.parse(String(f.requests[0].init.body)), {
      source: source.ref, engineId: 'luma-ray-3-2', mode: 'v2v', fieldId: 'video_url', range: { startSec: 20, endSec: 38 },
    });
    assert.equal(f.w.probe.inputAssets.video_url[0].status, 'uploading');
    await f.w.fx.act(async () => f.requests[0].response.resolve({ ok: true, json: async () => ({ ok: true, asset: {
      id: 'prepared', assetId: 'owned-prepared', ref: { type: 'asset', assetId: 'owned-prepared', kind: 'video' },
      url: 'https://example.invalid/prepared.mp4', previewUrl: 'https://example.invalid/prepared-preview.mp4',
      durationSec: 17.985, width: 720, height: 1280, size: 80, mime: 'video/mp4',
    } }) }));
    assert.equal(f.w.document.querySelector('[role=dialog]'), null);
    assert.equal(f.w.probe.sourceState, 'ready');
    assert.equal(f.w.probe.inputAssets.video_url[0].url, 'https://example.invalid/prepared.mp4');
    assert.equal(f.w.probe.inputAssets.video_url[0].durationSec, 17.985);
    assert.equal(f.w.probe.inputAssets.video_url[0].excerptSource.url, source.url);
    assert.equal(JSON.stringify(f.w.probe.inputAssets.edit_keyframe_urls), beforeKeyframes);
    assert.equal(JSON.stringify(f.w.probe.form.extraInputValues), beforeOptions);
    assert.ok(f.button('Choose section'), 'the trigger survives source replacement for subsequent edits');
  } finally { await f.dispose(); }
});

test('specialized Luma source accepts a long local clip only when excerpt preparation is available', async () => {
  const f = await mount(false);
  try {
    const upload = async () => {
      const input = f.w.document.querySelector('input[type=file][accept*="video"]');
      assert.ok(input);
      Object.defineProperty(input, 'files', { configurable: true, value: [new f.w.File(['video'], 'long.mp4', { type: 'video/mp4' })] });
      await f.w.fx.act(async () => input.dispatchEvent(new f.w.Event('change', { bubbles: true })));
    };
    await upload();
    assert.equal(f.w.added.length, 1, 'source import must allow the owned preparation duration envelope');
    assert.equal(f.w.added[0].field, 'video_url');
    assert.equal(f.w.added[0].meta.durationSec, 60);
    assert.deepEqual(f.w.notices, []);
    f.w.excerptsEnabled = false;
    await f.w.fx.act(async () => f.w.fx.render());
    await upload();
    assert.equal(f.w.added.length, 1, 'without preparation the original source limit remains enforced');
    assert.equal(f.w.notices.length, 1);
    assert.match(f.w.notices[0], /18/);
  } finally { await f.dispose(); }
});

test('workspace forwards its owned excerpt handlers to the specialized Luma source', () => {
  const surface = readFileSync('frontend/app/(core)/(workspace)/app/_components/WorkspaceComposerSurface.tsx', 'utf8');
  const specialized = surface.match(/<LumaRay32KeyframeEditor\b[\s\S]*?\/>/)?.[0];
  assert.ok(specialized);
  assert.match(specialized, /onPrepareVideoExcerpt=\{handlePrepareVideoExcerpt\}/);
  assert.match(specialized, /onVideoExcerptEditorChange=\{handleVideoExcerptEditorChange\}/);
});
