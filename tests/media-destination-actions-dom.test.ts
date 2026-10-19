import assert from 'node:assert/strict';
import test from 'node:test';
import { mountToolFixture } from './helpers/tool-selection-fixture';
const assetId=`ma_${'1'.repeat(32)}`;
const stubs={
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
