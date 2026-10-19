import assert from 'node:assert/strict';
import test from 'node:test';
import { creatorOperationInputSchema } from '../frontend/src/lib/toolbox/creator-tools';
import { prepareCreatorProfile } from '../frontend/src/server/tools/creator-profiles';
import { prepareCreatorLipSyncProvider,quoteCreatorLipSync } from '../frontend/src/server/tools/creator-profiles-lipsync';
import { submitCreatorLipSyncOnce } from '../frontend/src/server/tools/creator-operations-lipsync-provider';
test('paid submission makes one attempt and distinguishes rejection from ambiguous transport',async()=>{
  const request={endpoint:'fal-ai/latentsync',input:{video_url:'https://cdn.example.com/video',audio_url:'https://cdn.example.com/audio'}};
  for(const [response,expected] of [[new Response('{}',{status:422}),'rejected'],[new Response('{}',{status:503}),'ambiguous'],[new Response(JSON.stringify({request_id:'returned-id'}),{status:200}),'accepted']] as const){
    let attempts=0;const result=await submitCreatorLipSyncOnce(request,async()=>{attempts++;return response;},'test-placeholder');
    assert.equal(attempts,1);assert.equal(result.kind,expected);
  }
  let attempts=0;assert.equal((await submitCreatorLipSyncOnce(request,async()=>{attempts++;throw new Error('disconnected');},'test-placeholder')).kind,'ambiguous');assert.equal(attempts,1);
});
test('LatentSync remains release gated, uses exact matching owned segments and a dedicated pricing domain',async()=>{
  const old=process.env.CREATOR_LIP_VIDEO_ENABLED;delete process.env.CREATOR_LIP_VIDEO_ENABLED;
  try {
    const input=creatorOperationInputSchema.parse({toolId:'lip-sync',version:1,inputs:[{role:'source',source:{type:'asset',assetId:'video',kind:'video'}},{role:'audio',source:{type:'asset',assetId:'audio',kind:'audio'}}],settings:{mode:'video'}});
    const sources=input.inputs.map(entry=>({input:entry,asset:entry.source as {type:'asset';assetId:string;kind:'video'|'audio'},url:`https://cdn.example.com/${entry.role}`,fingerprint:'frozen',facts:{kind:entry.source.kind,width:640,height:480,durationSec:7.4,hasAudio:true,audioDurationSec:7.4,audioStartSec:0,fps:30,sizeBytes:1000,mimeType:entry.source.kind==='audio'?'audio/wav':'video/mp4'}}));
    assert.throws(()=>prepareCreatorProfile(input,sources),/qualification/);
    process.env.CREATOR_LIP_VIDEO_ENABLED='1';
    const prepared=prepareCreatorProfile(input,sources);
    assert.equal(prepared.request.engineId,'toolbox-lip-sync');assert.equal(prepared.profile.qualification,'tool-specific');
    assert.deepEqual(prepareCreatorLipSyncProvider(prepared),{endpoint:'fal-ai/latentsync',input:{video_url:'https://cdn.example.com/source',audio_url:'https://cdn.example.com/audio'}});
    const price=await quoteCreatorLipSync(7.4,{pricingPolicy:{loadOverrides:async()=>({status:'loaded',rules:[{id:'toolbox-lip-sync',engineId:'toolbox-lip-sync',marginPercent:1.5,marginFlatCents:0,surchargeAudioPercent:0,surchargeUpscalePercent:0,currency:'USD',compatibilityProfile:'standard'}],routingRules:[]})}});
    assert.ok(price.totalCents>=20);assert.equal(price.meta?.providerCostListUsd,0.2);
    assert.throws(()=>prepareCreatorProfile(input,[sources[0],{...sources[1],facts:{...sources[1].facts,durationSec:8}}]),/same duration/);
  } finally {if(old===undefined)delete process.env.CREATOR_LIP_VIDEO_ENABLED;else process.env.CREATOR_LIP_VIDEO_ENABLED=old;}
});
