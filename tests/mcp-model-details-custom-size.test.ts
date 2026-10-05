import assert from 'node:assert/strict';
import test from 'node:test';

import {listFalEngines} from '../frontend/src/config/falEngines';
import {getRuntimeModelById} from '../frontend/config/model-runtime';
import {getImageInputField} from '../frontend/lib/image/inputSchema';
import type {ImageGenerationMode} from '../frontend/types/image-generation';
import {getAgentModelDetails,projectAgentModelModeDetails} from '../frontend/src/server/agent-api/model-details';
import {listPublicAgentGenerationEngines} from '../frontend/src/server/agent-api/model-catalog';
import {normalizeGenerationRequest} from '../frontend/src/server/agent-api/generation-normalization';
import {validateCanonicalGenerationCapabilities} from '../frontend/src/server/agent-api/generation-capability-validation';
import {createStudioImageGenerationService} from '../frontend/src/server/studio/image-generation-service';
import {studioVisualCapabilityDetails} from '../frontend/src/server/studio/conversation-capabilities';
import {imageRequestFromDraft} from '../frontend/src/server/studio/image-conversation-service';
import type {ImageDraft} from '../frontend/src/lib/studio/image-conversation-contract';

const entries=listFalEngines();
const deps={
  listEngines:async()=>entries.map(entry=>entry.engine),
  surfaceByEngineId:(id:string)=>entries.find(entry=>entry.id===id)?.category==='image'?'image' as const:'video' as const,
  // Only runtime readiness is controlled; the real registry and public-mode gates remain active.
  isEngineExecutable:()=>true,isModeExecutable:()=>true,
};
const customEntries=entries.filter(entry=>entry.category==='image'
  && getRuntimeModelById(entry.id)?.publication.app.published
  && entry.engine.resolutions.includes('custom'));
const actor={authMethod:'studio-session' as const,userId:'dimension-review',projectId:'dimension-review',clientId:null};
const input={requestId:'123e4567-e89b-42d3-a456-426614174000',message:'Create a product image in landscape format.',references:[]};

test('the custom-size contract covers every published image engine with custom dimensions',()=>{
  assert.deepEqual(customEntries.map(entry=>entry.id).sort(),['gpt-image-2','gpt-image-2-5-flare','gpt-image-2-5-sunburst']);
});

for(const entry of customEntries){
  test(`${entry.id} MCP and eligible Studio details preserve exact custom dimension increments and pixel limits`,async()=>{
    const mcp=await getAgentModelDetails(entry.id,deps);
    const catalog=await listPublicAgentGenerationEngines(deps);
    const studioCatalog=await createStudioImageGenerationService(actor,{enabled:true,prepareDependencies:{listPublicEngines:async()=>catalog}}).catalog();
    const studioCandidate=studioCatalog.find(candidate=>candidate.engine.id===entry.id);
    const studio=studioCandidate?studioVisualCapabilityDetails(studioCandidate):undefined;
    let checked=0;
    for(const mode of mcp.modes.filter(mode=>mode.resolutions.includes('custom'))){
      const canonicalSize=entry.engine.inputSchema?.constraints?.imageSize;
      assert.ok(canonicalSize);
      assert.deepEqual(mode.imageSize,canonicalSize,'Expose all five authored limits without provider metadata.');
      assert.equal(Object.isFrozen(mode.imageSize),true);
      for(const [key,fieldId] of [['imageWidth','image_width'],['imageHeight','image_height']] as const){
        const source=getImageInputField(entry.engine,fieldId,mode.mode as ImageGenerationMode);
        const setting=mode.settings.find(setting=>setting.key===key);
        assert.ok(source&&setting);
        assert.equal(setting.step,source.step);
        assert.equal(setting.step,16,'Custom dimensions are increments of sixteen, not arbitrary pixels.');
        assert.equal(setting.min,source.min);assert.equal(setting.max,source.max);assert.equal(setting.default,source.default);
      }
      if(studio){
        assert.notEqual(studio.surface,'audio');
        if(studio.surface==='audio')throw new Error('Expected image details.');
        const studioMode=studio.modes.find(value=>value.mode===mode.mode);
        assert.ok(studioMode);
        assert.deepEqual(studioMode.imageSize,mode.imageSize);
        assert.deepEqual(studioMode.settings,mode.settings);
      }
      checked++;
    }
    assert.equal(checked,2,'Both published image workflows must expose the custom-size constraints.');
  });

  test(`${entry.id} still rejects 1920x1080 custom dimensions and accepts the exact 16:9 preset`,async()=>{
    const catalog=await listPublicAgentGenerationEngines(deps);
    const candidate=catalog.find(candidate=>candidate.engine.id===entry.id);
    assert.ok(candidate);
    const base={schemaVersion:1,surface:'image',engineId:entry.id,mode:'t2i',prompt:input.message,references:[],outputCount:1};
    const invalid=normalizeGenerationRequest({...base,settings:{resolution:'custom',aspectRatio:'16:9',imageWidth:1920,imageHeight:1080}});
    assert.throws(()=>validateCanonicalGenerationCapabilities(invalid,candidate),{kind:'parameter_invalid',field:'image_height'});
    assert.deepEqual(invalid.settings,{resolution:'custom',aspectRatio:'16:9',imageWidth:1920,imageHeight:1080},'Validation must not silently round the client dimensions.');
    const preset=normalizeGenerationRequest({...base,settings:{resolution:'landscape_16_9',aspectRatio:'16:9'}});
    assert.doesNotThrow(()=>validateCanonicalGenerationCapabilities(preset,candidate));

    const studioCatalog=await createStudioImageGenerationService(actor,{enabled:true,prepareDependencies:{listPublicEngines:async()=>catalog}}).catalog();
    if(studioCatalog.some(candidate=>candidate.engine.id===entry.id)){
      const draft:ImageDraft={reply:'Review the quote.',image:{modelId:entry.id,mode:'t2i',prompt:input.message,aspectRatio:'16:9',
        settings:[{name:'imageWidth',value:1920},{name:'imageHeight',value:1080}],references:[],outputCount:1}};
      const saved=structuredClone(draft);
      assert.throws(()=>imageRequestFromDraft(draft,input,studioCatalog),{code:'PARAMETER_INVALID'});
      assert.deepEqual(draft,saved,'Failed preparation preserves the original request.');
      const actual=imageRequestFromDraft({...draft,image:{...draft.image!,settings:[]}},input,studioCatalog);
      assert.equal(actual.settings.resolution,'landscape_16_9');
      assert.equal(actual.settings.aspectRatio,'16:9');
      assert.equal(Object.hasOwn(actual.settings,'imageWidth'),false);
      assert.equal(Object.hasOwn(actual.settings,'imageHeight'),false);
    }
  });
}

test('numeric provider aliases retain their authored step without adding steps to nonnumeric controls',async()=>{
  const details=await getAgentModelDetails('kling-3-pro',deps);
  const mode=details.modes.find(mode=>mode.mode==='t2v');
  assert.ok(mode);
  assert.equal(mode.settings.find(setting=>setting.key==='cfgScale')?.step,0.05);
  for(const setting of mode.settings.filter(setting=>setting.type!=='number'))assert.equal(Object.hasOwn(setting,'step'),false);
});

test('custom image limits are detached, frozen and limited to public numeric geometry',()=>{
  const entry=structuredClone(customEntries[0]);
  const size={multipleOf:16,minPixels:655360,maxPixels:8294400,maxEdge:3840,maxAspectRatio:3,privateProvider:'do-not-expose'};
  entry.engine.inputSchema!.constraints!.imageSize=size;
  const candidate={engine:entry.engine,surface:'image' as const,modeCaps:Object.fromEntries(entry.modes.map(mode=>[mode.mode,mode.ui]))};
  const projected=projectAgentModelModeDetails(candidate,'t2i');
  assert.deepEqual(projected.imageSize,{multipleOf:16,minPixels:655360,maxPixels:8294400,maxEdge:3840,maxAspectRatio:3});
  size.multipleOf=32;size.maxPixels=1;
  assert.equal(projected.imageSize?.multipleOf,16);assert.equal(projected.imageSize?.maxPixels,8294400);
  assert.equal(Object.isFrozen(projected.imageSize),true);
  assert.doesNotMatch(JSON.stringify(projected),/privateProvider|do-not-expose/);
});
