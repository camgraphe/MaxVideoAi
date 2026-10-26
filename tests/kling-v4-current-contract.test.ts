import assert from 'node:assert/strict';
import test from 'node:test';
import { KLING_V4_ENGINE } from '../frontend/src/config/fal-engines/kling-v4';
import { buildKlingV4FalRequest } from '../frontend/src/lib/kling-v4';
import { normalizeGenerationRequest } from '../frontend/src/server/agent-api/generation-normalization';
import { validateCanonicalGenerationCapabilities } from '../frontend/src/server/agent-api/generation-capability-validation';
import { priceCanonicalGeneration } from '../frontend/src/server/agent-api/generation-pricing';
import { buildPaidVideoRequestBody } from '../frontend/src/server/agent-api/paid-video-request-body';
import { studioVideoActionSchema, STUDIO_MEDIA_DIRECTOR_TOOLS } from '../frontend/lib/studio/conversation-media-contract';
import { buildBillingPricingFacts } from '../frontend/src/lib/pricing-billing-facts';
import { buildManualTariffScenario } from '../frontend/src/lib/pricing-manual-scenario';
import { computeCanonicalBillingSnapshot } from '../frontend/server/pricing/quote-billing';
import type { ResolvedReference } from '../frontend/src/server/agent-api/reference-types';
import type { EffectiveCustomerTariffState } from '../frontend/server/pricing/customer-tariff-store';
import type { ManualTariffCell } from '@maxvideoai/pricing';

const candidate = {engine:KLING_V4_ENGINE,surface:'video' as const,publicModes:KLING_V4_ENGINE.modes,modeCaps:KLING_V4_ENGINE.modeCaps!};
const source:ResolvedReference = {assetId:'ma_'+'a'.repeat(32),role:'source',mediaKind:'video',storageUrl:'https://media.maxvideoai.com/source.mp4',mimeType:'video/mp4',width:1280,height:720,durationSec:5.25,fps:24,sizeBytes:1024};
const canonical = (mode='t2v',prompt='A precise scene.',settings:Record<string,unknown>={durationSec:5,resolution:'720p'},references:unknown[]=[]) => normalizeGenerationRequest({surface:'video',engineId:'kling-v4',mode,prompt,settings,references});
const priced = {ok:true,total:999,currency:'USD',pricing:{totalCents:999,currency:'USD',membershipTier:'member'}} as never;
const context = {engine:KLING_V4_ENGINE,mode:'ref2v' as const,durationSec:5,resolution:'720p',hasVideoInput:true,inputVideoDurationSec:10.25};
const policy = {loadOverrides:async()=>({status:'loaded' as const,rules:[]}),warn:()=>undefined};
const state = (active:boolean,cells:ManualTariffCell[]=[]):EffectiveCustomerTariffState => ({status:'loaded',active,revision:71,versionedCells:[],databaseCells:cells} as EffectiveCustomerTariffState);

test('current fal main prompt bound is 26000 on all four V4 routes, with unchanged 512-character shots',()=>{
 assert.equal(KLING_V4_ENGINE.inputLimits?.promptMaxChars,26000);
 for(const mode of ['t2v','i2v','ref2v','v2v'] as const){
  const media=mode==='i2v'?{imageUrl:'https://media.example/a.png'}:mode==='ref2v'?{referenceImages:['https://media.example/a.png']}:mode==='v2v'?{videoUrl:source.storageUrl}:{};
  const request=canonical(mode,'x'.repeat(26000));assert.equal(request.prompt.length,26000);
  assert.equal(buildKlingV4FalRequest({engineId:'kling-v4',mode,prompt:request.prompt,...media}).requestBody.prompt,request.prompt);
  assert.throws(()=>canonical(mode,'x'.repeat(26001)));
  assert.throws(()=>buildKlingV4FalRequest({engineId:'kling-v4',mode,prompt:'x'.repeat(26001),...media}));
 }
 assert.throws(()=>normalizeGenerationRequest({surface:'video',engineId:'kling-3-pro',mode:'t2v',prompt:'x'.repeat(12001),settings:{durationSec:5},references:[]}));
 assert.doesNotThrow(()=>buildKlingV4FalRequest({engineId:'kling-v4',prompt:'',multiPrompt:[{prompt:'x'.repeat(512),duration:3}],durationSec:3}));
 assert.throws(()=>buildKlingV4FalRequest({engineId:'kling-v4',prompt:'',multiPrompt:[{prompt:'x'.repeat(513),duration:3}],durationSec:3}));
 const action={action:'video.prepare',reply:'Review',prompt:'x'.repeat(26000),aspectRatio:'16:9',source:null,modelId:'kling-v4',mode:'t2v'};
 assert.equal(studioVideoActionSchema.safeParse(action).success,true);
 assert.equal(studioVideoActionSchema.safeParse({...action,prompt:'x'.repeat(26001)}).success,false);
 assert.equal((STUDIO_MEDIA_DIRECTOR_TOOLS.find(tool=>tool.name==='video_prepare')!.properties.prompt as {maxLength:number}).maxLength,26000);
});

test('Modify omission binds exact owned source duration to the quote and leaves the provider duration omitted',async()=>{
 const request=canonical('v2v','Change the lighting.',{resolution:'720p'},[{kind:'asset',assetId:source.assetId,role:'source'}]);
 assert.doesNotThrow(()=>validateCanonicalGenerationCapabilities(request,candidate));
 let calls=0;
 await priceCanonicalGeneration(request,'member',{estimateImage:async()=>{throw new Error('not image');},computeVideoPreflight:async(input,options)=>{
  calls++;assert.equal(input.durationSec,5.25);assert.equal(options?.trustedMediaPricingFacts?.inputVideoDurationSec,5.25);assert.equal(options?.trustedMediaPricingFacts?.inheritedDurationSec,5.25);return priced;
 }},{resolvedReferences:[source],resolvedEngine:KLING_V4_ENGINE});
 assert.equal(calls,1);
 const body=buildPaidVideoRequestBody({request,resolvedReferences:[source],engine:KLING_V4_ENGINE,quoteId:'test',canonicalPricing:{membershipTier:'member'}});
 assert.equal(buildKlingV4FalRequest(body as never).requestBody.duration,undefined);
 await assert.rejects(priceCanonicalGeneration(request,'member',{estimateImage:async()=>{throw new Error('not image');},computeVideoPreflight:async()=>{throw new Error('must not price');}},{resolvedReferences:[]}));
 assert.throws(()=>buildKlingV4FalRequest({engineId:'kling-v4',mode:'extend',prompt:'Continue'}));
});

test('V4 supplier usage remains factual while exact reviewed admin cells own retail and revision',async()=>{
 const billing=buildBillingPricingFacts(context,undefined,'USD');
 assert.equal(billing.facts.vendorSubtotalExactCents,15.25*9.4);
 const scenario=buildManualTariffScenario(context,billing.facts);
 assert.equal(scenario.selector.billingInputType,'video_input');assert.equal(scenario.selector.inputVideoDurationSec,'10.25');
 assert.equal(scenario.quantities.input_video_seconds,10.25);assert.equal(scenario.quantities.output_seconds,5);
 for(const active of [false,true]) await assert.rejects(computeCanonicalBillingSnapshot(context,{pricingPolicy:policy,loadCustomerTariffState:async()=>state(active)}));
 const cell:ManualTariffCell={id:'test-reviewed-v4',selector:scenario.selector,source:'database',version:3,currency:'USD',effectiveFrom:'2026-10-01T00:00:00Z',price:{kind:'fixed',customerCents:999}};
 const quote=await computeCanonicalBillingSnapshot(context,{pricingPolicy:policy,loadCustomerTariffState:async()=>state(true,[cell])});
 assert.equal(quote.totalCents,999);assert.equal(quote.meta?.customerTariffRevision,71);assert.equal(quote.meta?.customerTariffCellId,cell.id);
 const changed=await computeCanonicalBillingSnapshot(context,{pricingPolicy:policy,loadCustomerTariffState:async()=>({...state(true,[{...cell,version:4,price:{kind:'fixed',customerCents:1001}}]),revision:72})});
 assert.equal(changed.totalCents,1001);assert.equal(changed.meta?.customerTariffRevision,72);assert.equal(quote.totalCents,999);
 await assert.rejects(computeCanonicalBillingSnapshot({...context,resolution:'1080p'},{pricingPolicy:policy,loadCustomerTariffState:async()=>state(true,[cell])}));
});

test('continuous V4 tariffs retain video class and exact source quantities without truncation',async()=>{
 const {continuousInputTariffSelector}=await import('../frontend/src/lib/pricing-manual-scenario');
 const scenario=buildManualTariffScenario(context,buildBillingPricingFacts(context,undefined,'USD').facts);
 const selector=continuousInputTariffSelector(scenario.selector);
 assert.ok(selector);assert.equal(selector.inputVideoDurationSec,'continuous');
 const cell:ManualTariffCell={id:'test-v4-continuous',selector,source:'database',version:1,currency:'USD',effectiveFrom:'2026-10-01T00:00:00Z',price:{kind:'unit_terms',rounding:'up',terms:[{unit:'billable_seconds',centsPerUnit:20}]}};
 for(const seconds of [3,5.25,10.2501,30]){
  const quote=await computeCanonicalBillingSnapshot({...context,inputVideoDurationSec:seconds},{pricingPolicy:policy,loadCustomerTariffState:async()=>state(true,[cell])});
  assert.equal(quote.totalCents,Math.ceil(Math.max(seconds+5,10)*20));
 }
 const noVideo={...context,hasVideoInput:false,inputVideoDurationSec:0};
 await assert.rejects(computeCanonicalBillingSnapshot(noVideo,{pricingPolicy:policy,loadCustomerTariffState:async()=>state(true,[cell])}));
 await assert.rejects(computeCanonicalBillingSnapshot(context,{pricingPolicy:policy,loadCustomerTariffState:async()=>state(true,[{...cell,price:{kind:'fixed',customerCents:999}}])}));
});

test('the execution source owner preserves requested Modify timing and exact omission inheritance',async()=>{
 const {resolveGenerateSourceVideoContext}=await import('../frontend/app/api/generate/_lib/source-video-context');
 const base={engineId:'kling-v4',engineLabel:'Kling 4',mode:'v2v' as const,attachments:[],videoUrls:[],sourceInputVideoUrl:source.storageUrl,
  trustedSourceVideo:{url:source.storageUrl,durationSec:5.25,width:1280,height:720},fallbackDurationSec:3};
 assert.equal((resolveGenerateSourceVideoContext({...base,inheritSourceDuration:false}) as {durationSec:number}).durationSec,3);
 assert.equal((resolveGenerateSourceVideoContext({...base,inheritSourceDuration:true}) as {durationSec:number}).durationSec,5.25);
 assert.equal(resolveGenerateSourceVideoContext({...base,inheritSourceDuration:true,trustedSourceVideo:undefined}).ok,false);
});
