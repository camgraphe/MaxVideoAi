import assert from 'node:assert/strict';
import test from 'node:test';
import { buildH3SourceRequest, validateH3Source, h3OperationRate, planH3RelightCopy } from '../frontend/lib/h3-source-operations';
import { normalizeVideoOperation, videoOperationEndpoint } from '../frontend/lib/video-operation';

test('only approved H3 source operations route; pending modes reject', () => {
 for (const operation of ['h3-recast','h3-relight']) assert.equal(videoOperationEndpoint('minimax-h3-max','v2v',operation), `minimax/h3-max/${operation.slice(3)}`);
 for (const operation of ['h3-extend','h3-insert','h3-reframe']) assert.throws(() => normalizeVideoOperation('minimax-h3-max','v2v',operation));
 assert.throws(() => normalizeVideoOperation('minimax-h3','v2v','h3-recast'));
});
test('Recast retains portrait order including repeated identities, optional prompt and 30s domain', () => {
 assert.equal(validateH3Source('h3-recast',{durationSec:30}), undefined);
 assert.match(validateH3Source('h3-recast',{durationSec:30.01})!, /5–30/);
 const request=buildH3SourceRequest({operation:'h3-recast',videoUrl:'source',portraitUrls:['b','a','b'],resolution:'768P',enhanceRealism:true});
 assert.deepEqual(request,{video_url:'source',reference_image_urls:['b','a','b'],resolution:'768P',enhance_realism:true,enable_safety_checker:true});
 assert.throws(()=>buildH3SourceRequest({operation:'h3-recast',videoUrl:'source',portraitUrls:[]}));
});
test('Relight rejects rounded or caller-inferred frames and accepts decoded CFR facts', () => {
 assert.match(validateH3Source('h3-relight',{durationSec:5.558333,fps:25,decodedFrameCount:139,constantFrameRate:true})!, /24/);
 assert.ok(validateH3Source('h3-relight',{durationSec:5,fps:24}));
 assert.ok(validateH3Source('h3-relight',{durationSec:124/24,fps:24,decodedFrameCount:124,constantFrameRate:false}));
 assert.equal(validateH3Source('h3-relight',{durationSec:2.333333,fps:24,decodedFrameCount:56,constantFrameRate:true}),undefined);
 assert.equal(validateH3Source('h3-relight',{durationSec:124/24,fps:24,decodedFrameCount:124,constantFrameRate:true}),undefined);
 assert.ok(validateH3Source('h3-relight',{durationSec:5,fps:24,decodedFrameCount:120,constantFrameRate:true}));
 assert.throws(()=>buildH3SourceRequest({operation:'h3-relight',videoUrl:'source',lightingImageUrl:'sphere',prompt:'edit'}));
 assert.deepEqual(buildH3SourceRequest({operation:'h3-relight',videoUrl:'source',lightingImageUrl:'sphere',aspectRatio:'auto'}),{video_url:'source',reference_image_url:'sphere',resolution:'768P',aspect_ratio:'adaptive',enable_safety_checker:true});
});
test('compatible copy explicitly reports actual shortened timing and supplier references are operation scoped',()=>{
 assert.deepEqual(planH3RelightCopy(5.558333),{fps:24,frameCount:124,durationSec:124/24,removedEndSec:5.558333-124/24});
 assert.throws(()=>planH3RelightCopy(2));
 assert.equal(h3OperationRate('h3-recast','1080P'),45);
 assert.equal(h3OperationRate('h3-relight','2K'),32);
 assert.throws(()=>h3OperationRate('h3-recast','480P'));
});

import { normalizeGenerationRequest } from '../frontend/src/server/agent-api/generation-normalization';
import { MINIMAX_H3_MAX_ENGINE } from '../frontend/src/config/fal-engines/minimax-h3-max';
import { resolveVideoOperationEngine } from '../frontend/lib/video-operation';
import { buildMinimaxH3MaxFalRequestFromPayload } from '../frontend/src/lib/minimax-h3-max';
import { buildBillingPricingFacts } from '../frontend/src/lib/pricing-billing-facts';
import { buildManualTariffScenario, continuousInputTariffSelector } from '../frontend/src/lib/pricing-manual-scenario';
import { canonicalOperationSourceDuration } from '../frontend/src/server/agent-api/generation-operation-facts';
test('canonical H3 source requests permit optional/absent prompts and require authoritative exact source facts',()=>{
 const request=normalizeGenerationRequest({surface:'video',engineId:'minimax-h3-max',mode:'v2v',operation:'h3-relight',prompt:'',settings:{resolution:'768P'},references:[{kind:'asset',assetId:'ma_0123456789abcdef0123456789abcdef',role:'source'}]});
 const ref={assetId:request.references[0]!.kind==='asset'?request.references[0]!.assetId:'',role:'source' as const,mediaKind:'video' as const,storageUrl:'https://example.com/owned.mp4',width:100,height:100,durationSec:124/24,mimeType:'video/mp4',fps:24,decodedFrameCount:124,constantFrameRate:true};
 assert.equal(canonicalOperationSourceDuration(request,[ref]),124/24);
 assert.throws(()=>canonicalOperationSourceDuration(request,[{...ref,decodedFrameCount:undefined}]));
 assert.throws(()=>normalizeGenerationRequest({...request,prompt:'change it'}));
 assert.equal(normalizeGenerationRequest({...request,prompt:undefined}).prompt,'');
});
test('H3 pricing has its own exact selector and no reference token surcharge or Kling alias',()=>{
 for (const operation of ['h3-recast','h3-relight'] as const) {
  const engine=resolveVideoOperationEngine(MINIMAX_H3_MAX_ENGINE,'v2v',operation);
  const context={engine,mode:'v2v' as const,operation,durationSec:5.558333,resolution:'1080P'};
  const built=buildBillingPricingFacts(context,engine.pricingDetails,'USD');
  const scenario=buildManualTariffScenario(context,built.facts);
  assert.equal(scenario.selector.operation,operation);
  assert.equal(scenario.quantities.input_video_seconds,5.558333);
  assert.equal(continuousInputTariffSelector(scenario.selector)?.durationSec,'continuous');
  assert.equal(built.facts.vendorSubtotalExactCents,5.558333*(operation==='h3-recast'?45:16));
  assert.equal(scenario.selector.referenceTokenBudget,undefined);
 }
});
test('provider payload sends source operation fields without duration or generated audio',()=>{
 const result=buildMinimaxH3MaxFalRequestFromPayload({engineId:'minimax-h3-max',mode:'v2v',operation:'h3-relight',prompt:'',resolution:'2K',inputs:[{kind:'video',slotId:'video_url',url:'source'},{kind:'image',slotId:'reference_image_url',url:'sphere'}]});
 assert.equal(result.model,'minimax/h3-max/relight');assert.equal(result.requestBody.reference_image_url,'sphere');assert.equal(result.requestBody.duration,undefined);assert.equal(result.requestBody.prompt,undefined);
});

import { validateGenerationMediaConstraints } from '../frontend/app/api/generate/_lib/generation-media-constraints';
test('media admission probes only exact owned source bytes and never trusts caller frame metadata',async()=>{
 const engine=resolveVideoOperationEngine(MINIMAX_H3_MAX_ENGINE,'v2v','h3-relight');
 const url='https://media.example.com/owned.mp4';let probes=0;
 const input={engineId:engine.id,mode:'v2v' as const,userId:'owner',inputSchema:engine.inputSchema,attachments:[{assetId:'asset',slotId:'video_url',kind:'video' as const,url,name:'x.mp4',type:'video/mp4',size:100,durationSec:5}],referenceMediaItems:[{fieldId:'video_url',kind:'video' as const,url}]};
 const rows=[{asset_id:'asset',url,origin_url:null,original_name:'x.mp4',mime_type:'video/mp4',size_bytes:100,duration_sec:5,width:100,height:100}];
 const probe=async()=>{probes++;return {kind:'video' as const,width:100,height:100,durationSec:124/24,fps:24,hasAudio:false,sizeBytes:100,mimeType:'video/mp4',videoCodec:'h264',audioCodec:null,decodedFrameCount:124,constantFrameRate:true,sourceSha256:'byte-hash'};};
 const accepted=await validateGenerationMediaConstraints({...input,deps:{queryFn:async<T>()=>rows as T[],inspectH3SourceFn:probe}});
 assert.equal(accepted.ok,true);if(accepted.ok){assert.equal(accepted.trustedDurationSecByField?.video_url?.[0],124/24);assert.equal(accepted.trustedMediaReferences?.[0]?.decodedFrameCount,124);}
 const denied=await validateGenerationMediaConstraints({...input,deps:{queryFn:async()=>[],inspectH3SourceFn:probe}});
 assert.equal(denied.ok,false);assert.equal(probes,1);
 const alias=await validateGenerationMediaConstraints({...input,deps:{queryFn:async<T>()=>[{...rows[0],url:'https://media.example.com/other.mp4',origin_url:url}] as T[],inspectH3SourceFn:probe}});
 assert.equal(alias.ok,false);assert.equal(probes,1);
});

import { buildMinimaxH3MaxFalRequest } from '../frontend/src/lib/minimax-h3-max';
import { validateProviderSpecificConstraints } from '../frontend/src/server/video-generation/execution-constraints';
test('reference keyframes and complete cross-modality order reach the exact mutually exclusive provider shape',()=>{
 const input={mode:'ref2v' as const,prompt:'Follow the reference sequence',durationSec:5,resolution:'768P',imageUrl:'start',endImageUrl:'end',middleImageUrl:'middle',middleFrameTime:2.5,referenceImageUrls:['image'],referenceVideoUrls:['video'],referenceAudioUrls:['audio'],referenceOrder:'video1,image1,audio1'};
 const {requestBody}=buildMinimaxH3MaxFalRequest(input);
 assert.equal(requestBody.image_url,'start');assert.equal(requestBody.end_image_url,'end');assert.equal(requestBody.middle_image_url,'middle');assert.equal(requestBody.middle_frame_time,2.5);
 assert.deepEqual(requestBody.reference_conditions,[{type:'video',url:'video'},{type:'image',url:'image'},{type:'audio',url:'audio'}]);
 assert.equal(requestBody.reference_image_urls,undefined);assert.equal(requestBody.reference_video_urls,undefined);assert.equal(requestBody.reference_audio_urls,undefined);
 for (const override of [{resolution:'1080P'},{middleFrameTime:0.001},{middleFrameTime:5},{imageUrl:undefined},{referenceOrder:'image1,image1,audio1'}]) assert.throws(()=>buildMinimaxH3MaxFalRequest({...input,...override}));
 const invalid=validateProviderSpecificConstraints({engineId:'minimax-h3-max',normalizedMode:'ref2v',payload:{...requestBody,resolution:'1080P'}});
 assert.equal(invalid.ok,false);
});

import { validateCanonicalGenerationCapabilities } from '../frontend/src/server/agent-api/generation-capability-validation';
import { buildPaidVideoRequestBody } from '../frontend/src/server/agent-api/paid-video-request-body';
test('canonical references survive capability validation and paid-body materialization with middle-frame controls',()=>{
 const roles=['first_frame','middle_frame','last_frame','reference'] as const;
 const refs=roles.map((role,index)=>({kind:'asset' as const,assetId:`ma_${String(index+1).padStart(32,'0')}`,role}));
 const request=normalizeGenerationRequest({surface:'video',engineId:'minimax-h3-max',mode:'ref2v',prompt:'Animate the subject',settings:{durationSec:5,resolution:'768P',aspectRatio:'auto',middleFrameTime:2.5,referenceOrder:'image1'},references:refs});
 const resolved=refs.map((ref,index)=>({assetId:ref.assetId,role:ref.role,slot:request.references.find(r=>r.kind==='asset'&&r.assetId===ref.assetId)?.slot,mediaKind:'image' as const,storageUrl:`https://media.maxvideoai.com/${index}.png`,width:512,height:512,durationSec:null,mimeType:'image/png',sizeBytes:1000}));
 const engine=MINIMAX_H3_MAX_ENGINE;
 validateCanonicalGenerationCapabilities(request,{engine,surface:'video',publicModes:['ref2v'],modeCaps:engine.modeCaps!},{resolvedReferences:resolved});
 const body=buildPaidVideoRequestBody({quoteId:'quote',request,engine,resolvedReferences:resolved,canonicalPricing:{membershipTier:'member'}});
 const provider=buildMinimaxH3MaxFalRequestFromPayload(body as never);
 assert.equal(provider.requestBody.middle_image_url,resolved[1]!.storageUrl);
 assert.deepEqual(provider.requestBody.reference_conditions,[{type:'image',url:resolved[3]!.storageUrl}]);
});
test('canonical Relight source and lighting sphere reach paid adapter without a prompt',()=>{
 const refs=[{kind:'asset' as const,assetId:'ma_00000000000000000000000000000001',role:'source' as const},{kind:'asset' as const,assetId:'ma_00000000000000000000000000000002',role:'reference' as const}];
 const request=normalizeGenerationRequest({surface:'video',engineId:'minimax-h3-max',mode:'v2v',operation:'h3-relight',prompt:'',settings:{resolution:'768P',aspectRatio:'auto'},references:refs});
 const resolved=refs.map((ref,index)=>({assetId:ref.assetId,role:ref.role,slot:request.references.find(r=>r.kind==='asset'&&r.assetId===ref.assetId)?.slot,mediaKind:index===0?'video' as const:'image' as const,storageUrl:`https://media.maxvideoai.com/${index}`,width:512,height:512,durationSec:index===0?124/24:null,mimeType:index===0?'video/mp4':'image/png',sizeBytes:1000,fps:24,decodedFrameCount:124,constantFrameRate:true}));
 const engine=resolveVideoOperationEngine(MINIMAX_H3_MAX_ENGINE,'v2v','h3-relight');
 validateCanonicalGenerationCapabilities(request,{engine,surface:'video',publicModes:['v2v'],modeCaps:engine.modeCaps!},{resolvedReferences:resolved});
 const body=buildPaidVideoRequestBody({quoteId:'quote',request,engine,resolvedReferences:resolved,canonicalPricing:{membershipTier:'member'}});
 const provider=buildMinimaxH3MaxFalRequestFromPayload(body as never);
 assert.equal(provider.requestBody.reference_image_url,resolved[1]!.storageUrl);
 assert.equal(provider.requestBody.prompt,undefined);
});
