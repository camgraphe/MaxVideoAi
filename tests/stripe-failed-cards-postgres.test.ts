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
      stripe_checkout_session_id text, metadata jsonb, created_at timestamptz DEFAULT now());
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
    successfulIntent?: boolean;
    sameCard?: boolean;
  } = {}) {
    const id = ++sequence;
    const user = `user_${id}`, sessionId = `cs_${id}`, intentId = `pi_${id}`;
    const metadata = options.missingMetadata ? {} : {
      kind: 'topup', user_id: user, checkout_attempt_id: String(id),
      first_wallet_topup: String(options.firstTopup ?? false), checkout_ui_mode: 'hosted',
    };
    await pg.pool.query('INSERT INTO checkout_attempts (id,user_id,outcome,reason,stripe_checkout_session_id,metadata) VALUES ($1,$2,$3,NULL,$4,NULL)',
      [id, user, 'session_created', sessionId]);
    // A legitimate older payment must not grant immunity to subsequent card testing.
    await pg.pool.query(`INSERT INTO app_receipts
      (user_id,type,amount_cents,stripe_payment_intent_id,stripe_charge_id,stripe_checkout_session_id)
      VALUES ($1,'topup',1000,$2,$3,$4)`,
    [user, options.currentReceipt ? intentId : 'pi_previous', 'ch_paid', options.currentReceipt ? sessionId : 'cs_previous']);
    const expired: string[] = [];
    let sessionExpired = false;
    const intent = { id: intentId, metadata, customer: 'cus_test', status: options.successfulIntent || options.successfulSession ? 'succeeded' : 'requires_payment_method' } as unknown as Stripe.PaymentIntent;
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
        payment_method_details: { card: { brand: 'amex', country: 'US', fingerprint: options.sameCard ? 'fp_same' : undefined } } } as unknown as Stripe.Charge;
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
    assert.equal(result.counts.stripe_failed_card_cooldown_started,undefined);
  });
  await t.test('a succeeded current intent prevents cooldown while its receipt and session state are delayed', async () => {
    const result=await scenario({successfulIntent:true});
    assert.deepEqual(result.expired,[]);
    assert.equal(result.counts.stripe_failed_card_cooldown_started,undefined);
  });
  await t.test('unrelated charges without wallet attribution are ignored', async () => {
    const result = await scenario({ missingMetadata: true });
    assert.deepEqual(result.expired, []);
    assert.deepEqual(result.counts, {});
  });

  async function distinctCardScenario() {
    const first = ++sequence, second = ++sequence;
    const user = `distinct_user_${first}`;
    const sessions = new Map<number, { id: string; status: string; payment_status: string; amount_total: number; metadata: Record<string, string> }>();
    const charges = new Map<string, Stripe.Charge>();
    const expired: string[] = [];
    for (const id of [first, second]) {
      const metadata = { kind: 'topup', user_id: user, checkout_attempt_id: String(id), checkout_ui_mode: 'hosted' };
      sessions.set(id, { id: `cs_${id}`, status: 'open', payment_status: 'unpaid', amount_total: 1000, metadata });
      await pg.pool.query('INSERT INTO checkout_attempts (id,user_id,outcome,stripe_checkout_session_id) VALUES ($1,$2,\'session_created\',$3)', [id,user,`cs_${id}`]);
    }
    const stripe = {
      paymentIntents: { retrieve: async (id: string) => ({ id, metadata: sessions.get(Number(id.slice(3)))!.metadata }) },
      charges: { retrieve: async (id: string) => charges.get(id) },
      checkout: { sessions: {
        retrieve: async (id: string) => sessions.get(Number(id.slice(3))),
        expire: async (id: string) => {
          const session = sessions.get(Number(id.slice(3)))!;
          if (session.status === 'open') { session.status = 'expired'; expired.push(id); }
          return session;
        },
      } },
    } as unknown as Stripe;
    async function fail(attempt: number, fingerprint: string | null, suffix: string, secondsAgo = 0) {
      const charge = { id: `ch_distinct_${first}_${suffix}`, amount: 1000, status: 'failed',
        payment_intent: `pi_${attempt}`, payment_method: `pm_${suffix}`, metadata: sessions.get(attempt)!.metadata,
        payment_method_details: { type: 'card', card: { brand: 'visa', country: 'US', fingerprint } } } as unknown as Stripe.Charge;
      charges.set(charge.id, charge);
      const event = { id: `evt_${charge.id}`, type: 'charge.failed', created: Math.floor(Date.now()/1000)-secondsAgo, data: { object: charge } } as Stripe.Event;
      await mod.handleChargeFailed(event, stripe);
      return charge;
    }
    return { first, second, user, sessions, stripe, expired, fail };
  }

  await t.test('three distinct failed cards across sessions stop both unpaid sessions and start one cooldown', async () => {
    const s = await distinctCardScenario();
    await s.fail(s.first, 'fp_A', 'A');
    await s.fail(s.second, 'fp_B', 'B');
    assert.deepEqual(s.expired, [], 'two cards remain below the threshold');
    await s.fail(s.second, 'fp_C', 'C');
    assert.deepEqual(s.expired.sort(), [`cs_${s.first}`, `cs_${s.second}`].sort());
    const rows = await pg.pool.query("SELECT count(*)::int AS n FROM checkout_interaction_events WHERE user_id=$1 AND event_name='stripe_failed_card_cooldown_started'", [s.user]);
    assert.equal(rows.rows[0].n, 1);
  });

  await t.test('repeated declines and new payment method IDs for the same card do not count as different cards', async () => {
    const s = await distinctCardScenario();
    for (let n=0; n<4; n++) await s.fail(s.first, 'fp_same', `same_${n}`);
    assert.deepEqual(s.expired, [], 'four retries of one card do not hit either safeguard');
  });
  await t.test('the existing fifth-failure safeguard still stops repeated probing of one known card',async()=>{
    const result=await scenario({sameCard:true});
    assert.deepEqual(result.expired,[result.sessionId]);
  });

  await t.test('a delayed notification does not rearm an expired legacy session after cooldown completion',async()=>{
    const s=await distinctCardScenario();
    for(let n=0;n<5;n++) await s.fail(s.first,null,`legacy_${n}`);
    const before=await pg.pool.query("SELECT count(*)::int AS n FROM checkout_interaction_events WHERE user_id=$1 AND event_name='stripe_failed_card_cooldown_started'",[s.user]);
    await pg.pool.query("UPDATE checkout_interaction_events SET created_at=now()-interval '31 minutes' WHERE user_id=$1",[s.user]);
    const event={id:'evt_late_legacy',created:Math.floor(Date.now()/1000)-1900,type:'payment_intent.payment_failed',data:{object:{
      id:`pi_${s.first}`,amount:1000,status:'requires_payment_method',metadata:s.sessions.get(s.first)!.metadata,
      last_payment_error:{code:'card_declined',payment_method:{id:'pm_delayed_unknown',type:'card',card:{brand:'visa'}}},
    }}} as unknown as Stripe.Event;
    await mod.handlePaymentIntentFailed(event,s.stripe);
    const after=await pg.pool.query("SELECT count(*)::int AS n FROM checkout_interaction_events WHERE user_id=$1 AND event_name='stripe_failed_card_cooldown_started'",[s.user]);
    assert.equal(after.rows[0].n,before.rows[0].n);
  });

  await t.test('five delayed failures on an already expired session cannot start a new legacy cooldown',async()=>{
    const s=await distinctCardScenario();
    for(let n=0;n<4;n++) await s.fail(s.first,null,`expired_${n}`);
    s.sessions.get(s.first)!.status='expired';
    await s.fail(s.first,null,'expired_fifth');
    assert.deepEqual(s.expired,[],'the unrelated unpaid sibling must remain available');
    const rows=await pg.pool.query("SELECT count(*)::int AS n FROM checkout_interaction_events WHERE user_id=$1 AND event_name='stripe_failed_card_cooldown_started'",[s.user]);
    assert.equal(rows.rows[0].n,0);
  });

  await t.test('old delayed failures outside ten minutes do not trigger the distinct-card threshold', async () => {
    const s = await distinctCardScenario();
    await s.fail(s.first, 'fp_old', 'old', 601);
    await s.fail(s.first, 'fp_recent_A', 'recent_A');
    await s.fail(s.second, 'fp_recent_B', 'recent_B');
    assert.deepEqual(s.expired, []);
  });

  await t.test('authentication failures with a stale latest_charge still count the newly attempted card', async () => {
    const s = await distinctCardScenario();
    const previous = await s.fail(s.first, 'fp_A', 'auth_A');
    await s.fail(s.second, 'fp_B', 'auth_B');
    const event = { id: 'evt_auth_C', type: 'payment_intent.payment_failed', created: Math.floor(Date.now()/1000), data: { object: {
      id: `pi_${s.first}`, amount: 1000, metadata: s.sessions.get(s.first)!.metadata, latest_charge: previous.id,
      last_payment_error: { code: 'payment_intent_authentication_failure', payment_method: {
        id: 'pm_auth_C', type: 'card', card: { brand: 'visa', country: 'US', fingerprint: 'fp_C' },
      } },
    } } } as unknown as Stripe.Event;
    await mod.handlePaymentIntentFailed(event, s.stripe);
    assert.deepEqual(s.expired.sort(), [`cs_${s.first}`, `cs_${s.second}`].sort());
  });

  await t.test('concurrent failures on different sessions serialize the shared counter and cooldown', async () => {
    const s = await distinctCardScenario();
    await s.fail(s.first, 'fp_A', 'race_A');
    await raceNotifications([
      () => s.fail(s.first, 'fp_B', 'race_B').then(() => {}),
      () => s.fail(s.second, 'fp_C', 'race_C').then(() => {}),
    ]);
    assert.equal(s.expired.length, 2);
    const rows = await pg.pool.query("SELECT count(*)::int AS n FROM checkout_interaction_events WHERE user_id=$1 AND event_name='stripe_failed_card_cooldown_started'", [s.user]);
    assert.equal(rows.rows[0].n, 1);
  });

  await t.test('other customers do not contribute cards to a user cooldown', async () => {
    const s = await distinctCardScenario(), other = await distinctCardScenario();
    await s.fail(s.first, 'fp_A', 'isolated_A');
    await other.fail(other.first, 'fp_B', 'isolated_B');
    await other.fail(other.second, 'fp_C', 'isolated_C');
    assert.deepEqual(s.expired, []);
    assert.deepEqual(other.expired, []);
  });

  await t.test('paid sibling sessions and their wallet receipts survive another session reaching the threshold', async () => {
    const s = await distinctCardScenario();
    await s.fail(s.first, 'fp_A', 'paid_A');
    s.sessions.get(s.first)!.status='complete'; s.sessions.get(s.first)!.payment_status='paid';
    await pg.pool.query('INSERT INTO app_receipts (user_id,type,amount_cents,stripe_payment_intent_id,stripe_checkout_session_id) VALUES ($1,\'topup\',1000,$2,$3)',[s.user,`pi_${s.first}`,`cs_${s.first}`]);
    await s.fail(s.second, 'fp_B', 'paid_B');
    await s.fail(s.second, 'fp_C', 'paid_C');
    assert.deepEqual(s.expired, [`cs_${s.second}`]);
    const rows=await pg.pool.query('SELECT amount_cents FROM app_receipts WHERE user_id=$1',[s.user]);
    assert.deepEqual(rows.rows,[{amount_cents:1000}]);
  });

  await t.test('a Charge lookup outage cannot count each signed charge and intent notification twice', async () => {
    const s=await distinctCardScenario();
    s.stripe.charges.retrieve=async()=>{throw new Error('temporary charge lookup outage');};
    for(let n=0;n<4;n++) {
      const charge=await s.fail(s.first,null,`lookup_${n}`);
      const event={id:`evt_intent_${n}`,created:Math.floor(Date.now()/1000),type:'payment_intent.payment_failed',data:{object:{
        id:`pi_${s.first}`,amount:1000,metadata:s.sessions.get(s.first)!.metadata,latest_charge:charge.id,
        last_payment_error:{code:'card_declined',charge:charge.id,payment_method:{id:charge.payment_method,type:'card',card:{brand:'visa'}}},
      }}} as unknown as Stripe.Event;
      await mod.handlePaymentIntentFailed(event,s.stripe);
      assert.deepEqual(s.expired,[],'four unidentified failures must remain below the fallback limit');
    }
    const rows=await pg.pool.query("SELECT count(*)::int AS n FROM checkout_interaction_events WHERE user_id=$1 AND event_name='stripe_charge_failed'",[s.user]);
    assert.equal(rows.rows[0].n,4,'signed last_payment_error.charge preserves dedupe when GET fails');
  });

  await t.test('an old signed intent failure cannot start cooldown after the live intent succeeded', async () => {
    const s=await distinctCardScenario();
    const previous=await s.fail(s.first,'fp_A','ordered_A');
    await s.fail(s.second,'fp_B','ordered_B');
    s.sessions.get(s.first)!.status='complete';s.sessions.get(s.first)!.payment_status='paid';
    s.stripe.paymentIntents.retrieve=async(id: string)=>({id,status:'succeeded',metadata:s.sessions.get(s.first)!.metadata} as Stripe.PaymentIntent);
    const event={id:'evt_delayed_signed_intent',created:Math.floor(Date.now()/1000),type:'payment_intent.payment_failed',data:{object:{
      id:`pi_${s.first}`,status:'requires_payment_method',amount:1000,metadata:s.sessions.get(s.first)!.metadata,latest_charge:previous.id,
      last_payment_error:{code:'payment_intent_authentication_failure',payment_method:{id:'pm_ordered_C',type:'card',card:{brand:'visa',fingerprint:'fp_C'}}},
    }}} as unknown as Stripe.Event;
    await mod.handlePaymentIntentFailed(event,s.stripe);
    assert.deepEqual(s.expired,[],'an already successful current payment must not expire an unpaid sibling');
    const rows=await pg.pool.query("SELECT count(*)::int AS n FROM checkout_interaction_events WHERE user_id=$1 AND event_name='stripe_failed_card_cooldown_started'",[s.user]);
    assert.equal(rows.rows[0].n,0);
  });
});
