import assert from 'node:assert/strict';
import test from 'node:test';
import {priceCanonicalGeneration,type GenerationPricingDependencies} from '../frontend/src/server/agent-api/generation-pricing';
import type {CanonicalGenerationRequest} from '../frontend/src/server/agent-api/generation-types';
import type {ResolvedReference} from '../frontend/src/server/agent-api/reference-types';

const assetId='ma_'+'a'.repeat(32);
const source:ResolvedReference={assetId,role:'source',mediaKind:'video',storageUrl:'https://cdn.maxvideoai.com/owned.mp4',mimeType:'video/mp4',width:1920,height:1080,durationSec:3.25};
function request(mode:'v2v'|'extend'):CanonicalGenerationRequest{return{schemaVersion:1,surface:'video',engineId:'gemini-omni-flash',mode,prompt:'Keep the supplied action.',settings:{durationSec:5,resolution:'720p',audio:true},references:[{kind:'asset',assetId,role:'source'}],outputCount:1};}
function dependencies(inspect:NonNullable<GenerationPricingDependencies['computeVideoPreflight']>):GenerationPricingDependencies{return{computeVideoPreflight:inspect,estimateImage:async()=>{throw new Error('Image pricing is outside this test');}};}
const priced={ok:true,total:123,currency:'USD',pricing:{totalCents:123,currency:'USD',membershipTier:'member'}} as never;
for(const mode of ['v2v','extend'] as const)test(`Omni ${mode} price receives exact owned fractional source duration`,async()=>{
  await priceCanonicalGeneration(request(mode),'member',dependencies(async(_request,options)=>{
    assert.equal(options?.trustedMediaPricingFacts?.inputVideoDurationSec,3.25);
    assert.equal((options?.trustedMediaPricingFacts as {inheritedDurationSec?:number})?.inheritedDurationSec,mode==='v2v'?3.25:undefined);
    assert.equal((options?.trustedMediaPricingFacts as {inputImageCount?:number})?.inputImageCount,0);
    return priced;
  }),{resolvedReferences:[source]});
});
test('Omni source pricing refuses missing ownership measurements and caller settings cannot replace them',async()=>{
  let calls=0;const deps=dependencies(async()=>{calls++;return priced;});
  for(const references of [undefined,[],[{...source,durationSec:null}],[{...source,durationSec:Number.NaN}],[{...source,durationSec:0}],[{...source,durationSec:11}]])
    await assert.rejects(priceCanonicalGeneration(request('v2v'),'member',deps,{resolvedReferences:references}));
  assert.equal(calls,0);
});
test('Omni image pricing counts all selected frames while only video source modes inherit timing',async()=>{
  const input={...request('v2v'),mode:'fl2v' as const,references:[{kind:'asset' as const,assetId,role:'first_frame' as const},{kind:'asset' as const,assetId:'ma_'+'b'.repeat(32),role:'last_frame' as const}]};
  const refs=input.references.map(reference=>({...source,assetId:reference.assetId,role:reference.role,mediaKind:'image' as const,durationSec:null}));
  await priceCanonicalGeneration(input,'member',dependencies(async(_request,options)=>{assert.equal((options?.trustedMediaPricingFacts as {inputImageCount?:number})?.inputImageCount,2);assert.equal((options?.trustedMediaPricingFacts as {inheritedDurationSec?:number})?.inheritedDurationSec,undefined);return priced;}),{resolvedReferences:refs});
});
