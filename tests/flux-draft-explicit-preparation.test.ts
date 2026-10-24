import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareOwnedFluxDraftSource } from '../frontend/server/prepare-flux-draft-source';
import { createPrepareGenerationService } from '../frontend/src/server/agent-api/prepare-generation';
import { readGenerationPricing } from '../frontend/src/server/agent-api/generation-pricing-read';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { qualifyFluxDraftPair } from '../frontend/server/flux-draft-cache';
import { normalizeGenerationRequest } from '../frontend/src/server/agent-api/generation-normalization';
import { studioMediaIntentSchema } from '../frontend/lib/studio/conversation-media-contract';
import { studioMediaRequest } from '../frontend/src/server/studio/conversation-media-generation';
const origin={ownerId:'owner',jobId:'draft',outputId:'out',providerRequestId:'private-request',attemptId:1,provenance:{kind:'provider_attempt' as const},endpoint:'blackforestlabs/flux-3/text-to-video/draft',outputUrl:'https://media.invalid/original.mp4',outputSha256:'a'.repeat(64)};
const pair=qualifyFluxDraftPair(origin,{providerRequestId:origin.providerRequestId,providerVideoUrl:'https://v3.fal.media/output.mp4',cacheUrl:'https://v3.fal.media/private-cache',ownedSha256:origin.outputSha256,videoIdentity:'same',ownedVideoIdentity:'same',audioIdentity:null,ownedAudioIdentity:null,durationSec:5.56,fps:25,decodedFrameCount:139});
const entry=getFalEngineById('flux-3-draft')!;
const candidate={engine:entry.engine,surface:'video' as const,publicModes:entry.engine.modes,modeCaps:entry.engine.modeCaps!};
const request=normalizeGenerationRequest({surface:'video',engineId:'flux-3-draft',mode:'v2v',operation:'flux-draft-enhance',sourceJobId:'draft',sourceOutputId:'out',prompt:'',settings:{resolution:'1080p'},references:[],outputCount:1});
function lifecycle() {
 let ready=false,recoveries=0;
 const resolve=async(input:any)=>{assert.equal(input.userId,'owner');assert.equal(input.sourceJobId,'draft');assert.equal(input.sourceOutputId,'out');if(!ready)throw new Error('historical cache absent');return pair;};
 const prepare=(input:any)=>prepareOwnedFluxDraftSource(input,{resolve,recover:async()=>{recoveries++;ready=true;return {enhanceable:true,...({} as any)};}});
 return {resolve,prepare,get recoveries(){return recoveries;}};
}
test('MCP explicit prepare recovers historical native Draft before exact quote, while pricing.read stays read-only',async()=>{
 const state=lifecycle();let writes=0;
 const principal={userId:'owner',clientId:'client',authMethod:'oauth' as const,emailVerified:true};
 const deps={paidGenerationEnabled:()=>true,getAccountRestriction:async()=>null,listPublicEngines:async()=>[candidate],
  prepareFluxDraftSource:state.prepare,resolveFluxLineage:async()=>state.resolve({userId:'owner',sourceJobId:'draft',sourceOutputId:'out'}),
  resolveRequestExecutability:()=>({executable:true as const,reason:'available' as const}),
  resolveMembershipPricing:async()=>({tier:'member' as const,source:'app_receipts_rolling_30d' as const,spent30Cents:0,thresholdCents:0,discountPercent:0}),
  priceGeneration:async()=>({priceCents:222,currency:'USD',membershipTier:'member' as const,pricingSnapshot:{totalCents:222,currency:'USD',membershipTier:'member'}}),
  getWalletSummary:async()=>({balanceCents:1000,currency:'USD'} as any),withTransaction:async(fn:any)=>fn({}),checkSpendingLimits:async()=>({allowed:true} as any),
  insertPreparedQuote:async(input:any)=>{writes++;return {...input,quoteId:'quote',authOrigin:'oauth',expiresAt:new Date('2030-01-01')};},
 };
 await assert.rejects(readGenerationPricing(request,principal,deps));assert.equal(state.recoveries,0);assert.equal(writes,0);
 const prepare=createPrepareGenerationService('https://maxvideoai.com/account/connections',{clientIp:null,userAgent:null},deps as any);
 const result=await prepare(request,principal);
 assert.equal(state.recoveries,1);assert.equal(writes,1);assert.equal(result.confirmationRequired,true);assert.equal(result.summary.sourceJobId,'draft');
 assert.equal(JSON.stringify(result).includes('private-request'),false);assert.equal(JSON.stringify(result).includes('private-cache'),false);
});
test('Studio video.prepare authorizes project output then recovers; caller cache URLs cannot become authority',async()=>{
 const state=lifecycle(),actor={userId:'owner',projectId:'project',authMethod:'studio-session' as const,clientId:null};
 const ref={type:'job-output' as const,jobId:'draft',outputId:'out',kind:'video' as const};
 const input={requestId:'00000000-0000-4000-8000-000000000001',message:'Enhance',references:[],attachments:[]};
 const action=studioMediaIntentSchema.parse({action:'video.prepare',reply:'Review',modelId:'flux-3-draft',mode:'v2v',operation:'flux-draft-enhance',prompt:'',aspectRatio:'16:9',source:ref,settings:[{name:'resolution',value:'1080p'}]});
 const dependencies={readProjectMedia:async()=>[{ref,name:'Draft',durationSec:5.56}],resolveMedia:async()=>({id:'out',ref,kind:'video',url:origin.outputUrl,mime:'video/mp4',thumbUrl:null,previewUrl:null,originalAccess:{type:'external'}} as any),prepareFluxDraftSource:state.prepare,resolveFluxDraftSource:state.resolve};
 const factories={video:()=>({catalog:async()=>[candidate]})} as any;
 const result=await studioMediaRequest(actor,action,input,factories,true,dependencies);
 assert.equal(result.surface,'video');assert.equal((result as any).sourceJobId,'draft');assert.equal(state.recoveries,1);
 const denied=lifecycle();await assert.rejects(studioMediaRequest(actor,action,input,factories,true,{...dependencies,readProjectMedia:async()=>[],prepareFluxDraftSource:denied.prepare}));assert.equal(denied.recoveries,0);
});
test('missing/null historical cache keeps a safe explicit failure and no pricing fallback',async()=>{
 await assert.rejects(prepareOwnedFluxDraftSource({userId:'owner',sourceJobId:'draft'},{resolve:async()=>{throw new Error('missing');},recover:async()=>({enhanceable:false,reason:'cache_missing'})}),{code:'REFERENCE_INVALID'});
});
