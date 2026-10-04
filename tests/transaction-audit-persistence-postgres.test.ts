import assert from 'node:assert/strict';
import test from 'node:test';
import { createPaidGenerationTestSchema, missingDisposablePostgresCommand, startDisposablePostgres } from './helpers/disposable-postgres';
import { reserveWalletChargeInExecutor } from '../frontend/src/lib/wallet';
import { ensureKnownRejectionRefund } from '../frontend/src/server/generations/paid-provider-execution';
import { getDb } from '../frontend/src/lib/db';

test('wallet charges retain private pricing evidence and MCP rejection persistence remains idempotent', async t => {
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
  const client = await db.pool.connect();
  await client.query('BEGIN');
  try {
    const result = await reserveWalletChargeInExecutor({ query: async (sql, values) => (await client.query(sql, [...values ?? []])).rows }, {
      userId: 'audit-user', jobId: 'audit-job', amountCents: 111, currency: 'USD', description: 'Seedance 2.0',
      pricingSnapshotJson: JSON.stringify({ totalCents: 111, currency: 'USD' }), auditPricingSnapshot: pricing,
      applicationFeeCents: null, vendorAccountId: null,
    }, { preferredCurrency: 'usd' });
    assert.equal(result.ok, true);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  const row = (await db.pool.query("SELECT pricing_snapshot,metadata FROM app_receipts WHERE type='charge'")).rows[0];
  assert.deepEqual(row.pricing_snapshot, { totalCents: 111, currency: 'USD' });
  assert.deepEqual(row.metadata?.pricing_audit_snapshot, pricing);
  const execution = {
    surface: 'video', quoteId: 'audit-job', userId: 'audit-user', engine: { label: 'Seedance 2.0' },
    canonicalPricing: pricing, request: { settings: { durationSec: 5 } },
  } as never;
  const failure = { code: 'ENGINE_CONSTRAINT', status: 422, message: 'This request is not supported with the selected inputs.' };
  assert.equal(await ensureKnownRejectionRefund(execution, failure), true);
  assert.equal(await ensureKnownRejectionRefund(execution, failure), true);
  const job = (await db.pool.query("SELECT message,payment_status,settings_snapshot FROM app_jobs WHERE job_id='audit-job'")).rows[0];
  assert.match(job.message, /selected inputs/);
  assert.equal(job.payment_status, 'refunded_wallet');
  assert.equal(job.settings_snapshot.keep, true);
  assert.equal(job.settings_snapshot.submissionFailure.code, 'ENGINE_CONSTRAINT');
  const refunds = (await db.pool.query("SELECT amount_cents,description FROM app_receipts WHERE type='refund'")).rows;
  assert.equal(refunds.length, 1);
  assert.equal(refunds[0].amount_cents, 111);
  assert.match(refunds[0].description, /not supported/);
});


test('provider attempt completion follows the exact persisted job and survives late acceptance', async t => {
  const missing = missingDisposablePostgresCommand();
  if (missing) { t.skip(`${missing} unavailable`); return; }
  const db = await startDisposablePostgres('provider-attempt-audit');
  t.after(() => db.cleanup());
  const { markProviderAttemptAccepted, syncProviderAttemptTerminalStatus } = await import('../frontend/src/server/video-providers/provider-attempts');
  const queryFn = async <T = unknown>(sql: string, params?: unknown[]): Promise<T[]> => (await db.pool.query(sql, params)).rows;
  await db.pool.query(`
    CREATE TABLE app_jobs (id bigint PRIMARY KEY, job_id text, provider text, provider_job_id text, status text);
    CREATE TABLE provider_attempts (
      id bigint PRIMARY KEY, job_id bigint, provider text, provider_job_id text, status text,
      accepted_at timestamptz, finished_at timestamptz, updated_at timestamptz, response_snapshot jsonb
    );
    INSERT INTO app_jobs VALUES (1,'job','fal','request','completed');
    INSERT INTO provider_attempts (id,job_id,provider,provider_job_id,status) VALUES
      (1,1,'kling_direct',NULL,'failed'), (2,1,'fal','request','accepted'),
      (3,1,'fal','other-request','accepted'), (4,1,'fal',NULL,'fallback_started');
  `);
  await db.pool.query("UPDATE provider_attempts SET accepted_at='2026-09-21T10:00:00Z' WHERE id=2");
  await syncProviderAttemptTerminalStatus({ publicJobId: 'job', provider: 'fal', providerJobId: 'request', queryFn });
  await markProviderAttemptAccepted({ attemptId: 2, providerJobId: 'request', queryFn });
  const rows = (await db.pool.query('SELECT id,status,finished_at,accepted_at FROM provider_attempts ORDER BY id')).rows;
  assert.deepEqual(rows.map(row => row.status), ['failed', 'completed', 'accepted', 'fallback_started']);
  assert.ok(rows[1].finished_at);
  assert.equal(rows[1].accepted_at.toISOString(), '2026-09-21T10:00:00.000Z');
  await db.pool.query("UPDATE app_jobs SET status='failed' WHERE id=1");
  await syncProviderAttemptTerminalStatus({ publicJobId: 'job', provider: 'fal', providerJobId: 'request', queryFn });
  assert.equal((await db.pool.query('SELECT status FROM provider_attempts WHERE id=2')).rows[0].status, 'completed');
  await db.pool.query("UPDATE app_jobs SET provider_job_id='other-request' WHERE id=1");
  await syncProviderAttemptTerminalStatus({ publicJobId: 'job', provider: 'fal', providerJobId: 'other-request', queryFn });
  assert.equal((await db.pool.query('SELECT status FROM provider_attempts WHERE id=3')).rows[0].status, 'failed');
});
