import assert from 'node:assert/strict';
import test from 'node:test';
import {getFalEngineById} from '../frontend/src/config/falEngines';
import {createStudioImageGenerationService,createStudioVideoGenerationService} from '../frontend/src/server/studio/image-generation-service';
import {actionFromTool} from '../frontend/lib/studio/conversation-action-contract';

const actor={authMethod: 'studio-session' as const,userId: 'owner',projectId: 'project',clientId: null};
const membership={tier: 'member' as const,source: 'app_receipts_rolling_30d' as const,spent30Cents: 0,thresholdCents: 0,discountPercent: 0};
function candidate(id: string,surface: 'image' | 'video') {
  const entry=getFalEngineById(id)!;
  return {engine: entry.engine,surface,publicModes: entry.engine.modes,modeCaps: Object.fromEntries(entry.modes.map(mode=>[mode.mode,mode.ui]))};
}
const input={surface: 'image' as const,engineId: 'gpt-image-2',mode: 't2i' as const,prompt: 'Price comparison',settings: {resolution: '1024x1024',aspectRatio: '1:1',quality: 'high'},references: [],outputCount: 1};

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
  assert.deepEqual(first.price,{amountCents:123,currency:'USD'});
  assert.deepEqual(second.price,{amountCents:167,currency:'USD'});
  assert.deepEqual(second.settings,input.settings);
  assert.equal(second.quoteRequired,true);
  assert.equal(second.estimatedAt,'2026-10-03T12:00:00.000Z');
  assert.equal(second.modelId,'gpt-image-2');
  assert.equal(second.outputCount,1);
  assert.equal(priced.length,2);
  assert.doesNotMatch(JSON.stringify(second),/providerCost|pricingSnapshot|quoteId|balance|storageUrl/);
});

test('Studio price reads fail closed for disabled or uncertified models, settings and inconsistent canonical prices',async()=> {
  let malformed=false;
  let executable=true;
  const deps={listPublicEngines: async()=>[candidate('gpt-image-2','image'),candidate('seedream','image')],resolveMembershipPricing: async()=>membership,
    resolveRequestExecutability:()=>({executable,reason:executable?'available' as const:'provider_unavailable' as const}),
    priceGeneration:async()=>({priceCents:100,currency:'USD',membershipTier:'member' as const,pricingSnapshot:{totalCents:malformed?99:100,currency:'USD',membershipTier:'member'}})};
  const generation=createStudioImageGenerationService(actor,{enabled:true,prepareDependencies:deps});
  assert.equal(typeof generation.estimate,'function');
  await assert.rejects(generation.estimate({...input,engineId:'seedream'}),{code:'ENGINE_UNAVAILABLE'});
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

test('Studio catalog never advertises modes rejected by its existing session preparation authority',async()=> {
  const generation=createStudioVideoGenerationService(actor,{enabled:true,prepareDependencies:{listPublicEngines:async()=>[candidate('wan-3','video')]}});
  const catalog=await generation.catalog();
  assert.ok(catalog.length);
  assert.ok(catalog.every(entry=>entry.publicModes.every(mode=>mode==='t2v'||mode==='i2v')));
});
