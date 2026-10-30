import assert from 'node:assert/strict';
import test from 'node:test';
import { bundleClientFlow, createClientFlowDom } from './helpers/client-flow-dom';
const bundle=bundleClientFlow(`
import React,{act,useRef,useState} from 'react';import {createRoot} from 'react-dom/client';
import {useWorkspaceAssetState} from './app/(core)/(workspace)/app/_hooks/useWorkspaceAssetState';
import {useWorkspaceComposerState} from './app/(core)/(workspace)/app/_hooks/useWorkspaceComposerState';
import {useWorkspaceInputSchemaState} from './app/(core)/(workspace)/app/_hooks/useWorkspaceInputSchemaState';
import {getBaseEngineIncludingHidden} from './src/lib/engines';
import {coerceFormState} from './app/(core)/(workspace)/app/_lib/workspace-engine-helpers';
function Main(){const engine=getBaseEngineIncludingHidden(window.engineId);const [form,setForm]=useState({...coerceFormState(engine,window.mode,null),durationSec:8,durationOption:8,aspectRatio:'16:9',audio:true});const assetState=useWorkspaceAssetState(window.owner);const initial=useRef(false);if(!initial.current){initial.current=true;assetState.setInputAssets(window.initialAssets||{});}const assets=assetState.inputAssets;const setAssets=assetState.setInputAssets;
const composer=useWorkspaceComposerState({engines:[engine,...['wan-3','wan-3-prime'].filter(id=>id!==engine.id).map(getBaseEngineIncludingHidden)],form,setForm,inputAssets:assets,setInputAssets:setAssets,inputAssetMutationRevision:assetState.inputAssetMutationRevision,klingElements:[],prompt:'Keep the person',multiPromptEnabled:false,setMultiPromptEnabled:()=>{},multiPromptScenes:[],setMultiPromptScenes:()=>{},voiceIdsInput:'',shotType:'customize',setShotType:()=>{},effectiveRequestedEngineToken:null,authChecked:true,hydratedForScope:window.owner,storageScope:window.owner,preserveStoredDraftRef:useRef(false),requestedEngineOverrideIdRef:useRef(null),requestedEngineOverrideTokenRef:useRef(null),requestedModeOverrideRef:useRef(null),writeStorage:()=>{},uiLocale:'en',workflowCopy:{generateVideo:'Generate'},showNotice:message=>window.notices.push(message)});useWorkspaceInputSchemaState({...composer,hydrationReady:window.prune,uiLocale:'en',authChecked:true,authLoading:false,authenticatedUserId:window.owner,uploadLockedCopy:'Sign in',setInputAssets:setAssets,setForm});window.probe={form,setForm:value=>setForm(JSON.parse(JSON.stringify(value))),assets,setAssets,commit:assetState.commitInputAssetMutation,composer};return null;}
const root=createRoot(document.getElementById('root'));window.IS_REACT_ACT_ENVIRONMENT=true;window.fx={act,render:()=>root.render(<React.StrictMode><Main/></React.StrictMode>),unmount:()=>root.unmount()};`,{});
const source=(durationSec=4,id='source',status='ready')=>({id,assetId:id,fieldId:'video_url',kind:'video',name:'Phone.mov',type:'video/quicktime',size:1024,url:'https://example.invalid/'+id,previewUrl:'https://example.invalid/signed',width:1080,height:1920,durationSec,status});
async function mount(engineId='wan-3',mode='v2v',initialAssets={},storage:Record<string,string>={},owner='owner',prune=false){const dom=createClientFlowDom('/app');const w=dom.window as any;Object.entries(storage).forEach(([key,value])=>w.sessionStorage.setItem(key,value));Object.assign(w,{engineId,mode,initialAssets:w.JSON.parse(JSON.stringify(initialAssets)),TextEncoder,owner,prune,notices:[]});w.eval(await bundle);await w.fx.act(async()=>w.fx.render());return {w,async select(asset:any){const local=asset?w.JSON.parse(JSON.stringify(asset)):null;await w.fx.act(async()=>w.probe.commit(()=>({state:local?{[mode==='ref2v'?'video_urls':'video_url']:[local]}:{}})));},async close(){await w.fx.act(async()=>w.fx.unmount());dom.window.close();}};}
for(const id of ['wan-3','wan-3-prime'])test(`${id}: new Modify source replaces stale Create timing/framing while manual choices survive rerenders`,async()=>{const f=await mount(id);try{
 await f.select(source());assert.equal(f.w.probe.form.durationSec,4);assert.equal(f.w.probe.composer.effectiveDurationSec,4);assert.equal(f.w.probe.form.durationOption,4);assert.equal(f.w.probe.form.aspectRatio,'9:16');
 await f.w.fx.act(async()=>{f.w.probe.composer.handleDurationChange(6);f.w.probe.composer.handleAspectRatioChange('1:1');});
 await f.select({...source(),previewUrl:'https://example.invalid/new-signature'});assert.equal(f.w.probe.form.durationSec,6);assert.equal(f.w.probe.form.aspectRatio,'1:1');
 await f.select({...source(),excerptEditing:true});await f.select(source());assert.equal(f.w.probe.form.durationSec,6,'opening/cancelling excerpt editor must not reset choices');
 await f.select(source(3,'prepared-excerpt'));assert.equal(f.w.probe.form.durationSec,3);assert.equal(f.w.probe.form.aspectRatio,'9:16');
 assert.equal(f.w.probe.form.audio,true,'do not pretend generated audio preserves original or disable a supported capability');
}finally{await f.close();}});
test('hydrated settings and source remain authoritative',async()=>{const f=await mount('wan-3','v2v',{video_url:[source()]});try{assert.equal(f.w.probe.form.durationSec,8);assert.equal(f.w.probe.form.aspectRatio,'16:9');await f.select({...source(),previewUrl:'https://example.invalid/refreshed'});assert.equal(f.w.probe.form.durationSec,8);}finally{await f.close();}});
test('uploading source waits for measured duration, then initializes once',async()=>{const f=await mount();try{await f.select(source(0,'upload','uploading'));assert.equal(f.w.probe.form.durationSec,8);await f.select(source(4,'upload'));assert.equal(f.w.probe.form.durationSec,4);}finally{await f.close();}});
for(const mode of ['extend','ref2v'])test(`Wan ${mode} keeps its independently selected output duration`,async()=>{const f=await mount('wan-3',mode);try{await f.select(source());assert.equal(f.w.probe.form.durationSec,8);assert.equal(f.w.probe.form.aspectRatio,'16:9');}finally{await f.close();}});

test('restoring another generation preserves its explicit duration and format',async()=>{const f=await mount();try{await f.select(source());await f.w.fx.act(async()=>{f.w.probe.setForm({...f.w.probe.form,durationSec:8,durationOption:8,aspectRatio:'1:1'});f.w.probe.setAssets({video_url:[source(5,'reused-generation')]});});assert.equal(f.w.probe.form.durationSec,8);assert.equal(f.w.probe.form.aspectRatio,'1:1');}finally{await f.close();}});

test('restoring saved settings during an upload does not inherit the pending import defaults',async()=>{const f=await mount();try{await f.select(source(0,'pending','uploading'));await f.w.fx.act(async()=>{f.w.probe.setForm({...f.w.probe.form,durationSec:8,durationOption:8,aspectRatio:'1:1'});f.w.probe.setAssets({video_url:[source(5,'restored')]});});assert.equal(f.w.probe.form.durationSec,8);assert.equal(f.w.probe.form.aspectRatio,'1:1');}finally{await f.close();}});
test('upload settlement through setInputAssets initializes its own source only',async()=>{const f=await mount();try{await f.select(source(0,'pending','uploading'));await f.w.fx.act(async()=>f.w.probe.setAssets({video_url:[source(4,'pending')]}));assert.equal(f.w.probe.form.durationSec,4);assert.equal(f.w.probe.form.aspectRatio,'9:16');}finally{await f.close();}});

test('explicit choices made during upload survive settlement',async()=>{const f=await mount();try{await f.select(source(0,'pending','uploading'));await f.w.fx.act(async()=>{f.w.probe.composer.handleDurationChange(6);f.w.probe.composer.handleAspectRatioChange('1:1');});await f.w.fx.act(async()=>f.w.probe.setAssets({video_url:[source(4,'pending')]}));assert.equal(f.w.probe.form.durationSec,6);assert.equal(f.w.probe.form.aspectRatio,'1:1');}finally{await f.close();}});

for(const id of ['wan-3','wan-3-prime','seedance-2-0','seedance-2-5','kling-o3-standard','kling-o3-pro','gemini-omni-flash','luma-ray-3-2','happy-horse-1-0','minimax-h3-max'])test(`${id}: Create leaves the Modify source out and returning restores it`,async()=>{const f=await mount(id);try{await f.select(source());await f.w.fx.act(async()=>f.w.probe.composer.handleComposerModeToggle(null));assert.equal(f.w.probe.composer.activeManualMode,null);assert.equal(f.w.probe.composer.submissionMode,'t2v');assert.deepEqual(Object.keys(f.w.probe.assets),[]);await f.w.fx.act(async()=>f.w.probe.composer.handleComposerModeToggle('v2v'));assert.equal(f.w.probe.composer.submissionMode,'v2v');assert.equal(f.w.probe.assets.video_url[0].assetId,'source');}finally{await f.close();}});

test('visiting an empty Extend does not discard the parked Modify source',async()=>{const f=await mount();try{await f.select(source());for(const mode of [null,'extend',null,'v2v'])await f.w.fx.act(async()=>f.w.probe.composer.handleComposerModeToggle(mode));assert.equal(f.w.probe.assets.video_url[0].assetId,'source');}finally{await f.close();}});

test('Kling Create video reference remains intact when clicking its already selected Create action',async()=>{const f=await mount('kling-o3-pro');try{await f.select(source());await f.w.fx.act(async()=>f.w.probe.setForm({...f.w.probe.form,operation:'kling-reference'}));assert.equal(f.w.probe.composer.activeManualMode,null);await f.w.fx.act(async()=>f.w.probe.composer.handleComposerModeToggle(null));assert.equal(f.w.probe.form.operation,'kling-reference');assert.equal(f.w.probe.assets.video_url[0].assetId,'source');}finally{await f.close();}});

test('parked Modify source survives remount in Create without entering Create inputs',async()=>{
 const first=await mount();let saved:Record<string,string>={};try{
  await first.select(source());await first.w.fx.act(async()=>first.w.probe.composer.handleComposerModeToggle(null));
  assert.deepEqual(Object.keys(first.w.probe.assets),[]);
  for(let i=0;i<first.w.sessionStorage.length;i++){const key=first.w.sessionStorage.key(i);saved[key]=first.w.sessionStorage.getItem(key);}
 }finally{await first.close();}
 const next=await mount('wan-3','t2v',{},saved);try{
  assert.deepEqual(Object.keys(next.w.probe.assets),[]);
  await next.w.fx.act(async()=>next.w.probe.composer.handleComposerModeToggle('v2v'));
  assert.equal(next.w.probe.assets.video_url?.[0]?.assetId,'source');
 }finally{await next.close();}
});

test('parked sources are isolated by account and model',async()=>{
 const first=await mount();let saved:Record<string,string>={};try{await first.select(source());await first.w.fx.act(async()=>first.w.probe.composer.handleComposerModeToggle(null));for(let i=0;i<first.w.sessionStorage.length;i++){const key=first.w.sessionStorage.key(i);saved[key]=first.w.sessionStorage.getItem(key);}}finally{await first.close();}
 for(const [engine,owner] of [['wan-3','another'],['wan-3-prime','owner']]){const view=await mount(engine,'t2v',{},saved,owner);try{await view.w.fx.act(async()=>view.w.probe.composer.handleComposerModeToggle('v2v'));assert.equal(view.w.probe.assets.video_url?.[0],undefined);}finally{await view.close();}}
});

test('a failed removal of a durable parked source prevents stale reappearance',async()=>{
 const view=await mount();try{await view.select(source());await view.w.fx.act(async()=>view.w.probe.composer.handleComposerModeToggle(null));
 const storage=view.w.Storage.prototype,remove=storage.removeItem,set=storage.setItem;storage.removeItem=storage.setItem=function(){throw Error('storage unavailable')};
 await view.w.fx.act(async()=>view.w.probe.composer.handleComposerModeToggle('v2v'));
 assert.equal(view.w.probe.composer.activeManualMode,null);assert.deepEqual(Object.keys(view.w.probe.assets),[]);assert.ok(view.w.notices.length);
 storage.removeItem=remove;storage.setItem=set;await view.w.fx.act(async()=>view.w.probe.composer.handleComposerModeToggle('v2v'));assert.equal(view.w.probe.assets.video_url[0].assetId,'source');
 }finally{await view.close();}
});

test('replacement source supersedes the previously restored source',async()=>{
 const view=await mount();try{await view.select(source());for(const mode of [null,'v2v'])await view.w.fx.act(async()=>view.w.probe.composer.handleComposerModeToggle(mode));await view.select(source(4,'replacement'));await view.w.fx.act(async()=>view.w.probe.composer.handleComposerModeToggle(null));let saved:Record<string,string>={};for(let i=0;i<view.w.sessionStorage.length;i++){const key=view.w.sessionStorage.key(i);saved[key]=view.w.sessionStorage.getItem(key);}const reload=await mount('wan-3','t2v',{},saved);try{await reload.w.fx.act(async()=>reload.w.probe.composer.handleComposerModeToggle('v2v'));assert.equal(reload.w.probe.assets.video_url[0].assetId,'replacement');}finally{await reload.close();}
 }finally{await view.close();}
});

test('an uploading source stays active until upload settles before switching to Create',async()=>{
 const view=await mount();try{
  await view.select(source(0,'upload','uploading'));
  await view.w.fx.act(async()=>view.w.probe.composer.handleComposerModeToggle(null));
  assert.equal(view.w.probe.composer.activeManualMode,'v2v');
  assert.equal(view.w.probe.assets.video_url[0].status,'uploading');
  assert.ok(view.w.notices.length);
  await view.select(source(4,'upload','ready'));
  await view.w.fx.act(async()=>view.w.probe.composer.handleComposerModeToggle(null));
  assert.equal(view.w.probe.composer.activeManualMode,null);
 }finally{await view.close();}
});


test('storage failure leaves the active source and mode intact even without an older parked snapshot',async()=>{
 const view=await mount();try{
  await view.select(source());
  const storage=view.w.Storage.prototype,set=storage.setItem;
  storage.setItem=function(){throw Error('quota exceeded')};
  await view.w.fx.act(async()=>view.w.probe.composer.handleComposerModeToggle(null));
  assert.equal(view.w.probe.composer.activeManualMode,'v2v');
  assert.equal(view.w.probe.assets.video_url[0].assetId,'source');
  assert.match(view.w.notices.at(-1),/kept|unchanged/i);
  storage.setItem=set;
  await view.w.fx.act(async()=>view.w.probe.composer.handleComposerModeToggle(null));
  assert.equal(view.w.probe.composer.activeManualMode,null);
 }finally{await view.close();}
});

test('Modify settings survive Create edits and a reload with the parked source',async()=>{
 const view=await mount();let saved:Record<string,string>={};try{
  await view.select(source());
  await view.w.fx.act(async()=>{view.w.probe.composer.handleDurationChange(6);view.w.probe.composer.handleAspectRatioChange('1:1');});
  await view.w.fx.act(async()=>view.w.probe.composer.handleComposerModeToggle(null));
  await view.w.fx.act(async()=>{view.w.probe.composer.handleDurationChange(8);view.w.probe.composer.handleAspectRatioChange('16:9');});
  for(let i=0;i<view.w.sessionStorage.length;i++){const key=view.w.sessionStorage.key(i);saved[key]=view.w.sessionStorage.getItem(key);}
 }finally{await view.close();}
 const reload=await mount('wan-3','t2v',{},saved);try{
  await reload.w.fx.act(async()=>reload.w.probe.composer.handleComposerModeToggle('v2v'));
  assert.equal(reload.w.probe.assets.video_url[0].assetId,'source');
  assert.equal(reload.w.probe.form.durationSec,6);
  assert.equal(reload.w.probe.form.aspectRatio,'1:1');
 }finally{await reload.close();}
});

test('direct Modify and Extend transitions keep distinct sources and settings',async()=>{
 const view=await mount();try{
  await view.select(source());
  await view.w.fx.act(async()=>view.w.probe.composer.handleDurationChange(6));
  await view.w.fx.act(async()=>view.w.probe.composer.handleComposerModeToggle('extend'));
  assert.equal(view.w.probe.assets.video_url?.[0],undefined);
  await view.select(source(4,'extension-source'));
  await view.w.fx.act(async()=>view.w.probe.composer.handleDurationChange(8));
  await view.w.fx.act(async()=>view.w.probe.composer.handleComposerModeToggle('v2v'));
  assert.equal(view.w.probe.assets.video_url[0].assetId,'source');
  assert.equal(view.w.probe.form.durationSec,6);
  await view.w.fx.act(async()=>view.w.probe.composer.handleComposerModeToggle('extend'));
  assert.equal(view.w.probe.assets.video_url[0].assetId,'extension-source');
  assert.equal(view.w.probe.form.durationSec,8);
 }finally{await view.close();}
});

test('switching models parks the source for its owning model without adding it to Create',async()=>{
 const view=await mount();try{
  await view.select(source());
  await view.w.fx.act(async()=>view.w.probe.composer.handleDurationChange(6));
  await view.w.fx.act(async()=>view.w.probe.composer.handleEngineChange('wan-3-prime'));
  assert.equal(view.w.probe.form.engineId,'wan-3-prime');
  assert.deepEqual(Object.keys(view.w.probe.assets),[]);
  await view.w.fx.act(async()=>view.w.probe.composer.handleComposerModeToggle('v2v'));
  assert.equal(view.w.probe.assets.video_url?.[0],undefined);
  await view.w.fx.act(async()=>view.w.probe.composer.handleEngineChange('wan-3'));
  assert.deepEqual(Object.keys(view.w.probe.assets),[]);
  await view.w.fx.act(async()=>view.w.probe.composer.handleComposerModeToggle('v2v'));
  assert.equal(view.w.probe.assets.video_url[0].assetId,'source');
  assert.equal(view.w.probe.form.durationSec,6);
 }finally{await view.close();}
});


test('Create settings remain independent when returning from Modify',async()=>{
 const view=await mount('wan-3','t2v');try{
  await view.w.fx.act(async()=>{view.w.probe.composer.handleDurationChange(8);view.w.probe.composer.handleAspectRatioChange('16:9');});
  await view.w.fx.act(async()=>view.w.probe.composer.handleComposerModeToggle('v2v'));
  await view.select(source());
  await view.w.fx.act(async()=>view.w.probe.composer.handleComposerModeToggle(null));
  assert.equal(view.w.probe.form.durationSec,8);
  assert.equal(view.w.probe.form.aspectRatio,'16:9');
 }finally{await view.close();}
});

test('a source with an open excerpt editor cannot lose its pending work on a mode change',async()=>{
 const view=await mount();try{
  await view.select({...source(),excerptEditing:true});
  await view.w.fx.act(async()=>view.w.probe.composer.handleComposerModeToggle(null));
  assert.equal(view.w.probe.composer.activeManualMode,'v2v');
  assert.equal(view.w.probe.assets.video_url[0].excerptEditing,true);
 }finally{await view.close();}
});


test('removing a restored source does not resurrect it after another reload',async()=>{
 const view=await mount();let saved:Record<string,string>={};try{
  await view.select(source());
  for(const mode of [null,'v2v'])await view.w.fx.act(async()=>view.w.probe.composer.handleComposerModeToggle(mode));
  await view.select(null);
  await view.w.fx.act(async()=>view.w.probe.composer.handleComposerModeToggle(null));
  for(let i=0;i<view.w.sessionStorage.length;i++){const key=view.w.sessionStorage.key(i);saved[key]=view.w.sessionStorage.getItem(key);}
 }finally{await view.close();}
 const reload=await mount('wan-3','t2v',{},saved);try{
  await reload.w.fx.act(async()=>reload.w.probe.composer.handleComposerModeToggle('v2v'));
  assert.equal(reload.w.probe.assets.video_url?.[0],undefined);
 }finally{await reload.close();}
});

test('temporary read failure can recover without remounting or losing parked sources',async()=>{
 const view=await mount();try{
  await view.select(source());
  await view.w.fx.act(async()=>view.w.probe.composer.handleEngineChange('wan-3-prime'));
  const storage=view.w.Storage.prototype,get=storage.getItem;
  storage.getItem=function(){throw Error('storage temporarily unavailable')};
  await view.w.fx.act(async()=>view.w.probe.composer.handleEngineChange('wan-3'));
  assert.equal(view.w.probe.form.engineId,'wan-3-prime');
  storage.getItem=get;
  await view.w.fx.act(async()=>view.w.probe.composer.handleEngineChange('wan-3'));
  assert.equal(view.w.probe.composer.activeManualMode,null);
  await view.w.fx.act(async()=>view.w.probe.composer.handleComposerModeToggle('v2v'));
  assert.equal(view.w.probe.assets.video_url[0].assetId,'source');
 }finally{await view.close();}
});

test('failed upload can be left after cancellation without reviving an earlier source',async()=>{
 const view=await mount();try{
  await view.select(source(0,'failed','error'));
  await view.w.fx.act(async()=>view.w.probe.composer.handleComposerModeToggle(null));
  assert.equal(view.w.probe.composer.activeManualMode,null);
  assert.deepEqual(Object.keys(view.w.probe.assets),[]);
  await view.w.fx.act(async()=>view.w.probe.composer.handleComposerModeToggle('v2v'));
  assert.equal(view.w.probe.assets.video_url?.[0] ?? null,null);
 }finally{await view.close();}
});


test('Create settings are restored for their owning model after another model is edited',async()=>{
 const view=await mount('wan-3','t2v');try{
  await view.w.fx.act(async()=>{view.w.probe.composer.handleDurationChange(6);view.w.probe.composer.handleAspectRatioChange('1:1');});
  await view.w.fx.act(async()=>view.w.probe.composer.handleEngineChange('wan-3-prime'));
  await view.w.fx.act(async()=>{view.w.probe.composer.handleDurationChange(8);view.w.probe.composer.handleAspectRatioChange('16:9');});
  await view.w.fx.act(async()=>view.w.probe.composer.handleEngineChange('wan-3'));
  assert.equal(view.w.probe.form.durationSec,6);
  assert.equal(view.w.probe.form.aspectRatio,'1:1');
 }finally{await view.close();}
});

for(const action of ['handleModeChange','handleEngineChange'])test(`${action} cannot strand an uploading source`,async()=>{
 const view=await mount();try{
  await view.select(source(0,'pending','uploading'));
  await view.w.fx.act(async()=>view.w.probe.composer[action](action==='handleModeChange'?'extend':'wan-3-prime'));
  assert.equal(view.w.probe.form.engineId,'wan-3');
  assert.equal(view.w.probe.composer.activeManualMode,'v2v');
  assert.equal(view.w.probe.assets.video_url[0].status,'uploading');
 }finally{await view.close();}
});

test('the legacy mode control parks Modify before selecting Extend',async()=>{
 const view=await mount();try{
  await view.select(source());
  await view.w.fx.act(async()=>view.w.probe.composer.handleModeChange('extend'));
  assert.equal(view.w.probe.composer.activeManualMode,'extend');
  assert.equal(view.w.probe.assets.video_url?.[0],undefined);
  await view.w.fx.act(async()=>view.w.probe.composer.handleModeChange('v2v'));
  assert.equal(view.w.probe.assets.video_url[0].assetId,'source');
 }finally{await view.close();}
});


test('Kling keeps its Create video reference separate from the Modify source',async()=>{
 const view=await mount('kling-o3-pro');try{
  await view.select(source(4,'create-reference'));
  await view.w.fx.act(async()=>view.w.probe.setForm({...view.w.probe.form,operation:'kling-reference'}));
  await view.w.fx.act(async()=>view.w.probe.composer.handleComposerModeToggle('v2v'));
  assert.equal(view.w.probe.composer.activeManualMode,'v2v',JSON.stringify({form:view.w.probe.form,notices:view.w.notices}));
  assert.equal(view.w.probe.assets.video_url?.[0],undefined);
  await view.select(source(4,'modify-source'));
  await view.w.fx.act(async()=>view.w.probe.composer.handleComposerModeToggle(null));
  assert.equal(view.w.probe.form.operation,'kling-reference');
  assert.equal(view.w.probe.assets.video_url[0].assetId,'create-reference');
  await view.w.fx.act(async()=>view.w.probe.composer.handleComposerModeToggle('v2v'));
  assert.equal(view.w.probe.assets.video_url[0].assetId,'modify-source');
 }finally{await view.close();}
});

test('a parked prepared excerpt preserves its owned original and editable range after reload',async()=>{
 const view=await mount();let saved:Record<string,string>={};try{
  await view.select({...source(4,'excerpt'),ref:{type:'asset',assetId:'excerpt',kind:'video'},excerptRange:{startSec:2,endSec:6},excerptSource:{...source(12,'original'),ref:{type:'job-output',jobId:'owned-job',outputId:'owned-output',kind:'video'},previewUrl:'blob:temporary-original'}});
  await view.w.fx.act(async()=>view.w.probe.composer.handleComposerModeToggle(null));
  for(let i=0;i<view.w.sessionStorage.length;i++){const key=view.w.sessionStorage.key(i);saved[key]=view.w.sessionStorage.getItem(key);}
  assert.ok(!JSON.stringify(saved).includes('blob:'));
 }finally{await view.close();}
 const reload=await mount('wan-3','t2v',{},saved);try{
  await reload.w.fx.act(async()=>reload.w.probe.composer.handleComposerModeToggle('v2v'));
  const asset=reload.w.probe.assets.video_url[0];
  assert.equal(asset.ref?.assetId,'excerpt');
  assert.equal(asset.excerptSource?.ref?.jobId,'owned-job');
  assert.equal(asset.excerptSource?.durationSec,12);
  assert.equal(asset.excerptSource?.previewUrl,'https://example.invalid/original');
  assert.equal(asset.excerptRange?.startSec,2);
  assert.equal(asset.excerptRange?.endSec,6);
 }finally{await reload.close();}
});

test('the real input-schema pruner preserves supported Modify references through Create and Extend',async()=>{
 const image={...source(0,'image'),fieldId:'image_urls',kind:'image',type:'image/png'};
 const audio={...source(4,'audio'),fieldId:'audio_urls',kind:'audio',type:'audio/mp3'};
 const view=await mount('seedance-2-0','v2v',{video_url:[source()],image_urls:[image],audio_urls:[audio]}, {}, 'owner', true);try{
  for(const mode of [null,'extend','v2v']){
    await view.w.fx.act(async()=>view.w.probe.composer.handleComposerModeToggle(mode));
    assert.equal(view.w.probe.composer.activeManualMode,mode,`the ${mode ?? 'Create'} transition must actually be accepted`);
    assert.equal(view.w.probe.assets.image_urls?.[0]?.assetId,'image');
    assert.equal(view.w.probe.assets.audio_urls?.[0]?.assetId,'audio');
    if(mode!=='v2v')assert.equal(view.w.probe.assets.video_url?.[0],undefined,'the Modify source stays out of Create and Extend');
  }
  assert.equal(view.w.probe.composer.activeManualMode,'v2v');
  assert.equal(view.w.probe.assets.video_url[0].assetId,'source');
  assert.equal(view.w.probe.assets.image_urls[0].assetId,'image');
  assert.equal(view.w.probe.assets.audio_urls[0].assetId,'audio');
  await view.w.fx.act(async()=>view.w.probe.composer.handleComposerModeToggle(null));
  await view.w.fx.act(async()=>view.w.probe.commit(previous=>({state:{...previous,image_urls:[view.w.JSON.parse(JSON.stringify({...image,id:'new-image',assetId:'new-image'}))]}})));
  await view.w.fx.act(async()=>view.w.probe.composer.handleComposerModeToggle('v2v'));
  assert.equal(view.w.probe.assets.image_urls[0].assetId,'new-image','a more recent shared reference edit must stay active');
 }finally{await view.close();}
});
