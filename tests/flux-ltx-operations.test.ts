import assert from 'node:assert/strict';
import test from 'node:test';
import { buildFalGenerationRequest } from '../frontend/src/lib/fal-request-body';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { normalizeVideoOperation, resolveVideoOperationEngine } from '../frontend/lib/video-operation';
import { validateFluxLtxSource } from '../frontend/lib/flux-ltx-operations';
import { buildBillingPricingFacts } from '../frontend/src/lib/pricing-billing-facts';
import { buildManualTariffScenario, continuousInputTariffSelector } from '../frontend/src/lib/pricing-manual-scenario';

test('FAST is an explicit FLUX base operation with strict MP4, duration and byte bounds',()=>{
 assert.equal(normalizeVideoOperation('flux-3','v2v','flux-fast-edit'),'flux-fast-edit');
 assert.throws(()=>normalizeVideoOperation('flux-3-max','v2v','flux-fast-edit'));
 const facts={durationSec:5.558333,sizeBytes:26852432,mimeType:'video/mp4'};
 assert.equal(validateFluxLtxSource('flux-fast-edit',facts),undefined);
 for(const change of [{durationSec:15},{sizeBytes:50_000_000},{mimeType:'video/quicktime'}]) assert.ok(validateFluxLtxSource('flux-fast-edit',{...facts,...change}));
 const engine=resolveVideoOperationEngine(getFalEngineById('flux-3')!.engine,'v2v','flux-fast-edit');
 assert.equal(engine.operationCaps!['flux-fast-edit']!.label,'FAST Edit');
 const built=buildFalGenerationRequest({engineId:'flux-3',mode:'v2v',operation:'flux-fast-edit',prompt:'Winter',inputs:[{kind:'video',slotId:'video_url',url:'owned'}],durationSec:5,resolution:'720p',audio:true,extraInputValues:{safety_tolerance:1}},'wrong');
 assert.equal(built.model,'blackforestlabs/flux-3/edit-video');
 assert.deepEqual(built.requestBody,{prompt:'Winter',video_url:'owned',safety_tolerance:1});
});
test('base and Draft keyframes preserve image order and validate count, uniqueness and duration × 24',()=>{
 for(const engineId of ['flux-3','flux-3-draft']) {
  const input={engineId,mode:'ref2v',prompt:'Motion',durationSec:5,resolution:'720p',referenceImages:['b','a','b'],extraInputValues:{keyframe_indexes:'120,0,60'}};
  const result=buildFalGenerationRequest(input,'wrong');
  assert.equal(result.model,`blackforestlabs/flux-3/keyframes-to-video${engineId.endsWith('draft')?'/draft':''}`);
  assert.deepEqual(result.requestBody.keyframes,[{image_url:'b',frame_index:120},{image_url:'a',frame_index:0},{image_url:'b',frame_index:60}]);
  assert.equal(result.requestBody.resolution,engineId.endsWith('draft')?undefined:'720p');
  for(const indexes of ['0,0,2','0,1,121','0,1','0,-1,2']) assert.throws(()=>buildFalGenerationRequest({...input,extraInputValues:{keyframe_indexes:indexes}},'wrong'));
  assert.throws(()=>buildFalGenerationRequest({...input,durationOption:'auto'},'wrong'));
 }
});
test('LTX Reframe belongs only to 2.3 and sends no invented prompt, timing or audio controls',()=>{
 assert.throws(()=>normalizeVideoOperation('ltx-2-5-pro','reframe','ltx23-reframe'));
 assert.equal(validateFluxLtxSource('ltx23-reframe',{durationSec:60}),undefined);
 assert.ok(validateFluxLtxSource('ltx23-reframe',{durationSec:60.001}));
 const built=buildFalGenerationRequest({engineId:'ltx-2-3',mode:'reframe',operation:'ltx23-reframe',prompt:'',resolution:'720p',aspectRatio:'4:5',videoUrl:'owned'},'wrong');
 assert.deepEqual(built,{model:'fal-ai/ltx-2.3/reframe',requestBody:{video_url:'owned',resolution:'720p',aspect_ratio:'4:5',enable_safety_checker:true}});
});
test('new source operations have separate continuous selectors and exact fractional reference facts',()=>{
 for(const [engineId,mode,operation,resolution,rate] of [['flux-3','v2v','flux-fast-edit','720p',3],['ltx-2-3','reframe','ltx23-reframe','1080p',20],['flux-3-draft','v2v','flux-draft-enhance','1080p',29]] as const){
  const engine=resolveVideoOperationEngine(getFalEngineById(engineId)!.engine,mode,operation);
  const context={engine,mode,operation,resolution,durationSec:10.041667};
  const built=buildBillingPricingFacts(context,engine.pricingDetails,'USD');
  assert.equal(built.facts.vendorSubtotalExactCents,10.041667*rate);
  const scenario=buildManualTariffScenario(context,built.facts);
  assert.equal(scenario.selector.operation,operation);
  assert.equal(scenario.quantities.input_video_seconds,10.041667);
  assert.equal(continuousInputTariffSelector(scenario.selector)?.durationSec,'continuous');
  assert.equal(built.meta.effective_supplier_charge_verified,false);
 }
});

import { normalizeGenerationRequest } from '../frontend/src/server/agent-api/generation-normalization';
import { validateCanonicalGenerationCapabilities } from '../frontend/src/server/agent-api/generation-capability-validation';
import { buildPaidVideoRequestBody } from '../frontend/src/server/agent-api/paid-video-request-body';
import { projectAgentModelModeDetails } from '../frontend/src/server/agent-api/model-details';
import { canonicalOperationSourceDuration } from '../frontend/src/server/agent-api/generation-operation-facts';
import { isStudioConversationVideoModeCertified } from '../frontend/app/(core)/(workspace)/app/studio/_shared/_lib/models/workspace-model-certification';
function candidateFor(id:string) {const entry=getFalEngineById(id)!;return {engine:entry.engine,surface:'video' as const,publicModes:entry.modes.map(m=>m.mode),modeCaps:Object.fromEntries(entry.modes.map(m=>[m.mode,m.ui]))};}
test('keyframe canonical normalization, details, validation and paid transport preserve repeated ordered images',()=>{
 for(const engineId of ['flux-3','flux-3-draft']) {
  const candidate=candidateFor(engineId);
  const request=normalizeGenerationRequest({surface:'video',engineId,mode:'ref2v',prompt:'Move',settings:{durationSec:5,resolution:'720p',aspectRatio:'2:1',keyframeIndexes:'120,0,60'},references:['b','a','b'].map(id=>({kind:'https',url:`https://media.maxvideoai.com/${id}.png`,role:'reference',mediaKind:'image'}))});
  assert.deepEqual(request.references.map(r=>r.kind==='https'?r.url:null),['b','a','b'].map(id=>`https://media.maxvideoai.com/${id}.png`));
  assert.doesNotThrow(()=>validateCanonicalGenerationCapabilities(request,candidate));
  assert.throws(()=>validateCanonicalGenerationCapabilities({...request,settings:{...request.settings,keyframeIndexes:'0,0,3'}},candidate));
  const body=buildPaidVideoRequestBody({quoteId:'quote',request,engine:candidate.engine,canonicalPricing:{membershipTier:'member'}});
  assert.deepEqual(buildFalGenerationRequest(body as never,'wrong').requestBody.keyframes,[{image_url:'https://media.maxvideoai.com/b.png',frame_index:120},{image_url:'https://media.maxvideoai.com/a.png',frame_index:0},{image_url:'https://media.maxvideoai.com/b.png',frame_index:60}]);
  assert.ok(projectAgentModelModeDetails(candidate,'ref2v').settings.some(s=>s.key==='keyframeIndexes'));
  assert.equal(isStudioConversationVideoModeCertified(engineId,'ref2v'),true);
 }
});
test('canonical FAST and LTX Reframe use source seconds, while Enhance demands qualified lineage',()=>{
 for(const [engineId,mode,operation,resolution] of [['flux-3','v2v','flux-fast-edit','720p'],['ltx-2-3','reframe','ltx23-reframe','1080p']] as const) {
  const candidate=candidateFor(engineId);
  const request=normalizeGenerationRequest({surface:'video',engineId,mode,operation,prompt:operation==='flux-fast-edit'?'Winter':'',settings:{resolution,...(mode==='reframe'?{aspectRatio:'4:5'}:{})},references:[{kind:'asset',assetId:'ma_00000000000000000000000000000001',role:'source'}]});
  const refs=[{assetId:'ma_00000000000000000000000000000001',role:'source' as const,mediaKind:'video' as const,storageUrl:'https://media.maxvideoai.com/owned.mp4',durationSec:5.558333,width:1080,height:1920,sizeBytes:1000,mimeType:'video/mp4'}];
  validateCanonicalGenerationCapabilities(request,candidate,{resolvedReferences:refs});
  assert.equal(canonicalOperationSourceDuration(request,refs),5.558333);
  const body=buildPaidVideoRequestBody({quoteId:'quote',request,engine:candidate.engine,resolvedReferences:refs,canonicalPricing:{membershipTier:'member'}});
  const built=buildFalGenerationRequest(body as never,'wrong');assert.equal(built.requestBody.video_url,refs[0]!.storageUrl);assert.equal(built.requestBody.duration,undefined);
  assert.throws(()=>validateCanonicalGenerationCapabilities({...request,settings:{...request.settings,durationSec:5}},candidate));
 }
 const request=normalizeGenerationRequest({surface:'video',engineId:'flux-3-draft',mode:'v2v',operation:'flux-draft-enhance',sourceJobId:'native-draft',settings:{resolution:'1080p'},references:[]});
 assert.equal(request.prompt,'');assert.throws(()=>canonicalOperationSourceDuration(request,[]));
 validateCanonicalGenerationCapabilities(request,candidateFor('flux-3-draft'));
 const body=buildPaidVideoRequestBody({quoteId:'quote',request,engine:candidateFor('flux-3-draft').engine,canonicalPricing:{membershipTier:'member'}});
 assert.equal(body.sourceJobId,'native-draft');assert.equal(body.draft_cache_url,undefined);
 assert.throws(()=>buildFalGenerationRequest(body as never,'wrong'));
 assert.equal(projectAgentModelModeDetails(candidateFor('flux-3-draft'),'v2v').sourceGeneration?.requestField,'sourceJobId');
});

import { inspectOwnedFluxLtxSource } from '../frontend/server/video-excerpts/flux-ltx-source';
import { withVideoExcerptSlot } from '../frontend/server/video-excerpts/media';
test('source inspection rejects busy before reads and qualifies actual compatible MP4 facts without changing original',async()=>{
 let reads=0;
 const facts={kind:'video' as const,width:720,height:1280,durationSec:5.558333,fps:25,hasAudio:true,sizeBytes:26852432,mimeType:'video/mp4',containerFormat:'mov,mp4,m4a,3gp,3g2,mj2',containerMajorBrand:'isom',videoCodec:'h264',audioCodec:'aac'};
 const deps={createReadUrl:async()=>{reads++;return'owned-signed';},download:async()=>({bytes:Buffer.from('original'),mimeType:'video/mp4'}),inspect:async()=>facts};
 await withVideoExcerptSlot('owner',async()=>{await assert.rejects(()=>inspectOwnedFluxLtxSource('owned','flux-fast-edit','owner',deps as any),{code:'RATE_LIMITED',retryable:true});assert.equal(reads,0);});
 assert.equal((await inspectOwnedFluxLtxSource('owned','flux-fast-edit','owner',deps as any)).durationSec,5.558333);
 await assert.rejects(()=>inspectOwnedFluxLtxSource('owned','flux-fast-edit','owner',{...deps,inspect:async()=>({...facts,mimeType:'video/quicktime'})}as any),{code:'REFERENCE_INVALID'});
});

import { prepareGenerationForActor } from '../frontend/src/server/agent-api/prepare-generation';
import { readGenerationPricing } from '../frontend/src/server/agent-api/generation-pricing-read';
import { buildGenerateRequestOptions } from '../frontend/app/api/generate/_lib/request-options';
test('FAST 4096/4097 boundary is enforced before canonical pricing and Site reservation, with final wire defense',async()=>{
 const candidate=candidateFor('flux-3');
 const resolved=[{assetId:'ma_'+'1'.repeat(32),role:'source' as const,mediaKind:'video' as const,storageUrl:'https://media.maxvideoai.com/source.mp4',durationSec:5.558333,width:1280,height:720,sizeBytes:1000,mimeType:'video/mp4'}];
 let prices=0;
 for(const length of [4096,4097]) {
  const prompt='a'.repeat(length),body={engineId:'flux-3',mode:'v2v',operation:'flux-fast-edit',prompt,resolution:'720p',videoUrl:resolved[0].storageUrl};
  const request=normalizeGenerationRequest({surface:'video',engineId:'flux-3',mode:'v2v',operation:'flux-fast-edit',prompt,settings:{resolution:'720p'},references:[{kind:'asset',assetId:resolved[0].assetId,role:'source'}]});
  const actor={authMethod:'studio-session' as const,userId:'owner',projectId:'project',clientId:null};
  const deps={
   listPublicEngines:async()=>[candidate],resolveGenerationReferences:async()=>resolved,
   resolveMembershipPricing:async()=>({tier:'member',source:'app_receipts_rolling_30d',spent30Cents:0,thresholdCents:0,discountPercent:0}),
   priceGeneration:async()=>{prices++;return{priceCents:48,currency:'USD',membershipTier:'member',pricingSnapshot:{totalCents:48,currency:'USD',membershipTier:'member'}};},
  };
  const price=()=>readGenerationPricing(request,actor,deps as never);
  if(length===4096) {await price();assert.doesNotThrow(()=>buildFalGenerationRequest(body,'wrong'));}
  else {
   await assert.rejects(price(),{code:'PARAMETER_INVALID'});
   let writes=0;const forbidden=async()=>{writes++;throw new Error('Cannot write or reserve an invalid request');};
   await assert.rejects(prepareGenerationForActor(request,actor,{...deps,paidGenerationEnabled:()=>true,getAccountRestriction:async()=>null,getWalletSummary:forbidden,withTransaction:forbidden,insertPreparedQuote:forbidden} as never),{code:'PARAMETER_INVALID'});
   assert.equal(writes,0);assert.throws(()=>buildFalGenerationRequest(body,'wrong'),/4096/);}
  assert.equal(buildGenerateRequestOptions({body,engine:candidate.engine,mode:'v2v',isBytePlusV1a:false}).ok,length===4096);
 }
 assert.equal(prices,1,'Invalid FAST instructions cannot read a price or produce an approvable quote');
});
