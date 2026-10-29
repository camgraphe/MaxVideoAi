import {randomUUID} from 'node:crypto';
import {query,withDbTransaction} from '@/lib/db';
import type {z} from 'zod';
import {promptAnalysisPrepareSchema} from '@/lib/prompt-assistance/analysis-contract';
import {studioAnalysisResultSchema,STUDIO_ANALYSIS_LIMITS,studioAnalysisKind,type StudioAnalysisRequest} from '@/lib/studio/media-analysis-contract';
import {projectAnalysis,type AnalysisRun} from '@/server/studio/media-analysis/repository';
import {createComposerAnalysisService} from '@/server/studio/media-analysis/service';
import {analysisSourceFingerprint} from '@/server/studio/media-analysis/source';
import {studioAnalysisPolicy} from '@/server/studio/media-analysis/policy';
import {resolveStudioMedia,type StudioResolvedMedia} from '@/server/studio/media-resolver';
import {ensurePromptSession} from './repository';
import {buildPromptAssistanceContext} from './context';

export async function preparePromptReferenceAnalysis(userId:string,input:z.infer<typeof promptAnalysisPrepareSchema>) {
  if(process.env.PROMPT_ASSISTANCE_PERCEPTION_ENABLED!=='true')throw new Error('ANALYSIS_UNAVAILABLE');
  // Validate the current generator and reference field before granting any analysis scope.
  await buildPromptAssistanceContext(userId,{sessionId:input.sessionId,requestId:randomUUID(),draftRevision:0,locale:'en',message:'Analyse reference',draft:input.draft});
  const ref=input.draft.references.find(item=>item.fieldId===input.fieldId&&item.slot===input.slot)?.ref;
  if(!ref||ref.kind==='image')throw new Error('REFERENCE_INVALID');
  await withDbTransaction(tx=>ensurePromptSession(userId,input.sessionId,input.draft,tx));
  const source=await resolveStudioMedia(userId,ref);
  if(!source.durationSec)throw new Error('REFERENCE_DURATION_UNKNOWN');
  const kind=studioAnalysisKind({ref,modality:input.modality});
  const limit=kind==='audio'?STUDIO_ANALYSIS_LIMITS.audioSeconds:STUDIO_ANALYSIS_LIMITS.videoSeconds;
  const request:StudioAnalysisRequest={ref,modality:input.modality,reason:'requested',startSec:input.startSec,
    endSec:input.endSec??Math.min(source.durationSec,input.startSec+limit),
    goal:kind==='audio'?'Describe the audible voice, words, music, rhythm, sound effects and ambience useful for writing a generation prompt. Distinguish observations from uncertainty. Do not infer identities.':'Describe the visible subjects, actions, camera movement, composition, lighting and style useful for writing a generation prompt. Do not infer identities or unseen events.'};
  const service=createComposerAnalysisService(userId,input.sessionId);
  const policy=studioAnalysisPolicy();
  // Owned composer observations can survive a page reload without restoring hidden chat history.
  // Exact prepared excerpt + profile + assessment: no paid reinspection on repeated messages.
  const cached=policy?(await query<AnalysisRun>(`SELECT * FROM studio_media_analysis_runs WHERE user_id=$1 AND composer_session_id IS NOT NULL
    AND source_fingerprint=$2 AND request_json=$3::jsonb AND policy_json=$4::jsonb AND state='completed' ORDER BY created_at DESC LIMIT 1`,
    [userId,analysisSourceFingerprint(source),JSON.stringify(request),JSON.stringify(policy)]))[0]:null;
  const select=async(analysisId:string)=>query(`INSERT INTO prompt_assistance_analysis_selections(user_id,session_id,source_fingerprint,modality,analysis_id)
    VALUES($1,$2,$3,$4,$5) ON CONFLICT(user_id,session_id,source_fingerprint,modality) DO UPDATE SET analysis_id=EXCLUDED.analysis_id`,
    [userId,input.sessionId,analysisSourceFingerprint(source),input.modality,analysisId]);
  if(cached){await select(cached.id);return {status:projectAnalysis(cached),sessionId:cached.composer_session_id!,reused:true};}
  const quote=await service.prepare(request,input.requestId);
  await select(quote.analysisId);
  return {status:await service.read(quote.analysisId),sessionId:input.sessionId,reused:false};
}
export async function readPromptReferenceAnalyses(userId:string,sessionId:string,source:StudioResolvedMedia) {
  const policy=studioAnalysisPolicy();
  const rows=await query<{kind:string;result_json:unknown}>(`SELECT DISTINCT ON (COALESCE(request_json->>'modality','visual'))
      COALESCE(request_json->>'modality','visual') kind,result_json FROM studio_media_analysis_runs
    WHERE user_id=$1 AND composer_session_id IS NOT NULL AND source_fingerprint=$2 AND state='completed'
      AND ($3::jsonb IS NULL OR policy_json=$3::jsonb)
      AND (NOT EXISTS(SELECT 1 FROM prompt_assistance_analysis_selections s WHERE s.user_id=$1 AND s.session_id=$4
        AND s.source_fingerprint=$2 AND s.modality=COALESCE(request_json->>'modality','visual'))
        OR id=(SELECT analysis_id FROM prompt_assistance_analysis_selections s WHERE s.user_id=$1 AND s.session_id=$4
        AND s.source_fingerprint=$2 AND s.modality=COALESCE(request_json->>'modality','visual')))
    ORDER BY COALESCE(request_json->>'modality','visual'),created_at DESC LIMIT 2`,
    [userId,analysisSourceFingerprint(source),policy?JSON.stringify(policy):null,sessionId]);
  return rows.map(row=>({modality:row.kind,...studioAnalysisResultSchema.parse(row.result_json)}));
}
