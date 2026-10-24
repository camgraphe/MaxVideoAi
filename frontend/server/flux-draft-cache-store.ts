import {resolveFluxDraftProvenance,type FluxDraftAttempt,type FluxDraftQueueEvent} from './flux-draft-provenance';
import { query, isTransactionQueryExecutor, type QueryExecutor, type TransactionQueryExecutor } from '@/lib/db';
import { AgentApiError } from '@/server/agent-api/errors';
import { FLUX_NATIVE_DRAFT_ENDPOINTS, sameFluxDraftOrigin, checkFluxDraftCacheAvailability, type FluxDraftOrigin, type QualifiedFluxDraftSource } from './flux-draft-cache';
const unavailable=():never=>{throw new AgentApiError('REFERENCE_INVALID','This owned Draft has no eligible paired cache. The original Draft remains available.');};
/** Exact current owner/job/attempt/output association; never trusts arbitrary settings metadata. */
export async function resolveFluxDraftOrigin(input:{userId:string;sourceJobId:string;sourceOutputId?:string;sourceAssetId?:string;executor?:QueryExecutor}):Promise<FluxDraftOrigin> {
  const executor=input.executor??{query};
  const rows=await executor.query<Omit<FluxDraftOrigin,'endpoint'|'attemptId'|'provenance'>&{recordId:string;snapshot:unknown}>(`
    SELECT j.id::text AS "recordId",to_jsonb(j)->'settings_snapshot' AS snapshot,j.user_id AS "ownerId",j.job_id AS "jobId",o.id::text AS "outputId",
      j.provider_job_id AS "providerRequestId",COALESCE(o.storage_url,o.url) AS "outputUrl",
      o.metadata->'mediaFacts'->'original'->>'sha256' AS "outputSha256"
    FROM app_jobs j JOIN job_outputs o ON o.job_id=j.job_id AND o.user_id=j.user_id AND o.kind='video' AND o.position=0 AND o.status='ready'
    WHERE j.job_id=$1 AND j.user_id=$2 AND j.engine_id='flux-3-draft' AND j.provider='fal'
      AND j.surface='video' AND j.status='completed' AND COALESCE(j.hidden,false)=false
      AND COALESCE(o.storage_url,o.url)=j.video_url
      AND o.metadata->'mediaFacts'->'original'->>'url'=COALESCE(o.storage_url,o.url)
      AND ($3::text IS NULL OR o.id::text=$3)
      AND ($4::text IS NULL OR EXISTS (SELECT 1 FROM media_assets m WHERE m.public_id=$4
        AND m.source_output_id=o.id AND m.source_job_id=j.job_id AND m.user_id=j.user_id AND m.status='ready' AND m.deleted_at IS NULL)) LIMIT 2`,
    [input.sourceJobId,input.userId,input.sourceOutputId??null,input.sourceAssetId??null]);
  const row=rows[0];
  if(rows.length!==1||!row||row.ownerId!==input.userId||row.jobId!==input.sourceJobId||!row.outputId||!row.outputUrl||!row.providerRequestId||!/^[a-f0-9]{64}$/.test(row.outputSha256??''))unavailable();
  const {recordId,snapshot,...origin}=row;
  const lock=isTransactionQueryExecutor(executor)?' FOR SHARE':'';
  const attempts=await executor.query<FluxDraftAttempt>(`SELECT id::text AS id,provider_model AS endpoint,status FROM provider_attempts
    WHERE job_id=$1 AND provider='fal' AND provider_job_id=$2 ORDER BY id LIMIT 2${lock}`,[recordId,row.providerRequestId]);
  const events=attempts.length?[]:await executor.query<FluxDraftQueueEvent>(`SELECT id::text AS id,status,payload FROM fal_queue_log
    WHERE job_id=$1 AND provider='fal' AND provider_job_id=$2 AND engine_id='flux-3-draft' AND status IN ('enqueue','completed') ORDER BY id LIMIT 101${lock}`,[row.jobId,row.providerRequestId]);
  try {
    if(events.length>100)unavailable();
    const proof=resolveFluxDraftProvenance(snapshot,attempts,events);
    if(!FLUX_NATIVE_DRAFT_ENDPOINTS.includes(proof.endpoint))unavailable();
    return {...origin,...proof};
  }catch{return unavailable();}

}
export async function resolveOwnedFluxDraftSource(input:Parameters<typeof resolveFluxDraftOrigin>[0],availability=checkFluxDraftCacheAvailability):Promise<QualifiedFluxDraftSource> {
  const origin=await resolveFluxDraftOrigin(input);
  const rows=await (input.executor??{query}).query<{qualified_source:QualifiedFluxDraftSource;invalidated_at:string|null;expires_at:string|null}>(`SELECT qualified_source,invalidated_at,expires_at FROM flux_draft_cache_sources WHERE source_job_id=$1 AND source_output_id=$2 AND owner_id=$3`,[origin.jobId,origin.outputId,origin.ownerId]);
  const row=rows[0],source=row?.qualified_source;
  if(rows.length!==1||!source||!sameFluxDraftOrigin(origin,source)) unavailable();
  const current={...source,provenance:origin.provenance,invalidatedAt:row.invalidated_at,expiresAt:row.expires_at};
  try {await availability(current);} catch {unavailable();}
  return current;
}
/** Must run in the caller's transaction after re-resolving the exact current origin. */
export async function persistQualifiedFluxDraftSource(source:QualifiedFluxDraftSource,executor:TransactionQueryExecutor):Promise<void> {
  if(!isTransactionQueryExecutor(executor)) throw new Error('Draft cache persistence requires a transaction.');
  await executor.query('SELECT j.id,o.id FROM app_jobs j JOIN job_outputs o ON o.job_id=j.job_id WHERE j.job_id=$1 AND j.user_id=$2 AND o.id::text=$3 FOR UPDATE OF j,o',[source.jobId,source.ownerId,source.outputId]);
  const current=await resolveFluxDraftOrigin({userId:source.ownerId,sourceJobId:source.jobId,sourceOutputId:source.outputId,executor});
  if(!sameFluxDraftOrigin(current,source)) unavailable();
  const rows=await executor.query<{fingerprint:string}>(`INSERT INTO flux_draft_cache_sources
    (source_job_id,source_output_id,owner_id,provider_request_id,attempt_id,fingerprint,qualified_source,origin_kind,origin_proof)
    SELECT $1,$2,$3,$4,$5,$6,$7::jsonb,$10,$11::jsonb
    FROM app_jobs j JOIN job_outputs o ON o.job_id=j.job_id AND o.id::text=$2
    WHERE j.job_id=$1 AND j.user_id=$3 AND j.status='completed' AND j.provider_job_id=$4
      AND o.status='ready' AND COALESCE(o.storage_url,o.url)=$8 AND o.metadata->'mediaFacts'->'original'->>'sha256'=$9
    ON CONFLICT(source_job_id,source_output_id) DO UPDATE SET qualified_source=EXCLUDED.qualified_source
      WHERE flux_draft_cache_sources.fingerprint=EXCLUDED.fingerprint AND flux_draft_cache_sources.invalidated_at IS NULL
        AND (flux_draft_cache_sources.expires_at IS NULL OR flux_draft_cache_sources.expires_at>now())
    RETURNING fingerprint`,[source.jobId,source.outputId,source.ownerId,source.providerRequestId,source.attemptId,source.fingerprint,JSON.stringify(source),source.outputUrl,source.outputSha256,source.provenance.kind,source.provenance.kind==='provider_attempt'?null:JSON.stringify(source.provenance)]);
  if(rows.length!==1||rows[0]!.fingerprint!==source.fingerprint) unavailable();
}
