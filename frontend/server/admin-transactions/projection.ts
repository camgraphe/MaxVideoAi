import { query } from '@/lib/db';

export async function transactionSelectForCurrentSchema() {
  const [relation] = await query<{ available: boolean }>(
    "SELECT to_regclass('public.mcp_generation_quotes') IS NOT NULL AS available",
  );
  return buildTransactionSelect(Boolean(relation?.available));
}

function buildTransactionSelect(mcpQuotesAvailable: boolean) {
  return `SELECT
       r.id AS receipt_id,
       r.user_id,
       r.type,
       r.amount_cents,
       r.currency,
       r.description,
       r.job_id,
       r.created_at,
       j.status AS job_status,
       j.payment_status AS job_payment_status,
       j.engine_label AS job_engine_label,
       j.video_url AS job_video_url,
       j.thumb_url AS job_thumb_url,
       j.message AS job_message,
       j.progress AS job_progress,
       j.created_at AS job_created_at,
       j.duration_sec AS job_duration_sec,
       ${mcpQuotesAvailable ? `EXISTS (
         SELECT 1 FROM mcp_generation_quotes quote
         WHERE quote.job_id = r.job_id
           AND quote.user_id = r.user_id::text
       )` : 'FALSE'} AS is_mcp_generation,
       EXISTS (
         SELECT 1
         FROM app_receipts r2
         WHERE r2.type = 'refund'
           AND (
             (r.job_id IS NOT NULL AND r2.job_id = r.job_id)
             OR ((r2.metadata ->> 'original_receipt_id') = r.id::text)
           )
       ) AS has_refund,
       (
         SELECT id
         FROM app_receipts r3
         WHERE r3.job_id = r.job_id
           AND r3.type = 'charge'
         ORDER BY r3.created_at DESC, r3.id DESC
         LIMIT 1
       ) AS latest_charge_id
     FROM app_receipts r
     LEFT JOIN app_jobs j ON j.job_id = r.job_id
`;
}
