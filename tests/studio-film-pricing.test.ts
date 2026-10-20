import assert from 'node:assert/strict';
import test from 'node:test';
import {getFalEngineById} from '../frontend/src/config/falEngines';
import {createStudioVideoGenerationService} from '../frontend/src/server/studio/image-generation-service';
import {compareGenerationPrices} from '../frontend/src/server/agent-api/generation-price-comparison';
import {priceStudioFilm} from '../frontend/src/server/studio/conversation-film-pricing';
import {studioFilmComparisonReply} from '../frontend/src/server/studio/conversation-film-reply';
import {AgentApiError} from '../frontend/src/server/agent-api/errors';
import {imageDraftSchema} from '../frontend/src/lib/studio/image-conversation-contract';

const actor={authMethod:'studio-session' as const,userId:'owner',projectId:'project',clientId:null};
const input={surface:'video' as const,mode:'t2v' as const,prompt:'A forest race',settings:{resolution:'720p',aspectRatio:'16:9',audio:true},references:[]};
function candidate(id:string){const entry=getFalEngineById(id)!;assert.ok(entry,id);return {engine:entry.engine,surface:'video' as const,publicModes:entry.engine.modes,modeCaps:Object.fromEntries(entry.modes.map(mode=>[mode.mode,mode.ui]))};}
function service(){return createStudioVideoGenerationService(actor,{enabled:true,prepareDependencies:{
  listPublicEngines:async()=>['ltx-2-5-fast','seedance-2-5','gemini-omni-flash'].map(candidate),
  resolveMembershipPricing:async()=>({tier:'member',source:'app_receipts_rolling_30d',spent30Cents:0,thresholdCents:0,discountPercent:0}),
  resolveRequestExecutability:()=>({executable:true,reason:'available'}),
  priceGeneration:async(request,tier)=>{const duration=Number(request.settings.durationSec),amount=duration*7+3;return {priceCents:amount,currency:'USD',membershipTier:tier,pricingSnapshot:{totalCents:amount,currency:'USD',membershipTier:tier,meta:{output_duration_sec:duration}}};},
  getWalletSummary:async()=>{throw new Error('No wallet read.');},withTransaction:async()=>{throw new Error('No quote or charge transaction.');},
}});}

test('a twenty-second brand film can price four owned image references in a supported reference workflow',async()=>{
  const references=Array.from({length:4},(_,i)=>({kind:'asset' as const,assetId:'ma_'+String(i+1).repeat(32),role:'reference' as const}));
  const data=await priceStudioFilm({...input,mode:'ref2v',settings:{resolution:'720p',aspectRatio:'16:9'},references,candidateModelIds:['seedance-2-5']},20,{catalog:()=>service().catalog(),compare:scenario=>compareGenerationPrices(scenario,actor,{
    listPublicEngines:()=>service().catalog(),
    resolveGenerationReferences:async request=>request.references.map(ref=>({assetId:ref.kind==='asset'?ref.assetId:'invalid',role:ref.role,mediaKind:'image' as const,storageUrl:'https://cdn.maxvideoai.com/reference.png',mimeType:'image/png',width:1280,height:720,durationSec:null,sizeBytes:1024,originalName:null})),
    resolveMembershipPricing:async()=>({tier:'member',source:'app_receipts_rolling_30d',spent30Cents:0,thresholdCents:0,discountPercent:0}),
    resolveRequestExecutability:()=>({executable:true,reason:'available'}),
    priceGeneration:async request=>({priceCents:123,currency:'USD',membershipTier:'member',pricingSnapshot:{totalCents:123,currency:'USD',membershipTier:'member',meta:{output_duration_sec:Number(request.settings.durationSec)}}}),
  })});
  assert.ok(data.filmPlans!.length);
  for(const plan of data.filmPlans!){
    assert.equal(plan.totalDurationSec,20);assert.deepEqual(plan.clip.references,references);
    assert.equal(plan.clip.mode,'ref2v');assert.equal(plan.clip.modelId,'seedance-2-5');
  }
});

test('100-second cuts use the certified live model capabilities and canonical per-output rounded amounts',async()=>{
  const data=await priceStudioFilm(input,100,service());
  assert.ok(data.filmPlans!.length>=2,'At least short and continuous cuts must be priced.');
  assert.ok(data.filmPlans!.some(plan=>plan.fullClipCount===10&&plan.clip.outputDurationSec===10));
  assert.ok(data.filmPlans!.some(plan=>plan.fullClipCount===5&&plan.clip.outputDurationSec===20));
  for(const plan of data.filmPlans!){
    assert.equal(plan.totalDurationSec,100);
    assert.equal(plan.generatedDurationSec,100);
    assert.equal(plan.price.amountCents,plan.fullClipCount*(plan.clip.outputDurationSec!*7+3)+(plan.tail?(plan.tail.outputDurationSec!*7+3):0),'Round each actual output then sum, never scale one clip as a continuous tariff.');
    assert.equal(plan.clip.settings.resolution,'720p');assert.equal(plan.clip.settings.aspectRatio,'16:9');assert.equal(plan.clip.settings.audio,true);
    assert.equal(plan.clip.quoteRequired,true);
  }
  const draft=studioFilmComparisonReply(data,'fr');
  assert.match(draft.reply,/5 × 20 s/);assert.match(draft.reply,/100 secondes/);assert.match(draft.reply,/au total/);assert.match(draft.reply,/confirmez/);
  assert.deepEqual(imageDraftSchema.parse(draft),draft);
});

test('60 seconds offers three times 20 seconds and totals every component without static prices',async()=>{
  const data=await priceStudioFilm({...input,candidateModelIds:['ltx-2-5-fast']},60,service());
  const plan=data.filmPlans!.find(plan=>plan.clip.outputDurationSec===20)!;
  assert.ok(plan);assert.equal(plan.fullClipCount,3);assert.equal(plan.price.amountCents,429);
  assert.match(studioFilmComparisonReply(data).reply,/3 × 20 s/);
});

test('an unsupported tail may use only a canonically priced longer clip with disclosed trimming',async()=>{
  const native=service();
  const data=await priceStudioFilm(input,101,{compare:async scenario=>{
    if(![10,20,30].includes(Number(scenario.settings?.durationSec)))throw new AgentApiError('PARAMETER_INVALID','Unsupported duration',false,{type:'generation_comparison',reason:'no_matching_scenario',surface:'video',mode:'t2v',requestedDurationSec:Number(scenario.settings?.durationSec),durationMismatch:true,models:[]});
    return native.compare(scenario);
  }});
  for(const plan of data.filmPlans!){assert.equal(plan.totalDurationSec,101);assert.ok(plan.generatedDurationSec>101);assert.ok(plan.tail);assert.equal(plan.price.amountCents,(plan.fullClipCount+1)*plan.clip.price.amountCents);}
  assert.match(studioFilmComparisonReply(data,'fr').reply,/générées et facturées, fin recoupée/);
});

test('tail price outages and incompatible constraints never become a invented full-film price',async()=>{
  const native=service();
  await assert.rejects(priceStudioFilm(input,101,{compare:async scenario=>{
    if(![10,20,30].includes(Number(scenario.settings?.durationSec)))throw new AgentApiError('ENGINE_UNAVAILABLE','Temporary pricing outage',true);
    return native.compare(scenario);
  }}));
  await assert.rejects(priceStudioFilm({...input,settings:{...input.settings,resolution:'unsupported'}},100,native));
  await assert.rejects(priceStudioFilm({...input,mode:'v2v'},100,native));
});

test('explicit per-shot duration is preserved instead of replaced by generic cut preferences',async()=>{
  const data=await priceStudioFilm({...input,settings:{...input.settings,durationSec:5},candidateModelIds:['seedance-2-5']},100,service());
  assert.equal(data.filmPlans!.length,1);assert.equal(data.filmPlans![0].clip.outputDurationSec,5);assert.equal(data.filmPlans![0].fullClipCount,20);
});

test('a selected model with shorter capabilities receives compatible fully priced variants',async()=>{
  const native=createStudioVideoGenerationService(actor,{enabled:true,prepareDependencies:{listPublicEngines:async()=>[candidate('veo-3-1')],
    resolveMembershipPricing:async()=>({tier:'member',source:'app_receipts_rolling_30d',spent30Cents:0,thresholdCents:0,discountPercent:0}),resolveRequestExecutability:()=>({executable:true,reason:'available'}),
    priceGeneration:async(request,tier)=>{const duration=Number(request.settings.durationSec);return {priceCents:duration*10,currency:'USD',membershipTier:tier,pricingSnapshot:{totalCents:duration*10,currency:'USD',membershipTier:tier,meta:{output_duration_sec:duration}}};},
  }});
  const data=await priceStudioFilm({...input,candidateModelIds:['veo-3-1']},100,native);
  assert.ok(data.filmPlans!.length>=2);for(const plan of data.filmPlans!){assert.equal(plan.clip.modelId,'veo-3-1');assert.ok([4,6,8].includes(plan.clip.outputDurationSec!));assert.equal(plan.totalDurationSec,100);}
});
