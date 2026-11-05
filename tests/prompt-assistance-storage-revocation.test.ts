import assert from 'node:assert/strict';
import test from 'node:test';
import {readPromptChat,writePromptChat,revokePromptChatReview,type PromptChatRecord} from '../frontend/components/composer/prompt-chat-storage';

const key='milo-composer:v2:["owner","video","create"]';
const sessionId='00000000-0000-4000-8000-000000000001',requestId='00000000-0000-4000-8000-000000000002';
const record=(pending=false):PromptChatRecord=>({sessionId,pending:pending?{sessionId,requestId}:null,legacy:false,local:{message:'Saved message',latestRequestId:requestId,proposal:{text:'Synthetic proposal',draftFingerprint:'0'.repeat(64),valid:true,review:{version:1,requestId,compatibilityFingerprint:'1'.repeat(64),compatible:true,settings:{aspectRatio:'auto'}}}}});
function storage(initial:PromptChatRecord,reject:(value:string)=>boolean,removeFails=false){
 const values=new Map([[key,JSON.stringify(initial)]]);let removals=0;
 return {values,get removals(){return removals;},getItem:(name:string)=>values.get(name)??null,setItem:(name:string,value:string)=>{if(reject(value))throw new Error('QuotaExceededError');values.set(name,value);},removeItem:(name:string)=>{removals++;if(removeFails)throw new Error('SecurityError');values.delete(name);}};
}
async function withStorage<T>(value:ReturnType<typeof storage>,run:()=>T|Promise<T>){const prior=Object.getOwnPropertyDescriptor(globalThis,'sessionStorage');Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value});try{return await run();}finally{if(prior)Object.defineProperty(globalThis,'sessionStorage',prior);else delete (globalThis as any).sessionStorage;}}

test('cache writes report their actual acknowledgement',async()=>{
 const value=record();await withStorage(storage(value,()=>true),()=>assert.equal(writePromptChat(key,value),false));
 await withStorage(storage(value,()=>false),()=>assert.equal(writePromptChat(key,value),true));
});

test('invalid overlimit local prose cannot discard valid chat and pending recovery identities',async()=>{
 const value=record(true);value.local!.message='B'+'x'.repeat(50000);
 await withStorage(storage(value,()=>false),()=>{
  const restored=readPromptChat(key);assert.ok(restored);
  assert.equal(restored.sessionId,sessionId);assert.deepEqual(restored.pending,{sessionId,requestId});
  assert.equal(restored.local,undefined,'unrestorable prose is omitted, never silently shortened');
 });
 await withStorage(storage({...value,sessionId:'invalid'},()=>false),()=>assert.equal(readPromptChat(key),null,'invalid chat identity remains rejected'));
});

test('a refused false proof falls back to proof-free cache while preserving pending identities',async()=>{
 const value=record(true),mock=storage(value,text=>text.includes('"compatible":false'));
 await withStorage(mock,()=>{const result=revokePromptChatReview(key,value,true);assert.equal(result.kind,'saved');const saved=JSON.parse(mock.values.get(key)!);assert.equal(saved.local.proposal.review,undefined);assert.deepEqual(saved.pending,value.pending);assert.equal(saved.sessionId,sessionId);assert.equal(mock.removals,0);});
});

test('cache quota can drop local prose but retains the minimal session and request recovery record',async()=>{
 const value=record(true),mock=storage(value,text=>text.includes('"local"'));
 await withStorage(mock,()=>{const result=revokePromptChatReview(key,value,true);assert.equal(result.kind,'saved');assert.deepEqual(JSON.parse(mock.values.get(key)!),{sessionId,pending:value.pending,legacy:false});assert.equal(mock.removals,0);});
});

test('an unneeded cache can be discarded safely when all writes refuse',async()=>{
 const value=record(),mock=storage(value,()=>true);
 await withStorage(mock,()=>{assert.equal(revokePromptChatReview(key,value,false).kind,'discarded');assert.equal(mock.values.has(key),false);});
});

test('pending recovery identity is never removed when every replacement write refuses',async()=>{
 const value=record(true),mock=storage(value,()=>true);
 await withStorage(mock,()=>{assert.equal(revokePromptChatReview(key,value,true).kind,'blocked');assert.deepEqual(JSON.parse(mock.values.get(key)!).pending,value.pending);assert.equal(mock.removals,0);});
});

test('a cache that refuses both writes and removal reports blocked rather than successful revocation',async()=>{
 const value=record(),mock=storage(value,()=>true,true);
 await withStorage(mock,()=>{assert.equal(revokePromptChatReview(key,value,false).kind,'blocked');assert.equal(JSON.parse(mock.values.get(key)!).local.proposal.review.compatible,true);});
});

test('analysis recovery protects its shared session even without a pending message',async()=>{
 const value=record(),mock=storage(value,()=>true);
 await withStorage(mock,()=>{assert.equal(revokePromptChatReview(key,value,true).kind,'blocked');assert.equal(JSON.parse(mock.values.get(key)!).sessionId,sessionId);assert.equal(mock.removals,0);});
});

test('a pending message intrinsically prevents discard even if the caller flag is false',async()=>{
 const value=record(true),mock=storage(value,()=>true);
 await withStorage(mock,()=>{assert.equal(revokePromptChatReview(key,value,false).kind,'blocked');assert.deepEqual(JSON.parse(mock.values.get(key)!).pending,value.pending);assert.equal(mock.removals,0);});
});

test('a storage adapter that silently drops a write is not treated as an acknowledgement',async()=>{
 const value=record(),mock=storage(value,()=>false);mock.setItem=()=>{};
 await withStorage(mock,()=>assert.equal(writePromptChat(key,{...value,local:undefined}),false));
});

test('pending reference labels are bounded optional metadata and never invalidate recovery identity',async()=>{
 const labels=[{fieldId:'image_urls',slot:0,label:'Image 1'}];
 const value={...record(true),pending:{sessionId,requestId,references:labels}};
 await withStorage(storage(value,()=>false),()=>assert.deepEqual(readPromptChat(key)?.pending,value.pending));
 for(const references of [Array.from({length:61},()=>labels[0]),[{...labels[0],label:'x'.repeat(41)}],[{...labels[0],slot:100}],[{...labels[0],ref:{assetId:'private'}}]]){
  await withStorage(storage({...value,pending:{sessionId,requestId,references}} as any,()=>false),()=>{const pending=readPromptChat(key)?.pending;assert.equal(pending?.sessionId,sessionId);assert.equal(pending?.requestId,requestId);assert.equal(pending?.references,undefined);});
 }
});

test('quota fallback can discard reference labels while preserving minimal pending identity',async()=>{
 const value={...record(true),pending:{sessionId,requestId,references:[{fieldId:'image_urls',slot:0,label:'Image 1'}]}};
 const mock=storage(value,text=>text.includes('"references"')||text.includes('"local"'));
 await withStorage(mock,()=>{
  assert.equal(revokePromptChatReview(key,value,true).kind,'saved');assert.deepEqual(readPromptChat(key)?.pending,{sessionId,requestId});assert.equal(mock.removals,0);
 });
});
