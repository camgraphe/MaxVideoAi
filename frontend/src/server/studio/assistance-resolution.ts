import {createHash,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {query,withDbTransaction,type QueryExecutor} from '@/lib/db';
import {lockUserWalletInExecutor} from '@/lib/wallet';
import {stableJson} from '@/server/agent-api/generation-normalization';
import {lockAccount,settleStudioAssistanceCall,type AssistanceCall,type StudioUsageEvidence} from './assistance-ledger';
import {studioAssistancePolicy} from './assistance-policy';
import {readStudioUsage,STUDIO_PROVIDER_RATE_VERSION} from './assistance-provider-facts';
import {STUDIO_ASSISTANCE_TARIFF} from '@/lib/studio/assistance-contract';

const actionSchema=z.enum(['waive_unknown','settle_recorded']);
export type StudioAssistanceResolutionAction=z.infer<typeof actionSchema>;
const applySchema=z.object({callId:z.string().uuid(),action:actionSchema,expectedFingerprint:z.string().regex(/^[a-f0-9]{64}$/),operator:z.string().trim().min(1).max(128),reason:z.string().trim().min(1).max(500)}).strict();
type Turn={state:string;lease_id:string;lease_expires_at:string;lease_active:boolean;has_draft:boolean;quote_id:string|null};
type Receipt={id:string;user_id:string;type:string;amount_cents:number;currency:string;job_id:string;surface:string;billing_product_key:string};
type Resolution={action:StudioAssistanceResolutionAction;expected_fingerprint:string;refund_cents:number};
type Call=AssistanceCall&{charge_receipt_id:string|null;created_at:Date};
type Snapshot={call:Call;turn:Turn|null;projectExists:boolean;evidence:StudioUsageEvidence|null;receipts:Receipt[];resolutions:Resolution[];pendingActions:number;otherUnresolved:number};
const hash=(value:unknown)=>createHash('sha256').update(stableJson(value)).digest('hex');
const scope=(call:Call)=>[call.user_id,call.project_id,call.request_id];

async function snapshot(callId:string,db:QueryExecutor):Promise<Snapshot>{
  const call=(await db.query<Call>('SELECT * FROM studio_assistance_calls WHERE id=$1',[callId]))[0];
  if(!call)throw new Error('Studio assistance call not found.');
  const params=scope(call);
  const turn=(await db.query<Turn>(`SELECT state,lease_id,lease_expires_at::text,lease_expires_at>clock_timestamp() AS lease_active,draft_json IS NOT NULL AS has_draft,quote_id FROM studio_image_turns WHERE user_id=$1 AND project_id=$2 AND request_id=$3`,params))[0]??null;
  const projectExists=(await db.query('SELECT 1 FROM studio_projects WHERE user_id=$1 AND id=$2 AND deleted_at IS NULL',params.slice(0,2))).length>0;
  const saved=(await db.query<{evidence:StudioUsageEvidence}>(`SELECT jsonb_build_object('id',response_id,'model',response_json->'model','service_tier',response_json->'service_tier','usage',response_json->'usage') evidence FROM studio_conversation_responses WHERE user_id=$1 AND project_id=$2 AND request_id=$3 AND lease_id=$4 AND response_index=$5 AND state='reported'`,[...params,call.lease_id,call.response_index]))[0];
  const receipts=await db.query<Receipt>(`SELECT id::text,user_id,type,amount_cents,currency,job_id,surface,billing_product_key FROM app_receipts WHERE job_id=$1 OR id::text=$2 ORDER BY id LIMIT 21`,['studio-assistance:'+call.id,call.charge_receipt_id]);
  const resolutions=await db.query<Resolution>('SELECT action,expected_fingerprint,refund_cents FROM studio_assistance_resolutions WHERE call_id=$1 ORDER BY action',[callId]);
  const pendingActions=Number((await db.query<{n:string}>("SELECT count(*)::text n FROM studio_conversation_steps WHERE user_id=$1 AND project_id=$2 AND request_id=$3 AND state='started'",params))[0].n);
  const otherUnresolved=Number((await db.query<{n:string}>(`SELECT count(*)::text n FROM studio_assistance_calls c WHERE user_id=$1 AND project_id=$2 AND request_id=$3 AND id<>$4 AND state<>'settled' AND NOT EXISTS(SELECT 1 FROM studio_assistance_resolutions w WHERE w.call_id=c.id AND w.action='waive_unknown')`,[...params,callId]))[0].n);
  return {call,turn,projectExists,evidence:saved?.evidence??null,receipts,resolutions,pendingActions,otherUnresolved};
}
function validEvidence(state:Snapshot){
  const response=state.evidence,call=state.call;
  if(!response||typeof response.id!=='string'||!response.id)return false;
  const facts=readStudioUsage(response.usage,response.model,response.service_tier);
  return !!facts&&response.model===call.model&&(!call.response_id||call.response_id===response.id)&&facts.inputTokens<=call.input_token_bound&&facts.outputTokens<=call.output_token_bound&&facts.providerMaxNanoUsd<=Number(call.reserved_nano_usd)&&call.tariff_version===STUDIO_ASSISTANCE_TARIFF.version&&call.rate_version===STUDIO_PROVIDER_RATE_VERSION;
}
function validate(state:Snapshot,action:StudioAssistanceResolutionAction){
  const prior=state.resolutions.find(row=>row.action===action);
  if(prior)return prior.refund_cents;
  if(action==='settle_recorded'){
    if(!validEvidence(state))throw new Error('No valid, scoped recorded provider evidence is available.');
    return 0;
  }
  if(state.call.state==='settled')throw new Error('This call is already settled; the support preview changed.');
  // Expiry permits explicit lease revocation below, never an inference of zero supplier usage.
  if(state.turn?.state!=='failed'&&!(state.turn?.state==='thinking'&&!state.turn.lease_active)&&(state.turn||state.projectExists))throw new Error('Customer waiver requires a failed turn or an expired lease that can be explicitly revoked; an active lease is refused.');
  if(state.turn?.has_draft||state.turn?.quote_id||state.pendingActions)throw new Error('Saved creation or unfinished actions require separate recovery before closing this request.');
  if(validEvidence(state))throw new Error('Valid recorded provider evidence exists; settle the recorded response instead.');
  const call=state.call;
  if(call.reserved_cents===0){if(state.receipts.length||call.charge_receipt_id)throw new Error('The reservation receipts are inconsistent.');return 0;}
  const charge=state.receipts[0];
  if(state.receipts.length!==1||!charge||charge.id!==String(call.charge_receipt_id)||charge.user_id!==call.user_id||charge.type!=='charge'||charge.amount_cents!==call.reserved_cents||charge.currency!=='USD'||charge.job_id!=='studio-assistance:'+call.id||charge.surface!=='tool'||charge.billing_product_key!=='studio_assistance')throw new Error('The original Studio wallet charge is inconsistent or already refunded.');
  return call.reserved_cents;
}
function preview(state:Snapshot,action:StudioAssistanceResolutionAction){
  const refundCents=validate(state,action);
  return {callId:state.call.id,userId:state.call.user_id,projectId:state.call.project_id,requestId:state.call.request_id,action,callState:state.call.state,refundCents,supplierExposureNanoUsd:String(state.call.reserved_nano_usd),alreadyApplied:state.resolutions.some(row=>row.action===action),fingerprint:hash(JSON.parse(JSON.stringify({action,...state})))};
}
/** Read-only preview: no schema bootstrap, locks, model requests or customer content output. */
export async function inspectStudioAssistanceResolution(callId:string,action:StudioAssistanceResolutionAction){
  z.string().uuid().parse(callId);actionSchema.parse(action);
  return preview(await snapshot(callId,{query}),action);
}

export async function applyStudioAssistanceResolution(raw:z.input<typeof applySchema>){
  const input=applySchema.parse(raw),initial=await snapshot(input.callId,{query});
  return withDbTransaction(async tx=>{
    await tx.query("SET LOCAL lock_timeout='5s'");await tx.query("SET LOCAL statement_timeout='15s'");
    // Turn claim/action fencing precedes the existing campaign -> account -> wallet order.
    await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['studio-image:'+initial.call.user_id]);
    await tx.query('SELECT request_id FROM studio_image_turns WHERE user_id=$1 AND project_id=$2 AND request_id=$3 FOR UPDATE',scope(initial.call));
    await lockAccount(tx,initial.call.user_id,studioAssistancePolicy());
    await tx.query('SELECT id FROM studio_assistance_calls WHERE id=$1 FOR UPDATE',[input.callId]);
    await lockUserWalletInExecutor(tx,initial.call.user_id);
    const state=await snapshot(input.callId,tx);
    const prior=state.resolutions.find(row=>row.action===input.action);
    if(prior){
      // Replaying the original approval is safe even though the resulting snapshot changed.
      if(prior.expected_fingerprint!==input.expectedFingerprint&&preview(state,input.action).fingerprint!==input.expectedFingerprint)throw new Error('Support preview changed; inspect the call again.');
      return {...preview(state,input.action),applied:false};
    }
    const proposed=preview(state,input.action);
    if(proposed.fingerprint!==input.expectedFingerprint)throw new Error('Support preview changed; inspect the call again.');
    let refundReceiptId:string|null=null;
    if(input.action==='settle_recorded'){
      if(!await settleStudioAssistanceCall(input.callId,state.call.user_id,state.evidence!,tx))throw new Error('Recorded provider evidence could not be settled.');
    }else{
      if(proposed.refundCents>0){
        const inserted=await tx.query<{id:string}>(`INSERT INTO app_receipts(user_id,type,amount_cents,currency,description,job_id,surface,billing_product_key,metadata) VALUES($1,'refund',$2,'USD','Studio assistance customer waiver; supplier usage remains unresolved',$3,'tool','studio_assistance',$4::jsonb) RETURNING id::text`,[state.call.user_id,proposed.refundCents,'studio-assistance:'+input.callId,JSON.stringify({reason:'studio_assistance_customer_waiver',original_receipt_id:state.call.charge_receipt_id,operator_id:input.operator})]);
        refundReceiptId=inserted[0].id;
      }
      if(state.turn){
        const reply='This message was closed after an assistance connection problem. Its unresolved assistance reservation was released for you; any earlier settled assistance charges remain. Earlier completed work stays saved. Send a new follow-up from the current project without repeating completed changes.';
        const close=state.otherUnresolved===0;
        // The locked turn and absence of started actions fence every executable action.
        // A late provider response may still report usage, but cannot execute under this revoked lease.
        const fenced=await tx.query(`UPDATE studio_image_turns SET state=$4,draft_json=$5::jsonb,draft_reference_fingerprint=$6,lease_id=$7,lease_expires_at=clock_timestamp(),updated_at=clock_timestamp() WHERE user_id=$1 AND project_id=$2 AND request_id=$3 AND lease_id=$8 AND (state='failed' OR (state='thinking' AND lease_expires_at<=clock_timestamp())) AND draft_json IS NULL RETURNING request_id`,[...scope(state.call),close?'ready':'failed',close?JSON.stringify({image:null,reply}):null,close?hash({supportCloseout:input.callId}):null,randomUUID(),state.turn.lease_id]);
        if(!fenced.length)throw new Error('The request lease changed before support closeout.');
      }
    }
    await tx.query(`INSERT INTO studio_assistance_resolutions(call_id,action,operator_id,reason,expected_fingerprint,refund_cents,refund_receipt_id,revoked_lease_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[input.callId,input.action,input.operator,input.reason,input.expectedFingerprint,proposed.refundCents,refundReceiptId,input.action==='waive_unknown'?state.turn?.lease_id??null:null]);
    return {...proposed,applied:true};
  });
}

export async function listStudioAssistanceUnresolved(){
  return query<{id:string;user_id:string;project_id:string;request_id:string;state:string;mode:string;reserved_cents:number;reserved_nano_usd:string;created_at:string;customer_waived:boolean}>(`SELECT c.id,c.user_id,c.project_id,c.request_id,c.state,c.mode,c.reserved_cents,c.reserved_nano_usd::text,c.created_at::text,w.call_id IS NOT NULL customer_waived FROM studio_assistance_calls c LEFT JOIN studio_assistance_resolutions w ON w.call_id=c.id AND w.action='waive_unknown' WHERE c.state='unknown' OR (c.state='reserved' AND c.created_at<clock_timestamp()-interval '3 minutes') ORDER BY (w.call_id IS NOT NULL),c.created_at,c.id LIMIT 100`);
}
