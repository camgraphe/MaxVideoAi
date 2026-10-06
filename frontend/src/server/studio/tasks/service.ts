import {createHash} from 'node:crypto';
import {withDbTransaction,type TransactionQueryExecutor} from '@/lib/db';
import {imageTurnInputSchema} from '@/lib/studio/image-conversation-contract';
import {STUDIO_TASK_POLICY_VERSION,STUDIO_TASK_MAX_CALLS,STUDIO_TASK_MAX_CREDITS,studioTaskProfileForModel,studioTaskResumeSchema,studioTaskMaintenanceSchema} from '@/lib/studio/task-budget-contract';
import {AgentApiError} from '@/server/agent-api/errors';
import {requireGenerationActor,type StudioGenerationActor} from '@/server/agent-api/generation-actor';
import {stableJson} from '@/server/agent-api/generation-normalization';
import {getActiveAccountRestrictionInExecutor} from '@/server/fraud-cleanup/restrictions';
import {studioAssistancePolicy,type StudioAssistancePolicy} from '../assistance-policy';
import {lockAccount,openStudioAssistanceTurn,readStudioAssistanceStatus} from '../assistance-ledger';
import {studioTaskSavedUsageKnown} from './saved-usage';
import {studioTasksEnabled} from './policy';
import {studioTaskSourceFingerprint} from './source';
import {studioTaskSchemaReady,readStudioTaskRow,readStudioTaskUsage,projectStudioTask,type StudioTaskRow} from './repository';

export function createStudioTaskService(actor:StudioGenerationActor,dependencies:{enabled?:boolean;assistancePolicy?:StudioAssistancePolicy}={}) {
  requireGenerationActor(actor);if(actor.authMethod!=='studio-session')throw new AgentApiError('AUTH_REQUIRED','Studio session required.');
  const policy=dependencies.assistancePolicy??studioAssistancePolicy(),enabled=dependencies.enabled??studioTasksEnabled();
  function available(){if(!enabled||!policy.enabled||!policy.credits)throw new AgentApiError('ENGINE_UNAVAILABLE','The Studio task policy is unavailable.');}
  async function authorize(tx:TransactionQueryExecutor) {
    await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`studio-image:${actor.userId}`]);
    const account=await lockAccount(tx,actor.userId,policy);
    const project=await tx.query('SELECT id FROM studio_projects WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL FOR SHARE',[actor.projectId,actor.userId]);
    if(!project.length)throw new AgentApiError('REFERENCE_INVALID','This project is not available.');
    if(await getActiveAccountRestrictionInExecutor(actor.userId,tx))throw new AgentApiError('ACCOUNT_RESTRICTED','This account is temporarily restricted.');
    return account;
  }
  async function noOtherActive(tx:TransactionQueryExecutor,requestId:string) {
    const active=await tx.query(`SELECT request_id FROM studio_tasks WHERE user_id=$1 AND request_id<>$2 AND state IN ('queued','running','unknown')
      UNION ALL SELECT request_id FROM studio_image_turns WHERE user_id=$1 AND request_id<>$2 AND state='thinking' AND lease_expires_at>clock_timestamp()`,[actor.userId,requestId]);
    if(active.length)throw new AgentApiError('RATE_LIMITED','Finish or recover the previous active Studio task.');
    if((await readStudioAssistanceStatus(actor.userId,policy,tx)).unresolvedCalls)throw new AgentApiError('SPENDING_LIMIT_EXCEEDED','Recover unresolved provider usage before another task.');
  }
  return {
    async read(requestId:string){return projectStudioTask(await readStudioTaskRow(actor,requestId));},
    async enqueue(raw:unknown) {
      available();const input=imageTurnInputSchema.parse(raw);
      if(!input.taskBudget)throw new AgentApiError('CONFIRMATION_REQUIRED','Review the assistance ceiling before sending.');
      const hash=createHash('sha256').update(stableJson(input)).digest('hex');
      return withDbTransaction(async tx=>{
        if(!await studioTaskSchemaReady(tx))throw new AgentApiError('ENGINE_UNAVAILABLE','Apply the explicit Studio task migration before activation.');
        const account=await authorize(tx);
        const prior=(await tx.query<StudioTaskRow>('SELECT * FROM studio_tasks WHERE user_id=$1 AND project_id=$2 AND request_id=$3',[actor.userId,actor.projectId,input.requestId]))[0];
        if(prior){if(prior.input_hash!==hash)throw new AgentApiError('PARAMETER_INVALID','This request identity belongs to another intent.');return projectStudioTask(prior,tx);}
        if(input.taskBudget!.model&&input.taskBudget!.model!==account.selected_model||input.taskBudget!.assistanceRevision!==undefined&&input.taskBudget!.assistanceRevision!==Number(account.revision))throw new AgentApiError('CONFIRMATION_REQUIRED','Refresh the selected model and assistance policy before sending.');
        await noOtherActive(tx,input.requestId);
        const assistance=await openStudioAssistanceTurn(actor,input.requestId,policy,tx);
        let profile;try{profile=studioTaskProfileForModel(input.taskBudget!,assistance.model);}catch{throw new AgentApiError('CONFIRMATION_REQUIRED','Select Sol and confirm the complex ceiling before sending.');}
        const count=(await tx.query<{n:number}>(`SELECT count(*)::int n FROM (
          SELECT t.request_id FROM studio_image_turns t WHERE t.user_id=$1 AND t.created_at>clock_timestamp()-interval '1 hour'
            AND NOT EXISTS(SELECT 1 FROM studio_task_segments s WHERE s.user_id=t.user_id AND s.project_id=t.project_id AND s.request_id=t.request_id)
          UNION SELECT request_id FROM studio_tasks WHERE user_id=$1 AND created_at>clock_timestamp()-interval '1 hour') turns`,[actor.userId]))[0].n;
        if(count>=(assistance.mode==='paid_sol'?60:20))throw new AgentApiError('RATE_LIMITED','The current hourly task allowance is reached. Try later.');
        const sourceFingerprint=await studioTaskSourceFingerprint(actor,input,tx,true);
        const row=(await tx.query<StudioTaskRow>(`INSERT INTO studio_tasks(user_id,project_id,request_id,segment_request_id,input_hash,input_json,source_fingerprint,policy_version,profile,profile_json,model,max_credits,allowed_calls)
          VALUES($1,$2,$3,$3,$4,$5::jsonb,$6,$7,$8,$9::jsonb,$10,$11,$12) RETURNING *`,[actor.userId,actor.projectId,input.requestId,hash,JSON.stringify(input),sourceFingerprint,STUDIO_TASK_POLICY_VERSION,input.taskBudget!.profile,JSON.stringify(profile),assistance.model,profile.maxCredits,profile.maxCalls]))[0];
        await tx.query('INSERT INTO studio_task_segments(user_id,project_id,task_request_id,request_id,max_calls) VALUES($1,$2,$3,$3,$4)',[actor.userId,actor.projectId,input.requestId,profile.maxCalls]);
        await tx.query('INSERT INTO studio_task_memory_notes(user_id,project_id,request_id,message,reference_ids) VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT DO NOTHING',[actor.userId,actor.projectId,input.requestId,input.message,JSON.stringify([...input.references,...(input.attachments??[]).map(r=>r.type==='asset'?r.assetId:r.outputId)])]);
        return projectStudioTask(row,tx);
      });
    },
    async cancel(raw:unknown) {
      const input=studioTaskMaintenanceSchema.parse(raw);
      if(input.action!=='cancel')throw new AgentApiError('PARAMETER_INVALID','Invalid cancellation.');
      return withDbTransaction(async tx=>{
        await authorize(tx);const row=await readStudioTaskRow(actor,input.requestId,tx,true);
        if(row.revision!==input.expectedRevision)throw new AgentApiError('PARAMETER_INVALID','Refresh the current task revision.');
        if(row.error==='cancelled')return projectStudioTask(row,tx);
        if(row.state!=='queued'||(await readStudioTaskUsage(row,tx)).unknownCalls)throw new AgentApiError('PARAMETER_INVALID','Only a queued waiting task can be cancelled. Check a running result first.');
        const updated=(await tx.query<StudioTaskRow>("UPDATE studio_tasks SET state='failed',phase='paused',error='cancelled',updated_at=clock_timestamp() WHERE user_id=$1 AND project_id=$2 AND request_id=$3 RETURNING *",[actor.userId,actor.projectId,input.requestId]))[0];
        return projectStudioTask(updated,tx);
      });
    },
    async recover(raw:unknown) {
      const input=studioTaskMaintenanceSchema.parse(raw);
      if(input.action!=='recover')throw new AgentApiError('PARAMETER_INVALID','Invalid recovery.');
      return withDbTransaction(async tx=>{
        await authorize(tx);const row=await readStudioTaskRow(actor,input.requestId,tx,true);
        if(row.revision!==input.expectedRevision)throw new AgentApiError('PARAMETER_INVALID','Refresh the current task revision.');
        if(['queued','running'].includes(row.state)&&row.replay_only)return projectStudioTask(row,tx);
        if(!['paused','unknown','failed'].includes(row.state)||!await studioTaskSavedUsageKnown(row,tx,true))throw new AgentApiError('SPENDING_LIMIT_EXCEEDED','No qualified saved response is available. Check unresolved usage with support before retrying.');
        const other=await tx.query("SELECT request_id FROM studio_tasks WHERE user_id=$1 AND request_id<>$2 AND state IN ('queued','running','unknown')",[actor.userId,input.requestId]);
        if(other.length)throw new AgentApiError('RATE_LIMITED','Finish the other active task first.');
        const updated=(await tx.query<StudioTaskRow>("UPDATE studio_tasks SET state='queued',phase='recovering',worker_id=NULL,lease_expires_at=NULL,recovery_attempts=0,replay_only=true,error=NULL,updated_at=clock_timestamp() WHERE user_id=$1 AND project_id=$2 AND request_id=$3 RETURNING *",[actor.userId,actor.projectId,input.requestId]))[0];
        return projectStudioTask(updated,tx);
      });
    },
    async resume(raw:unknown) {
      available();const input=studioTaskResumeSchema.parse(raw);
      return withDbTransaction(async tx=>{
        await authorize(tx);
        const row=await readStudioTaskRow(actor,input.requestId,tx,true);
        const prior=(await tx.query<{payload:unknown}>('SELECT payload FROM studio_task_approvals WHERE user_id=$1 AND approval_id=$2',[actor.userId,input.approvalId]))[0];
        if(prior){if(stableJson(prior.payload)!==stableJson(input))throw new AgentApiError('PARAMETER_INVALID','This approval identity has another ceiling.');return projectStudioTask(row,tx);}
        if(row.state!=='paused')throw new AgentApiError('PARAMETER_INVALID','Only a paused task can resume; a completed result cannot restart.');
        if(row.revision!==input.expectedRevision)throw new AgentApiError('PARAMETER_INVALID','Refresh the current task revision.');
        if((await readStudioTaskUsage(row,tx)).unknownCalls)throw new AgentApiError('SPENDING_LIMIT_EXCEEDED','Recover provider usage before continuing.');
        await noOtherActive(tx,input.requestId);
        const generation=(await tx.query<{quote_id:string|null;draft_json:Record<string,unknown>|null}>('SELECT quote_id,draft_json FROM studio_image_turns WHERE user_id=$1 AND project_id=$2 AND request_id=$3 FOR UPDATE',[actor.userId,actor.projectId,row.segment_request_id]))[0];
        if(generation?.quote_id||generation?.draft_json?.image||generation?.draft_json?.media||generation?.draft_json?.exportQuote||generation?.draft_json?.analysisQuote)throw new AgentApiError('PARAMETER_INVALID','The delivered preparation has its own confirmation or renewal.');
        const delta=input.maxCredits-row.max_credits;
        if(input.action==='continue'?delta!==0:row.model!=='gpt-6.1-sol'||![100,250,500].includes(delta))throw new AgentApiError('PARAMETER_INVALID','Review the exact additional task ceiling.');
        if(input.maxCredits>STUDIO_TASK_MAX_CREDITS||row.allowed_calls>=STUDIO_TASK_MAX_CALLS)throw new AgentApiError('PARAMETER_INVALID','Start a new explicit request after this task resource limit.');
        const allowed=Math.min(STUDIO_TASK_MAX_CALLS,row.allowed_calls+row.profile_json.maxCalls),revision=row.revision+1;
        await openStudioAssistanceTurn(actor,input.approvalId,policy,tx,row.model);
        await tx.query('INSERT INTO studio_task_segments(user_id,project_id,task_request_id,request_id,max_calls) VALUES($1,$2,$3,$4,$5)',[actor.userId,actor.projectId,input.requestId,input.approvalId,allowed-row.allowed_calls]);
        await tx.query('INSERT INTO studio_task_approvals(user_id,project_id,request_id,approval_id,revision,payload,max_credits,allowed_calls,segment_request_id) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$4)',[actor.userId,actor.projectId,input.requestId,input.approvalId,revision,JSON.stringify(input),input.maxCredits,allowed]);
        const updated=(await tx.query<StudioTaskRow>(`UPDATE studio_tasks SET state='queued',phase='queued',max_credits=$4,allowed_calls=$5,revision=$6,segment_request_id=$7,worker_id=NULL,lease_expires_at=NULL,deadline_at=NULL,recovery_attempts=0,replay_only=false,error=NULL,updated_at=clock_timestamp()
          WHERE user_id=$1 AND project_id=$2 AND request_id=$3 RETURNING *`,[actor.userId,actor.projectId,input.requestId,input.maxCredits,allowed,revision,input.approvalId]))[0];
        return projectStudioTask(updated,tx);
      });
    },
  };
}
