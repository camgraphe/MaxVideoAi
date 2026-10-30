import type {QueryExecutor} from '@/lib/db';
import {AgentApiError} from '@/server/agent-api/errors';

export type AnalysisScope={userId:string;projectId:string};
export function analysisScopeParts(scope:AnalysisScope) {
  if(scope.projectId.startsWith('composer:')) {
    const sessionId=scope.projectId.slice(9);
    if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(sessionId))throw new Error('SESSION_INVALID');
    return {projectId:null,sessionId};
  }
  return {projectId:scope.projectId,sessionId:null};
}
export function analysisRunScope(run:{user_id:string;project_id:string|null;composer_session_id?:string|null}):AnalysisScope {
  return {userId:run.user_id,projectId:run.composer_session_id?`composer:${run.composer_session_id}`:run.project_id!};
}
export async function assertAnalysisScope(db:QueryExecutor,scope:AnalysisScope,lock:boolean|'update'=false,requireActive=true) {
  const parts=analysisScopeParts(scope);
  const clause=lock==='update'?' FOR UPDATE':lock?' FOR SHARE':'';
  const rows=parts.sessionId
    ?await db.query(`SELECT id FROM prompt_assistance_sessions WHERE id=$1 AND user_id=$2${requireActive?' AND expires_at>clock_timestamp()':''}${clause}`,[parts.sessionId,scope.userId])
    :await db.query(`SELECT id FROM studio_projects WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL${clause}`,[parts.projectId,scope.userId]);
  if(!rows.length)throw new AgentApiError('REFERENCE_INVALID','This project or composer session is not available.');
}
