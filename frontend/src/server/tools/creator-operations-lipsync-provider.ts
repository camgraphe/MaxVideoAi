import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { query,withDbTransaction } from '@/lib/db';
import { ENV } from '@/lib/env';
import { getFalClient } from '@/lib/fal-client';
import { upsertJobOutputs } from '@/server/media-library';
import type { GenerationActor } from '@/server/agent-api/generation-actor';
import { CREATOR_LIP_SYNC_ENDPOINT } from './creator-profiles-lipsync';
import { readCreatorOperation,type StoredCreatorOperation } from './creator-operations-store';
import { refundCreatorFinalization } from './creator-operations-refund';
import { downloadCreatorMedia,inspectCreatorBytes,withCreatorMediaSlot,validateCreatorOutputTiming } from './creator-segment-media';
import { persistCreatorMedia } from './creator-sources';

export type CreatorLipSubmission={kind:'accepted';requestId:string}|{kind:'rejected'}|{kind:'ambiguous'};
/** A single paid POST. The SDK queue submit retry policy is intentionally bypassed. */
export async function submitCreatorLipSyncOnce(request:{endpoint:string;input:{video_url:string;audio_url:string}},fetcher:typeof fetch=fetch,apiKey:string|undefined=ENV.FAL_API_KEY):Promise<CreatorLipSubmission>{
  if(request.endpoint!==CREATOR_LIP_SYNC_ENDPOINT)throw new Error('Invalid specialist endpoint.');
  if(!apiKey)return{kind:'rejected'};
  try {
    const response=await fetcher(`https://queue.fal.run/${CREATOR_LIP_SYNC_ENDPOINT}`,{method:'POST',redirect:'error',headers:{Authorization:`Key ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify(request.input),signal:AbortSignal.timeout(30_000)});
    if(!response.ok)return{kind:[400,401,403,404,422,429].includes(response.status)?'rejected':'ambiguous'};
    const parsed=z.object({request_id:z.string().min(1).max(512)}).safeParse(await response.json());
    return parsed.success?{kind:'accepted',requestId:parsed.data.request_id}:{kind:'ambiguous'};
  }catch{return{kind:'ambiguous'};}
}
export async function failCreatorLipSync(actor:GenerationActor,id:string,message:string):Promise<void>{
  await withDbTransaction(async tx=>{
    await tx.query('SELECT id FROM creator_operations WHERE id=$1 AND user_id=$2 FOR UPDATE',[id,actor.userId]);
    const row=await readCreatorOperation(actor,id,tx,false,true);
    if(row.status==='completed'||row.status==='failed'||row.provider_state==='completed'||row.profile_id!=='lip-video-latentsync-v1')return;
    await tx.query("UPDATE app_jobs SET status='failed',provisional=FALSE,updated_at=now() WHERE job_id=$1 AND user_id=$2 AND status<>'completed'",[row.job_id,actor.userId]);
    await refundCreatorFinalization(tx,actor.userId,id,{providerFailure:true});
    await tx.query("UPDATE creator_operations SET status='failed',provider_state='failed',error=$2,provider_lease_token=NULL,provider_lease_expires_at=NULL,updated_at=now() WHERE id=$1",[id,`${message} The charge was refunded.`]);
  });
}
const defaults={
  poll:async(requestId:string,signal:AbortSignal)=>getFalClient().queue.status(CREATOR_LIP_SYNC_ENDPOINT,{requestId,logs:false,abortSignal:signal}),
  result:async(requestId:string,signal:AbortSignal)=>getFalClient().queue.result(CREATOR_LIP_SYNC_ENDPOINT,{requestId,abortSignal:signal}),
  persist:async(actor:GenerationActor,row:StoredCreatorOperation,data:unknown)=>withCreatorMediaSlot(actor.userId,async()=>{
    const video=z.object({video:z.object({url:z.string().url().startsWith('https://')})}).parse(data).video;
    const file=await downloadCreatorMedia({file_id:row.id,download_url:video.url});const facts=await inspectCreatorBytes(file.bytes,'video',file.mimeType);
    validateCreatorOutputTiming(row.snapshot.expectedDurationSec!,facts.durationSec,facts.fps);
    const saved=await persistCreatorMedia(actor.userId,file.bytes,facts,{version:1,toolId:'lip-sync',profileId:row.profile_id,operationId:row.id,role:'provider-original'});
    const outputId=`${row.job_id}:video:0`;
    await upsertJobOutputs([{id:outputId,jobId:row.job_id!,userId:actor.userId,kind:'video',url:saved.url,storageUrl:saved.url,thumbUrl:saved.thumbnailUrl,previewUrl:null,mimeType:facts.mimeType,width:facts.width,height:facts.height,durationSec:facts.durationSec,position:0,status:'ready',metadata:{creatorOperationId:row.id,mediaFacts:{source:'probe',...facts}}}]);
    return{url:saved.url,thumbnailUrl:saved.thumbnailUrl};
  }),
};
export async function refreshCreatorLipSync(actor:GenerationActor,row:StoredCreatorOperation,dependencies:Partial<typeof defaults>={}):Promise<void>{
  const deps={...defaults,...dependencies};
  if(row.profile_id!=='lip-video-latentsync-v1'||!row.job_id||row.status==='failed'||row.status==='completed'||row.provider_state==='completed')return;
  const age=Date.now()-new Date(row.provider_started_at??0).getTime();
  if(!row.provider_request_id){if(age>15*60_000)await failCreatorLipSync(actor,row.id,'Provider acceptance could not be recovered; no second request was sent.');return;}
  if(age>60*60_000){await failCreatorLipSync(actor,row.id,'Provider processing could not be recovered within one hour.');return;}
  let data:unknown;
  const signal=AbortSignal.timeout(10_000);
  try {const status=await deps.poll(row.provider_request_id,signal);if(status.status!=='COMPLETED')return;data=(await deps.result(row.provider_request_id,signal)).data;}
  catch(error){if(error&&typeof error==='object'&&'status' in error&&[400,422].includes(Number(error.status)))await failCreatorLipSync(actor,row.id,'Provider processing failed.');return;}
  if(signal.aborted)return;
  const token=randomUUID();
  const claim=await query(`UPDATE creator_operations SET provider_state='persisting',provider_lease_token=$2::uuid,provider_lease_expires_at=now()+interval '10 minutes'
    WHERE id=$1 AND status='running' AND (provider_state='pending' OR (provider_state='persisting' AND provider_lease_expires_at<now())) RETURNING id`,[row.id,token]);
  if(!claim.length)return;
  try {
    const output=await deps.persist(actor,row,data);
    await withDbTransaction(async tx=>{
      const updated=await tx.query("UPDATE creator_operations SET provider_state='completed',provider_lease_token=NULL,provider_lease_expires_at=NULL,updated_at=now() WHERE id=$1 AND provider_lease_token=$2::uuid AND provider_state='persisting' AND status='running' RETURNING id",[row.id,token]);
      if(!updated.length)return;
      await tx.query("UPDATE app_jobs SET status='completed',progress=100,video_url=$2,thumb_url=$3,provisional=FALSE,updated_at=now() WHERE job_id=$1 AND user_id=$4 AND payment_status='paid_wallet'",[row.job_id,output.url,output.thumbnailUrl,actor.userId]);
    });
  }catch{
    // Storage/probe failures retry from the durable provider ID. The one-hour bound guarantees reconciliation.
    await query("UPDATE creator_operations SET provider_state='pending',provider_lease_token=NULL,provider_lease_expires_at=NULL,updated_at=now() WHERE id=$1 AND provider_lease_token=$2::uuid AND provider_state='persisting'",[row.id,token]);
  }
}
