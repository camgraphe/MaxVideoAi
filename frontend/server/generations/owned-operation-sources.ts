import { query, type QueryExecutor } from '@/lib/db';
import { resolveOwnedLumaGenerationSource } from '@/server/agent-api/generation-luma-lineage';
import { resolveFluxDraftOrigin } from '@/server/flux-draft-cache-store';
import { sameFluxDraftOrigin } from '@/server/flux-draft-cache';
import type { OwnedGenerationSourceOperation, OwnedGenerationSourcePage } from '@/lib/owned-generation-source';

type SourceRow = {recordId:string;jobId:string;outputId:string;label:string|null;createdAt:string;durationSec:number|null;cacheState:'ready'|'prepare'|'unavailable';qualifiedSource?:unknown};
/** SELECT-only picker. Ready owned outputs do not require a media_assets projection.
 * Eligibility is revalidated by the canonical lineage owner, with no provider/cache URL exposure. */
export async function listOwnedGenerationSources(userId:string,input:{operation:OwnedGenerationSourceOperation;cursor?:string|null;sourceJobId?:string|null},dependencies:{
  executor:QueryExecutor;luma:typeof resolveOwnedLumaGenerationSource;flux:typeof resolveFluxDraftOrigin;
}={executor:{query},luma:resolveOwnedLumaGenerationSource,flux:resolveFluxDraftOrigin}):Promise<OwnedGenerationSourcePage> {
  if(!userId||!['luma-extend','flux-draft-enhance'].includes(input.operation)
    || (input.cursor&&!/^\d{1,20}$/.test(input.cursor)) || (input.sourceJobId&&!/^[\w-]{1,128}$/.test(input.sourceJobId))) throw new Error('Invalid owned source selection.');
  const flux=input.operation==='flux-draft-enhance';
  const rows=await dependencies.executor.query<SourceRow>(`SELECT j.id::text AS "recordId",j.job_id AS "jobId",o.id::text AS "outputId",
    LEFT(j.prompt,160) AS label,j.created_at::text AS "createdAt",o.duration_sec AS "durationSec",
    ${flux ? "CASE WHEN c.invalidated_at IS NOT NULL OR c.expires_at<=now() THEN 'unavailable' WHEN c.qualified_source IS NOT NULL THEN 'ready' ELSE 'prepare' END" : "'ready'"} AS "cacheState", ${flux ? 'c.qualified_source' : 'NULL::jsonb'} AS "qualifiedSource"
    FROM app_jobs j JOIN job_outputs o ON o.job_id=j.job_id AND o.user_id=j.user_id AND o.kind='video' AND o.position=0 AND o.status='ready'
    ${flux ? 'LEFT JOIN flux_draft_cache_sources c ON c.source_job_id=j.job_id AND c.source_output_id=o.id::text AND c.owner_id=j.user_id' : ''}
    WHERE j.user_id=$1 AND j.engine_id=$2 AND j.surface='video' AND j.status='completed' AND COALESCE(j.hidden,false)=false
      AND j.video_url=COALESCE(o.storage_url,o.url) AND ($3::bigint IS NULL OR j.id<$3)
      AND ($4::text IS NULL OR j.job_id=$4)
      ${flux ? "AND j.provider='fal'" : `AND EXISTS(SELECT 1 FROM provider_attempts a WHERE a.job_id=j.id AND a.provider=j.provider AND a.provider_job_id=j.provider_job_id
        AND a.status='completed' AND a.provider_model=ANY($5::text[]))`}
    ORDER BY j.id DESC LIMIT 26`,[userId,flux?'flux-3-draft':'luma-ray-3-2',input.cursor??null,input.sourceJobId??null,...(flux?[]:[['ray-3.2']])]);
  const sources:OwnedGenerationSourcePage['sources']=[];
  for(const row of rows.slice(0,25)) {
    try {
      let preparation=row.cacheState;
      if(flux) {
        const origin=await dependencies.flux({userId,sourceJobId:row.jobId,sourceOutputId:row.outputId,executor:dependencies.executor});
        if(preparation==='ready') {
          const qualified=row.qualifiedSource;
          if(!sameFluxDraftOrigin(origin,qualified)) preparation='unavailable';
        }
      }
      else await dependencies.luma({actor:{userId},sourceJobId:row.jobId,expectedOutputId:row.outputId,executor:dependencies.executor});
      sources.push({sourceJobId:row.jobId,sourceOutputId:row.outputId,label:row.label?.trim()||'Video',createdAt:row.createdAt,
        durationSec:row.durationSec==null?null:Number(row.durationSec),preparation});
    } catch { /* No eligible lineage; keep ordinary Media/history unaffected. */ }
  }
  return {sources,nextCursor:rows.length>25?rows[24].recordId:null};
}
