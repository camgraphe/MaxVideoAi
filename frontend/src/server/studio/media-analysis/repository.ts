import {query,type QueryExecutor} from '@/lib/db';
import {AgentApiError} from '@/server/agent-api/errors';
import type {StudioGenerationActor} from '@/server/agent-api/generation-actor';
import {studioAnalysisStatusSchema,type StudioAnalysisRequest,type StudioAnalysisStatus,type StudioPreparedAnalysis} from '@/lib/studio/media-analysis-contract';
import type {StudioAnalysisPolicy} from './policy';
import type {AnalysisProviderSnapshot} from './provider';
import {resolveStudioMedia} from '../media-resolver';

export type AnalysisRun={id:string;user_id:string;project_id:string;request_key:string;request_hash:string;request_json:StudioAnalysisRequest;source_fingerprint:string;policy_json:StudioAnalysisPolicy;quote_json:StudioPreparedAnalysis;
  state:StudioAnalysisStatus['state'];reserved_supplier_nano_usd:string;expires_at:Date;confirmed_at:Date|null;worker_id:string|null;started_at:Date|null;dispatched_at:Date|null;source_hash:string|null;
  provider_snapshot:AnalysisProviderSnapshot|null;result_json:StudioAnalysisStatus['result'];charged_credits:number|null;error:string|null;settled_at:Date|null};
export async function readAnalysis(actor:StudioGenerationActor,id:string,db:QueryExecutor={query},lock=false) {
  const run=(await db.query<AnalysisRun>(`SELECT r.* FROM studio_media_analysis_runs r JOIN studio_projects p ON p.id=r.project_id AND p.user_id=r.user_id AND p.deleted_at IS NULL
    WHERE r.id=$1 AND r.user_id=$2 AND r.project_id=$3${lock?' FOR UPDATE OF r':''}`,[id,actor.userId,actor.projectId]))[0];
  if(!run)throw new AgentApiError('REFERENCE_INVALID','This analysis is not available in this project.');return run;
}
export function projectAnalysis(run:AnalysisRun):StudioAnalysisStatus {
  return studioAnalysisStatusSchema.parse({quote:run.quote_json,state:run.state,result:run.result_json,chargedCredits:run.charged_credits,error:run.error});
}
export async function readStudioAnalysisFacts(actor:StudioGenerationActor,db:QueryExecutor={query}) {
  const ready=(await db.query<{ready:boolean}>("SELECT to_regclass('public.studio_media_analysis_runs') IS NOT NULL ready"))[0]?.ready;
  if(!ready)return [];
  return db.query<{analysisId:string;ref:StudioPreparedAnalysis['ref'];goal:string;state:AnalysisRun['state'];startSec:number;endSec:number}>(
    `SELECT r.id AS "analysisId",r.quote_json->'ref' ref,left(r.quote_json->>'goal',160) goal,r.state,
      (r.quote_json->>'startSec')::double precision AS "startSec",(r.quote_json->>'endSec')::double precision AS "endSec"
      FROM studio_media_analysis_runs r JOIN studio_projects p ON p.id=r.project_id AND p.user_id=r.user_id AND p.deleted_at IS NULL
      WHERE r.user_id=$1 AND r.project_id=$2 ORDER BY r.created_at DESC LIMIT 4`,[actor.userId,actor.projectId]);
}
export async function resolveAnalysisSource(actor:StudioGenerationActor,request:StudioAnalysisRequest,db:QueryExecutor={query}) {
  if(request.ref.type==='job-output'){
    const ref=request.ref;
    const owned=await db.query(`SELECT o.id FROM job_outputs o JOIN app_jobs j ON j.job_id=o.job_id AND j.user_id=o.user_id
      JOIN mcp_generation_quotes q ON q.job_id=j.job_id AND q.user_id=j.user_id WHERE o.id=$1 AND o.job_id=$2 AND o.user_id=$3
      AND q.studio_project_id=$4 AND q.auth_origin='studio-session' AND q.state='accepted' AND j.status='completed' AND j.hidden IS NOT TRUE AND o.status='ready'`,[ref.outputId,ref.jobId,actor.userId,actor.projectId]);
    if(!owned.length)throw new AgentApiError('REFERENCE_INVALID','Select a ready output from this project or attach its saved library asset.');
  }
  try{return await resolveStudioMedia(actor.userId,request.ref,(sql,values)=>db.query(sql,values));}
  catch{throw new AgentApiError('REFERENCE_INVALID','This source is not available to analyse.');}
}
