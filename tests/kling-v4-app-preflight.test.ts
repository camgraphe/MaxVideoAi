import assert from 'node:assert/strict';
import test from 'node:test';
import type { ManualTariffCell } from '@maxvideoai/pricing';
import { KLING_V4_ENGINE } from '../frontend/src/config/fal-engines/kling-v4';
import { parsePreflightRequestPayload } from '../frontend/app/api/preflight/_lib/preflight-request';
import * as appPreflight from '../frontend/app/api/preflight/_lib/media-aware-preflight';
import { computeConfiguredPreflight } from '../frontend/src/server/engines';
import { computeCanonicalBillingSnapshot } from '../frontend/server/pricing/quote-billing';

const sourceUrl='https://media.maxvideoai.com/user-assets/offline-source.mp4';
const source={assetId:'source',slotId:'video_url',kind:'video' as const,url:sourceUrl};
const omitted={engine:'kling-v4',mode:'v2v',resolution:'720p',inputs:[source]};
const cell:ManualTariffCell={id:'offline-reviewed-v4',source:'database',version:7,currency:'USD',effectiveFrom:'2026-10-01T00:00:00Z',
 selector:{engineId:'kling-v4',mode:'v2v',resolution:'720p',durationSec:'continuous',billingInputType:'video_input',inputVideoDurationSec:'continuous'},
 price:{kind:'unit_terms',rounding:'up',terms:[{unit:'billable_seconds',centsPerUnit:20}]}};

test('App parser admits only V4 Modify omission and preserves explicit integer duration',()=>{
 const parsed=parsePreflightRequestPayload(omitted);
 assert.equal(parsed.ok,true);
 if(parsed.ok)assert.equal(parsed.request.durationSec,undefined);
 const explicit=parsePreflightRequestPayload({...omitted,durationSec:3});
 assert.equal(explicit.ok,true);if(explicit.ok)assert.equal(explicit.request.durationSec,3);
 for(const request of [{...omitted,mode:'t2v'},{...omitted,mode:'ref2v'},{...omitted,engine:'kling-3-pro'},{...omitted,engine:'seedance-2-5'},
  {...omitted,inheritedDurationSec:5.25}]){
  const result=parsePreflightRequestPayload(request);
  assert.equal(result.ok,false);
 }
});

test('actual App owned-media and canonical preflight quote source5.25 on omission and retain explicit3',async()=>{
 const resolveAdmitted=(appPreflight as unknown as {resolveAdmittedMediaAwarePreflight:typeof appPreflight.resolveMediaAwarePreflight}).resolveAdmittedMediaAwarePreflight;
 assert.equal(typeof resolveAdmitted,'function');
 const contexts:Array<{durationSec:number;inputVideoDurationSec?:number;inheritedDurationSec?:number}>=[];
 let probes=0;
 const dependencies={
  getConfiguredEngineFn:async()=>KLING_V4_ENGINE,
  mediaConstraintDeps:{queryFn:async <T>(sql:string,params?:readonly unknown[])=>{
   assert.match(sql,/user_id = \$1/);assert.equal(params?.[0],'offline-owner');
   return [{asset_id:'source',url:sourceUrl,mime_type:'video/mp4',size_bytes:1024,width:1280,height:720,duration_sec:5.25}] as T[];
  },detectVideoMetadataFn:async()=>{probes++;return {width:1280,height:720,durationSec:5.25,fps:24};}},
  // This invokes the real App compute owner and canonical tariff calculator; only read dependencies are local.
  computeConfiguredPreflightFn:async(request:Parameters<typeof computeConfiguredPreflight>[0],options?:Parameters<typeof computeConfiguredPreflight>[1])=>
   computeConfiguredPreflight(request,{...options,computePublicSnapshot:async(context)=>{
    contexts.push({durationSec:context.durationSec,inputVideoDurationSec:context.inputVideoDurationSec,inheritedDurationSec:context.inheritedDurationSec});
    return computeCanonicalBillingSnapshot(context,{pricingPolicy:{loadOverrides:async()=>({status:'loaded',rules:[]})},
     loadCustomerTariffState:async()=>({status:'loaded',active:true,revision:7,versionedCells:[],databaseCells:[cell]})});
   }}),
 };
 for(const [durationSec,expected] of [[undefined,210],[3,165]] as const){
  const parsed=parsePreflightRequestPayload({...omitted,...(durationSec===undefined?{}:{durationSec})});assert.equal(parsed.ok,true);if(!parsed.ok)continue;
  const result=await resolveAdmitted({request:parsed.request,userId:'offline-owner'},dependencies);
  assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.total,expected);assert.equal(result.pricing?.meta?.customerTariffRevision,7);
 }
 assert.deepEqual(contexts,[{durationSec:5.25,inputVideoDurationSec:5.25,inheritedDurationSec:5.25},{durationSec:3,inputVideoDurationSec:5.25,inheritedDurationSec:undefined}]);
 assert.equal(probes,2);
 const parsedOmission=parsePreflightRequestPayload(omitted);assert.equal(parsedOmission.ok,true);if(!parsedOmission.ok)return;
 for(const rows of [[],[{asset_id:'source',url:sourceUrl+'?changed-original',mime_type:'video/mp4',size_bytes:1024,width:1280,height:720,duration_sec:5.25}]]){
  const unavailable=await resolveAdmitted({request:parsedOmission.request,userId:'offline-owner'},
   {...dependencies,mediaConstraintDeps:{...dependencies.mediaConstraintDeps,queryFn:async()=>rows}} as never);
  assert.equal(unavailable.ok,false);assert.equal(contexts.length,2,'unowned or stale original must not reach price');
 }
 const foreign=await resolveAdmitted({request:parsedOmission.request,userId:'foreign-owner'},
  {...dependencies,mediaConstraintDeps:{...dependencies.mediaConstraintDeps,queryFn:async(_sql:string,params:readonly unknown[])=>{assert.equal(params[0],'foreign-owner');return [];}}} as never);
 assert.equal(foreign.ok,false);assert.equal(contexts.length,2);
 const reserved=parsePreflightRequestPayload({...omitted,extraInputValues:{inheritedDurationSec:5.25}});assert.equal(reserved.ok,true);if(!reserved.ok)return;
 const forged=await resolveAdmitted({request:reserved.request,userId:'offline-owner'},dependencies);
 assert.equal(forged.error?.code,'PRICING_MEDIA_FACTS_UNTRUSTED');assert.equal(contexts.length,2);

 const gated=await appPreflight.resolveMediaAwarePreflight({request:parsedOmission.request,userId:'offline-owner'},dependencies);
 assert.equal(gated.error?.code,'ENGINE_UNAVAILABLE');assert.equal(contexts.length,2,'the public release gate remains closed');
});
