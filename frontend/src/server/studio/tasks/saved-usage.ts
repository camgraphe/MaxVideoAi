import type {QueryExecutor} from '@/lib/db';
import {readStudioUsage} from '../assistance-provider-facts';
import type {StudioTaskRow} from './repository';
/** Proof for replaying stored provider output, never permission to dispatch. */
export async function studioTaskSavedUsageKnown(row:StudioTaskRow,db:QueryExecutor,includeSettled=false) {
  const calls=await db.query<{response_json:{model?:string;service_tier?:string;usage?:unknown}|null;model:string;input_token_bound:number;output_token_bound:number;reserved_nano_usd:string}>(`SELECT c.model,c.input_token_bound,c.output_token_bound,c.reserved_nano_usd,r.response_json
    FROM studio_assistance_calls c LEFT JOIN studio_conversation_responses r ON r.user_id=c.user_id AND r.project_id=c.project_id AND r.request_id=c.request_id AND r.lease_id=c.lease_id AND r.response_index=c.response_index AND r.state='reported'
    WHERE c.user_id=$1 AND c.project_id=$2 AND c.request_id=$3 AND ($4 OR c.state<>'settled')
    AND NOT EXISTS(SELECT 1 FROM studio_assistance_resolutions w WHERE w.call_id=c.id AND w.action='waive_unknown')`,[row.user_id,row.project_id,row.segment_request_id,includeSettled]);
  return calls.length>0&&calls.every(call=>{const r=call.response_json,facts=r?readStudioUsage(r.usage,r.model,r.service_tier):null;
    return r?.model===call.model&&facts&&facts.inputTokens<=call.input_token_bound&&facts.outputTokens<=call.output_token_bound&&facts.providerMaxNanoUsd<=Number(call.reserved_nano_usd);});
}
