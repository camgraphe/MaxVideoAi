import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runAlibabaModelStudioPoll } from '../frontend/server/alibaba-model-studio-poll';
import { withDbTransaction } from '../frontend/src/lib/db';
import { createPaidGenerationTestSchema, startDisposablePostgres } from './helpers/disposable-postgres';
import { allowGenerationPoll } from './helpers/generation-poll-claim';

test('a failed accepted render keeps its wallet charge recoverable until the matching refund commits', async t => {
  const pg = await startDisposablePostgres('routed-terminal-refund');
  t.after(() => pg.cleanup());
  const q = async <T,>(sql: string, params?: unknown[]): Promise<T[]> => (await pg.pool.query(sql, params)).rows;
  await createPaidGenerationTestSchema(pg.pool);
  await q(readFileSync('neon/migrations/21_provider_attempts.sql', 'utf8'));
  await q(`INSERT INTO app_jobs (job_id, user_id, provider, provider_job_id, engine_id, status, payment_status,
    final_price_cents, currency, updated_at) VALUES ('clip','owner','videorouter','accepted','kling-v4',
    'running','paid_wallet',120,'USD',NOW()-INTERVAL '2 minutes')`);
  await q(`INSERT INTO app_receipts (user_id,type,job_id,amount_cents,currency)
    VALUES ('owner','charge','clip',115,'USD')`);
  await q(`ALTER TABLE app_receipts ADD CONSTRAINT fail_fixture_refunds CHECK (type <> 'refund')`);
  const poll = async (beforeFailure = async () => {}) => {
    const result = await runAlibabaModelStudioPoll({ provider: 'videorouter', jobId: 'clip', deps: {
      claimPollFn: allowGenerationPoll, queryFn: q,
      settlement: { withTransaction: cb => withDbTransaction(cb, {pool: pg.pool}) },
      getVideoRouterClientFn: () => ({ createVideo: async () => assert.fail('poll cannot submit'),
        getTask: async id => {
          await beforeFailure();
          return { providerJobId: id, status: 'failed', rawStatus: 'failed', videoUrl: null,
            message: 'Render failed.', usage: null, raw: { status: 'failed' } };
        } }),
    } });
    return (await result.json()).updates;
  };
  const state = async () => (await q(`SELECT status, payment_status FROM app_jobs WHERE job_id='clip'`))[0];
  const receipts = () => q(`SELECT type, amount_cents FROM app_receipts WHERE job_id='clip' ORDER BY id`);
  const active = {status:'running', payment_status:'paid_wallet'};
  assert.equal(await poll(), 0);
  assert.deepEqual(await state(), active);
  assert.deepEqual(await receipts(), [{type:'charge', amount_cents:115}]);
  await q('ALTER TABLE app_receipts DROP CONSTRAINT fail_fixture_refunds');
  const due = () => q("UPDATE app_jobs SET updated_at=NOW()-INTERVAL '2 minutes' WHERE job_id='clip'");
  await due();
  assert.equal(await poll(async () => { await q("UPDATE app_jobs SET provider_job_id='new-owner' WHERE job_id='clip'"); }), 0);
  assert.deepEqual(await state(), active);
  await due();
  assert.equal((await Promise.all([poll(), poll()])).reduce((a,b) => a+b,0), 1);
  assert.deepEqual(await state(), {status:'failed', payment_status:'refunded_wallet'});
  assert.deepEqual(await receipts(), [{type:'charge', amount_cents:115}, {type:'refund', amount_cents:115}]);
});
