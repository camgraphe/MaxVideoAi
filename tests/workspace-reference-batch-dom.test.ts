import assert from 'node:assert/strict';
import test from 'node:test';
import {bundleClientFlow,createClientFlowDom} from './helpers/client-flow-dom';
const bundle=bundleClientFlow(`
import React,{act} from 'react';import {createRoot} from 'react-dom/client';
import {useWorkspaceAssetState} from './app/(core)/(workspace)/app/_hooks/useWorkspaceAssetState';
import {useWorkspaceReferenceAssets} from './app/(core)/(workspace)/app/_hooks/useWorkspaceReferenceAssets';
function App(){const state=useWorkspaceAssetState(window.owner);const actions=useWorkspaceReferenceAssets({accountScope:window.owner,assetPickerTarget:window.target,engineId:window.model,workflowIntent:window.intent,engine:null,preferredMode:window.mode,inputSchema:window.schema,inputAssets:state.inputAssets,setInputAssets:state.setInputAssets,commitInputAssetMutation:state.commitInputAssetMutation,assetLibrarySource:'all',setAssetLibrary:()=>{},setAssetPickerTarget:()=>window.closed++,resetAssetLibraryForSource:()=>{},showNotice:()=>{},workflowCopy:{clearReferencesToUseStartEnd:'clear refs',clearStartEndToUseReferences:'clear frames'}});window.probe={...state,...actions};return null;}
const root=createRoot(document.getElementById('root'));window.IS_REACT_ACT_ENVIRONMENT=true;window.fx={act,render:()=>root.render(<App/>),unmount:()=>root.unmount()};
`,{'@/lib/api':`export const saveAssetToLibrary=(asset)=>window.mirror(asset);export const saveImageToLibrary=(asset)=>window.mirror(asset);`});
const asset=(id:string,kind='image')=>({id,url:'https://example.invalid/'+id+(kind==='image'?'.png':'.mp4'),kind,source:kind==='video'?'recent':'upload',mime:kind==='image'?'image/png':'video/mp4',durationSec:5});
async function mount(){const dom=createClientFlowDom('/app'),w=dom.window as any;Object.assign(w,{owner:'A',model:'model-A',intent:null,mode:'t2v',closed:0,schema:null,mirror:async(x:any)=>({...x,id:'saved',assetId:'ma_'+'a'.repeat(32)})});w.eval(await bundle);await w.fx.act(async()=>w.fx.render());return {w,close:async()=>{await w.fx.act(async()=>w.fx.unmount());dom.window.close();}};}
test('video domain batch appends in order once and refuses last incompatible or excessive member without mutation',async()=>{
 const f=await mount();try {const field={id:'image_urls',type:'image',maxCount:3};
 await f.w.fx.act(async()=>assert.equal(await f.w.probe.handleSelectLibraryAssets(field,[asset('one'),asset('two')]),true));
 assert.deepEqual(Array.from(f.w.probe.inputAssets.image_urls).filter(Boolean).map((x:any)=>x.url),[asset('one').url,asset('two').url]);assert.equal(f.w.probe.inputAssetMutationRevision,1);
 const before=JSON.stringify(f.w.probe.inputAssets);
 for(const items of [[asset('three'),asset('four')],[asset('three'),asset('audio','audio')]]){
 await f.w.fx.act(async()=>assert.equal(typeof await f.w.probe.handleSelectLibraryAssets(field,items),'string'));assert.equal(JSON.stringify(f.w.probe.inputAssets),before);assert.equal(f.w.probe.inputAssetMutationRevision,1);}
 }finally{await f.close();}
});
for(const change of ['model','intent','mode','opening','failure'] as const)test(`prepared video batch ${change} does not partially publish`,async()=>{
 const f=await mount();try {let resolve!:(value:any)=>void;let calls=0;f.w.mirror=async(a:any)=>{calls++;if(calls===2)return new Promise(done=>resolve=done);return {...a,id:'saved-1',assetId:'ma_'+'1'.repeat(32)};};
 const field={id:'video_urls',type:'video',maxCount:3};if(change==='opening'){f.w.target={kind:'field',field,slotIndex:undefined};await f.w.fx.act(async()=>f.w.fx.render());}let pending!:Promise<unknown>;
 await f.w.fx.act(async()=>{pending=f.w.probe.handleSelectLibraryAssets(field,[asset('one','video'),asset('two','video')]);});
 assert.deepEqual(Object.keys(f.w.probe.inputAssets),[]);
 if(change==='model')f.w.model='model-B';if(change==='intent')f.w.intent='v2v';if(change==='mode')f.w.mode='v2v';if(change==='opening')f.w.target={kind:'field',field,slotIndex:undefined};
 await f.w.fx.act(async()=>f.w.fx.render());
 await f.w.fx.act(async()=>{resolve(change==='failure'?null:{...asset('two','video'),id:'saved-2',assetId:'ma_'+'2'.repeat(32)});await pending;});
 if(change==='mode'){assert.equal(f.w.probe.inputAssets.video_urls.filter(Boolean).length,2);assert.equal(f.w.probe.inputAssetMutationRevision,1);}else assert.deepEqual(Object.keys(f.w.probe.inputAssets),[]);
 }finally{await f.close();}
});

for(const budget of ['global','per-kind','late-field'] as const)test('batch admission rechecks '+budget+' against current draft without partial commit',async()=>{
 const f=await mount();try{
  const field={id:'video_urls',type:'video',maxCount:3};f.w.mode='ref2v';
  f.w.schema={optional:[field],referenceBudget:{fieldIds:['video_urls'],modes:['ref2v'],maxTotal:budget==='global'?1:10,countUniqueUrls:true,...budget==='per-kind'?{maxByType:{video:1}}:{}}};await f.w.fx.act(async()=>f.w.fx.render());
  if(budget==='late-field'){
   let finish!:(x:any)=>void;f.w.mirror=async(a:any)=>new Promise(done=>finish=()=>done({...a,id:'saved',assetId:'ma_'+'a'.repeat(32)}));let pending!:Promise<unknown>;
   await f.w.fx.act(async()=>{pending=f.w.probe.handleSelectLibraryAssets(field,[asset('one','video')]);});
   f.w.schema.optional[0]={...field,maxCount:1};await f.w.fx.act(async()=>{f.w.probe.setInputAssets({video_urls:[{id:'already',url:'https://example.invalid/current.mp4',kind:'video',fieldId:'video_urls',status:'ready',type:'video/mp4',previewUrl:'https://example.invalid/current.mp4',name:'current',size:0}]});f.w.fx.render();});
   const before=JSON.stringify(f.w.probe.inputAssets);await f.w.fx.act(async()=>{finish(null);assert.equal(typeof await pending,'string');});assert.equal(JSON.stringify(f.w.probe.inputAssets),before);
  }else await f.w.fx.act(async()=>{assert.equal(typeof await f.w.probe.handleSelectLibraryAssets(field,[asset('one','video'),asset('two','video')]),'string');assert.deepEqual(Object.keys(f.w.probe.inputAssets),[]);});
  assert.equal(f.w.probe.inputAssetMutationRevision,0);
 }finally{await f.close();}
});

test('completed preparation is reused after last-member failure and slot replacement commits once',async()=>{
 const f=await mount();try{
  let calls=0;f.w.mirror=async(a:any)=>{calls++;if(calls===2)throw Error('second failed');return {...a,id:'saved-'+calls,assetId:'ma_'+String(calls).repeat(32)};};
  const field={id:'video_urls',type:'video',maxCount:2},items=[asset('one','video'),asset('two','video')];
  await f.w.fx.act(async()=>assert.match(await f.w.probe.handleSelectLibraryAssets(field,items),/1 media saved/));assert.deepEqual(Object.keys(f.w.probe.inputAssets),[]);
  await f.w.fx.act(async()=>assert.equal(await f.w.probe.handleSelectLibraryAssets(field,items),true));assert.equal(calls,3);assert.equal(f.w.probe.inputAssetMutationRevision,1);
  await f.w.fx.act(async()=>f.w.probe.handleSelectLibraryAsset(field,{...asset('replacement','video'),source:'upload'},0));
  assert.deepEqual(Array.from(f.w.probe.inputAssets.video_urls).map((x:any)=>x.url),[asset('replacement','video').url,items[1].url]);assert.equal(f.w.probe.inputAssetMutationRevision,2);
 }finally{await f.close();}
});
