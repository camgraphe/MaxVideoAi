import {createHash,randomUUID} from 'node:crypto';
import {withDbTransaction,type TransactionQueryExecutor} from '@/lib/db';
import {AgentApiError} from '@/server/agent-api/errors';
import {requireGenerationActor,type StudioGenerationActor} from '@/server/agent-api/generation-actor';
import {stableJson} from '@/server/agent-api/generation-normalization';
import {studioAnalysisPrepareSchema,studioAnalysisConfirmSchema,studioAnalysisKind,STUDIO_ANALYSIS_LIMITS,type StudioPreparedAnalysis} from '@/lib/studio/media-analysis-contract';
import {STUDIO_ASSISTANCE_CREDIT_TARIFF} from '@/lib/studio/assistance-contract';
import {getActiveAccountRestrictionInExecutor} from '@/server/fraud-cleanup/restrictions';
import {studioAssistancePolicy,type StudioAssistancePolicy} from '../assistance-policy';
import {lockAccount,campaignRemaining} from '../assistance-ledger';
import {ensureStudioMonthlyCredits,planStudioCreditReservation,reserveStudioCredits} from '../assistance-credit-ledger';
import {quoteStudioAnalysis,studioAnalysisPolicy,type StudioAnalysisPolicy} from './policy';
import {analysisSourceFingerprint} from './source';
import {readAnalysis,projectAnalysis,resolveAnalysisSource,type AnalysisRun} from './repository';
import {readStudioAnalysisExposure} from './exposure';

export function createStudioAnalysisService(actor:StudioGenerationActor,dependencies:{policy?:StudioAnalysisPolicy|null;assistancePolicy?:StudioAssistancePolicy}={}) {
  requireGenerationActor(actor);if(actor.authMethod!=='studio-session')throw new AgentApiError('AUTH_REQUIRED','Studio session required.');
  const policy=dependencies.policy===undefined?studioAnalysisPolicy():dependencies.policy;
  const assistance=dependencies.assistancePolicy??studioAssistancePolicy();
  function enabled(){if(!policy||!assistance.enabled||!assistance.credits)throw new AgentApiError('ENGINE_UNAVAILABLE','This analysis profile is not available.');return policy;}
  return {
    read:async(id:string)=>projectAnalysis(await readAnalysis(actor,id)),
    async prepare(raw:unknown,key:string,onPrepared?:(quote:StudioPreparedAnalysis,tx:TransactionQueryExecutor)=>Promise<void>) {
      const current=enabled(),request=studioAnalysisPrepareSchema.parse(raw);
      if(!current[studioAnalysisKind(request)])throw new AgentApiError('ENGINE_UNAVAILABLE','The requested analysis profile has not been qualified.');
      if(!key||key.length>180||key!==key.trim())throw new AgentApiError('PARAMETER_INVALID','Invalid analysis request identity.');
      const source=await resolveAnalysisSource(actor,request);
      if(!source.durationSec||request.endSec>source.durationSec||(source.sizeBytes??0)>STUDIO_ANALYSIS_LIMITS.sourceBytes)throw new AgentApiError('PARAMETER_INVALID','Select a shorter measured source interval for analysis.');
      const fingerprint=analysisSourceFingerprint(source),requestHash=createHash('sha256').update(stableJson({request,fingerprint,policy:current})).digest('hex');
      const price=quoteStudioAnalysis(current,studioAnalysisKind(request),request.endSec-request.startSec);
      return withDbTransaction(async tx=>{
        const project=await tx.query('SELECT id FROM studio_projects WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL FOR UPDATE',[actor.projectId,actor.userId]);
        if(!project.length)throw new AgentApiError('REFERENCE_INVALID','This project is not available.');
        const prior=(await tx.query<AnalysisRun>('SELECT * FROM studio_media_analysis_runs WHERE user_id=$1 AND project_id=$2 AND request_key=$3',[actor.userId,actor.projectId,key]))[0];
        if(prior){if(prior.request_hash!==requestHash)throw new AgentApiError('PARAMETER_INVALID','This analysis identity belongs to another request.');await onPrepared?.(prior.quote_json,tx);return prior.quote_json;}
        const quote:StudioPreparedAnalysis={analysisId:randomUUID(),...request,...(source.originalName?{sourceName:source.originalName.slice(0,160)}:{}),maxCredits:price.maxCredits,policyVersion:current.version,expiresAt:new Date(Date.now()+15*60_000).toISOString(),profile:studioAnalysisKind(request)==='audio'?'audio-window-v1':'video-frames-v1',model:'gpt-6.1-sol',confirmationRequired:true};
        await tx.query(`INSERT INTO studio_media_analysis_runs(id,user_id,project_id,request_key,request_hash,request_json,source_fingerprint,policy_json,quote_json,reserved_supplier_nano_usd,expires_at)
          VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8::jsonb,$9::jsonb,$10,$11)`,[quote.analysisId,actor.userId,actor.projectId,key,requestHash,JSON.stringify(request),fingerprint,JSON.stringify(current),JSON.stringify(quote),price.reservedSupplierNanoUsd,quote.expiresAt]);
        await onPrepared?.(quote,tx);return quote;
      });
    },
    async confirm(raw:unknown) {
      const confirmation=studioAnalysisConfirmSchema.parse(raw);
      // Confirmed recovery precedes activation/expiry checks. Reads never dispatch.
      const saved=await readAnalysis(actor,confirmation.analysisId);
      if(confirmation.maxCredits!==saved.quote_json.maxCredits||confirmation.policyVersion!==saved.quote_json.policyVersion)throw new AgentApiError('PARAMETER_INVALID','Review the exact analysis quote and credits.');
      if(saved.state!=='prepared')return projectAnalysis(saved);
      const current=enabled();
      const source=await resolveAnalysisSource(actor,saved.request_json);
      if(analysisSourceFingerprint(source)!==saved.source_fingerprint)throw new AgentApiError('REFERENCE_INVALID','The source changed. Prepare a new analysis quote.');
      return withDbTransaction(async tx=>{
        const account=await lockAccount(tx,actor.userId,assistance);
        const run=await readAnalysis(actor,confirmation.analysisId,tx,true);
        if(run.state!=='prepared')return projectAnalysis(run);
        if(run.expires_at.getTime()<=Date.now()||run.policy_json.version!==current.version||stableJson(run.policy_json)!==stableJson(current))throw new AgentApiError('QUOTE_EXPIRED','Prepare and review a current analysis quote.');
        if(await getActiveAccountRestrictionInExecutor(actor.userId,tx))throw new AgentApiError('ACCOUNT_RESTRICTED','This account is temporarily restricted.');
        if((await readStudioAnalysisExposure(tx,actor.userId)).unresolved)throw new AgentApiError('SPENDING_LIMIT_EXCEEDED','Recover unresolved analysis usage before starting another analysis.');
        const chat=await tx.query(`SELECT id FROM studio_assistance_calls c WHERE user_id=$1 AND state<>'settled' AND NOT EXISTS(SELECT 1 FROM studio_assistance_resolutions w WHERE w.call_id=c.id AND w.action='waive_unknown')`,[actor.userId]);
        if(chat.length)throw new AgentApiError('SPENDING_LIMIT_EXCEEDED','Finish or recover the current Studio message first.');
        await ensureStudioMonthlyCredits(tx,actor.userId);
        const plan=await planStudioCreditReservation(tx,actor.userId,run.quote_json.maxCredits/10,Number(run.reserved_supplier_nano_usd),account.paid_enabled&&account.tariff_version===STUDIO_ASSISTANCE_CREDIT_TARIFF.version);
        if(!plan)throw new AgentApiError('SPENDING_LIMIT_EXCEEDED','This analysis exceeds your available Sol credits. Purchased credits remain paused unless you resume them.');
        if(plan.sponsoredNanoUsd>await campaignRemaining(tx,assistance))throw new AgentApiError('SPENDING_LIMIT_EXCEEDED','Included Studio analysis is temporarily unavailable.');
        await reserveStudioCredits(tx,run.id,plan,'analysis');
        await tx.query("UPDATE studio_media_analysis_runs SET state='queued',confirmed_at=clock_timestamp() WHERE id=$1",[run.id]);
        // This exact client confirmation selects Sol without buying or resuming paid credits.
        if(account.selected_model!=='gpt-6.1-sol'){
          await tx.query("UPDATE studio_assistance_accounts SET selected_model='gpt-6.1-sol',revision=revision+1,updated_at=clock_timestamp() WHERE user_id=$1",[actor.userId]);
          await tx.query("INSERT INTO studio_assistance_choices(user_id,revision,action,authorized_cents,tariff_version) VALUES($1,$2,'select_sol',$3,$4)",[actor.userId,Number(account.revision)+1,account.paid_authorized_cents,account.tariff_version]);
        }
        return projectAnalysis({...run,state:'queued'});
      });
    },
  };
}
