import assert from 'node:assert/strict';
import test from 'node:test';
import {getFalEngineById} from '../frontend/src/config/falEngines';
import {createStudioImageGenerationService,createStudioVideoGenerationService} from '../frontend/src/server/studio/image-generation-service';
import {actionFromTool} from '../frontend/lib/studio/conversation-action-contract';
import {conversationSelectionSettings} from '../frontend/lib/studio/conversation-creation-contract';
import {requireStudioGenerationRequest} from '../frontend/src/server/agent-api/generation-actor';
import {normalizeGenerationRequest} from '../frontend/src/server/agent-api/generation-normalization';
import {isStudioConversationVideoModeCertified} from '../frontend/app/(core)/(workspace)/app/studio/_shared/_lib/models/workspace-model-certification';

const actor={authMethod: 'studio-session' as const,userId: 'owner',projectId: 'project',clientId: null};
const membership={tier: 'member' as const,source: 'app_receipts_rolling_30d' as const,spent30Cents: 0,thresholdCents: 0,discountPercent: 0};
function candidate(id: string,surface: 'image' | 'video') {
  const entry=getFalEngineById(id)!;
  return {engine: entry.engine,surface,publicModes: entry.engine.modes,modeCaps: Object.fromEntries(entry.modes.map(mode=>[mode.mode,mode.ui]))};
}
const input={surface: 'image' as const,engineId: 'gpt-image-2',mode: 't2i' as const,prompt: 'Price comparison',settings: {resolution: '1024x1024',aspectRatio: '1:1',quality: 'high'},references: [],outputCount: 1};

test('Studio comparison tool is bounded, accepts only saved attachments and has no price or confirmation authority',async()=>{
  const args={surface:'image',mode:'t2i',prompt:'A portrait',settings:[],references:[],baselineModelId:null,candidateModelIds:null,outputCount:1};
  assert.equal(actionFromTool('pricing_compare',args).action,'pricing.compare');
  for(const extra of [{userId:'other'},{projectId:'other'},{confirmed:true},{priceCents:1},{quoteId:'forged'}]) assert.throws(()=>actionFromTool('pricing_compare',{...args,...extra}));
  assert.throws(()=>actionFromTool('pricing_compare',{...args,candidateModelIds:Array(33).fill('model')}));
  assert.throws(()=>actionFromTool('pricing_compare',{...args,references:[{ref:{type:'job-output',jobId:'j',outputId:'o',kind:'image'},role:'reference',slot:null}]}));
  const service=createStudioImageGenerationService(actor,{enabled:true,prepareDependencies:{listPublicEngines:async()=>[candidate('gpt-image-2','image'),candidate('seedream','image')],resolveMembershipPricing:async()=>membership,
    resolveRequestExecutability:()=>({executable:true,reason:'available'}),
    priceGeneration:async(request,tier)=>{const amount=request.engineId==='gpt-image-2'?100:20;return {priceCents:amount,currency:'USD',membershipTier:tier,pricingSnapshot:{totalCents:amount,currency:'USD',membershipTier:tier}};},
    withTransaction:async()=>{throw new Error('Comparison must never start a transaction.');},getWalletSummary:async()=>{throw new Error('Comparison must never read the wallet.');},
  }});
  const result=await service.compare({surface:'image',mode:'t2i',prompt:'A portrait',settings:{},references:[],candidateModelIds:['gpt-image-2','seedream']});
  assert.equal(result.options.length,2);
  assert.deepEqual(result.options.map(option=>option.price.amountCents),[20,100]);
});

test('Studio reads a fresh canonical price without quote, wallet or transaction effects',async()=> {
  let price=123;
  const priced: unknown[]=[];
  const generation=createStudioImageGenerationService(actor,{enabled:true,prepareDependencies:{
    listPublicEngines: async()=>[candidate('gpt-image-2','image')],resolveMembershipPricing: async()=>membership,
    resolveRequestExecutability:()=>({executable:true,reason:'available'}),
    priceGeneration: async(request,tier,context)=>{priced.push({request,tier,engine:context.resolvedEngine?.id});return {priceCents:price,currency:'USD',membershipTier:tier,pricingSnapshot:{totalCents:price,currency:'USD',membershipTier:tier,providerCostCents:88}};},
    getWalletSummary:async()=>{throw new Error('Estimation must not read the wallet.');},withTransaction:async()=>{throw new Error('Estimation must not begin a transaction.');},
    now:()=>new Date('2026-10-03T12:00:00Z'),
  }});
  assert.equal(typeof generation.estimate,'function','Studio needs a non-preparing canonical pricing read.');
  const first=await generation.estimate(input);
  price=167;
  const second=await generation.estimate(input);
  assert.deepEqual(first.price,{amountCents:123,currency:'USD',formattedAmount:'$1.23'});
  assert.deepEqual(second.price,{amountCents:167,currency:'USD',formattedAmount:'$1.67'});
  assert.deepEqual(second.settings,input.settings);
  assert.equal(second.quoteRequired,true);
  assert.equal(second.estimatedAt,'2026-10-03T12:00:00.000Z');
  assert.equal(second.modelId,'gpt-image-2');
  assert.equal(second.outputCount,1);
  assert.equal(priced.length,2);
  assert.doesNotMatch(JSON.stringify(second),/providerCost|pricingSnapshot|quoteId|balance|storageUrl/);
});

test('Studio price reads accept certified choices and reject unavailable models, invalid settings and inconsistent prices',async()=> {
  let malformed=false;
  let executable=true;
  let priceCalls=0;
  const deps={listPublicEngines: async()=>[candidate('gpt-image-2','image'),candidate('seedream','image'),candidate('gpt-image-2-5-sunburst','image')],resolveMembershipPricing: async()=>membership,
    resolveRequestExecutability:()=>({executable,reason:executable?'available' as const:'provider_unavailable' as const}),
    priceGeneration:async()=>{priceCalls++;return {priceCents:100,currency:'USD',membershipTier:'member' as const,pricingSnapshot:{totalCents:malformed?99:100,currency:'USD',membershipTier:'member'}};}};
  const generation=createStudioImageGenerationService(actor,{enabled:true,prepareDependencies:deps});
  assert.equal(typeof generation.estimate,'function');
  await assert.rejects(generation.estimate({...input,engineId:'gpt-image-2-5-sunburst'}),{code:'ENGINE_UNAVAILABLE'});
  assert.equal(priceCalls,0,'Uncertified models must fail before the pricing function.');
  const seedreamInput={...input,engineId:'seedream',settings:{resolution:'2K',aspectRatio:'1:1'}};
  const seedreamPrice=await generation.estimate(seedreamInput);
  assert.equal(seedreamPrice.modelId,'seedream','A compatible model exposed by canonical certification keeps its exact identity.');
  assert.deepEqual(seedreamPrice.settings,seedreamInput.settings);
  assert.deepEqual(seedreamPrice.price,{amountCents:100,currency:'USD',formattedAmount:'$1.00'});
  assert.equal(priceCalls,1);
  await assert.rejects(generation.estimate({...input,engineId:'seedream'}),{code:'PARAMETER_INVALID'});
  assert.equal(priceCalls,1,'Certification does not bypass model-specific settings validation.');
  await assert.rejects(generation.estimate({...input,settings:{...input.settings,quality:'invented'}}),{code:'PARAMETER_INVALID'});
  await assert.rejects(createStudioImageGenerationService(actor,{enabled:false,prepareDependencies:deps}).estimate(input),{code:'ENGINE_UNAVAILABLE'});
  executable=false;
  await assert.rejects(generation.estimate(input),{code:'ENGINE_UNAVAILABLE'});
  executable=true;malformed=true;
  await assert.rejects(generation.estimate(input),{code:'INTERNAL_ERROR'});
  const video=createStudioVideoGenerationService(actor,{enabled:true,prepareDependencies:{...deps,listPublicEngines:async()=>[candidate('wan-3','video')]}});
  await assert.rejects(video.estimate({...input,surface:'video',engineId:'wan-3',mode:'ref2v'}),{code:'PARAMETER_INVALID'});
});

test('pricing tool accepts one exact bounded scenario without caller authority or project-output promotion',()=> {
  const args={surface:'image',modelId:'gpt-image-2',mode:'t2i',settings:[{name:'resolution',value:'1024x1024'}],references:[],outputCount:1};
  assert.deepEqual(actionFromTool('pricing_read',args),{action:'pricing.read',...args});
  for(const extra of [{userId:'other'},{projectId:'other'},{confirmed:true},{priceCents:1},{quoteId:'forged'}]) assert.throws(()=>actionFromTool('pricing_read',{...args,...extra}));
  assert.throws(()=>actionFromTool('pricing_read',{...args,outputCount:2}));
  assert.throws(()=>actionFromTool('pricing_read',{...args,references:[{ref:{type:'job-output',jobId:'j',outputId:'o',kind:'image'},role:'reference',slot:null}]}));
});

test('a video estimate rejects the duration alias with actionable canonical guidance and accepts durationSec',async()=> {
  let priceCalls=0;
  const generation=createStudioVideoGenerationService(actor,{enabled:true,prepareDependencies:{
    listPublicEngines:async()=>[candidate('kling-o3-pro','video')],resolveMembershipPricing:async()=>membership,
    resolveRequestExecutability:()=>({executable:true,reason:'available'}),
    priceGeneration:async(request)=>{
      priceCalls++;
      assert.deepEqual(request.settings,{durationSec:8,resolution:'1080p',aspectRatio:'9:16',audio:false});
      return {priceCents:250,currency:'USD',membershipTier:'member',pricingSnapshot:{totalCents:250,currency:'USD',membershipTier:'member'}};
    },
    getWalletSummary:async()=>{throw new Error('Estimation must not read the wallet.');},withTransaction:async()=>{throw new Error('Estimation must not begin a transaction.');},
  }});
  const scenario={surface:'video' as const,engineId:'kling-o3-pro',mode:'t2v' as const,prompt:'Studio pricing scenario',references:[],outputCount:1};
  const nativeAction=actionFromTool('pricing_read',{surface:'video',modelId:'kling-o3-pro',mode:'t2v',settings:[
    {name:'duration',value:8},{name:'resolution',value:'1080p'},{name:'aspectRatio',value:'9:16'},{name:'audio',value:false},
  ],references:[],outputCount:1});
  assert.equal(nativeAction.action,'pricing.read');
  if (nativeAction.action!=='pricing.read') throw new Error('Expected the native pricing action.');
  await assert.rejects(generation.estimate({...scenario,settings:conversationSelectionSettings(nativeAction.settings)}),error=>{
    assert.equal((error as {code?:string}).code,'PARAMETER_INVALID');
    assert.match((error as Error).message,/durationSec/);
    assert.match((error as Error).message,/seconds/i);
    return true;
  });
  assert.equal(priceCalls,0,'Invalid names must fail before pricing, not be silently rewritten.');
  const estimate=await generation.estimate({...scenario,settings:{durationSec:8,resolution:'1080p',aspectRatio:'9:16',audio:false}});
  assert.deepEqual(estimate.price,{amountCents:250,currency:'USD',formattedAmount:'$2.50'});
  assert.equal(estimate.quoteRequired,true);
  assert.equal(priceCalls,1);
  await assert.rejects(generation.estimate({...scenario,settings:{privateCustomerToken:'secret-value'}}),error=>{
    assert.equal((error as {code?:string}).code,'PARAMETER_INVALID');
    assert.doesNotMatch((error as Error).message,/privateCustomerToken|secret-value/);
    return true;
  });
  assert.equal(priceCalls,1,'Other unknown settings remain rejected.');
});

test('Studio catalog never advertises modes rejected by its existing session preparation authority',async()=> {
  const generation=createStudioVideoGenerationService(actor,{enabled:true,prepareDependencies:{listPublicEngines:async()=>[candidate('wan-3','video')]}});
  const catalog=await generation.catalog();
  assert.ok(catalog.length);
  assert.ok(catalog[0].publicModes.includes('v2v'));
  assert.ok(catalog[0].publicModes.includes('extend'));
  for(const entry of catalog)for(const mode of entry.publicModes){
    assert.equal(isStudioConversationVideoModeCertified(entry.engine.id,mode),true);
    const request=normalizeGenerationRequest({surface:'video',engineId:entry.engine.id,mode,prompt:'Inspect the qualified scenario.',references:[],outputCount:1});
    assert.doesNotThrow(()=>requireStudioGenerationRequest(request));
    assert.throws(()=>requireStudioGenerationRequest({...request,outputCount:2}),{code:'PARAMETER_INVALID'});
  }
});
