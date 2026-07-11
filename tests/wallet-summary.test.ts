import assert from 'node:assert/strict';
import test from 'node:test';

import type { QueryExecutor } from '../frontend/src/lib/db';
import { getWalletSummary } from '../frontend/src/server/wallet-summary';

function executorReturning(rows: unknown[]): QueryExecutor {
  return {
    async query<TRecord>() {
      return rows as TRecord[];
    },
  };
}

test('wallet summary aggregates the USD receipt ledger in integer cents', async () => {
  const summary = await getWalletSummary(
    'user-1',
    executorReturning([
      {
        topups_cents: '1000',
        charges_cents: '500',
        refunds_cents: '100',
        completed_topups: 1,
        mismatched_currencies: '',
      },
    ])
  );

  assert.deepEqual(summary, {
    balanceCents: 600,
    currency: 'USD',
    pendingCents: 0,
    hasCompletedTopUp: true,
  });
});

test('wallet summary clamps a negative ledger balance and handles an empty ledger', async () => {
  const negative = await getWalletSummary(
    'user-1',
    executorReturning([
      {
        topups_cents: 0,
        charges_cents: 700,
        refunds_cents: 0,
        completed_topups: 0,
        mismatched_currencies: '',
      },
    ])
  );
  const empty = await getWalletSummary('user-2', executorReturning([]));

  assert.equal(negative.balanceCents, 0);
  assert.deepEqual(empty, {
    balanceCents: 0,
    currency: 'USD',
    pendingCents: 0,
    hasCompletedTopUp: false,
  });
});

test('wallet summary query is scoped to one user and aggregates rather than returning ledger rows', async () => {
  let capturedSql = '';
  let capturedParams: ReadonlyArray<unknown> | undefined;
  const executor: QueryExecutor = {
    async query<TRecord>(sql, params) {
      capturedSql = sql;
      capturedParams = params;
      return [] as TRecord[];
    },
  };

  await getWalletSummary('user-123', executor);

  assert.match(capturedSql, /SUM\(CASE WHEN type = 'topup'/);
  assert.match(capturedSql, /SUM\(CASE WHEN type = 'charge'/);
  assert.match(capturedSql, /SUM\(CASE WHEN type = 'refund'/);
  assert.match(capturedSql, /WHERE user_id = \$1/);
  assert.deepEqual(capturedParams, ['user-123', 'USD', 'usd']);
});
