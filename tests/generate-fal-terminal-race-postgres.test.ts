import assert from 'node:assert/strict';
import test from 'node:test';
import type { TransactionQueryExecutor } from '../frontend/src/lib/db';
import { submitFalGenerateTask } from '../frontend/app/api/generate/_lib/fal-submission';
import { FalGenerationError } from '../frontend/src/lib/fal-error';
import { withWalletFailureSettlement } from '../frontend/server/fal-webhook-refunds';
import { createPaidGenerationTestSchema, startDisposablePostgres } from './helpers/disposable-postgres';

test('a terminal submission error cannot refund or contradict a persisted success', { timeout: 90_000 }, async (t) => {
  const db = await startDisposablePostgres('fal-terminal-submission');
  t.after(() => db.cleanup());
  t.mock.method(console, 'error', () => {});
  await createPaidGenerationTestSchema(db.pool);
  await db.pool.query(`INSERT INTO app_jobs(job_id,user_id,engine_id,engine_label,status,progress,
    payment_status,provider,provider_job_id,video_url,thumb_url)
    VALUES('winner','owner','minimax-h3','MiniMax H3','completed',100,'paid_wallet','fal','request-winner',
      'https://cdn.maxvideoai.com/winner.mp4','/ready.webp')`);
  const before = (await db.pool.query("SELECT * FROM app_jobs WHERE job_id='winner'")).rows[0];
  let providerCalls = 0;
  let rollbacks = 0;
  const metrics: string[] = [];
  const options: Parameters<typeof submitFalGenerateTask>[0] = {
    userId: 'owner', falPayload: { engineId: 'minimax-h3', prompt: 'test', mode: 't2v', submissionMode: 'enqueue' },
    jobId: 'winner', engineId: 'minimax-h3', engineLabel: 'MiniMax H3', isLumaRay2: false,
    batchId: null, durationSec: 5, pendingReceipt: { userId: 'owner', jobId: 'winner', amountCents: 100,
      currency: 'USD', description: 'Run', snapshot: {}, vendorAccountId: null, applicationFeeCents: null },
    paymentMode: 'wallet', walletChargeReserved: true,
    getLastProviderJobId: () => 'request-winner', setLastProviderJobId: () => {},
    persistProviderJobId: async () => {}, logMetricFn: kind => { metrics.push(kind); },
    deps: {
      queryFn: async (sql, values) => (await db.pool.query(sql, values)).rows,
      withFalTimeoutFn: async promise => promise,
      generateVideoFn: async () => { providerCalls++; throw new FalGenerationError('Read forbidden', { status: 403 }); },
      rollbackPendingPaymentFn: async () => { rollbacks++; },
      withFailureSettlementFn: (jobId, context, persist) => withWalletFailureSettlement(jobId, context, persist, {
        withTransaction: async callback => {
          const client = await db.pool.connect();
          try {
            await client.query('BEGIN');
            const result = await callback({ query: async (sql, values) => (await client.query(sql, values)).rows } as TransactionQueryExecutor);
            await client.query('COMMIT');
            return result;
          } catch (error) { await client.query('ROLLBACK'); throw error; }
          finally { client.release(); }
        },
      }),
    },
  };
  const result = await submitFalGenerateTask(options);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.status, 200);
  assert.equal(result.body.status, 'completed');
  assert.equal(result.body.videoUrl, 'https://cdn.maxvideoai.com/winner.mp4');
  assert.equal(result.body.paymentStatus, 'paid_wallet');
  assert.equal(providerCalls, 1);
  assert.equal(rollbacks, 0);
  assert.deepEqual(metrics, []);
  assert.deepEqual((await db.pool.query("SELECT * FROM app_jobs WHERE job_id='winner'")).rows[0], before);
  assert.equal((await db.pool.query("SELECT COUNT(*)::int AS count FROM app_receipts WHERE type='refund'")).rows[0].count, 0);

  await t.test('a completion during legacy direct rollback returns the durable success', async () => {
    await db.pool.query(`INSERT INTO app_jobs(job_id,user_id,engine_id,status,payment_status,provider)
      VALUES('direct-after','owner','minimax-h3','running','paid','fal')`);
    const direct = await submitFalGenerateTask({ ...options, jobId: 'direct-after', paymentMode: 'direct',
      walletChargeReserved: false, pendingReceipt: { ...options.pendingReceipt!, jobId: 'direct-after' },
      deps: { ...options.deps, rollbackPendingPaymentFn: async () => {
        await db.pool.query("UPDATE app_jobs SET status='completed',progress=100,video_url='https://cdn.maxvideoai.com/direct.mp4' WHERE job_id='direct-after'");
      } },
    });
    assert.equal(direct.ok, false);
    if (direct.ok) return;
    assert.equal(direct.status, 200);
    assert.equal(direct.body.status, 'completed');
    assert.equal(direct.body.paymentStatus, 'paid');
    assert.deepEqual(metrics, []);
  });
});
