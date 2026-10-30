import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {promptAssistanceRequestSchema} from '../frontend/src/lib/prompt-assistance/contract';
import {buildPromptAssistanceContext} from '../frontend/src/server/prompt-assistance/context';
import {promptResponseParams} from '../frontend/src/server/prompt-assistance/provider';
import {createAgentModelCatalogDeps} from '../frontend/src/server/agent-api/model-catalog';
import {getBaseEngines} from '../frontend/src/lib/engines';
import type {PromptRequestRow} from '../frontend/src/server/prompt-assistance/repository';

const catalog={...createAgentModelCatalogDeps(),listEngines:async()=>getBaseEngines(),isModeExecutable:()=>true,isEngineExecutable:()=>true};

test('provider receives clarification and current-settings policy alongside real conversation context',async()=>{
  const input=promptAssistanceRequestSchema.parse({sessionId:randomUUID(),requestId:randomUUID(),draftRevision:0,locale:'fr',message:"non, l'autre",draft:{surface:'video',engineId:'seedance-2-5',mode:'t2v',target:'prompt',text:'',settings:{durationSec:5,audio:true},references:[]}});
  const context=await buildPromptAssistanceContext('owner',input,{catalog});
  const history=[{role:'user' as const,content:'une vidéo pour mon atelier'},{role:'assistant' as const,content:JSON.stringify({reply:'Quel est le sujet ?',text:null})}];
  const params=promptResponseParams({model:'gpt-6-luna',input_json:input} as PromptRequestRow,context,history);
  const instructions=String(params.instructions);
  assert.match(instructions,/(?:referent|alternative).*unresolved/i);
  assert.match(instructions,/no (?:existing|prior|working).*?(?:draft|proposal|text)/i);
  assert.match(instructions,/contradict.*(?:current|selected).*settings/i);
  assert.match(instructions,/reasonable creative details/i);
  assert.match(instructions,/supported future setting.*explicitly explaining.*enabled/i);
  assert.match(instructions,/Preserve explicit creative constraints.*unrequested exclusions/i);
  assert.deepEqual((params.input as any[]).slice(0,-1),history);
  const sent=JSON.parse((params.input as any[]).at(-1).content);
  assert.equal(sent.currentDraft.text,'');
  assert.equal(sent.currentDraft.settings.audio,true);
  assert.equal(sent.message,"non, l'autre");
});
