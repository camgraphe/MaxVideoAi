import mcpPublication from '@/config/mcp-publication.json';
import { isDatabaseConfigured, query, type QueryExecutor } from '@/lib/db';
import {
  AUDIT_SUMMARY_SQL,
  ERROR_SQL,
  FUNNEL_SQL,
  PROVIDER_COST_SQL,
  RECEIPTS_SQL,
  RECOMMENDATION_TO_QUOTE_SQL,
} from '@/server/admin-mcp-metrics-queries';
import type { McpFunnelStage } from '@/server/agent-api/mcp-funnel';

export type AdminMcpRange = {
  from: Date;
  to: Date;
  timeZone: 'UTC';
  conversionWindowSeconds: number;
};

type MetricAvailability =
  | { status: 'available'; reason?: never }
  | { status: 'unavailable'; reason: string };

export type McpOperationsAlert = {
  code:
    | 'trial_volume'
    | 'provider_cost'
    | 'quote_confirmation_rate'
    | 'auth_errors'
    | 'polling_rate'
    | 'upload_failures'
    | 'refund_restoration_failures';
  severity: 'warning' | 'critical';
  value: number;
  threshold: number;
  summary: string;
};

export type McpOperationsAlertThresholds = Partial<{
  trialVolumeMax: number;
  providerCostCentsMax: number;
  quoteConfirmationRateMin: number;
  authErrorsMax: number;
  pollingCallsPerMinuteMax: number;
  uploadFailuresMax: number;
  refundRestorationFailuresMax: number;
}>;

export type McpOperationsAlertChannel = {
  id: 'admin_audit' | 'email' | 'slack';
  publish(alert: McpOperationsAlert): Promise<void>;
};

export type AdminMcpMetrics = {
  range: { from: string; to: string; timeZone: 'UTC' };
  availability: {
    funnel: MetricAvailability;
    audit: MetricAvailability;
    receipts: MetricAvailability;
    providerCosts: MetricAvailability;
    polling: MetricAvailability;
    uploads: MetricAvailability;
    restorations: MetricAvailability;
    revocation: MetricAvailability;
    authentication: MetricAvailability;
  };
  funnel: Record<McpFunnelStage, number> | null;
  trialToWalletRate: number | null;
  clientSplit: Array<{ client: 'claude' | 'codex' | 'other'; connections: number }> | null;
  quoteToConfirmRate: number | null;
  recommendationToQuoteRate: number | null;
  firstPaidUsers: number | null;
  repeatPaidUsers: number | null;
  revenueCents: number | null;
  providerCostCents: number | null;
  trialCostCents: number | null;
  refundsCents: number | null;
  refundRate: number | null;
  releaseRate: number | null;
  errors: Array<{ code: string; count: number }> | null;
  pollingCalls: number | null;
  pollingCallsPerMinute: number | null;
  revocationRate: number | null;
  trialVolume: number | null;
  authErrors: number | null;
  uploadFailures: number | null;
  refundRestorationFailures: number | null;
  featureFlags: Record<string, boolean>;
  alerts: McpOperationsAlert[];
};

type RelationsRow = Record<
  | 'mcp_funnel_events'
  | 'mcp_audit_events'
  | 'mcp_generation_quotes'
  | 'mcp_trial_entitlements'
  | 'mcp_reference_upload_sessions'
  | 'app_receipts'
  | 'app_jobs'
  | 'provider_attempts',
  boolean
>;

type FunnelRow = Record<
  | McpFunnelStage
  | 'completed_trial_users'
  | 'funded_after_trial_users'
  | 'claude_connections'
  | 'codex_connections'
  | 'other_connections'
  | 'quote_prepared'
  | 'quote_confirmed'
  | 'trial_volume'
  | 'trial_accepted'
  | 'trial_released'
  | 'paid_accepted',
  number | string | null
>;

type AuditSummaryRow = Record<
  | 'polling_calls'
  | 'upload_failures'
  | 'refund_restoration_failures',
  number | string | null
>;

type RecommendationCohortRow = {
  recommended_users: number | string | null;
  recommended_to_quote_users: number | string | null;
};

type ReceiptRow = {
  revenue_cents: number | string | null;
  refunds_cents: number | string | null;
  refunded_jobs: number | string | null;
  non_usd_receipts: number | string | null;
};

type ProviderCostRow = {
  provider_cost_cents: number | string | null;
  trial_cost_cents: number | string | null;
};

type AdminMcpMetricsDeps = {
  executor: QueryExecutor;
  isDatabaseConfigured(): boolean;
  featureFlags: Record<string, boolean>;
  alertThresholds?: McpOperationsAlertThresholds;
};

const defaultDeps: AdminMcpMetricsDeps = {
  executor: { query },
  isDatabaseConfigured,
  featureFlags: { ...mcpPublication },
};

const available = (): MetricAvailability => ({ status: 'available' });
const unavailable = (reason: string): MetricAvailability => ({ status: 'unavailable', reason });

function assertRange(range: AdminMcpRange): void {
  if (range.timeZone !== 'UTC'
    || !Number.isFinite(range.from.getTime())
    || !Number.isFinite(range.to.getTime())
    || range.from >= range.to
    || !Number.isSafeInteger(range.conversionWindowSeconds)
    || range.conversionWindowSeconds <= 0
    || range.conversionWindowSeconds > 365 * 24 * 60 * 60) {
    throw new Error('Invalid admin MCP UTC reporting range.');
  }
}

function count(value: number | string | null | undefined): number {
  const parsed = typeof value === 'string' ? Number(value) : value;
  if (!Number.isSafeInteger(parsed) || (parsed as number) < 0) {
    throw new Error('Invalid aggregate count returned by the database.');
  }
  return parsed as number;
}

function rate(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}

function baseMetrics(range: AdminMcpRange, flags: Record<string, boolean>, reason: string): AdminMcpMetrics {
  const state = unavailable(reason);
  return {
    range: { from: range.from.toISOString(), to: range.to.toISOString(), timeZone: 'UTC' },
    availability: {
      funnel: state,
      audit: state,
      receipts: state,
      providerCosts: state,
      polling: state,
      uploads: state,
      restorations: state,
      revocation: unavailable('No verified once-only MCP revocation event producer is live.'),
      authentication: unavailable('No privacy-safe pre-authentication error event producer is live.'),
    },
    funnel: null,
    trialToWalletRate: null,
    clientSplit: null,
    quoteToConfirmRate: null,
    recommendationToQuoteRate: null,
    firstPaidUsers: null,
    repeatPaidUsers: null,
    revenueCents: null,
    providerCostCents: null,
    trialCostCents: null,
    refundsCents: null,
    refundRate: null,
    releaseRate: null,
    errors: null,
    pollingCalls: null,
    pollingCallsPerMinute: null,
    revocationRate: null,
    trialVolume: null,
    authErrors: null,
    uploadFailures: null,
    refundRestorationFailures: null,
    featureFlags: { ...flags },
    alerts: [],
  };
}

async function loadRelations(executor: QueryExecutor): Promise<RelationsRow> {
  const rows = await executor.query<RelationsRow>(`/* admin-mcp:relations */
    SELECT
      to_regclass('public.mcp_funnel_events') IS NOT NULL AS mcp_funnel_events,
      to_regclass('public.mcp_audit_events') IS NOT NULL AS mcp_audit_events,
      to_regclass('public.mcp_generation_quotes') IS NOT NULL AS mcp_generation_quotes,
      to_regclass('public.mcp_trial_entitlements') IS NOT NULL AS mcp_trial_entitlements,
      to_regclass('public.mcp_reference_upload_sessions') IS NOT NULL AS mcp_reference_upload_sessions,
      to_regclass('public.app_receipts') IS NOT NULL AS app_receipts,
      to_regclass('public.app_jobs') IS NOT NULL AS app_jobs,
      to_regclass('public.provider_attempts') IS NOT NULL AS provider_attempts`);
  if (!rows[0]) throw new Error('Database prerequisite check returned no row.');
  return rows[0];
}

export async function loadAdminMcpMetrics(
  range: AdminMcpRange,
  deps: AdminMcpMetricsDeps = defaultDeps,
): Promise<AdminMcpMetrics> {
  assertRange(range);
  const metrics = baseMetrics(range, deps.featureFlags, 'Database is not configured.');
  if (!deps.isDatabaseConfigured()) return metrics;

  let relations: RelationsRow;
  try {
    relations = await loadRelations(deps.executor);
  } catch {
    return baseMetrics(range, deps.featureFlags, 'Database prerequisite check failed.');
  }

  const funnelRelations = ['mcp_funnel_events', 'mcp_generation_quotes', 'mcp_trial_entitlements', 'mcp_reference_upload_sessions'] as const;
  const missingFunnel = funnelRelations.filter((relation) => !relations[relation]);
  let quotePrepared: number | null = null;
  let paidAccepted: number | null = null;

  if (missingFunnel.length === 0) {
    try {
      const row = (await deps.executor.query<FunnelRow>(FUNNEL_SQL, [range.from, range.to, range.conversionWindowSeconds]))[0];
      if (!row) throw new Error('Missing funnel aggregate.');
      const funnel = {
        oauth_connected: count(row.oauth_connected),
        trial_prepared: count(row.trial_prepared),
        trial_completed: count(row.trial_completed),
        wallet_funded: count(row.wallet_funded),
        first_paid_generation: count(row.first_paid_generation),
        repeat_paid_generation: count(row.repeat_paid_generation),
      };
      const completedTrials = count(row.completed_trial_users);
      const fundedAfterTrial = count(row.funded_after_trial_users);
      quotePrepared = count(row.quote_prepared);
      const quoteConfirmed = count(row.quote_confirmed);
      paidAccepted = count(row.paid_accepted);
      metrics.availability.funnel = available();
      metrics.funnel = funnel;
      metrics.trialToWalletRate = rate(fundedAfterTrial, completedTrials);
      metrics.clientSplit = [
        { client: 'claude', connections: count(row.claude_connections) },
        { client: 'codex', connections: count(row.codex_connections) },
        { client: 'other', connections: count(row.other_connections) },
      ];
      metrics.quoteToConfirmRate = rate(quoteConfirmed, quotePrepared);
      metrics.firstPaidUsers = funnel.first_paid_generation;
      metrics.repeatPaidUsers = funnel.repeat_paid_generation;
      metrics.releaseRate = rate(count(row.trial_released), count(row.trial_accepted));
      metrics.trialVolume = count(row.trial_volume);
    } catch {
      metrics.availability.funnel = unavailable('MCP funnel aggregate query failed.');
    }
  } else {
    metrics.availability.funnel = unavailable(`Missing MCP prerequisite tables (migrations 30–33): ${missingFunnel.join(', ')}.`);
  }

  if (relations.mcp_audit_events) {
    try {
      const [summaryRows, errorRows] = await Promise.all([
        deps.executor.query<AuditSummaryRow>(AUDIT_SUMMARY_SQL, [range.from, range.to]),
        deps.executor.query<{ code: string; count: number | string | null }>(ERROR_SQL, [range.from, range.to]),
      ]);
      const row = summaryRows[0];
      if (!row) throw new Error('Missing audit aggregate.');
      const durationMinutes = (range.to.getTime() - range.from.getTime()) / 60_000;
      metrics.availability.audit = available();
      metrics.errors = errorRows.map((error) => ({ code: error.code, count: count(error.count) }));
      if (relations.mcp_generation_quotes && metrics.availability.funnel.status === 'available') {
        metrics.availability.polling = available();
        metrics.pollingCalls = count(row.polling_calls);
        metrics.pollingCallsPerMinute = metrics.pollingCalls / durationMinutes;
      } else {
        metrics.availability.polling = unavailable('Paid-generation polling prerequisites are not present.');
      }
      if (relations.mcp_reference_upload_sessions) {
        metrics.availability.uploads = available();
        metrics.uploadFailures = count(row.upload_failures);
      } else {
        metrics.availability.uploads = unavailable('Reference-upload prerequisites are not present.');
      }
      if (relations.mcp_trial_entitlements) {
        metrics.availability.restorations = available();
        metrics.refundRestorationFailures = count(row.refund_restoration_failures);
      } else {
        metrics.availability.restorations = unavailable('Trial restoration prerequisites are not present.');
      }
    } catch {
      metrics.availability.audit = unavailable('MCP audit aggregate query failed.');
      metrics.availability.polling = unavailable('MCP audit aggregate query failed.');
      metrics.availability.uploads = unavailable('MCP audit aggregate query failed.');
      metrics.availability.restorations = unavailable('MCP audit aggregate query failed.');
    }
  } else {
    metrics.availability.audit = unavailable('Missing mcp_audit_events migration.');
    metrics.availability.polling = unavailable('Missing mcp_audit_events migration.');
    metrics.availability.uploads = unavailable('Missing mcp_audit_events migration.');
    metrics.availability.restorations = unavailable('Missing mcp_audit_events migration.');
  }

  if (metrics.availability.funnel.status === 'available' && metrics.availability.audit.status === 'available') {
    try {
      const row = (await deps.executor.query<RecommendationCohortRow>(
        RECOMMENDATION_TO_QUOTE_SQL,
        [range.from, range.to],
      ))[0];
      if (!row) throw new Error('Missing recommendation cohort aggregate.');
      metrics.recommendationToQuoteRate = rate(
        count(row.recommended_to_quote_users),
        count(row.recommended_users),
      );
    } catch {
      metrics.recommendationToQuoteRate = null;
    }
  }

  if (metrics.availability.funnel.status === 'available' && relations.app_receipts) {
    try {
      const row = (await deps.executor.query<ReceiptRow>(RECEIPTS_SQL, [range.from, range.to]))[0];
      if (!row) throw new Error('Missing receipt aggregate.');
      if (count(row.non_usd_receipts) > 0) throw new Error('Mixed receipt currencies.');
      metrics.availability.receipts = available();
      metrics.revenueCents = count(row.revenue_cents);
      metrics.refundsCents = count(row.refunds_cents);
      metrics.refundRate = paidAccepted === null ? null : rate(count(row.refunded_jobs), paidAccepted);
    } catch {
      metrics.availability.receipts = unavailable('Authoritative MCP receipt aggregate is unavailable or not USD-normalized.');
    }
  } else {
    metrics.availability.receipts = unavailable(relations.app_receipts ? 'MCP funnel scope is unavailable.' : 'Missing app_receipts table.');
  }

  if (metrics.availability.funnel.status === 'available' && relations.app_jobs && relations.provider_attempts) {
    try {
      const row = (await deps.executor.query<ProviderCostRow>(PROVIDER_COST_SQL, [range.from, range.to]))[0];
      if (!row) throw new Error('Missing provider cost aggregate.');
      metrics.availability.providerCosts = available();
      metrics.providerCostCents = count(row.provider_cost_cents);
      metrics.trialCostCents = count(row.trial_cost_cents);
    } catch {
      metrics.availability.providerCosts = unavailable('Authoritative provider cost aggregate query failed.');
    }
  } else {
    const missing = [!relations.app_jobs && 'app_jobs', !relations.provider_attempts && 'provider_attempts'].filter(Boolean).join(', ');
    metrics.availability.providerCosts = unavailable(missing ? `Missing ${missing}.` : 'MCP funnel scope is unavailable.');
  }

  metrics.alerts = evaluateMcpOperationsAlerts(metrics, deps.alertThresholds ?? readMcpOperationsAlertThresholds());
  return metrics;
}

function optionalThreshold(env: Readonly<Record<string, string | undefined>>, key: string, ratio = false): number | undefined {
  const raw = env[key]?.trim();
  if (!raw) return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || (ratio && value > 1)) return undefined;
  return value;
}

export function readMcpOperationsAlertThresholds(
  env: Readonly<Record<string, string | undefined>> = process.env,
): McpOperationsAlertThresholds {
  return {
    trialVolumeMax: optionalThreshold(env, 'MCP_ALERT_TRIAL_VOLUME_MAX'),
    providerCostCentsMax: optionalThreshold(env, 'MCP_ALERT_PROVIDER_COST_CENTS_MAX'),
    quoteConfirmationRateMin: optionalThreshold(env, 'MCP_ALERT_QUOTE_CONFIRM_RATE_MIN', true),
    authErrorsMax: optionalThreshold(env, 'MCP_ALERT_AUTH_ERRORS_MAX'),
    pollingCallsPerMinuteMax: optionalThreshold(env, 'MCP_ALERT_POLLING_CALLS_PER_MINUTE_MAX'),
    uploadFailuresMax: optionalThreshold(env, 'MCP_ALERT_UPLOAD_FAILURES_MAX'),
    refundRestorationFailuresMax: optionalThreshold(env, 'MCP_ALERT_REFUND_RESTORATION_FAILURES_MAX'),
  };
}

export function evaluateMcpOperationsAlerts(
  metrics: AdminMcpMetrics,
  thresholds: McpOperationsAlertThresholds,
): McpOperationsAlert[] {
  const alerts: McpOperationsAlert[] = [];
  const above = (code: McpOperationsAlert['code'], value: number | null, threshold: number | undefined, summary: string) => {
    if (value !== null && threshold !== undefined && value > threshold) alerts.push({ code, value, threshold, summary, severity: 'warning' });
  };
  above('trial_volume', metrics.trialVolume, thresholds.trialVolumeMax, 'Trial volume is above its configured ceiling.');
  above('provider_cost', metrics.providerCostCents, thresholds.providerCostCentsMax, 'Provider cost is above its configured ceiling.');
  if (metrics.quoteToConfirmRate !== null && thresholds.quoteConfirmationRateMin !== undefined
    && metrics.quoteToConfirmRate < thresholds.quoteConfirmationRateMin) {
    alerts.push({
      code: 'quote_confirmation_rate',
      value: metrics.quoteToConfirmRate,
      threshold: thresholds.quoteConfirmationRateMin,
      summary: 'Quote confirmation rate is below its configured floor.',
      severity: 'warning',
    });
  }
  above('auth_errors', metrics.authErrors, thresholds.authErrorsMax, 'Authentication errors are above their configured ceiling.');
  above('polling_rate', metrics.pollingCallsPerMinute, thresholds.pollingCallsPerMinuteMax, 'Polling rate is above its configured ceiling.');
  above('upload_failures', metrics.uploadFailures, thresholds.uploadFailuresMax, 'Upload failures are above their configured ceiling.');
  above('refund_restoration_failures', metrics.refundRestorationFailures, thresholds.refundRestorationFailuresMax, 'Refund or restoration failures are above their configured ceiling.');
  return alerts;
}

export async function routeMcpOperationsAlerts(
  alerts: readonly McpOperationsAlert[],
  channels: readonly McpOperationsAlertChannel[],
): Promise<{ attempted: number; delivered: number; failed: number }> {
  let delivered = 0;
  let failed = 0;
  for (const alert of alerts) {
    for (const channel of channels) {
      try {
        await channel.publish(alert);
        delivered += 1;
      } catch {
        failed += 1;
      }
    }
  }
  return { attempted: alerts.length * channels.length, delivered, failed };
}
