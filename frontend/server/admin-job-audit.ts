import { query } from '@/lib/db';
import { normalizeMediaUrl, isPlaceholderMediaUrl } from '@/lib/media';

export type AdminJobOutcome =
  | 'failed_action_required'
  | 'refunded_failure_resolved'
  | 'completed'
  | 'in_progress'
  | 'unknown';

type AdminJobAuditTimelineEvent = {
  at: string;
  source: 'fal' | 'payment';
  kind: string;
  summary: string;
  details: string | null;
};

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
  surface: string | null;
  video_url: string | null;
  thumb_url: string | null;
  hero_render_id: string | null;
  render_count: number | null;
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
  fal_failure_status: string | null;
  fal_failure_created_at: string | null;
  fal_failure_payload: unknown;
  fal_log_count: number | null;
  latest_refund_created_at: string | null;
  latest_refund_metadata: unknown;
  fal_events: Array<{
    createdAt: string;
    status: string | null;
    summary: string | null;
    origin: string | null;
  }> | null;
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
  surface: string | null;
  videoUrl: string | null;
  thumbUrl: string | null;
  heroRenderId: string | null;
  renderCount: number;
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
  outcome: AdminJobOutcome;
  failureReason: string | null;
  failureOrigin: string | null;
  failureAt: string | null;
  isRefunded: boolean;
  refundAt: string | null;
  refundReason: string | null;
  falLogCount: number;
  timeline: AdminJobAuditTimelineEvent[];
  outputUrl: string | null;
  hasOutput: boolean;
  isPlaceholderOutput: boolean;
  netChargeCents: number;
  paymentOk: boolean;
  falOk: boolean;
  archived: boolean;
};

const FAILED_STATUSES = new Set(['failed', 'error', 'errored', 'cancelled', 'canceled', 'aborted']);
const COMPLETED_STATUSES = new Set(['completed', 'success', 'succeeded', 'finished']);
const IN_PROGRESS_STATUSES = new Set(['pending', 'queued', 'running', 'processing', 'in_progress']);
const OUTCOME_FILTERS: ReadonlySet<AdminJobOutcome> = new Set([
  'failed_action_required',
  'refunded_failure_resolved',
  'completed',
  'in_progress',
  'unknown',
]);

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

function normalizeAuditText(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    const trimmed = value.replace(/\s+/g, ' ').trim();
    if (!trimmed.length) return null;
    if (/^(error|failed|null|undefined|n\/a)$/i.test(trimmed)) return null;
    return trimmed;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }
  return null;
}

function findFirstTextByKeys(payload: unknown, keys: string[]): string | null {
  if (!payload) return null;
  const normalizedKeys = new Set(keys.map((key) => key.toLowerCase()));
  const visited = new Set<unknown>();
  const stack: unknown[] = [payload];

  while (stack.length) {
    const current = stack.pop();
    if (!current || visited.has(current)) continue;
    visited.add(current);

    const direct = normalizeAuditText(current);
    if (direct && typeof current !== 'object') {
      return direct;
    }

    if (Array.isArray(current)) {
      current.forEach((entry) => stack.push(entry));
      continue;
    }

    const record = asRecord(current);
    if (!record) continue;

    for (const [key, value] of Object.entries(record)) {
      if (normalizedKeys.has(key.toLowerCase())) {
        const candidate = normalizeAuditText(value);
        if (candidate) return candidate;
      }
    }

    for (const value of Object.values(record)) {
      if (value && (typeof value === 'object' || Array.isArray(value))) {
        stack.push(value);
      }
    }
  }

  return null;
}

function isRefundedJob(params: {
  paymentStatus: string | null;
  totalRefundCents: number;
  refundCount: number;
}): boolean {
  if (params.refundCount > 0 || params.totalRefundCents > 0) return true;
  return (params.paymentStatus ?? '').toLowerCase().includes('refunded');
}

function deriveOutcome(status: string | null, refunded: boolean): AdminJobOutcome {
  const normalized = (status ?? '').toLowerCase();
  if (FAILED_STATUSES.has(normalized)) {
    return refunded ? 'refunded_failure_resolved' : 'failed_action_required';
  }
  if (COMPLETED_STATUSES.has(normalized)) {
    return 'completed';
  }
  if (IN_PROGRESS_STATUSES.has(normalized)) {
    return 'in_progress';
  }
  return 'unknown';
}

function normalizeOutcomeFilter(value: string | null | undefined): AdminJobOutcome | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  if (OUTCOME_FILTERS.has(normalized as AdminJobOutcome)) {
    return normalized as AdminJobOutcome;
  }
  return null;
}

function buildOutcomeSqlCondition(outcome: AdminJobOutcome): string {
  const failedExpr = `LOWER(COALESCE(j.status, '')) IN ('failed','error','errored','cancelled','canceled','aborted')`;
  const completedExpr = `LOWER(COALESCE(j.status, '')) IN ('completed','success','succeeded','finished')`;
  const inProgressExpr = `LOWER(COALESCE(j.status, '')) IN ('pending','queued','running','processing','in_progress')`;
  const refundedExpr =
    `(COALESCE(refunds.refund_count, 0) > 0 OR COALESCE(refunds.total_refund_cents, 0) > 0 OR COALESCE(j.payment_status, '') ILIKE '%refunded%')`;

  if (outcome === 'failed_action_required') {
    return `(${failedExpr} AND NOT ${refundedExpr})`;
  }
  if (outcome === 'refunded_failure_resolved') {
    return `(${failedExpr} AND ${refundedExpr})`;
  }
  if (outcome === 'completed') {
    return completedExpr;
  }
  if (outcome === 'in_progress') {
    return inProgressExpr;
  }
  return `NOT (${failedExpr} OR ${completedExpr} OR ${inProgressExpr})`;
}

function normalizeTimeline(
  falEventsRaw: RawJobAuditRow['fal_events'],
  receipts: AdminJobAuditRecord['receipts']
): AdminJobAuditRecord['timeline'] {
  const falEvents: AdminJobAuditRecord['timeline'] = Array.isArray(falEventsRaw)
    ? falEventsRaw
        .map((event) => {
          const falStatus = normalizeAuditText(event.status) ?? 'event';
          const summary =
            normalizeAuditText(event.summary) ??
            normalizeAuditText(findFirstTextByKeys(event, ['reason', 'message', 'note'])) ??
            `Fal ${falStatus}`;
          const details = normalizeAuditText(event.origin) ?? null;
          return {
            at: event.createdAt,
            source: 'fal' as const,
            kind: falStatus.toLowerCase(),
            summary,
            details,
          };
        })
        .filter((event) => Boolean(event.at))
    : [];

  const paymentEvents: AdminJobAuditRecord['timeline'] = receipts.map((receipt) => ({
    at: receipt.createdAt,
    source: 'payment' as const,
    kind: receipt.type,
    summary: `${receipt.type} ${receipt.amountCents / 100} ${receipt.currency}`,
    details: `Receipt #${receipt.id}`,
  }));

  return [...falEvents, ...paymentEvents]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 10);
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
  outcome?: string | null;
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
  outcome = null,
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

  const outcomeFilter = normalizeOutcomeFilter(outcome);
  if (outcomeFilter) {
    conditions.push(buildOutcomeSqlCondition(outcomeFilter));
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

  const jobs = items.map((row) => {
    const finalPrice = coerceNumber(row.final_price_cents);
    const totalCharge = coerceNumber(row.total_charge_cents);
    const totalRefund = coerceNumber(row.total_refund_cents);
    const netCharge = totalCharge - totalRefund;
    const currency = normalizeCurrency(row.currency);
    const paymentStatus = row.payment_status ?? '';
    const refunded = isRefundedJob({
      paymentStatus: row.payment_status,
      totalRefundCents: totalRefund,
      refundCount: row.refund_count ?? 0,
    });
    const outcome = deriveOutcome(row.status, refunded);

    const paymentOk =
      paymentStatus.includes('refunded') || refunded ? netCharge <= 0 : finalPrice === netCharge;

    const falStatus = row.fal_status;
    const falOk = !falStatus || falStatus.toUpperCase() === 'COMPLETED' || outcome === 'refunded_failure_resolved';

    const updatedAtDate = new Date(row.updated_at);
    const archived =
      outcome === 'failed_action_required' &&
      !Number.isNaN(updatedAtDate.getTime()) &&
      Date.now() - updatedAtDate.getTime() >= ARCHIVE_THRESHOLD_MS;

    const surface = normalizeAuditText(row.surface);
    const videoUrl = row.video_url ? normalizeMediaUrl(row.video_url) ?? row.video_url : null;
    const thumbUrl = row.thumb_url ? normalizeMediaUrl(row.thumb_url) ?? row.thumb_url : null;
    const heroRenderId = row.hero_render_id ? normalizeMediaUrl(row.hero_render_id) ?? row.hero_render_id : null;
    const renderCount = row.render_count ?? 0;
    const imageLikeSurface = surface === 'image' || surface === 'character' || surface === 'angle';
    const placeholderVideo = isPlaceholderMediaUrl(videoUrl);
    const outputUrl = imageLikeSurface ? heroRenderId ?? thumbUrl : videoUrl;
    const placeholderOutput = imageLikeSurface ? false : placeholderVideo;
    const displayOk = imageLikeSurface
      ? Boolean(heroRenderId) || renderCount > 0 || Boolean(thumbUrl)
      : Boolean(videoUrl) && !placeholderVideo;
    const receipts = normalizeReceipts(row.receipts);

    const failureReason =
      normalizeAuditText(
        findFirstTextByKeys(row.fal_failure_payload, [
          'reason',
          'message',
          'note',
          'error',
          'error_message',
          'status_message',
          'falError',
          'detail',
        ])
      ) ?? normalizeAuditText(row.message);
    const failureOrigin =
      normalizeAuditText(
        findFirstTextByKeys(row.latest_refund_metadata, ['failure_origin', 'failureOrigin'])
      ) ??
      normalizeAuditText(
        findFirstTextByKeys(row.fal_failure_payload, ['failure_origin', 'failureOrigin'])
      ) ??
      null;
    const refundReason =
      normalizeAuditText(
        findFirstTextByKeys(row.latest_refund_metadata, ['note', 'reason', 'message'])
      ) ?? null;

    const failureAt = row.fal_failure_created_at ?? (outcome === 'failed_action_required' ? row.updated_at : null);
    const timeline = normalizeTimeline(row.fal_events, receipts);

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
      surface,
      videoUrl,
      thumbUrl,
      heroRenderId,
      renderCount,
      engineLabel: row.engine_label,
      durationSec: row.duration_sec,
      providerJobId: row.provider_job_id,
      totalChargeCents: totalCharge,
      totalRefundCents: totalRefund,
      chargeCount: row.charge_count ?? 0,
      refundCount: row.refund_count ?? 0,
      receipts,
      falStatus,
      falUpdatedAt: row.fal_created_at,
      outcome,
      failureReason,
      failureOrigin,
      failureAt,
      isRefunded: refunded,
      refundAt: row.latest_refund_created_at,
      refundReason,
      falLogCount: row.fal_log_count ?? 0,
      timeline,
      outputUrl,
      hasOutput: displayOk,
      isPlaceholderOutput: placeholderOutput,
      netChargeCents: netCharge,
      paymentOk,
      falOk,
      archived,
    };
  });

  return { jobs, nextCursor };
}
