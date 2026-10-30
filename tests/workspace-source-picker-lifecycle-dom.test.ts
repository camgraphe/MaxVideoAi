import assert from 'node:assert/strict';
import test from 'node:test';
import { bundleClientFlow, createClientFlowDom } from './helpers/client-flow-dom';

const bundle = bundleClientFlow(`
import React,{act,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {useWorkspaceEngineModeState} from './app/(core)/(workspace)/app/_hooks/useWorkspaceEngineModeState';
import {useWorkspaceModelReview} from './app/(core)/(workspace)/app/_hooks/useWorkspaceModelReview';
import {getBaseEngineIncludingHidden} from './src/lib/engines';
import {coerceFormState} from './app/(core)/(workspace)/app/_lib/workspace-engine-helpers';
import {workspaceModelSetupsKey} from './app/(core)/(workspace)/app/_lib/workspace-model-setups';
if(window.fullStore)sessionStorage.setItem(workspaceModelSetupsKey('owner'),JSON.stringify({version:1,accountId:'owner',entries:{other:'x'.repeat(1024*1024-300)}}));
const engines=['wan-3','wan-3-prime'].map(getBaseEngineIncludingHidden);
function Main(){
 const [setup,setSetup]=useState(()=>({form:{...coerceFormState(engines[0],'v2v',null),durationSec:6,durationOption:6,aspectRatio:'1:1'},inputAssets:{video_url:[window.source]},prompt:'Keep this person',negativePrompt:'',klingElements:[],multiPromptEnabled:false,multiPromptScenes:[],shotType:'customize',voiceIdsInput:'',cfgScale:null}));
 const setter=key=>value=>setSetup(previous=>{const next=typeof value==='function'?value(previous[key]):value;return next===previous[key]?previous:{...previous,[key]:next};});
 const workflow=useWorkspaceEngineModeState({...setup,engines,setForm:setter('form'),setInputAssets:setter('inputAssets'),setShotType:setter('shotType'),effectiveRequestedEngineToken:null,authChecked:true,hydratedForScope:'owner',storageScope:'owner',preserveStoredDraftRef:useRef(false),requestedEngineOverrideIdRef:useRef(null),requestedEngineOverrideTokenRef:useRef(null),requestedModeOverrideRef:useRef(null),writeStorage:()=>{},uiLocale:'en',workflowCopy:{generateVideo:'Generate'},showNotice:message=>window.notices.push(message)});
 const review=useWorkspaceModelReview({current:setup,authStatus:'authed',accountId:'owner',accessToken:'test-only',memberTier:'Member',engines,locale:'en',onGuestEngineChange:workflow.handleEngineChange,onRequestAuth:()=>{},onModelSwitchNotice:message=>window.notices.push(message),beforeApplyPreparedForm:workflow.beforeApplyPreparedForm,applyPreparedForm:workflow.applyPreparedForm,...Object.fromEntries(['inputAssets','prompt','negativePrompt','klingElements','multiPromptEnabled','multiPromptScenes','shotType','voiceIdsInput','cfgScale'].map(key=>['set'+key[0].toUpperCase()+key.slice(1),setter(key)]))});
 window.probe={setup,workflow,review,setForm:value=>setter('form')(JSON.parse(JSON.stringify(value)))};return null;
}
const root=createRoot(document.getElementById('root'));window.IS_REACT_ACT_ENVIRONMENT=true;window.fx={act,render:()=>root.render(<React.StrictMode><Main/></React.StrictMode>),unmount:()=>root.unmount()};`, {});

async function mount(excerptEditing = false, fullStore = false) {
  const dom = createClientFlowDom('/app');
  const w = dom.window as any;
  Object.assign(w, {
    TextEncoder, notices: [], fullStore,
    fetch: () => { throw new Error('No network request is allowed in the source lifecycle fixture'); },
    structuredClone: (value: unknown) => w.JSON.parse(w.JSON.stringify(value)),
    source: w.JSON.parse(JSON.stringify({ id: 'source', assetId: 'owned-source', fieldId: 'video_url', kind: 'video', name: 'Original.mp4', type: 'video/mp4', size: 1024, status: 'ready', durationSec: 4, width: 1920, height: 1080, url: 'https://example.invalid/original.mp4', previewUrl: 'https://example.invalid/preview.mp4', excerptEditing })),
  });
  w.eval(await bundle);
  await w.fx.act(async () => w.fx.render());
  return { w, async apply(engineId: string) {
    let result;
    await w.fx.act(async () => { result = w.probe.review.applyPickerScenario(engineId, w.probe.setup, {}); });
    return result;
  }, async close() { await w.fx.act(async () => w.fx.unmount()); dom.window.close(); } };
}

test('the real picker apply path preserves Modify source and settings through model switches', async () => {
  const view = await mount();
  try {
    assert.equal(await view.apply('wan-3-prime'), true);
    assert.equal(view.w.probe.setup.form.mode, 't2v');
    assert.deepEqual(Object.keys(view.w.probe.setup.inputAssets), []);
    await view.w.fx.act(async()=>view.w.probe.setForm({...view.w.probe.setup.form,durationSec:8,durationOption:8,aspectRatio:'16:9'}));
    assert.equal(await view.apply('wan-3'), true);
    await view.w.fx.act(async () => view.w.probe.workflow.handleComposerModeToggle('v2v'));
    assert.equal(view.w.probe.setup.inputAssets.video_url?.[0]?.assetId, 'owned-source');
    assert.equal(view.w.probe.setup.form.durationSec,6);
    assert.equal(view.w.probe.setup.form.aspectRatio,'1:1');
  } finally { await view.close(); }
});

test('the picker cannot partially replace a setup while its excerpt editor is active', async () => {
  const view = await mount(true);
  try {
    assert.equal(await view.apply('wan-3-prime'), false);
    assert.equal(view.w.probe.setup.form.engineId, 'wan-3');
    assert.equal(view.w.probe.setup.inputAssets.video_url[0].excerptEditing, true);
    assert.ok(view.w.notices.length);
  } finally { await view.close(); }
});


test('a refused ModelReview persistence does not mutate parked source snapshots or the live setup', async () => {
 const view=await mount(false,true);
 try {
  await view.w.fx.act(async()=>view.w.probe.workflow.handleComposerModeToggle(null));
  const key='maxvideoai:parked-video-sources:v1:owner:wan-3';
  const before=view.w.sessionStorage.getItem(key);
  const setup=JSON.stringify(view.w.probe.setup);
  assert.equal(await view.apply('wan-3-prime'),false);
  assert.equal(view.w.sessionStorage.getItem(key),before);
  assert.equal(JSON.stringify(view.w.probe.setup),setup);
 } finally { await view.close(); }
});
