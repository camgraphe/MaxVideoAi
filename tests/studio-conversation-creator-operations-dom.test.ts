import assert from 'node:assert/strict';
import test from 'node:test';
import {JSDOM} from 'jsdom';
import * as React from 'react';
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import type {ImageConversationTurn} from '../frontend/src/lib/studio/image-conversation-contract';

const operationId='00000000-0000-4000-8000-000000000001';
const quote={operationId,toolId:'subtitles',kind:'transcribe',price:{amountCents:37,currency:'USD'},
  expiresAt:'2099-01-01T00:00:00.000Z',confirmationRequired:true};
const prepared={operationId,toolId:'subtitles',state:'prepared',confirmationEnabled:true,jobId:null,retry:{afterSeconds:null},result:null};
const turn={requestId:'00000000-0000-4000-8000-000000000002',message:'Add captions',references:[],state:'ready',
  creatorQuote:quote,creatorOperation:prepared} as unknown as ImageConversationTurn;

async function mount(initial:ImageConversationTurn=turn) {
  let module:typeof import('../frontend/app/(core)/(workspace)/app/studio/conversation/[projectId]/_hooks/useConversationCreatorOperations');
  try {module=await import('../frontend/app/(core)/(workspace)/app/studio/conversation/[projectId]/_hooks/useConversationCreatorOperations');}
  catch {assert.fail('The Milo creator quote confirmation/recovery hook is required.');}
  const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/app/studio/conversation/project-A'});
  const previous=new Map<string,PropertyDescriptor|undefined>();
  const requests:Array<{url:string;init?:RequestInit;resolve:(value:Response)=>void;reject:(error:Error)=>void}>=[];
  const timers=new Map<number,{callback:()=>unknown;delay:number}>();
  let nextTimer=0,reads=0,readDone:Promise<void>=Promise.resolve();
  dom.window.setTimeout=((callback:()=>unknown,delay:number)=>{timers.set(++nextTimer,{callback,delay});return nextTimer;}) as typeof dom.window.setTimeout;
  dom.window.clearTimeout=id=>{timers.delete(id);};
  for (const [key,value] of Object.entries({React,window:dom.window,document:dom.window.document,navigator:dom.window.navigator,
    IS_REACT_ACT_ENVIRONMENT:true,fetch:(url:string,init?:RequestInit)=>new Promise<Response>((resolve,reject)=>requests.push({url,init,resolve,reject}))})) {
    previous.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});
  }
  let current=initial,accountKey='account-A';
  let state!:ReturnType<typeof module.useConversationCreatorOperations>;
  const onChange=async()=>{reads++;await readDone;};
  function Fixture(){state=module.useConversationCreatorOperations({projectId:'project-A',accountKey,turn:current,onChange});return null;}
  let root=createRoot(dom.window.document.getElementById('root')!);
  const render=()=>act(async()=>root.render(React.createElement(Fixture)));
  await render();
  return {dom,requests,timers,get state(){return state;},get reads(){return reads;},
    async changeTurn(value:ImageConversationTurn){current=value;await render();},
    async changeAccount(value:string){accountKey=value;await render();},
    async confirm(){await act(async()=>{void state.confirm();});},
    async acknowledge(value:unknown,index=0){await act(async()=>requests[index].resolve(Response.json({ok:true,result:value})));},
    async loseAcknowledgement(index=0){await act(async()=>requests[index].reject(new Error('local lost acknowledgement')));},
    async recover(){await act(async()=>state.refresh());},
    holdRead(){let resolve!:()=>void;readDone=new Promise<void>(done=>{resolve=done;});return async()=>{await act(async()=>resolve());};},
    async tick(){const pending=[...timers].filter(([,timer])=>timer.delay===5000);await act(async()=>{for(const[id,timer]of pending){timers.delete(id);void timer.callback();}});},
    async reopen(){await act(async()=>root.unmount());root=createRoot(dom.window.document.getElementById('root')!);await render();},
    async close(){await act(async()=>root.unmount());dom.window.close();for(const[key,value]of previous)value?Object.defineProperty(globalThis,key,value):Reflect.deleteProperty(globalThis,key);},
  };
}

test('Milo creator approval sends the exact quote once and a lost reply recovers read-only across reopen',async()=>{
  const f=await mount();
  try {
    assert.equal(f.requests.length,0,'Mounting a saved quote does not confirm it.');
    await f.confirm();
    assert.equal(f.requests.length,1);
    assert.equal(f.requests[0].url,'/api/studio/projects/project-A/image-conversation/confirm');
    assert.deepEqual(JSON.parse(String(f.requests[0].init?.body)),{requestId:turn.requestId,confirmed:true,
      creator:{toolId:'subtitles',operationId,amountCents:37,currency:'USD'}});
    await f.loseAcknowledgement();
    assert.equal(f.state.uncertain,true);
    await f.confirm();assert.equal(f.requests.length,1);
    const reads=f.reads;await f.recover();assert.equal(f.reads,reads+1);assert.equal(f.requests.length,1);
    await f.reopen();assert.equal(f.state.uncertain,true);assert.equal(f.requests.length,1);
    const completed={...prepared,state:'completed',confirmationEnabled:false,jobId:'saved-job',result:{outputs:[],document:{
      id:'document',revision:2,openUrl:'/app/tools/subtitles?document=document&revision=2',srtUrl:'/api/srt',vttUrl:'/api/vtt'}}};
    await f.changeTurn({...turn,creatorOperation:completed} as unknown as ImageConversationTurn);
    assert.equal(f.state.uncertain,false);assert.equal(f.state.operation?.state,'completed');
    await f.confirm();assert.equal(f.requests.length,1);
  } finally {await f.close();}
});

test('Milo polls only a running creator operation at its returned cadence and stops attention or terminal states',async()=>{
  const running={...prepared,state:'running',confirmationEnabled:false,jobId:'saved-job',retry:{afterSeconds:5}};
  const f=await mount({...turn,creatorOperation:running} as unknown as ImageConversationTurn);
  try {
    const release=f.holdRead();
    await f.tick();assert.equal(f.reads,1);
    await f.tick();assert.equal(f.reads,1,'One operation cannot overlap status reads.');
    await release();
    await f.tick();assert.equal(f.reads,2);
    await f.changeTurn({...turn,creatorOperation:{...running,needsAttention:true}} as unknown as ImageConversationTurn);
    await f.tick();assert.equal(f.reads,2);
    await f.changeTurn({...turn,creatorOperation:{...running,retry:{afterSeconds:null}}} as unknown as ImageConversationTurn);
    await f.tick();assert.equal(f.reads,2);
    await f.changeTurn({...turn,creatorOperation:{...running,state:'completed'}} as unknown as ImageConversationTurn);
    await f.tick();assert.equal(f.reads,2);assert.equal(f.requests.length,0);
  } finally {await f.close();}
});

test('a mismatched creator acknowledgement stays uncertain and never becomes a delivered result',async()=>{
  const f=await mount();
  try {
    await f.confirm();
    await f.acknowledge({...prepared,operationId:'00000000-0000-4000-8000-000000000099',state:'completed',confirmationEnabled:false});
    assert.equal(f.state.uncertain,true);assert.notEqual(f.state.operation?.state,'completed');
    await f.confirm();assert.equal(f.requests.length,1);
    await f.changeAccount('account-B');assert.equal(f.state.uncertain,false);
  } finally {await f.close();}
});
