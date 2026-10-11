import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';
import type Stripe from 'stripe';
import { startDisposablePostgres } from './helpers/disposable-postgres';

const requireFrontend = createRequire(resolve('frontend/package.json'));

test('failed-card protection covers returning customers and preserves successful payments', { timeout: 60_000 }, async (t) => {
  const pg = await startDisposablePostgres('stripe-failed-cards');
  const folder = mkdtempSync(join(tmpdir(), 'stripe-failed-cards-bundle-'));
  const shared = globalThis as typeof globalThis & { __failedCardsPool?: typeof pg.pool };
  const previousDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = pg.databaseUrl;
  shared.__failedCardsPool = pg.pool;
  t.after(async () => {
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
    delete shared.__failedCardsPool;
    rmSync(folder, { recursive: true, force: true });
    await pg.cleanup();
  });
  await pg.pool.query(`
    CREATE TABLE checkout_attempts (id bigint PRIMARY KEY, user_id text, outcome text, reason text,
      stripe_checkout_session_id text, metadata jsonb);
    CREATE TABLE checkout_interaction_events (id bigserial PRIMARY KEY, checkout_attempt_id bigint,
      user_id text, stripe_checkout_session_id text, event_name text, mode text, amount_cents int,
      metadata jsonb, created_at timestamptz DEFAULT now());
    CREATE TABLE app_receipts (id bigserial PRIMARY KEY, user_id text, type text, amount_cents int,
      stripe_payment_intent_id text, stripe_charge_id text, stripe_checkout_session_id text);
  `);
  const output = join(folder, 'handler.cjs');
  await build({
    entryPoints: ['frontend/app/api/stripe/webhook/_lib/stripe-webhook-failed-payments.ts'],
    outfile: output, bundle: true, platform: 'node', format: 'cjs', packages: 'external',
    tsconfig: 'frontend/tsconfig.json',
    plugins: [{ name: 'disposable-db', setup(b) {
      b.onResolve({ filter: /^@\/lib\/db$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({
        loader: 'ts', contents: `
          export async function query(sql, params) {
            return (await globalThis.__failedCardsPool.query(sql, params)).rows;
          }
          export async function withDbTransaction(callback) {
            const client = await globalThis.__failedCardsPool.connect();
            try {
              await client.query('BEGIN');
              const result = await callback({
                query: async (sql, params) => (await client.query(sql, params)).rows,
              });
              await client.query('COMMIT');
              return result;
            } catch (error) {
              await client.query('ROLLBACK');
              throw error;
            } finally {
              client.release();
            }
          }
        `,
      }));
    } }],
  });
  const mod = requireFrontend(output) as typeof import('../frontend/app/api/stripe/webhook/_lib/stripe-webhook-failed-payments');
  let sequence = 0;

  async function raceNotifications(callbacks: (() => Promise<void>)[]) {
    const blocker = await pg.pool.connect();
    let pending: Promise<void>[] = [];
    try {
      await blocker.query('BEGIN');
      // Hold writes while both webhook requests reach a database lock. Before
      // the fix, both duplicate lookups finish before either insert can commit.
      await blocker.query('LOCK TABLE checkout_interaction_events IN SHARE MODE');
      pending = callbacks.map(callback => callback());
      const deadline = Date.now() + 5000;
      while (true) {
        const { rows } = await pg.pool.query(`SELECT count(*)::int AS blocked
          FROM pg_stat_activity WHERE datname=current_database()
            AND wait_event_type='Lock' AND state='active'`);
        if (rows[0].blocked >= callbacks.length) break;
        assert.ok(Date.now() < deadline, 'both concurrent webhook handlers must reach the write barrier');
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    } finally {
      await blocker.query('ROLLBACK');
      blocker.release();
      await Promise.all(pending);
    }
  }

  async function scenario(options: {
    firstTopup?: boolean; successfulSession?: boolean; currentReceipt?: boolean; missingMetadata?: boolean;
    concurrentFourth?: boolean; historicalDuplicate?: boolean;
  } = {}) {
    const id = ++sequence;
    const user = `user_${id}`, sessionId = `cs_${id}`, intentId = `pi_${id}`;
    const metadata = options.missingMetadata ? {} : {
      kind: 'topup', user_id: user, checkout_attempt_id: String(id),
      first_wallet_topup: String(options.firstTopup ?? false), checkout_ui_mode: 'hosted',
    };
    await pg.pool.query('INSERT INTO checkout_attempts VALUES ($1,$2,$3,NULL,$4,NULL)',
      [id, user, 'session_created', sessionId]);
    // A legitimate older payment must not grant immunity to subsequent card testing.
    await pg.pool.query(`INSERT INTO app_receipts
      (user_id,type,amount_cents,stripe_payment_intent_id,stripe_charge_id,stripe_checkout_session_id)
      VALUES ($1,'topup',1000,$2,$3,$4)`,
    [user, options.currentReceipt ? intentId : 'pi_previous', 'ch_paid', options.currentReceipt ? sessionId : 'cs_previous']);
    const expired: string[] = [];
    let sessionExpired = false;
    const intent = { id: intentId, metadata, customer: 'cus_test' } as unknown as Stripe.PaymentIntent;
    const stripe = {
      paymentIntents: { retrieve: async () => intent },
      checkout: { sessions: {
        retrieve: async () => ({
          id: sessionId, status: sessionExpired ? 'expired' : options.successfulSession ? 'complete' : 'open',
          payment_status: options.successfulSession ? 'paid' : 'unpaid', amount_total: 1000, metadata,
        }),
        expire: async (session: string) => {
          assert.equal(sessionExpired, false, 'Stripe cannot expire a session twice');
          sessionExpired = true;
          expired.push(session);
          return { id: session, status: 'expired' };
        },
      } },
      charges: { retrieve: async (charge: string) => chargeFor(charge) },
    } as unknown as Stripe;
    function chargeFor(chargeId: string) {
      return { id: chargeId, amount: 1000, status: 'failed', payment_intent: intentId, metadata,
        outcome: { risk_level: 'highest', reason: 'highest_risk_level' },
        payment_method_details: { card: { brand: 'amex', country: 'US' } } } as unknown as Stripe.Charge;
    }
    const event = (chargeId: string) => ({ data: { object: chargeFor(chargeId) } }) as Stripe.Event;
    for (let n = 1; n <= 3; n++) await mod.handleChargeFailed(event(`ch_${id}_${n}`), stripe);
    if (options.historicalDuplicate) {
      await pg.pool.query(`INSERT INTO checkout_interaction_events
        (checkout_attempt_id,user_id,event_name,metadata)
        VALUES ($1,$2,'stripe_charge_failed',$3)`,
      [id, user, JSON.stringify({ stripe_charge_id: `ch_${id}_3` })]);
    }
    const fourthIntentEvent = { data: { object: {
      ...intent, latest_charge: `ch_${id}_4`,
    } } } as unknown as Stripe.Event;
    if (options.concurrentFourth) {
      await raceNotifications([
        () => mod.handleChargeFailed(event(`ch_${id}_4`), stripe),
        () => mod.handlePaymentIntentFailed(fourthIntentEvent, stripe),
      ]);
    } else {
      await mod.handleChargeFailed(event(`ch_${id}_4`), stripe);
    }
    assert.deepEqual(expired, [], 'four failed cards must not expire a session');
    // Both Stripe notifications for one charge must count as one failed card.
    await mod.handlePaymentIntentFailed(fourthIntentEvent, stripe);
    assert.deepEqual(expired, [], 'duplicate PaymentIntent notification must not hit the limit');
    await mod.handleChargeFailed(event(`ch_${id}_5`), stripe);
    await mod.handleChargeFailed(event(`ch_${id}_5`), stripe);
    const rows = await pg.pool.query(`SELECT event_name,COUNT(*)::int AS count
      FROM checkout_interaction_events WHERE checkout_attempt_id=$1 GROUP BY event_name`, [id]);
    const counts = Object.fromEntries(rows.rows.map(row => [row.event_name, row.count]));
    const attempt = (await pg.pool.query('SELECT outcome,reason FROM checkout_attempts WHERE id=$1', [id])).rows[0];
    return { expired, counts, attempt, sessionId };
  }

  await t.test('a returning customer is stopped at five distinct failures despite an earlier paid top-up', async () => {
    const result = await scenario();
    assert.deepEqual(result.expired, [result.sessionId]);
    assert.equal(result.counts.stripe_charge_failed, 5);
    assert.equal(result.counts.stripe_checkout_session_expired_for_failed_cards, 1);
    assert.deepEqual(result.attempt, { outcome: 'rate_limited', reason: 'failed_card_attempt_limit' });
  });
  await t.test('first-top-up metadata cannot bypass protection once an older receipt exists', async () => {
    const result = await scenario({ firstTopup: true });
    assert.deepEqual(result.expired, [result.sessionId]);
  });
  await t.test('concurrent charge and intent notifications count the fourth failure only once', async () => {
    const result = await scenario({ concurrentFourth: true });
    assert.deepEqual(result.expired, [result.sessionId]);
    assert.equal(result.counts.stripe_charge_failed, 5);
    assert.equal(result.counts.stripe_checkout_session_expired_for_failed_cards, 1);
  });
  await t.test('historical duplicate rows do not count as extra failures and remain intact', async () => {
    const result = await scenario({ historicalDuplicate: true });
    assert.deepEqual(result.expired, [result.sessionId]);
    assert.equal(result.counts.stripe_charge_failed, 6);
    assert.equal(result.counts.stripe_checkout_session_expired_for_failed_cards, 1);
  });
  await t.test('a receipt for the current payment prevents expiry even if Stripe is temporarily stale', async () => {
    const result = await scenario({ currentReceipt: true });
    assert.deepEqual(result.expired, []);
    assert.equal(result.counts.stripe_charge_failed, 5);
  });
  await t.test('a completed paid Stripe session is never expired', async () => {
    const result = await scenario({ successfulSession: true });
    assert.deepEqual(result.expired, []);
    assert.equal(result.counts.stripe_charge_failed, 5);
  });
  await t.test('unrelated charges without wallet attribution are ignored', async () => {
    const result = await scenario({ missingMetadata: true });
    assert.deepEqual(result.expired, []);
    assert.deepEqual(result.counts, {});
  });
});
