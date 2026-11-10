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
  sessionsCreated: number;
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
  failedCardAttempts: number;
  failedCardLimitedSessions: number;
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
  paymentCurrency: string | null;
  mode: 'hosted' | 'express_checkout';
  outcome: string;
  status: CheckoutReportStatus;
  reason: string | null;
  captchaRequired: boolean;
  captchaPassed: boolean;
  stripeCheckoutSessionId: string | null;
  canExpireCheckoutSession: boolean;
  hasReceipt: boolean;
  createdAt: string;
  abandonmentSignal: CheckoutAbandonmentSignal;
  events: CheckoutReportInteractionEvent[];
  walletLoads: CheckoutWalletLoad[];
};

export type CheckoutReportInteractionEvent = {
  eventName: string;
  createdAt: string;
  metadata: Record<string, unknown> | null;
};

export type CheckoutWalletLoad = {
  id: string | null;
  status: 'prepared' | 'ready' | 'recovered' | 'no_ready' | 'error' | 'no_methods';
  timeoutAt: string | null;
  phase: string | null;
  elapsedMs: number | null;
  sessionPreparationMs: number | null;
  stripeJsWaitMs: number | null;
  elementReadyMs: number | null;
};

export type CheckoutReport = {
  range: CheckoutReportRange;
  summary: CheckoutReportSummary;
  reasons: CheckoutReportReason[];
  recent: CheckoutReportRecentAttempt[];
  recentWalletFollowups: { delayedAccounts: number; hostedAfterDelay: number; hostedPaidAfterDelay: number };
};

type CheckoutReportAggregateRow = {
  status: CheckoutReportStatus;
  count: number | string;
};

type CheckoutReportSummaryRow = {
  total: number | string | null;
  sessions_created: number | string | null;
  hosted: number | string | null;
  express: number | string | null;
  captcha_passed: number | string | null;
  amex_blocked: number | string | null;
  failed_card_attempts: number | string | null;
  failed_card_limited_sessions: number | string | null;
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
  payment_currency: string | null;
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
  user_id: string;
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
  sessionsCreated: 0,
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
  failedCardAttempts: 0,
  failedCardLimitedSessions: 0,
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

export function canExpireCheckoutSessionFromReport({
  hasReceipt,
  status,
  stripeCheckoutSessionId,
}: {
  hasReceipt: boolean;
  status: CheckoutReportStatus;
  stripeCheckoutSessionId: string | null;
}): boolean {
  return Boolean(stripeCheckoutSessionId && !hasReceipt && (status === 'open' || status === 'abandoned'));
}

export function classifyCheckoutAbandonmentSignal(
  events: Array<{ eventName: string; metadata?: Record<string, unknown> | null }>,
  hasReceipt = false,
): CheckoutAbandonmentSignal {
  // A canonical receipt wins over earlier failures or missing browser events.
  if (hasReceipt) return 'none';
  const eventNames = new Set(events.map((event) => event.eventName));
  if (
    events.some(isExplicitWalletLoadError) ||
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
    eventNames.has('express_checkout_unavailable') ||
    eventNames.has('express_checkout_session_ready') ||
    eventNames.has('express_checkout_revealed')
  ) {
    return 'passive_open';
  }
  return 'none';
}

function isExplicitWalletLoadError(event: { eventName: string; metadata?: Record<string, unknown> | null }): boolean {
  return event.eventName === 'express_checkout_loaderror' ||
    (event.eventName === 'express_checkout_unavailable' &&
      event.metadata?.reason !== 'ready_timeout' && event.metadata?.reason !== 'no_available_methods');
}

export function summarizeCheckoutWalletLoads(events: CheckoutReportInteractionEvent[]): CheckoutWalletLoad[] {
  const groups = new Map<string | null, CheckoutReportInteractionEvent[]>();
  for (const event of events) {
    if (!['express_checkout_session_ready', 'express_checkout_ready', 'express_checkout_unavailable',
      'express_checkout_loaderror'].includes(event.eventName)) continue;
    const id = typeof event.metadata?.loadId === 'string' ? event.metadata.loadId : null;
    const group = groups.get(id) ?? [];
    group.push(event);
    groups.set(id, group);
  }

  const loads: CheckoutWalletLoad[] = [];
  for (const [id, group] of groups) {
    const error = group.findLast(isExplicitWalletLoadError);
    const timeout = group.findLast(event => event.metadata?.reason === 'ready_timeout');
    const prepared = group.findLast(event => event.eventName === 'express_checkout_session_ready');
    const recovered = group.findLast(event =>
      event.eventName === 'express_checkout_ready' && event.metadata?.recoveredAfterTimeout === true);
    const ready = group.findLast(event => event.eventName === 'express_checkout_ready');
    const noMethods = group.findLast(event => event.metadata?.reason === 'no_available_methods');
    const latePreparation = prepared?.metadata?.readyTimeoutBeforePreparation === true;
    const recoveryMatches = recovered && (id !== null ||
      group.filter(event => event.metadata?.reason === 'ready_timeout').length <= 1);

    const timeoutAt = timeout?.createdAt ?? (latePreparation ? prepared?.createdAt : recovered?.createdAt) ?? null;
    let status: CheckoutWalletLoad['status'] = 'prepared';
    let measurement = prepared;
    if (error) {
      status = 'error';
      measurement = error;
    } else if (recoveryMatches) {
      status = 'recovered';
      measurement = recovered;
    } else if (timeoutAt && !(id && noMethods)) {
      status = 'no_ready';
      measurement = timeout ?? prepared;
    } else if (noMethods) {
      status = 'no_methods';
      measurement = noMethods;
    } else if (ready) {
      status = 'ready';
      measurement = ready;
    }
    if (id === null && (status === 'prepared' || status === 'ready' || status === 'no_methods')) continue;

    const metadata = measurement?.metadata;
    const duration = (key: string) => {
      const value = metadata?.[key];
      return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
    };
    loads.push({
      id,
      status,
      timeoutAt,
      phase: typeof metadata?.loadPhase === 'string' ? metadata.loadPhase : null,
      elapsedMs: duration('elapsedMs'),
      sessionPreparationMs: duration('sessionPreparationMs'),
      stripeJsWaitMs: duration('stripeJsWaitMs'),
      elementReadyMs: duration('elementReadyMs'),
    });
  }
  return loads;
}

export function summarizeRecentWalletFollowups(
  attempts: Array<Pick<CheckoutReportRecentAttempt, 'userId' | 'mode' | 'hasReceipt' | 'events' | 'walletLoads'>>,
): CheckoutReport['recentWalletFollowups'] {
  const delaysByUser = new Map<string, number[]>();
  for (const attempt of attempts) {
    if (attempt.mode !== 'express_checkout') continue;
    for (const load of attempt.walletLoads) {
      if (!load.timeoutAt) continue;
      const times = delaysByUser.get(attempt.userId) ?? [];
      times.push(new Date(load.timeoutAt).getTime());
      delaysByUser.set(attempt.userId, times);
    }
  }

  const hostedUsers = new Set<string>();
  const paidUsers = new Set<string>();
  for (const attempt of attempts) {
    if (attempt.mode !== 'hosted') continue;
    const delays = delaysByUser.get(attempt.userId);
    if (!delays) continue;
    const redirectedAfterDelay = attempt.events.some(event => {
      if (event.eventName !== 'hosted_checkout_redirecting') return false;
      const redirectedAt = new Date(event.createdAt).getTime();
      return delays.some(delay => redirectedAt > delay && redirectedAt - delay <= 15 * 60_000);
    });
    if (!redirectedAfterDelay) continue;
    hostedUsers.add(attempt.userId);
    if (attempt.hasReceipt) paidUsers.add(attempt.userId);
  }
  return {
    delayedAccounts: delaysByUser.size,
    hostedAfterDelay: hostedUsers.size,
    hostedPaidAfterDelay: paidUsers.size,
  };
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
         COUNT(*) FILTER (WHERE attempt.stripe_checkout_session_id IS NOT NULL)::int AS sessions_created,
         COUNT(*) FILTER (WHERE attempt.mode = 'hosted')::int AS hosted,
         COUNT(*) FILTER (WHERE attempt.mode = 'express_checkout')::int AS express,
         COUNT(*) FILTER (WHERE attempt.captcha_passed IS TRUE)::int AS captcha_passed,
         COUNT(*) FILTER (WHERE attempt.metadata->>'amexBlocked' = 'true')::int AS amex_blocked,
         (
           SELECT COUNT(*)::int
             FROM checkout_interaction_events event
            WHERE event.event_name = 'stripe_charge_failed'
              AND event.created_at >= NOW() - INTERVAL '${interval}'
         ) AS failed_card_attempts,
         (
           SELECT COUNT(*)::int
             FROM checkout_interaction_events event
            WHERE event.event_name = 'stripe_checkout_session_expired_for_failed_cards'
              AND event.created_at >= NOW() - INTERVAL '${interval}'
         ) AS failed_card_limited_sessions,
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
       AND attempt.outcome IN ('rate_limited', 'captcha_required', 'captcha_failed', 'session_failed')
       GROUP BY COALESCE(NULLIF(attempt.reason, ''), 'none')
       ORDER BY count DESC, reason ASC
       LIMIT 8`
    ),
    query<CheckoutReportRecentRow>(
      `SELECT
         attempt.id,
         attempt.user_id,
         attempt.amount_cents,
         attempt.metadata->>'currency' AS payment_currency,
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
    sessionsCreated: Number(summaryRow?.sessions_created ?? 0),
    hosted: Number(summaryRow?.hosted ?? 0),
    express: Number(summaryRow?.express ?? 0),
    captchaPassed: Number(summaryRow?.captcha_passed ?? 0),
    amexBlocked: Number(summaryRow?.amex_blocked ?? 0),
    failedCardAttempts: Number(summaryRow?.failed_card_attempts ?? 0),
    failedCardLimitedSessions: Number(summaryRow?.failed_card_limited_sessions ?? 0),
    distinctUsers: Number(summaryRow?.distinct_users ?? 0),
    distinctIps: Number(summaryRow?.distinct_ips ?? 0),
  };

  for (const row of aggregateRows) {
    summary[row.status] = Number(row.count ?? 0);
  }

  const recent: CheckoutReportRecentAttempt[] = recentRows.map((row) => {
    const id = Number(row.id);
    const events = eventsByAttempt.get(id) ?? [];
    return {
      id,
      userId: row.user_id,
      amountCents: Number(row.amount_cents ?? 0),
      paymentCurrency: /^[a-z]{3}$/i.test(row.payment_currency ?? '') ? row.payment_currency!.toUpperCase() : null,
      mode: row.mode,
      outcome: row.outcome,
      status: row.status,
      reason: row.reason,
      captchaRequired: Boolean(row.captcha_required),
      captchaPassed: Boolean(row.captcha_passed),
      stripeCheckoutSessionId: row.stripe_checkout_session_id,
      hasReceipt: Boolean(row.has_receipt),
      canExpireCheckoutSession: canExpireCheckoutSessionFromReport({
        hasReceipt: Boolean(row.has_receipt),
        status: row.status,
        stripeCheckoutSessionId: row.stripe_checkout_session_id,
      }),
      createdAt: row.created_at,
      abandonmentSignal: classifyCheckoutAbandonmentSignal(events, Boolean(row.has_receipt)),
      events,
      walletLoads: row.mode === 'express_checkout' ? summarizeCheckoutWalletLoads(events) : [],
    };
  });

  return {
    range,
    summary,
    reasons: reasonRows.map((row) => ({
      reason: row.reason ?? 'none',
      count: Number(row.count ?? 0),
    })),
    recent,
    recentWalletFollowups: summarizeRecentWalletFollowups(recent),
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
       user_id,
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
  const attemptOwners = new Map<number, string>();
  for (const row of recentRows) {
    attemptOwners.set(Number(row.id), row.user_id);
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
    if (!attemptId || attemptOwners.get(attemptId) !== row.user_id) continue;
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
