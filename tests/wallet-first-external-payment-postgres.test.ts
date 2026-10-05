import assert from 'node:assert/strict';
import test from 'node:test';
import { startDisposablePostgres, missingDisposablePostgresCommand } from './helpers/disposable-postgres';
import type { QueryExecutor } from '../frontend/src/lib/db';

test('first external payment ignores manual and test credit, serializes live payments, and treats legacy external receipts conservatively', async (t) => {
  const missing = missingDisposablePostgresCommand();
  if (missing) throw new Error(`Required disposable PostgreSQL command missing: ${missing}`);
  const db = await startDisposablePostgres('first-external-payment');
  const clients: Array<Awaited<ReturnType<typeof db.pool.connect>>> = [];
  t.after(async () => { clients.forEach((client) => client.release()); await db.cleanup(); });
  const mod = await import('../frontend/server/wallet-first-topup') as Record<string, unknown>;
  assert.equal(typeof mod.resolveFirstExternalPaymentUnderWalletLock, 'function');
  const resolveFirst = mod.resolveFirstExternalPaymentUnderWalletLock as (executor: QueryExecutor, userId: string) => Promise<boolean | null>;
  const { lockAndResolveFirstWalletTopup } = await import('../frontend/server/wallet-first-topup');
  await db.pool.query(`CREATE TABLE app_receipts (
    user_id text, type text, amount_cents integer, metadata jsonb,
    stripe_payment_intent_id text, stripe_charge_id text, stripe_checkout_session_id text
  )`);
  await db.pool.query(`INSERT INTO app_receipts VALUES
    ('customer','topup',1000,'{"reason":"manual_admin_topup"}',NULL,NULL,NULL),
    ('customer','topup',1000,'{"stripe_livemode":false}','pi_test',NULL,NULL),
    ('legacy','topup',1000,'{}','pi_legacy',NULL,NULL),
    ('direct_payer','charge',500,'{}','pi_run',NULL,NULL)`);
  const firstClient = await db.pool.connect();
  const secondClient = await db.pool.connect();
  clients.push(firstClient, secondClient);
  const wrap = (client: typeof firstClient): QueryExecutor => ({
    query: async <T>(sql: string, params?: ReadonlyArray<unknown>) => (await client.query(sql, params ? [...params] : undefined)).rows as T[],
  });
  await firstClient.query('BEGIN');
  assert.equal(await lockAndResolveFirstWalletTopup(wrap(firstClient), 'customer'), false);
  assert.equal(await resolveFirst(wrap(firstClient), 'customer'), true);
  await secondClient.query('BEGIN');
  let secondAcquiredLock = false;
  const second = (async () => {
    await lockAndResolveFirstWalletTopup(wrap(secondClient), 'customer');
    secondAcquiredLock = true;
    return resolveFirst(wrap(secondClient), 'customer');
  })();
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal(secondAcquiredLock, false);
  await firstClient.query(`INSERT INTO app_receipts VALUES ('customer','topup',1000,'{"stripe_livemode":true}','pi_live',NULL,NULL)`);
  await firstClient.query('COMMIT');
  assert.equal(await second, false);
  await secondClient.query('COMMIT');
  await firstClient.query('BEGIN');
  assert.equal(await resolveFirst(wrap(firstClient), 'legacy'), false);
  assert.equal(await resolveFirst(wrap(firstClient), 'direct_payer'), false);
  await firstClient.query('COMMIT');
  await firstClient.query('BEGIN');
  const brokenHistory: QueryExecutor = {
    query: async <T>(sql: string, params?: ReadonlyArray<unknown>) => {
      if (sql.includes('AS has_external_payment')) return (await firstClient.query('SELECT missing_measurement_column FROM app_receipts')).rows as T[];
      return wrap(firstClient).query<T>(sql, params);
    },
  };
  assert.equal(await resolveFirst(brokenHistory, 'customer'), null);
  // A real SQL error is recovered before financial writes, not merely caught.
  await firstClient.query(`INSERT INTO app_receipts VALUES ('recovered','topup',1000,'{}','pi_recovered',NULL,NULL)`);
  await firstClient.query('COMMIT');
  assert.equal((await firstClient.query(`SELECT count(*)::int AS count FROM app_receipts WHERE user_id='recovered'`)).rows[0].count, 1);
});

test('commercial payment analytics suppresses test mode, current and legacy admins, and unavailable role data', async (t) => {
  const db = await startDisposablePostgres('commercial-ga4');
  t.after(() => db.cleanup());
  const mod = await import('../frontend/server/wallet-first-topup') as Record<string, unknown>;
  assert.equal(typeof mod.isCommercialPaymentAnalyticsEligible, 'function');
  const eligible = mod.isCommercialPaymentAnalyticsEligible as (executor: QueryExecutor, userId: string, liveMode: unknown) => Promise<boolean>;
  const executor: QueryExecutor = { query: async <T>(sql: string, params?: ReadonlyArray<unknown>) => (await db.pool.query(sql, params ? [...params] : undefined)).rows as T[] };
  assert.equal(await eligible(executor, 'customer', true), false);
  await db.pool.query(`CREATE TABLE user_roles(user_id text, role text); CREATE TABLE app_admins(user_id text);
    INSERT INTO user_roles VALUES ('admin','admin'); INSERT INTO app_admins VALUES ('legacy_admin')`);
  assert.equal(await eligible(executor, 'customer', true), true);
  assert.equal(await eligible(executor, 'customer', false), false);
  assert.equal(await eligible(executor, 'customer', undefined), false);
  assert.equal(await eligible(executor, 'admin', true), false);
  assert.equal(await eligible(executor, 'legacy_admin', true), false);
  assert.equal(await eligible({ query: async () => { throw new Error('offline'); } }, 'customer', true), false);
});
