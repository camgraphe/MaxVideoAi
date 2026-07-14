import assert from 'node:assert/strict';
import test from 'node:test';

import {
  evaluateMcpOperationsAlerts,
  loadAdminMcpMetrics,
  routeMcpOperationsAlerts,
  type AdminMcpMetrics,
  type McpMetricProducerCapabilities,
  type McpOperationsAlertThresholds,
} from '../frontend/server/admin-mcp-metrics.ts';

const RANGE = {
  from: new Date('2026-07-01T00:00:00.000Z'),
  to: new Date('2026-07-08T00:00:00.000Z'),
  timeZone: 'UTC' as const,
  conversionWindowSeconds: 30 * 24 * 60 * 60,
};

const FLAGS = {
  publicMarketing: false,
  publicIndexing: false,
  transport: false,
  oauth: false,
  discovery: false,
  paidGeneration: false,
  trial: false,
  referenceUploads: false,
};

const ALL_PRODUCERS: McpMetricProducerCapabilities = {
  funnel: true,
  audit: true,
  recommendationToQuote: true,
  receipts: true,
  providerCosts: true,
  polling: true,
  uploads: true,
  restorations: true,
};

type QueryCall = { sql: string; params?: ReadonlyArray<unknown> };

function createMetricsHarness(options: {
  relations?: Record<string, boolean>;
  zeroDenominators?: boolean;
  failRecommendation?: boolean;
  nonUsdReceipts?: number;
  missingProviderCosts?: number;
} = {}) {
  const calls: QueryCall[] = [];
  const relations = {
    mcp_funnel_events: true,
    mcp_audit_events: true,
    mcp_generation_quotes: true,
    mcp_trial_entitlements: true,
    mcp_reference_upload_sessions: true,
    app_receipts: true,
    app_jobs: true,
    provider_attempts: true,
    ...options.relations,
  };

  const executor = {
    async query<T>(sql: string, params?: ReadonlyArray<unknown>): Promise<T[]> {
      calls.push({ sql, params });
      if (sql.includes('admin-mcp:relations')) return [relations] as T[];
      if (sql.includes('admin-mcp:funnel')) {
        return [{
          oauth_connected: options.zeroDenominators ? 0 : 10,
          trial_prepared: options.zeroDenominators ? 0 : 8,
          trial_completed: options.zeroDenominators ? 0 : 6,
          wallet_funded: options.zeroDenominators ? 0 : 3,
          first_paid_generation: options.zeroDenominators ? 0 : 2,
          repeat_paid_generation: options.zeroDenominators ? 0 : 1,
          completed_trial_users: options.zeroDenominators ? 0 : 6,
          funded_after_trial_users: options.zeroDenominators ? 0 : 3,
          claude_connections: options.zeroDenominators ? 0 : 7,
          codex_connections: options.zeroDenominators ? 0 : 2,
          other_connections: options.zeroDenominators ? 0 : 1,
          quote_prepared: options.zeroDenominators ? 0 : 8,
          quote_confirmed: options.zeroDenominators ? 0 : 4,
          trial_volume: options.zeroDenominators ? 0 : 5,
          trial_accepted: options.zeroDenominators ? 0 : 5,
          trial_released: options.zeroDenominators ? 0 : 1,
          connection_completed: options.zeroDenominators ? 0 : 10,
          connection_revoked: options.zeroDenominators ? 0 : 1,
        }] as T[];
      }
      if (sql.includes('admin-mcp:audit-summary')) {
        return [{
          recommendation_calls: options.zeroDenominators ? 0 : 10,
          polling_calls: options.zeroDenominators ? 0 : 12,
          auth_errors: options.zeroDenominators ? 0 : 3,
          upload_failures: options.zeroDenominators ? 0 : 2,
          refund_restoration_failures: options.zeroDenominators ? 0 : 1,
        }] as T[];
      }
      if (sql.includes('admin-mcp:recommendation-to-quote')) {
        if (options.failRecommendation) throw new Error('simulated recommendation cohort failure');
        return [{
          recommended_users: options.zeroDenominators ? 0 : 10,
          recommended_to_quote_users: options.zeroDenominators ? 0 : 8,
        }] as T[];
      }
      if (sql.includes('admin-mcp:errors')) {
        return options.zeroDenominators
          ? [] as T[]
          : [
              { code: 'AUTH_INVALID', count: 3 },
              { code: 'UPLOAD_FAILED', count: 2 },
            ] as T[];
      }
      if (sql.includes('admin-mcp:receipts')) {
        return [{
          revenue_cents: options.zeroDenominators ? 0 : 1234,
          refunds_cents: options.zeroDenominators ? 0 : 200,
          charged_jobs: options.zeroDenominators ? 0 : 2,
          refunded_jobs: options.zeroDenominators ? 0 : 1,
          non_usd_receipts: options.nonUsdReceipts ?? 0,
        }] as T[];
      }
      if (sql.includes('admin-mcp:provider-costs')) {
        return [{
          attempt_count: options.zeroDenominators ? 0 : 3,
          trial_attempt_count: options.zeroDenominators ? 0 : 1,
          missing_cost_attempts: options.missingProviderCosts ?? 0,
          provider_cost_cents: options.zeroDenominators ? 0 : 456,
          trial_cost_cents: options.zeroDenominators ? 0 : 123,
        }] as T[];
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
  };

  return { calls, executor };
}

async function loadHarnessMetrics(
  harness = createMetricsHarness(),
  producerCapabilities: McpMetricProducerCapabilities = ALL_PRODUCERS,
): Promise<AdminMcpMetrics> {
  return loadAdminMcpMetrics(RANGE, {
    executor: harness.executor,
    isDatabaseConfigured: () => true,
    featureFlags: FLAGS,
    alertThresholds: {},
    producerCapabilities,
  });
}

test('loads every available funnel, cohort, client, economics, error, polling, and revocation metric', async () => {
  const metrics = await loadHarnessMetrics();

  assert.deepEqual(metrics.funnel, {
    oauth_connected: 10,
    trial_prepared: 8,
    trial_completed: 6,
    wallet_funded: 3,
    first_paid_generation: 2,
    repeat_paid_generation: 1,
  });
  assert.equal(metrics.trialToWalletRate, 0.5);
  assert.deepEqual(metrics.clientSplit, [
    { client: 'claude', connections: 7 },
    { client: 'codex', connections: 2 },
    { client: 'other', connections: 1 },
  ]);
  assert.equal(metrics.quoteToConfirmRate, 0.5);
  assert.equal(metrics.recommendationToQuoteRate, 0.8);
  assert.equal(metrics.firstPaidUsers, 2);
  assert.equal(metrics.repeatPaidUsers, 1);
  assert.equal(metrics.revenueCents, 1234);
  assert.equal(metrics.providerCostCents, 456);
  assert.equal(metrics.trialCostCents, 123);
  assert.equal(metrics.refundsCents, 200);
  assert.equal(metrics.refundRate, 0.5);
  assert.equal(metrics.releaseRate, 0.2);
  assert.equal(metrics.revocationRate, null, 'Task 7 has no verified revocation producer yet');
  assert.deepEqual(metrics.errors, [
    { code: 'AUTH_INVALID', count: 3 },
    { code: 'UPLOAD_FAILED', count: 2 },
  ]);
  assert.equal(metrics.pollingCalls, 12);
  assert.deepEqual(metrics.featureFlags, FLAGS);
  assert.equal(metrics.availability.funnel.status, 'available');
  assert.equal(metrics.availability.audit.status, 'available');
  assert.equal(metrics.availability.receipts.status, 'available');
  assert.equal(metrics.availability.providerCosts.status, 'available');
  assert.equal(metrics.availability.recommendationToQuote.status, 'available');
  assert.equal(metrics.availability.revocation.status, 'unavailable');
  assert.match(metrics.availability.revocation.reason ?? '', /producer|revocation/i);
  assert.equal(metrics.authErrors, null, 'the current protocol has no privacy-safe pre-auth error producer');
  assert.equal(metrics.availability.authentication.status, 'unavailable');
});

test('uses null rates for real zero denominators without producing Infinity, NaN, or a fabricated percentage', async () => {
  const metrics = await loadHarnessMetrics(createMetricsHarness({ zeroDenominators: true }));

  assert.equal(metrics.trialToWalletRate, null);
  assert.equal(metrics.quoteToConfirmRate, null);
  assert.equal(metrics.recommendationToQuoteRate, null);
  assert.equal(metrics.refundRate, null);
  assert.equal(metrics.releaseRate, null);
  assert.equal(metrics.revocationRate, null);
  assert.equal(metrics.funnel?.oauth_connected, 0, 'zero remains valid when the authoritative query ran');
});

test('missing prerequisite migrations and tables are explicit unavailable states, never fabricated zeroes', async () => {
  const harness = createMetricsHarness({
    relations: {
      mcp_funnel_events: false,
      mcp_generation_quotes: false,
      mcp_trial_entitlements: false,
      mcp_reference_upload_sessions: false,
      app_receipts: false,
      provider_attempts: false,
    },
  });
  const metrics = await loadHarnessMetrics(harness);

  assert.equal(metrics.availability.funnel.status, 'unavailable');
  assert.match(metrics.availability.funnel.reason ?? '', /mcp_funnel_events|migrations 30/i);
  assert.equal(metrics.funnel, null);
  assert.equal(metrics.trialToWalletRate, null);
  assert.equal(metrics.clientSplit, null);
  assert.equal(metrics.firstPaidUsers, null);
  assert.equal(metrics.revenueCents, null);
  assert.equal(metrics.refundsCents, null);
  assert.equal(metrics.providerCostCents, null);
  assert.equal(metrics.trialCostCents, null);
  assert.equal(metrics.pollingCalls, null, 'future polling stays unavailable without paid-generation prerequisites');
  assert.equal(metrics.uploadFailures, null, 'future upload metrics stay unavailable without reference prerequisites');
  assert.equal(metrics.refundRestorationFailures, null, 'future restoration metrics stay unavailable without trial prerequisites');
  assert.equal(metrics.authErrors, null, 'unsupported authentication error measurement remains unavailable');
  assert.deepEqual(metrics.featureFlags, FLAGS);
  assert.equal(harness.calls.length, 3, 'only relation and available audit queries may run');
  assert.ok(harness.calls.every((call) => !call.sql.includes('admin-mcp:funnel')));
});

test('recommendation to quote is a user-cohort conversion query rather than unrelated event-count division', async () => {
  const harness = createMetricsHarness();
  const metrics = await loadHarnessMetrics(harness);
  const call = harness.calls.find((entry) => entry.sql.includes('admin-mcp:recommendation-to-quote'));

  assert.ok(call, 'a dedicated recommendation cohort query should run');
  assert.match(call.sql, /COUNT\(DISTINCT/i);
  assert.match(call.sql, /recommend_models/);
  assert.match(call.sql, /paid_quote_prepared|trial_quote_prepared/);
  assert.equal(metrics.recommendationToQuoteRate, 0.8);
  assert.equal(metrics.availability.recommendationToQuote.status, 'available');
});

test('present tables do not make metrics available when their server-side producers are not ready', async () => {
  const harness = createMetricsHarness();
  const metrics = await loadHarnessMetrics(harness, {
    funnel: false,
    audit: false,
    recommendationToQuote: false,
    receipts: false,
    providerCosts: false,
    polling: false,
    uploads: false,
    restorations: false,
  });

  for (const section of [
    'funnel',
    'audit',
    'recommendationToQuote',
    'receipts',
    'providerCosts',
    'polling',
    'uploads',
    'restorations',
  ] as const) {
    assert.equal(metrics.availability[section].status, 'unavailable', section);
    assert.match(metrics.availability[section].reason ?? '', /producer/i, section);
  }
  assert.equal(metrics.funnel, null);
  assert.equal(metrics.errors, null);
  assert.equal(metrics.recommendationToQuoteRate, null);
  assert.equal(metrics.revenueCents, null);
  assert.equal(metrics.providerCostCents, null);
  assert.equal(harness.calls.length, 1, 'only the prerequisite query may run without live producers');
});

test('a failed recommendation cohort query is unavailable rather than an empty cohort', async () => {
  const metrics = await loadHarnessMetrics(createMetricsHarness({ failRecommendation: true }));

  assert.equal(metrics.recommendationToQuoteRate, null);
  assert.equal(metrics.availability.recommendationToQuote.status, 'unavailable');
  assert.match(metrics.availability.recommendationToQuote.reason ?? '', /query failed/i);
});

test('partial provider accounting and non-normalized receipt currencies stay unavailable', async () => {
  const partialCosts = await loadHarnessMetrics(createMetricsHarness({ missingProviderCosts: 1 }));
  assert.equal(partialCosts.availability.providerCosts.status, 'unavailable');
  assert.match(partialCosts.availability.providerCosts.reason ?? '', /missing|partial/i);
  assert.equal(partialCosts.providerCostCents, null);
  assert.equal(partialCosts.trialCostCents, null);

  const nonNormalizedReceipts = await loadHarnessMetrics(createMetricsHarness({ nonUsdReceipts: 1 }));
  assert.equal(nonNormalizedReceipts.availability.receipts.status, 'unavailable');
  assert.equal(nonNormalizedReceipts.revenueCents, null);
  assert.equal(nonNormalizedReceipts.refundsCents, null);
  assert.equal(nonNormalizedReceipts.refundRate, null);
});

test('all reporting queries are parameterized UTC [from,to) aggregates and exclude private payload columns', async () => {
  const harness = createMetricsHarness();
  await loadHarnessMetrics(harness);

  const metricCalls = harness.calls.filter((call) => !call.sql.includes('admin-mcp:relations'));
  assert.ok(metricCalls.length >= 5);
  for (const call of metricCalls) {
    assert.match(call.sql, /\$1/);
    assert.match(call.sql, /\$2/);
    assert.deepEqual(call.params?.slice(0, 2), [RANGE.from, RANGE.to]);
  }
  const sql = metricCalls.map((call) => call.sql).join('\n');
  assert.doesNotMatch(
    sql,
    /\b(prompt|email|access_token|raw_url|reference_url|private_media|payment_method|stripe_payment_intent_id|request_snapshot|response_snapshot)\b/i,
  );
  assert.doesNotMatch(sql, /SELECT\s+(?:\w+\.)?user_id\b/i, 'queries must return aggregates, not identities');
  const receiptCall = metricCalls.find((call) => call.sql.includes('admin-mcp:receipts'));
  assert.match(receiptCall?.sql ?? '', /event_type\s*=\s*'paid_generation_accepted'/, 'refund rate and revenue use the accepted paid-job cohort');
  assert.match(receiptCall?.sql ?? '', /receipt\.created_at\s*>=\s*\$1[\s\S]*receipt\.created_at\s*<\s*\$2/i);
  assert.doesNotMatch(receiptCall?.sql ?? '', /mcp_funnel_events[\s\S]*occurred_at\s*>=\s*\$1/i, 'MCP job provenance is range-independent');

  const providerCall = metricCalls.find((call) => call.sql.includes('admin-mcp:provider-costs'));
  assert.match(providerCall?.sql ?? '', /attempt\.created_at\s*>=\s*\$1[\s\S]*attempt\.created_at\s*<\s*\$2/i);
  assert.doesNotMatch(providerCall?.sql ?? '', /COALESCE\(attempt\.provider_cost_usd,\s*0\)/i);

  const auditSql = metricCalls
    .filter((call) => call.sql.includes('mcp_audit_events'))
    .map((call) => call.sql)
    .join('\n');
  assert.match(auditSql, /event_type\s*=\s*'tool_call'/i);
});

test('evaluates all configured MCP alert classes and routes them only through injected operations channels', async () => {
  const metrics = await loadHarnessMetrics();
  const thresholds: McpOperationsAlertThresholds = {
    trialVolumeMax: 4,
    providerCostCentsMax: 400,
    quoteConfirmationRateMin: 0.6,
    authErrorsMax: 2,
    pollingCallsPerMinuteMax: 0.001,
    uploadFailuresMax: 1,
    refundRestorationFailuresMax: 0,
  };
  const alerts = evaluateMcpOperationsAlerts({ ...metrics, authErrors: 3 }, thresholds);

  assert.deepEqual(alerts.map((alert) => alert.code).sort(), [
    'auth_errors',
    'polling_rate',
    'provider_cost',
    'quote_confirmation_rate',
    'refund_restoration_failures',
    'trial_volume',
    'upload_failures',
  ]);

  const delivered: string[] = [];
  const delivery = await routeMcpOperationsAlerts(alerts, [
    { id: 'admin_audit', publish: async (alert) => { delivered.push(`audit:${alert.code}`); } },
    { id: 'slack', publish: async (alert) => { delivered.push(`slack:${alert.code}`); } },
  ]);

  assert.equal(delivery.attempted, alerts.length * 2);
  assert.equal(delivery.delivered, alerts.length * 2);
  assert.equal(delivery.failed, 0);
  assert.equal(delivered.length, alerts.length * 2);
  assert.deepEqual(evaluateMcpOperationsAlerts(metrics, {}), []);
});

test('invalid ranges are rejected before any database query', async () => {
  const harness = createMetricsHarness();
  await assert.rejects(
    () => loadAdminMcpMetrics({ ...RANGE, to: RANGE.from }, {
      executor: harness.executor,
      isDatabaseConfigured: () => true,
      featureFlags: FLAGS,
      alertThresholds: {},
    }),
    /range/i,
  );
  assert.equal(harness.calls.length, 0);
});
