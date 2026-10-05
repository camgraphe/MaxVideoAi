import assert from 'node:assert/strict';
import test from 'node:test';
import {getFalEngineById} from '../frontend/src/config/falEngines';
import {AgentApiError,toAgentApiFailure} from '../frontend/src/server/agent-api/errors';
import {GenerationCapabilityError,validateCanonicalGenerationCapabilities} from '../frontend/src/server/agent-api/generation-capability-validation';
import {normalizeGenerationRequest,hashCanonicalGenerationRequest} from '../frontend/src/server/agent-api/generation-normalization';
import {readGenerationPricing,type GenerationPricingReadDependencies} from '../frontend/src/server/agent-api/generation-pricing-read';
import type {CanonicalGenerationRequest} from '../frontend/src/server/agent-api/generation-types';
import type {AgentPublicGenerationEngine} from '../frontend/src/server/agent-api/model-catalog';

const studio={authMethod:'studio-session' as const,userId:'owner',projectId:'film',clientId:null};
const oauth={authMethod:'oauth' as const,userId:'owner',clientId:'client',emailVerified:true};
const membership={tier:'member' as const,source:'app_receipts_rolling_30d' as const,spent30Cents:0,thresholdCents:0,discountPercent:0};
function candidate(id:string,surface:'video'|'image'):AgentPublicGenerationEngine {
  const entry=getFalEngineById(id)!;
  return {engine:entry.engine,surface,publicModes:entry.engine.modes,modeCaps:Object.fromEntries(entry.modes.map(mode=>[mode.mode,mode.ui]))};
}
const wan=candidate('wan-3-prime','video');
const image=candidate('gpt-image-2','image');
const videoInput=normalizeGenerationRequest({surface:'video',engineId:wan.engine.id,mode:'t2v',prompt:'A quiet shop exterior.',settings:{durationSec:6,resolution:'1080p',audio:false},references:[],outputCount:1});
function dependencies(onPrice?:GenerationPricingReadDependencies['priceGeneration']):GenerationPricingReadDependencies {
  return {listPublicEngines:async()=>[wan,image],resolveMembershipPricing:async()=>membership,
    resolveGenerationReferences:async()=>{throw new Error('These text-only reads cannot resolve references.');},
    resolveRequestExecutability:()=>({executable:true,reason:'available'}),
    priceGeneration:onPrice??(async()=>({priceCents:48,currency:'USD',membershipTier:'member',pricingSnapshot:{totalCents:48,currency:'USD',membershipTier:'member'}})),
  };
}
async function failure(request:CanonicalGenerationRequest,deps=dependencies()) {
  try {await readGenerationPricing(request,studio,deps);assert.fail('An invalid scenario must remain rejected.');}
  catch(error){assert.ok(error instanceof AgentApiError);return toAgentApiFailure(error);}
}

test('a missing supported aspectRatio is actionable for Studio and OAuth without defaulting or reading a price',async()=>{
  assert.throws(()=>validateCanonicalGenerationCapabilities(videoInput,wan),error=>error instanceof GenerationCapabilityError&&error.field==='aspectRatio');
  let priceReads=0;
  const deps=dependencies(async()=>{priceReads++;throw new Error('Invalid settings cannot reach pricing.');});
  for(const actor of [studio,oauth]){
    await assert.rejects(readGenerationPricing(videoInput,actor,deps),error=>{
      assert.ok(error instanceof AgentApiError);
      assert.equal(error.code,'PARAMETER_INVALID');
      assert.match(error.message,/\baspectRatio\b/);
      assert.equal(error.retryable,false);
      return true;
    });
  }
  assert.equal(Object.hasOwn(videoInput.settings,'aspectRatio'),false);
  assert.equal(priceReads,0);
});

test('correcting the reported field preserves the exact canonical scenario, price and request hash',async()=>{
  const request=normalizeGenerationRequest({...videoInput,settings:{...videoInput.settings,aspectRatio:'16:9'}});
  const before=structuredClone(request),hash=hashCanonicalGenerationRequest(request);
  let priceReads=0;
  const deps=dependencies(async priced=>{
    priceReads++;
    assert.deepEqual(priced,before);
    return {priceCents:48,currency:'USD',membershipTier:'member',pricingSnapshot:{totalCents:48,currency:'USD',membershipTier:'member'}};
  });
  for(const actor of [studio,oauth]){
    const result=await readGenerationPricing(request,actor,deps);
    assert.equal(result.pricing.priceCents,48);
    assert.equal(result.pricing.currency,'USD');
    assert.equal(result.pricingSnapshot.engineId,'wan-3-prime');
  }
  assert.equal(priceReads,2);
  assert.deepEqual(request,before);
  assert.equal(hashCanonicalGenerationRequest(request),hash);
});

test('public parameter names are useful but invalid values, prompt content and storage URLs stay private',async()=>{
  const base={...videoInput,settings:{...videoInput.settings,aspectRatio:'16:9'}};
  for(const [field,value] of [['aspectRatio','https://private.invalid/SECRET_RATIO'],['resolution','SECRET_RESOLUTION'],['durationSec',-1],['audio','SECRET_AUDIO']] as const){
    const result=await failure({...base,settings:{...base.settings,[field]:value}});
    assert.equal(result.error.code,'PARAMETER_INVALID');
    assert.match(result.error.message,new RegExp('\\b'+field+'\\b'));
    assert.doesNotMatch(JSON.stringify(result),/SECRET_|https:|private\.invalid|canonical generation request/);
  }
});

test('unknown provider field names remain generic instead of becoming public error details',async()=>{
  const request=normalizeGenerationRequest({surface:'image',engineId:image.engine.id,mode:'t2i',prompt:'PRIVATE_PROMPT',
    settings:{resolution:'custom',imageWidth:1024,imageHeight:1080,quality:'high'},references:[],outputCount:1});
  assert.throws(()=>validateCanonicalGenerationCapabilities(request,image),error=>error instanceof GenerationCapabilityError&&error.field==='image_height');
  const result=await failure(request);
  assert.equal(result.error.code,'PARAMETER_INVALID');
  assert.equal(result.error.nextAction,null);
  assert.doesNotMatch(JSON.stringify(result),/image_height|PRIVATE_PROMPT|1080|canonical generation request/);
});

test('unrecognized canonical validation fields never publish arbitrary names, suffixes or exception messages',async()=>{
  const request={...videoInput,settings:{...videoInput.settings,aspectRatio:'16:9'}};
  for(const field of ['providerAccountId','apiKey','https://private.invalid/SECRET_KEY','aspectRatio\nSECRET_KEY','aspectRatio.private']){
    const error=new GenerationCapabilityError(field);
    error.message='PRIVATE_INTERNAL https://private.invalid/provider/account';
    // Inject the canonical fault at the catalogue boundary, keeping the real
    // validator and its pricing-read error projection in the execution path.
    const originalCaps=wan.modeCaps.t2v;
    assert.ok(originalCaps);
    const caps={...originalCaps};
    Object.defineProperty(caps,'aspectRatio',{get:()=>{throw error;}});
    const deps={...dependencies(),listPublicEngines:async()=>[{...wan,modeCaps:{...wan.modeCaps,t2v:caps}}]};
    const result=await failure(request,deps);
    assert.equal(result.error.code,'PARAMETER_INVALID');
    assert.equal(result.error.nextAction,null);
    assert.doesNotMatch(JSON.stringify(result),/PRIVATE_|SECRET_|providerAccountId|apiKey|https:|private\.invalid|aspectRatio/);
  }
});

test('upstream pricing errors cannot publish arbitrary field identities or private exception messages',async()=>{
  const request={...videoInput,settings:{...videoInput.settings,aspectRatio:'16:9'}};
  for(const field of ['providerAccountId','apiKey','https://private.invalid/SECRET_KEY','aspectRatio\nSECRET_KEY']){
    const error=new GenerationCapabilityError(field);
    error.message='PRIVATE_INTERNAL https://private.invalid/provider/account';
    const result=await failure(request,dependencies(async()=>{throw error;}));
    assert.equal(result.error.code,'PARAMETER_INVALID');
    assert.equal(result.error.nextAction,null);
    assert.doesNotMatch(JSON.stringify(result),/PRIVATE_|SECRET_|providerAccountId|apiKey|https:|private\.invalid/);
  }
});

test('reference-required and unsupported mode codes remain distinct from parameter correction',async()=>{
  const valid={...videoInput,settings:{...videoInput.settings,aspectRatio:'16:9'}};
  assert.equal((await failure({...valid,mode:'i2v'})).error.code,'REFERENCE_REQUIRED');
  assert.equal((await failure({...valid,mode:'reframe'})).error.code,'MODE_UNSUPPORTED');
});
