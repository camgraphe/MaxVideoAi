import assert from 'node:assert/strict';
import test from 'node:test';
import { createPaidGenerationTestSchema, startDisposablePostgres } from './helpers/disposable-postgres';
import { getDb } from '../frontend/src/lib/db';
import { createAtomicInitialUpscaleJob } from '../frontend/src/server/tools/upscale-job-persistence';
import { rejectTruncatedUpscale } from '../frontend/server/upscale-duration-integrity';

test('concurrent upscale retries reserve once; conflicting payloads cannot charge or submit', { timeout: 60_000 }, async t => {
  const database = await startDisposablePostgres('upscale-idempotency');
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = database.databaseUrl;
  t.after(async () => { await getDb().end(); if (previous) process.env.DATABASE_URL = previous; else delete process.env.DATABASE_URL; await database.cleanup(); });
  await createPaidGenerationTestSchema(database.pool);
  await database.pool.query("INSERT INTO app_receipts (user_id,type,amount_cents,currency) VALUES ('alice','topup',1000,'USD')");
  const params = {
    userId: 'alice', jobId: 'tool_upscale_same-request', requestFingerprint: 'fingerprint', description: 'upscale',
    amountCents: 100, currency: 'USD', billingProductKey: 'upscale-video-seedvr', pricingSnapshotJson: '{}',
    applicationFeeCents: null, vendorAccountId: null, engineId: 'seedvr-video' as const, engineLabel: 'SeedVR',
    durationSec: 6, promptSummary: 'upscale', settingsSnapshotJson: '{"requestFingerprint":"fingerprint"}', preferredCurrency: 'usd' as const,
  };
  const created = await Promise.all(Array.from({ length: 12 }, () => createAtomicInitialUpscaleJob(params)));
  assert.equal(created.filter(Boolean).length, 1, 'only the winning reservation can submit to Fal');
  await assert.rejects(createAtomicInitialUpscaleJob({ ...params, requestFingerprint: 'different' }), /different settings/);
  const { rows } = await database.pool.query("SELECT (SELECT count(*) FROM app_jobs) AS jobs, (SELECT count(*) FROM app_receipts WHERE type='charge') AS charges");
  assert.deepEqual(rows[0], { jobs: '1', charges: '1' });
  await database.pool.query(`CREATE FUNCTION fail_refund() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.type = 'refund' THEN RAISE EXCEPTION 'simulated database failure'; END IF; RETURN NEW; END $$`);
  await database.pool.query('CREATE TRIGGER fail_refund BEFORE INSERT ON app_receipts FOR EACH ROW EXECUTE FUNCTION fail_refund()');
  await assert.rejects(rejectTruncatedUpscale(params.jobId, 'fal-request', 'https://example.com/output.mp4'), /simulated database failure/);
  const unchanged = await database.pool.query('SELECT status, payment_status FROM app_jobs');
  assert.deepEqual(unchanged.rows[0], { status: 'pending', payment_status: 'paid_wallet' });
  await database.pool.query('DROP TRIGGER fail_refund ON app_receipts');
  await Promise.all(Array.from({ length: 12 }, () => rejectTruncatedUpscale(params.jobId, 'fal-request', 'https://example.com/output.mp4')));
  const refunded = await database.pool.query("SELECT amount_cents FROM app_receipts WHERE type='refund'");
  assert.deepEqual(refunded.rows, [{ amount_cents: 100 }]);
  const settled = await database.pool.query('SELECT status, payment_status FROM app_jobs');
  assert.deepEqual(settled.rows[0], { status: 'failed', payment_status: 'refunded_wallet' });
  assert.equal(await createAtomicInitialUpscaleJob(params), false, 'even a refunded job cannot be resubmitted with the same intent');
});
