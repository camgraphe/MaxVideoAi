import type {QueryExecutor} from '@/lib/db';
import {studioTaskSchemaReady,readStudioTaskUsage,type StudioTaskRow} from './repository';
import {studioTaskSavedUsageKnown} from './saved-usage';

/** Called inside the existing operator resolution transaction and account fences.
 * Releasing a customer reservation never grants another provider dispatch. */
export async function reconcileStudioTaskResolution(db:QueryExecutor,call:{user_id:string;project_id:string;request_id:string},action:'waive_unknown'|'settle_recorded') {
  if(!await studioTaskSchemaReady(db))return;
  const row=(await db.query<StudioTaskRow>(`SELECT t.* FROM studio_tasks t JOIN studio_task_segments s
    ON s.user_id=t.user_id AND s.project_id=t.project_id AND s.task_request_id=t.request_id
    WHERE s.user_id=$1 AND s.project_id=$2 AND s.request_id=$3 AND t.state='unknown' FOR UPDATE OF t`,[call.user_id,call.project_id,call.request_id]))[0];
  if(!row||(await readStudioTaskUsage(row,db)).unknownCalls)return;
  if(action==='waive_unknown'){
    await db.query(`UPDATE studio_tasks SET state='failed',phase='paused',error='closed',worker_id=NULL,lease_expires_at=NULL,replay_only=true,updated_at=clock_timestamp()
      WHERE user_id=$1 AND project_id=$2 AND request_id=$3`,[row.user_id,row.project_id,row.request_id]);
  }else if(await studioTaskSavedUsageKnown(row,db,true)){
    await db.query(`UPDATE studio_tasks SET state='queued',phase='recovering',error=NULL,worker_id=NULL,lease_expires_at=NULL,recovery_attempts=0,replay_only=true,updated_at=clock_timestamp()
      WHERE user_id=$1 AND project_id=$2 AND request_id=$3`,[row.user_id,row.project_id,row.request_id]);
  }
}
