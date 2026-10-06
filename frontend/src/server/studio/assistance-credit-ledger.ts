import {randomUUID} from 'node:crypto';
import type {QueryExecutor,TransactionQueryExecutor} from '@/lib/db';
import {reserveWalletChargeInExecutor} from '@/lib/wallet';
import {AgentApiError} from '@/server/agent-api/errors';
import {STUDIO_SOL_MONTHLY_CREDITS,STUDIO_SOL_CREDITS_PER_DOLLAR,STUDIO_ASSISTANCE_CREDIT_TARIFF,type StudioCreditBalance} from '@/lib/studio/assistance-contract';
import {STUDIO_ASSISTANCE_CAMPAIGN_ID} from './assistance-policy';

export type StudioCreditConsumer='chat'|'analysis';
const creditTables=(consumer:StudioCreditConsumer)=>consumer==='analysis'?{funding:'studio_analysis_credit_funding',allocations:'studio_analysis_credit_allocations'}:{funding:'studio_assistance_credit_funding',allocations:'studio_assistance_credit_allocations'};

type Lot={id:string;kind:'included'|'purchased';period:string|null;total_credits:string;consumed_credits:string;reserved_credits:string;amount_cents:number;created_at:Date;purchase_order:string};
const creditsPerCent=STUDIO_SOL_CREDITS_PER_DOLLAR/100;
const quantity=(lot:Lot)=>({total:Number(lot.total_credits),remaining:Number(lot.total_credits)-Number(lot.consumed_credits)-Number(lot.reserved_credits),reserved:Number(lot.reserved_credits)});
async function period(db:QueryExecutor){
  return (await db.query<{period:string;renews_at:string}>(`SELECT to_char(date_trunc('month',transaction_timestamp() AT TIME ZONE 'UTC'),'YYYY-MM-DD') period,to_char(date_trunc('month',transaction_timestamp() AT TIME ZONE 'UTC')+interval '1 month','YYYY-MM-DD"T"HH24:MI:SS"Z"') renews_at`))[0];
}
/** Called only after the account lock by mutations; reads never grant credits. */
export async function ensureStudioMonthlyCredits(tx:TransactionQueryExecutor,userId:string){
  const month=await period(tx);
  await tx.query(`INSERT INTO studio_assistance_credit_lots(id,user_id,kind,period,total_credits) VALUES($1,$2,'included',$3,$4) ON CONFLICT(user_id,period) WHERE kind='included' DO NOTHING`,[randomUUID(),userId,month.period,STUDIO_SOL_MONTHLY_CREDITS]);
}
export async function readStudioCreditBalance(db:QueryExecutor,userId:string):Promise<StudioCreditBalance>{
  const month=await period(db);
  const lots=await db.query<Lot>(`SELECT *,to_char(period,'YYYY-MM-DD') period FROM studio_assistance_credit_lots WHERE user_id=$1 AND (kind='purchased' OR period=$2::date OR (period<$2::date AND reserved_credits>0)) ORDER BY purchase_order`,[userId,month.period]);
  const included=lots.find(lot=>lot.kind==='included'&&lot.period===month.period);
  const priorReserved=lots.filter(lot=>lot.kind==='included'&&lot.period!==month.period).reduce((sum,lot)=>sum+Number(lot.reserved_credits),0);
  const packs=lots.filter(lot=>lot.kind==='purchased').map(lot=>({...quantity(lot),id:lot.id,amountCents:lot.amount_cents,purchasedAt:lot.created_at.toISOString()}));
  return {creditsPerDollar:STUDIO_SOL_CREDITS_PER_DOLLAR,included:{...(included?quantity(included):{total:STUDIO_SOL_MONTHLY_CREDITS,remaining:STUDIO_SOL_MONTHLY_CREDITS,reserved:0}),period:month.period,renewsAt:month.renews_at,priorReserved},purchased:{total:packs.reduce((sum,p)=>sum+p.total,0),remaining:packs.reduce((sum,p)=>sum+p.remaining,0),reserved:packs.reduce((sum,p)=>sum+p.reserved,0),packs}};
}
/** Replay check precedes revision validation, so a lost acknowledgement cannot charge twice. */
export async function existingStudioCreditPurchase(tx:TransactionQueryExecutor,userId:string,choice:{purchaseKey:string;amountCents:number;tariffVersion:string}){
  const prior=(await tx.query<{amount_cents:number;tariff_version:string}>('SELECT amount_cents,tariff_version FROM studio_assistance_credit_lots WHERE user_id=$1 AND purchase_key=$2',[userId,choice.purchaseKey]))[0];
  if(prior&&(prior.amount_cents!==choice.amountCents||prior.tariff_version!==choice.tariffVersion))throw new AgentApiError('PARAMETER_INVALID','This purchase identity already belongs to a different pack.');
  return !!prior;
}
export async function purchaseStudioCreditPack(tx:TransactionQueryExecutor,userId:string,choice:{purchaseKey:string;amountCents:number;tariffVersion:string}){
  const id=randomUUID();
  const debit=await reserveWalletChargeInExecutor(tx,{userId,amountCents:choice.amountCents,currency:'USD',description:'GPT-6.1 Sol credit pack',jobId:'studio-sol-pack:'+id,surface:'tool',billingProductKey:'studio_assistance_pack',pricingSnapshotJson:JSON.stringify({tariff:STUDIO_ASSISTANCE_CREDIT_TARIFF,credits:choice.amountCents*creditsPerCent,creditsPerDollar:STUDIO_SOL_CREDITS_PER_DOLLAR,purchaseKey:choice.purchaseKey}),applicationFeeCents:null,vendorAccountId:null},{preferredCurrency:null});
  if(!debit.ok)throw new AgentApiError('INSUFFICIENT_FUNDS','Your MaxVideoAI balance cannot fund this Sol pack. Top up your balance before purchasing.');
  await tx.query(`INSERT INTO studio_assistance_credit_lots(id,user_id,kind,total_credits,amount_cents,purchase_key,tariff_version,receipt_id) VALUES($1,$2,'purchased',$3,$4,$5,$6,$7)`,[id,userId,choice.amountCents*creditsPerCent,choice.amountCents,choice.purchaseKey,choice.tariffVersion,debit.receiptId]);
}
export type CreditReservation={allocations:Array<{lotId:string;credits:number}>;quotedCents:number;sponsoredNanoUsd:number};
/** Account lock serializes plans. A plan is persisted together with the call checkpoint. */
export async function planStudioCreditReservation(tx:TransactionQueryExecutor,userId:string,quotedCents:number,supplierNanoUsd:number,paidEnabled:boolean,priorSponsored=false):Promise<CreditReservation|null>{
  const month=await period(tx);
  const lots=await tx.query<Lot>(`SELECT * FROM studio_assistance_credit_lots WHERE user_id=$1 AND ((kind='included' AND period=$2::date) OR (kind='purchased' AND $3)) ORDER BY CASE WHEN kind='included' THEN 0 ELSE 1 END,purchase_order`,[userId,month.period,paidEnabled]);
  let remaining=quotedCents*creditsPerCent,free=0;
  const allocations:CreditReservation['allocations']=[];
  for(const lot of lots){const used=Math.min(remaining,quantity(lot).remaining);if(used){allocations.push({lotId:lot.id,credits:used});if(lot.kind==='included')free+=used;remaining-=used;}if(!remaining)break;}
  return remaining?null:{allocations,quotedCents,sponsoredNanoUsd:free>0||priorSponsored?supplierNanoUsd:0};
}
export async function reserveStudioCredits(tx:TransactionQueryExecutor,callId:string,plan:CreditReservation,consumer:StudioCreditConsumer='chat'){
  const {funding,allocations}=creditTables(consumer);
  if(consumer==='analysis')await tx.query(`INSERT INTO ${funding}(call_id,quoted_cents,reserved_sponsored_nano_usd,campaign_id) VALUES($1,$2,$3,$4)`,[callId,plan.quotedCents,plan.sponsoredNanoUsd,STUDIO_ASSISTANCE_CAMPAIGN_ID]);
  else await tx.query(`INSERT INTO ${funding}(call_id,quoted_cents,reserved_sponsored_nano_usd) VALUES($1,$2,$3)`,[callId,plan.quotedCents,plan.sponsoredNanoUsd]);
  for(const allocation of plan.allocations){
    await tx.query('UPDATE studio_assistance_credit_lots SET reserved_credits=reserved_credits+$2 WHERE id=$1',[allocation.lotId,allocation.credits]);
    await tx.query(`INSERT INTO ${allocations}(call_id,lot_id,reserved_credits) VALUES($1,$2,$3)`,[callId,allocation.lotId,allocation.credits]);
  }
}
/** Free allocation first; unused holds return to the same lots, including expired free months. */
export async function settleStudioCredits(tx:TransactionQueryExecutor,callId:string,quotedCents:number,supplierNanoUsd:number,consumer:StudioCreditConsumer='chat'){
  const {funding,allocations}=creditTables(consumer);
  const rows=await tx.query<{lot_id:string;kind:string;reserved_credits:string;charged_credits:string|null;released_at:Date|null}>(`SELECT a.*,l.kind FROM ${allocations} a JOIN studio_assistance_credit_lots l ON l.id=a.lot_id WHERE a.call_id=$1 ORDER BY CASE WHEN l.kind='included' THEN 0 ELSE 1 END,l.purchase_order`,[callId]);
  let remaining=quotedCents*creditsPerCent,paid=0;
  for(const row of rows){
    if(row.released_at)continue;
    if(row.charged_credits!==null)throw new AgentApiError('INTERNAL_ERROR','Credit usage already settled outside its call.');
    const charged=Math.min(remaining,Number(row.reserved_credits));remaining-=charged;
    if(row.kind==='purchased')paid+=charged;
    await tx.query('UPDATE studio_assistance_credit_lots SET reserved_credits=reserved_credits-$2,consumed_credits=consumed_credits+$3 WHERE id=$1',[row.lot_id,Number(row.reserved_credits),charged]);
    await tx.query(`UPDATE ${allocations} SET charged_credits=$3 WHERE call_id=$1 AND lot_id=$2`,[callId,row.lot_id,charged]);
  }
  if(remaining)throw new AgentApiError('INTERNAL_ERROR','Credit settlement exceeds its reservation.');
  await tx.query(`UPDATE ${funding} SET charged_sponsored_nano_usd=CASE WHEN reserved_sponsored_nano_usd>0 THEN $2 ELSE 0 END,charged_cents=$3 WHERE call_id=$1`,[callId,supplierNanoUsd,quotedCents]);
  return {paidCents:paid/creditsPerCent};
}
/** A customer waiver releases credits, while unknown supplier exposure stays reserved. */
export async function releaseStudioCredits(tx:TransactionQueryExecutor,callId:string,consumer:StudioCreditConsumer='chat'){
  const {allocations}=creditTables(consumer);
  const rows=await tx.query<{lot_id:string;reserved_credits:string}>(`SELECT lot_id,reserved_credits FROM ${allocations} WHERE call_id=$1 AND charged_credits IS NULL AND released_at IS NULL`,[callId]);
  for(const row of rows){await tx.query('UPDATE studio_assistance_credit_lots SET reserved_credits=reserved_credits-$2 WHERE id=$1',[row.lot_id,Number(row.reserved_credits)]);await tx.query(`UPDATE ${allocations} SET released_at=clock_timestamp() WHERE call_id=$1 AND lot_id=$2`,[callId,row.lot_id]);}
}
