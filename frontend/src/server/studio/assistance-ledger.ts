import {readStudioAnalysisExposure} from './media-analysis/exposure';
import {randomUUID} from 'node:crypto';
import {query,withDbTransaction,type QueryExecutor,type TransactionQueryExecutor} from '@/lib/db';
import {reserveWalletChargeInExecutor} from '@/lib/wallet';
import {AgentApiError} from '@/server/agent-api/errors';
import {getActiveAccountRestrictionInExecutor} from '@/server/fraud-cleanup/restrictions';
import type {StudioGenerationActor} from '@/server/agent-api/generation-actor';
import {STUDIO_ASSISTANCE_TARIFF,STUDIO_ASSISTANCE_CREDIT_TARIFF,studioAssistanceTariff,studioAssistanceChoiceSchema,type StudioAssistanceStatus,type StudioAssistanceMode,type StudioAssistantModel,type StudioAssistanceChoice} from '@/lib/studio/assistance-contract';
import {quoteStudioAssistance} from '../../../server/pricing/quote-studio-assistance';
import {readStudioUsage,studioProviderReservation,STUDIO_PROVIDER_RATE_VERSION} from './assistance-provider-facts';
import {studioAssistancePolicy,studioAssistancePolicyVersion,STUDIO_ASSISTANCE_CAMPAIGN_ID,type StudioAssistancePolicy} from './assistance-policy';

import {ensureStudioMonthlyCredits,readStudioCreditBalance,existingStudioCreditPurchase,purchaseStudioCreditPack,planStudioCreditReservation,reserveStudioCredits,settleStudioCredits,type CreditReservation} from './assistance-credit-ledger';

const CAMPAIGN = STUDIO_ASSISTANCE_CAMPAIGN_ID;
type Account = {user_id:string;selected_model:StudioAssistantModel;paid_enabled:boolean;paid_authorized_cents:number;tariff_version:string|null;sol_limit_nano_usd:string|number;luna_limit_nano_usd:string|number;revision:string|number};
export type AssistanceTurn = {model:StudioAssistantModel;mode:StudioAssistanceMode;tariff_version:string;policy_version:string};
export type AssistanceCall = {id:string;user_id:string;project_id:string;request_id:string;lease_id:string;response_index:number;model:StudioAssistantModel;mode:StudioAssistanceMode;state:'reserved'|'unknown'|'settled';reserved_nano_usd:string|number;reserved_cents:number;input_token_bound:number;output_token_bound:number;response_id:string|null;tariff_version:string;rate_version:string;policy_version:string};
export function assistanceError(reason:string,message:string,safeToStartNewRequest=false,completedModelCalls=0,canStartFollowup=!safeToStartNewRequest&&completedModelCalls>0):never {throw new AgentApiError('SPENDING_LIMIT_EXCEEDED',message,false,{type:'studio_assistance',reason,safeToStartNewRequest,canStartFollowup,completedModelCalls});}
export async function stopStudioAssistanceReplay(actor:StudioGenerationActor,requestId:string):Promise<never>{
  const usage=(await query<{settled:string;unresolved:string}>(`SELECT count(*) FILTER(WHERE state='settled')::text settled,count(*) FILTER(WHERE state<>'settled')::text unresolved FROM studio_assistance_calls WHERE user_id=$1 AND project_id=$2 AND request_id=$3`,[actor.userId,actor.projectId,requestId]))[0];
  if(Number(usage.unresolved)>0)assistanceError('usage_unresolved','This message still has unresolved model usage. Recover its saved response before continuing.');
  if(Number(usage.settled)>0)assistanceError('call_limit','Saved responses have been recovered. This message reached its model-call or retry limit.',false,Number(usage.settled));
  throw new AgentApiError('RATE_LIMITED','This message reached its retry limit.');
}
function requireEnabled(policy:StudioAssistancePolicy){if(!policy.enabled)throw new AgentApiError('ENGINE_UNAVAILABLE','Studio assistance is unavailable until its usage policy is enabled.');}
function emptyAccount(userId:string,policy:StudioAssistancePolicy):Account{return {user_id:userId,selected_model:'gpt-6.1-sol',paid_enabled:false,paid_authorized_cents:0,tariff_version:null,sol_limit_nano_usd:policy.solAllowanceNanoUsd,luna_limit_nano_usd:policy.lunaAllowanceNanoUsd,revision:0};}
export async function lockAccount(tx:TransactionQueryExecutor,userId:string,policy:StudioAssistancePolicy):Promise<Account>{
  if(!userId)throw new AgentApiError('AUTH_REQUIRED','Sign in to use Studio assistance.');
  // Always campaign -> account -> wallet, including settlement. No request-time schema work.
  await tx.query('INSERT INTO studio_assistance_campaigns(id,limit_nano_usd) VALUES($1,$2) ON CONFLICT DO NOTHING',[CAMPAIGN,policy.campaignNanoUsd]);
  await tx.query('SELECT id FROM studio_assistance_campaigns WHERE id=$1 FOR UPDATE',[CAMPAIGN]);
  await tx.query('INSERT INTO studio_assistance_accounts(user_id,sol_limit_nano_usd,luna_limit_nano_usd) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[userId,policy.solAllowanceNanoUsd,policy.lunaAllowanceNanoUsd]);
  return (await tx.query<Account>('SELECT * FROM studio_assistance_accounts WHERE user_id=$1 FOR UPDATE',[userId]))[0];
}
type Totals = {sol:number;luna:number;paidSpent:number;paidReserved:number;unresolved:number};
async function totals(db:QueryExecutor,userId:string,policy:StudioAssistancePolicy):Promise<Totals>{
  const rows=await db.query<{mode:StudioAssistanceMode;exposure:string;spent:string;reserved:string;unresolved:string}>(`SELECT mode,
    COALESCE(sum(CASE WHEN state='settled' THEN provider_max_nano_usd ELSE reserved_nano_usd END) FILTER(WHERE c.policy_version=$2 AND c.tariff_version=$3),0)::text exposure,
    COALESCE(sum(charged_cents) FILTER(WHERE state='settled' AND c.policy_version=$2 AND c.tariff_version=$3),0)::text spent,
    COALESCE(sum(reserved_cents) FILTER(WHERE state<>'settled' AND w.call_id IS NULL AND c.policy_version=$2 AND c.tariff_version=$3),0)::text reserved,
    count(*) FILTER(WHERE w.call_id IS NULL AND (state='unknown' OR (state='reserved' AND c.created_at<clock_timestamp()-interval '3 minutes')))::text unresolved
    FROM studio_assistance_calls c LEFT JOIN studio_assistance_resolutions w ON w.call_id=c.id AND w.action='waive_unknown' WHERE user_id=$1 GROUP BY mode`,[userId,studioAssistancePolicyVersion(policy),policy.credits?STUDIO_ASSISTANCE_CREDIT_TARIFF.version:STUDIO_ASSISTANCE_TARIFF.version]);
  const result={sol:0,luna:0,paidSpent:0,paidReserved:0,unresolved:0};
  for(const row of rows){if(row.mode==='included_sol')result.sol=Number(row.exposure);else if(row.mode==='sponsored_luna')result.luna=Number(row.exposure);else{result.paidSpent=Number(row.spent);result.paidReserved=Number(row.reserved);}result.unresolved+=Number(row.unresolved);}
  result.unresolved+=(await readStudioAnalysisExposure(db,userId)).unresolved;
  return result;
}
export async function campaignRemaining(db:QueryExecutor,policy:StudioAssistancePolicy){
  if(policy.credits){
    const row=(await db.query<{remaining:string}>(`SELECT c.limit_nano_usd-COALESCE((SELECT sum(CASE WHEN f.call_id IS NOT NULL THEN COALESCE(f.charged_sponsored_nano_usd,f.reserved_sponsored_nano_usd) ELSE CASE WHEN r.state='settled' THEN r.provider_max_nano_usd ELSE r.reserved_nano_usd END END) FROM studio_assistance_calls r LEFT JOIN studio_assistance_credit_funding f ON f.call_id=r.id WHERE r.campaign_id=c.id),0) remaining FROM studio_assistance_campaigns c WHERE id=$1`,[CAMPAIGN]))[0];
    return (row?Number(row.remaining):policy.campaignNanoUsd)-(await readStudioAnalysisExposure(db)).sponsoredNanoUsd;
  }
  const rows=await db.query<{remaining:string}>(`SELECT c.limit_nano_usd - COALESCE((SELECT sum(CASE WHEN r.state='settled' THEN r.provider_max_nano_usd ELSE r.reserved_nano_usd END) FROM studio_assistance_calls r WHERE r.campaign_id=c.id),0) AS remaining FROM studio_assistance_campaigns c WHERE id=$1`,[CAMPAIGN]);
  return (rows[0]?Number(rows[0].remaining):policy.campaignNanoUsd)-(await readStudioAnalysisExposure(db)).sponsoredNanoUsd;
}
function paidEnabled(account:Account,policy:StudioAssistancePolicy){return account.paid_enabled&&account.tariff_version===(policy.credits?STUDIO_ASSISTANCE_CREDIT_TARIFF.version:STUDIO_ASSISTANCE_TARIFF.version);}
function accountMode(account:Account,policy:StudioAssistancePolicy):StudioAssistanceMode{return account.selected_model==='gpt-6-luna'?'sponsored_luna':paidEnabled(account,policy)?'paid_sol':'included_sol';}
export async function readStudioAssistanceStatus(userId:string,policy=studioAssistancePolicy(),db:QueryExecutor={query}):Promise<StudioAssistanceStatus>{
  const account=policy.enabled?(await db.query<Account>('SELECT * FROM studio_assistance_accounts WHERE user_id=$1',[userId]))[0]??emptyAccount(userId,policy):emptyAccount(userId,policy);
  const usage=policy.enabled?await totals(db,userId,policy):{sol:0,luna:0,paidSpent:0,paidReserved:0,unresolved:0};
  const remaining=policy.enabled?await campaignRemaining(db,policy):0;
  if(policy.enabled&&policy.credits){
    const credits=await readStudioCreditBalance(db,userId),mode=accountMode(account,policy),paid=paidEnabled(account,policy);
    const available=credits.included.remaining+(paid?credits.purchased.remaining:0),sponsoredAvailable=remaining>0;
    const blockedReason=!sponsoredAvailable&&(mode==='sponsored_luna'||credits.included.remaining>0)?'campaign_exhausted':mode==='sponsored_luna'?null:available<=0?(paid?'paid_budget_exhausted':'included_exhausted'):null;
    return {enabled:true,policyVersion:studioAssistancePolicyVersion(policy),revision:Number(account.revision),selectedModel:account.selected_model,mode,tariff:STUDIO_ASSISTANCE_CREDIT_TARIFF,credits,sponsoredAvailable,
      includedSol:{remainingPercent:credits.included.remaining/credits.included.total*100,renewal:'monthly'},sponsoredLuna:{remainingPercent:100,renewal:'unlimited'},
      paid:{enabled:paid,authorizedCents:credits.purchased.total/10,spentCents:(credits.purchased.total-credits.purchased.remaining-credits.purchased.reserved)/10,reservedCents:credits.purchased.reserved/10,remainingCents:credits.purchased.remaining/10,maxAdditionalBudgetCents:1000},
      unresolvedCalls:usage.unresolved,canContinue:blockedReason===null,blockedReason};
  }
  const mode=accountMode(account,policy),paidRemaining=Math.max(0,account.paid_authorized_cents-usage.paidSpent-usage.paidReserved);
  const blockedReason=!policy.enabled?'disabled':mode==='paid_sol'?(paidRemaining<=0?'paid_budget_exhausted':null):remaining<=0?'campaign_exhausted':mode==='included_sol'&&usage.sol>=Number(account.sol_limit_nano_usd)?'included_exhausted':mode==='sponsored_luna'&&usage.luna>=Number(account.luna_limit_nano_usd)?'luna_exhausted':null;
  const percent=(limit:number,used:number)=>limit>0?Math.max(0,Math.round((limit-used)/limit*1000)/10):0;
  return {enabled:policy.enabled,policyVersion:studioAssistancePolicyVersion(policy),revision:Number(account.revision),selectedModel:account.selected_model,mode,tariff:STUDIO_ASSISTANCE_TARIFF,
    includedSol:{remainingPercent:percent(Number(account.sol_limit_nano_usd),usage.sol),renewal:'one_time'},sponsoredLuna:{remainingPercent:percent(Number(account.luna_limit_nano_usd),usage.luna),renewal:'one_time'},
    paid:{enabled:paidEnabled(account,policy),authorizedCents:account.paid_authorized_cents,spentCents:usage.paidSpent,reservedCents:usage.paidReserved,remainingCents:paidRemaining,maxAdditionalBudgetCents:Math.max(0,policy.maxAdditionalBudgetCents-paidRemaining-usage.paidReserved)},
    unresolvedCalls:usage.unresolved,canContinue:blockedReason===null,blockedReason};
}
export async function chooseStudioAssistance(userId:string,raw:StudioAssistanceChoice,policy=studioAssistancePolicy()):Promise<StudioAssistanceStatus>{
  requireEnabled(policy);const choice=studioAssistanceChoiceSchema.parse(raw);
  return withDbTransaction(async tx=>{
    const restriction=choice.action==='purchase_pack'||choice.action==='resume_paid'?await getActiveAccountRestrictionInExecutor(userId,tx):null;
    const account=await lockAccount(tx,userId,policy);
    if(choice.action==='purchase_pack'){
      if(!policy.credits)throw new AgentApiError('PARAMETER_INVALID','Credit packs are unavailable under this policy.');
      if(await existingStudioCreditPurchase(tx,userId,choice))return readStudioAssistanceStatus(userId,policy,tx);
    }
    if(Number(account.revision)!==choice.expectedRevision)throw new AgentApiError('PARAMETER_INVALID','Studio assistance settings changed. Refresh before choosing again.');
    const usage=await totals(tx,userId,policy);
    if(choice.action==='purchase_pack'||choice.action==='resume_paid'){
      if(!policy.credits||choice.tariffVersion!==STUDIO_ASSISTANCE_CREDIT_TARIFF.version)throw new AgentApiError('CONFIRMATION_REQUIRED','Review the current Sol pack tariff before confirming.');
      if(restriction)throw new AgentApiError('ACCOUNT_RESTRICTED','This account is temporarily restricted.');
      await ensureStudioMonthlyCredits(tx,userId);
      if(choice.action==='purchase_pack')await purchaseStudioCreditPack(tx,userId,choice);
      account.paid_enabled=true;account.selected_model='gpt-6.1-sol';account.tariff_version=choice.tariffVersion;
    }else if(choice.action==='authorize_paid'){
      if(policy.credits)throw new AgentApiError('PARAMETER_INVALID','Choose a Sol pack instead of a legacy spending limit.');

      if(choice.tariffVersion!==STUDIO_ASSISTANCE_TARIFF.version)throw new AgentApiError('CONFIRMATION_REQUIRED','Review the current Studio tariff before enabling a budget.');
      if(choice.budgetCents<usage.paidSpent+usage.paidReserved||choice.budgetCents>usage.paidSpent+policy.maxAdditionalBudgetCents)throw new AgentApiError('PARAMETER_INVALID','Choose a budget within the displayed range.');
      account.paid_authorized_cents=choice.budgetCents;account.paid_enabled=true;account.selected_model='gpt-6.1-sol';account.tariff_version=choice.tariffVersion;
    }else if(choice.action==='select_luna')account.selected_model='gpt-6-luna';
    else if(choice.action==='select_sol')account.selected_model='gpt-6.1-sol';
    else account.paid_enabled=false;
    await tx.query(`UPDATE studio_assistance_accounts SET selected_model=$2,paid_enabled=$3,paid_authorized_cents=$4,tariff_version=$5,revision=revision+1,updated_at=clock_timestamp() WHERE user_id=$1`,[userId,account.selected_model,account.paid_enabled,account.paid_authorized_cents,account.tariff_version]);
    await tx.query(`INSERT INTO studio_assistance_choices(user_id,revision,action,authorized_cents,tariff_version) VALUES($1,$2,$3,$4,$5)`,[userId,Number(account.revision)+1,choice.action,account.paid_authorized_cents,account.tariff_version]);
    return readStudioAssistanceStatus(userId,policy,tx);
  });
}
export async function openStudioAssistanceTurn(actor:StudioGenerationActor,requestId:string,policy=studioAssistancePolicy()):Promise<AssistanceTurn>{
  requireEnabled(policy);
  return withDbTransaction(async tx=>{
    const account=await lockAccount(tx,actor.userId,policy);
    if(policy.credits)await ensureStudioMonthlyCredits(tx,actor.userId);
    const tariff=policy.credits?STUDIO_ASSISTANCE_CREDIT_TARIFF:STUDIO_ASSISTANCE_TARIFF;
    await tx.query(`INSERT INTO studio_assistance_turns(user_id,project_id,request_id,model,mode,policy_version,tariff_version,tariff_snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb) ON CONFLICT DO NOTHING`,[actor.userId,actor.projectId,requestId,account.selected_model,accountMode(account,policy),studioAssistancePolicyVersion(policy),tariff.version,JSON.stringify(tariff)]);
    return (await tx.query<AssistanceTurn>('SELECT * FROM studio_assistance_turns WHERE user_id=$1 AND project_id=$2 AND request_id=$3',[actor.userId,actor.projectId,requestId]))[0];
  });
}
async function paidTurnBasis(tx:QueryExecutor,call:{user_id:string;project_id:string;request_id:string}){
  const row=(await tx.query<{basis:string;charged:string}>(`SELECT COALESCE(sum(tariff_basis_nano_usd),0)::text basis,COALESCE(sum(charged_cents),0)::text charged FROM studio_assistance_calls c WHERE user_id=$1 AND project_id=$2 AND request_id=$3 AND state='settled' AND mode='paid_sol' AND NOT EXISTS(SELECT 1 FROM studio_assistance_resolutions w WHERE w.call_id=c.id AND w.action='waive_unknown')`,[call.user_id,call.project_id,call.request_id]))[0];
  return {basis:Number(row.basis),charged:Number(row.charged)};
}
async function creditTurnBasis(tx:QueryExecutor,call:{user_id:string;project_id:string;request_id:string}){
  const row=(await tx.query<{basis:string;charged:string;sponsored:boolean}>(`SELECT COALESCE(sum(c.tariff_basis_nano_usd),0)::text basis,COALESCE(sum(f.charged_cents),0)::text charged,COALESCE(bool_or(f.reserved_sponsored_nano_usd>0),false) sponsored FROM studio_assistance_calls c JOIN studio_assistance_credit_funding f ON f.call_id=c.id WHERE c.user_id=$1 AND c.project_id=$2 AND c.request_id=$3 AND c.state='settled' AND NOT EXISTS(SELECT 1 FROM studio_assistance_resolutions w WHERE w.call_id=c.id AND w.action='waive_unknown')`,[call.user_id,call.project_id,call.request_id]))[0];
  return {basis:Number(row.basis),charged:Number(row.charged),sponsored:row.sponsored};
}
export async function reserveStudioAssistanceCall(input:{userId:string;projectId:string;requestId:string;leaseId:string;index:number;inputTokens:number;outputTokens:number},policy=studioAssistancePolicy(),executor?:TransactionQueryExecutor):Promise<AssistanceCall>{
  requireEnabled(policy);
  const reserve=async(tx:TransactionQueryExecutor)=>{
    if(await getActiveAccountRestrictionInExecutor(input.userId,tx)) {
      throw new AgentApiError('ACCOUNT_RESTRICTED','This account is temporarily restricted. Open MaxVideoAI for help.');
    }
    const account=await lockAccount(tx,input.userId,policy);
    const turn=(await tx.query<AssistanceTurn>('SELECT * FROM studio_assistance_turns WHERE user_id=$1 AND project_id=$2 AND request_id=$3',[input.userId,input.projectId,input.requestId]))[0];
    if(!turn)throw new AgentApiError('PARAMETER_INVALID','This assistance request is unavailable.');
    const tariff=policy.credits?STUDIO_ASSISTANCE_CREDIT_TARIFF:STUDIO_ASSISTANCE_TARIFF;
    const counts=(await tx.query<{dispatched:string;completed:string;unresolved:string}>(`SELECT count(*)::text dispatched,count(*) FILTER(WHERE state='settled')::text completed,count(*) FILTER(WHERE state<>'settled' AND NOT EXISTS(SELECT 1 FROM studio_assistance_resolutions w WHERE w.call_id=c.id AND w.action='waive_unknown'))::text unresolved FROM studio_assistance_calls c WHERE user_id=$1 AND project_id=$2 AND request_id=$3`,[input.userId,input.projectId,input.requestId]))[0];
    const dispatched=Number(counts.dispatched),completed=Number(counts.completed);
    if(turn.tariff_version!==tariff.version||turn.policy_version!==studioAssistancePolicyVersion(policy))assistanceError('policy_changed','Review the current assistance policy in a new message.',dispatched===0,completed,completed>0&&Number(counts.unresolved)===0);
    const existing=await tx.query(`SELECT id FROM studio_assistance_calls c WHERE user_id=$1 AND project_id=$2 AND request_id=$3 AND (state<>'settled' OR (lease_id=$4 AND response_index=$5) OR EXISTS(SELECT 1 FROM studio_assistance_resolutions w WHERE w.call_id=c.id AND w.action='waive_unknown'))`,[input.userId,input.projectId,input.requestId,input.leaseId,input.index]);
    if(existing.length)assistanceError('usage_unresolved','This message has unresolved or already dispatched model usage. Recover its saved response before retrying.');
    if(dispatched>=STUDIO_ASSISTANCE_TARIFF.maxCallsPerMessage)assistanceError('call_limit','This message reached its model-call limit.',false,dispatched);
    const safeToStartNewRequest=dispatched===0;
    const fail=(reason:string,message:string):never=>assistanceError(reason,message,safeToStartNewRequest,dispatched);
    if(policy.credits&&turn.model==='gpt-6-luna'){
      if(input.inputTokens>(policy.lunaMaxInputTokens??128000))fail('luna_request_too_large','This very large context needs GPT-6.1 Sol or a shorter request.');
      const active=await tx.query(`SELECT c.id FROM studio_assistance_calls c WHERE user_id=$1 AND model='gpt-6-luna' AND state<>'settled' AND request_id<>$2 AND NOT EXISTS(SELECT 1 FROM studio_assistance_resolutions w WHERE w.call_id=c.id AND w.action='waive_unknown')`,[input.userId,input.requestId]);
      if(active.length)fail('luna_busy','Wait for your current Luna message to finish or recover its saved response.');
    }
    const reserved=studioProviderReservation(turn.model,input.inputTokens,input.outputTokens),usage=await totals(tx,input.userId,policy);
    if((await readStudioAnalysisExposure(tx,input.userId)).unresolved>0)assistanceError('usage_unresolved','This account has unresolved analysis usage. Recover that analysis before another model call.');
    let cents=0,receiptId:string|null=null,creditPlan:CreditReservation|null=null;const id=randomUUID();
    if(policy.credits&&turn.model==='gpt-6.1-sol'){
      if(turn.mode==='paid_sol'&&(!account.paid_enabled||account.tariff_version!==turn.tariff_version))fail('paid_budget_exhausted','Resume paid Sol before using your purchased credits.');
      await ensureStudioMonthlyCredits(tx,input.userId);
      const total=await creditTurnBasis(tx,{user_id:input.userId,project_id:input.projectId,request_id:input.requestId});
      const quote=quoteStudioAssistance(total.basis+reserved,turn.tariff_version);
      creditPlan=await planStudioCreditReservation(tx,input.userId,quote.customerTotalCents-total.charged,reserved,turn.mode==='paid_sol'&&account.paid_enabled,total.sponsored);
      if(!creditPlan)fail(turn.mode==='paid_sol'?'paid_budget_exhausted':'included_exhausted','The next model call exceeds your available Sol credits.');
      if(creditPlan!.sponsoredNanoUsd>0&&creditPlan!.sponsoredNanoUsd>await campaignRemaining(tx,policy))fail('campaign_exhausted','Free Studio assistance is temporarily unavailable.');
    }else if(turn.mode==='paid_sol'){
      if(!account.paid_enabled||account.tariff_version!==turn.tariff_version)fail('paid_budget_exhausted','Enable a Studio budget before continuing paid assistance.');
      const total=await paidTurnBasis(tx,{user_id:input.userId,project_id:input.projectId,request_id:input.requestId});
      const price=quoteStudioAssistance(total.basis+reserved,turn.tariff_version);
      cents=price.customerTotalCents-total.charged;
      if(usage.paidSpent+usage.paidReserved+cents>account.paid_authorized_cents)fail('paid_budget_exhausted','This next model call exceeds your authorized Studio budget.');
      if(cents>0){
        const result=await reserveWalletChargeInExecutor(tx,{userId:input.userId,amountCents:cents,currency:'USD',description:'Studio assistance reservation',jobId:'studio-assistance:'+id,surface:'tool',billingProductKey:'studio_assistance',pricingSnapshotJson:JSON.stringify({phase:'reservation',tariff:STUDIO_ASSISTANCE_TARIFF,maximumMessageQuote:price}),applicationFeeCents:null,vendorAccountId:null},{preferredCurrency:null});
        if(result.ok)receiptId=result.receiptId;
        else fail('wallet_insufficient','Top up your wallet to fund the Studio budget, or explicitly choose included Luna assistance.');
      }
    }else{
      const used=turn.mode==='included_sol'?usage.sol:usage.luna,limit=Number(turn.mode==='included_sol'?account.sol_limit_nano_usd:account.luna_limit_nano_usd);
      if(!(policy.credits&&turn.model==='gpt-6-luna')&&used+reserved>limit)fail(turn.mode==='included_sol'?'included_exhausted':'luna_exhausted','The next model call exceeds the remaining included allowance. Choose how to continue.');
      if(reserved>await campaignRemaining(tx,policy))fail('campaign_exhausted','Included Studio assistance has reached its current campaign limit.');
    }
    const campaignId=creditPlan?(creditPlan.sponsoredNanoUsd>0?CAMPAIGN:null):turn.mode!=='paid_sol'?CAMPAIGN:null;
    const call=(await tx.query<AssistanceCall>(`INSERT INTO studio_assistance_calls(id,user_id,project_id,request_id,lease_id,response_index,model,mode,policy_version,rate_version,tariff_version,campaign_id,input_token_bound,output_token_bound,reserved_nano_usd,reserved_cents,charge_receipt_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,[id,input.userId,input.projectId,input.requestId,input.leaseId,input.index,turn.model,turn.mode,turn.policy_version,STUDIO_PROVIDER_RATE_VERSION,turn.tariff_version,campaignId,input.inputTokens,input.outputTokens,reserved,cents,receiptId]))[0];
    if(creditPlan)await reserveStudioCredits(tx,id,creditPlan);
    return call;
  };
  return executor?reserve(executor):withDbTransaction(reserve);
}
export async function markStudioAssistanceUnknown(id:string,userId:string){await query("UPDATE studio_assistance_calls SET state='unknown' WHERE id=$1 AND user_id=$2 AND state='reserved'",[id,userId]);}
export type StudioUsageEvidence={id:string;model:string;service_tier?:unknown;usage?:unknown};
export async function settleStudioAssistanceCall(id:string,userId:string,response:StudioUsageEvidence,executor?:TransactionQueryExecutor){
  const settle=async(tx:TransactionQueryExecutor)=>{
    await lockAccount(tx,userId,studioAssistancePolicy());
    const call=(await tx.query<AssistanceCall>('SELECT * FROM studio_assistance_calls WHERE id=$1 AND user_id=$2 FOR UPDATE',[id,userId]))[0];
    if(!call)throw new AgentApiError('PARAMETER_INVALID','This usage record is not available.');
    if(call.state==='settled'){if(call.response_id!==response.id)throw new AgentApiError('PARAMETER_INVALID','This call already has a different settlement.');return true;}
    if(call.response_id && call.response_id!==response.id)throw new AgentApiError('PARAMETER_INVALID','This call belongs to a different response.');
    const facts=readStudioUsage(response.usage,response.model,response.service_tier);
    if(!facts||response.model!==call.model||facts.inputTokens>call.input_token_bound||facts.outputTokens>call.output_token_bound||facts.providerMaxNanoUsd>Number(call.reserved_nano_usd)||!studioAssistanceTariff(call.tariff_version)||call.rate_version!==STUDIO_PROVIDER_RATE_VERSION){
      await tx.query(`UPDATE studio_assistance_calls SET state='unknown',response_id=$3,returned_model=$4,service_tier=$5 WHERE id=$1 AND user_id=$2`,[id,userId,response.id,response.model,typeof response.service_tier==='string'?response.service_tier:null]);return false;
    }
    let charged=0,price:ReturnType<typeof quoteStudioAssistance>|null=null;
    const waived=(await tx.query("SELECT 1 FROM studio_assistance_resolutions WHERE call_id=$1 AND action='waive_unknown'",[id])).length>0;
    if(call.tariff_version===STUDIO_ASSISTANCE_CREDIT_TARIFF.version&&call.model==='gpt-6.1-sol'){
      if(!waived){const total=await creditTurnBasis(tx,call);price=quoteStudioAssistance(total.basis+facts.tariffBasisNanoUsd,call.tariff_version);const settled=await settleStudioCredits(tx,id,price.customerTotalCents-total.charged,facts.providerMaxNanoUsd);charged=settled.paidCents;}
      else await tx.query('UPDATE studio_assistance_credit_funding SET charged_cents=0,charged_sponsored_nano_usd=LEAST(reserved_sponsored_nano_usd,$2) WHERE call_id=$1',[id,facts.providerMaxNanoUsd]);
    }else if(call.mode==='paid_sol'&&!waived){
      const total=await paidTurnBasis(tx,call);price=quoteStudioAssistance(total.basis+facts.tariffBasisNanoUsd,call.tariff_version);charged=price.customerTotalCents-total.charged;
      if(charged<0||charged>call.reserved_cents)throw new AgentApiError('INTERNAL_ERROR','Studio settlement exceeds its reservation.');
      const refund=call.reserved_cents-charged;
      if(refund>0)await tx.query(`INSERT INTO app_receipts(user_id,type,amount_cents,currency,description,job_id,surface,billing_product_key,pricing_snapshot) VALUES($1,'refund',$2,'USD','Unused Studio assistance reservation',$3,'tool','studio_assistance',$4::jsonb)`,[userId,refund,'studio-assistance:'+id,JSON.stringify({tariffVersion:call.tariff_version,chargedCents:charged,settledMessageQuote:price})]);
    }
    await tx.query(`UPDATE studio_assistance_calls SET state='settled',response_id=$3,returned_model=$4,service_tier=$5,usage_facts=$6::jsonb,provider_min_nano_usd=$7,provider_max_nano_usd=$8,tariff_basis_nano_usd=$9,charged_cents=$10,pricing_snapshot=$11::jsonb,settled_at=clock_timestamp() WHERE id=$1 AND user_id=$2`,[id,userId,response.id,response.model,response.service_tier,JSON.stringify(facts),facts.providerMinNanoUsd,facts.providerMaxNanoUsd,facts.tariffBasisNanoUsd,charged,JSON.stringify(price)]);
    return true;
  };
  return executor?settle(executor):withDbTransaction(settle);
}
