import assert from 'node:assert/strict';
import test from 'node:test';
import { runFalPoll } from '../frontend/server/fal-poll';
import { startDisposablePostgres } from './helpers/disposable-postgres';
import { allowGenerationPoll } from './helpers/generation-poll-claim';
import { waitForPostgresBlock } from './helpers/postgres-row-lock';

test('Fal failure fallback preserves terminal races and still fails active jobs', { timeout: 90_000 }, async (t) => {
  const db = await startDisposablePostgres('fal-terminal-race');
  const polling = await db.pool.connect();
  t.after(async () => { polling.release(); await db.cleanup(); });
  t.mock.method(console, 'warn', () => {});
  await db.pool.query(`CREATE TABLE app_jobs (
    job_id text PRIMARY KEY, surface text, engine_id text, provider text, provider_job_id text,
    status text, progress integer, message text, video_url text, updated_at timestamptz, created_at timestamptz
  );
  CREATE TABLE fal_queue_log (
    job_id text, provider text, provider_job_id text, engine_id text, status text, payload jsonb,
    created_at timestamptz DEFAULT NOW()
  )`);
  const seed = async (jobId: string, status: string) => db.pool.query(`INSERT INTO app_jobs
    VALUES($1,'video','minimax-h3','fal',$2,$3,25,NULL,NULL,
      NOW()-INTERVAL '10 minutes',NOW()-INTERVAL '20 minutes')`, [jobId, `request-${jobId}`, status]);
  const read = async (jobId: string) => (await db.pool.query('SELECT * FROM app_jobs WHERE job_id=$1', [jobId])).rows[0];
  let submissions = 0;
  let reconciliations = 0;
  const poll = (duringReconciliation: () => Promise<void>) => runFalPoll({
    query: async <T,>(sql: string, params?: unknown[]): Promise<T[]> => (await polling.query(sql, params)).rows,
    claimGenerationPoll: allowGenerationPoll,
    getFalClient: () => ({ queue: {
      status: async () => ({ status: 'FAILED' }),
      submit: async () => { submissions++; throw new Error('Unexpected submission'); },
    } }) as never,
    updateJobFromFalWebhook: async () => {
      reconciliations++;
      await duringReconciliation();
      throw new Error('Temporary failure in reconciliation');
    },
    backfillCompletedMcpJobOutputs: async () => ({ promoted: 0, failed: 0 }) as never,
    reconcileStaleFalProvisionals: async () => ({ failed: 0 }) as never,
    reconcileFinishingJobs: async () => ({ checked: 0, reconciled: 0, failures: 0 }),
    refreshCreatorOperations: async () => [],
    reconcileSubtitleOperations: async () => ({}) as never,
  });

  for (const terminal of ['completed', 'failed']) {
    await t.test(`fallback rechecks concurrent ${terminal} after a real row lock`, async () => {
      const jobId = `racing-${terminal}`;
      await seed(jobId, 'running');
      const completing = await db.pool.connect();
      let pollPromise: ReturnType<typeof poll> | undefined;
      try {
        const blockingPid = (await completing.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
        const waitingPid = (await polling.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
        let expected: Awaited<ReturnType<typeof read>>;
        pollPromise = poll(async () => {
          await completing.query('BEGIN');
          await completing.query(`UPDATE app_jobs SET status=$2,progress=100,message=$3,
            video_url=$4 WHERE job_id=$1`, [jobId, terminal,
            terminal === 'failed' ? 'Durable terminal failure' : null,
            terminal === 'completed' ? 'https://cdn.maxvideoai.com/ready.mp4' : null]);
          expected = (await completing.query('SELECT * FROM app_jobs WHERE job_id=$1', [jobId])).rows[0];
        });
        await waitForPostgresBlock(db.pool, waitingPid, blockingPid);
        const witness = `${jobId}-witness`;
        await seed(witness, 'pending');
        await db.pool.query("UPDATE app_jobs SET status='running',progress=50 WHERE job_id=$1", [witness]);
        assert.equal((await read(witness)).progress, 50);
        await completing.query('COMMIT');
        await pollPromise;
        assert.deepEqual(await read(jobId), expected!);
      } finally {
        await completing.query('ROLLBACK');
        await pollPromise?.catch(() => {});
        await db.pool.query('DELETE FROM app_jobs WHERE job_id=$1', [`${jobId}-witness`]);
        completing.release();
      }
    });
  }

  for (const active of ['pending', 'queued', 'running', 'processing', 'in_progress']) {
    await t.test(`fallback still fails an active ${active} job`, async () => {
      const jobId = `active-${active}`;
      await seed(jobId, active);
      await poll(async () => {});
      const row = await read(jobId);
      assert.equal(row.status, 'failed');
      assert.equal(row.progress, 1);
      assert.equal(typeof row.message, 'string');
      assert.equal(row.video_url, null);
    });
  }
  assert.equal(reconciliations, 7);
  assert.equal(submissions, 0);
});
