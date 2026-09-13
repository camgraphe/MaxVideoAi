import assert from 'node:assert/strict';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { createFinishingJobStore } from '../frontend/src/server/tools/finishing-jobs';
import { getDb, withDbTransaction } from '../frontend/src/lib/db';
import type { ToolResult } from '../frontend/src/lib/toolbox/contract';
import { createPaidGenerationTestSchema, missingDisposablePostgresCommand, startDisposablePostgres } from './helpers/disposable-postgres';

function gate() {
  let enter!: () => void, release!: () => void;
  return { entered: new Promise<void>(resolve => { enter = resolve; }),
    resumed: new Promise<void>(resolve => { release = resolve; }),
    enter: () => enter(), release: () => release() };
}

test('finishing completion and refund serialize both orders, replay and rollback', { timeout: 60_000 }, async t => {
  const missing = missingDisposablePostgresCommand();
  if (missing) return t.skip(`${missing} is unavailable`);
  const database = await startDisposablePostgres('finishing-terminal');
  const previousUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = database.databaseUrl;
  t.after(async () => {
    await getDb().end();
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
    await database.cleanup();
  });
  await createPaidGenerationTestSchema(database.pool);
  const jobs = createFinishingJobStore();
  async function seed(jobId: string) {
    await database.pool.query(`INSERT INTO app_jobs
      (job_id,user_id,surface,engine_id,status,payment_status,final_price_cents,currency,settings_snapshot)
      VALUES ($1,'owner','tool','toolbox-finishing','processing','paid_wallet',31,'USD','{}')`, [jobId]);
    await database.pool.query(`INSERT INTO app_receipts (user_id,type,amount_cents,currency,job_id,surface)
      VALUES ('owner','charge',31,'USD',$1,'tool')`, [jobId]);
  }
  function result(jobId: string): ToolResult {
    return { toolId: 'denoise', version: 1, jobId, sourceAssets: [], outputs: [{
      asset: { type: 'job-output', jobId, outputId: `${jobId}:video:0`, kind: 'video' },
      originalUrl: 'https://example.com/output.mp4', kind: 'video',
    }] };
  }
  async function state(jobId: string) {
    return (await database.pool.query(`SELECT status,payment_status,
      (SELECT count(*)::int FROM app_receipts r WHERE r.job_id=j.job_id AND type='refund') AS refunds
      FROM app_jobs j WHERE job_id=$1`, [jobId])).rows[0];
  }
  for (const firstAction of ['refund', 'complete'] as const) {
    await t.test(`${firstAction} holds the job lock until its terminal transaction commits`, async () => {
      const jobId = `first-${firstAction}`;
      await seed(jobId);
      const barrier = gate();
      const paused = createFinishingJobStore({ withDbTransaction: operation => withDbTransaction(async executor => {
        const instrumented = { ...executor, async query<T>(text: string, params?: ReadonlyArray<unknown>) {
          const rows = await executor.query<T>(text, params);
          const match = firstAction === 'refund' ? /^INSERT INTO app_receipts/.test(text) : /^UPDATE app_jobs SET status='completed'/.test(text);
          if (match) { barrier.enter(); await barrier.resumed; }
          return rows;
        } };
        return operation(instrumented);
      }) });
      const first = firstAction === 'refund'
        ? paused.failFinishingJob('owner', jobId, 'Failure', 'provider-id')
        : paused.completeFinishingJob('owner', jobId, result(jobId), 'provider-id');
      let second: Promise<void> | undefined;
      let settled = false;
      try {
        await barrier.entered;
        second = (firstAction === 'refund'
          ? jobs.completeFinishingJob('owner', jobId, result(jobId), 'provider-id')
          : jobs.failFinishingJob('owner', jobId, 'Late failure', 'provider-id')).finally(() => { settled = true; });
        let blocked = false;
        for (let attempt = 0; attempt < 100 && !settled; attempt++) {
          const locks = await database.pool.query("SELECT 1 FROM pg_locks WHERE locktype='advisory' AND NOT granted");
          if (locks.rowCount) { blocked = true; break; }
          await delay(5);
        }
        assert.equal(blocked, true, 'the second terminal action must wait on the real database job lock');
        assert.equal(settled, false);
        assert.equal((await state(jobId)).status, 'processing', 'uncommitted terminal work stays private');
      } finally { barrier.release(); await Promise.all([first, second]); }
      assert.deepEqual(await state(jobId), firstAction === 'refund'
        ? { status: 'failed', payment_status: 'refunded_wallet', refunds: 1 }
        : { status: 'completed', payment_status: 'paid_wallet', refunds: 0 });
      await Promise.all([
        jobs.completeFinishingJob('owner', jobId, result(jobId), 'provider-id'),
        jobs.failFinishingJob('owner', jobId, 'Replay', 'provider-id'),
      ]);
      assert.deepEqual(await state(jobId), firstAction === 'refund'
        ? { status: 'failed', payment_status: 'refunded_wallet', refunds: 1 }
        : { status: 'completed', payment_status: 'paid_wallet', refunds: 0 });
    });
  }
  await t.test('a rejected failure transition rolls back the refund receipt', async () => {
    await seed('rollback');
    await database.pool.query("ALTER TABLE app_jobs ADD CONSTRAINT reject_failed CHECK (job_id <> 'rollback' OR status <> 'failed')");
    await assert.rejects(jobs.failFinishingJob('owner', 'rollback', 'Failure', null));
    assert.deepEqual(await state('rollback'), { status: 'processing', payment_status: 'paid_wallet', refunds: 0 });
    await jobs.completeFinishingJob('owner', 'rollback', result('rollback'), null);
    assert.deepEqual(await state('rollback'), { status: 'completed', payment_status: 'paid_wallet', refunds: 0 });
  });
  await t.test('wrong owners cannot complete or refund a job', async () => {
    await seed('wrong-owner');
    await jobs.completeFinishingJob('other', 'wrong-owner', result('wrong-owner'), null);
    await jobs.failFinishingJob('other', 'wrong-owner', 'Failure', null);
    assert.deepEqual(await state('wrong-owner'), { status: 'processing', payment_status: 'paid_wallet', refunds: 0 });
  });
});
