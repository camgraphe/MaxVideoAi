import assert from 'node:assert/strict';
import test from 'node:test';

import type { QueryExecutor } from '../frontend/src/lib/db';
import { RESTRICTED_ACCOUNT_MESSAGE } from '../frontend/src/server/fraud-cleanup/constants';
import { getActiveAccountRestrictionStrict } from '../frontend/src/server/fraud-cleanup/restrictions';

function executorReturning(rows: unknown[]): QueryExecutor {
  return {
    async query<T>() {
      return rows as T[];
    },
  };
}

function validRow(overrides: Record<string, unknown> = {}) {
  return {
    user_id: 'user-1',
    reason: 'chargeback',
    message: null,
    restricted_at: '2026-07-17T09:00:00.000Z',
    ...overrides,
  };
}

test('strict restriction lookup rejects a missing database before querying', async () => {
  let calls = 0;
  const executor: QueryExecutor = {
    async query<T>() {
      calls += 1;
      return [] as T[];
    },
  };

  await assert.rejects(
    getActiveAccountRestrictionStrict('user-1', { databaseUrl: undefined, executor }),
    /database unavailable/i,
  );
  assert.equal(calls, 0);
});

test('strict restriction lookup propagates every query failure including missing schema', async () => {
  for (const error of [
    new Error('private database connection failure'),
    Object.assign(new Error('private missing relation'), { code: '42P01' }),
  ]) {
    const executor: QueryExecutor = {
      async query<T>(): Promise<T[]> {
        throw error;
      },
    };
    await assert.rejects(
      getActiveAccountRestrictionStrict('user-1', {
        databaseUrl: 'postgresql://configured',
        executor,
      }),
      (actual) => actual === error,
    );
  }
});

test('strict restriction lookup rejects malformed, mismatched, or duplicate rows', async () => {
  const malformedRows = [
    [validRow({ user_id: 'other-user' })],
    [validRow({ reason: 42 })],
    [validRow({ message: 42 })],
    [validRow({ restricted_at: 'not-a-date' })],
    [validRow(), validRow()],
  ];
  for (const rows of malformedRows) {
    await assert.rejects(
      getActiveAccountRestrictionStrict('user-1', {
        databaseUrl: 'postgresql://configured',
        executor: executorReturning(rows),
      }),
      /invalid restricted account result/i,
    );
  }
});

test('strict restriction lookup distinguishes no row from a validated active restriction', async () => {
  assert.equal(
    await getActiveAccountRestrictionStrict('user-1', {
      databaseUrl: 'postgresql://configured',
      executor: executorReturning([]),
    }),
    null,
  );

  assert.deepEqual(
    await getActiveAccountRestrictionStrict('user-1', {
      databaseUrl: 'postgresql://configured',
      executor: executorReturning([validRow()]),
    }),
    {
      userId: 'user-1',
      reason: 'chargeback',
      message: RESTRICTED_ACCOUNT_MESSAGE,
      restrictedAt: '2026-07-17T09:00:00.000Z',
    },
  );
});
