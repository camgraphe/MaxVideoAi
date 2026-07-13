import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { lockAndResolveFirstWalletTopup } from '../frontend/server/wallet-first-topup';

test('first wallet top-up is resolved only after a per-user transaction lock', async () => {
  const calls: Array<{ sql: string; params: ReadonlyArray<unknown> | undefined }> = [];
  const executor = {
    async query<TRecord>(sql: string, params?: ReadonlyArray<unknown>): Promise<TRecord[]> {
      calls.push({ sql, params });
      if (/SELECT EXISTS/.test(sql)) return [{ has_topup: false }] as TRecord[];
      return [];
    },
  };

  assert.equal(await lockAndResolveFirstWalletTopup(executor, 'user-1'), true);
  assert.match(calls[0]?.sql ?? '', /pg_advisory_xact_lock/);
  assert.deepEqual(calls[0]?.params, ['wallet-topup:user-1']);
  assert.match(calls[1]?.sql ?? '', /type = 'topup'/);
  assert.match(calls[1]?.sql ?? '', /amount_cents > 0/);
});

test('an existing positive top-up makes the next receipt non-first', async () => {
  const executor = {
    async query<TRecord>(sql: string): Promise<TRecord[]> {
      if (/SELECT EXISTS/.test(sql)) return [{ has_topup: true }] as TRecord[];
      return [];
    },
  };

  assert.equal(await lockAndResolveFirstWalletTopup(executor, 'user-2'), false);
});

test('Stripe receipt insertion owns the transaction and GA4 uses its authoritative first flag', () => {
  const source = readFileSync(
    'frontend/app/api/stripe/webhook/_lib/stripe-webhook-topup-persistence.ts',
    'utf8'
  );
  assert.match(source, /withDbTransaction\(async \(executor\) =>/);
  assert.match(source, /lockAndResolveFirstWalletTopup\(executor, userId\)/);
  assert.match(source, /first_wallet_topup:\s*String\(isFirstWalletTopup\)/);
  assert.match(source, /is_first_wallet_topup:\s*persistenceResult\.isFirstWalletTopup/);
  assert.doesNotMatch(source, /String\(metadataRecord\.first_wallet_topup/);
});
