import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import * as React from 'react';
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {usePreparedConversationExport} from '../frontend/app/(core)/(workspace)/app/studio/conversation/[projectId]/_hooks/usePreparedConversationExport';
const quote={quoteId:'11111111-1111-4111-8111-111111111111',exportId:'tlx_'+'a'.repeat(64),projectId:'film',sequenceId:'main',revision:2,durationSec:5,resolution:'720p',aspectRatio:'16:9',fps:30,qualityPreset:'draft' as const,includeAudio:true,price:{amountCents:0,currency:'USD' as const,billingKind:'free' as const},expiresAt:'2099-01-01T00:00:00.000Z',confirmationRequired:true as const};
test('chat export confirmation requires a click, keeps its quote identity after a lost reply and recovers the recorded price',async()=>{
  const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost:3000/'});
  const old=new Map<string,PropertyDescriptor|undefined>();const posts:any[]=[];
  let drop=true,malformed=true,refreshes=0;
  for(const[key,value]of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,IS_REACT_ACT_ENVIRONMENT:true,fetch:async(url:string,options?:RequestInit)=>{
    assert.equal(url,'/api/studio/projects/film/conversation-exports');
    assert.equal(options?.method,'POST');posts.push(JSON.parse(String(options?.body)));
    if(drop){drop=false;throw new TypeError('Lost acknowledgement');}
    if(malformed){malformed=false;return {ok:true,json:async()=>({ok:true,result:{ok:true,export:{id:'another-export',status:'queued'},reused:true}})};}
    return {ok:true,json:async()=>({ok:true,result:{ok:true,export:{id:quote.exportId,status:'queued',progress:0,message:null,artifact:null,billing:{amountCents:15,currency:'USD',billingKind:'paid'}},reused:true}})};
  }})){old.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
  let state!:ReturnType<typeof usePreparedConversationExport>;let jobs:any[]=[];
  const refresh=async()=>{refreshes++;};
  function Fixture(){state=usePreparedConversationExport(quote,jobs,refresh);return null;}
  let root=createRoot(dom.window.document.getElementById('root')!);
  try{
    await act(async()=>root.render(React.createElement(Fixture)));assert.equal(posts.length,0);
    await act(async()=>Promise.all([state.confirm(),state.confirm()]));
    assert.equal(posts.length,1,'double click cannot dispatch twice');
    assert.equal(state.uncertain,true);
    assert.deepEqual(posts[0],{quoteId:quote.quoteId,confirmed:true});
    await act(async()=>root.unmount());root=createRoot(dom.window.document.getElementById('root')!);
    await act(async()=>root.render(React.createElement(Fixture)));
    assert.equal(state.uncertain,true,'reload keeps unresolved confirmation identity');
    await act(async()=>state.confirm());assert.equal(posts.length,2);
    assert.equal(state.uncertain,true,'an invalid acknowledgement keeps the original pending identity');
    assert.equal(state.job,null,'a different export must not be accepted as this quote');
    await act(async()=>state.confirm());assert.equal(posts.length,3);
    assert.deepEqual(posts[1],posts[0],'retry recovers the same export rather than creating another quote');
    assert.equal(state.job?.billing?.amountCents,15,'job price is authoritative during recovery');
    jobs=[{id:quote.exportId,status:'completed',progress:100,message:null,artifact:null,billing:{amountCents:15,currency:'USD',billingKind:'paid'}}];
    await act(async()=>root.render(React.createElement(Fixture)));await act(async()=>state.confirm());
    assert.equal(posts.length,3,'completed renders never resubmit');
    assert.ok(refreshes>=2);
  }finally{await act(async()=>root.unmount());dom.window.close();for(const[key,value]of old){if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);}}
});
