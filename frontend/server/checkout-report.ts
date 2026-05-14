import { query } from '@/lib/db';
import { ensureBillingSchema } from '@/lib/schema';

export type CheckoutReportRange = '24h' | '7d' | '30d';
export type CheckoutReportStatus = 'passed' | 'abandoned' | 'blocked' | 'challenged' | 'open' | 'failed';
export type CheckoutAbandonmentSignal =
  | 'none'
  | 'passive_open'
  | 'user_cancelled'
  | 'payment_started_no_receipt'
  | 'technical_error'
  | 'redirected_no_receipt';

export type CheckoutReportSummary = {
  total: number;
  passed: number;
  abandoned: number;
  blocked: number;
  challenged: number;
  open: number;
  failed: number;
  hosted: number;
  express: number;
  captchaPassed: number;
  amexBlocked: number;
  distinctUsers: number;
  distinctIps: number;
};

export type CheckoutReportReason = {
  reason: string;
  count: number;
};

export type CheckoutReportRecentAttempt = {
  id: number;
  userId: string;
  amountCents: number;
  mode: 'hosted' | 'express_checkout';
  outcome: string;
  status: CheckoutReportStatus;
  reason: string | null;
  captchaRequired: boolean;
  captchaPassed: boolean;
  stripeCheckoutSessionId: string | null;
  hasReceipt: boolean;
  createdAt: string;
  abandonmentSignal: CheckoutAbandonmentSignal;
  events: CheckoutReportInteractionEvent[];
};

export type CheckoutReportInteractionEvent = {
  eventName: string;
  createdAt: string;
  metadata: Record<string, unknown> | null;
};

export type CheckoutReport = {
  range: CheckoutReportRange;
  summary: CheckoutReportSummary;
  reasons: CheckoutReportReason[];
  recent: CheckoutReportRecentAttempt[];
};

type CheckoutReportAggregateRow = {
  status: CheckoutReportStatus;
  count: number | string;
};

type CheckoutReportSummaryRow = {
  total: number | string | null;
  hosted: number | string | null;
  express: number | string | null;
  captcha_passed: number | string | null;
  amex_blocked: number | string | null;
  distinct_users: number | string | null;
  distinct_ips: number | string | null;
};

type CheckoutReportReasonRow = {
  reason: string | null;
  count: number | string;
};

type CheckoutReportRecentRow = {
  id: number | string;
  user_id: string;
  amount_cents: number | string;
  mode: 'hosted' | 'express_checkout';
  outcome: string;
  status: CheckoutReportStatus;
  reason: string | null;
  captcha_required: boolean;
  captcha_passed: boolean;
  stripe_checkout_session_id: string | null;
  has_receipt: boolean;
  created_at: string;
};

type CheckoutReportEventRow = {
  checkout_attempt_id: number | string | null;
  stripe_checkout_session_id: string | null;
  event_name: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

const RANGE_INTERVALS: Record<CheckoutReportRange, string> = {
  '24h': '24 hours',
  '7d': '7 days',
  '30d': '30 days',
};

const EMPTY_SUMMARY: CheckoutReportSummary = {
  total: 0,
  passed: 0,
  abandoned: 0,
  blocked: 0,
  challenged: 0,
  open: 0,
  failed: 0,
  hosted: 0,
  express: 0,
  captchaPassed: 0,
  amexBlocked: 0,
  distinctUsers: 0,
  distinctIps: 0,
};

export function normalizeCheckoutReportRange(value?: string | string[] | null): CheckoutReportRange {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (candidate === '24h' || candidate === '7d' || candidate === '30d') return candidate;
  return '24h';
}

export function classifyCheckoutReportStatus({
  outcome,
  hasReceipt,
  createdAtMs,
  nowMs,
}: {
  outcome: string;
  hasReceipt: boolean;
  createdAtMs: number;
  nowMs: number;
}): CheckoutReportStatus {
  if (hasReceipt) return 'passed';
  if (outcome === 'rate_limited' || outcome === 'captcha_failed') return 'blocked';
  if (outcome === 'captcha_required') return 'challenged';
  if (outcome === 'session_failed') return 'failed';
  if (outcome === 'session_created') {
    return nowMs - createdAtMs >= 30 * 60 * 1000 ? 'abandoned' : 'open';
  }
  if (outcome === 'pending') return 'open';
  return 'failed';
}

export function classifyCheckoutAbandonmentSignal(
  events: Array<{ eventName: string }>
): CheckoutAbandonmentSignal {
  const eventNames = new Set(events.map((event) => event.eventName));
  if (
    eventNames.has('express_checkout_loaderror') ||
    eventNames.has('express_checkout_unavailable') ||
    eventNames.has('express_checkout_confirm_failed')
  ) {
    return 'technical_error';
  }
  if (eventNames.has('express_checkout_confirm_started')) {
    return 'payment_started_no_receipt';
  }
  if (eventNames.has('express_checkout_cancelled') || eventNames.has('hosted_checkout_cancelled_return')) {
    return 'user_cancelled';
  }
  if (eventNames.has('hosted_checkout_redirecting')) {
    return 'redirected_no_receipt';
  }
  if (
    eventNames.has('express_checkout_ready') ||
    eventNames.has('express_checkout_session_ready') ||
    eventNames.has('express_checkout_revealed')
  ) {
    return 'passive_open';
  }
  return 'none';
}

function checkoutStatusSql() {
  return `
    CASE
      WHEN receipt.id IS NOT NULL THEN 'passed'
      WHEN attempt.outcome IN ('rate_limited', 'captcha_failed') THEN 'blocked'
      WHEN attempt.outcome = 'captcha_required' THEN 'challenged'
      WHEN attempt.outcome = 'session_failed' THEN 'failed'
      WHEN attempt.outcome = 'session_created' AND attempt.created_at < NOW() - INTERVAL '30 minutes' THEN 'abandoned'
      WHEN attempt.outcome IN ('session_created', 'pending') THEN 'open'
      ELSE 'failed'
    END
  `;
}

function scopedCheckoutAttemptsSql(interval: string) {
  return `
    FROM checkout_attempts attempt
    LEFT JOIN app_receipts receipt
      ON receipt.stripe_checkout_session_id = attempt.stripe_checkout_session_id
     AND receipt.type = 'topup'
    WHERE attempt.created_at >= NOW() - INTERVAL '${interval}'
  `;
}

export async function fetchCheckoutReport(rangeInput?: string | string[] | null): Promise<CheckoutReport> {
  await ensureBillingSchema();
  const range = normalizeCheckoutReportRange(rangeInput);
  const interval = RANGE_INTERVALS[range];
  const scopedSql = scopedCheckoutAttemptsSql(interval);
  const statusSql = checkoutStatusSql();

  const [summaryRows, aggregateRows, reasonRows, recentRows] = await Promise.all([
    query<CheckoutReportSummaryRow>(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE attempt.mode = 'hosted')::int AS hosted,
         COUNT(*) FILTER (WHERE attempt.mode = 'express_checkout')::int AS express,
         COUNT(*) FILTER (WHERE attempt.captcha_passed IS TRUE)::int AS captcha_passed,
         COUNT(*) FILTER (WHERE attempt.metadata->>'amexBlocked' = 'true')::int AS amex_blocked,
         COUNT(DISTINCT attempt.user_id)::int AS distinct_users,
         COUNT(DISTINCT attempt.ip_hash)::int AS distinct_ips
       ${scopedSql}`
    ),
    query<CheckoutReportAggregateRow>(
      `SELECT ${statusSql} AS status, COUNT(*)::int AS count
       ${scopedSql}
       GROUP BY 1`
    ),
    query<CheckoutReportReasonRow>(
      `SELECT COALESCE(NULLIF(attempt.reason, ''), 'none') AS reason, COUNT(*)::int AS count
       ${scopedSql}
       GROUP BY COALESCE(NULLIF(attempt.reason, ''), 'none')
       ORDER BY count DESC, reason ASC
       LIMIT 8`
    ),
    query<CheckoutReportRecentRow>(
      `SELECT
         attempt.id,
         attempt.user_id,
         attempt.amount_cents,
         attempt.mode,
         attempt.outcome,
         ${statusSql} AS status,
         attempt.reason,
         attempt.captcha_required,
         attempt.captcha_passed,
         attempt.stripe_checkout_session_id,
         (receipt.id IS NOT NULL) AS has_receipt,
         attempt.created_at
       ${scopedSql}
       ORDER BY attempt.created_at DESC
       LIMIT 100`
    ),
  ]);

  const eventRows = await fetchRecentCheckoutEvents(recentRows);
  const eventsByAttempt = groupCheckoutEventsByAttempt(recentRows, eventRows);

  const summaryRow = summaryRows[0];
  const summary: CheckoutReportSummary = {
    ...EMPTY_SUMMARY,
    total: Number(summaryRow?.total ?? 0),
    hosted: Number(summaryRow?.hosted ?? 0),
    express: Number(summaryRow?.express ?? 0),
    captchaPassed: Number(summaryRow?.captcha_passed ?? 0),
    amexBlocked: Number(summaryRow?.amex_blocked ?? 0),
    distinctUsers: Number(summaryRow?.distinct_users ?? 0),
    distinctIps: Number(summaryRow?.distinct_ips ?? 0),
  };

  for (const row of aggregateRows) {
    summary[row.status] = Number(row.count ?? 0);
  }

  return {
    range,
    summary,
    reasons: reasonRows.map((row) => ({
      reason: row.reason ?? 'none',
      count: Number(row.count ?? 0),
    })),
    recent: recentRows.map((row) => {
      const id = Number(row.id);
      const events = eventsByAttempt.get(id) ?? [];
      return {
        id,
        userId: row.user_id,
        amountCents: Number(row.amount_cents ?? 0),
        mode: row.mode,
        outcome: row.outcome,
        status: row.status,
        reason: row.reason,
        captchaRequired: Boolean(row.captcha_required),
        captchaPassed: Boolean(row.captcha_passed),
        stripeCheckoutSessionId: row.stripe_checkout_session_id,
        hasReceipt: Boolean(row.has_receipt),
        createdAt: row.created_at,
        abandonmentSignal: classifyCheckoutAbandonmentSignal(events),
        events,
      };
    }),
  };
}

async function fetchRecentCheckoutEvents(recentRows: CheckoutReportRecentRow[]): Promise<CheckoutReportEventRow[]> {
  if (!recentRows.length) return [];
  const attemptIds = recentRows.map((row) => Number(row.id)).filter((id) => Number.isFinite(id));
  const sessionIds = recentRows
    .map((row) => row.stripe_checkout_session_id)
    .filter((sessionId): sessionId is string => Boolean(sessionId));
  if (!attemptIds.length && !sessionIds.length) return [];

  return query<CheckoutReportEventRow>(
    `SELECT
       checkout_attempt_id,
       stripe_checkout_session_id,
       event_name,
       created_at,
       metadata
     FROM checkout_interaction_events
     WHERE checkout_attempt_id = ANY($1::bigint[])
        OR stripe_checkout_session_id = ANY($2::text[])
     ORDER BY created_at ASC`,
    [attemptIds, sessionIds]
  );
}

function groupCheckoutEventsByAttempt(
  recentRows: CheckoutReportRecentRow[],
  eventRows: CheckoutReportEventRow[]
): Map<number, CheckoutReportInteractionEvent[]> {
  const sessionToAttempt = new Map<string, number>();
  for (const row of recentRows) {
    if (row.stripe_checkout_session_id) {
      sessionToAttempt.set(row.stripe_checkout_session_id, Number(row.id));
    }
  }

  const grouped = new Map<number, CheckoutReportInteractionEvent[]>();
  for (const row of eventRows) {
    const attemptId =
      row.checkout_attempt_id != null
        ? Number(row.checkout_attempt_id)
        : row.stripe_checkout_session_id
          ? sessionToAttempt.get(row.stripe_checkout_session_id)
          : null;
    if (!attemptId || !Number.isFinite(attemptId)) continue;
    const events = grouped.get(attemptId) ?? [];
    events.push({
      eventName: row.event_name,
      createdAt: row.created_at,
      metadata: row.metadata ?? null,
    });
    grouped.set(attemptId, events);
  }
  return grouped;
}
