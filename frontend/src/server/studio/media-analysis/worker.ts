import {studioAnalysisKind} from '@/lib/studio/media-analysis-contract';
import {randomUUID} from 'node:crypto';
import {query,withDbTransaction} from '@/lib/db';
import {getActiveAccountRestrictionInExecutor} from '@/server/fraud-cleanup/restrictions';
import type {StudioGenerationActor} from '@/server/agent-api/generation-actor';
import {stableJson} from '@/server/agent-api/generation-normalization';
import {studioAssistancePolicy,type StudioAssistancePolicy} from '../assistance-policy';
import {lockAccount} from '../assistance-ledger';
import {settleStudioCredits} from '../assistance-credit-ledger';
import {studioAnalysisPolicy,priceStudioAnalysis,type StudioAnalysisPolicy} from './policy';
import {analysisSourceFingerprint,extractStudioAnalysisSource} from './source';
import {prepareStudioAnalysisProvider,parseStudioAnalysisObservations,readStudioAnalysisProviderCost} from './provider';
import {resolveAnalysisSource,type AnalysisRun} from './repository';

type WorkerDependencies={policy?:StudioAnalysisPolicy|null;assistancePolicy?:StudioAssistancePolicy;extract?:typeof extractStudioAnalysisSource;provider?:typeof prepareStudioAnalysisProvider};
/** Worker-only entry. No generation callback, API GET or chat poll calls this function. */
export async function runStudioAnalysisWorkerOnce(dependencies:WorkerDependencies={}):Promise<boolean> {
  const assistance=dependencies.assistancePolicy??studioAssistancePolicy();
  // Read candidates first; every mutation locks campaign -> account -> run.
  const candidate=(await query<AnalysisRun>(`SELECT * FROM studio_media_analysis_runs WHERE state='queued'
    OR (provider_snapshot IS NOT NULL AND (state='running' OR (state='unknown' AND error='ANALYSIS_SETTLEMENT_PENDING')))
    OR (state='running' AND started_at<clock_timestamp()-interval '3 minutes') ORDER BY created_at LIMIT 1`))[0];
  if(!candidate)return false;
  const workerId=randomUUID();
  const run=await withDbTransaction(async tx=>{
    await lockAccount(tx,candidate.user_id,assistance);
    const current=(await tx.query<AnalysisRun>(`SELECT * FROM studio_media_analysis_runs WHERE id=$1 AND
      (state='queued' OR (provider_snapshot IS NOT NULL AND (state='running' OR (state='unknown' AND error='ANALYSIS_SETTLEMENT_PENDING'))) OR (state='running' AND started_at<clock_timestamp()-interval '3 minutes')) FOR UPDATE SKIP LOCKED`,[candidate.id]))[0];
    if(!current)return null;
    if(current.dispatched_at&&!current.provider_snapshot){await tx.query("UPDATE studio_media_analysis_runs SET state='unknown',error='Provider usage remains unresolved.' WHERE id=$1",[current.id]);return null;}
    await tx.query("UPDATE studio_media_analysis_runs SET state='running',worker_id=$2,started_at=clock_timestamp() WHERE id=$1",[current.id,workerId]);
    return {...current,state:'running' as const,worker_id:workerId};
  });
  if(!run)return false;
  let dispatched=!!run.dispatched_at;
  let settlementPending=false;
  const actor:StudioGenerationActor={userId:run.user_id,projectId:run.project_id,authMethod:'studio-session',clientId:null};
  try {
    let snapshot=run.provider_snapshot;
    if(!snapshot){
      const active=dependencies.policy===undefined?studioAnalysisPolicy():dependencies.policy;
      if(!active||stableJson(active)!==stableJson(run.policy_json)||!assistance.enabled||!assistance.credits)throw new Error('ANALYSIS_PROFILE_UNAVAILABLE');
      const owned=await query('SELECT id FROM studio_projects WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL',[run.project_id,run.user_id]);
      if(!owned.length)throw new Error('ANALYSIS_PROJECT_UNAVAILABLE');
      const media=await resolveAnalysisSource(actor,run.request_json);
      if(analysisSourceFingerprint(media)!==run.source_fingerprint)throw new Error('ANALYSIS_SOURCE_CHANGED');
      const source=await (dependencies.extract??extractStudioAnalysisSource)(media,run.request_json,AbortSignal.timeout(120_000));
      const prepared=await (dependencies.provider??prepareStudioAnalysisProvider)(run.policy_json,run.request_json,source);
      await withDbTransaction(async tx=>{
        await lockAccount(tx,run.user_id,assistance);
        if(await getActiveAccountRestrictionInExecutor(run.user_id,tx))throw new Error('ANALYSIS_ACCOUNT_RESTRICTED');
        const retained=(await resolveAnalysisSource(actor,run.request_json,tx));
        if(analysisSourceFingerprint(retained)!==run.source_fingerprint)throw new Error('ANALYSIS_SOURCE_CHANGED');
        const saved=await tx.query(`UPDATE studio_media_analysis_runs SET dispatched_at=clock_timestamp(),source_hash=$3 WHERE id=$1 AND worker_id=$2 AND state='running' AND dispatched_at IS NULL RETURNING id`,[run.id,workerId,source.sourceHash]);
        if(!saved.length)throw new Error('ANALYSIS_WORKER_SUPERSEDED');
      });
      dispatched=true;
      snapshot={...await prepared.dispatch(),sampledAtSec:source.frames.map(frame=>frame.atSec)};
      // Persist known output/usage first. A later failure replays this snapshot only.
      const saved=await query(`UPDATE studio_media_analysis_runs SET provider_snapshot=$3::jsonb WHERE id=$1 AND worker_id=$2 AND state='running' AND provider_snapshot IS NULL RETURNING id`,[run.id,workerId,JSON.stringify(snapshot)]);
      if(!saved.length)throw new Error('ANALYSIS_SNAPSHOT_UNAVAILABLE');
    }
    const providerNanoUsd=readStudioAnalysisProviderCost(snapshot,studioAnalysisKind(run.request_json),run.policy_json);
    if(providerNanoUsd===null)throw new Error('ANALYSIS_USAGE_UNKNOWN');
    const price=priceStudioAnalysis(run.policy_json,run.request_json.endSec-run.request_json.startSec,providerNanoUsd);
    if(price.credits>run.quote_json.maxCredits||price.supplierNanoUsd>Number(run.reserved_supplier_nano_usd))throw new Error('ANALYSIS_USAGE_UNKNOWN');
    let result:AnalysisRun['result_json']=null;
    try{result=parseStudioAnalysisObservations(snapshot.outputText,run.request_json,snapshot.sampledAtSec??[]);}catch{/* Known paid usage, but no reliable artistic observation. */}
    settlementPending=true;
    await withDbTransaction(async tx=>{
      await lockAccount(tx,run.user_id,assistance);
      const state=(await tx.query<AnalysisRun>('SELECT * FROM studio_media_analysis_runs WHERE id=$1 FOR UPDATE',[run.id]))[0];
      if(state.settled_at)return;
      if(state.worker_id!==workerId)throw new Error('ANALYSIS_WORKER_SUPERSEDED');
      await settleStudioCredits(tx,run.id,price.cents,price.supplierNanoUsd,'analysis');
      await tx.query(`UPDATE studio_media_analysis_runs SET state=$2,result_json=$3::jsonb,charged_credits=$4,error=$5,settled_at=clock_timestamp() WHERE id=$1`,[run.id,result?'completed':'failed',JSON.stringify(result),price.credits,result?null:'The analysis returned no reliable observations. Known usage has been settled.']);
    });
    return true;
  } catch {
    await withDbTransaction(async tx=>{
      await lockAccount(tx,run.user_id,assistance);
      const current=(await tx.query<AnalysisRun>('SELECT * FROM studio_media_analysis_runs WHERE id=$1 FOR UPDATE',[run.id]))[0];
      if(current.settled_at||current.worker_id!==workerId)return;
      if(dispatched){await tx.query("UPDATE studio_media_analysis_runs SET state='unknown',error=$2 WHERE id=$1",[run.id,settlementPending?'ANALYSIS_SETTLEMENT_PENDING':'Provider usage is unresolved. Credits remain reserved; do not repeat this analysis.']);}
      else {
        await settleStudioCredits(tx,run.id,0,0,'analysis');
        await tx.query("UPDATE studio_media_analysis_runs SET state='failed',charged_credits=0,error='Analysis stopped before provider dispatch. No analysis credits were charged.',settled_at=clock_timestamp() WHERE id=$1",[run.id]);
      }
    });
    return true;
  }
}
