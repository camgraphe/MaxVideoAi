import assert from 'node:assert/strict';
import test from 'node:test';

import { getDb, withDbTransaction } from '../frontend/src/lib/db';
import {
  issueManualWalletRefund,
  issueManualWalletRefundByReceipt,
  type AdminRefundDependencies,
} from '../frontend/server/admin-transactions/refunds';
import { createPaidGenerationTestSchema, startDisposablePostgres } from './helpers/disposable-postgres';

test('admin refunds acquire the job scope before retaining a charge lock', { timeout: 30_000 }, async t => {
  const pg = await startDisposablePostgres('admin-refund-lock-order');
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = pg.databaseUrl;
  t.after(async () => {
    await getDb().end();
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
    await pg.cleanup();
  });
  await createPaidGenerationTestSchema(pg.pool);
  const dependencies: AdminRefundDependencies = {
    databaseConfigured: () => true,
    ensureSchema: async () => {},
    withTransaction: callback => withDbTransaction(callback),
    now: () => new Date().toISOString(),
  };

  for (const selector of ['job', 'receipt']) {
    for (const heldLock of ['advisory', 'job-row']) {
      await t.test(`${selector} selector waits for ${heldLock} before locking the charge`, async () => {
        const jobId = `order-${selector}-${heldLock}`;
        await pg.pool.query(
          "INSERT INTO app_jobs(job_id,user_id,status,payment_status,currency) VALUES($1,'owner','completed','paid_wallet','USD')",
          [jobId],
        );
        const charge = (await pg.pool.query(
          "INSERT INTO app_receipts(user_id,type,amount_cents,currency,job_id) VALUES('owner','charge',250,'USD',$1) RETURNING id",
          [jobId],
        )).rows[0];
        const blocker = await pg.pool.connect();
        let pending: Promise<{ result?: unknown; error?: unknown }> | undefined;
        try {
          await blocker.query('BEGIN');
          if (heldLock === 'advisory') {
            await blocker.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [jobId]);
          } else {
            await blocker.query('SELECT job_id FROM app_jobs WHERE job_id=$1 FOR UPDATE', [jobId]);
          }
          const refund = selector === 'job'
            ? issueManualWalletRefund({ jobId, adminUserId: 'admin' }, dependencies)
            : issueManualWalletRefundByReceipt({ receiptId: Number(charge.id), adminUserId: 'admin' }, dependencies);
          pending = refund.then(result => ({ result }), error => ({ error }));
          const deadline = Date.now() + 5_000;
          while (true) {
            const waiting = (await pg.pool.query(
              "SELECT count(*)::int n FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND wait_event_type='Lock' AND state='active'",
            )).rows[0].n;
            if (waiting > 0) break;
            assert.ok(Date.now() < deadline, 'the refund must reach its blocked job-scope acquisition');
            await new Promise(resolve => setTimeout(resolve, 10));
          }
          await assert.doesNotReject(
            blocker.query('SELECT id FROM app_receipts WHERE id=$1 FOR UPDATE NOWAIT', [charge.id]),
            'a job-scope owner must still be able to lock the charge; otherwise the two refund paths can deadlock',
          );
        } finally {
          await blocker.query('ROLLBACK');
          blocker.release();
          if (pending) {
            const outcome = await pending;
            if (outcome.error) throw outcome.error;
          }
        }
        assert.deepEqual((await pg.pool.query(
          'SELECT status,payment_status FROM app_jobs WHERE job_id=$1', [jobId],
        )).rows, [{ status: 'completed', payment_status: 'refunded_wallet' }]);
        assert.equal((await pg.pool.query(
          "SELECT count(*)::int n FROM app_receipts WHERE job_id=$1 AND type='refund'", [jobId],
        )).rows[0].n, 1);
      });
    }
  }

  await t.test('concurrent job and receipt selectors refund one completed charge exactly once', async () => {
    const jobId = 'concurrent-selectors';
    await pg.pool.query(
      "INSERT INTO app_jobs(job_id,user_id,status,payment_status,currency) VALUES($1,'owner','completed','paid_wallet','USD')",
      [jobId],
    );
    const charge = (await pg.pool.query(
      "INSERT INTO app_receipts(user_id,type,amount_cents,currency,job_id) VALUES('owner','charge',250,'USD',$1) RETURNING id",
      [jobId],
    )).rows[0];
    const outcomes = await Promise.allSettled([
      issueManualWalletRefund({ jobId, adminUserId: 'admin' }, dependencies),
      issueManualWalletRefundByReceipt({ receiptId: Number(charge.id), adminUserId: 'admin' }, dependencies),
    ]);
    assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(outcomes.filter(result => result.status === 'rejected').length, 1);
    assert.deepEqual((await pg.pool.query(
      "SELECT user_id,amount_cents,currency FROM app_receipts WHERE job_id=$1 AND type='refund'", [jobId],
    )).rows, [{ user_id: 'owner', amount_cents: 250, currency: 'USD' }]);
    assert.deepEqual((await pg.pool.query(
      'SELECT status,payment_status FROM app_jobs WHERE job_id=$1', [jobId],
    )).rows, [{ status: 'completed', payment_status: 'refunded_wallet' }]);
  });

});
