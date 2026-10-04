import assert from 'node:assert/strict';
import test from 'node:test';
import { MINIMAX_H3_MAX_ENGINE } from '../frontend/src/config/fal-engines/minimax-h3-max';
import { buildMinimaxH3MaxFalRequest, buildMinimaxH3MaxFalRequestFromPayload } from '../frontend/src/lib/minimax-h3-max';
import { validateRequest } from '../frontend/app/api/generate/_lib/validate';
import { WAN_3_INPUT_SCHEMA } from '../frontend/src/config/fal-engines/wan-3-shared';

const audio='https://media.maxvideoai.com/voice.wav';
const end='https://media.maxvideoai.com/end.png';
test('H3 Max preserves an imposed soundtrack and end-only frame through the production payload adapter',()=>{
 const result=buildMinimaxH3MaxFalRequestFromPayload({engineId:'minimax-h3-max',mode:'i2v',prompt:'Finish on this frame',durationSec:5,resolution:'1080P',seed:123,inputs:[
  {slotId:'end_image_url',kind:'image',url:end,name:'end.png',type:'image/png',size:10},
  {slotId:'target_audio_url',kind:'audio',url:audio,name:'voice.wav',type:'audio/wav',size:10},
 ],extraInputValues:{prompt_expansion_mode:'disabled'}});
 assert.equal(result.requestBody.end_image_url,end);
 assert.equal(result.requestBody.image_url,undefined);
 assert.equal(result.requestBody.target_audio_url,audio);
 assert.equal(result.requestBody.seed,123);
 assert.equal(result.requestBody.prompt_expansion_mode,'disabled');
});
test('H3 Max reference mode accepts audio alone with framing',()=>{
 const result=buildMinimaxH3MaxFalRequest({mode:'ref2v',prompt:'Use the voice',referenceAudioUrls:[audio],aspectRatio:'9:16'});
 assert.deepEqual(result.requestBody.reference_audio_urls,[audio]);
 assert.equal(result.requestBody.aspect_ratio,'9:16');
});
test('H3 Max site validation accepts end-only image and audio-only references',()=>{
 const common={prompt:'A scene',duration:5,resolution:'768P'};
 for(const [mode,media] of [['i2v',{end_image_url:end}],['ref2v',{reference_audio_urls:[audio]}]] as const){
  assert.deepEqual(validateRequest('minimax-h3-max',mode,{...common,...media},{inputSchema:MINIMAX_H3_MAX_ENGINE.inputSchema}),{ok:true});
 }
});
test('Wan editing and extension expose optional visual and audio references with their source video',()=>{
 for(const mode of ['v2v','extend'] as const){
  for(const id of ['reference_image_urls','reference_audio_urls']) assert.ok(WAN_3_INPUT_SCHEMA.optional?.find(f=>f.id===id)?.modes?.includes(mode),`${mode} ${id}`);
 }
});

import { validateGenerationMediaConstraints } from '../frontend/app/api/generate/_lib/generation-media-constraints';
import { calculateMinimaxH3MaxProviderCost } from '../frontend/src/lib/minimax-h3-max-pricing';
test('H3 Max checks owned soundtrack metadata without applying reference-only fifteen second cap',async()=>{
 const params={engineId:'minimax-h3-max',mode:'t2v' as const,userId:'owner',inputSchema:MINIMAX_H3_MAX_ENGINE.inputSchema,
 attachments:[{name:'voice.wav',type:'audio/wav',size:1,kind:'audio' as const,url:audio,assetId:'a',slotId:'target_audio_url'}],
 referenceMediaItems:[{kind:'audio' as const,url:audio,fieldId:'target_audio_url'}],
 deps:{queryFn:async <T>()=>[{asset_id:'a',url:audio,origin_url:null,original_name:'voice.wav',mime_type:'audio/wav',size_bytes:1000,duration_sec:30}] as T[]}};
 assert.equal((await validateGenerationMediaConstraints(params)).ok,true);
 const missing=await validateGenerationMediaConstraints({...params,deps:{queryFn:async()=>[]}});
 assert.equal(missing.ok,false);
});
test('H3 Max prices 1080P and resolution-specific reference output before token charges',()=>{
 assert.equal(calculateMinimaxH3MaxProviderCost({mode:'i2v',durationSec:5,resolution:'1080P'}).providerCostUsd,.8);
 assert.equal(calculateMinimaxH3MaxProviderCost({mode:'ref2v',durationSec:5,resolution:'480P',verifiedReferenceTokenCount:0}).providerCostUsd,.25);
});

import { resolveMediaAwarePreflight } from '../frontend/app/api/preflight/_lib/media-aware-preflight';
import { computeCanonicalBillingSnapshot } from '../frontend/server/pricing/quote-billing';
test('H3 Max website quote and charge use the same budget derived from owned dimensions and duration',async()=>{
 const url='https://cdn.maxvideoai.com/private/reference.mp4';
 const request={engine:'minimax-h3-max',mode:'ref2v' as const,durationSec:5,resolution:'768P' as const,aspectRatio:'16:9' as const,fps:24,inputs:[{assetId:'owned-video',slotId:'reference_video_urls',kind:'video' as const,url}]};
 const dependencies={getConfiguredEngineFn:async()=>MINIMAX_H3_MAX_ENGINE,mediaConstraintDeps:{queryFn:async<T>()=>[{asset_id:'owned-video',url,origin_url:null,original_name:'reference.mp4',mime_type:'video/mp4',size_bytes:1048576,duration_sec:10,width:1920,height:1080}] as T[]}};
 const quote=await resolveMediaAwarePreflight({request,userId:'owner'},dependencies);
 assert.equal(quote.ok,true,JSON.stringify(quote.error));
 assert.equal(quote.pricing?.meta?.provider_cost_is_estimate,true);
 const cost=quote.pricing?.meta?.cost_breakdown_usd as {referenceTokenBudget:number;providerCostUsd:number;verifiedReferenceTokenCount?:number};
 assert.equal(cost.referenceTokenBudget,41280);
 assert.equal(cost.providerCostUsd,1.14368);
 assert.equal(cost.verifiedReferenceTokenCount,undefined);
 const billing=await computeCanonicalBillingSnapshot({engine:MINIMAX_H3_MAX_ENGINE,mode:'ref2v',durationSec:5,resolution:'768P',aspectRatio:'16:9',referenceTokenBudget:41280,membershipTier:'member'}, {pricingPolicy:{loadOverrides:async()=>({status:'loaded',rules:[],routingRules:[]}),warn:()=>{}},membershipDiscounts:{member:0,plus:.05,pro:.1}});
 assert.equal(quote.total,billing.totalCents);
 assert.ok(billing.totalCents>115,'customer quote retains the configured margin');
 const forged=await resolveMediaAwarePreflight({request:{...request,extraInputValues:{referenceTokenBudget:0}},userId:'owner'},dependencies);
 assert.equal(forged.error?.code,'PRICING_MEDIA_FACTS_UNTRUSTED');
 const missing=await resolveMediaAwarePreflight({request,userId:'owner'},{...dependencies,mediaConstraintDeps:{queryFn:async()=>[]}});
 assert.equal(missing.ok,false);
});

test('H3 Max retains validated top-level reference images in the provider request',()=>{
 const result=buildMinimaxH3MaxFalRequestFromPayload({engineId:'minimax-h3-max',mode:'ref2v',prompt:'Use this image',durationSec:5,resolution:'768P',referenceImages:[end],inputs:[]});
 assert.deepEqual(result.requestBody.reference_image_urls,[end]);
});
