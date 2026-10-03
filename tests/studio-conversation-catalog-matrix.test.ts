import assert from 'node:assert/strict';
import test from 'node:test';
import {listFalEngines} from '../frontend/src/config/falEngines';
import {getRuntimeModelById,resolveRuntimeEngineInput} from '../frontend/config/model-runtime';
import {listPublicAgentGenerationEngines,type AgentModelCatalogDeps,type AgentPublicGenerationEngine} from '../frontend/src/server/agent-api/model-catalog';
import {createStudioImageGenerationService,createStudioVideoGenerationService} from '../frontend/src/server/studio/image-generation-service';
import {studioVisualCapabilityDetails,studioVisualCapabilitySummary} from '../frontend/src/server/studio/conversation-capabilities';
import {imageRequestFromDraft} from '../frontend/src/server/studio/image-conversation-service';
import {studioMediaRequest,type StudioMediaFactories} from '../frontend/src/server/studio/conversation-media-generation';
import {normalizeGenerationRequest} from '../frontend/src/server/agent-api/generation-normalization';
import {requireStudioGenerationRequest} from '../frontend/src/server/agent-api/generation-actor';
import {readGenerationPricing} from '../frontend/src/server/agent-api/generation-pricing-read';
import {recommendAgentModels} from '../frontend/src/server/agent-api/model-recommendations';
import type {CanonicalGenerationRequest} from '../frontend/src/server/agent-api/generation-types';
import type {ResolvedReference} from '../frontend/src/server/agent-api/reference-types';

const actor={authMethod:'studio-session' as const,userId:'catalog-owner',projectId:'catalog-project',clientId:null};
const entries=listFalEngines();
const sourceDeps:AgentModelCatalogDeps={
  listEngines:async()=>entries.map(entry=>entry.engine),
  surfaceByEngineId:id=>entries.find(entry=>entry.id===id)?.category==='image'?'image':'video',
  // Only external runtime readiness is replaced. Publication, lifecycle, modes,
  // schemas, Studio certification and request/quote validation remain real.
  isEngineExecutable:()=>true,isModeExecutable:()=>true,
};
const currentCertified=[
  'gemini-omni-flash','gpt-image-2-5-flare','happy-horse-1-1',
  'kling-3-4k','kling-3-pro','kling-3-standard','kling-o3-4k','kling-o3-pro','kling-o3-standard',
  'luma-ray-3-2','luma-uni-1','luma-uni-1-max','minimax-h3','minimax-hailuo-02-text',
  'nano-banana-2','nano-banana-lite','nano-banana-pro','pika-text-to-video',
  'seedance-2-0','seedance-2-0-fast','seedance-2-0-mini','seedance-2-5','seedream','seedream-5-0-pro',
  'veo-3-1','veo-3-1-fast','veo-3-1-lite','wan-3','wan-3-prime',
];
const uncertified=[
  'kling-3-turbo-pro','kling-3-turbo-standard','minimax-h3-max','ltx-2-5-fast','ltx-2-5-pro',
  'grok-imagine-video-1-5','flux-3','flux-3-draft','gpt-image-2-5-sunburst',
];
const executableLegacy=['gpt-image-2','happy-horse-1-0','kling-2-5-turbo','kling-2-6-pro','ltx-2-3','ltx-2-3-fast','lumaRay2','lumaRay2_flash','nano-banana','wan-2-6'];
const archive=['seedance-1-5-pro','sora-2','sora-2-pro','ltx-2','ltx-2-fast','wan-2-5'];
async function services(deps=sourceDeps) {
  const catalog=await listPublicAgentGenerationEngines(deps);
  const options={enabled:true,prepareDependencies:{listPublicEngines:async()=>catalog}};
  const image=createStudioImageGenerationService(actor,options);
  const video=createStudioVideoGenerationService(actor,options);
  return {image,video,catalog:[...await image.catalog(),...await video.catalog()]};
}

test('the real published catalog reaches Studio without the five-model pilot restriction',async()=>{
  const {catalog}=await services();
  assert.deepEqual(catalog.filter(entry=>getRuntimeModelById(entry.engine.id)?.lifecycle==='current').map(entry=>entry.engine.id).sort(),currentCertified.slice().sort());
  for(const id of [...uncertified,...archive,'seedance-2-0-fast-byteplus'])
    assert.equal(catalog.some(entry=>entry.engine.id===id),false,id);
  assert.deepEqual(catalog.filter(entry=>getRuntimeModelById(entry.engine.id)?.lifecycle==='legacy').map(entry=>entry.engine.id).sort(),executableLegacy.slice().sort(),'Published legacy explicit choices remain executable.');
  for(const candidate of catalog){
    assert.deepEqual(candidate.publicModes,candidate.surface==='image'?['t2i','i2i']:['t2v','i2v'],candidate.engine.id);
    const summary=studioVisualCapabilitySummary(candidate);
    assert.deepEqual(summary.modes,candidate.publicModes);
    assert.equal(summary.lifecycle,getRuntimeModelById(candidate.engine.id)?.lifecycle);
    const details=studioVisualCapabilityDetails(candidate);
    assert.notEqual(details.surface,'audio');
    if(details.surface!=='audio')assert.equal(details.lifecycle,summary.lifecycle);
    if(candidate.engine.id==='pika-text-to-video')assert.equal(summary.editorialGuidance?.level,'on_request');
  }
});

test('Studio preserves runtime exclusions and mode-level eligibility instead of copying public availability',async()=>{
  const {catalog}=await services({...sourceDeps,
    isEngineExecutable:engine=>engine.id!=='wan-3-prime',
    isModeExecutable:(engine,mode)=>engine.id!=='veo-3-1'||mode==='t2v',
  });
  assert.equal(catalog.some(entry=>entry.engine.id==='wan-3-prime'),false);
  assert.deepEqual(catalog.find(entry=>entry.engine.id==='veo-3-1')?.publicModes,['t2v']);
  assert.ok(catalog.some(entry=>entry.engine.id==='wan-3'));
});

test('published retirement and legacy aliases survive the Studio integration',async()=>{
  for(const id of archive){
    const model=getRuntimeModelById(id)!;
    assert.equal(model.lifecycle,'deep_legacy',id);
    assert.equal(model.publication.app.published,false,id);
    assert.equal(model.publication.pricing.published,false,id);
    assert.equal(model.publication.model.published,true,id);
  }
  for(const [alias,id] of [['veo-3-fast','veo-3-1-fast'],['veo3fast','veo-3-1-fast'],['pika-image-to-video','pika-text-to-video']])
    assert.equal(resolveRuntimeEngineInput(alias)?.id,id,alias);
});

const assetId='ma_'+'a'.repeat(32);
const source:ResolvedReference={assetId,role:'reference',mediaKind:'image',storageUrl:'https://fixture.invalid/owned.png',mimeType:'image/png',width:1024,height:1024,durationSec:null};
const input={requestId:'123e4567-e89b-42d3-a456-426614174000',message:'A quiet product shot with warm window light',references:[assetId]};
const membership={tier:'member' as const,source:'app_receipts_rolling_30d' as const,spent30Cents:0,thresholdCents:0,discountPercent:0};
function quoteDependencies(catalog:AgentPublicGenerationEngine[]){
  return {
    listPublicEngines:async()=>catalog,
    resolveGenerationReferences:async(request:CanonicalGenerationRequest)=>request.references.map(ref=>({...source,role:ref.role,...('slot' in ref?{slot:ref.slot}:{})})),
    resolveRequestExecutability:()=>({executable:true as const,reason:'available' as const}),
    resolveMembershipPricing:async()=>membership,
    // A fixture tariff, never a current price assertion. The shared quote gate
    // still validates exact settings, references and availability before pricing.
    priceGeneration:async()=>({priceCents:123,currency:'USD',membershipTier:'member' as const,pricingSnapshot:{totalCents:123,currency:'USD',membershipTier:'member'}}),
  };
}

test('every exposed Studio mode maps visible options through the real request builder and quote validation',async t=>{
  const {catalog,image,video}=await services();
  const factories={image:()=>image,video:()=>video,audio:()=>{throw new Error('Audio is outside this matrix');}} as StudioMediaFactories;
  assert.ok(catalog.some(entry=>entry.engine.id==='seedance-2-5'),'Exercise the newly visible current catalog.');
  for(const candidate of catalog){
    const details=studioVisualCapabilityDetails(candidate);
    assert.notEqual(details.surface,'audio');
    if(details.surface==='audio')throw new Error('Expected visual facts');
    for(const mode of details.modes)await t.test(candidate.engine.id+' '+mode.mode,async()=>{
      const aspectRatio=mode.aspectRatios.includes(candidate.surface==='image'?'1:1':'16:9')?(candidate.surface==='image'?'1:1':'16:9'):mode.aspectRatios[0]??'16:9';
      const settings=mode.settings.filter(setting=>setting.default!==null&&setting.type!=='multi_prompt'&&!['imageWidth','imageHeight'].includes(setting.key)).map(setting=>({name:setting.key,value:setting.default}));
      settings.push({name:'resolution',value:mode.resolutions[0]});
      if(mode.duration)settings.push({name:'durationSec',value:mode.duration.options?.[0]??mode.duration.range?.min??5});
      const reference=mode.references.find(ref=>ref.required&&ref.type==='image');
      const references=reference?[{ref:{type:'asset' as const,assetId,kind:'image' as const},role:reference.roles[0],slot:null}]:[];
      const selection={modelId:candidate.engine.id,mode:mode.mode,prompt:input.message,aspectRatio,settings,references,outputCount:1 as const};
      const request=candidate.surface==='image'
        ?imageRequestFromDraft({reply:'Review the selected request.',image:selection} as never,input,catalog)
        :await studioMediaRequest(actor,{action:'video.prepare',...selection} as never,input,factories,true,{
          resolveMedia:async()=>({kind:'image',url:source.storageUrl,mime:'image/png',mediaFacts:{width:1024,height:1024}}) as never,
        });
      assert.equal(request.surface,candidate.surface);
      const visual=request as CanonicalGenerationRequest;
      assert.equal(visual.engineId,candidate.engine.id,'Explicit choices must not be replaced.');
      assert.equal(visual.mode,mode.mode);
      assert.deepEqual(normalizeGenerationRequest(visual),visual);
      requireStudioGenerationRequest(visual);
      for(const setting of settings)assert.equal(visual.settings[setting.name],setting.value,'Preserve '+setting.name);
      const quote=await readGenerationPricing(visual,actor,quoteDependencies(catalog));
      assert.equal(quote.pricingSnapshot.engineId,candidate.engine.id);
      assert.equal(quote.pricing.priceCents,123);
      if(candidate.surface==='image'&&mode.resolutions.includes('custom')) {
        const custom={...visual,settings:{...visual.settings,resolution:'custom',imageWidth:1024,imageHeight:768}};
        assert.equal((await readGenerationPricing(custom,actor,quoteDependencies(catalog))).pricing.priceCents,123);
        await assert.rejects(readGenerationPricing({...custom,settings:{...custom.settings,imageWidth:3}},actor,quoteDependencies(catalog)),{code:'PARAMETER_INVALID'});
      }
      await assert.rejects(readGenerationPricing({...visual,settings:{...visual.settings,resolution:'unknown-resolution'}},actor,quoteDependencies(catalog)),{code:'PARAMETER_INVALID'});
      if(reference)await assert.rejects(readGenerationPricing({...visual,references:[]},actor,quoteDependencies(catalog)),{code:'REFERENCE_REQUIRED'});
    });
  }
});

test('action-specific recommendations preserve a single compatible explicit choice and Pika on request',async context=>{
  context.mock.timers.enable({apis:['Date'],now:new Date('2026-10-04T12:00:00Z')});
  const {catalog,image,video}=await services();
  const deps:AgentModelCatalogDeps={
    ...sourceDeps,listEngines:async()=>catalog.map(entry=>({...entry.engine,modes:entry.publicModes as typeof entry.engine.modes,modeCaps:entry.modeCaps})),
  };
  const imageSuggestions=await recommendAgentModels({surface:'image',mode:'t2i'},deps);
  assert.ok(imageSuggestions.recommendations.length);
  assert.ok(imageSuggestions.recommendations.every(item=>item.model.lifecycle==='current'));
  const open=await recommendAgentModels({surface:'video',mode:'t2v',aspectRatio:'16:9'},deps);
  assert.ok(open.recommendations.length>0&&open.recommendations.length<=3);
  assert.equal(open.recommendations[0].editorialGuidance?.level,'reference');
  assert.notEqual(open.recommendations[0].model.id,'pika-text-to-video');
  const pika=await recommendAgentModels({id:'pika-text-to-video',surface:'video',mode:'i2v'},deps);
  assert.deepEqual(pika.recommendations.map(item=>item.model.id),['pika-text-to-video']);
  const fourK=await recommendAgentModels({surface:'video',mode:'t2v',resolution:'4k',preferredModelIds:['seedance-2-5']},deps);
  assert.ok(fourK.recommendations.length>0);
  assert.notEqual(fourK.recommendations[0].model.id,'seedance-2-5');
  assert.ok(fourK.recommendations[0].model.resolutions.includes('4k'));
  const unavailable=await recommendAgentModels({id:'kling-3-turbo-pro',surface:'video',mode:'t2v'},deps);
  assert.deepEqual(unavailable.recommendations,[],'An exact unavailable choice must not silently become another model.');
  assert.throws(()=>imageRequestFromDraft({reply:'Review.',image:{prompt:input.message,aspectRatio:'1:1',modelId:'gpt-image-2-5-sunburst'}} as never,{...input,references:[]},catalog),{code:'ENGINE_UNAVAILABLE'});
  const factories={image:()=>image,video:()=>video,audio:()=>{throw new Error('Audio is outside this matrix');}} as StudioMediaFactories;
  await assert.rejects(studioMediaRequest(actor,{action:'video.prepare',modelId:'kling-3-turbo-pro',mode:'t2v',prompt:input.message,aspectRatio:'16:9'} as never,input,factories,true),{code:'ENGINE_UNAVAILABLE'});
  for(const mode of ['ref2v','fl2v','v2v','extend'])await assert.rejects(studioMediaRequest(actor,{action:'video.prepare',modelId:'wan-3',mode,prompt:input.message,aspectRatio:'16:9',references:[{ref:{type:'asset',assetId,kind:'image'},role:'first_frame',slot:null}]} as never,input,factories,true),{code:'MODE_UNSUPPORTED'});
});
