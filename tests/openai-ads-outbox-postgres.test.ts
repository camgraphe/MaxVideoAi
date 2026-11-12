import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { startDisposablePostgres } from './helpers/disposable-postgres';
import { createQueryExecutor } from '../frontend/src/lib/db';
import {
  enqueueOpenAIConversion,
  claimOpenAIConversions,
  finishOpenAIConversion,
} from '../frontend/server/openai-conversions-outbox';
import { drainOpenAIConversions, repairOpenAIOrders } from '../frontend/server/openai-conversions-worker';

test('OpenAI delivery deduplicates concurrent events, fences leases and clears terminal identifiers', async (t) => {
  const pg = await startDisposablePostgres('openai-outbox');
  t.after(() => pg.cleanup());
  const db = createQueryExecutor(pg.pool);
  const sql = readFileSync('neon/migrations/99_openai_conversion_outbox.sql', 'utf8');
  await pg.pool.query(sql);
  await pg.pool.query(sql);
  const input = {
    userId: 'fixture',
    consentObservedAt: new Date(),
    policyVersion: 'policy',
    event: {
      id: 'opaque-fixture',
      type: 'registration_completed' as const,
      timestamp_ms: Date.now(),
      source_url: 'https://maxvideoai.com' as const,
      action_source: 'web' as const,
      oppref: 'opaque-click',
      opt_out: true as const,
      data: { type: 'customer_action' as const },
    },
  };
  await Promise.all(Array.from({ length: 4 }, () => enqueueOpenAIConversion(db, input)));
  const claims = (await Promise.all([claimOpenAIConversions(db), claimOpenAIConversions(db)])).flat();
  assert.equal(claims.length, 1);
  await db.query("UPDATE openai_conversion_outbox SET lease_until=now()-interval '1 second'");
  const [recovered] = await claimOpenAIConversions(db);
  assert.equal(await finishOpenAIConversion(db, claims[0], { status: 'accepted', code: 'http_2xx' }), false);
  assert.equal(await finishOpenAIConversion(db, recovered, { status: 'accepted', code: 'http_2xx' }), true);
  await enqueueOpenAIConversion(db, input);
  assert.deepEqual(await claimOpenAIConversions(db), []);
  assert.deepEqual(await db.query('SELECT status,payload,user_id FROM openai_conversion_outbox'), [
    { status: 'accepted', payload: null, user_id: null },
  ]);
});

test('only new live consented receipts convert, and admin or withdrawn consent never reaches OpenAI', async (t) => {
  const pg = await startDisposablePostgres('openai-worker');
  t.after(() => pg.cleanup());
  const db = createQueryExecutor(pg.pool);
  await pg.pool.query(readFileSync('neon/migrations/99_openai_conversion_outbox.sql', 'utf8'));
  await pg.pool
    .query(`CREATE TABLE app_receipts(id bigserial PRIMARY KEY,user_id text,type text,amount_cents integer,currency text,metadata jsonb,stripe_payment_intent_id text,stripe_charge_id text,created_at timestamptz DEFAULT now());
    CREATE TABLE user_roles(user_id text,role text); CREATE TABLE app_admins(user_id text);
    CREATE TABLE user_consents(user_id text,doc_key text,accepted boolean,accepted_at timestamptz);`);
  const now = Date.now();
  const metadata = {
    openai_conversion_version: '1',
    openai_oppref: 'opaque-click',
    openai_click_at: String(now - 60000),
    openai_consent_at: String(now - 120000),
    openai_policy_version: 'policy',
    openai_consent_observed_at: new Date(now - 30000).toISOString(),
    stripe_livemode: true,
    settlement_amount_cents: 2300,
    settlement_currency: 'EUR',
  };
  for (const [user, extra] of [
    ['ordinary', {}],
    ['admin', {}],
    ['withdrawn', {}],
    ['test', { stripe_livemode: false }],
    ['legacy', { openai_conversion_version: null }],
  ] as const)
    await db.query(
      "INSERT INTO app_receipts(user_id,type,amount_cents,currency,metadata,stripe_payment_intent_id) VALUES ($1,'topup',2500,'USD',$2,$3)",
      [user, { ...metadata, ...extra }, `pi_${user}`]
    );
  await db.query(
    "INSERT INTO app_admins VALUES ('admin'); INSERT INTO user_consents VALUES ('withdrawn','cookies.ads',false,now())"
  );
  await repairOpenAIOrders(db);
  const sent: any[] = [];
  const result = await drainOpenAIConversions(db, {
    policyVersion: 'policy',
    send: async (event) => {
      sent.push(event);
      return { status: 'accepted', code: 'http_2xx' };
    },
  });
  assert.equal(result.accepted, 1);
  assert.equal(result.suppressed, 2);
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].data, { type: 'contents', amount: 2300, currency: 'EUR' });
  assert.equal(sent[0].oppref, 'opaque-click');
  assert.equal(sent[0].user, undefined);
  await repairOpenAIOrders(db);
  assert.equal(
    (
      await drainOpenAIConversions(db, {
        policyVersion: 'policy',
        send: async () => {
          throw Error('must not replay');
        },
      })
    ).claimed,
    0
  );
});

test('unavailable roles retry without emission, and repeated failures expire without retaining identifiers', async (t) => {
  const pg = await startDisposablePostgres('openai-retry');
  t.after(() => pg.cleanup());
  const db = createQueryExecutor(pg.pool);
  await pg.pool.query(readFileSync('neon/migrations/99_openai_conversion_outbox.sql', 'utf8'));
  const event = {
    id: 'retry-fixture',
    type: 'registration_completed' as const,
    timestamp_ms: Date.now(),
    source_url: 'https://maxvideoai.com' as const,
    action_source: 'web' as const,
    oppref: 'opaque-click',
    opt_out: true as const,
    data: { type: 'customer_action' as const },
  };
  await enqueueOpenAIConversion(db, {
    userId: 'ordinary',
    consentObservedAt: new Date(),
    policyVersion: 'policy',
    event,
  });
  let calls = 0;
  const send = async () => {
    calls++;
    return { status: 'retry' as const, code: 'network' };
  };
  assert.equal((await drainOpenAIConversions(db, { policyVersion: 'policy', send })).pending, 1);
  assert.equal(calls, 0);
  await pg.pool.query(
    'CREATE TABLE user_roles(user_id text,role text); CREATE TABLE user_consents(user_id text,doc_key text,accepted boolean,accepted_at timestamptz)'
  );
  for (let i = 0; i < 7; i++) {
    await db.query('UPDATE openai_conversion_outbox SET available_at=now()');
    await drainOpenAIConversions(db, { policyVersion: 'policy', send });
  }
  assert.equal(calls, 7);
  assert.deepEqual(await db.query('SELECT status,payload,user_id FROM openai_conversion_outbox'), [
    { status: 'dead', payload: null, user_id: null },
  ]);
});
