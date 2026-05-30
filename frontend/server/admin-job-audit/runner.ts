import { query } from '@/lib/db';
import { formatCursorValue } from './cursor';
import { mapJobAuditRow } from './mapper';
import { buildJobAuditWhereClause } from './query-builder';
import type { FetchJobAuditParams, FetchJobAuditResult, RawJobAuditRow } from './types';

export async function fetchRecentJobAudits({
  limit = 30,
  cursor = null,
  jobId = null,
  userId = null,
  engineId = null,
  status = null,
  outcome = null,
  from = null,
  to = null,
}: FetchJobAuditParams = {}): Promise<FetchJobAuditResult> {
  if (!process.env.DATABASE_URL) return { jobs: [], nextCursor: null };

  const normalizedLimit = Math.min(200, Math.max(1, limit));
  const { whereClause, params } = buildJobAuditWhereClause({
    cursor,
    jobId,
    userId,
    engineId,
    status,
    outcome,
    from,
    to,
  });

  params.push(normalizedLimit + 1);
  const limitIndex = params.length;

  const rows = await query<RawJobAuditRow>(
    `
      SELECT
        j.id,
        j.job_id,
        j.updated_at,
        COALESCE(j.hidden, FALSE) AS hidden,
        j.user_id,
        j.created_at,
        j.status,
        j.progress,
        j.message,
        j.payment_status,
        j.final_price_cents,
        j.currency,
        j.surface,
        j.video_url,
        j.thumb_url,
        j.hero_render_id,
        COALESCE(jsonb_array_length(j.render_ids), 0) AS render_count,
        j.engine_label,
        j.duration_sec,
        j.provider_job_id,
        COALESCE(charges.total_charge_cents, 0) AS total_charge_cents,
        COALESCE(refunds.total_refund_cents, 0) AS total_refund_cents,
        COALESCE(charges.charge_count, 0) AS charge_count,
        COALESCE(refunds.refund_count, 0) AS refund_count,
        receipts.receipts,
        fal.status AS fal_status,
        fal.created_at AS fal_created_at,
        fal_failure.status AS fal_failure_status,
        fal_failure.created_at AS fal_failure_created_at,
        fal_failure.payload AS fal_failure_payload,
        COALESCE(fal_counts.log_count, 0) AS fal_log_count,
        latest_refund.created_at AS latest_refund_created_at,
        latest_refund.metadata AS latest_refund_metadata,
        fal_events.fal_events
      FROM app_jobs j
      LEFT JOIN LATERAL (
        SELECT
          SUM(amount_cents)::bigint AS total_charge_cents,
          COUNT(*)::integer AS charge_count
        FROM app_receipts r
        WHERE r.job_id = j.job_id AND r.type = 'charge'
      ) charges ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          SUM(amount_cents)::bigint AS total_refund_cents,
          COUNT(*)::integer AS refund_count
        FROM app_receipts r
        WHERE r.job_id = j.job_id AND r.type = 'refund'
      ) refunds ON TRUE
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(
                 jsonb_build_object(
                   'id', r.id,
                   'type', r.type,
                   'amountCents', r.amount_cents,
                   'currency', r.currency,
                   'createdAt', r.created_at
                 ) ORDER BY r.created_at DESC
               ) AS receipts
        FROM app_receipts r
        WHERE r.job_id = j.job_id
      ) receipts ON TRUE
      LEFT JOIN LATERAL (
        SELECT status, created_at
        FROM fal_queue_log f
        WHERE f.job_id = j.job_id
        ORDER BY created_at DESC
        LIMIT 1
      ) fal ON TRUE
      LEFT JOIN LATERAL (
        SELECT status, created_at, payload
        FROM fal_queue_log f
        WHERE f.job_id = j.job_id
          AND (
            LOWER(f.status) IN ('failed', 'error', 'errored', 'canceled', 'cancelled', 'aborted')
            OR f.status = 'poll:failed'
            OR f.status = 'manual:no-media'
            OR COALESCE(f.payload ->> 'appStatus', '') ILIKE 'failed'
            OR COALESCE(f.payload ->> 'falStatus', '') ~* '(failed|error|cancel|abort)'
          )
        ORDER BY created_at DESC
        LIMIT 1
      ) fal_failure ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::integer AS log_count
        FROM fal_queue_log f
        WHERE f.job_id = j.job_id
      ) fal_counts ON TRUE
      LEFT JOIN LATERAL (
        SELECT created_at, metadata
        FROM app_receipts r
        WHERE r.job_id = j.job_id
          AND r.type = 'refund'
        ORDER BY created_at DESC
        LIMIT 1
      ) latest_refund ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          jsonb_agg(
            jsonb_build_object(
              'createdAt', recent.created_at,
              'status', recent.status,
              'summary', COALESCE(recent.payload ->> 'message', recent.payload ->> 'reason', recent.payload ->> 'note'),
              'origin', COALESCE(recent.payload ->> 'failure_origin', recent.payload ->> 'failureOrigin')
            )
            ORDER BY recent.created_at DESC
          ) AS fal_events
        FROM (
          SELECT created_at, status, payload
          FROM fal_queue_log f
          WHERE f.job_id = j.job_id
          ORDER BY created_at DESC
          LIMIT 6
        ) recent
      ) fal_events ON TRUE
      ${whereClause}
      ORDER BY j.created_at DESC, j.id DESC
      LIMIT $${limitIndex}
    `,
    params
  );

  const hasMore = rows.length > normalizedLimit;
  const items = hasMore ? rows.slice(0, -1) : rows;
  const nextCursor = hasMore && items.length ? formatCursorValue(items[items.length - 1]) : null;
  const jobs = items.map((row) => mapJobAuditRow(row));

  return { jobs, nextCursor };
}
