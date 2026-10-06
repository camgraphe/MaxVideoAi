import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {useConversationTask} from '../frontend/app/(core)/(workspace)/app/studio/conversation/[projectId]/_hooks/useConversationTask';
import {STUDIO_TASK_POLICY_VERSION,type StudioTaskStatus} from '../frontend/src/lib/studio/task-budget-contract';
const task:StudioTaskStatus={requestId:'f2929a29-91b4-4c81-a731-820d6d3d7102',profile:'standard',policyVersion:STUDIO_TASK_POLICY_VERSION,model:'gpt-6.1-sol',state:'paused',phase:'paused',maxCredits:250,consumedCredits:20,reservedCredits:0,completedCalls:4,allowedCalls:4,revision:0,canContinue:true,error:'steps'};
type Pending={init:RequestInit;resolve:(response:Response)=>void};
async function harness(run:(h:{state:()=>ReturnType<typeof useConversationTask>;requests:Pending[];render:(account:string)=>Promise<void>;reply:(index:number,id?:string)=>Promise<void>;changed:()=>number})=>Promise<void>){
  const dom=new JSDOM('<div id="root"></div>',{url:'https://maxvideoai.com/app/studio'}),requests:Pending[]=[];let changes=0;
  const globals={window:dom.window,sessionStorage:dom.window.sessionStorage,document:dom.window.document,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true,fetch:(_url:unknown,init:RequestInit={})=>new Promise<Response>(resolve=>requests.push({init,resolve}))};
  const previous=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));for(const [key,value] of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
  const root=createRoot(dom.window.document.getElementById('root')!);let state!:ReturnType<typeof useConversationTask>;
  function Probe({account}:{account:string}){state=useConversationTask('film',account,task,()=>{changes++;});return null;}
  const render=async(account:string)=>{await act(async()=>root.render(React.createElement(React.StrictMode,null,React.createElement(Probe,{account}))));};
  const reply=async(index:number,id=task.requestId)=>{await act(async()=>requests[index].resolve(new Response(JSON.stringify({ok:true,result:{...task,requestId:id,state:'queued'}}))));};
  try{await render('a');await run({state:()=>state,requests,render,reply,changed:()=>changes});}finally{await act(async()=>root.unmount());dom.window.close();for(const [key,value] of previous){if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);}}
}
test('task controls never POST on mount; duplicate clicks send one exact approved ceiling',async()=>harness(async({state,requests,reply,changed})=>{
  assert.equal(requests.length,0);let first!:Promise<boolean>,second!:Promise<boolean>;
  await act(async()=>{first=state().mutate('extend',350);second=state().mutate('extend',350);});assert.equal(await second,false);assert.equal(requests.length,1);
  const body=JSON.parse(String(requests[0].init.body));assert.equal(body.requestId,task.requestId);assert.equal(body.maxCredits,350);assert.equal(body.expectedRevision,0);assert.equal(body.confirmed,true);assert.match(body.approvalId,/^[\da-f-]{36}$/);
  await reply(0);assert.equal(await first,true);assert.equal(changed(),1);
}));
test('task controls isolate accounts and reject another task identity',async()=>harness(async({state,requests,reply,render,changed})=>{
  let first!:Promise<boolean>;await act(async()=>{first=state().mutate('continue',250);});await render('b');assert.equal(requests[0].init.signal?.aborted,true);
  await reply(0);assert.equal(await first,false);assert.equal(changed(),0);
  let second!:Promise<boolean>;await act(async()=>{second=state().mutate('recover');});await reply(1,'f2929a29-91b4-4c81-a731-820d6d3d7103');assert.equal(await second,false);assert.equal(changed(),0);assert.ok(state().error);
}));
