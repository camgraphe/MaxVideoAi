import assert from 'node:assert/strict';
import test from 'node:test';
import {bundleClientFlow,createClientFlowDom} from './helpers/client-flow-dom';
import {deferred} from './helpers/auth-legal-client-fixture';
const bundle=bundleClientFlow(`
import React,{act,useState} from 'react';import {createRoot} from 'react-dom/client';
import {OwnedGenerationSourcePicker} from './app/(core)/(workspace)/app/_components/OwnedGenerationSourcePicker.client';
function Main(){const [id,setId]=useState('');window.external=setId;return <OwnedGenerationSourcePicker compact={window.compact} authAction={{label:'Sign in to choose a video',href:'/login?mode=signin&next=%2Fapp'}} account={window.account} operation={window.operation} sourceJobId={id} locale="en" onSelect={source=>{window.selections.push(source);setId(source?.sourceJobId??'')}}/>;}
const root=createRoot(document.getElementById('root'));window.IS_REACT_ACT_ENVIRONMENT=true;window.fx={act,render:()=>root.render(<Main/>),unmount:()=>root.unmount()};`,{});
const option=(id:string,preparation='ready')=>({sourceJobId:id,sourceOutputId:id+'-output',label:'My '+id,createdAt:'2026-10-24',durationSec:5,preparation});
test('owned picker loads readable generations and only binds historical Draft after explicit preparation; stale account and source completions cannot bind',async()=>{
 for(const transition of ['success','account','source']){
  const dom=createClientFlowDom('/app'),w=dom.window as any;w.account={userId:'alice',token:'alice-token'};w.operation='flux-draft-enhance';w.selections=[];
  const recovery=deferred<any>(),calls:any[]=[];
  w.fetch=async(url:string,init:RequestInit)=>{calls.push([url,init]);if(init.method==='POST')return recovery.promise;return {ok:true,json:async()=>({ok:true,sources:[option('historical','prepare'),option('new')],nextCursor:null})};};
  w.eval(await bundle);
  try{
   await w.fx.act(async()=>w.fx.render());
   assert.equal(w.document.querySelector('input'),null,'no job ID input');
   const select=w.document.querySelector('select');assert.match(select.textContent,/My historical/);
   await w.fx.act(async()=>{select.value='historical';select.dispatchEvent(new w.Event('change',{bubbles:true}));});
   assert.equal(w.selections.at(-1),null,'missing cache cannot enter the quote before recovery');
   await w.fx.act(async()=>w.document.querySelector('[data-testid="prepare-owned-draft"]').click());
   assert.equal(calls.filter(c=>c[1].method==='POST').length,1);assert.match(calls.at(-1)[0],/historical\/draft-cache$/);
   if(transition==='account')await w.fx.act(async()=>{w.account={userId:'bob',token:'bob-token'};w.fx.render();});
   if(transition==='source')await w.fx.act(async()=>w.external('new'));
   await w.fx.act(async()=>recovery.resolve({ok:true,json:async()=>({ok:true,enhanceable:true})}));
   assert.equal(w.selections.some((source:any)=>source?.sourceJobId==='historical'),transition==='success');
   if(transition==='success'){
    assert.equal(w.selections.at(-1).sourceOutputId,'historical-output');
    await w.fx.act(async()=>{w.document.querySelector('select').value='';w.document.querySelector('select').dispatchEvent(new w.Event('change',{bubbles:true}));});
    assert.equal(w.selections.at(-1),null);
   }
  }finally{await w.fx.act(async()=>w.fx.unmount());dom.window.close();}
 }
});

test('compact owned source opens the common reference dialog and retains source validation while closed', async () => {
 const dom=createClientFlowDom('/app'),w=dom.window as any;
 w.account={userId:'alice',token:'alice-token'};w.operation='luma-extend';w.compact=true;w.selections=[];
 w.fetch=async()=>({ok:true,json:async()=>({ok:true,sources:[option('ready'),option('gone','unavailable')],nextCursor:null})});
 w.eval(await bundle);
 try {
  await w.fx.act(async()=>w.fx.render());
  const trigger=()=>w.document.querySelector('[data-owned-source-trigger]');
  assert.match(trigger()?.textContent??'',/Video to extend.*Required/);
  assert.equal(w.document.querySelector('select'),null);
  await w.fx.act(async()=>trigger().click());
  assert.ok(w.document.querySelector('.app-reference-popup[role=dialog]'));
  assert.equal(w.document.querySelector('input[type=file]'),null);
  const select=w.document.querySelector('select');
  await w.fx.act(async()=>{select.value='ready';select.dispatchEvent(new w.Event('change',{bubbles:true}));});
  assert.equal(w.selections.at(-1).sourceOutputId,'ready-output');
  await w.fx.act(async()=>Array.from(w.document.querySelectorAll('button')).find((b:any)=>b.textContent==='Close').click());
  assert.equal(w.document.activeElement,trigger());
  assert.match(trigger().textContent,/1\/1/);
  await w.fx.act(async()=>w.external('gone'));
  assert.equal(w.selections.at(-1),null,'closed picker still rejects an externally recalled ineligible source');
  assert.match(trigger().textContent,/Required/);
 } finally {await w.fx.act(async()=>w.fx.unmount());dom.window.close();}
});

test('guest compact source explains sign-in in its dialog without requests or an empty-account claim', async () => {
 const dom=createClientFlowDom('/app'),w=dom.window as any;
 w.account=null;w.operation='luma-extend';w.compact=true;w.selections=[];let calls=0;
 w.fetch=async()=>{calls++;throw new Error('Guest cannot request sources');};
 w.eval(await bundle);
 try {
  await w.fx.act(async()=>w.fx.render());
  assert.equal(w.document.querySelector('a'),null);
  await w.fx.act(async()=>w.document.querySelector('[data-owned-source-trigger]').click());
  assert.match(w.document.querySelector('[role=dialog]').textContent,/Luma.*Ray 3\.2/);
  assert.equal(w.document.querySelector('a').getAttribute('href'),'/login?mode=signin&next=%2Fapp');
  assert.doesNotMatch(w.document.body.textContent,/No eligible generations/);
  assert.equal(calls,0);
 } finally {await w.fx.act(async()=>w.fx.unmount());dom.window.close();}
});
