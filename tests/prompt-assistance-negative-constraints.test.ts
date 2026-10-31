import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {getBaseEngines} from '../frontend/src/lib/engines';
import {promptAssistanceRequestSchema} from '../frontend/src/lib/prompt-assistance/contract';
import {createAgentModelCatalogDeps} from '../frontend/src/server/agent-api/model-catalog';
import {buildPromptAssistanceContext} from '../frontend/src/server/prompt-assistance/context';
import {promptResponseParams} from '../frontend/src/server/prompt-assistance/provider';
import {parsePromptProviderReply,PROMPT_REPLY_FORMAT} from '../frontend/src/server/prompt-assistance/reply-format';
import type {PromptRequestRow} from '../frontend/src/server/prompt-assistance/repository';

const catalog={...createAgentModelCatalogDeps(),listEngines:async()=>getBaseEngines(),isModeExecutable:()=>true,isEngineExecutable:()=>true};
type ScopeCase={id:string;surface:'image'|'video';message:string;replacement:string;activeSuggestion?:string;history?:Array<{role:'user'|'assistant';content:string}>};

// Synthetic boundary specimens, not observed or simulated model outputs.
const cases:ScopeCase[]=[
  {id:'narrow-headline-exclusion',surface:'image',message:'Make a book-exchange poster that works without a headline. Keep the small table label "Saturday".',replacement:'A welcoming book exchange shown through people trading books. A small table label reads "Saturday". No headline.'},
  {id:'blank-label-with-other-lettering',surface:'image',message:'Leave the jar label blank, with no writing on that label. The café menu behind it reads "Thé".',replacement:'A jar with a blank, unmarked label on a café counter. Behind it, a menu reads "Thé". No writing on the jar label.'},
  {id:'explicit-total-exclusion',surface:'image',message:'Create a completely text-free abstract poster. No words, lettering, numbers, logos or watermarks anywhere.',replacement:'An abstract poster of interlocking colored shapes. No words, lettering, numbers, logos or watermarks anywhere.'},
  {id:'follow-up-corrects-excessive-proposal',surface:'image',message:'Keep the invitation without a headline, but add the small date "12 mai".',activeSuggestion:'A garden invitation with no text of any kind.',history:[{role:'user',content:'An invitation that works without a headline.'},{role:'assistant',content:JSON.stringify({reply:'A visual invitation.',text:'A garden invitation with no text of any kind.'})}],replacement:'A garden invitation with a small date reading "12 mai". No headline.'},
  {id:'silent-video-with-visible-sign',surface:'video',message:'No spoken dialogue. Keep the station sign reading "À demain" visible.',replacement:'A traveler waits beneath a station sign reading "À demain". No spoken dialogue.'},
];

function request(fixture:ScopeCase) {
  const image=fixture.surface==='image';
  return promptAssistanceRequestSchema.parse({sessionId:randomUUID(),requestId:randomUUID(),draftRevision:0,locale:'fr',message:fixture.message,activeSuggestion:fixture.activeSuggestion,draft:{surface:fixture.surface,workflow:'create',engineId:image?'nano-banana-2-1':'wan-3-prime',mode:image?'t2i':'t2v',target:'prompt',text:'',settings:image?{resolution:'1k',aspectRatio:'1:1',watermark:false}:{durationSec:6,aspectRatio:'9:16',audio:false},references:[]}});
}

test('provider envelope includes negative-scope policy for Image and Video at every assistance level',async()=>{
  for(const fixture of [cases[0],cases[4]]){
    const input=request(fixture);
    const context=await buildPromptAssistanceContext('owner',input,{catalog});
    for(const model of ['gpt-6-luna','gpt-6.1-terra','gpt-6.1-sol'] as const){
      const instructions=String(promptResponseParams({model,input_json:input} as PromptRequestRow,context,[]).instructions);
      assert.match(instructions,/intended scope of each negative constraint/i);
      assert.match(instructions,/do not broaden.*related content/i);
      assert.match(instructions,/exclusions actually requested.*supported settings/i);
      assert.match(instructions,/reasonable creative choices.*unspecified details/i);
    }
  }
});

// These assertions establish lossless transport/decoding. Semantic fidelity still
// requires separately authorized real-model evaluation; no provider is called.
test('negative-scope cases preserve exact requests, settings, history and valid replacement text',async t=>{
  for(const fixture of cases)await t.test(fixture.id,async()=>{
    const input=request(fixture);
    const context=await buildPromptAssistanceContext('owner',input,{catalog});
    const history=fixture.history??[];
    const params=promptResponseParams({model:'gpt-6-luna',input_json:input} as PromptRequestRow,context,history);
    const sent=params.input as Array<{role:string;content:string}>;
    const current=JSON.parse(sent.at(-1)!.content);
    assert.deepEqual(sent.slice(0,-1),history);
    assert.equal(current.message,fixture.message);
    assert.equal(current.currentDraft.text,'');
    assert.equal(current.activeSuggestion,fixture.activeSuggestion);
    assert.deepEqual(current.currentDraft.settings,context.settings);
    if(fixture.surface==='image')assert.equal(current.currentDraft.settings.watermark,false);
    else assert.equal(current.currentDraft.settings.audio,false);
    const decoded=parsePromptProviderReply(JSON.stringify({kind:'replacement',reply:'Prepared for review.',text:fixture.replacement}),{replyFormat:PROMPT_REPLY_FORMAT});
    assert.deepEqual(decoded,{reply:'Prepared for review.',text:fixture.replacement},'Valid explicit exclusions and literal text must survive without a keyword filter.');
  });
});
