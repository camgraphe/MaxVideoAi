import assert from 'node:assert/strict';
import { fork, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';
import type Stripe from 'stripe';
import { Pool } from 'pg';
import { startDisposablePostgres } from './helpers/disposable-postgres';

type RecoveryApi = typeof import('../frontend/app/api/stripe/webhook/_lib/stripe-webhook-event-state')
  & typeof import('../frontend/app/api/stripe/webhook/_lib/stripe-webhook-topup-persistence')
  & typeof import('../frontend/src/lib/db');

function barrier() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}

async function waitForBackendExit(pool: Pool, pid: number) {
  const deadline = Date.now() + 5_000;
  for (;;) {
    const { rows: [state] } = await pool.query<{ active: boolean; locked: boolean }>(`SELECT
      EXISTS(SELECT 1 FROM pg_stat_activity WHERE pid=$1) AS active,
      EXISTS(SELECT 1 FROM pg_locks WHERE pid=$1) AS locked`, [pid]);
    if (!state.active && !state.locked) return;
    assert.ok(Date.now() < deadline, 'The disconnected lifecycle backend must exit and release its locks.');
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

// The fixture replaces schema bootstrap and remote attribution, not the lifecycle,
// credit transaction, wallet lock, canonical receipt lookup or PostgreSQL drivers.
test('Stripe event recovery survives real process interruption and durable-credit replay', { timeout: 90_000 }, async t => {
  const db = await startDisposablePostgres('stripe-event-recovery');
  const folder = mkdtempSync(join(tmpdir(), 'stripe-recovery-worker-'));
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = db.databaseUrl;
  const children = new Set<ChildProcess>();
  const resources: { api?: RecoveryApi } = {};
  t.after(async () => {
    for (const child of children) {
      if (child.exitCode === null && child.signalCode === null) {
        const exited = once(child, 'exit');
        child.kill('SIGKILL');
        await exited;
      }
    }
    await resources.api?.getStripeEventPool().end();
    await resources.api?.getDb().end();
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
    await db.cleanup();
    rmSync(folder, { recursive: true, force: true });
  });
  await db.pool.query(`CREATE TABLE stripe_webhook_events (
    event_id text PRIMARY KEY, event_type text NOT NULL, processed_at timestamptz);
    CREATE TABLE app_receipts (
    id bigserial PRIMARY KEY, user_id text, type text, amount_cents integer, currency text,
    description text, metadata jsonb, stripe_payment_intent_id text UNIQUE, stripe_charge_id text,
    stripe_checkout_session_id text UNIQUE, stripe_invoice_id text, platform_revenue_cents integer,
    destination_acct text, original_amount_cents integer, original_currency text, fx_rate numeric,
    fx_margin_bps integer, fx_rate_timestamp timestamptz, stripe_customer_id text,
    stripe_hosted_invoice_url text, stripe_invoice_pdf text, stripe_receipt_url text,
    stripe_document_synced_at timestamptz, created_at timestamptz DEFAULT now())`);
  const runtime = join(folder, 'runtime.cjs');
  await build({
    stdin: { contents: `
      export { runStripeEvent, getStripeEventPool } from './frontend/app/api/stripe/webhook/_lib/stripe-webhook-event-state';
      export { recordStripeTopup } from './frontend/app/api/stripe/webhook/_lib/stripe-webhook-topup-persistence';
      export { getDb } from './frontend/src/lib/db';
    `, resolveDir: process.cwd(), loader: 'ts' },
    outfile: runtime, bundle: true, platform: 'node', format: 'cjs', packages: 'external',
    tsconfig: 'frontend/tsconfig.json', plugins: [{ name: 'offline-boundaries', setup(b) {
      const stubs: Record<string, string> = {
        '@/lib/schema': 'export async function ensureBillingSchema() {}',
        '@/lib/currency': 'export async function ensureUserPreferredCurrency() {} export function normalizeCurrencyCode(v) { return v; } export async function getUserPreferredCurrency() { return null; }',
        '@/server/agent-api/mcp-funnel': 'export async function recordConfirmedMcpWalletFunding() {} export function resolveMcpTrialToWalletWindowSeconds() { return 1; }',
      };
      b.onResolve({ filter: /^pg$/ }, () => ({ path: createRequire(resolve('frontend/package.json')).resolve('pg'), external: true }));
      b.onResolve({ filter: /^@\// }, args => stubs[args.path] ? { path: args.path, namespace: 'boundary' } : undefined);
      b.onLoad({ filter: /.*/, namespace: 'boundary' }, args => ({ contents: stubs[args.path], loader: 'ts' }));
    } }],
  });
  const api = createRequire(resolve('frontend/package.json'))(runtime) as RecoveryApi;
  resources.api = api;
  // Only one business connection: holding lifecycle locks in that pool deadlocks.
  Reflect.set(Reflect.get(api.getDb(), 'options'), 'max', 1);
  const event = (id: string, type = 'payment_intent.succeeded') => ({ id, type }) as Stripe.Event;
  const input = (id: string) => ({ userId: 'recovery-owner', walletAmountCents: 2500, walletCurrency: 'USD',
    settlementAmountCents: 2500, settlementCurrency: 'USD', paymentIntentId: `pi_${id}`, metadata: {} });
  const credit = (id: string) => api.recordStripeTopup(input(id), { receiptsPriceOnly: false });
  const balance = async (id: string) => (await db.pool.query(
    'SELECT count(*)::int n, COALESCE(sum(amount_cents),0)::int cents FROM app_receipts WHERE stripe_payment_intent_id=$1', [`pi_${id}`],
  )).rows;
  const state = async (id: string) => (await db.pool.query('SELECT * FROM stripe_webhook_events WHERE event_id=$1', [id])).rows;
  const worker = join(folder, 'worker.cjs');
  writeFileSync(worker, `
    const api = require(process.argv[2]);
    const id = process.argv[3], phase = process.argv[4];
    api.runStripeEvent({id, type:'payment_intent.succeeded'}, async () => {
      if (phase === 'after-credit') await api.recordStripeTopup({userId:'recovery-owner',walletAmountCents:2500,
        walletCurrency:'USD',settlementAmountCents:2500,settlementCurrency:'USD',paymentIntentId:'pi_'+id,metadata:{}},
        {receiptsPriceOnly:false});
      process.send({phase});
      await new Promise(resolve => process.once('message', resolve));
    }).then(() => process.exit(0), error => { process.send({error:error.message}); process.exit(1); });
  `);

  for (const phase of ['before-credit', 'after-credit']) {
    await t.test(`SIGKILL ${phase} leaves a retryable event and exactly one credit after recovery`, async () => {
      const id = `evt_kill_${phase}`;
      const child = fork(worker, [runtime, id, phase], {
        env: { ...process.env, DATABASE_URL: db.databaseUrl }, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      });
      children.add(child);
      child.stdout?.resume(); child.stderr?.resume();
      const [message] = await once(child, 'message', { signal: AbortSignal.timeout(10_000) });
      assert.deepEqual(message, { phase });
      assert.deepEqual(await balance(id), [{ n: phase === 'after-credit' ? 1 : 0, cents: phase === 'after-credit' ? 2500 : 0 }]);
      await assert.rejects(api.runStripeEvent(event(id), () => credit(id)), /still processing/);
      const backends = (await db.pool.query<{ pid: number }>(`SELECT a.pid FROM pg_stat_activity a
        WHERE a.application_name='maxvideoai-stripe-events' AND a.state='idle in transaction'
        AND EXISTS(SELECT 1 FROM pg_locks l WHERE l.pid=a.pid AND l.locktype='advisory' AND l.granted)`)).rows;
      assert.equal(backends.length, 1, 'The worker must own exactly one lifecycle backend before interruption.');
      const exited = once(child, 'exit');
      child.kill('SIGKILL');
      await exited;
      // Node exit can precede PostgreSQL observing the closed connection.
      await waitForBackendExit(db.pool, backends[0].pid);
      assert.deepEqual(await state(id), []);
      assert.equal(await api.runStripeEvent(event(id), () => credit(id)), 'handled');
      assert.equal(await api.runStripeEvent(event(id), () => credit(id)), 'duplicate');
      assert.deepEqual(await balance(id), [{ n: 1, cents: 2500 }]);
      assert.ok((await state(id))[0].processed_at);
    });
  }

  await t.test('an active duplicate is retryable, while unrelated events can finish with one business connection', async () => {
    const entered = barrier(), release = barrier();
    const first = api.runStripeEvent(event('evt_busy'), async () => { entered.release(); await release.promise; await credit('evt_busy'); });
    try {
      await entered.promise;
      await assert.rejects(api.runStripeEvent(event('evt_busy'), () => credit('evt_busy')), /still processing/);
      assert.equal(await api.runStripeEvent(event('evt_other'), () => credit('evt_other')), 'handled');
    } finally { release.release(); await first; }
    assert.deepEqual(await balance('evt_busy'), [{ n: 1, cents: 2500 }]);
    assert.equal(await api.runStripeEvent(event('evt_busy'), () => credit('evt_busy')), 'duplicate');
  });

  await t.test('handler failure releases the transaction without needing a DELETE to succeed', async () => {
    await db.pool.query(`CREATE FUNCTION reject_event_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'DELETE unavailable'; END $$;
      CREATE TRIGGER reject_delete BEFORE DELETE ON stripe_webhook_events FOR EACH ROW EXECUTE FUNCTION reject_event_delete()`);
    await assert.rejects(api.runStripeEvent(event('evt_handler_failure'), async () => { throw new Error('business failure'); }), /business failure/);
    assert.deepEqual(await state('evt_handler_failure'), []);
    assert.equal(await api.runStripeEvent(event('evt_handler_failure'), () => credit('evt_handler_failure')), 'handled');
  });

  for (const timing of ['update', 'commit']) {
    await t.test(`completion ${timing} failure is retryable after the credit already committed`, async () => {
      const id = `evt_failure_${timing}`;
      await db.pool.query(`CREATE OR REPLACE FUNCTION reject_event_completion() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN IF NEW.event_id='${id}' AND NEW.processed_at IS NOT NULL THEN RAISE EXCEPTION 'completion unavailable'; END IF; RETURN NEW; END $$`);
      await db.pool.query(timing === 'commit'
        ? 'CREATE CONSTRAINT TRIGGER reject_completion AFTER UPDATE ON stripe_webhook_events DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION reject_event_completion()'
        : 'CREATE TRIGGER reject_completion BEFORE UPDATE ON stripe_webhook_events FOR EACH ROW EXECUTE FUNCTION reject_event_completion()');
      await assert.rejects(api.runStripeEvent(event(id), () => credit(id)), /completion unavailable/);
      assert.deepEqual(await state(id), []);
      assert.deepEqual(await balance(id), [{ n: 1, cents: 2500 }]);
      await db.pool.query('DROP TRIGGER reject_completion ON stripe_webhook_events');
      assert.equal(await api.runStripeEvent(event(id), () => credit(id)), 'handled');
      assert.deepEqual(await balance(id), [{ n: 1, cents: 2500 }]);
    });
  }

  await t.test('lost COMMIT acknowledgement retries as a completed duplicate without another credit', async () => {
    const id = 'evt_commit_ack_loss';
    const pool = {
      async connect() {
        const client = await api.getStripeEventPool().connect();
        return new Proxy(client, {
          get(target, property, receiver) {
            if (property === 'query') return async (sql: string, values?: unknown[]) => {
              const result = await target.query(sql, values);
              if (sql === 'COMMIT') throw new Error('injected lost COMMIT acknowledgement');
              return result;
            };
            return Reflect.get(target, property, receiver);
          },
        });
      },
    };
    await assert.rejects(api.runStripeEvent(event(id), () => credit(id), { pool: pool as Pick<Pool, 'connect'> }), /lost COMMIT acknowledgement/);
    assert.ok((await state(id))[0].processed_at);
    assert.equal(await api.runStripeEvent(event(id), () => credit(id)), 'duplicate');
    assert.deepEqual(await balance(id), [{ n: 1, cents: 2500 }]);
  });

  await t.test('completion time is recorded after durable business work rather than transaction start', async () => {
    const id = 'evt_completion_time';
    assert.equal(await api.runStripeEvent(event(id), () => credit(id)), 'handled');
    const rows = (await db.pool.query(`SELECT e.processed_at >= r.created_at AS ordered
      FROM stripe_webhook_events e JOIN app_receipts r ON r.stripe_payment_intent_id=$2
      WHERE e.event_id=$1`, [id, `pi_${id}`])).rows;
    assert.deepEqual(rows, [{ ordered: true }]);
  });

  await t.test('lost lifecycle connection cannot acknowledge and late business work still deduplicates', async () => {
    const id = 'evt_connection_loss';
    const entered = barrier(), release = barrier();
    const first = api.runStripeEvent(event(id), async () => { entered.release(); await release.promise; await credit(id); });
    const rejected = assert.rejects(first, /connection|terminat|query/i);
    try {
      await entered.promise;
      const pids = (await db.pool.query("SELECT pid FROM pg_stat_activity WHERE application_name='maxvideoai-stripe-events' AND state='idle in transaction'")).rows;
      assert.equal(pids.length, 1);
      // The default only confirms that SIGTERM was sent. Wait for the backend
      // to exit so its transaction lock is released before testing recovery.
      const termination = await db.pool.query<{ terminated: boolean }>(
        'SELECT pg_terminate_backend($1, 5000) AS terminated', [pids[0].pid],
      );
      assert.equal(termination.rows[0]?.terminated, true);
      assert.equal(await api.runStripeEvent(event(id), () => credit(id)), 'handled');
    } finally { release.release(); await rejected; }
    assert.deepEqual(await balance(id), [{ n: 1, cents: 2500 }]);
    assert.ok((await state(id))[0].processed_at);
  });

  for (const type of ['payment_intent.payment_failed', 'charge.failed', 'charge.refunded']) {
    await t.test(`legacy unfinished ${type} is preserved for reconciliation without replaying historical effects`, async () => {
      const id = `evt_legacy_${type}`;
      await db.pool.query('INSERT INTO stripe_webhook_events(event_id,event_type) VALUES($1,$2)', [id, type]);
      await assert.rejects(api.runStripeEvent(event(id, type), () => credit(id)), /requires reconciliation/);
      assert.deepEqual(await balance(id), [{ n: 0, cents: 0 }]);
      assert.equal((await state(id))[0].processed_at, null);
    });
  }

  await t.test('new non-funding events retry after failure and only become duplicates after completion', async () => {
    const e = event('evt_new_failed_card', 'charge.failed');
    await assert.rejects(api.runStripeEvent(e, async () => { throw new Error('temporary failure'); }), /temporary failure/);
    let handled = 0;
    assert.equal(await api.runStripeEvent(e, async () => { handled++; }), 'handled');
    assert.equal(await api.runStripeEvent(e, async () => { handled++; }), 'duplicate');
    assert.equal(handled, 1);
  });

  await t.test('schema failure and event identity mismatch cannot dispatch a business handler', async () => {
    const id = 'evt_schema';
    await assert.rejects(api.runStripeEvent(event(id), () => credit(id), {
      ensureSchema: async () => { throw new Error('schema unavailable'); },
    }), /schema unavailable/);
    assert.deepEqual(await state(id), []);
    assert.deepEqual(await balance(id), [{ n: 0, cents: 0 }]);
    await db.pool.query('INSERT INTO stripe_webhook_events(event_id,event_type,processed_at) VALUES($1,$2,NOW())', [id, 'invoice.paid']);
    await assert.rejects(api.runStripeEvent(event(id), () => credit(id)), /identity mismatch/);
    assert.deepEqual(await balance(id), [{ n: 0, cents: 0 }]);
  });
  await t.test('connection acquisition failure cannot dispatch or acknowledge an event', async () => {
    const unavailable = new Pool({ host: join(folder, 'missing-socket'), user: 'postgres', connectionTimeoutMillis: 100 });
    try {
      await assert.rejects(api.runStripeEvent(event('evt_unavailable'), () => credit('evt_unavailable'), { pool: unavailable }));
      assert.deepEqual(await state('evt_unavailable'), []);
      assert.deepEqual(await balance('evt_unavailable'), [{ n: 0, cents: 0 }]);
    } finally { await unavailable.end(); }
  });

  await t.test('no-database mock mode still dispatches without allocating a lifecycle connection', async () => {
    delete process.env.DATABASE_URL;
    try {
      let handled = 0;
      assert.equal(await api.runStripeEvent(event('evt_mock'), async () => { handled++; }), 'handled');
      assert.equal(handled, 1);
    } finally { process.env.DATABASE_URL = db.databaseUrl; }
    assert.deepEqual(await state('evt_mock'), []);
  });

});
