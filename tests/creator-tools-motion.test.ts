import assert from 'node:assert/strict';
import test from 'node:test';
import { creatorOperationInputSchema } from '../frontend/src/lib/toolbox/creator-tools';
import { prepareCreatorProfile, listCreatorToolProfiles } from '../frontend/src/server/tools/creator-profiles';
import { prepareCreatorMotionProvider, quoteCreatorMotion } from '../frontend/src/server/tools/creator-profiles-motion';
import { submitCreatorSpecialistOnce } from '../frontend/src/server/tools/creator-operations-specialist-provider';

test('Kling motion has truthful gate, orientation durations, source roles and canonical price',async()=>{
  const previous=process.env.CREATOR_MOTION_CONTROL_ENABLED;delete process.env.CREATOR_MOTION_CONTROL_ENABLED;
  try {
    const input=creatorOperationInputSchema.parse({toolId:'motion-transfer',version:1,inputs:[{role:'source',source:{type:'asset',assetId:'character',kind:'image'}},{role:'motion',source:{type:'asset',assetId:'movement',kind:'video'}}],settings:{orientation:'video',instruction:'Steady movement',audioPolicy:'preserve'}});
    const sources=input.inputs.map(entry=>({input:entry,asset:entry.source as {type:'asset';assetId:string;kind:'image'|'video'},url:`https://cdn.example.com/${entry.role}`,fingerprint:'frozen',facts:{kind:entry.source.kind,width:640,height:480,durationSec:entry.role==='motion'?25.4:null,hasAudio:entry.role==='motion',audioDurationSec:entry.role==='motion'?25.4:null,audioStartSec:0,fps:entry.role==='motion'?30:null,sizeBytes:1000,mimeType:entry.role==='motion'?'video/mp4':'image/png'}}));
    assert.equal(listCreatorToolProfiles().find(profile=>profile.id==='motion-kling-v3-v1')?.deploymentGateOpen,false);
    assert.throws(()=>prepareCreatorProfile({...input,profileId:'motion-kling-v3-v1'},sources),/qualification/);
    process.env.CREATOR_MOTION_CONTROL_ENABLED='1';
    const prepared=prepareCreatorProfile(input,sources);
    assert.equal(prepared.profile.id,'motion-kling-v3-v1');assert.equal(prepared.input.profileId,prepared.profile.id);
    assert.equal(prepared.request.engineId,'toolbox-motion-control');assert.equal(prepared.expectedDurationSec,25.4);
    const provider=prepareCreatorMotionProvider(prepared);
    assert.deepEqual(provider,{endpoint:'fal-ai/kling-video/v3/standard/motion-control',input:{image_url:'https://cdn.example.com/source',video_url:'https://cdn.example.com/motion',character_orientation:'video',prompt:'Steady movement',keep_original_sound:true}});
    assert.throws(()=>prepareCreatorProfile({...input,settings:{...input.settings,orientation:'image'}},sources),/10 seconds/);
    assert.throws(()=>prepareCreatorProfile({...input,settings:{...input.settings,resolution:'1080p'}},sources),/no resolution override/);
    assert.throws(()=>prepareCreatorProfile({...input,profileId:'motion-wan-reference-v1'},sources),/15 seconds/);
    const price=await quoteCreatorMotion(25.4,{pricingPolicy:{loadOverrides:async()=>({status:'loaded',rules:[{id:'toolbox-motion-control',engineId:'toolbox-motion-control',marginPercent:1.5,marginFlatCents:0,surchargeAudioPercent:0,surchargeUpscalePercent:0,currency:'USD',compatibilityProfile:'standard'}],routingRules:[]})}});
    assert.ok(price.totalCents>=320);assert.equal(price.meta?.providerCostListUsd,3.2004);
    let attempts=0;
    const submission=await submitCreatorSpecialistOnce(provider,async(url,options)=>{attempts++;assert.equal(url,'https://queue.fal.run/fal-ai/kling-video/v3/standard/motion-control');assert.equal(options?.redirect,'error');return new Response(JSON.stringify({request_id:'motion-provider-id'}));},'test-placeholder');
    assert.deepEqual(submission,{kind:'accepted',requestId:'motion-provider-id'});assert.equal(attempts,1);
    const live=listCreatorToolProfiles().find(profile=>profile.id==='motion-kling-v3-v1')!;
    assert.equal(live.deploymentGateOpen,true);assert.equal(live.constraints.duration?.maxByOrientation?.video,30);
    assert.equal(live.constraints.resolution,'provider');
    delete process.env.CREATOR_MOTION_CONTROL_ENABLED;
    assert.equal(listCreatorToolProfiles().find(profile=>profile.id==='motion-kling-v3-v1')?.deploymentGateOpen,false);
  }finally{if(previous===undefined)delete process.env.CREATOR_MOTION_CONTROL_ENABLED;else process.env.CREATOR_MOTION_CONTROL_ENABLED=previous;}
});
