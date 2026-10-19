import {randomUUID} from 'node:crypto';
import {query,withDbTransaction} from '@/lib/db';
import {reserveWalletChargeInExecutor} from '@/lib/wallet';
import {getUserPreferredCurrency} from '@/lib/currency';
import {requireGenerationActor,type GenerationActor} from '../agent-api/generation-actor';
import type {SubtitleDocument,SubtitleSource} from '../../lib/subtitles/document';
import type {ScribeSettings} from './scribe';
import type {probeSubtitleMedia} from './media';
export type SubtitlePricing={totalCents:number;currency:string;[key:string]:unknown};
export type SubtitleOperationRequest={source:SubtitleSource;facts:Awaited<ReturnType<typeof probeSubtitleMedia>>;settings:ScribeSettings;document?:SubtitleDocument};
export type SubtitleOperationRecord={id:string;user_id:string;auth_origin:string;oauth_client_id:string|null;studio_project_id:string|null;operation_kind:'transcribe'|'render';state:'prepared'|'queued'|'processing'|'submitting'|'provider-pending'|'completed'|'failed';request_snapshot:SubtitleOperationRequest;pricing_snapshot:SubtitlePricing;export_estimate:Record<string,unknown>|null;job_id:string|null;provider_request_id:string|null;prepared_audio:{audioUrl:string;storageKey:string;storageUrl:string}|null;result:Record<string,unknown>|null;message:string|null;lease_token:string|null;expires_at:Date|string};
const defaults={query,transaction:withDbTransaction,reserve:reserveWalletChargeInExecutor,preferredCurrency:getUserPreferredCurrency};
function actorValues(actor:GenerationActor){requireGenerationActor(actor);return [actor.userId,actor.authMethod,actor.clientId,actor.authMethod==='studio-session'?actor.projectId:null];}
const owned="o.id=$1 AND o.user_id=$2 AND o.auth_origin=$3 AND o.oauth_client_id IS NOT DISTINCT FROM $4 AND o.studio_project_id IS NOT DISTINCT FROM $5";
export function createSubtitleJobStore(overrides:Partial<typeof defaults>={}){
  const dependencies={...defaults,...overrides};
  async function prepare(actor:GenerationActor,kind:SubtitleOperationRecord['operation_kind'],request:SubtitleOperationRequest,pricing:SubtitlePricing,exportEstimate?:Record<string,unknown>){
    requireGenerationActor(actor);
    if(!Number.isSafeInteger(pricing.totalCents)||pricing.totalCents<1||pricing.currency!=='USD')throw new Error('SUBTITLE_PRICING_UNAVAILABLE');
    const id=randomUUID();const rows=await dependencies.query<SubtitleOperationRecord>(`INSERT INTO subtitle_operations(id,user_id,auth_origin,oauth_client_id,studio_project_id,operation_kind,request_snapshot,pricing_snapshot,export_estimate,expires_at)
      VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,NOW()+INTERVAL '5 minutes') RETURNING *`,[id,...actorValues(actor),kind,JSON.stringify(request),JSON.stringify(pricing),exportEstimate?JSON.stringify(exportEstimate):null]);return rows[0];
  }
  async function read(actor:GenerationActor,id:string){const rows=await dependencies.query<SubtitleOperationRecord>(`SELECT o.* FROM subtitle_operations o LEFT JOIN app_jobs j ON j.job_id=o.job_id WHERE ${owned} AND j.hidden IS NOT TRUE`,[id,...actorValues(actor)]);if(!rows[0])throw new Error('SUBTITLE_OPERATION_NOT_FOUND');return rows[0];}
  async function reserve(actor:GenerationActor,id:string){
    const currency=await dependencies.preferredCurrency(actor.userId);
    return dependencies.transaction(async executor=>{
      const rows=await executor.query<SubtitleOperationRecord>(`SELECT o.* FROM subtitle_operations o LEFT JOIN app_jobs j ON j.job_id=o.job_id WHERE ${owned} AND j.hidden IS NOT TRUE FOR UPDATE OF o`,[id,...actorValues(actor)]);const operation=rows[0];
      if(!operation)throw new Error('SUBTITLE_OPERATION_NOT_FOUND');
      if(operation.state!=='prepared')return {operation,created:false};
      if(new Date(operation.expires_at).getTime()<=Date.now())throw new Error('SUBTITLE_QUOTE_EXPIRED');
      const jobId=`subtitle_${operation.id}`,pricing=operation.pricing_snapshot;
      if(!Number.isSafeInteger(pricing.totalCents)||pricing.totalCents<1||pricing.currency!=='USD')throw new Error('SUBTITLE_PRICING_UNAVAILABLE');
      const charge=await dependencies.reserve(executor,{userId:actor.userId,jobId,surface:'tool',billingProductKey:`tool:subtitles:${operation.operation_kind}`,amountCents:pricing.totalCents,currency:'USD',description:`Subtitles ${operation.operation_kind}`,pricingSnapshotJson:JSON.stringify(pricing),applicationFeeCents:null,vendorAccountId:null,stripePaymentIntentId:null,stripeChargeId:null},{preferredCurrency:currency});
      if(!charge.ok)throw new Error(charge.errorCode==='currency_mismatch'?'CURRENCY_MISMATCH':'INSUFFICIENT_FUNDS');
      await executor.query(`INSERT INTO app_jobs(job_id,user_id,surface,billing_product_key,engine_id,engine_label,duration_sec,prompt,thumb_url,status,progress,final_price_cents,pricing_snapshot,settings_snapshot,currency,payment_status,visibility,indexable,provisional)
        VALUES($1,$2,'tool',$3,'toolbox-subtitles','Subtitles',$4,'','/assets/frames/thumb-1x1.svg','queued',0,$5,$6::jsonb,$7::jsonb,'USD','paid_wallet','private',FALSE,TRUE)`,[jobId,actor.userId,`tool:subtitles:${operation.operation_kind}`,Math.ceil(operation.request_snapshot.source.durationMs/1000),pricing.totalCents,JSON.stringify(pricing),JSON.stringify({toolId:'subtitles',operationId:operation.id,operation:operation.operation_kind})]);
      const updated=await executor.query<SubtitleOperationRecord>("UPDATE subtitle_operations SET state='queued',job_id=$2,updated_at=NOW() WHERE id=$1 RETURNING *",[id,jobId]);return {operation:updated[0],created:true};
    });
  }
  async function claim(id:string){
    const rows=await dependencies.query<SubtitleOperationRecord>(`UPDATE subtitle_operations SET state='processing',lease_until=NOW()+INTERVAL '40 minutes',lease_token=$2,updated_at=NOW()
      WHERE id=$1 AND job_id IS NOT NULL AND (state='queued' OR (state='processing' AND lease_until<NOW() AND provider_request_id IS NULL)) RETURNING *`,[id,randomUUID()]);return rows[0]??null;
  }
  async function submitting(id:string,audio:NonNullable<SubtitleOperationRecord['prepared_audio']>,leaseToken?:string|null){
    const rows=await dependencies.query("UPDATE subtitle_operations SET state='submitting',prepared_audio=$2::jsonb,updated_at=NOW() WHERE id=$1 AND state='processing' AND provider_request_id IS NULL AND ($3::text IS NULL OR lease_token=$3) RETURNING id",[id,JSON.stringify(audio),leaseToken??null]);
    if(!rows[0])throw new Error('SUBTITLE_CLAIM_LOST');
  }
  async function submitted(id:string,requestId:string,leaseToken?:string|null){
    await dependencies.transaction(async executor=>{
      const rows=await executor.query<SubtitleOperationRecord>("UPDATE subtitle_operations SET state='provider-pending',provider_request_id=$2,lease_until=NULL,updated_at=NOW() WHERE id=$1 AND state='submitting' AND ($3::text IS NULL OR lease_token=$3) RETURNING *",[id,requestId,leaseToken??null]);
      if(!rows[0])throw new Error('SUBTITLE_CLAIM_LOST');
      await executor.query("UPDATE app_jobs SET provider='fal',provider_job_id=$2,status='queued',updated_at=NOW() WHERE job_id=$1 AND payment_status='paid_wallet'",[rows[0].job_id,requestId]);
    });
  }
  async function readWork(id:string){return (await dependencies.query<SubtitleOperationRecord>('SELECT * FROM subtitle_operations WHERE id=$1 AND job_id IS NOT NULL',[id]))[0]??null;}
  async function claimCompletion(id:string){return (await dependencies.query<SubtitleOperationRecord>("UPDATE subtitle_operations SET state='processing',lease_until=NOW()+INTERVAL '15 minutes',lease_token=$2,updated_at=NOW() WHERE id=$1 AND (state='provider-pending' OR (state='processing' AND provider_request_id IS NOT NULL AND lease_until<NOW())) RETURNING *",[id,randomUUID()]))[0]??null;}
  async function terminal(id:string,result:Record<string,unknown>|null,message?:string,leaseToken?:string|null){
    await dependencies.transaction(async executor=>{
      const rows=await executor.query<SubtitleOperationRecord>('SELECT * FROM subtitle_operations WHERE id=$1 FOR UPDATE',[id]);const operation=rows[0];
      if(!operation?.job_id||operation.state==='completed'||operation.state==='failed')return;
      if(leaseToken&&operation.lease_token!==leaseToken)throw new Error('SUBTITLE_CLAIM_LOST');
      if(result&&operation.state!=='processing')throw new Error('SUBTITLE_CLAIM_LOST');
      await executor.query('SELECT pg_advisory_xact_lock(hashtext($1))',[operation.job_id]);
      const job=(await executor.query<{payment_status:string;status:string}>('SELECT payment_status,status FROM app_jobs WHERE job_id=$1 AND user_id=$2 FOR UPDATE',[operation.job_id,operation.user_id]))[0];
      if(!job||job.payment_status!=='paid_wallet'||job.status==='completed')return;
      if(result){
        await executor.query("UPDATE app_jobs SET status='completed',progress=100,video_url=$2,settings_snapshot=settings_snapshot||jsonb_build_object('subtitleResult',$3::jsonb),provisional=FALSE,updated_at=NOW() WHERE job_id=$1",[operation.job_id,typeof result.originalUrl==='string'?result.originalUrl:null,JSON.stringify(result)]);
        await executor.query("UPDATE subtitle_operations SET state='completed',result=$2::jsonb,lease_until=NULL,updated_at=NOW() WHERE id=$1",[id,JSON.stringify(result)]);
      }else{
        await executor.query(`INSERT INTO app_receipts(user_id,type,amount_cents,currency,description,job_id,surface,billing_product_key,pricing_snapshot)
          SELECT user_id,'refund',final_price_cents,currency,'Refund subtitles',job_id,surface,billing_product_key,pricing_snapshot FROM app_jobs WHERE job_id=$1 AND payment_status='paid_wallet' ON CONFLICT DO NOTHING`,[operation.job_id]);
        await executor.query("UPDATE app_jobs SET status='failed',payment_status='refunded_wallet',message=$2,provisional=FALSE,updated_at=NOW() WHERE job_id=$1",[operation.job_id,message??'Subtitle processing failed.']);
        await executor.query("UPDATE subtitle_operations SET state='failed',message=$2,lease_until=NULL,updated_at=NOW() WHERE id=$1",[id,message??'Subtitle processing failed.']);
      }
    });
  }
  async function pending(limit=5){const bounded=Math.max(1,Math.min(10,Math.floor(limit)));return dependencies.query<SubtitleOperationRecord>(`WITH candidates AS (SELECT id FROM subtitle_operations WHERE state IN ('queued','provider-pending') OR (state='processing' AND lease_until<NOW()) ORDER BY last_observed_at NULLS FIRST,created_at LIMIT $1 FOR UPDATE SKIP LOCKED)
    UPDATE subtitle_operations o SET last_observed_at=NOW() FROM candidates c WHERE o.id=c.id RETURNING o.*`,[bounded]);}
  return {prepare,read,reserve,claim,submitting,submitted,readWork,claimCompletion,complete:(id:string,result:Record<string,unknown>,leaseToken?:string|null)=>terminal(id,result,undefined,leaseToken),fail:(id:string,message:string,leaseToken?:string|null)=>terminal(id,null,message,leaseToken),pending};
}
export const subtitleJobs=createSubtitleJobStore();
