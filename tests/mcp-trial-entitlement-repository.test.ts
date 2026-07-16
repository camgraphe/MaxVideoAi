import assert from 'node:assert/strict';
import test from 'node:test';

import type { QueryExecutor, TransactionQueryExecutor } from '../frontend/src/lib/db';

const quoteA = '00000000-0000-4000-8000-000000000101';
const quoteB = '00000000-0000-4000-8000-000000000102';
const created = new Date('2026-07-17T10:00:00.000Z');

type Call = { sql: string; params?: ReadonlyArray<unknown> };

function row(overrides: Record<string, unknown> = {}) {
  return {
    user_id: 'user-1', status: 'available', reserved_quote_id: null, job_id: null,
    reserved_at: null, consumed_at: null, released_at: null,
    created_at: created, updated_at: created, last_reason_code: null,
    ...overrides,
  };
}

test('entitlement repository validates exact plain inputs and parses only valid state rows', async () => {
  const { ensureEntitlement, getTrialStatus } = await import(
    '../frontend/src/server/agent-api/trial-entitlement-repository'
  );
  const calls: Call[] = [];
  const executor: QueryExecutor = {
    async query<T>(sql, params) {
      calls.push({ sql, params });
      return [row()] as T[];
    },
  };
  assert.equal((await ensureEntitlement({ userId: 'user-1' }, { executor })).status, 'available');
  assert.equal((await getTrialStatus({ userId: 'user-1' }, { executor }))?.status, 'available');
  assert.match(calls[0]!.sql, /INSERT INTO mcp_trial_entitlements/i);
  assert.match(calls[0]!.sql, /ON CONFLICT\s*\(user_id\)\s*DO UPDATE/i);
  assert.doesNotMatch(calls[0]!.sql, /NOW\(\)|new Date|user-1/i);
  assert.deepEqual(calls[0]!.params, ['user-1']);

  for (const bad of [
    { userId: '' }, { userId: ' user-1' }, { userId: 'bad\nuser' },
    { userId: 'user-1', extra: true },
    Object.create(null) as object,
  ]) {
    await assert.rejects(ensureEntitlement(bad as never, { executor }), /invalid entitlement input/i);
  }
  const accessor = {} as Record<string, unknown>;
  Object.defineProperty(accessor, 'userId', { enumerable: true, get: () => 'user-1' });
  await assert.rejects(ensureEntitlement(accessor as never, { executor }), /invalid entitlement input/i);

  const malformed: QueryExecutor = {
    async query<T>() { return [row({ status: 'reserved' })] as T[]; },
  };
  await assert.rejects(getTrialStatus({ userId: 'user-1' }, { executor: malformed }), /invalid entitlement row/i);

  const source = await import('node:fs').then(({ readFileSync }) => readFileSync(
    'frontend/src/server/agent-api/trial-entitlement-repository.ts', 'utf8',
  ));
  assert.match(source, /TransitionDependencies[\s\S]*TransactionQueryExecutor/);
  assert.doesNotMatch(source, /withDbTransaction|new Date\(\).*reserved_at|NOW\(\)/i);
});

test('lock and reservation transitions require branded transaction executors and database timestamps', async () => {
  const { lockReservableEntitlement, reserveEntitlement } = await import(
    '../frontend/src/server/agent-api/trial-entitlement-repository'
  );
  const calls: Call[] = [];
  let phase = 0;
  const executor: QueryExecutor = {
    async query<T>(sql, params) {
      calls.push({ sql, params });
      phase += 1;
      if (phase === 1) return [] as T[];
      if (phase === 2) return [row()] as T[];
      return [row({
        status: 'reserved', reserved_quote_id: quoteA, job_id: 'job-a',
        reserved_at: '2026-07-17T10:01:00.123456Z',
        updated_at: '2026-07-17T10:01:00.123456Z', last_reason_code: 'trial_reserved',
      })] as T[];
    },
  };
  const tx = executor as TransactionQueryExecutor;
  const locked = await lockReservableEntitlement({ userId: 'user-1' }, { executor: tx });
  assert.equal(locked?.status, 'available');
  assert.ok(locked);
  const reserved = await reserveEntitlement(
    { lockedEntitlement: locked, quoteId: quoteA, jobId: 'job-a', reasonCode: 'trial_reserved' },
    { executor: tx },
  );
  assert.equal(reserved?.status, 'reserved');
  assert.match(calls[1]!.sql, /FOR UPDATE/i);
  assert.match(calls[2]!.sql, /clock_timestamp\(\)/i);
  assert.match(calls[2]!.sql, /status = \$5/i);
  assert.match(calls[2]!.sql, /reserved_quote_id IS NOT DISTINCT FROM \$6/i);
  assert.deepEqual(calls[2]!.params?.slice(0, 6), [
    'user-1', quoteA, 'job-a', 'trial_reserved', 'available', null,
  ]);

  for (const bad of [
    { lockedEntitlement: locked, quoteId: quoteA, jobId: 'job-a', reasonCode: 'Bad Reason' },
    { lockedEntitlement: locked, quoteId: quoteA, jobId: 'bad\njob', reasonCode: 'ok' },
    { lockedEntitlement: locked, quoteId: quoteB.replace('4', '5'), jobId: 'job-a', reasonCode: 'ok' },
    { lockedEntitlement: locked, quoteId: quoteA, jobId: 'job-a', reasonCode: 'ok', reservedAt: created },
    { userId: 'user-1', quoteId: quoteA, jobId: 'job-a', reasonCode: 'ok' },
  ]) await assert.rejects(reserveEntitlement(bad as never, { executor: tx }), /invalid entitlement transition input/i);
});

test('consume and release compare the expected reservation and return exact terminal callbacks idempotently', async () => {
  const { consumeEntitlement, releaseEntitlement } = await import(
    '../frontend/src/server/agent-api/trial-entitlement-repository'
  );
  const calls: Call[] = [];
  const terminal = row({
    status: 'consumed', reserved_quote_id: quoteA, job_id: 'job-a',
    reserved_at: '2026-07-17T10:01:00Z', consumed_at: '2026-07-17T10:02:00Z',
    updated_at: '2026-07-17T10:02:00Z', last_reason_code: 'output_completed',
  });
  const executor: QueryExecutor = {
    async query<T>(sql, params) {
      calls.push({ sql, params });
      if (/status = 'consumed'/i.test(sql)) return [terminal] as T[];
      return [] as T[];
    },
  };
  const tx = executor as TransactionQueryExecutor;
  const input = { userId: 'user-1', quoteId: quoteA, jobId: 'job-a', reasonCode: 'output_completed' };
  assert.equal((await consumeEntitlement(input, { executor: tx }))?.status, 'consumed');
  assert.equal(await releaseEntitlement({ ...input, reasonCode: 'provider_failed' }, { executor: tx }), null);
  assert.match(calls[0]!.sql, /transitioned AS/i);
  assert.match(calls[0]!.sql, /status = 'reserved'/i);
  assert.match(calls[0]!.sql, /reserved_quote_id = \$2/i);
  assert.match(calls[0]!.sql, /job_id = \$3/i);
  assert.match(calls[0]!.sql, /UNION ALL/i);
  assert.match(calls[0]!.sql, /status = 'consumed'/i);
  assert.match(calls[0]!.sql, /clock_timestamp\(\)/i);
  assert.match(calls[1]!.sql, /status = 'released'/i);
});

test('released entitlements are reservable with a replacement quote/job pair', async () => {
  const { lockReservableEntitlement, reserveEntitlement } = await import(
    '../frontend/src/server/agent-api/trial-entitlement-repository'
  );
  const calls: Call[] = [];
  const released = row({
    status: 'released', reserved_quote_id: quoteA, job_id: 'job-a',
    reserved_at: '2026-07-17T10:01:00Z', released_at: '2026-07-17T10:02:00Z',
    updated_at: '2026-07-17T10:02:00Z', last_reason_code: 'provider_failed',
  });
  let phase = 0;
  const executor: QueryExecutor = {
    async query<T>(sql, params) {
      calls.push({ sql, params });
      phase += 1;
      if (phase === 1) return [] as T[];
      if (phase === 2) return [released] as T[];
      return [row({
        status: 'reserved', reserved_quote_id: quoteB, job_id: 'job-b',
        reserved_at: '2026-07-17T10:03:00Z', updated_at: '2026-07-17T10:03:00Z',
        last_reason_code: 'trial_retried',
      })] as T[];
    },
  };
  const tx = executor as TransactionQueryExecutor;
  const locked = await lockReservableEntitlement({ userId: 'user-1' }, { executor: tx });
  assert.equal(locked?.status, 'released');
  assert.ok(locked);
  assert.equal((await reserveEntitlement({
    lockedEntitlement: locked, quoteId: quoteB, jobId: 'job-b', reasonCode: 'trial_retried',
  }, { executor: tx }))?.jobId, 'job-b');
  assert.match(calls[2]!.sql, /consumed_at = NULL/i);
  assert.match(calls[2]!.sql, /released_at = NULL/i);
});
