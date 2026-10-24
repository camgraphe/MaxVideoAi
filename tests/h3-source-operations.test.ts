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
for (const operation of ['h3-recast', 'h3-relight'] as const) {
  for (const storedDimensions of [{ width: null, height: null }, { width: 16, height: 9 }]) {
    test(`${operation} reuses owned videos with missing or stale dimensions from the existing byte probe (${storedDimensions.width})`, async () => {
      const engine = resolveVideoOperationEngine(MINIMAX_H3_MAX_ENGINE, 'v2v', operation);
      const url = 'https://media.example.com/owned.mp4';
      let probes = 0;
      const result = await validateGenerationMediaConstraints({
        engineId: engine.id, mode: 'v2v', userId: 'owner', inputSchema: engine.inputSchema,
        attachments: [{ assetId: 'asset', slotId: 'video_url', kind: 'video', url, name: 'x.mp4', type: 'video/mp4', size: 100, width: 1, height: 1 }],
        referenceMediaItems: [{ fieldId: 'video_url', kind: 'video', url }],
        deps: {
          queryFn: async <T>() => [{ asset_id: 'asset', url, origin_url: null, original_name: 'x.mp4', mime_type: 'video/mp4', size_bytes: 100, duration_sec: 6, ...storedDimensions }] as T[],
          inspectH3SourceFn: async (ownedUrl, actualOperation, owner) => {
            assert.equal(ownedUrl, url); assert.equal(actualOperation, operation); assert.equal(owner, 'owner'); probes++;
            return { kind: 'video', width: 1920, height: 1080, durationSec: 124 / 24, fps: 24, hasAudio: false, sizeBytes: 100, mimeType: 'video/mp4', videoCodec: 'h264', audioCodec: null, decodedFrameCount: 124, constantFrameRate: true, sourceSha256: 'byte-hash' };
          },
        },
      });
      assert.equal(result.ok, true, JSON.stringify(result));
      assert.equal(probes, 1, 'reuse does not require a second download or a metadata write');
      if (result.ok) {
        assert.equal(result.trustedMediaReferences?.[0]?.width, 1920);
        assert.equal(result.trustedMediaReferences?.[0]?.height, 1080);
        assert.equal(result.trustedMediaReferences?.[0]?.durationSec, 124 / 24);
      }
    });
  }
}
import { validateProviderSpecificConstraints } from '../frontend/src/server/video-generation/execution-constraints';
test('invalid measured source dimensions cannot fall back to stored or caller claims', async () => {
  const engine = resolveVideoOperationEngine(MINIMAX_H3_MAX_ENGINE, 'v2v', 'h3-recast');
  const url = 'https://media.example.com/owned.mp4';
  const result = await validateGenerationMediaConstraints({
    engineId: engine.id, mode: 'v2v', userId: 'owner', inputSchema: engine.inputSchema,
    attachments: [{ assetId: 'asset', slotId: 'video_url', kind: 'video', url, name: 'x.mp4', type: 'video/mp4', size: 100, width: 1920, height: 1080 }],
    referenceMediaItems: [{ fieldId: 'video_url', kind: 'video', url }],
    deps: {
      queryFn: async <T>() => [{ asset_id: 'asset', url, original_name: 'x.mp4', mime_type: 'video/mp4', size_bytes: 100, width: 1920, height: 1080 }] as T[],
      inspectH3SourceFn: async () => ({ kind: 'video', width: 0, height: 0, durationSec: 6, fps: 24, hasAudio: false, sizeBytes: 100, mimeType: 'video/mp4', videoCodec: 'h264', audioCodec: null, sourceSha256: 'byte-hash' }),
    },
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.body.error, 'MEDIA_DIMENSIONS_UNVERIFIED');
});

import { resolveMediaAwarePreflight } from '../frontend/app/api/preflight/_lib/media-aware-preflight';
test('a stale H3 form without an explicit action gets actionable guidance without a quote or inferred operation', async () => {
  let quoted = false;
  const response = await resolveMediaAwarePreflight({ userId: 'owner', request: {
    engine: 'minimax-h3-max', mode: 'v2v', durationSec: 6, resolution: '768P', user: { memberTier: 'Member' },
  } }, {
    getConfiguredEngineFn: async () => MINIMAX_H3_MAX_ENGINE,
    computeConfiguredPreflightFn: async () => { quoted = true; throw new Error('Missing operation must not quote'); },
  });
  assert.equal(response.ok, false);
  assert.equal(response.error?.code, 'OPERATION_INVALID');
  assert.match(response.error?.message ?? '', /Choose Replace characters or Change lighting/);
  assert.match(response.error?.message ?? '', /save your prompt and reload/);
  assert.equal(quoted, false);
});
test('H3 reused source with missing stored dimensions reaches quote using the existing measured duration', async () => {
  const url = 'https://media.example.com/owned.mp4';
  let quotes = 0;
  const response = await resolveMediaAwarePreflight({ userId: 'owner', request: {
    engine: 'minimax-h3-max', mode: 'v2v', operation: 'h3-recast', durationSec: 30, resolution: '768P',
    inputs: [{ assetId: 'asset', slotId: 'video_url', kind: 'video', url }], user: { memberTier: 'Member' },
  } }, {
    getConfiguredEngineFn: async () => MINIMAX_H3_MAX_ENGINE,
    computeConfiguredPreflightFn: async request => {
      quotes++; assert.equal(request.durationSec, 5.558333); assert.equal(request.operation, 'h3-recast');
      return { ok: true, total: 125 };
    },
    mediaConstraintDeps: {
      queryFn: async <T>() => [{ asset_id: 'asset', url, original_name: 'x.mp4', mime_type: 'video/mp4', size_bytes: 100, duration_sec: null, width: null, height: null }] as T[],
      inspectH3SourceFn: async () => ({ kind: 'video', width: 1920, height: 1080, durationSec: 5.558333, fps: 30, hasAudio: false, sizeBytes: 100, mimeType: 'video/mp4', videoCodec: 'h264', audioCodec: null, sourceSha256: 'byte-hash' }),
    },
  });
  assert.equal(response.ok, true, JSON.stringify(response)); assert.equal(response.total, 125); assert.equal(quotes, 1);
});
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

test('explicit H3 order survives canonical ingress and validates modalities only after ownership resolution',async()=>{
 const refs=[2,1,3,4].map(n=>({kind:'asset' as const,assetId:`ma_${String(n).padStart(32,'0')}`,role:'reference' as const}));
 const input={surface:'video',engineId:'minimax-h3-max',mode:'ref2v',prompt:'Follow these references',settings:{durationSec:5,resolution:'768P',aspectRatio:'auto',referenceOrder:'video1,image1,audio1,image2'},references:refs};
 const request=normalizeGenerationRequest(input);
 assert.deepEqual(request.references.map(r=>r.kind==='asset'?r.assetId:''),refs.map(r=>r.assetId));
 assert.deepEqual(normalizeGenerationRequest({...input,references:refs.map((r,slot)=>({...r,slot}))}),request);
 const candidate={engine:MINIMAX_H3_MAX_ENGINE,surface:'video' as const,publicModes:['ref2v' as const],modeCaps:MINIMAX_H3_MAX_ENGINE.modeCaps!};
 validateCanonicalGenerationCapabilities(request,candidate);
 const resolved=refs.map((ref,index)=>({...ref,slot:index,mediaKind: index<2?'image' as const:index===2?'video' as const:'audio' as const,storageUrl:`https://media.maxvideoai.com/${index}`,width:512,height:512,durationSec:index<2?null:5,mimeType:index<2?'image/png':index===2?'video/mp4':'audio/mpeg',originalName:index<2?'image.png':index===2?'video.mp4':'sound.mp3',sizeBytes:1000}));
 validateCanonicalGenerationCapabilities(request,candidate,{resolvedReferences:resolved});
 const body=buildPaidVideoRequestBody({quoteId:'q',request,engine:candidate.engine,resolvedReferences:resolved,canonicalPricing:{membershipTier:'member'}});
 assert.deepEqual(buildMinimaxH3MaxFalRequestFromPayload(body as never).requestBody.reference_conditions,[2,0,3,1].map(i=>({type:resolved[i].mediaKind,url:resolved[i].storageUrl})));
 assert.throws(()=>validateCanonicalGenerationCapabilities({...request,settings:{...request.settings,referenceOrder:'image1,image2,image3,image4'}},candidate,{resolvedReferences:resolved}));
 const {readGenerationPricing}=await import('../frontend/src/server/agent-api/generation-pricing-read');
 const {resolveGenerationReferencesForActor}=await import('../frontend/src/server/agent-api/resolve-generation-references');
 const result=await readGenerationPricing(request,{authMethod:'oauth',userId:'owner',clientId:'client',emailVerified:true},{
  listPublicEngines:async()=>[candidate],resolveGenerationReferences:(current,actor)=>resolveGenerationReferencesForActor(current,actor,{resolveOwnedReferenceAsset:async(_actor,id)=>resolved.find(ref=>ref.assetId===id)!}),
  resolveMembershipPricing:async()=>({tier:'member',source:'app_receipts_rolling_30d',spent30Cents:0,thresholdCents:0,discountPercent:0}),
  priceGeneration:async()=>({priceCents:48,currency:'USD',membershipTier:'member',pricingSnapshot:{totalCents:48,currency:'USD',membershipTier:'member'}}),
 });
 assert.equal(result.pricing.priceCents,48);
 const omitted={...input,settings:{durationSec:5,resolution:'768P'}};
 assert.deepEqual(normalizeGenerationRequest(omitted),normalizeGenerationRequest({...omitted,references:[...refs].reverse()}));
});

import {studioMediaIntentSchema} from '../frontend/lib/studio/conversation-media-contract';
import {studioActionRequestSchema} from '../frontend/lib/studio/conversation-action-contract';
test('Studio accepts empty/omitted source-operation prompts but preserves creation prompt validation',()=>{
 const action={action:'video.prepare',reply:'Review',modelId:'minimax-h3-max',mode:'v2v',operation:'h3-relight',aspectRatio:'auto',source:null};
 for(const schema of [studioMediaIntentSchema,studioActionRequestSchema]) {
  for(const prompt of ['',undefined]) assert.equal(schema.safeParse({...action,prompt}).success,true);
  assert.equal(schema.safeParse({...action,prompt:'change lighting'}).success,false);
  assert.equal(schema.safeParse({...action,operation:'h3-recast'}).success,true);
  assert.equal(schema.safeParse({...action,operation:undefined,mode:'t2v',prompt:''}).success,false);
 }
});

import {withVideoExcerptSlot} from '../frontend/server/video-excerpts/media';
import {resolveGenerationReferencesForActor} from '../frontend/src/server/agent-api/resolve-generation-references';
import {createPreflightPostHandler} from '../frontend/app/api/preflight/_lib/preflight-handler';
import {NextRequest} from 'next/server';
test('canonical and web source inspection propagate retryable admission before any source I/O',async()=>{
 const engine=resolveVideoOperationEngine(MINIMAX_H3_MAX_ENGINE,'v2v','h3-recast');
 const url='https://media.maxvideoai.com/source.mp4';
 await withVideoExcerptSlot('busy-owner',async()=>{
  const request=normalizeGenerationRequest({surface:'video',engineId:engine.id,mode:'v2v',operation:'h3-recast',settings:{resolution:'768P'},references:[{kind:'asset',assetId:'ma_00000000000000000000000000000001',role:'source'}]});
  await assert.rejects(resolveGenerationReferencesForActor(request,{authMethod:'studio-session',userId:'busy-owner',projectId:'project',clientId:null},{resolveOwnedReferenceAsset:async()=>({assetId:'ma_00000000000000000000000000000001',mediaKind:'video',storageUrl:url,mimeType:'video/mp4',width:512,height:512,durationSec:5})}),error=>Boolean(error&&typeof error==='object'&&'code' in error&&error.code==='RATE_LIMITED'&&'retryable' in error&&error.retryable));
  const result=await validateGenerationMediaConstraints({engineId:engine.id,mode:'v2v',userId:'busy-owner',inputSchema:engine.inputSchema,attachments:[{assetId:'asset',slotId:'video_url',kind:'video',url,name:'source.mp4',type:'video/mp4',size:100}],referenceMediaItems:[{fieldId:'video_url',kind:'video',url}],deps:{queryFn:async<T>()=>[{asset_id:'asset',url,origin_url:null,original_name:'source.mp4',mime_type:'video/mp4',size_bytes:100,duration_sec:5,width:512,height:512}] as T[]}});
  assert.equal(result.ok,false);if(!result.ok){assert.equal(result.status,429);assert.equal(result.body.retryable,true);}
 });
 const handler=createPreflightPostHandler({resolveMediaAwarePreflightFn:async()=>({ok:false,error:{code:'RATE_LIMITED',message:'Retry shortly.'}})});
 const response=await handler(new NextRequest('https://maxvideoai.com/api/preflight',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({engine:'grok-imagine-video-1-5',mode:'t2v',durationSec:6,resolution:'720p',aspectRatio:'16:9',fps:24,user:{memberTier:'Member'}})}));
 assert.equal(response.status,429);
});
