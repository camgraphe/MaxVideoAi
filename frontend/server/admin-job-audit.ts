import { query } from '@/lib/db';
import { normalizeMediaUrl, isPlaceholderMediaUrl } from '@/lib/media';

type RawJobAuditRow = {
  id: number;
  job_id: string;
  user_id: string | null;
  created_at: string;
  updated_at: string;
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
  id: number;
  jobId: string;
  userId: string | null;
  createdAt: string;
  updatedAt: string;
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
  archived: boolean;
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

const ARCHIVE_THRESHOLD_MS = 30 * 60 * 1000;

function parseCursorParam(value: string | null): { createdAt: Date | null; id: number | null } {
  if (!value) {
    return { createdAt: null, id: null };
  }
  if (value.includes('|')) {
    const [timestampPart, idPart] = value.split('|', 2);
    let createdAt: Date | null = null;
    if (timestampPart) {
      const parsed = new Date(timestampPart);
      if (!Number.isNaN(parsed.getTime())) {
        createdAt = parsed;
      }
    }
    let id: number | null = null;
    if (idPart) {
      const parsed = Number.parseInt(idPart, 10);
      if (Number.isFinite(parsed)) {
        id = parsed;
      }
    }
    return { createdAt, id };
  }
  const parsed = Number.parseInt(value, 10);
  if (Number.isFinite(parsed)) {
    return { createdAt: null, id: parsed };
  }
  return { createdAt: null, id: null };
}

function formatCursorValue(row: { created_at: string; id: number }): string {
  const createdAt = new Date(row.created_at);
  if (Number.isNaN(createdAt.getTime())) {
    return String(row.id);
  }
  return `${createdAt.toISOString()}|${row.id}`;
}

type FetchJobAuditFilters = {
  jobId?: string | null;
  userId?: string | null;
  engineId?: string | null;
  status?: string | null;
  from?: Date | null;
  to?: Date | null;
};

type FetchJobAuditParams = FetchJobAuditFilters & {
  limit?: number;
  cursor?: string | null;
};

type FetchJobAuditResult = {
  jobs: AdminJobAuditRecord[];
  nextCursor: string | null;
};

export async function fetchRecentJobAudits({
  limit = 30,
  cursor = null,
  jobId = null,
  userId = null,
  engineId = null,
  status = null,
  from = null,
  to = null,
}: FetchJobAuditParams = {}): Promise<FetchJobAuditResult> {
  if (!process.env.DATABASE_URL) return { jobs: [], nextCursor: null };

  const normalizedLimit = Math.min(200, Math.max(1, limit));

  const cursorInfo = parseCursorParam(cursor);
  const params: Array<string | number | Date> = [];
  const conditions: string[] = [];

  if (jobId && jobId.trim().length) {
    params.push(`%${jobId.trim()}%`);
    const index = params.length;
    conditions.push(`j.job_id ILIKE $${index}`);
  }

  if (userId && userId.trim().length) {
    params.push(`%${userId.trim()}%`);
    const index = params.length;
    conditions.push(`j.user_id::text ILIKE $${index}`);
  }

  if (engineId && engineId.trim().length) {
    params.push(`%${engineId.trim()}%`);
    const index = params.length;
    conditions.push(`(j.engine_id ILIKE $${index} OR j.engine_label ILIKE $${index})`);
  }

  if (status && status.trim().length) {
    params.push(status.trim().toLowerCase());
    const index = params.length;
    conditions.push(`LOWER(j.status) = $${index}`);
  }

  if (from instanceof Date && !Number.isNaN(from.getTime())) {
    params.push(from);
    const index = params.length;
    conditions.push(`j.created_at >= $${index}`);
  }

  if (to instanceof Date && !Number.isNaN(to.getTime())) {
    params.push(to);
    const index = params.length;
    conditions.push(`j.created_at <= $${index}`);
  }

  if (cursorInfo.createdAt) {
    params.push(cursorInfo.createdAt);
    const createdAtIndex = params.length;
    params.push(cursorInfo.id ?? Number.MAX_SAFE_INTEGER);
    const idIndex = params.length;
    conditions.push(`(j.created_at, j.id) < ($${createdAtIndex}, $${idIndex})`);
  } else if (typeof cursorInfo.id === 'number' && Number.isFinite(cursorInfo.id)) {
    params.push(cursorInfo.id);
    const idIndex = params.length;
    conditions.push(`j.id < $${idIndex}`);
  }

  params.push(normalizedLimit + 1);
  const limitIndex = params.length;

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = await query<RawJobAuditRow>(
    `
      SELECT
        j.id,
        j.job_id,
        j.updated_at,
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
      ${whereClause}
      ORDER BY j.created_at DESC, j.id DESC
      LIMIT $${limitIndex}
    `,
    params
  );

  const hasMore = rows.length > normalizedLimit;
  const items = hasMore ? rows.slice(0, -1) : rows;
  const nextCursor = hasMore && items.length ? formatCursorValue(items[items.length - 1]) : null;

  const jobs = items.map((row) => {
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

    const statusNormalized = (row.status ?? '').toLowerCase();
    const updatedAtDate = new Date(row.updated_at);
    const archived =
      ['failed', 'error', 'errored', 'cancelled', 'canceled'].includes(statusNormalized) &&
      !Number.isNaN(updatedAtDate.getTime()) &&
      Date.now() - updatedAtDate.getTime() >= ARCHIVE_THRESHOLD_MS;

    const videoUrl = row.video_url ? normalizeMediaUrl(row.video_url) ?? row.video_url : null;
    const thumbUrl = row.thumb_url ? normalizeMediaUrl(row.thumb_url) ?? row.thumb_url : null;
    const placeholderVideo = isPlaceholderMediaUrl(videoUrl);
    const displayOk = Boolean(videoUrl) && !placeholderVideo;

    return {
      id: row.id,
      jobId: row.job_id,
      userId: row.user_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
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
      archived,
    };
  });

  return { jobs, nextCursor };
}
