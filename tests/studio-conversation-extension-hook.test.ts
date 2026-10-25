import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import * as React from 'react';
import {act} from 'react';
import {createRoot} from 'react-dom/client';

test('completed extensions assemble once without a new chat or confirmation, and stale account responses stay isolated',async()=>{
  const {useConversationExtensions}=await import('../frontend/app/(core)/(workspace)/app/studio/conversation/[projectId]/_hooks/useConversationExtensions');
  const dom=new JSDOM('<div id="root"></div>');
  const old=new Map<string,PropertyDescriptor|undefined>();
  const calls:{url:string;init?:RequestInit;resolve:(response:Response)=>void}[]=[];
  const retries:(()=>void)[]=[];
  for(const [key,value] of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,IS_REACT_ACT_ENVIRONMENT:true,setTimeout:(run:()=>void)=>{retries.push(run);return retries.length;},fetch:(url:string,init?:RequestInit)=>new Promise<Response>(resolve=>calls.push({url,init,resolve}))})){
    old.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
  }
  let account='owner',refreshes=0,status='running';
  let visibleErrors:Record<string,string>={};
  function Fixture(){visibleErrors=useConversationExtensions('project',account,[{requestId:'10000000-0000-4000-8000-000000000001',extensionAssembly:{state:'pending'},generation:{status}}] as never,true,async()=>{refreshes++;}).errors;return null;}
  const root=createRoot(dom.window.document.getElementById('root')!);
  try{
    await act(async()=>root.render(React.createElement(Fixture)));
    assert.equal(calls.length,0,'Generation must complete before assembly.');
    status='completed';await act(async()=>root.render(React.createElement(Fixture)));
    assert.equal(calls.length,1);assert.match(calls[0].url,/conversation-timeline\/extension$/);
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)),{requestId:'10000000-0000-4000-8000-000000000001'});
    await act(async()=>root.render(React.createElement(Fixture)));assert.equal(calls.length,1);
    await act(async()=>calls[0].resolve(Response.json({ok:false,error:'EXTENSION_NOT_READY',retryable:true},{status:409})));
    assert.equal(refreshes,0);assert.equal(retries.length,1,'Completed jobs wait for their output projection.');
    await act(async()=>retries.shift()!());assert.equal(calls.length,2);
    await act(async()=>calls[1].resolve(Response.json({ok:true})));assert.equal(refreshes,1);
    await act(async()=>root.render(React.createElement(Fixture)));assert.equal(calls.length,2);
    account='other';await act(async()=>root.render(React.createElement(Fixture)));assert.equal(calls.length,3);
    account='third';status='running';await act(async()=>root.render(React.createElement(Fixture)));
    await act(async()=>calls[2].resolve(Response.json({ok:true})));assert.equal(refreshes,1,'An old account cannot refresh the new conversation.');
    account='fourth';status='completed';await act(async()=>root.render(React.createElement(Fixture)));
    for(let attempt=0;attempt<6;attempt++){
      await act(async()=>calls[3+attempt].resolve(Response.json({ok:false,error:'EXTENSION_NOT_READY',retryable:true},{status:409})));
      if(attempt<5){assert.equal(retries.length,1);await act(async()=>retries.shift()!());}
    }
    assert.equal(calls.length,9);assert.equal(retries.length,0,'Readiness retries are bounded.');
    assert.equal(visibleErrors['10000000-0000-4000-8000-000000000001'],'EXTENSION_NOT_READY');
  }finally{await act(async()=>root.unmount());dom.window.close();for(const [key,descriptor]of old)descriptor?Object.defineProperty(globalThis,key,descriptor):Reflect.deleteProperty(globalThis,key);}
});
