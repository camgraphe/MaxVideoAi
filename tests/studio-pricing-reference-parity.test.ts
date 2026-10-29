import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {getFalEngineById} from '../frontend/src/config/falEngines';
import {createStudioVideoGenerationService} from '../frontend/src/server/studio/image-generation-service';
import {validateStudioMediaRequest,type StudioMediaFactories} from '../frontend/src/server/studio/conversation-media-generation';
import {buildPaidVideoRequestBody} from '../frontend/src/server/agent-api/paid-video-request-body';
import {normalizeGenerationRequest,stableJson} from '../frontend/src/server/agent-api/generation-normalization';
import {GenerationCapabilityError,validateCanonicalGenerationCapabilities} from '../frontend/src/server/agent-api/generation-capability-validation';
import {compareGenerationPrices,generationComparisonCatalogFingerprint} from '../frontend/src/server/agent-api/generation-price-comparison';
import {AgentApiError,toAgentApiFailure} from '../frontend/src/server/agent-api/errors';
import {studioComparisonFailureGuidance} from '../frontend/src/server/studio/conversation-comparison-failure';
import type {CanonicalGenerationRequest} from '../frontend/src/server/agent-api/generation-types';
import type {ResolvedReference} from '../frontend/src/server/agent-api/reference-types';
import type {StudioResolvedMedia} from '../frontend/src/server/studio/media-resolver';

const actor={authMethod:'studio-session' as const,userId:'owner',projectId:'project',clientId:null};
const membership={tier:'member' as const,source:'app_receipts_rolling_30d' as const,spent30Cents:0,thresholdCents:0,discountPercent:0};
const entry=getFalEngineById('seedance-2-5')!;
const candidate={engine:entry.engine,surface:'video' as const,publicModes:entry.engine.modes,modeCaps:Object.fromEntries(entry.modes.map(mode=>[mode.mode,mode.ui]))};
const assets=['ma_'+'a'.repeat(32),'ma_'+'b'.repeat(32)];
const owned:ResolvedReference[]=assets.map((assetId,index)=>({assetId,role:index===0?'source':'reference',mediaKind:'video',
  storageUrl:`https://cdn.maxvideoai.com/owned-${index}.mp4`,mimeType:'video/mp4',originalName:`clip-${index}.mp4`,
  width:720,height:1280,durationSec:index===0?5.12:4.09,sizeBytes:10000}));
const scenario={surface:'video' as const,engineId:entry.id,mode:'v2v' as const,prompt:'Create a transition between the two scenes.',
  settings:{durationSec:5,aspectRatio:'9:16'},references:owned.map(reference=>({kind:'asset' as const,assetId:reference.assetId,role:reference.role})),outputCount:1};
const resolveReferences=async(request:CanonicalGenerationRequest)=>request.references.map(reference=>{
  assert.equal(reference.kind,'asset');
  const facts=owned.find(item=>reference.kind==='asset'&&item.assetId===reference.assetId)!;
  return {...facts,role:reference.role,...(reference.slot===undefined?{}:{slot:reference.slot})};
});

test('Studio prices a five-second portrait Modify with an owned source and supplementary video',async()=>{
  let priceReads=0;
  const service=createStudioVideoGenerationService(actor,{enabled:true,prepareDependencies:{
    listPublicEngines:async()=>[candidate],resolveMembershipPricing:async()=>membership,
    resolveRequestExecutability:()=>({executable:true,reason:'available'}),
    priceGeneration:async(_request,tier,context)=>{
      priceReads++;
      assert.deepEqual(context.resolvedReferences?.map(reference=>[reference.assetId,reference.role,reference.durationSec]),
        [[assets[0],'source',5.12],[assets[1],'reference',4.09]]);
      return {priceCents:123,currency:'USD',membershipTier:tier,pricingSnapshot:{totalCents:123,currency:'USD',membershipTier:tier}};
    },
    getWalletSummary:async()=>{throw new Error('A comparison must not read the wallet.');},
    withTransaction:async()=>{throw new Error('A comparison must not create a quote.');},
  }});
  const compared=await service.compare({...scenario,candidateModelIds:[entry.id]},resolveReferences);
  assert.equal(compared.options.length,1);
  assert.deepEqual(compared.options[0].price,{amountCents:123,currency:'USD',formattedAmount:'$1.23'});
  assert.equal(compared.options[0].settings.durationSec,5);
  assert.equal(compared.options[0].settings.aspectRatio,'9:16');
  assert.equal(compared.options[0].referenceCount,2);
  assert.equal(compared.options[0].quoteRequired,true);
  const estimate=await service.estimate({...scenario,settings:{...scenario.settings,resolution:'480p',audio:true}},resolveReferences);
  assert.equal(estimate.price.amountCents,123);
  assert.equal(priceReads,2);
  assert.doesNotMatch(JSON.stringify(compared),/storageUrl|owned-\d|clip-\d|quoteId/);
});

test('Studio prepares both owned video roles and the paid body retains the original source and supplementary clip',async()=>{
  const factories={video:()=>({catalog:async()=>[candidate]})} as unknown as StudioMediaFactories;
  const attachments=assets.map(assetId=>({type:'asset' as const,assetId,kind:'video' as const}));
  const selected=await validateStudioMediaRequest(actor,{action:'video.prepare',reply:'Review the quote.',modelId:entry.id,mode:'v2v',
    prompt:scenario.prompt,aspectRatio:'9:16',settings:[{name:'durationSec',value:5}],source:null,
    references:attachments.map((ref,index)=>({ref,role:index===0?'source':'reference',slot:null})),outputCount:1},
  {requestId:'123e4567-e89b-42d3-a456-426614174000',message:'Make this transition.',references:[],attachments},factories,true,{
    resolveMedia:async(_userId,raw)=>{
      const ref=raw as typeof attachments[number],facts=owned.find(reference=>reference.assetId===ref.assetId)!;
      return {id:ref.assetId,ref,kind:'video',url:facts.storageUrl,mime:facts.mimeType,thumbUrl:null,previewUrl:null,
        mediaFacts:{source:'probe',durationSec:facts.durationSec!,width:720,height:1280,hasAudio:true},originalAccess:{type:'external'},
        originalName:facts.originalName,durationSec:facts.durationSec,width:720,height:1280,sizeBytes:10000} as StudioResolvedMedia;
    },
    saveOutput:async()=>{throw new Error('Owned assets must not be copied.');},
  });
  const request=await selected.materialize();
  assert.equal(request.mode,'v2v');
  assert.deepEqual(request.references.map(reference=>[reference.kind==='asset'?reference.assetId:null,reference.role]),
    [[assets[0],'source'],[assets[1],'reference']]);
  const body=buildPaidVideoRequestBody({quoteId:'exact-reviewed-quote',request,engine:entry.engine,
    resolvedReferences:await resolveReferences(request),canonicalPricing:{membershipTier:'member'}}) as {
      videoUrl:string;referenceVideos:string[];inputs:{assetId:string;slotId:string;durationSec:number}[];
    };
  assert.equal(body.videoUrl,'https://cdn.maxvideoai.com/owned-0.mp4');
  assert.deepEqual(body.referenceVideos,['https://cdn.maxvideoai.com/owned-1.mp4']);
  assert.deepEqual(body.inputs.map(reference=>[reference.assetId,reference.slotId,reference.durationSec]),
    [[assets[0],'video_url',5.12],[assets[1],'video_urls',4.09]]);
});

test('supplementary Modify videos still require the selected model field and measured aggregate limits',async()=>{
  const request=normalizeGenerationRequest({...scenario,settings:{...scenario.settings,resolution:'480p',audio:true}});
  const resolved=await resolveReferences(request);
  assert.doesNotThrow(()=>validateCanonicalGenerationCapabilities(request,candidate,{resolvedReferences:resolved}));
  const withoutVideos={...candidate,engine:{...candidate.engine,inputSchema:{...candidate.engine.inputSchema,
    optional:candidate.engine.inputSchema!.optional!.filter(field=>field.id!=='video_urls')}}};
  assert.throws(()=>validateCanonicalGenerationCapabilities(request,withoutVideos,{resolvedReferences:resolved}));
  assert.throws(()=>buildPaidVideoRequestBody({quoteId:'quote',request,engine:withoutVideos.engine,resolvedReferences:resolved,canonicalPricing:{membershipTier:'member'}}));
  assert.throws(()=>validateCanonicalGenerationCapabilities(request,candidate,{resolvedReferences:resolved.map(reference=>({...reference,durationSec:20}))}));
  assert.throws(()=>validateCanonicalGenerationCapabilities(request,candidate,{resolvedReferences:resolved.map(reference=>({...reference,durationSec:null}))}));
  const excessive=Array.from({length:11},(_,index)=>({kind:'asset' as const,assetId:`clip-${index}`,role:index===0?'source' as const:'reference' as const}));
  const overLimit=normalizeGenerationRequest({...scenario,references:excessive,settings:{...scenario.settings,resolution:'480p'}});
  assert.throws(()=>validateCanonicalGenerationCapabilities(overLimit,candidate,{resolvedReferences:overLimit.references.map((reference,index)=>({
    ...owned[index===0?0:1],assetId:reference.kind==='asset'?reference.assetId:'',role:reference.role,slot:reference.slot,durationSec:1,
    storageUrl:`https://cdn.maxvideoai.com/clip-${index}.mp4`,
  }))}));
});

test('legacy failed comparisons are revalidated after the canonical video reference contract changes',()=>{
  // This is the previously persisted catalog-only receipt identity, before the
  // validator and paid-body mapping supported supplementary Modify videos.
  const legacy=createHash('sha256').update(stableJson(JSON.parse(JSON.stringify({surface:'video',mode:'v2v',models:[{
    modelId:entry.id,engine:candidate.engine,modeCaps:candidate.modeCaps,publicModes:candidate.publicModes,
  }]})))).digest('hex');
  const current=generationComparisonCatalogFingerprint({...scenario,candidateModelIds:[entry.id]},[candidate]);
  assert.notEqual(current,legacy,'Old validation failures must not suppress a repaired comparison.');
  assert.equal(current,generationComparisonCatalogFingerprint({...scenario,candidateModelIds:[entry.id]},[candidate]));
});

test('unverified reference comparisons return a bounded actionable reason without media identities or exception text',async()=>{
  const models=Array.from({length:10},(_,index)=>({...candidate,engine:{...candidate.engine,id:`model-${index}`}}));
  const failed={...scenario,candidateModelIds:models.map(model=>model.engine.id)};
  await assert.rejects(compareGenerationPrices(failed,actor,{
    listPublicEngines:async()=>models,resolveGenerationReferences:async request=>(await resolveReferences(request)).map(reference=>({...reference,durationSec:null})),
    resolveMembershipPricing:async()=>membership,priceGeneration:async()=>{throw new Error('Unverified inputs must not reach pricing.');},
  }),error=>{
    assert.ok(error instanceof AgentApiError);
    const facts=error.nextAction as {validationFailures:{modelId:string;code:string;field:string;reason:string}[];validationFailuresTruncated:boolean};
    assert.ok(Array.isArray(facts.validationFailures),'Comparison must expose fixed validation facts.');
    assert.equal(facts.validationFailures.length,8);
    assert.equal(facts.validationFailuresTruncated,true);
    assert.deepEqual(facts.validationFailures[0],{modelId:'model-0',code:'REFERENCE_INVALID',field:'references',reason:'duration_unverified'});
    assert.doesNotMatch(JSON.stringify(facts),/ma_[a-f0-9]{32}|owned-\d|clip-\d|storageUrl|canonical generation request/);
    const request={...failed,action:'pricing.compare',settings:[{name:'durationSec',value:5}],baselineModelId:null,baselineSettings:null,
      references:assets.map(assetId=>({ref:{type:'asset',assetId,kind:'video'},role:'reference',slot:null}))} as never;
    const guidance=studioComparisonFailureGuidance(request,{...toAgentApiFailure(error),action:'pricing.compare'},'en');
    assert.match(guidance,/duration.*verif|verif.*duration/i);
    assert.doesNotMatch(guidance,/which matters most|source, duration or framing/);
    return true;
  });
});

test('comparison diagnostics never expose unknown validation field names or upstream private errors',async()=>{
  const imageEntry=getFalEngineById('gpt-image-2')!;
  const image={engine:imageEntry.engine,surface:'image' as const,publicModes:imageEntry.engine.modes,modeCaps:Object.fromEntries(imageEntry.modes.map(mode=>[mode.mode,mode.ui]))};
  const input={surface:'image' as const,mode:'t2i' as const,prompt:'SECRET prompt',settings:{resolution:'custom',imageWidth:1024,imageHeight:1080,quality:'high'},references:[],candidateModelIds:[imageEntry.id]};
  await assert.rejects(compareGenerationPrices(input,actor,{listPublicEngines:async()=>[image],
    resolveMembershipPricing:async()=>membership,priceGeneration:async()=>{throw new Error('No pricing after invalid validation.');}}),error=>{
    assert.ok(error instanceof AgentApiError);
    assert.deepEqual(error.nextAction?.validationFailures,[{modelId:imageEntry.id,code:'PARAMETER_INVALID',field:'settings',reason:'parameter_invalid'}]);
    assert.doesNotMatch(JSON.stringify(error.nextAction),/SECRET|image_height|private\.test|https:/);
    return true;
  });
  const fault=new GenerationCapabilityError('providerKey.SECRET');
  fault.message='SECRET prompt https://private.test/secret';
  await assert.rejects(compareGenerationPrices({...scenario,candidateModelIds:[entry.id]},actor,{
    listPublicEngines:async()=>[candidate],resolveGenerationReferences:resolveReferences,resolveMembershipPricing:async()=>membership,
    priceGeneration:async()=>{throw fault;},
  }),error=>{
    assert.ok(error instanceof AgentApiError);
    assert.equal(error.nextAction?.constraintMismatch,false);
    assert.deepEqual(error.nextAction?.validationFailures,[]);
    assert.doesNotMatch(JSON.stringify(error.nextAction),/SECRET|providerKey|private\.test|https:/);
    return true;
  });
});
