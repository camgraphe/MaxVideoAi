import assert from 'node:assert/strict';
import test from 'node:test';
import { creatorOperationInputSchema } from '../frontend/src/lib/toolbox/creator-tools';
import { prepareCreatorProfile } from '../frontend/src/server/tools/creator-profiles';
import { createCreatorOperationsService } from '../frontend/src/server/tools/creator-operations';
import { hashCanonicalGenerationRequest } from '../frontend/src/server/agent-api/generation-normalization';
import type { StoredCreatorOperation } from '../frontend/src/server/tools/creator-operations-store';

function row(): StoredCreatorOperation {
  const input=creatorOperationInputSchema.parse({toolId:'lip-sync',version:1,inputs:[{role:'source',source:{type:'asset',assetId:'portrait',kind:'image'}},{role:'audio',source:{type:'asset',assetId:'voice',kind:'audio'}}],settings:{mode:'photo'}});
  const prepared=prepareCreatorProfile(input,input.inputs.map(entry=>({input:entry,asset:entry.source as {type:'asset';assetId:string;kind:'image'|'audio'},url:`https://owned.example/${entry.role}`,fingerprint:'snapshot',facts:{kind:entry.source.kind,width:640,height:480,durationSec:entry.role==='audio'?2.53:null,hasAudio:entry.role==='audio',audioDurationSec:entry.role==='audio'?2.53:null,audioStartSec:0,fps:null,sizeBytes:1000,mimeType:entry.role==='audio'?'audio/wav':'image/png'}})));
  return {id:'12345678-1234-4234-8234-123456789abc',user_id:'owner',auth_origin:'toolbox-session',oauth_client_id:null,studio_project_id:null,tool_id:'lip-sync',profile_id:prepared.profile.id,profile_revision:1,request_hash:hashCanonicalGenerationRequest(prepared.request),snapshot:{...prepared,referenceFingerprint:'snapshot'},status:'prepared',result:null,error:null,version:1,lease_token:null,finalize_attempts:0,job_id:null,quote_state:'prepared'};
}
test('retired LTX and altered output policies cannot confirm or submit an old prepared quote',async()=>{
  const legacy=row();legacy.profile_id='lip-photo-ltx-v1';legacy.snapshot.profile={...legacy.snapshot.profile,id:legacy.profile_id};legacy.snapshot.input={...legacy.snapshot.input,profileId:legacy.profile_id};legacy.snapshot.outputTiming=undefined;
  const changed=row();changed.snapshot.outputTiming={kind:'trim-generated-tail',generatedDurationSec:4};
  for(const snapshot of [legacy,changed]) {
    let effects=0;
    const service=createCreatorOperationsService({authMethod:'toolbox-session',userId:'owner',clientId:null},{enabled:true,dependencies:{
      read:async()=>snapshot,revalidate:async()=>{effects++;},generation:()=>{effects++;throw Error('Must reject before provider or payment');},
    }});
    await assert.rejects(service.confirm({operationId:snapshot.id,confirmed:true}),/qualification|profile changed/);
    assert.equal(effects,0);
  }
});
