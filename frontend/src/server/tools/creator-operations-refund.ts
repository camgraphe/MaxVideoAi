import type { TransactionQueryExecutor } from '@/lib/db';
import { stableJson } from '@/server/agent-api/generation-normalization';

/** Refund the exact original wallet receipt when the separately owned tool result is unusable.
 * Raw generation status, provider cost, output and pricing evidence remain intact.
 * Caller holds the operation lease row lock and settles its failure in the same transaction.
 */
export async function refundCreatorFinalization(tx:TransactionQueryExecutor,userId:string,operationId:string):Promise<void> {
  const [job]=await tx.query<{job_id:string;user_id:string;status:string;payment_status:string;surface:string;final_price_cents:number;currency:string;billing_product_key:string|null;pricing_snapshot:unknown}>(`SELECT j.job_id,j.user_id,j.status,j.payment_status,j.surface,j.final_price_cents,j.currency,j.billing_product_key,j.pricing_snapshot
    FROM app_jobs j JOIN mcp_generation_quotes q ON q.job_id=j.job_id JOIN creator_operations o ON o.id=q.quote_id
    WHERE o.id=$1 AND o.user_id=$2 AND j.user_id=$2 AND q.user_id=$2 FOR UPDATE OF j`,[operationId,userId]);
  if(!job||job.status!=='completed'||!['image','video'].includes(job.surface)||!['paid_wallet','refunded_wallet'].includes(job.payment_status)) throw new Error('Tool refund job state is inconsistent.');
  type Receipt={id:string;user_id:string;amount_cents:number;currency:string;surface:string;billing_product_key:string|null;pricing_snapshot:unknown};
  const charges=await tx.query<Receipt>(`SELECT id,user_id,amount_cents,currency,surface,billing_product_key,pricing_snapshot FROM app_receipts WHERE job_id=$1 AND type='charge' ORDER BY id LIMIT 2 FOR UPDATE`,[job.job_id]);
  const charge=charges[0];
  if(charges.length!==1||charge.user_id!==userId||!Number.isSafeInteger(Number(charge.amount_cents))||Number(charge.amount_cents)<=0||Number(charge.amount_cents)!==Number(job.final_price_cents)||charge.currency!==job.currency||charge.surface!==job.surface||charge.billing_product_key!==job.billing_product_key||stableJson(charge.pricing_snapshot)!==stableJson(job.pricing_snapshot)) throw new Error('Tool charge reconciliation is inconsistent.');
  await tx.query(`INSERT INTO app_receipts(user_id,type,amount_cents,currency,description,job_id,surface,billing_product_key,pricing_snapshot,application_fee_cents,vendor_account_id,platform_revenue_cents,destination_acct,metadata)
    SELECT user_id,'refund',amount_cents,currency,'Refund unusable creator tool result',job_id,surface,billing_product_key,pricing_snapshot,0,vendor_account_id,0,vendor_account_id,
      jsonb_build_object('reason','creator_finalization_failure','operationId',$2::text,'original_receipt_id',id)
    FROM app_receipts WHERE id=$1 AND type='charge' ON CONFLICT DO NOTHING`,[charge.id,operationId]);
  const refunds=await tx.query<Receipt>(`SELECT id,user_id,amount_cents,currency,surface,billing_product_key,pricing_snapshot FROM app_receipts WHERE job_id=$1 AND type='refund' LIMIT 2 FOR UPDATE`,[job.job_id]);
  const refund=refunds[0];
  if(refunds.length!==1||refund.user_id!==userId||Number(refund.amount_cents)!==Number(charge.amount_cents)||refund.currency!==charge.currency||refund.surface!==charge.surface||refund.billing_product_key!==charge.billing_product_key||stableJson(refund.pricing_snapshot)!==stableJson(charge.pricing_snapshot)) throw new Error('Tool refund receipt is inconsistent.');
  await tx.query("UPDATE app_jobs SET payment_status='refunded_wallet',updated_at=now() WHERE job_id=$1 AND user_id=$2",[job.job_id,userId]);
}
