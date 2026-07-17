import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import type { QueryExecutor } from '../frontend/src/lib/db';
import { cleanupTrialRiskEvents } from '../frontend/src/server/agent-api/trial-risk-repository';
import {
  createTrialEntitlementReconciler,
  resolveTrialReconciliationConfig,
} from '../frontend/src/server/agent-api/reconcile-trial-entitlements';
import { persistFinalVideoJobUpdate } from '../frontend/app/api/generate/_lib/final-job-persistence';
import {
  createPaidGenerationTestSchema,
  missingDisposablePostgresCommand,
  startDisposablePostgres,
} from './helpers/disposable-postgres';

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

function persistedCandidate(candidate: Candidate) {
  const userId = `user-${candidate.job_id}`;
  const missing = candidate.classification === 'missing_job';
  const evidence = candidate.classification === 'completed'
    ? { job_status: 'completed', video_url: 'https://media.maxvideoai.com/trial.mp4', trial_disposition: 'completed' }
    : candidate.classification === 'definitive_failure'
      ? { job_status: 'failed', video_url: null, trial_disposition: 'definitive_failure' }
      : candidate.classification === 'canceled'
        ? { job_status: 'canceled', video_url: null, trial_disposition: 'canceled' }
        : candidate.classification === 'active'
          ? { job_status: 'running', video_url: null, trial_disposition: 'accepted' }
          : { job_status: 'failed', video_url: null, trial_disposition: 'unknown' };
  return {
    job_id: candidate.job_id,
    entitlement_user_id: userId,
    reserved_quote_id: candidate.job_id,
    persisted_job_id: missing ? null : candidate.job_id,
    job_user_id: missing ? null : userId,
    payment_status: missing ? null : 'included_mcp_trial',
    job_status: missing ? null : evidence.job_status,
    video_url: missing ? null : evidence.video_url,
    trial_disposition: missing ? null : evidence.trial_disposition,
    quote_id: candidate.job_id,
    quote_job_id: candidate.job_id,
    quote_user_id: userId,
    funding_mode: 'trial',
    quote_state: 'accepted',
  };
}

function reconciliationHarness(candidates: Candidate[], options: {
  relations?: {
    mcp_trial_entitlements: boolean;
    app_jobs: boolean;
    mcp_generation_quotes: boolean;
    mcp_trial_outcome_disposition: boolean;
  };
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
          mcp_trial_outcome_disposition: true,
          ...options.relations,
        }] as T[];
      }
      return candidates.map(persistedCandidate) as T[];
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

test('failed app status never releases without durable definitive-failure evidence', async () => {
  const module = await import(
    '../frontend/src/server/agent-api/reconcile-trial-entitlements'
  );
  const classify = (module as unknown as {
    classifyTrialJobEvidence?: (input: {
      jobStatus: string;
      videoUrl: string | null;
      trialDisposition: string | null;
    }) => string;
  }).classifyTrialJobEvidence;

  assert.equal(typeof classify, 'function');
  if (!classify) return;
  for (const trialDisposition of [null, 'unknown', 'timeout', 'stalled']) {
    assert.equal(classify({
      jobStatus: 'failed',
      videoUrl: null,
      trialDisposition,
    }), 'ambiguous');
  }
  assert.equal(classify({
    jobStatus: 'failed',
    videoUrl: null,
    trialDisposition: 'definitive_failure',
  }), 'definitive_failure');
});

test('usable trial output requires credential-free whitespace-free HTTPS', async () => {
  const module = await import(
    '../frontend/src/server/agent-api/trial-output-evidence'
  ).catch(() => ({}));
  const isUsable = (module as {
    isUsableTrialOutputUrl?: (value: unknown) => boolean;
  }).isUsableTrialOutputUrl;
  assert.equal(typeof isUsable, 'function');
  if (!isUsable) return;

  assert.equal(isUsable('https://media.maxvideoai.com/renders/trial.mp4'), true);
  for (const value of [
    'http://media.maxvideoai.com/renders/trial.mp4',
    'https://user:secret@media.maxvideoai.com/renders/trial.mp4',
    'https://media.maxvideoai.com/renders/trial video.mp4',
    'not-a-url',
    '',
    null,
  ]) {
    assert.equal(isUsable(value), false);
  }
});

test('real PostgreSQL classification quarantines unknown failed jobs and malformed completed media', async (t) => {
  const missing = missingDisposablePostgresCommand();
  if (missing) {
    t.skip(`${missing} is unavailable`);
    return;
  }
  const postgres = await startDisposablePostgres('mcp-t8-sql');
  t.after(() => postgres.cleanup());
  await postgres.pool.query(`
    CREATE TABLE app_jobs (
      job_id text PRIMARY KEY,
      user_id text NOT NULL,
      payment_status text NOT NULL,
      status text NOT NULL,
      video_url text,
      mcp_trial_outcome_disposition text
    );
    CREATE TABLE mcp_generation_quotes (
      quote_id uuid PRIMARY KEY,
      user_id text NOT NULL,
      job_id text NOT NULL,
      funding_mode text NOT NULL,
      state text NOT NULL
    );
    CREATE TABLE mcp_trial_entitlements (
      user_id text PRIMARY KEY,
      status text NOT NULL,
      reserved_quote_id uuid NOT NULL,
      job_id text NOT NULL,
      reserved_at timestamptz NOT NULL
    );
  `);
  const unknownJob = '90000000-0000-4000-8000-000000000001';
  const malformedJob = '90000000-0000-4000-8000-000000000002';
  const timeoutJob = '90000000-0000-4000-8000-000000000003';
  const failedJob = '90000000-0000-4000-8000-000000000004';
  const completedJob = '90000000-0000-4000-8000-000000000005';
  for (const [jobId, userId, status, videoUrl, disposition] of [
    [unknownJob, 'sql-unknown-user', 'failed', null, 'unknown'],
    [malformedJob, 'sql-malformed-user', 'completed', 'not-a-url', 'completed'],
    [timeoutJob, 'sql-timeout-user', 'failed', null, 'timeout'],
    [failedJob, 'sql-failed-user', 'failed', null, 'definitive_failure'],
    [completedJob, 'sql-completed-user', 'completed', 'https://media.maxvideoai.com/sql.mp4', 'completed'],
  ] as const) {
    await postgres.pool.query(
      `INSERT INTO app_jobs (
         job_id, user_id, payment_status, status, video_url, mcp_trial_outcome_disposition
       ) VALUES ($1, $2, 'included_mcp_trial', $3, $4, $5)`,
      [jobId, userId, status, videoUrl, disposition],
    );
    await postgres.pool.query(
      `INSERT INTO mcp_generation_quotes (
         quote_id, user_id, job_id, funding_mode, state
       ) VALUES ($1::uuid, $2, $1, 'trial', 'accepted')`,
      [jobId, userId],
    );
    await postgres.pool.query(
      `INSERT INTO mcp_trial_entitlements (
         user_id, status, reserved_quote_id, job_id, reserved_at
       ) VALUES ($2, 'reserved', $1::uuid, $1, clock_timestamp() - INTERVAL '2 hours')`,
      [jobId, userId],
    );
  }
  const outcomes: Array<{ jobId: string; kind: string }> = [];
  const reconcile = createTrialEntitlementReconciler({
    executor: {
      query: async <T>(sql: string, params?: ReadonlyArray<unknown>) => (
        await postgres.pool.query<T>(sql, params as unknown[] | undefined)
      ).rows,
    },
    now: Date.now,
    applyOutcome: async (jobId, outcome) => {
      outcomes.push({ jobId, kind: outcome.kind });
      return {
        funding: 'included_trial',
        entitlementState: outcome.kind === 'completed' ? 'consumed' : 'released',
      };
    },
  });

  const result = await reconcile({ staleMinutes: 30, batchLimit: 10 });
  assert.deepEqual(outcomes, [
    { jobId: failedJob, kind: 'failed' },
    { jobId: completedJob, kind: 'completed' },
  ]);
  assert.equal(result.counts?.released, 1);
  assert.equal(result.counts?.consumed, 1);
  assert.equal(result.counts?.quarantinedAmbiguous, 3);
});

test('migrated PostgreSQL persists trial dispositions and deletes only a bounded pre-cutoff risk batch', async (t) => {
  const missing = missingDisposablePostgresCommand();
  if (missing) {
    t.skip(`${missing} is unavailable`);
    return;
  }
  const postgres = await startDisposablePostgres('mcp-t8-proof');
  t.after(() => postgres.cleanup());
  await createPaidGenerationTestSchema(postgres.pool);
  await postgres.pool.query(readFileSync('neon/migrations/31_mcp_trial_entitlements.sql', 'utf8'));

  const jobId = '91000000-0000-4000-8000-000000000001';
  await postgres.pool.query(
    `INSERT INTO app_jobs (job_id, user_id, payment_status, status, progress)
     VALUES ($1, 'persisted-disposition-user', 'included_mcp_trial', 'running', 10)`,
    [jobId],
  );
  const seenOutcomes: string[] = [];
  const persistenceBase = {
    jobId,
    thumb: null,
    aspectRatio: '16:9',
    previewFrame: null,
    etaSeconds: null,
    etaLabel: null,
    providerJobId: 'provider-job',
    finalPriceCents: 0,
    pricingSnapshotJson: '{}',
    costBreakdownJson: null,
    currency: 'USD',
    vendorAccountId: null,
    paymentStatus: 'included_mcp_trial',
    stripePaymentIntentId: null,
    stripeChargeId: null,
    visibility: 'private' as const,
    indexable: false,
    message: null,
    settingsSnapshotJson: '{}',
    queryFn: async (sql: string, params?: unknown[]) => postgres.pool.query(sql, params),
    applyTrialOutcomeFn: async (_persistedJobId: string, outcome: { kind: string }) => {
      seenOutcomes.push(outcome.kind);
      return { funding: 'included_trial' as const, entitlementState: 'reserved' as const };
    },
  };
  await persistFinalVideoJobUpdate({
    ...persistenceBase, video: null, status: 'failed', progress: 0,
  });
  assert.deepEqual((await postgres.pool.query(
    `SELECT status, mcp_trial_outcome_disposition AS disposition
       FROM app_jobs WHERE job_id = $1`, [jobId],
  )).rows, [{ status: 'failed', disposition: 'unknown' }]);
  await persistFinalVideoJobUpdate({
    ...persistenceBase,
    video: 'https://media.maxvideoai.com/migrated-proof.mp4',
    status: 'completed',
    progress: 100,
  });
  assert.deepEqual((await postgres.pool.query(
    `SELECT status, mcp_trial_outcome_disposition AS disposition
       FROM app_jobs WHERE job_id = $1`, [jobId],
  )).rows, [{ status: 'completed', disposition: 'completed' }]);
  assert.deepEqual(seenOutcomes, ['unknown', 'completed']);
  for (const disposition of ['timeout', 'definitive_failure']) {
    await postgres.pool.query(
      `UPDATE app_jobs SET mcp_trial_outcome_disposition = $2 WHERE job_id = $1`,
      [jobId, disposition],
    );
    assert.equal((await postgres.pool.query<{ disposition: string }>(
      `SELECT mcp_trial_outcome_disposition AS disposition FROM app_jobs WHERE job_id = $1`,
      [jobId],
    )).rows[0]?.disposition, disposition);
  }
  await assert.rejects(
    postgres.pool.query(
      `UPDATE app_jobs SET mcp_trial_outcome_disposition = 'provider_maybe' WHERE job_id = $1`,
      [jobId],
    ),
    /app_jobs_mcp_trial_outcome_disposition_allowlist/i,
  );

  const cutoff = new Date('2026-06-17T12:00:00.000Z');
  await postgres.pool.query(`SET session_replication_role = 'replica'`);
  try {
    for (const [userId, createdAt] of [
      ['risk-oldest', '2026-06-14T12:00:00.000Z'],
      ['risk-older', '2026-06-15T12:00:00.000Z'],
      ['risk-before-cutoff', '2026-06-17T11:59:59.999Z'],
      ['risk-at-cutoff', '2026-06-17T12:00:00.000Z'],
      ['risk-after-cutoff', '2026-06-17T12:00:00.001Z'],
    ]) {
      await postgres.pool.query(
        `INSERT INTO mcp_trial_risk_events (
           user_id, oauth_client_id, risk_fingerprint_hash, outcome,
           reason_code, provider_cost_cents, created_at
         ) OVERRIDING SYSTEM VALUE
         VALUES ($1, NULL, $2, 'allowed', 'accepted', 10, $3::timestamptz)`,
        [userId, 'a'.repeat(64), createdAt],
      );
    }
  } finally {
    await postgres.pool.query(`SET session_replication_role = 'origin'`);
  }
  const executor: QueryExecutor = {
    query: async <T>(sql: string, params?: ReadonlyArray<unknown>) => (
      await postgres.pool.query<T>(sql, params as unknown[] | undefined)
    ).rows,
  };
  assert.equal(await cleanupTrialRiskEvents({ cutoff, limit: 2 }, { executor }), 2);
  assert.deepEqual((await postgres.pool.query<{ user_id: string }>(
    `SELECT user_id FROM mcp_trial_risk_events ORDER BY created_at, id`,
  )).rows.map(({ user_id }) => user_id), [
    'risk-before-cutoff', 'risk-at-cutoff', 'risk-after-cutoff',
  ]);
  assert.equal(await cleanupTrialRiskEvents({ cutoff, limit: 100 }, { executor }), 1);
  assert.deepEqual((await postgres.pool.query<{ user_id: string }>(
    `SELECT user_id FROM mcp_trial_risk_events ORDER BY created_at, id`,
  )).rows.map(({ user_id }) => user_id), ['risk-at-cutoff', 'risk-after-cutoff']);
});

test('missing reconciliation tables are explicitly unavailable and never synthesize zero metrics', async () => {
  const fixture = reconciliationHarness([], {
    relations: {
      mcp_trial_entitlements: false,
      app_jobs: true,
      mcp_generation_quotes: true,
      mcp_trial_outcome_disposition: true,
    },
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
  let cleanupCalls = 0;
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
    now: () => new Date('2026-07-17T12:00:00.000Z'),
    cleanupRiskEvents: async (input: { cutoff: Date; limit: number }) => {
      cleanupCalls += 1;
      assert.equal(input.cutoff.toISOString(), '2026-06-17T12:00:00.000Z');
      assert.equal(input.limit, 1_000);
      return 7;
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
  assert.deepEqual(await accepted.json(), {
    ok: true,
    ...result,
    riskRetention: {
      availability: 'available',
      reasonCode: 'batch_processed',
      deleted: 7,
      batchLimit: 1_000,
    },
  });
  assert.equal(reconciliationCalls, 1);
  assert.equal(cleanupCalls, 1);
  assert.doesNotMatch(
    JSON.stringify(logs),
    /local-secret|localhost|authorization|user-agent|jobId|userId|prompt|videoUrl/i,
  );

  const unavailableHandler = factory({
    env: {
      CRON_SECRET: '',
      MCP_TRIAL_RECONCILE_TOKEN: 'local-secret',
      VERCEL: '',
    },
    reconcile: async () => result,
    now: () => new Date('2026-07-17T12:00:00.000Z'),
    cleanupRiskEvents: async () => {
      throw new Error('risk schema unavailable');
    },
    log: () => undefined,
  });
  const cleanupUnavailable = await unavailableHandler(new Request(
    'http://localhost/api/cron/mcp-trial-reconcile',
    { headers: { 'x-mcp-trial-reconcile-token': 'local-secret' } },
  ));
  assert.equal(cleanupUnavailable.status, 200);
  assert.deepEqual(await cleanupUnavailable.json(), {
    ok: true,
    ...result,
    riskRetention: {
      availability: 'unavailable',
      reasonCode: 'query_unavailable',
      deleted: null,
      batchLimit: 1_000,
    },
  });
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

test('admin inspection rejects malformed query input as an explicit unavailable state', async () => {
  const factory = await loadAdminOperationsFactory();
  if (!factory) return;
  const service = factory({
    isDatabaseConfigured: () => true,
    checkedInFlags: { trial: false },
    env: { MCP_TRIAL_ENABLED: 'false' },
    executor: {
      query: async () => assert.fail('invalid inspection input must not reach SQL'),
    },
  });

  assert.deepEqual(await service.load({ inspectionUserId: 'not-a-uuid' }), {
    availability: 'unavailable',
    reasonCode: 'invalid_input',
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
  assert.doesNotThrow(() => helpers.assertSameOrigin!(new Headers({
    host: 'localhost:3000',
    origin: 'http://localhost:3000',
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
