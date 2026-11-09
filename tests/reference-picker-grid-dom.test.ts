import assert from 'node:assert/strict';import test from 'node:test';
import {bundleClientFlow,createClientFlowDom} from './helpers/client-flow-dom';import {installMediaGridGeometry} from './helpers/media-grid-dom';
const bundle=bundleClientFlow(`import React,{act}from'react';import{createRoot}from'react-dom/client';import{AssetLibraryBrowser}from'./components/library/AssetLibraryBrowser';function App(){return <AssetLibraryBrowser assets={window.assets} assetType="image" source="all" availableSources={['all']} sourceLabels={{all:'All'}} onSourceChange={()=>{}} isLoading={Boolean(window.loading)} title="References" searchPlaceholder="Search" sourcesTitle="Source" emptyLabel="Empty" emptySearchLabel="No match" renderAssetActions={()=>null} selection={{scope:'model:pool',isDisabled:a=>a.id==='blocked',onConfirm:asset=>{window.accepted=[asset]},onConfirmMany:window.single?undefined:items=>window.accepted=items}}/>}const root=createRoot(document.getElementById('root'));window.IS_REACT_ACT_ENVIRONMENT=true;window.fx={act,render:()=>root.render(<App/>),unmount:()=>root.unmount()};`,{'@/lib/supabaseClientLoader':`export const loadSupabaseClient=async()=>({auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}});`});
test('ordinary picker uses the shared virtualized collection with separate explicit preview and hidden ordered selection',async()=>{
 const dom=createClientFlowDom('/app'),w=dom.window as any;installMediaGridGeometry(w);w.assets=[{id:'one',name:'One',kind:'image',url:'https://example.invalid/one.png'},{id:'two',name:'Two',kind:'image',url:'https://example.invalid/two.png'},{id:'blocked',name:'Blocked',kind:'image',url:'https://example.invalid/blocked.png'}];w.eval(await bundle);
 try{await w.fx.act(async()=>w.fx.render());assert.equal(w.document.querySelector('[data-virtualized]')?.dataset.virtualized,'true');assert.equal(w.document.querySelector('.app-picker-card'),null);
 const rows=()=>[...w.document.querySelectorAll('[data-media-key]')] as HTMLElement[];
 assert.equal(rows().length,3);assert.ok(rows()[2].querySelector('input')?.disabled);
 await w.fx.act(async()=>rows()[0].querySelector<HTMLInputElement>('input')!.click());assert.equal(w.accepted,undefined);
 await w.fx.act(async()=>{rows()[1].focus();rows()[1].dispatchEvent(new w.KeyboardEvent('keydown',{key:' ',code:'Space',bubbles:true}));rows()[1].dispatchEvent(new w.KeyboardEvent('keyup',{key:' ',code:'Space',bubbles:true}));});
 assert.equal(w.document.querySelectorAll('[data-basket-item]').length,2);
 const first=rows()[0];await w.fx.act(async()=>first.querySelector<HTMLButtonElement>('.compact-media-inspect')!.click());assert.ok(w.document.querySelector('.app-media-detail-layout'));assert.equal(w.accepted,undefined);
 await w.fx.act(async()=>[...w.document.querySelectorAll('button')].find((b:any)=>b.textContent==='Back').click());
 const grid=w.document.querySelector('[role=grid]');await w.fx.act(async()=>{w.loading=true;w.assets=[];w.fx.render();});assert.equal(w.document.querySelector('[role=grid]'),grid,'cache loading retains the virtual collection');await w.fx.act(async()=>{w.loading=false;w.fx.render();});assert.equal(w.document.querySelectorAll('[data-basket-item]').length,2);
 await w.fx.act(async()=>w.document.querySelector('.app-picker-use').click());assert.deepEqual(Array.from(w.accepted).map((a:any)=>a.id),['one','two']);
 }finally{await w.fx.act(async()=>w.fx.unmount());dom.window.close();}
});


test('single-media adapter uses the same bounded virtual collection and never accumulates multiple choices',async()=>{
 const dom=createClientFlowDom('/app'),w=dom.window as any;installMediaGridGeometry(w);w.single=true;w.assets=Array.from({length:1000},(_,i)=>({id:String(i),name:'Source '+i,kind:'image',url:'https://example.invalid/'+i+'.png'}));w.eval(await bundle);
 try{await w.fx.act(async()=>w.fx.render());const inputs=Array.from(w.document.querySelectorAll('.compact-media-check input')) as HTMLInputElement[];assert.ok(inputs.length>1&&inputs.length<1000,'virtualization bounds mounted rows');await w.fx.act(async()=>inputs[0].click());await w.fx.act(async()=>inputs[1].click());assert.equal(w.document.querySelectorAll('[data-basket-item]').length,1);await w.fx.act(async()=>w.document.querySelector('.app-picker-use').click());assert.equal(w.accepted.length,1);assert.equal(w.accepted[0].id,'1');}
 finally{await w.fx.act(async()=>w.fx.unmount());dom.window.close();}
});

test('thumbnail activation accepts only the clicked original instead of a previously staged basket', async () => {
 const dom = createClientFlowDom('/app');
 const w = dom.window as any;
 installMediaGridGeometry(w);
 w.assets = [
  { id: 'one', name: 'One', kind: 'image', url: 'https://example.invalid/one.png' },
  { id: 'two', name: 'Two', kind: 'image', url: 'https://example.invalid/two.png' },
 ];
 w.eval(await bundle);
 try {
  await w.fx.act(async () => w.fx.render());
  const rows = Array.from(w.document.querySelectorAll('[data-media-key]')) as HTMLElement[];
  await w.fx.act(async () => rows[1].querySelector<HTMLInputElement>('input')!.click());
  assert.equal(w.accepted, undefined, 'a checkbox stages without applying');
  await w.fx.act(async () => rows[0].querySelector<HTMLButtonElement>('.compact-media-preview')!.click());
  assert.deepEqual(Array.from(w.accepted ?? []).map((asset: any) => [asset.id, asset.url]), [
   ['one', 'https://example.invalid/one.png'],
  ], 'the primary action directly accepts the clicked exact original, not the staged second image');
  assert.equal(w.document.querySelector('.app-media-detail-layout'), null, 'insertion does not open the inspector');
  assert.equal(w.document.querySelectorAll('[data-basket-item]').length, 1, 'direct activation does not rewrite the pending basket');
 } finally {
  await w.fx.act(async () => w.fx.unmount());
  dom.window.close();
 }
});

const preparedBundle=bundleClientFlow(`
import React,{act}from'react';import{createRoot}from'react-dom/client';import{AssetLibraryBrowser}from'./components/library/AssetLibraryBrowser';
import{useWorkspaceAssetState}from'./app/(core)/(workspace)/app/_hooks/useWorkspaceAssetState';import{useWorkspaceReferenceAssets}from'./app/(core)/(workspace)/app/_hooks/useWorkspaceReferenceAssets';
function App(){const state=useWorkspaceAssetState('alice');const actions=useWorkspaceReferenceAssets({accountScope:'alice',engineId:'model',workflowIntent:'ref2v',preferredMode:'ref2v',engine:null,inputAssets:state.inputAssets,setInputAssets:state.setInputAssets,commitInputAssetMutation:state.commitInputAssetMutation,assetLibrarySource:'recent',setAssetLibrary:()=>{},setAssetPickerTarget:()=>{},resetAssetLibraryForSource:()=>{},showNotice:()=>{},workflowCopy:{clearReferencesToUseStartEnd:'clear',clearStartEndToUseReferences:'clear'}});window.state=state;return <AssetLibraryBrowser assets={window.assets} assetType="video" source={window.source} availableSources={['recent','all']} sourceLabels={{recent:'Recent',all:'All'}} onSourceChange={source=>{window.source=source;window.publish()}} isLoading={false} title="References" searchPlaceholder="Search" sourcesTitle="Source" emptyLabel="Empty" emptySearchLabel="No match" renderAssetActions={()=>null} selection={{ownerId:'alice',scope:'model:pool',onConfirmMany:(assets,acceptance)=>actions.handleSelectLibraryAssets(window.field,assets,acceptance)}}/>}
const root=createRoot(document.getElementById('root'));window.IS_REACT_ACT_ENVIRONMENT=true;window.publish=()=>root.render(<App/>);window.fx={act,render:window.publish,unmount:()=>root.unmount()};`,{'@/lib/api':`export const saveAssetToLibrary=(asset)=>window.mirror(asset);export const saveImageToLibrary=(asset)=>window.mirror(asset);`,'@/lib/owned-auth-fetch':`export const ownedAuthFetch=(input,owner,init)=>window.fetch(input,init);`,'@/lib/supabaseClientLoader':`export const loadSupabaseClient=async()=>({auth:{getSession:async()=>({data:{session:{user:{id:'alice'}}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}});`});
test('prepared mirror with the same internal id retains the captured typed source and retries the ordered basket once',async()=>{
 const dom=createClientFlowDom('/app'),w=dom.window as any;installMediaGridGeometry(w);
 const output=(id:string)=>({id:'output:'+id,name:id,kind:'video',source:'recent',jobId:'job',sourceOutputId:id,url:'https://external.test/'+id+'.mp4',libraryRef:{type:'job-output',jobId:'job',outputId:id,kind:'video'}});
 const originals=[output('one'),output('two')];w.assets=originals;w.source='recent';w.field={id:'video_urls',type:'video',maxCount:3};let saves=0;const proofs:any[]=[];
 w.fetch=async(_url:string,init:any)=>{const body=JSON.parse(init.body);proofs.push(body);return {ok:true,json:async()=>({ok:true,results:body.candidates.map((c:any)=>({reference:c.reference}))})};};
 w.mirror=async(a:any)=>{saves++;if(saves===2)throw Error('later save failed');const assetId='ma_'+(saves===1?'1':'2').repeat(32);const saved={id:'output:'+a.sourceOutputId,assetId,kind:'video',source:'saved_job_output',url:'https://durable.test/'+a.sourceOutputId+'.mp4',libraryRef:{type:'asset',assetId,kind:'video'}};if(saves===1){w.assets=[saved,originals[1]];w.source='all';w.publish();}return saved;};w.eval(await preparedBundle);
 try{await w.fx.act(async()=>w.fx.render());const inputs=Array.from(w.document.querySelectorAll('.compact-media-check input')) as HTMLInputElement[];for(const input of inputs)await w.fx.act(async()=>input.click());
 await w.fx.act(async()=>w.document.querySelector('.app-picker-use').click());assert.equal(saves,2);assert.deepEqual(Object.keys(w.state.inputAssets),[]);assert.equal(w.document.querySelectorAll('[data-basket-item]').length,2);assert.equal(w.document.querySelector('.app-picker-use').disabled,false,'canonical projection must not invalidate the captured job output');
 await w.fx.act(async()=>w.document.querySelector('.app-picker-use').click());assert.equal(saves,3,'completed first mirror is reused');assert.equal(w.state.inputAssetMutationRevision,1);assert.deepEqual(Array.from(w.state.inputAssets.video_urls).filter(Boolean).map((a:any)=>a.url),['https://durable.test/one.mp4','https://durable.test/two.mp4']);assert.deepEqual(proofs[1].candidates.map((c:any)=>c.originalUrl),originals.map(a=>a.url));assert.ok(proofs[1].candidates.every((c:any)=>c.reference.type==='job-output'));
 await w.fx.act(async()=>{w.assets=[{...originals[0],url:'https://external.test/replaced.mp4'},originals[1]];w.publish();});assert.equal(w.document.querySelector('.app-picker-use').disabled,true,'actual replacement of the same typed output remains refused');
 }finally{await w.fx.act(async()=>w.fx.unmount());dom.window.close();}
});
