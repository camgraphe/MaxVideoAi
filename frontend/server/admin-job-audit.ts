import { query } from '@/lib/db';
import { normalizeMediaUrl } from '@/lib/media';

type RawJobAuditRow = {
  job_id: string;
  user_id: string | null;
  created_at: string;
  status: string | null;
  progress: number | null;
  message: string | null;
  payment_status: string | null;
  final_price_cents: number | string | null;
  currency: string | null;
  video_url: string | null;
  thumb_url: string | null;
  engine_label: string | null;
  duration_sec: number | null;
  provider_job_id: string | null;
  total_charge_cents: number | string | null;
  total_refund_cents: number | string | null;
  charge_count: number | null;
  refund_count: number | null;
  receipts: Array<{
    id: number;
    type: string;
    amountCents: number;
    currency: string;
    createdAt: string;
  }> | null;
  fal_status: string | null;
  fal_created_at: string | null;
};

export type AdminJobAuditRecord = {
  jobId: string;
  userId: string | null;
  createdAt: string;
  status: string | null;
  progress: number | null;
  message: string | null;
  paymentStatus: string | null;
  finalPriceCents: number;
  currency: string;
  videoUrl: string | null;
  thumbUrl: string | null;
  engineLabel: string | null;
  durationSec: number | null;
  providerJobId: string | null;
  totalChargeCents: number;
  totalRefundCents: number;
  chargeCount: number;
  refundCount: number;
  receipts: Array<{
    id: number;
    type: 'topup' | 'charge' | 'refund' | 'discount' | 'tax';
    amountCents: number;
    currency: string;
    createdAt: string;
  }>;
  falStatus: string | null;
  falUpdatedAt: string | null;
  hasVideo: boolean;
  isPlaceholderVideo: boolean;
  netChargeCents: number;
  paymentOk: boolean;
  falOk: boolean;
};

function coerceNumber(value: number | string | null | undefined): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function normalizeCurrency(value: string | null | undefined): string {
  return (value ?? 'USD').toUpperCase();
}

function normalizeReceipts(
  raw: RawJobAuditRow['receipts']
): AdminJobAuditRecord['receipts'] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => ({
    id: entry.id,
    type: entry.type as AdminJobAuditRecord['receipts'][number]['type'],
    amountCents: entry.amountCents,
    currency: normalizeCurrency(entry.currency),
    createdAt: entry.createdAt,
  }));
}

function isPlaceholderAsset(url: string | null | undefined): boolean {
  if (!url) return false;
  const normalized = url.toLowerCase();
  return (
    normalized.includes('/assets/gallery/') ||
    normalized.includes('/assets/frames/') ||
    normalized.endsWith('.svg') ||
    normalized.endsWith('.jpg') ||
    normalized.endsWith('.jpeg') ||
    normalized.endsWith('.png')
  );
}

export async function fetchRecentJobAudits(limit = 30): Promise<AdminJobAuditRecord[]> {
  if (!process.env.DATABASE_URL) return [];

  const normalizedLimit = Math.min(200, Math.max(1, limit));

  const rows = await query<RawJobAuditRow>(
    `
      WITH recent_jobs AS (
        SELECT *
        FROM app_jobs
        ORDER BY created_at DESC
        LIMIT $1
      )
      SELECT
        j.job_id,
        j.user_id,
        j.created_at,
        j.status,
        j.progress,
        j.message,
        j.payment_status,
        j.final_price_cents,
        j.currency,
        j.video_url,
        j.thumb_url,
        j.engine_label,
        j.duration_sec,
        j.provider_job_id,
        COALESCE(charges.total_charge_cents, 0) AS total_charge_cents,
        COALESCE(refunds.total_refund_cents, 0) AS total_refund_cents,
        COALESCE(charges.charge_count, 0) AS charge_count,
        COALESCE(refunds.refund_count, 0) AS refund_count,
        receipts.receipts,
        fal.status AS fal_status,
        fal.created_at AS fal_created_at
      FROM recent_jobs j
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
      ORDER BY j.created_at DESC
    `,
    [normalizedLimit]
  );

  return rows.map((row) => {
    const finalPrice = coerceNumber(row.final_price_cents);
    const totalCharge = coerceNumber(row.total_charge_cents);
    const totalRefund = coerceNumber(row.total_refund_cents);
    const netCharge = totalCharge - totalRefund;
    const currency = normalizeCurrency(row.currency);
    const paymentStatus = row.payment_status ?? '';

    const paymentOk =
      paymentStatus.includes('refunded') ? netCharge <= 0 : finalPrice === netCharge;

    const falStatus = row.fal_status;
    const falOk = !falStatus || falStatus.toUpperCase() === 'COMPLETED';

    const videoUrl = row.video_url ? normalizeMediaUrl(row.video_url) ?? row.video_url : null;
    const thumbUrl = row.thumb_url ? normalizeMediaUrl(row.thumb_url) ?? row.thumb_url : null;
    const placeholderVideo = isPlaceholderAsset(videoUrl);
    const displayOk = Boolean(videoUrl) && !placeholderVideo;

    return {
      jobId: row.job_id,
      userId: row.user_id,
      createdAt: row.created_at,
      status: row.status,
      progress: row.progress,
      message: row.message,
      paymentStatus: row.payment_status,
      finalPriceCents: finalPrice,
      currency,
      videoUrl,
      thumbUrl,
      engineLabel: row.engine_label,
      durationSec: row.duration_sec,
      providerJobId: row.provider_job_id,
      totalChargeCents: totalCharge,
      totalRefundCents: totalRefund,
      chargeCount: row.charge_count ?? 0,
      refundCount: row.refund_count ?? 0,
      receipts: normalizeReceipts(row.receipts),
      falStatus,
      falUpdatedAt: row.fal_created_at,
      hasVideo: displayOk,
      isPlaceholderVideo: placeholderVideo,
      netChargeCents: netCharge,
      paymentOk,
      falOk,
    };
  });
}
