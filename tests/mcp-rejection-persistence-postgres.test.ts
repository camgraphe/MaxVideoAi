import assert from 'node:assert/strict';
import test from 'node:test';
import { createPaidGenerationTestSchema, missingDisposablePostgresCommand, startDisposablePostgres } from './helpers/disposable-postgres';
import { paidProviderSubmissionDependencies } from '../frontend/src/server/generations/paid-provider-execution';
import { getDb } from '../frontend/src/lib/db';

test('known MCP rejection persists sanitized diagnostics and refunds exactly once', async t => {
  const missing = missingDisposablePostgresCommand();
  if (missing) { t.skip(`${missing} unavailable`); return; }
  const db = await startDisposablePostgres('transaction-audit');
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = db.databaseUrl;
  t.after(async () => {
    await getDb().end();
    if (previous === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previous;
    await db.cleanup();
  });
  await createPaidGenerationTestSchema(db.pool);
  await db.pool.query("INSERT INTO app_receipts (user_id,type,amount_cents,currency) VALUES ('audit-user','topup',1000,'USD')");
  await db.pool.query("INSERT INTO app_jobs (job_id,user_id,engine_id,engine_label,status,settings_snapshot) VALUES ('audit-job','audit-user','seedance-2-0','Seedance 2.0','queued','{\"keep\":true}')");
  const pricing = { totalCents: 111, currency: 'USD', base: { amountCents: 85 }, margin: { amountCents: 26 }, meta: { ruleId: 'default' } };
  await db.pool.query("INSERT INTO app_receipts (user_id,type,amount_cents,currency,job_id) VALUES ('audit-user','charge',111,'USD','audit-job')");
  const ensureKnownRejectionRefund = paidProviderSubmissionDependencies.ensureKnownRejectionRefund;
  assert.ok(ensureKnownRejectionRefund);
  const execution = {
    surface: 'video', quoteId: 'audit-job', userId: 'audit-user', engine: { label: 'Seedance 2.0' },
    canonicalPricing: pricing, request: { settings: { durationSec: 5 } },
  } as never;
  const failure = { code: 'ENGINE_CONSTRAINT', status: 422, message: 'Provider request is not supported: https://provider.invalid/private' };
  assert.equal(await ensureKnownRejectionRefund(execution, failure), true);
  assert.equal(await ensureKnownRejectionRefund(execution, failure), true);
  const job = (await db.pool.query("SELECT message,payment_status,settings_snapshot FROM app_jobs WHERE job_id='audit-job'")).rows[0];
  assert.match(job.message, /selected inputs/);
  assert.doesNotMatch(job.message, /provider|https?:/i);
  assert.doesNotMatch(JSON.stringify(job.settings_snapshot.submissionFailure), /provider\.invalid/);
  assert.equal(job.payment_status, 'refunded_wallet');
  assert.equal(job.settings_snapshot.keep, true);
  assert.equal(job.settings_snapshot.submissionFailure.code, 'ENGINE_CONSTRAINT');
  const refunds = (await db.pool.query("SELECT amount_cents,description FROM app_receipts WHERE type='refund'")).rows;
  assert.equal(refunds.length, 1);
  assert.equal(refunds[0].amount_cents, 111);
  assert.match(refunds[0].description, /not supported/);
});
