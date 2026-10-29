import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import test from 'node:test';
import { build } from 'esbuild';
import type Stripe from 'stripe';
import { createStripeWebhookEventProcessor } from '../frontend/app/api/stripe/webhook/_lib/stripe-webhook-event-processor';
import { startDisposablePostgres } from './helpers/disposable-postgres';

test('a failed durable top-up releases its webhook claim and retries exactly once after recovery', async t => {
  const pg = await startDisposablePostgres('stripe-topup-retry');
  const folder = mkdtempSync(join(tmpdir(), 'stripe-topup-retry-'));
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = pg.databaseUrl;
  let producerPool: { end(): Promise<void> } | undefined;
  t.after(async () => {
    await producerPool?.end();
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
    rmSync(folder, { recursive: true, force: true });
    await pg.cleanup();
  });
  await pg.pool.query(`CREATE TABLE app_receipts (
    id bigserial PRIMARY KEY, user_id text, type text, amount_cents integer, currency text,
    description text, metadata jsonb, stripe_payment_intent_id text UNIQUE, stripe_charge_id text,
    stripe_checkout_session_id text, stripe_invoice_id text, platform_revenue_cents integer,
    destination_acct text, original_amount_cents integer, original_currency text, fx_rate numeric,
    fx_margin_bps integer, fx_rate_timestamp timestamptz, stripe_customer_id text,
    stripe_hosted_invoice_url text, stripe_invoice_pdf text, stripe_receipt_url text,
    stripe_document_synced_at timestamptz, created_at timestamptz DEFAULT now(),
    CONSTRAINT injected_topup_outage CHECK (type <> 'topup'));
    CREATE TABLE stripe_webhook_events(event_id text PRIMARY KEY, event_type text, processed_at timestamptz);`);
  const output = join(folder, 'producer.cjs');
  await build({ stdin: { contents: `
    export { recordStripeTopup } from './frontend/app/api/stripe/webhook/_lib/stripe-webhook-topup-persistence';
    export { beginStripeEvent, markStripeEventProcessed, rollbackStripeEvent } from './frontend/app/api/stripe/webhook/_lib/stripe-webhook-event-state';
    export { getDb } from './frontend/src/lib/db';
    export { getMockWalletBalance } from './frontend/src/lib/wallet';
    export { setSchemaFailure } from '@/lib/schema';
    export { setPreferenceFailure } from '@/lib/currency';
  `, resolveDir: process.cwd(), loader: 'ts' }, outfile: output, bundle: true, platform: 'node',
    format: 'cjs', packages: 'external', tsconfig: 'frontend/tsconfig.json', plugins: [{ name: 'external-boundaries', setup(b) {
      const stubs: Record<string, string> = {
        '@/lib/schema': 'let fail = false; export function setSchemaFailure(value) { fail = value; } export async function ensureBillingSchema() { if (fail) throw new Error("injected schema outage"); }',
        '@/lib/currency': 'let fail = false; export function setPreferenceFailure(value) { fail = value; } export async function ensureUserPreferredCurrency() { if (fail) throw new Error("injected post-commit outage"); } export function normalizeCurrencyCode(v) { return v; } export async function getUserPreferredCurrency() { return null; }',
        '@/server/agent-api/mcp-funnel': 'export async function recordConfirmedMcpWalletFunding() {} export function resolveMcpTrialToWalletWindowSeconds() { return 1; }',
      };
      b.onResolve({ filter: /^pg$/ }, () => ({ path: createRequire(resolve('frontend/package.json')).resolve('pg'), external: true }));
      b.onResolve({ filter: /^@\// }, args => stubs[args.path] ? { path: args.path, namespace: 'boundary' } : undefined);
      b.onLoad({ filter: /.*/, namespace: 'boundary' }, args => ({ contents: stubs[args.path], loader: 'ts' }));
    } }] });
  const producer = createRequire(resolve('frontend/package.json'))(output);
  producerPool = producer.getDb();
  let input = { userId: 'topup-retry-owner', stripeLiveMode: true, walletAmountCents: 2500,
    walletCurrency: 'USD', settlementAmountCents: 2500, settlementCurrency: 'USD', paymentIntentId: 'pi_retry', metadata: {} };
  const baselineMock = producer.getMockWalletBalance(input.userId);
  const unexpected = async () => { throw new Error('Unexpected event handler'); };
  const processEvent = createStripeWebhookEventProcessor({
    beginStripeEvent: producer.beginStripeEvent, markStripeEventProcessed: producer.markStripeEventProcessed,
    rollbackStripeEvent: producer.rollbackStripeEvent, replayMcpTopupAttribution: async () => {},
    handleCheckoutSessionCompleted: async () => producer.recordStripeTopup(input, { receiptsPriceOnly: false }),
    handlePaymentIntentSucceeded: unexpected, handlePaymentIntentFailed: unexpected,
    handleChargeFailed: unexpected, handleChargeRefunded: unexpected, handleInvoicePaid: unexpected,
  });
  const event = { id: 'evt_topup_retry', type: 'checkout.session.completed', data: { object: {} } } as Stripe.Event;
  const options = { stripe: {} as Stripe, receiptsPriceOnly: false };
  const first = (await Promise.allSettled([processEvent(event, options)]))[0];
  const failedState = {
    outcome: first.status,
    receipts: (await pg.pool.query('SELECT count(*)::int n FROM app_receipts')).rows[0].n,
    claims: (await pg.pool.query('SELECT count(*)::int n FROM stripe_webhook_events')).rows[0].n,
    mockCreditDelta: producer.getMockWalletBalance(input.userId) - baselineMock,
  };
  console.info('Stripe durable top-up failure evidence', failedState);
  producer.setSchemaFailure(true);
  const schema = (await Promise.allSettled([processEvent({ ...event, id: 'evt_schema_retry' }, options)]))[0];
  producer.setSchemaFailure(false);
  console.info('Stripe schema failure evidence', { outcome: schema.status, mockCreditDelta: producer.getMockWalletBalance(input.userId) - baselineMock });
  await t.test('receipt failure releases the event claim and never uses a mock balance', () => {
    assert.deepEqual(failedState, { outcome: 'rejected', receipts: 0, claims: 0, mockCreditDelta: 0 });
    assert.equal(first.status === 'rejected' && first.reason.constraint, 'injected_topup_outage');
  });
  await t.test('schema failure also propagates without a mock balance', async () => {
    assert.equal(schema.status, 'rejected');
    assert.equal(schema.status === 'rejected' && schema.reason.message, 'injected schema outage');
    assert.equal(producer.getMockWalletBalance(input.userId), baselineMock);
    assert.equal((await pg.pool.query('SELECT count(*)::int n FROM stripe_webhook_events')).rows[0].n, 0);
  });
  await pg.pool.query('ALTER TABLE app_receipts DROP CONSTRAINT injected_topup_outage');
  await t.test('recovery and concurrent deliveries credit the same payment exactly once', async () => {
    assert.deepEqual(await Promise.all([processEvent(event, options), processEvent({ ...event, id: 'evt_same_payment' }, options)]), ['handled', 'handled']);
    assert.equal(await processEvent(event, options), 'duplicate');
    assert.deepEqual((await pg.pool.query('SELECT user_id,amount_cents FROM app_receipts')).rows,
      [{ user_id: 'topup-retry-owner', amount_cents: 2500 }]);
    assert.equal((await pg.pool.query('SELECT count(*)::int n FROM stripe_webhook_events WHERE processed_at IS NOT NULL')).rows[0].n, 2);
  });
  await t.test('a post-commit error remains retryable without a second durable or mock credit', async () => {
    input = { ...input, paymentIntentId: 'pi_post_commit' };
    const postCommitEvent = { ...event, id: 'evt_post_commit' };
    producer.setPreferenceFailure(true);
    await assert.rejects(processEvent(postCommitEvent, options), /injected post-commit outage/);
    assert.equal((await pg.pool.query("SELECT count(*)::int n FROM app_receipts WHERE stripe_payment_intent_id='pi_post_commit'")).rows[0].n, 1);
    assert.equal((await pg.pool.query("SELECT count(*)::int n FROM stripe_webhook_events WHERE event_id='evt_post_commit'")).rows[0].n, 0);
    producer.setPreferenceFailure(false);
    assert.equal(await processEvent(postCommitEvent, options), 'handled');
    assert.equal(await processEvent(postCommitEvent, options), 'duplicate');
    assert.deepEqual((await pg.pool.query("SELECT count(*)::int n, sum(amount_cents)::int cents FROM app_receipts WHERE stripe_payment_intent_id='pi_post_commit'")).rows, [{ n: 1, cents: 2500 }]);
    assert.equal(producer.getMockWalletBalance(input.userId), baselineMock);
  });
  await t.test('without a configured database the mock ledger still credits and deduplicates', async () => {
    delete process.env.DATABASE_URL;
    try {
      const mockInput = { ...input, userId: 'mock-only-owner', paymentIntentId: 'pi_mock_only' };
      const mockBaseline = producer.getMockWalletBalance(mockInput.userId);
      await producer.recordStripeTopup(mockInput, { receiptsPriceOnly: false });
      await producer.recordStripeTopup(mockInput, { receiptsPriceOnly: false });
      assert.equal(producer.getMockWalletBalance(mockInput.userId) - mockBaseline, 2500);
    } finally {
      process.env.DATABASE_URL = pg.databaseUrl;
    }
  });
});
