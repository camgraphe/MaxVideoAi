import assert from 'node:assert/strict';
import test from 'node:test';

import {listFalEngines} from '../frontend/src/config/falEngines';
import type {ImageDraft,ImageTurnInput} from '../frontend/src/lib/studio/image-conversation-contract';
import {listPublicAgentGenerationEngines} from '../frontend/src/server/agent-api/model-catalog';
import {normalizeGenerationRequest} from '../frontend/src/server/agent-api/generation-normalization';
import {validateCanonicalGenerationCapabilities} from '../frontend/src/server/agent-api/generation-capability-validation';
import {createStudioImageGenerationService} from '../frontend/src/server/studio/image-generation-service';
import {imageRequestFromDraft} from '../frontend/src/server/studio/image-conversation-service';
import {studioVisualCapabilityDetails} from '../frontend/src/server/studio/conversation-capabilities';

const firstImage='ma_'+'a'.repeat(32);
const secondImage='ma_'+'b'.repeat(32);
const unselectedImage='ma_'+'c'.repeat(32);
const prompt='Use these products as visual references in a warm editorial scene.';
const input:ImageTurnInput={
  requestId:'123e4567-e89b-42d3-a456-426614174000',
  message:'Use these two product images as references.',
  references:[unselectedImage,secondImage,firstImage],
};

async function certifiedCatalog() {
  const entries=listFalEngines();
  const canonical=await listPublicAgentGenerationEngines({
    listEngines:async()=>entries.map(entry=>entry.engine),
    surfaceByEngineId:id=>entries.find(entry=>entry.id===id)?.category==='image'?'image':'video',
    // Only provider readiness is controlled; publication, mode schemas and
    // Studio certification still pass through the production catalog adapter.
    isEngineExecutable:()=>true,
    isModeExecutable:()=>true,
  });
  return createStudioImageGenerationService({
    authMethod:'studio-session',userId:'optional-reference-owner',projectId:'optional-reference-project',clientId:null,
  },{enabled:true,prepareDependencies:{listPublicEngines:async()=>canonical}}).catalog();
}

function draft(modelId:string,resolution='2K'):ImageDraft {
  return {reply:'Review the image quote.',image:{
    modelId,mode:'t2i',prompt,aspectRatio:'16:9',outputCount:1,
    settings:[{name:'resolution',value:resolution},{name:'outputFormat',value:'jpeg'}],
    references:[
      {ref:{type:'asset',assetId:secondImage,kind:'image'},role:'reference',slot:null},
      {ref:{type:'asset',assetId:firstImage,kind:'image'},role:'reference',slot:null},
    ],
  }};
}

for(const modelId of ['luma-uni-1','luma-uni-1-max']) {
  test(`${modelId} Studio t2i preserves optional attached references in the canonical MCP request`,async()=>{
    const catalog=await certifiedCatalog();
    const candidate=catalog.find(entry=>entry.engine.id===modelId);
    assert.ok(candidate,'The selected model must pass the actual Studio certification.');
    const details=studioVisualCapabilityDetails(candidate);
    assert.notEqual(details.surface,'audio');
    if(details.surface==='audio')throw new Error('Expected image capabilities.');
    const reference=details.modes.find(mode=>mode.mode==='t2i')?.references.find(ref=>ref.roles.includes('reference'));
    assert.ok(reference && !reference.required,'Studio advertises optional image guidance for this t2i mode.');
    const selection=draft(modelId);
    const saved=structuredClone(selection);
    const expected={
      schemaVersion:1 as const,surface:'image' as const,engineId:modelId,mode:'t2i' as const,prompt,
      settings:{aspectRatio:'16:9',resolution:'2K',outputFormat:'jpeg'},
      references:[
        {kind:'asset' as const,assetId:firstImage,role:'reference' as const},
        {kind:'asset' as const,assetId:secondImage,role:'reference' as const},
      ],
      outputCount:1,
    };
    const canonical=normalizeGenerationRequest(expected);
    validateCanonicalGenerationCapabilities(canonical,candidate);
    const actual=imageRequestFromDraft(selection,input,catalog);
    assert.deepEqual(actual,expected,'Keep the exact model, mode, settings and selected assets and roles.');
    assert.deepEqual(actual,canonical,'The Studio builder must produce the same transport-neutral request as MCP.');
    assert.deepEqual(selection,saved,'Building a request must preserve the saved director intent.');
  });

  test(`${modelId} Studio t2i still refuses references that were not attached`,async()=>{
    const catalog=await certifiedCatalog();
    assert.throws(()=>imageRequestFromDraft(draft(modelId),{...input,references:[firstImage]},catalog),{code:'REFERENCE_INVALID'});
  });
}

for(const modelId of ['gpt-image-2','gpt-image-2-5-flare']) {
  test(`${modelId} Studio t2i still rejects unsupported image references through canonical validation`,async()=>{
    const catalog=await certifiedCatalog();
    assert.ok(catalog.some(entry=>entry.engine.id===modelId));
    assert.throws(()=>imageRequestFromDraft(draft(modelId,'landscape_16_9'),input,catalog),{code:'REFERENCE_INVALID'});
  });
}
