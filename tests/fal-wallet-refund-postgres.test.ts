import assert from 'node:assert/strict';
import test from 'node:test';
import { getDb } from '../frontend/src/lib/db';
import { maybeAutoRefundWalletCharge, withWalletFailureSettlement } from '../frontend/server/fal-webhook-refunds';
import { createPaidGenerationTestSchema, startDisposablePostgres } from './helpers/disposable-postgres';

async function fixture() {
  const db = await startDisposablePostgres('fal-wallet-refund');
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = db.databaseUrl;
  await createPaidGenerationTestSchema(db.pool);
  // Match production: the fee is integer, while platform revenue is bigint.
  await db.pool.query('ALTER TABLE app_receipts ALTER COLUMN platform_revenue_cents TYPE bigint');
  await db.pool.query(`DROP INDEX app_receipts_charge_job_unique;
    INSERT INTO app_jobs (job_id,user_id,engine_id,engine_label,status,payment_status,final_price_cents,currency,duration_sec)
    VALUES ('job','owner','test-model','Test','failed','paid_wallet',9999,'EUR',5);
    INSERT INTO app_receipts (user_id,job_id,type,amount_cents,currency,surface,pricing_snapshot)
    VALUES ('owner','job','charge',123,'USD','video','{"charged":123}');`);
  return { ...db, async state() {
    return (await db.pool.query("SELECT status,payment_status FROM app_jobs WHERE job_id='job'")).rows[0];
  }, async refunds() {
    return (await db.pool.query("SELECT user_id,amount_cents,currency,surface,pricing_snapshot FROM app_receipts WHERE type='refund'")).rows;
  }, async cleanup() {
    await getDb().end();
    if (previous === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previous;
    await db.cleanup();
  } };
}

const context = { failureMessage: 'Generation failed.', failureOrigin: 'test' };

for (const fee of [18, null]) {
  test(`a provider refusal atomically fails and refunds once with application fee ${fee}`, async () => {
    const db = await fixture();
    const failureMessage = 'This request was blocked by safety checks. Review the prompt and any reference images, video, or audio before trying again.';
    try {
      await db.pool.query("UPDATE app_jobs SET status='running', provisional=TRUE");
      await db.pool.query('UPDATE app_receipts SET amount_cents=78, application_fee_cents=$1', [fee]);
      const settle = () => withWalletFailureSettlement('job', {
        engineLabel: 'MiniMax H3', providerJobId: 'provider-rejected',
        failureMessage, failureOrigin: 'provider_terminal',
      }, (executor) => executor.query(
        "UPDATE app_jobs SET status='failed', provisional=FALSE, message=$1 WHERE job_id='job' AND status<>'completed' RETURNING job_id",
        [failureMessage],
      ));

      await Promise.all([settle(), settle()]);
      await settle();

      assert.deepEqual(await db.state(), { status: 'failed', payment_status: 'refunded_wallet' });
      assert.deepEqual((await db.pool.query("SELECT provisional, message FROM app_jobs WHERE job_id='job'")).rows,
        [{ provisional: false, message: failureMessage }]);
      const receipts = (await db.pool.query(`SELECT type, amount_cents, currency, application_fee_cents,
        platform_revenue_cents, metadata FROM app_receipts ORDER BY id`)).rows;
      assert.equal(receipts.length, 2);
      assert.equal(receipts[0].type, 'charge');
      assert.equal(receipts[0].amount_cents, 78);
      assert.equal(receipts[0].application_fee_cents, fee);
      assert.deepEqual(receipts[1], {
        type: 'refund', amount_cents: 78, currency: 'USD',
        application_fee_cents: fee === null ? null : 0,
        platform_revenue_cents: fee === null ? null : '0',
        metadata: { reason: 'auto_render_failure_refund', original_receipt_id: '1',
          provider_job_id: 'provider-rejected', failure_origin: 'provider_terminal', note: failureMessage },
      });
    } finally { await db.cleanup(); }
  });
}

test('a completion already committed cannot be automatically refunded', async () => {
  const db = await fixture();
  try {
    await db.pool.query("UPDATE app_jobs SET status='completed'");
    assert.equal(await maybeAutoRefundWalletCharge('job', context), false);
    assert.deepEqual(await db.refunds(), []);
    assert.equal((await db.state()).payment_status, 'paid_wallet');
  } finally { await db.cleanup(); }
});

test('refund receipt and payment state roll back together on a status write failure', async () => {
  const db = await fixture();
  try {
    await db.pool.query(`CREATE FUNCTION reject_refund_status() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.payment_status='refunded_wallet' THEN RAISE EXCEPTION 'injected payment outage'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER payment_outage BEFORE UPDATE ON app_jobs FOR EACH ROW EXECUTE FUNCTION reject_refund_status();`);
    await assert.rejects(maybeAutoRefundWalletCharge('job', context), /injected payment outage/);
    assert.deepEqual(await db.refunds(), []);
    assert.equal((await db.state()).payment_status, 'paid_wallet');
    await db.pool.query('DROP TRIGGER payment_outage ON app_jobs');
    await Promise.all([maybeAutoRefundWalletCharge('job', context), maybeAutoRefundWalletCharge('job', context)]);
    assert.deepEqual(await db.refunds(), [{ user_id: 'owner', amount_cents: 123, currency: 'USD', surface: 'video', pricing_snapshot: { charged: 123 } }]);
    assert.equal((await db.state()).payment_status, 'refunded_wallet');
  } finally { await db.cleanup(); }
});

test('replay repairs an existing refund without crediting twice, including a late completed job', async () => {
  const db = await fixture();
  try {
    await db.pool.query(`INSERT INTO app_receipts (user_id,job_id,type,amount_cents,currency) VALUES ('owner','job','refund',123,'USD');
      UPDATE app_jobs SET status='completed';`);
    assert.equal(await maybeAutoRefundWalletCharge('job', context), true);
    assert.equal((await db.refunds()).length, 1);
    assert.deepEqual(await db.state(), { status: 'completed', payment_status: 'refunded_wallet' });
    assert.equal((await db.pool.query("SELECT message FROM app_jobs WHERE job_id='job'")).rows[0].message, null);
  } finally { await db.cleanup(); }
});

for (const [label, mutation] of [
  ['wrong owner', "UPDATE app_receipts SET user_id='other'"],
  ['card funded', "UPDATE app_receipts SET stripe_payment_intent_id='pi_card'"],
  ['ambiguous charges', "INSERT INTO app_receipts (user_id,job_id,type,amount_cents,currency) VALUES ('owner','job','charge',456,'USD')"],
] as const) {
  test(`an invalid canonical charge (${label}) never credits a wallet`, async () => {
    const db = await fixture();
    try {
      await db.pool.query(mutation);
      await assert.rejects(maybeAutoRefundWalletCharge('job', context), /wallet.*charge/i);
      assert.deepEqual(await db.refunds(), []);
      assert.equal((await db.state()).payment_status, 'paid_wallet');
    } finally { await db.cleanup(); }
  });
}

test('a refund insert outage rolls back the failure transition and a retry settles once', async () => {
  const db = await fixture();
  try {
    const { withWalletFailureSettlement } = await import('../frontend/server/fal-webhook-refunds');
    await db.pool.query(`UPDATE app_jobs SET status='running';
      CREATE FUNCTION reject_refund() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.type='refund' THEN RAISE EXCEPTION 'injected credit outage'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER credit_outage BEFORE INSERT ON app_receipts FOR EACH ROW EXECUTE FUNCTION reject_refund();`);
    const settle = () => withWalletFailureSettlement('job', context,
      (executor) => executor.query("UPDATE app_jobs SET status='failed' WHERE job_id='job' AND status<>'completed' RETURNING job_id"));
    await assert.rejects(settle(), /injected credit outage/);
    assert.deepEqual(await db.state(), { status: 'running', payment_status: 'paid_wallet' });
    assert.equal((await db.refunds()).length, 0);
    await db.pool.query('DROP TRIGGER credit_outage ON app_receipts');
    await Promise.all([settle(), settle()]);
    assert.deepEqual(await db.state(), { status: 'failed', payment_status: 'refunded_wallet' });
    assert.equal((await db.refunds()).length, 1);
  } finally { await db.cleanup(); }
});

test('legacy refunded status without a receipt is repaired from the exact charge', async () => {
  const db = await fixture();
  try {
    await db.pool.query("UPDATE app_jobs SET payment_status='refunded_wallet'");
    assert.equal(await maybeAutoRefundWalletCharge('job', context), true);
    assert.deepEqual(await db.refunds(), [{ user_id: 'owner', amount_cents: 123, currency: 'USD', surface: 'video', pricing_snapshot: { charged: 123 } }]);
  } finally { await db.cleanup(); }
});

test('completion wins a real row lock before failure: no refund is created', { timeout: 30_000 }, async () => {
  const db = await fixture();
  const winner = await db.pool.connect();
  const { withWalletFailureSettlement } = await import('../frontend/server/fal-webhook-refunds');
  const { withDbTransaction } = await import('../frontend/src/lib/db');
  const { waitForPostgresBlock } = await import('./helpers/postgres-row-lock');
  let settle: Promise<unknown> | undefined;
  try {
    await db.pool.query("UPDATE app_jobs SET status='running'");
    await winner.query('BEGIN');
    const winningPid = (await winner.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    await winner.query("UPDATE app_jobs SET status='completed' WHERE job_id='job'");
    let ready!: (pid: number) => void;
    const started = new Promise<number>((resolve) => { ready = resolve; });
    settle = withWalletFailureSettlement('job', context,
      (executor) => executor.query("UPDATE app_jobs SET status='failed' WHERE job_id='job' AND status<>'completed' RETURNING job_id"),
      { withTransaction: (callback) => withDbTransaction(async (executor, client) => {
        ready((await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid);
        return callback(executor);
      }, { pool: db.pool }) });
    await waitForPostgresBlock(db.pool, await started, winningPid);
    await winner.query('COMMIT');
    assert.deepEqual(await settle, []);
    assert.deepEqual(await db.state(), { status: 'completed', payment_status: 'paid_wallet' });
    assert.equal((await db.refunds()).length, 0);
  } finally {
    await winner.query('ROLLBACK');
    await settle?.catch(() => {});
    winner.release();
    await db.cleanup();
  }
});

test('failure wins first: late completion preserves the committed refund without another credit', { timeout: 30_000 }, async () => {
  const db = await fixture();
  const completing = await db.pool.connect();
  const { withWalletFailureSettlement } = await import('../frontend/server/fal-webhook-refunds');
  const { withDbTransaction } = await import('../frontend/src/lib/db');
  const { waitForPostgresBlock } = await import('./helpers/postgres-row-lock');
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let ready!: () => void;
  const started = new Promise<void>((resolve) => { ready = resolve; });
  let failurePid = 0;
  let settle: Promise<unknown> | undefined;
  let complete: Promise<unknown> | undefined;
  try {
    await db.pool.query("UPDATE app_jobs SET status='running'");
    settle = withWalletFailureSettlement('job', context, async (executor) => {
      await executor.query("UPDATE app_jobs SET status='failed' WHERE job_id='job'");
      ready(); await gate;
    }, { withTransaction: (callback) => withDbTransaction(async (executor, client) => {
      failurePid = (await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      return callback(executor);
    }, { pool: db.pool }) });
    await started;
    const completingPid = (await completing.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    complete = completing.query("UPDATE app_jobs SET status='completed' WHERE job_id='job'");
    await waitForPostgresBlock(db.pool, completingPid, failurePid);
    release();
    await Promise.all([settle, complete]);
    assert.deepEqual(await db.state(), { status: 'completed', payment_status: 'refunded_wallet' });
    assert.equal((await db.refunds()).length, 1);
    assert.equal(await maybeAutoRefundWalletCharge('job', context), true);
    assert.equal((await db.refunds()).length, 1);
  } finally {
    release();
    await settle?.catch(() => {});
    await complete?.catch(() => {});
    completing.release();
    await db.cleanup();
  }
});

test('an ignored insert without a matching refund fails promptly and leaves the job retryable', { timeout: 15_000 }, async () => {
  const db = await fixture();
  try {
    const { withWalletFailureSettlement } = await import('../frontend/server/fal-webhook-refunds');
    await db.pool.query(`UPDATE app_jobs SET status='running';
      CREATE FUNCTION ignore_refund() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.type='refund' THEN RETURN NULL; END IF; RETURN NEW; END $$;
      CREATE TRIGGER ignored_credit BEFORE INSERT ON app_receipts FOR EACH ROW EXECUTE FUNCTION ignore_refund();`);
    await assert.rejects(withWalletFailureSettlement('job', context,
      (executor) => executor.query("UPDATE app_jobs SET status='failed' WHERE job_id='job'")), /did not produce a matching receipt/);
    assert.deepEqual(await db.state(), { status: 'running', payment_status: 'paid_wallet' });
    assert.equal((await db.refunds()).length, 0);
  } finally { await db.cleanup(); }
});

test('an ignored payment update cannot acknowledge or commit a partial refund', async () => {
  const db = await fixture();
  try {
    await db.pool.query(`CREATE FUNCTION ignore_refund_status() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.payment_status='refunded_wallet' THEN RETURN NULL; END IF; RETURN NEW; END $$;
      CREATE TRIGGER ignored_status BEFORE UPDATE ON app_jobs FOR EACH ROW EXECUTE FUNCTION ignore_refund_status();`);
    await assert.rejects(maybeAutoRefundWalletCharge('job', context), /status was not persisted/);
    assert.deepEqual(await db.state(), { status: 'failed', payment_status: 'paid_wallet' });
    assert.equal((await db.refunds()).length, 0);
  } finally { await db.cleanup(); }
});

test('replay upgrades a generic refund reason without changing its financial identity', async () => {
  const db = await fixture();
  try {
    await maybeAutoRefundWalletCharge('job', { failureMessage: 'Unexpected status code: 422' });
    const before = await db.refunds();
    await maybeAutoRefundWalletCharge('job', { failureMessage: 'Request was blocked by safety checks.' });
    const description = (await db.pool.query("SELECT description FROM app_receipts WHERE type='refund'")).rows[0].description;
    assert.match(description, /safety checks/);
    assert.deepEqual(await db.refunds(), before);
  } finally { await db.cleanup(); }
});
