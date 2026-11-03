import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {NextRequest} from 'next/server';
import {promptAssistanceRequestSchema,promptAssistanceReplySchema} from '../frontend/src/lib/prompt-assistance/contract';
import {promptSessionSnapshotSchema} from '../frontend/src/lib/prompt-assistance/session';
import {parsePromptProviderReply} from '../frontend/src/server/prompt-assistance/reply-format';
import {boundedPromptJson,handlePromptAssistance} from '../frontend/src/server/prompt-assistance/route-handler';
import {buildPromptAssistanceContext} from '../frontend/src/server/prompt-assistance/context';
import {promptResponseParams} from '../frontend/src/server/prompt-assistance/provider';
import {createAgentModelCatalogDeps} from '../frontend/src/server/agent-api/model-catalog';
import {getBaseEngines} from '../frontend/src/lib/engines';
import type {PromptRequestRow} from '../frontend/src/server/prompt-assistance/repository';
import {initialStatus} from './helpers/milo-status-fixture';

const request=()=>({sessionId:randomUUID(),requestId:randomUUID(),draftRevision:0,locale:'en' as const,message:'A complete creative brief.',draft:{surface:'video' as const,workflow:'create' as const,engineId:'wan-3-prime',mode:'t2v',target:'prompt' as const,text:'A quiet rehearsal.',settings:{durationSec:6,aspectRatio:'16:9',audio:false},references:[]}});
const version={replyFormat:'destination-v1'};
const catalog={...createAgentModelCatalogDeps(),listEngines:async()=>getBaseEngines(),isModeExecutable:()=>true,isEngineExecutable:()=>true};

test('complete conversational replies above the former limit remain intact, bounded and non-applicable',()=>{
 for(const length of [6081,6452,20001,50000]){
  const reply='R'+'é'.repeat(length-2)+'Z';
  assert.equal(reply.length,length);
  const parsed=parsePromptProviderReply(JSON.stringify({kind:'conversation',reply,text:null}),version);
  assert.deepEqual(parsed,{reply,text:null});
  assert.deepEqual(promptAssistanceReplySchema.parse(parsed),parsed);
 }
 for(const context of [{},version]){
  const body={reply:'x'.repeat(50001),text:null,...('replyFormat' in context?{kind:'conversation'}:{})};
  assert.throws(()=>parsePromptProviderReply(JSON.stringify(body),context));
 }
});

test('long human briefs and completed or failed session turns retain their full text',()=>{
 const input={...request(),message:'B'+'ñ'.repeat(49998)+'Z'};
 assert.equal(promptAssistanceRequestSchema.parse(input).message,input.message);
 assert.equal(promptAssistanceRequestSchema.safeParse({...input,message:input.message+'!'}).success,false);
 const reply='R'+'é'.repeat(49998)+'Z';
 const snapshot={sessionId:input.sessionId,scope:'video:create',status:'active',turns:[
  {requestId:input.requestId,message:input.message,reply},
  {requestId:randomUUID(),message:input.message,reply:null,state:'failed',error:'OUTPUT_INVALID'},
 ],proposal:null,pending:null};
 assert.deepEqual(promptSessionSnapshotSchema.parse(snapshot),snapshot);
 assert.equal(promptSessionSnapshotSchema.safeParse({...snapshot,turns:[{...snapshot.turns[0],reply:reply+'!'}]}).success,false);
 assert.equal(promptSessionSnapshotSchema.safeParse({...snapshot,turns:[{...snapshot.turns[1],message:input.message+'!'}]}).success,false);
});

test('streamed message route accepts complete Unicode and escaped text envelopes above 64 KiB',async()=>{
 const input={...request(),message:'B'+('\u0000漢🙂'.repeat(12499))+'END',activeSuggestion:'S'+'é'.repeat(49998)+'Z'};
 input.draft.text='D'+'漢'.repeat(19998)+'Z';
 assert.equal(input.message.length,50000);
 const body=JSON.stringify({action:'message',request:input});
 assert.ok(Buffer.byteLength(body)>65536);
 let observed:unknown;
 const response=await handlePromptAssistance(new NextRequest('http://localhost/api/prompt-assistance',{method:'POST',headers:{origin:'http://localhost'},body}),{
  enabled:true,access:async()=>({ok:true,userId:'synthetic-owner'}),send:async(userId,value)=>{
   assert.equal(userId,'synthetic-owner');observed=value;
   return {...value,target:'prompt',state:'complete',reply:{reply:'Complete advice.',text:null},assistance:initialStatus};
  },
 });
 assert.equal(response.status,200,await response.text());
 assert.deepEqual(observed,input);
});

test('aggregate body limit accepts its exact byte boundary and refuses a chunk crossing it',async()=>{
 const body='"'+'x'.repeat(1048574)+'"';
 const make=(value:string)=>new NextRequest('http://localhost/api/prompt-assistance',{method:'POST',body:value});
 assert.equal((await boundedPromptJson(make(body))).length,1048574);
 await assert.rejects(boundedPromptJson(make(body+' ')),/BODY_TOO_LARGE/);
 const parts=[body.slice(0,-1),body.slice(-1)+' '];
 const stream=new ReadableStream({pull(controller){const part=parts.shift();if(part===undefined)controller.close();else controller.enqueue(new TextEncoder().encode(part));}});
 await assert.rejects(boundedPromptJson(new NextRequest('http://localhost/api/prompt-assistance',{method:'POST',body:stream,duplex:'half'} as never)),/BODY_TOO_LARGE/);
});

test('long brief envelope does not relax selected-engine draft limits or provider token policy',async()=>{
 const input=promptAssistanceRequestSchema.parse({...request(),message:'B'+'x'.repeat(49998)+'Z'});
 input.draft.text='D'+'x'.repeat(19998)+'Z';
 const context=await buildPromptAssistanceContext('synthetic-owner',input,{catalog});
 assert.equal(context.maxChars,20000);
 const history=[{role:'user' as const,content:input.message},{role:'assistant' as const,content:JSON.stringify({reply:'R'+'y'.repeat(6449)+'Z',text:null})}];
 const params=promptResponseParams({model:'gpt-6.1-sol',input_json:input,runtime_policy:{maxOutputTokens:6000,reasoning:'xhigh'}} as PromptRequestRow,context,history);
 assert.equal(params.max_output_tokens,6000);assert.equal(params.truncation,'disabled');assert.equal(params.store,false);
 assert.deepEqual((params.input as unknown[]).slice(0,-1),history);
 const sent=JSON.parse((params.input as Array<{content:string}>).at(-1)!.content);
 assert.equal(sent.message,input.message);assert.equal(sent.currentDraft.text,input.draft.text);
 assert.match(String(params.instructions),/50000 characters/);
 await assert.rejects(buildPromptAssistanceContext('synthetic-owner',{...input,draft:{...input.draft,text:input.draft.text+'!'}},{catalog}),/DRAFT_TOO_LONG/);
});
