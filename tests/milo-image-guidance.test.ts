import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import test from 'node:test';
import {buildPromptAssistanceContext} from '../frontend/src/server/prompt-assistance/context';
import {promptResponseParams} from '../frontend/src/server/prompt-assistance/provider';
import {createAgentModelCatalogDeps} from '../frontend/src/server/agent-api/model-catalog';
import {getBaseEngines} from '../frontend/src/lib/engines';
import type {PromptRequestRow} from '../frontend/src/server/prompt-assistance/repository';

test('the actual image provider request receives app upscale and text-only settings guidance without changing execution',async()=>{
  const input={sessionId:randomUUID(),requestId:randomUUID(),draftRevision:0,locale:'fr' as const,message:'Mon image se dégrade et manque de netteté.',
    draft:{surface:'image' as const,engineId:'seedream',mode:'t2i',target:'prompt' as const,text:'Keep the original composition.',settings:{resolution:'2k',aspectRatio:'16:9',outputFormat:'jpeg'},references:[]}};
  const before=structuredClone(input);
  const context=await buildPromptAssistanceContext('owner',input,{catalog:{...createAgentModelCatalogDeps(),listEngines:async()=>getBaseEngines(),isEngineExecutable:()=>true,isModeExecutable:()=>true}});
  const params=promptResponseParams({model:'gpt-6-luna',input_json:input} as PromptRequestRow,context,[]);
  const instructions=String(params.instructions);
  assert.match(instructions,/https:\/\/maxvideoai\.com\/app\/tools\/upscale/);
  assert.match(instructions,/Tools → Upscale/);
  assert.doesNotMatch(instructions,/\[Upscale\]\(/);
  assert.match(instructions,/plain text[^\n]*Markdown[^\n]*clickable/i);
  assert.ok(existsSync('frontend/app/(core)/(workspace)/app/tools/upscale/page.tsx'));
  assert.match(instructions,/SeedVR2[\s\S]*generative[\s\S]*pixel-identical/i);
  assert.match(instructions,/resolution, output format and aspect ratio[\s\S]*explicitly[\s\S]*Use prompt.*only.*text/i);
  assert.equal(params.model,'gpt-6-luna');assert.equal(params.service_tier,'default');assert.equal(params.store,false);
  assert.equal(params.max_output_tokens,2200);assert.deepEqual(input,before);
  assert.match(instructions,/honor the most recent applicable explicit instruction about reply language/);
});
