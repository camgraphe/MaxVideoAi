import {createHash} from 'node:crypto';
import {z} from 'zod';
import {withDbTransaction,type QueryExecutor,type TransactionQueryExecutor} from '@/lib/db';
import {isStudioCreditCall,studioAssistanceTariff} from '@/lib/studio/assistance-contract';
import {stableJson} from '@/server/agent-api/generation-normalization';
import {lockAccount,type AssistanceCall} from './assistance-ledger';
import {studioAssistancePolicy} from './assistance-policy';
import {readStudioUsage,studioProviderRateVersion} from './assistance-provider-facts';

const scopeSchema=z.object({callId:z.string().uuid(),userId:z.string().min(1).max(128)}).strict();
const applySchema=scopeSchema.extend({expectedFingerprint:z.string().regex(/^[a-f0-9]{64}$/),operator:z.string().trim().min(1).max(128),reason:z.string().trim().min(1).max(500)}).strict();
const hash=(value:unknown)=>createHash('sha256').update(stableJson(value)).digest('hex');
type FinancialCall=AssistanceCall&{returned_model:string|null;service_tier:string|null;provider_min_nano_usd:string|null;provider_max_nano_usd:string|null;tariff_basis_nano_usd:string|null;usage_facts:unknown;charged_cents:number|null;charge_receipt_id:string|null};
type Request={user_id:string;session_id:string;request_id:string;call_id:string;lease_id:string;model:string;state:string;error:string|null;reply_json:unknown;context_json:unknown;response_json:{id:string;model:string;status:string;service_tier:string;usage:unknown;output?:Array<{type:string;content?:Array<{type:string}>}>}|null};
type Allocation={lot_id:string;user_id:string;kind:string;period:string|null;charged_credits:string|null;released_at:Date|null;consumed_credits:string};
type Refund={expected_fingerprint:string;refund_credits:number;account_revision:string;response_id:string};

async function snapshot(db:QueryExecutor,input:z.infer<typeof scopeSchema>){
 const call=(await db.query<FinancialCall>('SELECT * FROM studio_assistance_calls WHERE id=$1 AND user_id=$2',[input.callId,input.userId]))[0];
 if(!call)throw new Error('The exact owned assistance call was not found.');
 const request=(await db.query<Request>('SELECT user_id,session_id,request_id,call_id,lease_id,model,state,error,reply_json,context_json,response_json FROM prompt_assistance_requests WHERE user_id=$1 AND call_id=$2',[input.userId,input.callId]))[0];
 const funding=(await db.query<{charged_cents:number|null}>('SELECT charged_cents FROM studio_assistance_credit_funding WHERE call_id=$1',[input.callId]))[0];
 const allocations=await db.query<Allocation>(`SELECT a.lot_id,l.user_id,l.kind,to_char(l.period,'YYYY-MM-DD') period,a.charged_credits::text,a.released_at,l.consumed_credits::text FROM studio_assistance_credit_allocations a JOIN studio_assistance_credit_lots l ON l.id=a.lot_id WHERE a.call_id=$1 ORDER BY l.purchase_order`,[input.callId]);
 const refund=(await db.query<Refund>('SELECT expected_fingerprint,refund_credits,account_revision::text,response_id FROM studio_assistance_output_refunds WHERE call_id=$1',[input.callId]))[0];
 const revision=(await db.query<{revision:string}>('SELECT revision::text FROM studio_assistance_accounts WHERE user_id=$1',[input.userId]))[0]?.revision;
 const waived=(await db.query("SELECT 1 FROM studio_assistance_resolutions WHERE call_id=$1 AND action='waive_unknown'",[input.callId])).length>0;
 return {call,request,funding,allocations,refund,revision,waived};
}
type Snapshot=Awaited<ReturnType<typeof snapshot>>;
function validate(state:Snapshot){
 const {call,request,funding,allocations,waived}=state,response=request?.response_json;
 if(!isStudioCreditCall(call)||call.state!=='settled'||waived||!request||request.state!=='failed'||request.error!=='OUTPUT_INVALID'||request.reply_json!==null
   ||request.user_id!==call.user_id||call.project_id!==`composer:${request.session_id}`||request.request_id!==call.request_id||request.lease_id!==call.lease_id||request.model!==call.model||call.response_index!==0)
  throw new Error('Only settled, owned, undelivered application-invalid composer replies are eligible.');
 if(!response||response.status!=='completed'||response.output?.some(item=>item.type==='message'&&item.content?.some(part=>part.type==='refusal')))
  throw new Error('Incomplete responses and provider refusals are not eligible.');
 const facts=readStudioUsage(response.usage,response.model,response.service_tier);
 if(!facts||response.id!==call.response_id||response.model!==call.model||response.model!==call.returned_model||response.service_tier!==call.service_tier
   ||facts.inputTokens>call.input_token_bound||facts.outputTokens>call.output_token_bound||facts.providerMaxNanoUsd>Number(call.reserved_nano_usd)
   ||facts.providerMaxNanoUsd!==Number(call.provider_max_nano_usd)||facts.providerMinNanoUsd!==Number(call.provider_min_nano_usd)||facts.tariffBasisNanoUsd!==Number(call.tariff_basis_nano_usd)
   ||hash(facts)!==hash(call.usage_facts)||!studioAssistanceTariff(call.tariff_version)||call.rate_version!==studioProviderRateVersion(call.model))
  throw new Error('The settled supplier facts do not match supported scoped recorded evidence.');
 if(!funding||funding.charged_cents===null||allocations.some(a=>a.user_id!==call.user_id||a.charged_credits===null||a.released_at!==null||Number(a.charged_credits)>Number(a.consumed_credits)))
  throw new Error('The original charged credit allocations are not available.');
 const credits=allocations.reduce((sum,a)=>sum+Number(a.charged_credits),0),paid=allocations.filter(a=>a.kind==='purchased').reduce((sum,a)=>sum+Number(a.charged_credits),0);
 if(!Number.isSafeInteger(credits)||credits<=0||credits!==funding.charged_cents*10||paid!==Number(call.charged_cents)*10||call.charge_receipt_id)
  throw new Error('No exact positive credit-only charge is available to restore.');
 return credits;
}
function preview(state:Snapshot){
 const refundCredits=state.refund?.refund_credits??validate(state),{call,request,allocations}=state;
 return {callId:call.id,userId:call.user_id,sessionId:request.session_id,requestId:call.request_id,model:call.model,responseId:call.response_id,
  refundCredits,accountRevision:Number(state.refund?.account_revision??state.revision),alreadyApplied:!!state.refund,
  allocations:allocations.filter(a=>Number(a.charged_credits)>0).map(a=>({lotId:a.lot_id,kind:a.kind,period:a.period,credits:Number(a.charged_credits)})),
  fingerprint:state.refund?.expected_fingerprint??hash({call,request:{...request,response_json:hash(request.response_json),context_json:hash(request.context_json)},funding:state.funding,allocations,revision:state.revision,waived:state.waived})};
}
/** Exact-call, repeatable read-only preview. Never reveals prompts or response text. */
export async function inspectStudioAssistanceOutputRefund(raw:z.input<typeof scopeSchema>){
 const input=scopeSchema.parse(raw);
 return withDbTransaction(async tx=>{await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');await tx.query("SET LOCAL statement_timeout='5s'");return preview(await snapshot(tx,input));});
}
async function applyInTransaction(tx:TransactionQueryExecutor,input:z.infer<typeof applySchema>){
 const state=await snapshot(tx,input);
 if(state.refund){
  if(state.refund.expected_fingerprint!==input.expectedFingerprint)throw new Error('This call already has a different approved output refund.');
  return {...preview(state),applied:false};
 }
 const proposed=preview(state);
 if(proposed.fingerprint!==input.expectedFingerprint)throw new Error('Support preview changed; inspect the exact call again.');
 for(const allocation of proposed.allocations){
  const changed=await tx.query('UPDATE studio_assistance_credit_lots SET consumed_credits=consumed_credits-$3 WHERE id=$1 AND user_id=$2 AND consumed_credits>=$3 RETURNING id',[allocation.lotId,input.userId,allocation.credits]);
  if(changed.length!==1)throw new Error('The original credit lot changed before restoration.');
 }
 const account=(await tx.query<{revision:string}>('UPDATE studio_assistance_accounts SET revision=revision+1,updated_at=clock_timestamp() WHERE user_id=$1 RETURNING revision::text',[input.userId]))[0];
 await tx.query(`INSERT INTO studio_assistance_output_refunds(call_id,user_id,session_id,request_id,response_id,response_fingerprint,expected_fingerprint,refund_credits,account_revision,operator_id,reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,[input.callId,input.userId,state.request.session_id,state.request.request_id,state.call.response_id,hash(state.request.response_json),input.expectedFingerprint,proposed.refundCredits,account.revision,input.operator,input.reason]);
 for(const allocation of proposed.allocations)await tx.query('INSERT INTO studio_assistance_output_refund_allocations(call_id,lot_id,refund_credits) VALUES($1,$2,$3)',[input.callId,allocation.lotId,allocation.credits]);
 return {...proposed,accountRevision:Number(account.revision),alreadyApplied:true,applied:true};
}
/** Support changes no turn state or supplier/charge facts. Customer balance and audit commit together. */
export async function applyStudioAssistanceOutputRefund(raw:z.input<typeof applySchema>){
 const input=applySchema.parse(raw);
 return withDbTransaction(async tx=>{
  await tx.query("SET LOCAL lock_timeout='5s'");
  await tx.query("SET LOCAL statement_timeout='10s'");
  await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`prompt-assistance:${input.userId}`]);
  await lockAccount(tx,input.userId,studioAssistancePolicy());
  return applyInTransaction(tx,input);
 });
}
/** Called inside the existing prompt/account-locked settlement transaction only for a new OUTPUT_INVALID. */
export async function refundInvalidPromptOutput(tx:TransactionQueryExecutor,input:z.infer<typeof scopeSchema>){
 const state=await snapshot(tx,scopeSchema.parse(input));
 if(!isStudioCreditCall(state.call)||!state.funding?.charged_cents)return null;
 return applyInTransaction(tx,{...input,expectedFingerprint:preview(state).fingerprint,operator:'system:composer-output-invalid',reason:'Completed provider output rejected by application reply validation; no reply delivered.'});
}
