import type {TransactionQueryExecutor} from '@/lib/db';
import {AgentApiError} from '@/server/agent-api/errors';
import {reserveStudioCredits} from '../assistance-credit-ledger';

export const STUDIO_ANALYSIS_PILOT_CAMPAIGN = 'studio-media-analysis-pilot-v1';
const PILOT_BUDGET_NANO_USD = 25_000_000_000;

export function studioAnalysisPilotEnabled(env:NodeJS.ProcessEnv=process.env) {
  return env.STUDIO_MEDIA_ANALYSIS_SPONSORED_PILOT==='true';
}

/** Serialize new reservations across both surfaces. Settlement can only lower the reserved exposure. */
export async function reserveStudioAnalysisPilot(tx:TransactionQueryExecutor,callId:string,userId:string,supplierNanoUsd:number) {
  const campaign=STUDIO_ANALYSIS_PILOT_CAMPAIGN;
  await tx.query('INSERT INTO studio_assistance_campaigns(id,limit_nano_usd) VALUES($1,$2) ON CONFLICT DO NOTHING',[campaign,PILOT_BUDGET_NANO_USD]);
  const [budget]=await tx.query<{limit_nano_usd:string}>('SELECT limit_nano_usd FROM studio_assistance_campaigns WHERE id=$1 FOR UPDATE',[campaign]);
  const [usage]=await tx.query<{exposure:string;in_flight:boolean}>(`
    SELECT COALESCE(sum(COALESCE(f.charged_sponsored_nano_usd,f.reserved_sponsored_nano_usd)),0) AS exposure,
      COALESCE(bool_or(r.user_id=$2 AND r.state IN ('queued','running','unknown')),false) AS in_flight
    FROM studio_analysis_credit_funding f
    JOIN studio_media_analysis_runs r ON r.id=f.call_id
    WHERE f.campaign_id=$1`,[campaign,userId]);
  if(usage.in_flight)throw new AgentApiError('RATE_LIMITED','Finish or recover the reference analysis already in progress.');
  if(Number(usage.exposure)+supplierNanoUsd>Math.min(Number(budget.limit_nano_usd),PILOT_BUDGET_NANO_USD)){
    throw new AgentApiError('ENGINE_UNAVAILABLE','The free analysis pilot has reached its budget.');
  }
  await reserveStudioCredits(tx,callId,{allocations:[],quotedCents:0,sponsoredNanoUsd:supplierNanoUsd,campaignId:campaign},'analysis');
}
