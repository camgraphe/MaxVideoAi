import assert from 'node:assert/strict';
import test from 'node:test';
import { mountToolFixture } from './helpers/tool-selection-fixture';
const assetId=`ma_${'1'.repeat(32)}`;
const stubs={
  '@/hooks/useRequireAuth':'export const useRequireAuth=()=>({user:{id:window.account??"account-a"},session:{access_token:"fixture"},loading:false});',
  '@/lib/authFetch':'export const authFetch=(url,init)=>window.fixtureFetch(url,init);',
  '@/content/feature-flags':'export const FEATURES={studio:{maxVideoAiEditor:true}};',
  'next/navigation':'export const useRouter=()=>({push:url=>window.navigations.push(url)});',
  'next/link':"import React from 'react';export default p=>React.createElement('a',{href:p.href},p.children);",
  'next/dynamic':"import React,{lazy,Suspense} from 'react';export default load=>{const Component=lazy(()=>load().then(value=>({default:value})));return props=>React.createElement(Suspense,{fallback:null},React.createElement(Component,props));};",
};
async function mount(presentation?:'creator') {
 return mountToolFixture(`import {MediaDestinationActions} from './components/library/MediaDestinationActions.client';function App(){return <MediaDestinationActions userId="account-a" locale="en" ${presentation?'presentation="creator"':''} asset={{id:'${assetId}',url:'https://private.invalid/original.png',kind:'image',name:'Product'}}/>}`,stubs,w=>{w.navigations=[];});
}
test('creator result actions expose the real Studio picker first and group transforms without initiating any edit',async()=>{
 const f=await mount('creator');try{
  const root=f.w.document.querySelector('.creator-media-destinations');assert.ok(root);assert.equal(root.firstElementChild.className,'creator-studio-action');
  const studio=root.querySelector('.creator-studio-action details');assert.ok(studio);assert.equal(studio.querySelector('summary').textContent,'Use in Studio');assert.equal(studio.open,false);
  const others=root.querySelector('.creator-other-tools');assert.equal(others.open,false);assert.equal(others.querySelector('summary').textContent,'Other tools');assert.ok(others.querySelectorAll('button').length>=3);assert.equal(others.querySelector('details'),null);
  assert.equal(f.w.requests.length,0);assert.equal(f.w.navigations.length,0);
  await f.act(async()=>{studio.open=true;await new Promise(resolve=>setTimeout(resolve,0));});
  assert.equal(f.w.requests.length,2);assert.equal(f.w.requests[0].url,'/api/studio/conversation-projects');assert.equal(f.w.requests[1].url,'/api/studio/media/resolve');
  assert.deepEqual(JSON.parse(f.w.requests[1].init.body),{refs:[{type:'asset',assetId,kind:'image'}]});
  await f.respond(f.w.requests[0],{ok:true,projects:[]});await f.respond(f.w.requests[1],{ok:true,assets:[{mediaFacts:{source:'probe',width:800,height:600}}]});
  assert.equal(f.w.requests.length,2);assert.match(studio.textContent,/Create a film in Studio first/);
 }finally{await f.close();}
});
test('default media actions retain direct transformations and creator transforms still stage the exact original',async()=>{
 const standard=await mount();try{assert.ok(standard.w.document.querySelector('.app-media-destinations'));assert.ok(standard.w.document.querySelectorAll('.app-media-destinations>button').length>=3);assert.equal(standard.w.document.querySelector('.creator-media-destinations'),null);}finally{await standard.close();}
 const creator=await mount('creator');try{
  const details=creator.w.document.querySelector('.creator-other-tools');await creator.act(async()=>{details.open=true;details.querySelector('button').click();});
  assert.equal(creator.w.navigations.length,1);assert.match(creator.w.navigations[0],/^\/app\?media=/);
  assert.equal(creator.w.requests.length,0);const saved=Array.from({length:creator.w.sessionStorage.length},(_,index)=>creator.w.sessionStorage.getItem(creator.w.sessionStorage.key(index))).join('');
  assert.match(saved,/https:\/\/private\.invalid\/original\.png/);assert.match(saved,new RegExp(assetId));
 }finally{await creator.close();}
});

test('video modal exposes Modify from the authenticated catalog and stages the exact ready gallery original',async()=>{
 const f=await mountToolFixture(`import {MediaDestinationActions} from './components/library/MediaDestinationActions.client';function App(){return <MediaDestinationActions userId="account-a" locale="fr" sourceEngineId="unrelated-model" asset={{id:'gallery-output',jobId:'job-a',source:'gallery',url:'https://media.invalid/original.mp4',previewUrl:'https://media.invalid/preview.mp4',kind:'video',durationSec:5}}/>}`,stubs,w=>{w.navigations=[];});
 try {
  const button=()=>Array.from(f.w.document.querySelectorAll('button')).find((node:any)=>node.textContent==='Modifier la vidéo') as HTMLButtonElement|undefined;
  assert.equal(button(),undefined);
  const catalog=f.w.requests.find((request:any)=>request.url==='/api/engines');assert.ok(catalog,'load account-visible destinations');
  await f.respond(catalog,{ok:true,engines:[{id:'wan-3',label:'Wan 3',modes:['v2v'],availability:'available',status:'live',inputLimits:{},inputSchema:{required:[{id:'video_url',type:'video',label:'Source',modes:['v2v']}]}}]});
  assert.ok(button());await f.act(async()=>button()!.click());
  const original=f.w.requests.find((request:any)=>request.url.includes('/recent-outputs?'));assert.ok(original);
  await f.respond(original,{ok:true,outputs:[{id:'exact-output',jobId:'job-a',kind:'video',url:'https://media.invalid/original.mp4',status:'ready',durationSec:5}]});
  assert.equal(f.w.navigations.length,1);assert.match(f.w.navigations[0],/&engine=wan-3&mode=v2v$/);
  const saved=JSON.parse(f.w.sessionStorage.getItem('maxvideoai:media-handoff:v1'));
  assert.equal(saved.asset.url,'https://media.invalid/original.mp4');assert.equal(saved.asset.sourceOutputId,'exact-output');
  assert.equal(f.w.requests.length,2,'navigation never submits a generation');
 } finally {await f.close();}
});

const modifyCatalog={ok:true,engines:[{id:'luma-ray-3-2',label:'Luma',modes:['v2v'],availability:'available',status:'live',inputLimits:{},inputSchema:{required:[{id:'video_url',type:'video',label:'Source',modes:['v2v']}]}}]};
async function mountChangingVideo() {
 return mountToolFixture(`import {MediaDestinationActions} from './components/library/MediaDestinationActions.client';function App(){return <MediaDestinationActions userId={window.account} locale="en" asset={{id:'gallery-output',jobId:'job-a',source:'gallery',url:'https://media.invalid/original.mp4',kind:'video',durationSec:5}}/>}`,stubs,w=>{w.account='account-a';w.navigations=[];});
}
function modifyButton(w:any):HTMLButtonElement|undefined {
 return Array.from(w.document.querySelectorAll('button')).find((node:any)=>node.textContent==='Modify video') as HTMLButtonElement|undefined;
}
test('account changes discard private destination catalogs, ignore late originals and leave the new selection usable',async()=>{
 const f=await mountChangingVideo();
 try {
  await f.respond(f.w.requests[0],modifyCatalog);
  await f.act(async()=>modifyButton(f.w)!.click());
  const oldOriginal=f.w.requests[1];assert.ok(oldOriginal.url.includes('/recent-outputs?'));
  f.w.account='account-b';await f.render();
  assert.equal(modifyButton(f.w),undefined,'previous account destinations must disappear');
  await f.respond(oldOriginal,{ok:true,outputs:[{id:'old-output',url:'https://media.invalid/original.mp4',kind:'video',status:'ready'}]});
  assert.equal(f.w.navigations.length,0);assert.equal(f.w.sessionStorage.length,0);
  await f.respond(f.w.requests[2],modifyCatalog);
  assert.equal(modifyButton(f.w)?.disabled,false,'the old request cannot leave the new account pending');
  await f.act(async()=>modifyButton(f.w)!.click());
  await f.respond(f.w.requests[3],{ok:true,outputs:[{id:'new-output',url:'https://media.invalid/original.mp4',kind:'video',status:'ready'}]});
  assert.equal(f.w.navigations.length,1);
  assert.equal(JSON.parse(f.w.sessionStorage.getItem('maxvideoai:media-handoff:v1')).account,'account-b');
 } finally {await f.close();}
});
test('late catalogs, degraded fallbacks and responses after unmount cannot expose or launch Modify',async()=>{
 const f=await mountChangingVideo();
 try {
  const oldCatalog=f.w.requests[0];f.w.account='account-b';await f.render();
  await f.respond(oldCatalog,modifyCatalog);assert.equal(modifyButton(f.w),undefined);
  await f.respond(f.w.requests[1],{...modifyCatalog,degraded:true});assert.equal(modifyButton(f.w),undefined);
  f.w.account='account-c';await f.render();await f.respond(f.w.requests[2],modifyCatalog);
  await f.act(async()=>modifyButton(f.w)!.click());
  const original=f.w.requests[3];await f.act(async()=>f.w.fx.unmount());
  await f.respond(original,{ok:true,outputs:[{id:'late-output',url:'https://media.invalid/original.mp4',kind:'video',status:'ready'}]});
  assert.equal(f.w.navigations.length,0);assert.equal(f.w.sessionStorage.length,0);
 } finally {await f.close();}
});
