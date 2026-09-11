import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { getDb } from '../frontend/src/lib/db';
import {
  createPaidGenerationTestSchema,
  missingDisposablePostgresCommand,
  startDisposablePostgres,
} from './helpers/disposable-postgres';

const modulePath = `${process.cwd()}/frontend/server/fal-stale-provisionals.ts`;

test('stale charged Fal provisionals fail with one exact wallet refund', { timeout: 60_000 }, async (t) => {
  const missing = missingDisposablePostgresCommand();
  if (missing) return t.skip(`${missing} is unavailable`);
  assert.ok(existsSync(modulePath), 'the stale Fal provisional reconciler should exist');
  const reconciliationModule = await import(pathToFileURL(modulePath).href) as {
    reconcileStaleFalProvisionals?: (options?: { limit?: number }) => Promise<{ failed: number }>;
  };
  assert.equal(typeof reconciliationModule.reconcileStaleFalProvisionals, 'function');

  const database = await startDisposablePostgres('fal-stale-refund');
  const previousUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = database.databaseUrl;
  t.after(async () => {
    await getDb().end();
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
    await database.cleanup();
  });
  await createPaidGenerationTestSchema(database.pool);
  await database.pool.query(`
    CREATE TABLE fal_queue_log (
      id bigserial PRIMARY KEY,
      job_id text,
      provider text,
      provider_job_id text,
      engine_id text,
      status text,
      payload jsonb,
      created_at timestamptz NOT NULL DEFAULT clock_timestamp()
    )
  `);

  const jobId = 'tool_upscale_stale_paid';
  const pricing = { totalCents: 558, currency: 'USD', source: 'fixture' };
  await database.pool.query(`INSERT INTO app_jobs (
    job_id,user_id,surface,billing_product_key,engine_id,engine_label,duration_sec,
    status,progress,provider_job_id,payment_status,final_price_cents,currency,
    pricing_snapshot,settings_snapshot,provisional,created_at,updated_at
  ) VALUES (
    $1,'customer-1','upscale','upscale-video-seedvr','seedvr-video','SeedVR2 Video Upscale',10,
    'pending',0,NULL,'paid_wallet',558,'USD',$2::jsonb,'{}',TRUE,
    clock_timestamp() - INTERVAL '10 minutes',clock_timestamp() - INTERVAL '10 minutes'
  )`, [jobId, JSON.stringify(pricing)]);
  await database.pool.query(`INSERT INTO app_receipts (
    user_id,type,amount_cents,currency,description,job_id,surface,billing_product_key,
    pricing_snapshot,application_fee_cents,vendor_account_id
  ) VALUES (
    'customer-1','charge',558,'USD','SeedVR2 Video Upscale upscale run',$1,
    'upscale','upscale-video-seedvr',$2::jsonb,0,NULL
  )`, [jobId, JSON.stringify(pricing)]);

  assert.deepEqual(
    await reconciliationModule.reconcileStaleFalProvisionals!(),
    { failed: 1 }
  );
  assert.deepEqual(
    await reconciliationModule.reconcileStaleFalProvisionals!(),
    { failed: 0 }
  );

  const state = await database.pool.query(`SELECT status,payment_status,provisional,
    (SELECT count(*)::int FROM app_receipts r WHERE r.job_id=j.job_id AND r.type='refund') AS refunds,
    (SELECT COALESCE(sum(amount_cents),0)::int FROM app_receipts r WHERE r.job_id=j.job_id AND r.type='refund') AS refunded_cents,
    (SELECT count(*)::int FROM fal_queue_log q WHERE q.job_id=j.job_id AND q.status='poll:not-started') AS failure_events
    FROM app_jobs j WHERE job_id=$1`, [jobId]);
  assert.deepEqual(state.rows[0], {
    status: 'failed',
    payment_status: 'refunded_wallet',
    provisional: false,
    refunds: 1,
    refunded_cents: 558,
    failure_events: 1,
  });

  const retryJobId = 'tool_upscale_stale_refund_retry';
  await database.pool.query(`INSERT INTO app_jobs (
    job_id,user_id,surface,billing_product_key,engine_id,engine_label,duration_sec,
    status,progress,provider_job_id,payment_status,final_price_cents,currency,
    pricing_snapshot,settings_snapshot,provisional,created_at,updated_at
  ) VALUES (
    $1,'customer-1','upscale','upscale-video-seedvr','seedvr-video','SeedVR2 Video Upscale',10,
    'pending',0,NULL,'paid_wallet',558,'USD',$2::jsonb,'{}',TRUE,
    clock_timestamp() - INTERVAL '10 minutes',clock_timestamp() - INTERVAL '10 minutes'
  )`, [retryJobId, JSON.stringify(pricing)]);
  await database.pool.query(`INSERT INTO app_receipts (
    user_id,type,amount_cents,currency,description,job_id,surface,billing_product_key,
    pricing_snapshot,application_fee_cents,vendor_account_id
  ) VALUES (
    'customer-1','charge',558,'USD','SeedVR2 Video Upscale upscale run',$1,
    'upscale','upscale-video-seedvr',$2::jsonb,0,NULL
  )`, [retryJobId, JSON.stringify(pricing)]);
  await database.pool.query(`ALTER TABLE app_receipts ADD CONSTRAINT reject_stale_refund
    CHECK (job_id <> 'tool_upscale_stale_refund_retry' OR type <> 'refund')`);

  assert.deepEqual(
    await reconciliationModule.reconcileStaleFalProvisionals!(),
    { failed: 0 },
    'a failed refund write must not settle the charged job'
  );
  const retryPending = await database.pool.query(`SELECT status,payment_status,provisional,
    (SELECT count(*)::int FROM app_receipts r WHERE r.job_id=j.job_id AND r.type='refund') AS refunds,
    (SELECT count(*)::int FROM fal_queue_log q WHERE q.job_id=j.job_id AND q.status='poll:not-started') AS failure_events
    FROM app_jobs j WHERE job_id=$1`, [retryJobId]);
  assert.deepEqual(retryPending.rows[0], {
    status: 'pending',
    payment_status: 'paid_wallet',
    provisional: true,
    refunds: 0,
    failure_events: 0,
  });

  await database.pool.query('ALTER TABLE app_receipts DROP CONSTRAINT reject_stale_refund');
  assert.deepEqual(
    await reconciliationModule.reconcileStaleFalProvisionals!(),
    { failed: 1 },
    'the same job should settle after the refund store recovers'
  );
});
