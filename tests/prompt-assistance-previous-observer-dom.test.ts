import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import test from 'node:test';
import {JSDOM} from 'jsdom';
import * as React from '../frontend/node_modules/react';
import {act} from '../frontend/node_modules/react';
import {createRoot} from '../frontend/node_modules/react-dom/client';
import type {PromptAssistanceResult} from '../frontend/src/lib/prompt-assistance/contract';
import type {PreviousReplyRef} from '../frontend/components/composer/prompt-previous-reply-storage';
import {initialStatus} from './helpers/milo-status-fixture';

const originalTime=Date.now;
const originalLive=process.env.NEXT_PUBLIC_PROMPT_ASSISTANCE_LIVE;
process.env.NEXT_PUBLIC_PROMPT_ASSISTANCE_LIVE='1';
test.after(()=>{if(originalLive===undefined)delete process.env.NEXT_PUBLIC_PROMPT_ASSISTANCE_LIVE;else process.env.NEXT_PUBLIC_PROMPT_ASSISTANCE_LIVE=originalLive;});
const base=Date.parse('2026-11-01T21:16:27.000Z');
const request={draftRevision:0,locale:'en' as const,message:'Original synthetic brief',draft:{surface:'video' as const,workflow:'create' as const,engineId:'wan-3-prime',mode:'t2v',target:'prompt' as const,text:'Original manual prompt',settings:{},references:[]}};
type Call={url:URL;init:RequestInit;aborted:boolean;settled:boolean;respond:(value:unknown,status?:number)=>void};

async function fixture(initial?:Partial<PreviousReplyRef>,previewMode=false,creditsMode=false){
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/app'}),previous=new Map<string,PropertyDescriptor|undefined>(),calls:Call[]=[],results:unknown[]=[],restores:unknown[]=[];
 const account=`observer-${randomUUID()}`,scopeKey=JSON.stringify([account,'video','create']);
 let now=base,timerId=0,maxInFlight=0,availabilityReads=0,availability={...initialStatus,unresolvedCalls:1};
 const timers=new Map<number,{at:number;run:()=>void}>();
 dom.window.setTimeout=((run:()=>void,delay=0)=>{timers.set(++timerId,{at:now+delay,run});return timerId;}) as typeof dom.window.setTimeout;
 dom.window.clearTimeout=(id:number)=>{timers.delete(id);};
 const fetcher=(input:string,init:RequestInit={})=>{
  const url=new URL(input,'http://localhost');
  if(url.searchParams.has('scope'))return Promise.resolve(new Response(JSON.stringify({ok:true,result:{sessionId:url.searchParams.get('sessionId'),scope:url.searchParams.get('scope'),status:'active',turns:[],pending:null,proposal:null}})));
  if(!url.searchParams.has('requestId')&&!init.method){availabilityReads++;return Promise.resolve(new Response(JSON.stringify({ok:true,result:availability})));}
  return new Promise<Response>((resolve,reject)=>{
   const call:Call={url,init,aborted:false,settled:false,respond(value,status=200){call.settled=true;resolve(new Response(JSON.stringify(value),{status}));}};
   calls.push(call);maxInFlight=Math.max(maxInFlight,calls.filter(item=>!item.settled&&!item.aborted).length);
   init.signal?.addEventListener('abort',()=>{call.aborted=true;reject(new DOMException('Aborted','AbortError'));},{once:true});
  });
 };
 for(const [key,value] of Object.entries({window:dom.window,document:dom.window.document,sessionStorage:dom.window.sessionStorage,navigator:dom.window.navigator,React,IS_REACT_ACT_ENVIRONMENT:true,fetch:fetcher})){
  previous.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
 }
 Date.now=()=>now;
 const storage=await import('../frontend/components/composer/prompt-previous-reply-storage');
 if(initial){const pointer={version:1 as const,scopeKey,serverScope:'video:create',sessionId:randomUUID(),requestId:randomUUID(),status:'admitting' as const,...initial};storage.writePreviousReply(account,pointer);}
 const {usePromptAssistanceTransport}=await import('../frontend/components/composer/usePromptAssistanceTransport');
 const previewHook=previewMode?(await import('../frontend/components/composer/usePromptAssistancePreview')).usePromptAssistancePreview:null;
 const creditsHook=creditsMode?(await import('../frontend/app/(core)/(workspace)/app/studio/conversation/[projectId]/_hooks/useStudioAssistance')).useStudioAssistance:null;
 type Transport=ReturnType<typeof usePromptAssistanceTransport>;
 let state!:Transport,preview:ReturnType<NonNullable<typeof previewHook>>|undefined,credits:ReturnType<NonNullable<typeof creditsHook>>|undefined,owner=account,workflow='create';
 function Probe(){
  if(previewHook){preview=previewHook({accountKey:owner,scopeKey:JSON.stringify([owner,'video',workflow]),contextKey:'synthetic',live:{surface:'video',workflow:'create',engineId:'wan-3-prime',mode:'t2v',settings:{},references:[]},draftText:'Original manual prompt',target:'prompt',onApplyText:()=>{throw Error('Observation must never apply a prompt');}});state=preview.transport;}
  else state=usePromptAssistanceTransport(JSON.stringify([owner,'video',workflow]),true,(...args)=>results.push(args),{accountKey:owner,scope:`video:${workflow}`,onRestore:async(...args)=>()=>{restores.push(args);}});
  if(creditsHook)credits=creditsHook(owner,state.waiting||state.previousWaiting,{endpoint:'/api/prompt-assistance',onPendingRequest:state.observePendingRequest});
  return null;
 }
 let root=createRoot(dom.window.document.getElementById('root')!);
 const render=async()=>{await act(async()=>root.render(React.createElement(Probe)));};
 await render();
 const run=async(action:()=>unknown)=>{await act(async()=>{action();});};
 return {account,scopeKey,calls,results,restores,storage,get state(){return state;},get preview(){return preview;},get credits(){return credits;},get availabilityReads(){return availabilityReads;},set availability(value:typeof availability){availability=value;},get maxInFlight(){return maxInFlight;},get now(){return now;},
  run,
  async respond(call:Call,value:unknown,status=200){await run(()=>call.respond(value,status));},
  async tick(ms:number){const end=now+ms;for(;;){const entry=[...timers].filter(([,timer])=>timer.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!entry)break;now=entry[1].at;timers.delete(entry[0]);await run(entry[1].run);}now=end;await run(()=>{});},
  async rerender(next:{owner?:string;workflow?:string}={}){owner=next.owner??owner;workflow=next.workflow??workflow;await render();},
  async remount(){await run(()=>root.unmount());root=createRoot(dom.window.document.getElementById('root')!);await render();},
  async dispose(){await run(()=>root.unmount());dom.window.close();Date.now=originalTime;for(const[key,value]of previous){if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);}},
 };
}
function status(pointer:Pick<PreviousReplyRef,'sessionId'|'requestId'>,state:PromptAssistanceResult['state']='pending',extra:object={}){return {sessionId:pointer.sessionId,requestId:pointer.requestId,draftRevision:0,target:'prompt',message:'Original synthetic brief',state,deadlineAt:new Date(base+600_000).toISOString(),...(state==='complete'?{reply:{reply:'Previous synthetic answer',text:'Previous synthetic proposal'}}:{}),...extra};}
const reads=(f:Awaited<ReturnType<typeof fixture>>)=>f.calls.filter(call=>call.url.searchParams.has('requestId'));

for(const terminal of ['complete','failed'] as const)test(`New chat observes 404 then pending then ${terminal} using GET only and preserves the new draft`,async()=>{
 const f=await fixture();
 try{
  await f.run(()=>assert.equal(f.state.send(request,1),true));const pointer=f.storage.readPreviousReply(f.account)!;
  assert.equal(reads(f).length,0,'the active request retains its existing polling owner');
  await f.run(()=>f.state.newChat('New unsent synthetic brief'));
  assert.equal(reads(f).length,1,'New chat must observe the separate old identity immediately');
  const newChat=f.state.chatId,restored=f.restores.length;
  await f.respond(reads(f)[0],{ok:false,error:'REQUEST_NOT_FOUND'},404);assert.equal(f.state.accountPending,true);
  await f.tick(2_000);assert.equal(reads(f).length,2);
  await f.respond(reads(f)[1],{ok:true,result:status(pointer)});await f.tick(2_000);
  assert.equal(reads(f).length,3);await f.respond(reads(f)[2],{ok:true,result:status(pointer,terminal,{error:terminal==='failed'?'REQUEST_UNANSWERED':undefined})});
  assert.equal(f.state.accountPending,false);assert.equal(f.state.previousOpen,false);assert.equal(f.state.previousResult?.state,terminal);
  assert.equal(f.state.chatId,newChat);assert.equal(f.results.length,0);assert.equal(f.restores.length,restored);
  const saved=JSON.parse(sessionStorage.getItem(`milo-composer:v2:${f.scopeKey}`)!);assert.equal(saved.local.message,'New unsent synthetic brief');assert.equal(saved.local.proposal,null);
  assert.equal(f.calls.filter(call=>call.init.method==='POST').length,1,'only the initial message POST is permitted');
  for(const call of reads(f)){assert.equal(call.init.method??'GET','GET');assert.equal(call.url.searchParams.get('sessionId'),pointer.sessionId);assert.equal(call.url.searchParams.get('requestId'),pointer.requestId);}
  const count=f.calls.length;await f.run(()=>void f.state.checkPreviousReply());assert.equal(f.state.previousOpen,true);assert.equal(f.calls.length,count,'reading the observed terminal result must not recover or start a worker');
  await f.run(()=>f.state.closePreviousReply());await f.run(()=>void f.state.checkPreviousReply());assert.equal(f.calls.length,count,'closing the result must keep its read-only cache');
 }finally{await f.dispose();}
});

test('a blocked Send digest and persistent 404 stop at the original 30 seconds across remounts without inventing a terminal',async()=>{
 const f=await fixture();let finish:(()=>void)|undefined;
 try{
  await f.run(()=>assert.equal(f.state.send(request,1,()=>new Promise(resolve=>{finish=()=>resolve(undefined as never);})),true));
  const pointer=f.storage.readPreviousReply(f.account)!;assert.equal(pointer.observationStartedAt,new Date(base).toISOString());assert.equal(f.calls.length,0);
  await f.run(()=>f.state.newChat('Keep the next brief'));
  for(let index=0;index<15;index++){assert.equal(reads(f).length,index+1);await f.respond(reads(f)[index],{ok:false,error:'REQUEST_NOT_FOUND'},404);await f.tick(2_000);}
  assert.equal(f.now,base+30_000);assert.equal(reads(f).length,15);assert.equal(f.state.accountPending,true);assert.equal(f.storage.readPreviousReply(f.account)?.status,'admitting');
  await f.tick(60_000);await f.run(()=>finish!());assert.equal(f.calls.filter(call=>call.init.method==='POST').length,0,'retired pre-admission work must never POST');
  await f.remount();assert.equal(reads(f).length,16,'an expired anchor permits one truthful read, not renewed polling');await f.respond(reads(f)[15],{ok:false,error:'REQUEST_NOT_FOUND'},404);await f.tick(60_000);
  assert.equal(reads(f).length,16);assert.equal(f.storage.readPreviousReply(f.account)?.observationStartedAt,pointer.observationStartedAt);assert.equal(f.state.accountPending,true);assert.equal(f.state.previousResult,null);assert.equal(f.results.length,0);
 }finally{finish?.();await f.dispose();}
});

for(const scenario of ['unknown','auth','mismatch','invalid'] as const)test(`${scenario} stops observation without releasing Send or applying old output`,async()=>{
 const f=await fixture({status:'pending',deadlineAt:new Date(base+600_000).toISOString()});
 try{
  const pointer=f.storage.readPreviousReply(f.account)!;assert.equal(reads(f).length,1);
  const value=scenario==='auth'?{ok:false,error:'AUTH_REQUIRED'}:{ok:true,result:scenario==='unknown'?status(pointer,'unknown',{deadlineAt:undefined}):scenario==='mismatch'?status({...pointer,requestId:randomUUID()},'complete'):status(pointer,'complete',{reply:{reply:'',text:null}})};
  await f.respond(reads(f)[0],value,scenario==='auth'?401:200);await f.tick(60_000);await f.rerender();
  assert.equal(reads(f).length,1);assert.equal(f.state.accountPending,true);assert.equal(f.storage.readPreviousReply(f.account)?.status==='terminal',false);assert.equal(f.results.length,0);assert.equal(f.state.previousOpen,false);
  await f.run(()=>assert.equal(f.state.send(request,2),false));assert.equal(f.calls.some(call=>call.init.method==='POST'),false);
 }finally{await f.dispose();}
});

test('a slow GET has no overlap, times out at 15 seconds and retains manual recovery',async()=>{
 const f=await fixture({status:'pending',deadlineAt:new Date(base+600_000).toISOString()});
 try{
  assert.equal(reads(f).length,1);await f.tick(14_999);assert.equal(reads(f).length,1);assert.equal(reads(f)[0].aborted,false);
  await f.tick(1);assert.equal(reads(f)[0].aborted,true);assert.equal(f.maxInFlight,1);assert.equal(f.state.accountPending,true);
  await f.tick(60_000);assert.equal(reads(f).length,1);
  const pointer=f.storage.readPreviousReply(f.account)!;await f.run(()=>void f.state.checkPreviousReply());
  const manual=f.calls.at(-1)!;assert.equal(manual.init.method,'POST');assert.equal(JSON.parse(String(manual.init.body)).action,'recover');
  await f.respond(manual,{ok:true,result:status(pointer,'complete')});assert.equal(f.state.accountPending,false);assert.equal(f.state.previousOpen,true);assert.equal(f.results.length,0);
 }finally{await f.dispose();}
});

test('pending reads and remounts cannot move the first server deadline or restart an expired budget',async()=>{
 const firstDeadline=new Date(base+1_000).toISOString(),f=await fixture({status:'pending',deadlineAt:firstDeadline});
 try{
  const pointer=f.storage.readPreviousReply(f.account)!;
  await f.respond(reads(f)[0],{ok:true,result:status(pointer)});assert.equal(f.storage.readPreviousReply(f.account)?.deadlineAt,firstDeadline);
  await f.tick(1_000);await f.remount();assert.equal(reads(f).length,2);await f.respond(reads(f)[1],{ok:true,result:status(pointer)});
  for(let index=0;index<14;index++){await f.tick(2_000);await f.respond(reads(f).at(-1)!,{ok:true,result:status(pointer)});}
  await f.tick(2_000);assert.equal(f.now,base+31_000);const count=reads(f).length;await f.tick(60_000);await f.rerender();
  assert.equal(reads(f).length,count);assert.equal(f.storage.readPreviousReply(f.account)?.deadlineAt,firstDeadline);assert.equal(f.state.accountPending,true);assert.equal(f.state.previousError,'WAIT_DEADLINE');
 }finally{await f.dispose();}
});

for(const state of ['complete','pending','missing'] as const)test(`expired admission anchor permits exactly one ${state} read without a renewed polling window`,async()=>{
 const f=await fixture({observationStartedAt:new Date(base-31_000).toISOString()});
 try{
  const pointer=f.storage.readPreviousReply(f.account)!;
  await f.respond(reads(f)[0],state==='missing'?{ok:false,error:'REQUEST_NOT_FOUND'}:{ok:true,result:status(pointer,state==='complete'?'complete':'pending')},state==='missing'?404:200);
  await f.tick(900_000);assert.equal(reads(f).length,1);assert.equal(f.state.accountPending,state!=='complete');assert.equal(f.state.previousOpen,false);assert.equal(f.calls.some(call=>call.init.method==='POST'),false);
 }finally{await f.dispose();}
});

test('a manual check replaces the background GET and terminal cache never invokes recovery again',async()=>{
 const f=await fixture({status:'pending',deadlineAt:new Date(base+600_000).toISOString()});
 try{
  const pointer=f.storage.readPreviousReply(f.account)!;await f.run(()=>void f.state.checkPreviousReply());assert.equal(reads(f)[0].aborted,true);assert.equal(f.maxInFlight,1);
  const manual=f.calls.at(-1)!;await f.respond(manual,{ok:true,result:status(pointer,'complete')});
  await f.run(()=>f.state.closePreviousReply());const count=f.calls.length;await f.run(()=>void f.state.checkPreviousReply());assert.equal(f.calls.length,count);assert.equal(f.state.previousResult?.reply?.reply,'Previous synthetic answer');
 }finally{await f.dispose();}
});

test('a replacement pointer cancels A and only B can release the account while preserving current local proof',async()=>{
 const f=await fixture({status:'pending',deadlineAt:new Date(base+600_000).toISOString()});
 try{
  const a=f.storage.readPreviousReply(f.account)!,b={...a,sessionId:randomUUID(),requestId:randomUUID()};
  await f.run(()=>f.state.saveLocal({message:'Current unsent brief',proposal:{text:'Current local suggestion',draftFingerprint:'a'.repeat(64),valid:true,review:{version:1,requestId:randomUUID(),compatibilityFingerprint:'b'.repeat(64),settings:{},compatible:true}}},f.state.localEpoch()));
  const before=sessionStorage.getItem(`milo-composer:v2:${f.scopeKey}`),old=reads(f)[0],restored=f.restores.length;
  await f.run(()=>{assert.equal(f.storage.writePreviousReply(f.account,b,a),true);f.state.observePendingRequest({...b,scope:'video:create'});});
  assert.equal(old.aborted,true);assert.equal(reads(f).length,2);await f.respond(old,{ok:true,result:status(a,'complete')});assert.equal(f.state.accountPending,true);assert.equal(f.state.previousResult,null);
  await f.respond(reads(f)[1],{ok:true,result:status(b,'complete')});assert.equal(f.state.accountPending,false);assert.equal(f.state.previousRef?.requestId,b.requestId);assert.equal(f.results.length,0);assert.equal(f.restores.length,restored);
  assert.equal(sessionStorage.getItem(`milo-composer:v2:${f.scopeKey}`),before,'old observation must never write the active draft, suggestion or review proof');
 }finally{await f.dispose();}
});

for(const change of ['workflow','account','unmount'] as const)test(`${change} cancels an old observer and late output cannot hydrate the destination`,async()=>{
 const f=await fixture({status:'pending',deadlineAt:new Date(base+600_000).toISOString()});
 try{
  const pointer=f.storage.readPreviousReply(f.account)!,old=reads(f)[0];
  if(change==='workflow')await f.rerender({workflow:'modify'});else if(change==='account')await f.rerender({owner:'another-'+randomUUID()});else await f.remount();
  assert.equal(old.aborted,true);await f.respond(old,{ok:true,result:status(pointer,'complete')});assert.equal(f.results.length,0);assert.equal(f.state.previousResult,null);assert.equal(f.state.previousOpen,false);
  if(change==='account'){assert.equal(f.state.accountPending,false);assert.equal(reads(f).length,1);}else assert.equal(reads(f).length,2);
 }finally{await f.dispose();}
});

test('independent tab observers can read the same durable identity and cancellation stays local',async()=>{
 const f=await fixture();
 try{
  const {observePreviousPromptReply}=await import('../frontend/components/composer/prompt-previous-reply-observer');
  const pointer:PreviousReplyRef={version:1,scopeKey:f.scopeKey,serverScope:'video:create',sessionId:randomUUID(),requestId:randomUUID(),status:'pending',deadlineAt:new Date(base+600_000).toISOString(),observationStartedAt:new Date(base).toISOString()},a=new AbortController(),b=new AbortController(),left:unknown[]=[],right:unknown[]=[];
  const one=observePreviousPromptReply(pointer,a.signal,value=>left.push(value),()=>true).catch(error=>error),two=observePreviousPromptReply(pointer,b.signal,value=>right.push(value),()=>true);
  assert.equal(reads(f).length,2);await f.run(()=>a.abort());assert.equal(reads(f)[0].aborted,true);assert.equal(reads(f)[1].aborted,false);
  await f.respond(reads(f)[1],{ok:true,result:status(pointer,'complete')});await Promise.all([one,two]);assert.equal(left.length,0);assert.equal(right.length,1);assert.equal(f.calls.some(call=>call.init.method==='POST'),false);
 }finally{await f.dispose();}
});

test('the real preview keeps its message, manual draft, proposal and Generate permission when a previous reply completes',async()=>{
 const f=await fixture({status:'pending',deadlineAt:new Date(base+600_000).toISOString()},true);
 try{
  const pointer=f.storage.readPreviousReply(f.account)!;
  await f.run(()=>{assert.equal(f.preview!.newChat(),true);f.preview!.dispatch({type:'mode',mode:'milo'});f.preview!.dispatch({type:'message',text:'Current unsent creative brief'});});
  assert.equal(f.preview!.state.mode,'milo');assert.equal(f.preview!.appliedPromptCurrent,false);const before=f.preview!.state;
  await f.respond(reads(f).at(-1)!,{ok:true,result:status(pointer,'complete')});
  assert.equal(f.state.accountPending,false);assert.equal(f.preview!.state.message,'Current unsent creative brief');assert.equal(f.preview!.state.proposal,before.proposal);assert.deepEqual(f.preview!.state.messages,before.messages);assert.equal(f.preview!.state.fingerprint,before.fingerprint);
  assert.equal(f.preview!.appliedPromptCurrent,false,'the assistant Generate gate must still require an explicit Use prompt');assert.equal(f.preview!.state.mode,'milo');assert.equal(f.state.previousOpen,false);
 }finally{await f.dispose();}
});

test('a blocker discovered by rejected admission is observed without a second POST or another active-chat result',async()=>{
 const f=await fixture();
 try{
  await f.run(()=>assert.equal(f.state.send(request,1),true));
  const pointer={sessionId:randomUUID(),requestId:randomUUID(),scope:'image:create',deadlineAt:new Date(base+600_000).toISOString()};
  await f.respond(f.calls[0],{ok:false,error:'REQUEST_PENDING',pendingRequest:pointer},409);
  assert.equal(f.results.length,1);assert.equal(reads(f).length,1);assert.equal(f.state.previousRef?.serverScope,'image:create');
  await f.respond(reads(f)[0],{ok:true,result:status(pointer,'complete')});assert.equal(f.results.length,1);assert.equal(f.state.accountPending,false);assert.equal(f.state.previousOpen,false);
  assert.equal(f.calls.filter(call=>call.init.method==='POST').length,1);
 }finally{await f.dispose();}
});

test('a restored terminal pointer opens with GET only and retains its terminal cache on close',async()=>{
 const f=await fixture({status:'terminal'});
 try{
  assert.equal(reads(f).length,0);const pointer=f.storage.readPreviousReply(f.account)!;await f.run(()=>void f.state.checkPreviousReply());
  assert.equal(reads(f).length,1);assert.equal(f.calls.some(call=>call.init.method==='POST'),false);await f.respond(reads(f)[0],{ok:true,result:status(pointer,'complete')});
  await f.run(()=>f.state.closePreviousReply());await f.run(()=>void f.state.checkPreviousReply());assert.equal(reads(f).length,1);assert.equal(f.state.previousResult?.state,'complete');
 }finally{await f.dispose();}
});

test('terminal observation refreshes the real credits eligibility reader so stale unresolved usage cannot keep Send disabled',async()=>{
 const f=await fixture({status:'pending',deadlineAt:new Date(base+600_000).toISOString()},false,true);
 try{
  const pointer=f.storage.readPreviousReply(f.account)!;assert.equal(f.credits?.status?.unresolvedCalls,1);f.availability={...initialStatus,unresolvedCalls:0};
  await f.respond(reads(f)[0],{ok:true,result:status(pointer,'complete')});
  assert.equal(f.state.accountPending,false);assert.equal(f.credits?.status?.unresolvedCalls,0);assert.equal(f.availabilityReads,2,'completion must refresh eligibility through its existing GET owner');
  assert.equal(f.state.previousOpen,false);assert.equal(f.calls.some(call=>call.init.method==='POST'),false);
 }finally{await f.dispose();}
});

test('a durable pointer replacement stops polling A even before the replacement is discovered by the current view',async()=>{
 const f=await fixture({status:'pending',deadlineAt:new Date(base+600_000).toISOString()});
 try{
  const a=f.storage.readPreviousReply(f.account)!,b={...a,sessionId:randomUUID(),requestId:randomUUID()};
  assert.equal(f.storage.writePreviousReply(f.account,b,a),true);await f.respond(reads(f)[0],{ok:true,result:status(a)});await f.tick(2_000);
  assert.equal(reads(f).length,1,'an invalidated observer must not schedule another stale GET');assert.equal(f.state.previousResult,null);assert.equal(f.state.accountPending,true);
 }finally{await f.dispose();}
});

for(const replacement of ['before404','during404pause'] as const)test(`a durable replacement ${replacement} stops stale 404 retries without changing B or the current draft`,async()=>{
 const f=await fixture({status:'pending',deadlineAt:new Date(base+600_000).toISOString()});
 try{
  const a=f.storage.readPreviousReply(f.account)!,b={...a,sessionId:randomUUID(),requestId:randomUUID()};
  await f.run(()=>f.state.saveLocal({message:'Current unsent brief',proposal:{text:'Current local suggestion',draftFingerprint:'a'.repeat(64),valid:true}},f.state.localEpoch()));
  const draft=sessionStorage.getItem(`milo-composer:v2:${f.scopeKey}`);
  if(replacement==='before404')assert.equal(f.storage.writePreviousReply(f.account,b,a),true);
  await f.respond(reads(f)[0],{ok:false,error:'REQUEST_NOT_FOUND'},404);
  if(replacement==='during404pause')assert.equal(f.storage.writePreviousReply(f.account,b,a),true);
  const pointer=JSON.stringify(f.storage.readPreviousReply(f.account));await f.tick(2_000);
  assert.equal(reads(f).length,1,'the retired identity must not issue another GET after a 404');
  assert.equal(JSON.stringify(f.storage.readPreviousReply(f.account)),pointer);assert.equal(f.storage.readPreviousReply(f.account)?.requestId,b.requestId);
  assert.equal(f.state.previousResult,null);assert.equal(f.state.accountPending,true);await f.run(()=>assert.equal(f.state.send(request,99),false));
  assert.equal(sessionStorage.getItem(`milo-composer:v2:${f.scopeKey}`),draft);assert.equal(f.results.length,0);assert.equal(f.calls.some(call=>call.init.method==='POST'),false);
 }finally{await f.dispose();}
});
