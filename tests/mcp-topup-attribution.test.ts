import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import type { QueryExecutor } from '../frontend/src/lib/db';

type FunnelModule = typeof import('../frontend/src/server/agent-api/mcp-funnel');

async function loadFunnel(): Promise<FunnelModule> {
  return import('../frontend/src/server/agent-api/mcp-funnel');
}

test('confirmed receipt attribution inserts wallet funding only from an eligible post-trial MCP cohort', async () => {
  const { recordConfirmedMcpWalletFunding } = await loadFunnel();
  let sql = '';
  let params: ReadonlyArray<unknown> | undefined;
  const executor: QueryExecutor = {
    async query<TRecord>(text, values) {
      sql = text;
      params = values;
      return [{ id: 7 }] as TRecord[];
    },
  };
  const recorded = await recordConfirmedMcpWalletFunding({
    receiptId: 42,
    userId: 'user-1',
    amountCents: 2500,
    currency: 'USD',
    occurredAt: new Date('2026-07-14T10:00:00.000Z'),
  }, { executor, conversionWindowSeconds: 30 * 24 * 60 * 60 });

  assert.equal(recorded, true);
  assert.match(sql, /INSERT INTO mcp_funnel_events/i);
  assert.match(sql, /SELECT[\s\S]*FROM mcp_funnel_events/i);
  assert.match(sql, /trial_generation_completed/);
  assert.match(sql, /trial_completed/);
  assert.match(sql, /wallet_funded/);
  assert.match(sql, /occurred_at\s*<\s*\$\d+/i);
  assert.match(sql, /ON CONFLICT \(receipt_hash\) WHERE receipt_hash IS NOT NULL DO NOTHING/i);
  assert.doesNotMatch(sql, /stripe_|payment_method|receipt_url|metadata|provider|prompt|email|token/i);
  const receiptHash = createHash('sha256').update('mcp-funnel-wallet-v1:42').digest('hex');
  assert.ok(params?.includes(receiptHash));
  assert.ok(params?.includes(2500));
  assert.ok(params?.includes('USD'));
});

test('missing trial/cohort, duplicate receipt, unrelated user, pre-trial, and outside-window cases are no-ops', async () => {
  const { recordConfirmedMcpWalletFunding } = await loadFunnel();
  const inputs: string[] = [];
  const executor: QueryExecutor = {
    async query<TRecord>(sql) {
      inputs.push(sql);
      return [] as TRecord[];
    },
  };
  assert.equal(await recordConfirmedMcpWalletFunding({
    receiptId: 43,
    userId: 'unrelated-user',
    amountCents: 1000,
    currency: 'EUR',
    occurredAt: new Date('2026-07-14T10:00:00.000Z'),
  }, { executor, conversionWindowSeconds: 900 }), false);
  assert.equal(inputs.length, 1);
  assert.match(inputs[0], /user_id\s*=\s*\$\d+/);
  assert.match(inputs[0], /occurred_at\s*<\s*\$\d+/);
  assert.match(inputs[0], /occurred_at\s*>=\s*\$\d+\s*-\s*\(\$\d+\s*\*\s*INTERVAL '1 second'\)/i);
});

test('wallet attribution rejects non-confirmed or private payment-shaped inputs before querying', async () => {
  const { recordConfirmedMcpWalletFunding } = await loadFunnel();
  let queryCount = 0;
  const executor: QueryExecutor = {
    async query<TRecord>() {
      queryCount += 1;
      return [] as TRecord[];
    },
  };
  const base = {
    receiptId: 44,
    userId: 'user-1',
    amountCents: 1000,
    currency: 'USD',
    occurredAt: new Date('2026-07-14T10:00:00.000Z'),
  };
  for (const invalid of [
    { ...base, amountCents: -1 },
    { ...base, amountCents: 1.5 },
    { ...base, currency: 'usd' },
    { ...base, receiptId: 0 },
    { ...base, stripePaymentIntentId: 'pi_private' },
    { ...base, paymentMethod: 'card' },
    { ...base, clientSecret: 'secret' },
    { ...base, email: 'person@example.com' },
  ]) {
    assert.equal(await recordConfirmedMcpWalletFunding(invalid as never, {
      executor,
      conversionWindowSeconds: 900,
    }), false);
  }
  assert.equal(queryCount, 0);
});

test('Stripe invokes MCP attribution only after a newly inserted canonical wallet receipt', () => {
  const persistence = readFileSync(
    'frontend/app/api/stripe/webhook/_lib/stripe-webhook-topup-persistence.ts',
    'utf8',
  );
  assert.match(persistence, /recordConfirmedMcpWalletFunding/);
  assert.match(
    persistence,
    /if \(persistenceResult\.kind === 'duplicate'\)[\s\S]*return;[\s\S]*recordConfirmedMcpWalletFunding\([\s\S]*receiptId:\s*persistenceResult\.receiptId/,
  );
  assert.doesNotMatch(
    readFileSync('frontend/app/api/stripe/webhook/_lib/stripe-webhook-failed-payments.ts', 'utf8'),
    /recordConfirmedMcpWalletFunding/,
  );
  assert.doesNotMatch(
    readFileSync('frontend/app/api/wallet/route.ts', 'utf8'),
    /recordConfirmedMcpWalletFunding|wallet_funded/,
  );
});
