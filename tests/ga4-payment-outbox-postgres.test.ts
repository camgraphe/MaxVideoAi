import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { startDisposablePostgres } from './helpers/disposable-postgres';
import { createQueryExecutor } from '../frontend/src/lib/db';
import { enqueueGa4PaymentEvent, claimGa4PaymentEvents, finishGa4PaymentEvent } from '../frontend/server/ga4-payment-outbox';

test('durable payment intents survive restarts, dedupe concurrent inserts and fence stale workers', async (t) => {
  const pg = await startDisposablePostgres('ga4-outbox');
  t.after(() => pg.cleanup());
  const db = createQueryExecutor(pg.pool);
  const migration = readFileSync('neon/migrations/76_ga4_payment_outbox.sql', 'utf8');
  await pg.pool.query(migration);
  await pg.pool.query(migration);
  const input = { key: 'receipt:1:purchase', userId: 'fixture', occurredAt: new Date(), consentObservedAt: new Date(), event: { name: 'purchase' as const, clientId: '123.456', userId: 'fixture', params: { value: 25, currency: 'EUR', transaction_id: 'pi_fixture' } } };
  await Promise.all(Array.from({ length: 5 }, () => enqueueGa4PaymentEvent(db, input)));
  assert.equal((await db.query<{ count: string }>('SELECT count(*) FROM ga4_payment_outbox'))[0].count, '1');
  const client = await pg.pool.connect();
  try {
    await client.query('BEGIN');
    await enqueueGa4PaymentEvent(createQueryExecutor(client), { ...input, key: 'rollback' });
    await client.query('ROLLBACK');
  } finally { client.release(); }
  assert.equal((await db.query('SELECT * FROM ga4_payment_outbox WHERE event_key=$1', ['rollback'])).length, 0);
  const claims = await Promise.all([claimGa4PaymentEvents(db, 1), claimGa4PaymentEvents(db, 1)]);
  const first = claims.flat();
  assert.equal(first.length, 1);
  assert.equal(first[0].attempts, 1);
  await db.query("UPDATE ga4_payment_outbox SET lease_until=now()-interval '1 second'");
  const [recovered] = await claimGa4PaymentEvents(db, 1);
  assert.equal(recovered.attempts, 2);
  assert.notEqual(recovered.lease_token, first[0].lease_token);
  assert.equal(await finishGa4PaymentEvent(db, first[0], { status: 'accepted', code: 'http_2xx' }), false);
  await finishGa4PaymentEvent(db, recovered, { status: 'retry', code: 'network' });
  assert.equal((await claimGa4PaymentEvents(db, 1)).length, 0, 'backoff must prevent immediate retries');
  await db.query('UPDATE ga4_payment_outbox SET available_at=now()');
  const [next] = await claimGa4PaymentEvents(db, 1);
  await finishGa4PaymentEvent(db, next, { status: 'accepted', code: 'http_2xx' });
  await enqueueGa4PaymentEvent(db, input);
  assert.equal((await claimGa4PaymentEvents(db, 1)).length, 0, 'accepted tombstone prevents replay');
  const [stored] = await db.query<{ status: string; payload: unknown; user_id: unknown }>('SELECT status,payload,user_id FROM ga4_payment_outbox');
  assert.equal(stored.status, 'accepted'); assert.equal(stored.payload, null); assert.equal(stored.user_id, null);
});

test('expired events and exhausted crash leases become scrubbed terminal records', async (t) => {
  const pg = await startDisposablePostgres('ga4-expiry'); t.after(() => pg.cleanup());
  const db = createQueryExecutor(pg.pool);
  await pg.pool.query(readFileSync('neon/migrations/76_ga4_payment_outbox.sql', 'utf8'));
  const input = { key: 'old', userId: 'fixture', occurredAt: new Date(Date.now()-72*3600_000), consentObservedAt: new Date(0), event: { name: 'purchase' as const, userId: 'fixture' } };
  await enqueueGa4PaymentEvent(db, input);
  assert.deepEqual(await claimGa4PaymentEvents(db, 20), []);
  assert.equal((await db.query<{status:string}>('SELECT status FROM ga4_payment_outbox'))[0].status, 'expired');
  await enqueueGa4PaymentEvent(db, { ...input, key: 'crashed', occurredAt: new Date() });
  await db.query("UPDATE ga4_payment_outbox SET status='leased',attempts=8,lease_token=gen_random_uuid(),lease_until=now()-interval '1 second' WHERE event_key='crashed'");
  assert.deepEqual(await claimGa4PaymentEvents(db, 20), []);
  assert.deepEqual(await db.query("SELECT status,payload,user_id FROM ga4_payment_outbox WHERE event_key='crashed'"), [{ status: 'dead', payload: null, user_id: null }]);
});
