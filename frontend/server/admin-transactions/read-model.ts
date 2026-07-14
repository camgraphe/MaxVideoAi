import { query } from '@/lib/db';
import { normalizeMediaUrl } from '@/lib/media';
import { ensureBillingSchema } from '@/lib/schema';
import { getUserIdentity } from '@/server/supabase-admin';
import { coerceNumber, isRefundablePaymentStatus, normalizeCurrency } from './normalizers';
import type { AdminTransactionRecord, RawTransactionRow, TransactionAnomalies } from './types';

const LARGE_REFUND_THRESHOLD_CENTS = 50_000;
const FREQUENT_REFUND_WINDOW_DAYS = 30;
const FREQUENT_REFUND_MIN_COUNT = 3;

export function normalizeTransactionLimit(limit: number): number {
  return Math.min(500, Math.max(1, limit));
}

export function mapAdminTransactionRow(
  row: RawTransactionRow,
  userEmail: string | null
): AdminTransactionRecord {
  const type = row.type as AdminTransactionRecord['type'];
  const jobExists = Boolean(
    row.job_status ||
      row.job_payment_status ||
      row.job_engine_label ||
      row.job_video_url ||
      row.job_thumb_url
  );
  const isLatestCharge =
    type === 'charge' &&
    (row.job_id ? (jobExists ? row.latest_charge_id === row.receipt_id : true) : true);
  const refundableStatus = row.job_id
    ? jobExists
      ? isRefundablePaymentStatus(row.job_payment_status)
      : true
    : true;

  return {
    receiptId: row.receipt_id,
    userId: row.user_id,
    userEmail,
    type,
    amountCents: coerceNumber(row.amount_cents),
    currency: normalizeCurrency(row.currency),
    description: row.description,
    jobId: row.job_id,
    jobStatus: row.job_status,
    jobPaymentStatus: row.job_payment_status,
    jobEngineLabel: row.job_engine_label,
    jobVideoUrl: row.job_video_url ? normalizeMediaUrl(row.job_video_url) ?? row.job_video_url : null,
    jobDurationSec: row.job_duration_sec ?? null,
    jobCreatedAt: row.job_created_at,
    jobProgress: row.job_progress ?? null,
    jobMessage: row.job_message,
    createdAt: row.created_at,
    hasRefund: row.has_refund,
    latestChargeId: row.latest_charge_id,
    isLatestCharge,
    canRefund:
      type === 'charge' &&
      !row.has_refund &&
      Boolean(row.user_id) &&
      isLatestCharge &&
      refundableStatus,
  };
}

export async function fetchAdminTransactions(limit = 100): Promise<AdminTransactionRecord[]> {
  if (!process.env.DATABASE_URL) return [];

  await ensureBillingSchema();
  const rows = await query<RawTransactionRow>(
    `SELECT
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
       EXISTS (
         SELECT 1
         FROM app_receipts r2
         WHERE r2.type = 'refund'
           AND (
             (r.job_id IS NOT NULL AND r2.job_id = r.job_id)
             OR ((r2.metadata ->> 'original_receipt_id')::bigint = r.id)
           )
       ) AS has_refund,
       (
         SELECT id
         FROM app_receipts r3
         WHERE r3.job_id = r.job_id
           AND r3.type = 'charge'
         ORDER BY r3.created_at DESC
         LIMIT 1
       ) AS latest_charge_id
     FROM app_receipts r
     LEFT JOIN app_jobs j ON j.job_id = r.job_id
     ORDER BY r.created_at DESC
     LIMIT $1`,
    [normalizeTransactionLimit(limit)]
  );

  const uniqueUserIds = Array.from(
    new Set(rows.map((row) => row.user_id).filter((value): value is string => Boolean(value)))
  );
  const userEmailMap = new Map<string, string | null>();
  if (uniqueUserIds.length && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    await Promise.all(
      uniqueUserIds.map(async (userId) => {
        const identity = await getUserIdentity(userId);
        userEmailMap.set(userId, identity?.email ?? null);
      })
    );
  }

  return rows.map((row) =>
    mapAdminTransactionRow(row, row.user_id ? userEmailMap.get(row.user_id) ?? null : null)
  );
}

export async function fetchTransactionAnomalies(): Promise<TransactionAnomalies> {
  if (!process.env.DATABASE_URL) {
    return { largeRefunds: [], frequentRefundUsers: [], invalidCharges: [] };
  }

  await ensureBillingSchema();
  const [largeRefundRows, frequentRefundRows, invalidChargeRows] = await Promise.all([
    query<{
      id: number;
      user_id: string | null;
      job_id: string | null;
      amount_cents: number | string | null;
      currency: string | null;
      description: string | null;
      created_at: string;
    }>(
      `SELECT id, user_id, job_id, amount_cents, currency, description, created_at
       FROM app_receipts
       WHERE type = 'refund'
         AND amount_cents >= $1
       ORDER BY amount_cents DESC
       LIMIT 10`,
      [LARGE_REFUND_THRESHOLD_CENTS]
    ),
    query<{
      user_id: string | null;
      refund_count: number | string | null;
      total_cents: number | string | null;
      last_refund_at: string | null;
    }>(
      `SELECT
         user_id,
         COUNT(*)::bigint AS refund_count,
         COALESCE(SUM(amount_cents), 0)::bigint AS total_cents,
         MAX(created_at) AS last_refund_at
       FROM app_receipts
       WHERE type = 'refund'
         AND created_at >= NOW() - INTERVAL '${FREQUENT_REFUND_WINDOW_DAYS} days'
       GROUP BY user_id
       HAVING COUNT(*) >= $1
       ORDER BY refund_count DESC, total_cents DESC
       LIMIT 10`,
      [FREQUENT_REFUND_MIN_COUNT]
    ),
    query<{
      id: number;
      user_id: string | null;
      job_id: string | null;
      amount_cents: number | string | null;
      created_at: string;
      description: string | null;
    }>(
      `SELECT id, user_id, job_id, amount_cents, created_at, description
       FROM app_receipts
       WHERE type = 'charge'
         AND amount_cents <= 0
       ORDER BY created_at DESC
       LIMIT 10`
    ),
  ]);

  return {
    largeRefunds: largeRefundRows.map((row) => ({
      receiptId: row.id,
      userId: row.user_id,
      amountCents: coerceNumber(row.amount_cents),
      currency: normalizeCurrency(row.currency),
      jobId: row.job_id,
      createdAt: row.created_at,
      description: row.description,
    })),
    frequentRefundUsers: frequentRefundRows.map((row) => ({
      userId: row.user_id,
      refundCount: coerceNumber(row.refund_count),
      totalCents: coerceNumber(row.total_cents),
      lastRefundAt: row.last_refund_at,
    })),
    invalidCharges: invalidChargeRows.map((row) => ({
      receiptId: row.id,
      userId: row.user_id,
      amountCents: coerceNumber(row.amount_cents),
      jobId: row.job_id,
      createdAt: row.created_at,
      description: row.description,
    })),
  };
}
