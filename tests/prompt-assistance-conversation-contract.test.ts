import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {promptAssistanceRequestSchema} from '../frontend/src/lib/prompt-assistance/contract';
import {buildPromptAssistanceContext} from '../frontend/src/server/prompt-assistance/context';
import {promptResponseParams} from '../frontend/src/server/prompt-assistance/provider';
import {createAgentModelCatalogDeps} from '../frontend/src/server/agent-api/model-catalog';
import {getBaseEngines} from '../frontend/src/lib/engines';
import type {PromptRequestRow} from '../frontend/src/server/prompt-assistance/repository';
import {promptAssistanceIntentCases} from './fixtures/prompt-assistance-intent-cases';

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

test('every assistance level receives new-brief intent precedence instead of automatic editor reuse',async()=>{
  const input=promptAssistanceRequestSchema.parse({sessionId:randomUUID(),requestId:randomUUID(),draftRevision:0,locale:'en',message:'Create a stop-motion advert for a red teapot.',draft:{surface:'video',workflow:'create',engineId:'wan-3',mode:'t2v',target:'prompt',text:'A diver explores a sunken ship.',settings:{durationSec:7,audio:true,aspectRatio:'auto'},references:[]}});
  const context=await buildPromptAssistanceContext('owner',input,{catalog});
  for(const model of ['gpt-6-luna','gpt-6.1-terra','gpt-6.1-sol'] as const){
    const instructions=String(promptResponseParams({model,input_json:input} as PromptRequestRow,context,[]).instructions);
    assert.match(instructions,/latest user message.*(?:intent|new creative brief|revision)/i);
    assert.match(instructions,/presence of.*(?:editor|currentDraft).*does not.*(?:subject|scene)/i);
    assert.match(instructions,/independent new creative brief.*(?:editor|proposal).*earlier turns/i);
    assert.match(instructions,/even when activeSuggestion is present/i);
    assert.match(instructions,/broad.*(?:style|format).*does not.*(?:subject|reuse)/i);
    assert.match(instructions,/one focused question/i);
    assert.match(instructions,/activeSuggestion.*working text/i);
    assert.match(instructions,/currentDraft.text.*manual editor.*(?:refers|revision)/i);
    assert.match(instructions,/natural.*continuation.*without.*explicit revision/i);
    assert.doesNotMatch(instructions,/If activeSuggestion is absent, use currentDraft.text and the conversation/);
  }
});

test('an ambiguous starting request with an existing editor requires one reuse-or-new question before a proposal',async()=>{
  const fixture=promptAssistanceIntentCases.find(entry=>entry.id==='underspecified-style-brief')!;
  const input=promptAssistanceRequestSchema.parse({sessionId:randomUUID(),requestId:randomUUID(),draftRevision:0,locale:'en',message:fixture.message,draft:{surface:'video',workflow:'create',engineId:'wan-3',mode:'t2v',target:'prompt',text:fixture.editor,settings:{durationSec:7,audio:true,aspectRatio:'auto'},references:[]}});
  const context=await buildPromptAssistanceContext('owner',input,{catalog});
  const instructions=String(promptResponseParams({model:'gpt-6-luna',input_json:input} as PromptRequestRow,context,[]).instructions);
  assert.match(instructions,/nonempty currentDraft.text.*(?:unclear|ambiguous).*reuse.*new/i);
  assert.match(instructions,/one concise question in the user's language/i);
  assert.match(instructions,/Return text: null until.*(?:choice|intent).*clarified/i);
  assert.match(instructions,/Explicit.*editor.*independent new brief.*proceed without.*question/i);
  assert.match(instructions,/user's answer.*conversation.*(?:decision|choice|intent)/i);
  assert.match(instructions,/do not repeat.*question.*(?:clear|clarified)/i);
  assert.doesNotMatch(instructions,/ask one focused question.*or offer a fresh idea without silently borrowing the old scene/i);
});

// This exercises the real request builder, not provider outputs. The semantic
// expectations in the synthetic cases require separately authorized evaluation.
test('independent briefs and revisions retain distinct message, editor, proposal and conversation context',async t=>{
  for(const fixture of promptAssistanceIntentCases)await t.test(fixture.id,async()=>{
    const input=promptAssistanceRequestSchema.parse({sessionId:randomUUID(),requestId:randomUUID(),draftRevision:0,locale:'en',message:fixture.message,...(fixture.activeSuggestion?{activeSuggestion:fixture.activeSuggestion}:{}),draft:{surface:'video',workflow:'create',engineId:'wan-3',mode:'t2v',target:'prompt',text:fixture.editor,settings:{durationSec:7,audio:true,aspectRatio:'auto'},references:[]}});
    const context=await buildPromptAssistanceContext('owner',input,{catalog});
    const params=promptResponseParams({model:'gpt-6-luna',input_json:input} as PromptRequestRow,context,fixture.history);
    const providerInput=params.input as Array<{role:string;content:string}>;
    assert.deepEqual(providerInput.slice(0,-1),fixture.history,'same-chat continuation must remain available');
    const current=JSON.parse(providerInput.at(-1)!.content);
    assert.equal(current.message,fixture.message,'the latest message must not be merged with an old draft');
    assert.equal(current.currentDraft.text,fixture.editor,'explicit editor revisions still need the editor');
    assert.equal(current.activeSuggestion,fixture.activeSuggestion,'follow-up edits still need the unapplied proposal');
    assert.equal(current.currentDraft.settings.durationSec,7);
    assert.equal(current.currentDraft.settings.audio,true);
    assert.equal(current.currentDraft.settings.aspectRatio,'auto','intent does not authorize silently changing settings');
  });
});
