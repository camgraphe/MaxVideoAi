import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import type { TransactionQueryExecutor } from '../frontend/src/lib/db';
import {
  createTrialJobOutcomeService,
  createTrialSupportOverrideService,
} from '../frontend/src/server/agent-api/trial-outcomes';

const JOB_ID = '00000000-0000-4000-8000-000000000701';
const USER_ID = 'trial-user-7';

type TrialState = 'reserved' | 'consumed' | 'released';
type Call = { sql: string; params?: ReadonlyArray<unknown> };

function entitlement(state: TrialState) {
  return {
    userId: USER_ID,
    status: state,
    reservedQuoteId: JOB_ID,
    jobId: JOB_ID,
    reservedAt: new Date('2026-07-17T10:00:00Z'),
    consumedAt: state === 'consumed' ? new Date('2026-07-17T10:02:00Z') : null,
    releasedAt: state === 'released' ? new Date('2026-07-17T10:02:00Z') : null,
    createdAt: new Date('2026-07-17T09:59:00Z'),
    updatedAt: new Date('2026-07-17T10:02:00Z'),
    lastReasonCode: state === 'consumed' ? 'output_completed' : state === 'released' ? 'provider_failed' : 'trial_confirmed',
  } as const;
}

function harness(options: {
  paymentStatus?: string;
  jobStatus?: string;
  videoUrl?: string | null;
  entitlementState?: TrialState;
  quoteState?: 'claimed' | 'accepted' | 'failed';
} = {}) {
  const calls: Call[] = [];
  let state = options.entitlementState ?? 'reserved';
  let quoteState = options.quoteState ?? (state === 'released' ? 'failed' : 'accepted');
  let consumeCalls = 0;
  let releaseCalls = 0;
  const executor = {
    async query<T>(sql: string, params?: ReadonlyArray<unknown>): Promise<T[]> {
      calls.push({ sql, params });
      if (/FROM app_jobs/i.test(sql)) {
        return [{
          job_id: JOB_ID,
          user_id: USER_ID,
          payment_status: options.paymentStatus ?? 'included_mcp_trial',
          status: options.jobStatus ?? 'running',
          video_url: options.videoUrl ?? null,
        }] as T[];
      }
      if (/FROM mcp_generation_quotes/i.test(sql)) {
        return [{
          quote_id: JOB_ID,
          user_id: USER_ID,
          funding_mode: 'trial',
          job_id: JOB_ID,
          state: quoteState,
        }] as T[];
      }
      if (/FROM mcp_trial_entitlements/i.test(sql)) {
        return [{
          user_id: USER_ID,
          status: state,
          reserved_quote_id: JOB_ID,
          job_id: JOB_ID,
        }] as T[];
      }
      if (/UPDATE mcp_generation_quotes/i.test(sql)) {
        if (/state = 'accepted'/i.test(sql)) quoteState = 'accepted';
        if (/state = 'failed'/i.test(sql)) quoteState = 'failed';
        return [{ state: quoteState }] as T[];
      }
      return [] as T[];
    },
  } as TransactionQueryExecutor;
  return {
    calls,
    get state() { return state; },
    get consumeCalls() { return consumeCalls; },
    get releaseCalls() { return releaseCalls; },
    dependencies: {
      withTransaction: async <T>(callback: (tx: TransactionQueryExecutor) => Promise<T>) => callback(executor),
      consumeEntitlement: async () => {
        consumeCalls += 1;
        if (state === 'released') return null;
        state = 'consumed';
        return entitlement('consumed');
      },
      releaseEntitlement: async () => {
        releaseCalls += 1;
        if (state === 'consumed') return null;
        state = 'released';
        return entitlement('released');
      },
    },
  };
}

function applyOutcome(
  fixture: ReturnType<typeof harness>,
  outcome: Record<string, unknown>,
) {
  return createTrialJobOutcomeService(fixture.dependencies as never)(JOB_ID, outcome as never);
}

function applySupportOverride(
  fixture: ReturnType<typeof harness>,
  override: Record<string, unknown>,
) {
  return createTrialSupportOverrideService(fixture.dependencies as never)(JOB_ID, override as never);
}

test('accepted, timeout, and unknown outcomes keep an included trial reserved', async () => {
  for (const kind of ['accepted', 'timeout', 'unknown', 'stalled'] as const) {
    const fixture = harness();
    const result = await applyOutcome(fixture, { kind });
    assert.deepEqual(result, { funding: 'included_trial', entitlementState: 'reserved' });
    assert.equal(fixture.consumeCalls, 0);
    assert.equal(fixture.releaseCalls, 0);
  }
});

test('a durably completed output consumes exactly once and duplicate completion is idempotent', async () => {
  const fixture = harness({ jobStatus: 'completed', videoUrl: 'https://media.maxvideoai.com/trial.mp4' });
  assert.deepEqual(
    await applyOutcome(fixture, { kind: 'completed' }),
    { funding: 'included_trial', entitlementState: 'consumed' },
  );
  assert.deepEqual(
    await applyOutcome(fixture, { kind: 'completed' }),
    { funding: 'included_trial', entitlementState: 'consumed' },
  );
  assert.equal(fixture.consumeCalls, 1, 'duplicate completion must not repeat the terminal transition');
  assert.equal(fixture.releaseCalls, 0);
});

test('pre-acceptance rejection, terminal failure, and cancellation release before output', async () => {
  for (const kind of ['rejected', 'failed', 'canceled'] as const) {
    const fixture = harness({ jobStatus: kind === 'canceled' ? 'canceled' : 'failed' });
    const result = await applyOutcome(fixture, { kind });
    assert.deepEqual(result, { funding: 'included_trial', entitlementState: 'released' });
    assert.equal(fixture.consumeCalls, 0);
    assert.equal(fixture.releaseCalls, 1);
  }
});

test('late success after release and late failure after consume preserve the first terminal state', async () => {
  const released = harness({ entitlementState: 'released', jobStatus: 'completed', videoUrl: 'https://media.maxvideoai.com/late.mp4' });
  assert.deepEqual(
    await applyOutcome(released, { kind: 'completed' }),
    { funding: 'included_trial', entitlementState: 'released' },
  );
  const consumed = harness({
    entitlementState: 'consumed',
    jobStatus: 'failed',
    videoUrl: 'https://media.maxvideoai.com/consumed.mp4',
  });
  assert.deepEqual(
    await applyOutcome(consumed, { kind: 'failed' }),
    { funding: 'included_trial', entitlementState: 'consumed' },
  );
});

test('wallet jobs are a no-op before quote or entitlement access', async () => {
  const fixture = harness({ paymentStatus: 'paid_wallet', jobStatus: 'failed' });
  assert.deepEqual(
    await applyOutcome(fixture, { kind: 'failed' }),
    { funding: 'wallet' },
  );
  assert.equal(fixture.calls.filter(({ sql }) => /mcp_generation_quotes|mcp_trial_entitlements/i.test(sql)).length, 0);
  assert.equal(fixture.releaseCalls, 0);
});

test('completed cannot consume without a durable output and failures cannot release after output', async () => {
  const missingOutput = harness({ jobStatus: 'completed', videoUrl: null });
  await assert.rejects(
    applyOutcome(missingOutput, { kind: 'completed' }),
    /durable completed output/i,
  );
  assert.equal(missingOutput.consumeCalls, 0);
  const hasOutput = harness({ jobStatus: 'failed', videoUrl: 'https://media.maxvideoai.com/already.mp4' });
  await assert.rejects(
    applyOutcome(hasOutput, { kind: 'failed' }),
    /cannot release.*output/i,
  );
  assert.equal(hasOutput.releaseCalls, 0);
});

test('outcomes reject extra keys and non-plain or accessor inputs before SQL', async () => {
  const fixture = harness();
  let getterCalls = 0;
  const accessor = Object.defineProperty({}, 'kind', {
    enumerable: true,
    get() { getterCalls += 1; return 'completed'; },
  });
  for (const input of [
    { kind: 'completed', providerPayload: 'private' },
    Object.assign(Object.create(null), { kind: 'completed' }),
    accessor,
    { kind: 'provider_failed' },
    { kind: 'support_release', reason: 'provider_confirmed_no_output' },
  ]) {
    await assert.rejects(
      applyOutcome(fixture, input),
      /invalid trial job outcome/i,
    );
  }
  assert.equal(getterCalls, 0);
  assert.equal(fixture.calls.length, 0);
});

test('a support release accepts only allowlisted reasons and writes the reason in the transaction', async () => {
  const fixture = harness({ jobStatus: 'provider_polling_stalled' });
  assert.deepEqual(
    await applySupportOverride(fixture, {
      kind: 'release',
      reason: 'provider_confirmed_no_output',
    }),
    { funding: 'included_trial', entitlementState: 'released' },
  );
  const audit = fixture.calls.find(({ sql }) => /INSERT INTO mcp_trial_support_override_audit/i.test(sql));
  assert.ok(audit);
  assert.ok(audit.params?.includes('provider_confirmed_no_output'));
  assert.ok(audit.params?.includes(JOB_ID));

  const rejected = harness();
  await assert.rejects(
    applySupportOverride(rejected, {
      kind: 'release',
      reason: 'freeform internal note',
    }),
    /invalid trial support override/i,
  );
  assert.equal(rejected.calls.length, 0);
});

test('trial rows are locked and quote, job, entitlement identities must agree', async () => {
  const fixture = harness({ quoteState: 'claimed' });
  await applyOutcome(fixture, { kind: 'accepted' });
  for (const table of ['app_jobs', 'mcp_generation_quotes', 'mcp_trial_entitlements']) {
    const lock = fixture.calls.find(({ sql }) => new RegExp(`FROM ${table}`, 'i').test(sql));
    assert.match(lock?.sql ?? '', /FOR UPDATE/i);
  }
  assert.ok(fixture.calls.some(({ sql }) => /funding_mode = 'trial'|state = 'accepted'/i.test(sql)));

  const inconsistent = harness({ entitlementState: 'released', quoteState: 'accepted' });
  await assert.rejects(
    applyOutcome(inconsistent, { kind: 'unknown' }),
    /inconsistent trial lifecycle/i,
  );
});

test('confirmation, shared final persistence, and BytePlus polling delegate to the one trial outcome owner', () => {
  const root = process.cwd();
  const confirmation = readFileSync(join(root, 'frontend/src/server/agent-api/confirm-generation.ts'), 'utf8');
  const finalPersistence = readFileSync(join(root, 'frontend/app/api/generate/_lib/final-job-persistence.ts'), 'utf8');
  const bytePlusPoll = readFileSync(join(root, 'frontend/server/byteplus-poll.ts'), 'utf8');
  const bytePlusTrial = readFileSync(join(root, 'frontend/server/byteplus-trial-outcomes.ts'), 'utf8');
  const outcomeOwner = readFileSync(join(root, 'frontend/src/server/agent-api/trial-outcomes.ts'), 'utf8');
  assert.match(confirmation, /applyTrialJobOutcome/);
  assert.match(confirmation, /submitTrialGeneration[\s\S]*applyTrialJobOutcome/);
  assert.match(finalPersistence, /applyTrialJobOutcome/);
  assert.match(finalPersistence, /paymentStatus\s*===\s*'included_mcp_trial'/);
  assert.match(bytePlusPoll, /applyBytePlusTrialOutcomeSafely/);
  assert.match(bytePlusTrial, /applyTrialJobOutcome/);
  assert.match(bytePlusTrial, /try\s*\{[\s\S]*applyOutcome[\s\S]*catch/u);
  const publicSignature = outcomeOwner.match(/export async function applyTrialJobOutcome\([\s\S]*?\n\}/u)?.[0] ?? '';
  assert.doesNotMatch(publicSignature.slice(0, 320), /dependencies:/);
  assert.match(outcomeOwner, /export function createTrialJobOutcomeService/);
  assert.match(outcomeOwner, /export async function applyTrialSupportOverride/);
  assert.match(bytePlusPoll, /kind:\s*'timeout'/);
  assert.match(bytePlusPoll, /kind:\s*'completed'/);
  assert.match(bytePlusPoll, /kind:\s*'failed'/);
  assert.doesNotMatch(bytePlusPoll, /payment_status\s*=\s*'refunded_wallet'[\s\S]{0,300}included_mcp_trial/);
});

test('support override audit is dedicated, exact, and immutable in the trial migration', () => {
  const migration = readFileSync('neon/migrations/31_mcp_trial_entitlements.sql', 'utf8');
  assert.match(migration, /CREATE TABLE IF NOT EXISTS mcp_trial_support_override_audit/i);
  assert.match(migration, /reason_code[\s\S]*provider_confirmed_no_output[\s\S]*support_verified_no_output/i);
  assert.match(migration, /enforce_mcp_trial_support_override_audit_insert/i);
  assert.match(migration, /BEFORE UPDATE OR DELETE ON mcp_trial_support_override_audit/i);
  assert.match(migration, /RAISE EXCEPTION 'MCP trial support override audit rows are immutable'/i);
});

test('BytePlus outcome failures defer accounting without aborting terminal post-processing', async () => {
  const { applyBytePlusTrialOutcomeSafely } = await import('../frontend/server/byteplus-trial-outcomes');
  const originalWarn = console.warn;
  const warnings: unknown[][] = [];
  console.warn = (...args: unknown[]) => { warnings.push(args); };
  let calls = 0;
  try {
    await applyBytePlusTrialOutcomeSafely({
      job_id: JOB_ID, payment_status: 'included_mcp_trial',
    }, { kind: 'completed' }, async () => {
      calls += 1;
      throw new Error('transient outcome persistence failure');
    });
    await applyBytePlusTrialOutcomeSafely({
      job_id: 'wallet-job', payment_status: 'paid_wallet',
    }, { kind: 'failed' }, async () => {
      calls += 1;
      throw new Error('wallet path must not call trial outcomes');
    });
  } finally {
    console.warn = originalWarn;
  }
  assert.equal(calls, 1);
  assert.equal(warnings.length, 1);
  assert.match(String(warnings[0]?.[0]), /deferred to reconciliation/i);
});

test('safe status lookup exposes only included_trial and lifecycle state', async () => {
  const { readTrialJobStatus } = await import('../frontend/src/server/agent-api/trial-outcomes');
  const calls: Call[] = [];
  const result = await readTrialJobStatus({ userId: USER_ID, jobId: JOB_ID }, {
    executor: {
      async query<T>(sql: string, params?: ReadonlyArray<unknown>) {
        calls.push({ sql, params });
        return [{ funding: 'included_trial', entitlement_state: 'reserved', last_reason_code: 'private_reason' }] as T[];
      },
    },
  });
  assert.deepEqual(result, { funding: 'included_trial', entitlementState: 'reserved' });
  assert.equal('lastReasonCode' in result!, false);
  assert.match(calls[0]?.sql ?? '', /payment_status\s*=\s*'included_mcp_trial'/i);
  assert.doesNotMatch(calls[0]?.sql ?? '', /last_reason_code|provider_cost|ip_prefix|user_agent/i);
});

test('shared final persistence consumes durable output but leaves generic failures ambiguous', async () => {
  const { persistFinalVideoJobUpdate } = await import(
    '../frontend/app/api/generate/_lib/final-job-persistence'
  );
  const seen: string[] = [];
  const base = {
    jobId: JOB_ID,
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
    queryFn: async () => undefined,
    applyTrialOutcomeFn: async (_jobId: string, outcome: { kind: string }) => {
      seen.push(outcome.kind);
      return { funding: 'included_trial' as const, entitlementState: 'reserved' as const };
    },
  };
  await persistFinalVideoJobUpdate({ ...base, video: null, status: 'failed', progress: 0 });
  await persistFinalVideoJobUpdate({
    ...base,
    video: 'https://media.maxvideoai.com/final.mp4',
    status: 'completed',
    progress: 100,
  });
  assert.deepEqual(seen, ['unknown', 'completed']);
});
