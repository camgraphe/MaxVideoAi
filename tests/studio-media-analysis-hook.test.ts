import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {useConversationAnalysis} from '../frontend/app/(core)/(workspace)/app/studio/conversation/[projectId]/_hooks/useConversationAnalysis';

const quote={analysisId:'f2929a29-91b4-4c81-a731-820d6d3d7102',ref:{type:'asset' as const,assetId:'ma_'+'a'.repeat(32),kind:'video' as const},goal:'Find the turn',reason:'requested' as const,startSec:0,endSec:30,maxCredits:80,policyVersion:'qualified-v1',expiresAt:'2026-10-06T23:00:00.000Z',profile:'video-frames-v1' as const,model:'gpt-6.1-sol' as const,confirmationRequired:true as const};
type Pending={init:RequestInit;resolve:(response:Response)=>void};
async function harness(run:(h:{state:()=>ReturnType<typeof useConversationAnalysis>;requests:Pending[];render:(account:string)=>Promise<void>;reply:(index:number,state:string,id?:string)=>Promise<void>})=>Promise<void>){
  const dom=new JSDOM('<div id="root"></div>',{url:'https://maxvideoai.com/app/studio'}),requests:Pending[]=[];
  const globals={window:dom.window,document:dom.window.document,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true,fetch:(_url:unknown,init:RequestInit={})=>new Promise<Response>(resolve=>requests.push({init,resolve}))};
  const previous=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  for(const [key,value] of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
  const root=createRoot(dom.window.document.getElementById('root')!);let state!:ReturnType<typeof useConversationAnalysis>;
  function Probe({account}:{account:string}){state=useConversationAnalysis('film',account,quote);return null;}
  const render=async(account:string)=>{await act(async()=>{root.render(React.createElement(Probe,{account}));});};
  const reply=async(index:number,value:string,id=quote.analysisId)=>{await act(async()=>{requests[index].resolve(new Response(JSON.stringify({ok:true,result:{quote:{...quote,analysisId:id},state:value,result:null,chargedCredits:null,error:null}}),{headers:{'content-type':'application/json'}}));});};
  try{await render('a');await run({state:()=>state,requests,render,reply});}finally{await act(async()=>root.unmount());dom.window.close();for(const [key,value] of previous){if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);}}
}
test('an analysis read rejects a response identifying another quote',async()=>{
  await harness(async({state,reply})=>{await reply(0,'prepared','f2929a29-91b4-4c81-a731-820d6d3d7103');assert.equal(state().status,null);assert.ok(state().error);});
});
test('reads never confirm; duplicate clicks send one exact POST and a late read cannot undo it',async()=>{
  await harness(async({state,requests,reply})=>{
    assert.equal(requests[0].init.method,undefined);await reply(0,'prepared');
    let refreshing!:Promise<boolean>;await act(async()=>{refreshing=state().refresh();});
    let first!:Promise<boolean>,second!:Promise<boolean>;await act(async()=>{first=state().confirm();second=state().confirm();});
    assert.equal(await second,false);assert.equal(requests.filter(r=>r.init.method==='POST').length,1);
    assert.deepEqual(JSON.parse(String(requests[2].init.body)),{analysisId:quote.analysisId,maxCredits:80,policyVersion:'qualified-v1',confirmed:true});
    await reply(2,'queued');assert.equal(await first,true);await reply(1,'prepared');await refreshing;
    assert.equal(state().status?.state,'queued');
  });
});
test('changing accounts isolates late confirmations and cannot carry an old paid result',async()=>{
  await harness(async({state,requests,reply,render})=>{
    await reply(0,'prepared');let confirming!:Promise<boolean>;await act(async()=>{confirming=state().confirm();});
    await render('b');assert.equal(state().status,null);assert.equal(requests[1].init.signal?.aborted,true);
    await reply(1,'queued');assert.equal(await confirming,false);assert.equal(state().status,null);
    await reply(2,'prepared');assert.equal(state().status?.state,'prepared');
  });
});
