import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {oldPromptReplySchema} from './helpers/prompt-assistance-legacy-contract';
import {NextRequest} from 'next/server';
import {handlePromptAssistance} from '../frontend/src/server/prompt-assistance/route-handler';
import {initialStatus} from './helpers/milo-status-fixture';

test('message and recovery responses negotiate only the additive action, leaving old strict reply decoders usable',async()=>{
  const sessionId=randomUUID(),requestId=randomUUID(),seen:unknown[]=[];
  const request={sessionId,requestId,draftRevision:2,locale:'en',message:'Describe this reference.',draft:{surface:'video',workflow:'references',engineId:'seedance-2-5',mode:'ref2v',target:'prompt',text:'Manual draft',settings:{},references:[]}};
  const analysisRequest={fieldId:'video_urls',slot:0,modality:'visual',startSec:0,endSec:10,ref:{type:'asset',assetId:'ma_'+'a'.repeat(32),kind:'video'}};
  const complete={sessionId,requestId,draftRevision:2,target:'prompt',message:request.message,state:'complete',reply:{reply:'Review this excerpt.',text:null,analysisRequest},assistance:initialStatus};
  const saved=JSON.stringify(complete);
  const deps={enabled:true,access:async()=>({ok:true as const,userId:'owner'}),send:async(owner:string,input:unknown)=>{seen.push([owner,input]);return complete;},recover:async(owner:string,s:string,r:string)=>{seen.push([owner,s,r]);return complete;},schedule:()=>{throw Error('Completed replies cannot be rescheduled');}};
  for(const action of ['message','recover'])for(const capability of [undefined,'0','true','2','1']){
    const body=action==='message'?{action,request}:{action,sessionId,requestId};
    const req=new NextRequest('https://example.test/api/prompt-assistance',{method:'POST',headers:{origin:'https://example.test',...(capability?{'x-milo-inline-analysis':capability}:{})},body:JSON.stringify(body)});
    const response=await handlePromptAssistance(req,deps as never),data=await response.json();
    assert.equal(response.status,200);assert.equal(data.ok,true);
    if(capability==='1')assert.deepEqual(data.result.reply,complete.reply);
    else assert.deepEqual(oldPromptReplySchema.parse(data.result.reply),{reply:complete.reply.reply,text:null});
    assert.deepEqual({...data.result,reply:complete.reply},complete,'capability never changes result identity or assistance state');
    assert.match(response.headers.get('cache-control')??'',/no-store/);
    assert.match(response.headers.get('vary')??'',/Cookie/);assert.match(response.headers.get('vary')??'',/x-milo-inline-analysis/i);
    assert.equal(JSON.stringify(complete),saved,'serialization never mutates durable reply data');
  }
  assert.deepEqual(seen[0],['owner',request]);assert.deepEqual(seen.at(-1),['owner',sessionId,requestId]);
});
