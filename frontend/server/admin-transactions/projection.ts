import { receiptPurchaseProjection, receiptRouteJoin } from './video-purchase';
import { query } from '@/lib/db';

export async function transactionSelectForCurrentSchema(receiptDetail = false) {
  const [schema] = await query<{ available: boolean; has_origin: boolean; has_platform: boolean; has_jobs: boolean; has_attempts: boolean }>(
    `SELECT to_regclass('public.mcp_generation_quotes') IS NOT NULL AS available,
       EXISTS (SELECT FROM pg_attribute WHERE attrelid=to_regclass('public.mcp_generation_quotes')
         AND attname='auth_origin' AND NOT attisdropped) AS has_origin,
       EXISTS (SELECT FROM pg_attribute WHERE attrelid=to_regclass('public.mcp_generation_quotes')
         AND attname='confirmation_platform' AND NOT attisdropped) AS has_platform
       ${receiptDetail ? `, (SELECT count(*)=9 FROM pg_attribute WHERE attrelid=to_regclass('public.app_jobs')
           AND NOT attisdropped AND attname IN ('id','user_id','surface','engine_id','final_price_cents','currency','provider','provider_job_id','cost_breakdown_usd')) AS has_jobs,
          to_regclass('public.provider_attempts') IS NOT NULL AS has_attempts` : ''}`,
  );
  const origin = schema?.has_origin ? "COALESCE(quote.auth_origin, 'oauth')" : "'oauth'::text";
  const platform = schema?.has_platform ? 'quote.confirmation_platform' : 'NULL::text';
  return `SELECT
       r.id AS receipt_id,
       ${receiptDetail ? (schema?.has_jobs ? receiptPurchaseProjection(schema.has_attempts) : 'NULL::jsonb') + ' AS job_purchase,' : ''}
       r.user_id,
       r.type,
       r.amount_cents,
       r.currency,
       r.description,
       CASE WHEN r.type = 'refund' THEN r.metadata ->> 'reason' END AS refund_reason_code,
       CASE WHEN r.type = 'refund' THEN r.metadata ->> 'note' END AS refund_note,
       to_jsonb(r) ->> 'billing_product_key' AS billing_product_key,
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
       COALESCE(provenance.mcp, FALSE) AS is_mcp_generation,
       COALESCE(provenance.studio, FALSE) AS is_studio_generation,
       COALESCE(provenance.mobile_create, FALSE) AS is_create_generation,
       provenance.platform AS confirmation_platform,
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
     ${receiptDetail && schema?.has_jobs && schema.has_attempts ? receiptRouteJoin : ''}
     ${schema?.available ? `LEFT JOIN LATERAL (
       SELECT bool_or(${origin} = 'oauth') AS mcp, bool_or(${origin} = 'studio-session') AS studio,
         bool_or(${origin} = 'mobile-session') AS mobile_create,
         CASE WHEN COUNT(*) = 1 AND r.type IN ('charge','refund')
           THEN MIN(CASE WHEN ${origin} IN ('studio-session','mobile-session') THEN ${platform} END)
         END AS platform
       FROM mcp_generation_quotes quote WHERE quote.job_id = r.job_id AND quote.user_id = r.user_id::text
     ) provenance ON TRUE` : `LEFT JOIN (SELECT FALSE AS mcp, FALSE AS studio, FALSE AS mobile_create, NULL::text AS platform)
       provenance ON TRUE`}
`;
}
