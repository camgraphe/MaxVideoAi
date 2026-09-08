import assert from 'node:assert/strict';
import test from 'node:test';
import { getDb, query } from '../frontend/src/lib/db';
import { runFalPoll } from '../frontend/server/fal-poll';
import { reconcileFinishingJobs } from '../frontend/src/server/tools/finishing-poll';
import { createFinishingJobStore } from '../frontend/src/server/tools/finishing-jobs';
import { refreshFinishingTool } from '../frontend/src/server/tools/finishing-status';
import { createPaidGenerationTestSchema, missingDisposablePostgresCommand, startDisposablePostgres } from './helpers/disposable-postgres';

test('the existing Fal cron delegates finishing jobs and settles interrupted reservations without a page visit', { timeout: 60_000 }, async t => {
  const missing = missingDisposablePostgresCommand();
  if (missing) return t.skip(`${missing} is unavailable`);
  const database = await startDisposablePostgres('finishing-cron');
  const previousUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = database.databaseUrl;
  t.after(async () => {
    await getDb().end();
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
    await database.cleanup();
  });
  await createPaidGenerationTestSchema(database.pool);
  await database.pool.query(`CREATE TABLE fal_queue_log (job_id text,provider text,provider_job_id text,engine_id text,status text,payload jsonb,created_at timestamptz DEFAULT now());
    INSERT INTO app_jobs (job_id,user_id,surface,engine_id,provider,provider_job_id,status,payment_status,final_price_cents,currency,created_at,updated_at,settings_snapshot,hidden) VALUES
    ('interrupted','owner','tool','toolbox-finishing',NULL,NULL,'pending','paid_wallet',31,'USD',now()-interval '10 minutes',now()-interval '10 minutes','{}',false),
    ('hidden-interrupted','owner','tool','toolbox-finishing',NULL,NULL,'pending','paid_wallet',32,'USD',now()-interval '20 minutes',now()-interval '20 minutes','{}',true),
    ('legacy-failed','owner','tool','toolbox-finishing','fal',NULL,'failed','paid_wallet',33,'USD',now()-interval '20 minutes',now()-interval '20 minutes','{}',false),
    ('submitted','owner','tool','toolbox-finishing','fal','stored-tool-request','queued','paid_wallet',34,'USD',now()-interval '10 minutes',now()-interval '10 minutes','{"preparedTool":{"profile":{"endpoint":"topaz/denoise/video"}}}',false),
    ('ordinary-video','owner','video','sora-2',NULL,NULL,'pending',NULL,0,'USD',now()-interval '10 minutes',now()-interval '10 minutes','{}',false);
    INSERT INTO app_receipts (user_id,type,amount_cents,currency,job_id,surface)
      SELECT user_id,'charge',final_price_cents,currency,job_id,surface FROM app_jobs WHERE surface='tool'`);
  const jobs = createFinishingJobStore();
  const providerCalls: Array<[string, string]> = [];
  let genericCalls = 0;
  const refresh = (owner: string, jobId: string) => refreshFinishingTool(owner, jobId, {
    read: (userId, id) => jobs.readFinishingExecution(userId, id, { includeHidden: true }),
    status: (userId, id) => jobs.readFinishingJob(userId, id, { includeHidden: true }),
    fail: jobs.failFinishingJob,
    poll: async (endpoint, requestId) => { providerCalls.push([endpoint, requestId]); return { status: 'IN_PROGRESS' } as never; },
    result: async () => { throw new Error('No result is ready'); },
  });
  const dependencies = {
    reconcileFinishingJobs: () => reconcileFinishingJobs({ refresh }),
    getFalClient: (() => ({ queue: { status: async () => { genericCalls++; throw new Error('wrong polling owner'); } } })) as NonNullable<Parameters<typeof runFalPoll>[0]>['getFalClient'],
    backfillCompletedMcpJobOutputs: async () => ({ promoted: 0, failed: 0, scanned: 0 }),
  };
  const response = await runFalPoll(dependencies);
  const data = await response.json();
  assert.equal(data.finishing.checked, 4);
  assert.equal(data.finishing.failures, 0);
  assert.equal(data.provisionalFailures, 1, 'the ordinary video path still runs');
  assert.equal(genericCalls, 0);
  assert.deepEqual(providerCalls, [['topaz/denoise/video', 'stored-tool-request']]);
  assert.equal((await jobs.readFinishingJob('owner', 'interrupted')).status, 'pending');
  assert.equal((await jobs.readFinishingJob('owner', 'submitted')).status, 'queued');
  await assert.rejects(jobs.readFinishingJob('owner', 'hidden-interrupted'), /JOB_UNAVAILABLE/);
  assert.equal((await jobs.readFinishingJob('owner', 'hidden-interrupted', { includeHidden: true })).status, 'failed');
  assert.equal((await jobs.readFinishingJob('owner', 'legacy-failed')).status, 'failed');
  assert.deepEqual((await database.pool.query("SELECT job_id,amount_cents FROM app_receipts WHERE type='refund' ORDER BY job_id")).rows,
    [{ job_id: 'hidden-interrupted', amount_cents: 32 }, { job_id: 'legacy-failed', amount_cents: 33 }]);
  assert.equal((await database.pool.query("SELECT count(*)::int AS n FROM fal_queue_log WHERE job_id <> 'ordinary-video'")).rows[0].n, 0);

  await database.pool.query("UPDATE app_jobs SET updated_at=now()-interval '20 minutes' WHERE job_id='interrupted'");
  await runFalPoll(dependencies);
  assert.equal((await jobs.readFinishingJob('owner', 'interrupted')).status, 'failed');
  assert.equal((await database.pool.query("SELECT count(*)::int AS n FROM app_receipts WHERE type='refund' AND job_id='interrupted'")).rows[0].n, 1);
  await runFalPoll(dependencies);
  assert.equal((await database.pool.query("SELECT count(*)::int AS n FROM app_receipts WHERE type='refund'")).rows[0].n, 3);

  await t.test('the bounded reconciliation rotates unfinished rows without extending their timeout', async () => {
    await database.pool.query("DELETE FROM app_jobs WHERE status IN ('queued','pending')");
    await database.pool.query(`INSERT INTO app_jobs (job_id,user_id,surface,engine_id,status,payment_status,updated_at,settings_snapshot)
      SELECT 'rotate-'||lpad(n::text,2,'0'),'owner','tool','toolbox-finishing','queued','paid_wallet',now()-interval '20 minutes','{}' FROM generate_series(1,12) n`);
    const seen: string[] = [];
    const before = (await database.pool.query('SELECT job_id,updated_at FROM app_jobs ORDER BY job_id')).rows;
    const deps = { query, refresh: async (_owner: string, id: string) => { seen.push(id); return { jobId: id, status: 'queued', result: null, error: null }; } };
    assert.equal((await reconcileFinishingJobs(deps)).checked, 10);
    assert.equal((await reconcileFinishingJobs(deps)).checked, 10);
    assert.equal(new Set(seen).size, 12);
    assert.deepEqual((await database.pool.query('SELECT job_id,updated_at FROM app_jobs ORDER BY job_id')).rows, before);
  });
});
