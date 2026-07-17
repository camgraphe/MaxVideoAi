import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import type { QueryExecutor } from '../frontend/src/lib/db';
import {
  createTrialEntitlementReconciler,
  resolveTrialReconciliationConfig,
} from '../frontend/src/server/agent-api/reconcile-trial-entitlements';

const RECONCILIATION_OWNER =
  'frontend/src/server/agent-api/reconcile-trial-entitlements.ts';
const CRON_ROUTE = 'frontend/app/api/cron/mcp-trial-reconcile/route.ts';
const CRON_OWNER = 'frontend/server/mcp-trial-reconcile-cron.ts';
const ADMIN_TRIAL_OWNER = 'frontend/server/admin-mcp-trial-operations.ts';
const ADMIN_TRIAL_CONTROLS =
  'frontend/app/(core)/admin/mcp/_components/McpTrialControls.tsx';

test('trial reconciliation has a dedicated bounded server owner', () => {
  const source = existsSync(RECONCILIATION_OWNER)
    ? readFileSync(RECONCILIATION_OWNER, 'utf8')
    : '';

  assert.match(source, /export async function reconcileTrialEntitlements/);
  assert.match(source, /status = 'reserved'/);
  assert.match(source, /reserved_at < clock_timestamp\(\) - \(\$1 \* INTERVAL '1 minute'\)/);
  assert.match(source, /LIMIT \$2/);
});

type Candidate = {
  job_id: string;
  classification:
    | 'completed'
    | 'definitive_failure'
    | 'canceled'
    | 'active'
    | 'missing_job'
    | 'ambiguous';
};

function reconciliationHarness(candidates: Candidate[], options: {
  relations?: { mcp_trial_entitlements: boolean; app_jobs: boolean; mcp_generation_quotes: boolean };
  outcomeErrorJobId?: string;
} = {}) {
  const calls: Array<{ sql: string; params?: ReadonlyArray<unknown> }> = [];
  const outcomes: Array<{ jobId: string; kind: string }> = [];
  const executor: QueryExecutor = {
    async query<T>(sql: string, params?: ReadonlyArray<unknown>): Promise<T[]> {
      calls.push({ sql, params });
      if (/to_regclass/i.test(sql)) {
        return [{
          mcp_trial_entitlements: true,
          app_jobs: true,
          mcp_generation_quotes: true,
          ...options.relations,
        }] as T[];
      }
      return candidates as T[];
    },
  };
  const reconcile = createTrialEntitlementReconciler({
    executor,
    now: (() => {
      let now = 1_000;
      return () => {
        now += 25;
        return now;
      };
    })(),
    applyOutcome: async (jobId, outcome) => {
      outcomes.push({ jobId, kind: outcome.kind });
      if (jobId === options.outcomeErrorJobId) throw new Error('classification raced');
      return {
        funding: 'included_trial' as const,
        entitlementState: outcome.kind === 'completed' ? 'consumed' as const : 'released' as const,
      };
    },
  });
  return { calls, outcomes, reconcile };
}

test('reconciliation inspects one bounded stale-reservation batch and uses the central outcome owner', async () => {
  const fixture = reconciliationHarness([
    { job_id: 'job-completed', classification: 'completed' },
    { job_id: 'job-failed', classification: 'definitive_failure' },
    { job_id: 'job-canceled', classification: 'canceled' },
    { job_id: 'job-active', classification: 'active' },
    { job_id: 'job-missing', classification: 'missing_job' },
    { job_id: 'job-ambiguous', classification: 'ambiguous' },
  ]);

  const result = await fixture.reconcile({ staleMinutes: 30, batchLimit: 50 });

  assert.deepEqual(fixture.outcomes, [
    { jobId: 'job-completed', kind: 'completed' },
    { jobId: 'job-failed', kind: 'failed' },
    { jobId: 'job-canceled', kind: 'canceled' },
  ]);
  assert.deepEqual(result, {
    availability: 'available',
    reasonCode: 'batch_processed',
    counts: {
      scanned: 6,
      consumed: 1,
      released: 2,
      retainedActive: 1,
      quarantinedMissingJob: 1,
      quarantinedAmbiguous: 1,
      transitionDeferred: 0,
    },
    batch: { staleMinutes: 30, batchLimit: 50 },
    durationMs: 25,
  });
  const candidateQuery = fixture.calls.find(({ sql }) => /FROM mcp_trial_entitlements/i.test(sql));
  assert.deepEqual(candidateQuery?.params, [30, 50]);
  assert.doesNotMatch(JSON.stringify(result), /job-completed|job-missing|user|prompt|video|oauth|fingerprint/i);
});

test('active, missing, ambiguous, and raced candidates stay reserved for coarse quarantine', async () => {
  const fixture = reconciliationHarness([
    { job_id: 'race-job', classification: 'completed' },
    { job_id: 'active-job', classification: 'active' },
    { job_id: 'missing-job', classification: 'missing_job' },
    { job_id: 'ambiguous-job', classification: 'ambiguous' },
  ], { outcomeErrorJobId: 'race-job' });

  const result = await fixture.reconcile({ staleMinutes: 30, batchLimit: 10 });

  assert.deepEqual(result.counts, {
    scanned: 4,
    consumed: 0,
    released: 0,
    retainedActive: 1,
    quarantinedMissingJob: 1,
    quarantinedAmbiguous: 1,
    transitionDeferred: 1,
  });
});

test('missing reconciliation tables are explicitly unavailable and never synthesize zero metrics', async () => {
  const fixture = reconciliationHarness([], {
    relations: { mcp_trial_entitlements: false, app_jobs: true, mcp_generation_quotes: true },
  });

  const result = await fixture.reconcile({ staleMinutes: 30, batchLimit: 50 });

  assert.deepEqual(result, {
    availability: 'unavailable',
    reasonCode: 'schema_unavailable',
    counts: null,
    batch: { staleMinutes: 30, batchLimit: 50 },
    durationMs: 25,
  });
  assert.equal(fixture.outcomes.length, 0);
  assert.equal(fixture.calls.length, 1);
});

test('reconciliation configuration is server-owned, exact, and bounded', () => {
  assert.deepEqual(resolveTrialReconciliationConfig({}), {
    staleMinutes: 30,
    batchLimit: 50,
  });
  assert.deepEqual(resolveTrialReconciliationConfig({
    MCP_TRIAL_RECONCILE_STALE_MINUTES: '60',
    MCP_TRIAL_RECONCILE_BATCH_LIMIT: '25',
  }), { staleMinutes: 60, batchLimit: 25 });
  for (const env of [
    { MCP_TRIAL_RECONCILE_STALE_MINUTES: '14' },
    { MCP_TRIAL_RECONCILE_STALE_MINUTES: '30.5' },
    { MCP_TRIAL_RECONCILE_BATCH_LIMIT: '0' },
    { MCP_TRIAL_RECONCILE_BATCH_LIMIT: '101' },
  ]) {
    assert.throws(() => resolveTrialReconciliationConfig(env), /configuration/i);
  }
});

test('trial reconciliation cron has one fail-closed authenticated GET and POST handler', () => {
  const source = existsSync(CRON_ROUTE) ? readFileSync(CRON_ROUTE, 'utf8') : '';
  const owner = existsSync(CRON_OWNER) ? readFileSync(CRON_OWNER, 'utf8') : '';

  assert.match(owner, /authorizeCronRequest/);
  assert.match(source, /MCP_TRIAL_RECONCILE_TOKEN/);
  assert.match(owner, /x-mcp-trial-reconcile-token/);
  assert.match(source, /export \{ handleTrialReconciliation as GET, handleTrialReconciliation as POST \}/);
  assert.doesNotMatch(source, /export function createTrialReconciliationCronHandler/);
  assert.match(owner, /export function createTrialReconciliationCronHandler/);
  assert.doesNotMatch(source, /user-agent|x-vercel-deployment-id|jobId|userId|prompt|videoUrl/);
});

test('cron rejects missing credentials and accepts only the explicit local override token', async () => {
  const owner = await import('../frontend/server/mcp-trial-reconcile-cron');
  const factory = (owner as unknown as {
    createTrialReconciliationCronHandler?: (dependencies: Record<string, unknown>) =>
      (request: Request) => Promise<Response>;
  }).createTrialReconciliationCronHandler;
  assert.equal(typeof factory, 'function');
  if (!factory) return;

  let reconciliationCalls = 0;
  const logs: unknown[] = [];
  const result = {
    availability: 'available' as const,
    reasonCode: 'batch_processed' as const,
    counts: {
      scanned: 1,
      consumed: 0,
      released: 0,
      retainedActive: 1,
      quarantinedMissingJob: 0,
      quarantinedAmbiguous: 0,
      transitionDeferred: 0,
    },
    batch: { staleMinutes: 30, batchLimit: 50 },
    durationMs: 7,
  };
  const handler = factory({
    env: {
      CRON_SECRET: '',
      MCP_TRIAL_RECONCILE_TOKEN: 'local-secret',
      VERCEL: '',
    },
    reconcile: async () => {
      reconciliationCalls += 1;
      return result;
    },
    log: (value: unknown) => { logs.push(value); },
  });

  const denied = await handler(new Request('http://localhost/api/cron/mcp-trial-reconcile'));
  assert.equal(denied.status, 401);
  assert.deepEqual(await denied.json(), { ok: false, error: 'UNAUTHORIZED' });
  assert.equal(reconciliationCalls, 0);

  const accepted = await handler(new Request('http://localhost/api/cron/mcp-trial-reconcile', {
    headers: { 'x-mcp-trial-reconcile-token': 'local-secret' },
  }));
  assert.equal(accepted.status, 200);
  assert.deepEqual(await accepted.json(), { ok: true, ...result });
  assert.equal(reconciliationCalls, 1);
  assert.doesNotMatch(
    JSON.stringify(logs),
    /local-secret|localhost|authorization|user-agent|jobId|userId|prompt|videoUrl/i,
  );
});

test('admin trial operations have a dedicated atomic server owner and server-only controls', () => {
  const owner = existsSync(ADMIN_TRIAL_OWNER) ? readFileSync(ADMIN_TRIAL_OWNER, 'utf8') : '';
  const controls = existsSync(ADMIN_TRIAL_CONTROLS)
    ? readFileSync(ADMIN_TRIAL_CONTROLS, 'utf8')
    : '';
  const page = readFileSync('frontend/app/(core)/admin/mcp/page.tsx', 'utf8');

  assert.match(owner, /createTrialSupportOverrideService/);
  assert.match(owner, /withDbTransaction/);
  assert.match(owner, /INSERT INTO admin_audit/);
  assert.match(owner, /mcp_trial_manual_release/);
  assert.doesNotMatch(owner, /logAdminAction/);
  assert.match(controls, /'use server'/);
  assert.match(controls, /requireAdmin/);
  assert.match(controls, /assertSameOrigin/);
  assert.match(controls, /Accepted|Reserved/);
  assert.match(controls, /Consumed|Completed/);
  assert.match(controls, /Released/);
  assert.match(controls, /Provider cost/);
  assert.match(controls, /Suspicious velocity/);
  assert.doesNotMatch(controls, /fingerprint|oauth_client_id|video_url|pricing_snapshot/i);
  assert.match(page, /McpTrialControls/);
});

const ADMIN_ID = '00000000-0000-4000-8000-000000000801';
const INSPECTED_USER_ID = '00000000-0000-4000-8000-000000000802';
const INSPECTED_JOB_ID = '00000000-0000-4000-8000-000000000803';

async function loadAdminOperationsFactory() {
  const module = await import('../frontend/server/admin-mcp-trial-operations');
  const factory = (module as unknown as {
    createAdminMcpTrialOperationsService?: (dependencies: Record<string, unknown>) => {
      load(input: Record<string, unknown>): Promise<unknown>;
      manualRelease(input: Record<string, unknown>): Promise<unknown>;
    };
  }).createAdminMcpTrialOperationsService;
  assert.equal(typeof factory, 'function');
  return factory;
}

test('admin reads exact bounded trial metrics and one privacy-safe user inspection', async () => {
  const factory = await loadAdminOperationsFactory();
  if (!factory) return;
  const calls: string[] = [];
  const service = factory({
    isDatabaseConfigured: () => true,
    checkedInFlags: { trial: false },
    env: { MCP_TRIAL_ENABLED: 'true' },
    executor: {
      query: async (sql: string) => {
        calls.push(sql);
        if (/admin-mcp-trial:relations/.test(sql)) {
          return [{
            mcp_trial_entitlements: true,
            mcp_generation_quotes: true,
            mcp_trial_risk_events: true,
            mcp_trial_support_override_audit: true,
            admin_audit: true,
            app_jobs: true,
            provider_attempts: true,
          }];
        }
        if (/admin-mcp-trial:summary/.test(sql)) {
          return [{
            accepted_count: '3',
            reserved_count: '2',
            consumed_count: '1',
            released_count: '4',
            provider_cost_cents: '1234',
            suspicious_velocity_count: '7',
          }];
        }
        if (/admin-mcp-trial:inspection/.test(sql)) {
          return [{
            user_id: INSPECTED_USER_ID,
            entitlement_state: 'reserved',
            job_id: INSPECTED_JOB_ID,
            quote_state: 'accepted',
            job_state: 'running',
            output_present: false,
            reserved_at: '2026-07-17T10:00:00.000Z',
          }];
        }
        return [];
      },
    },
  });

  const result = await service.load({ inspectionUserId: INSPECTED_USER_ID });

  assert.deepEqual(result, {
    availability: 'available',
    reasonCode: 'loaded',
    killSwitch: { checkedIn: false, runtime: true, effective: false },
    counts: { accepted: 3, reserved: 2, consumed: 1, released: 4 },
    providerCostCents: 1234,
    suspiciousVelocity: 7,
    inspection: {
      userId: INSPECTED_USER_ID,
      entitlementState: 'reserved',
      jobId: INSPECTED_JOB_ID,
      quoteState: 'accepted',
      jobState: 'running',
      outputPresent: false,
      reservedAt: '2026-07-17T10:00:00.000Z',
    },
  });
  assert.equal(calls.length, 3);
  assert.doesNotMatch(JSON.stringify(result), /fingerprint|oauthClient|prompt|videoUrl|pricingSnapshot/i);
});

test('admin reads expose missing schema as unavailable, not synthetic zeroes', async () => {
  const factory = await loadAdminOperationsFactory();
  if (!factory) return;
  const service = factory({
    isDatabaseConfigured: () => true,
    checkedInFlags: { trial: false },
    env: { MCP_TRIAL_ENABLED: 'false' },
    executor: {
      query: async () => [{
        mcp_trial_entitlements: true,
        mcp_generation_quotes: true,
        mcp_trial_risk_events: true,
        mcp_trial_support_override_audit: false,
        admin_audit: true,
        app_jobs: true,
        provider_attempts: true,
      }],
    },
  });

  assert.deepEqual(await service.load({ inspectionUserId: null }), {
    availability: 'unavailable',
    reasonCode: 'schema_unavailable',
    killSwitch: { checkedIn: false, runtime: false, effective: false },
    counts: null,
    providerCostCents: null,
    suspiciousVelocity: null,
    inspection: null,
  });
});

test('manual release refuses terminal state and rolls release back when admin audit fails', async () => {
  const factory = await loadAdminOperationsFactory();
  if (!factory) return;
  const events: string[] = [];
  let entitlementState: 'reserved' | 'consumed' = 'consumed';
  let supportCalls = 0;
  const executor = {
    query: async (sql: string) => {
      if (/admin-mcp-trial:manual-preflight/.test(sql)) {
        events.push('preflight');
        return [{
          user_id: INSPECTED_USER_ID,
          entitlement_state: entitlementState,
          job_id: INSPECTED_JOB_ID,
          reserved_quote_id: INSPECTED_JOB_ID,
          job_user_id: INSPECTED_USER_ID,
          payment_status: 'included_mcp_trial',
          job_state: entitlementState === 'reserved' ? 'running' : 'completed',
          output_present: entitlementState === 'consumed',
          quote_id: INSPECTED_JOB_ID,
          quote_user_id: INSPECTED_USER_ID,
          quote_job_id: INSPECTED_JOB_ID,
          funding_mode: 'trial',
          quote_state: entitlementState === 'reserved' ? 'accepted' : 'accepted',
        }];
      }
      if (/INSERT INTO admin_audit/.test(sql)) {
        events.push('admin-audit');
        throw new Error('admin audit unavailable');
      }
      return [];
    },
  };
  const service = factory({
    isDatabaseConfigured: () => true,
    checkedInFlags: { trial: false },
    env: {},
    executor,
    withTransaction: async (callback: (transaction: unknown) => Promise<unknown>) => {
      events.push('begin');
      try {
        const result = await callback(executor);
        events.push('commit');
        return result;
      } catch (error) {
        events.push('rollback');
        throw error;
      }
    },
    applySupportOverride: async (_transaction: unknown, _jobId: string, override: { reason: string }) => {
      supportCalls += 1;
      events.push(`support:${override.reason}`);
      entitlementState = 'reserved';
      return { funding: 'included_trial', entitlementState: 'released' };
    },
  });
  const input = {
    adminId: ADMIN_ID,
    userId: INSPECTED_USER_ID,
    jobId: INSPECTED_JOB_ID,
    reason: 'support_verified_no_output',
  };

  await assert.rejects(service.manualRelease(input), /must be reserved/i);
  assert.equal(supportCalls, 0);

  entitlementState = 'reserved';
  events.length = 0;
  await assert.rejects(service.manualRelease(input), /admin audit unavailable/i);
  assert.deepEqual(events, [
    'begin',
    'preflight',
    'support:support_verified_no_output',
    'admin-audit',
    'rollback',
  ]);
});

test('admin manual release action accepts exact same-origin form input only', async () => {
  const module = await import(
    '../frontend/app/(core)/admin/mcp/_components/McpTrialControls'
  );
  const helpers = module as unknown as {
    assertSameOrigin?: (headers: Headers) => void;
    normalizeManualReleaseFormData?: (formData: FormData) => Record<string, unknown>;
  };
  assert.equal(typeof helpers.assertSameOrigin, 'function');
  assert.equal(typeof helpers.normalizeManualReleaseFormData, 'function');
  if (!helpers.assertSameOrigin || !helpers.normalizeManualReleaseFormData) return;

  assert.doesNotThrow(() => helpers.assertSameOrigin!(new Headers({
    host: 'maxvideoai.com',
    origin: 'https://maxvideoai.com',
  })));
  assert.throws(() => helpers.assertSameOrigin!(new Headers({
    host: 'maxvideoai.com',
    origin: 'https://attacker.example',
  })), /origin/i);
  assert.throws(
    () => helpers.assertSameOrigin!(new Headers({ host: 'maxvideoai.com' })),
    /origin/i,
  );

  const formData = new FormData();
  formData.set('userId', INSPECTED_USER_ID);
  formData.set('jobId', INSPECTED_JOB_ID);
  formData.set('reason', 'support_verified_no_output');
  assert.deepEqual(helpers.normalizeManualReleaseFormData(formData), {
    userId: INSPECTED_USER_ID,
    jobId: INSPECTED_JOB_ID,
    reason: 'support_verified_no_output',
  });
  formData.set('unexpected', 'value');
  assert.throws(() => helpers.normalizeManualReleaseFormData!(formData), /input/i);
});

test('reconciliation schedule and operations runbook keep launch disabled and document safe recovery', () => {
  const vercel = JSON.parse(readFileSync('frontend/vercel.json', 'utf8')) as {
    crons?: Array<{ path?: string; schedule?: string }>;
  };
  const scheduled = vercel.crons?.find(({ path }) => path === '/api/cron/mcp-trial-reconcile');
  assert.deepEqual(scheduled, {
    path: '/api/cron/mcp-trial-reconcile',
    schedule: '*/10 * * * *',
  });

  const runbookPath = 'docs/operations/mcp-trial-runbook.md';
  const runbook = existsSync(runbookPath) ? readFileSync(runbookPath, 'utf8') : '';
  for (const required of [
    'MCP_TRIAL_ENABLED',
    'MCP_TRIAL_RECONCILE_TOKEN',
    'MCP_TRIAL_RECONCILE_STALE_MINUTES',
    'MCP_TRIAL_RECONCILE_BATCH_LIMIT',
    'CRON_SECRET',
    '30 minutes',
    '50',
    '100',
    'completed',
    'missing job',
    'immutable support audit',
    'admin_audit',
    '30 days',
    'No wallet credit was used',
    'not live',
  ]) {
    assert.match(runbook, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  }
  assert.match(runbook, /prompt|media URL|IP|user-agent|fingerprint|OAuth client/i);

  const publication = JSON.parse(readFileSync('frontend/config/mcp-publication.json', 'utf8')) as Record<string, unknown>;
  assert.equal(Object.keys(publication).length, 8);
  assert.equal(Object.values(publication).every((value) => value === false), true);
});
