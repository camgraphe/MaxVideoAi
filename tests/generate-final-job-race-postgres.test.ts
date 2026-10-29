import assert from 'node:assert/strict';
import test from 'node:test';
import { persistFinalVideoJobUpdate } from '../frontend/app/api/generate/_lib/final-job-persistence';
import { submitFalGenerateTask } from '../frontend/app/api/generate/_lib/fal-submission';
import { FalTimeoutError } from '../frontend/app/api/generate/_lib/fal-error-handling';
import { startDisposablePostgres } from './helpers/disposable-postgres';
import { waitForPostgresBlock } from './helpers/postgres-row-lock';

test('late submission acknowledgments preserve terminal output while other jobs progress', { timeout: 90_000 }, async (t) => {
  const db = await startDisposablePostgres('final-job-race');
  t.after(() => db.cleanup());
  t.mock.method(console, 'error', () => {});
  await db.pool.query(`CREATE TABLE app_jobs (
    job_id text PRIMARY KEY, provider text, engine_id text, thumb_url text, aspect_ratio text,
    preview_frame text, eta_seconds integer, eta_label text, video_url text, status text,
    progress integer, provider_job_id text, final_price_cents integer, pricing_snapshot jsonb,
    cost_breakdown_usd jsonb, currency text, vendor_account_id text, payment_status text,
    stripe_payment_intent_id text, stripe_charge_id text, visibility text, indexable boolean,
    message text, settings_snapshot jsonb, mcp_trial_outcome_disposition text,
    provisional boolean, updated_at timestamptz DEFAULT NOW()
  ); CREATE TABLE fal_queue_log (
    job_id text, provider text, provider_job_id text, engine_id text, status text, payload jsonb
  )`);
  const queryFn = async <T,>(sql: string, params?: unknown[]): Promise<T[]> => (await db.pool.query(sql, params)).rows;
  const write = (jobId: string, status = 'queued', video: string | null = null, execute = queryFn) => persistFinalVideoJobUpdate({
    jobId, thumb: '/placeholder.svg', aspectRatio: '16:9', previewFrame: '/placeholder.svg',
    etaSeconds: 60, etaLabel: '60s', video, status, progress: status === 'completed' ? 100 : 5,
    providerJobId: 'request-' + jobId, finalPriceCents: 100, pricingSnapshotJson: '{}',
    costBreakdownJson: null, currency: 'USD', vendorAccountId: null, paymentStatus: 'paid_wallet',
    stripePaymentIntentId: null, stripeChargeId: null, visibility: 'private', indexable: false,
    message: 'Submission accepted', settingsSnapshotJson: '{}', queryFn: execute,
  });
  const seed = async (jobId: string, status: string) => {
    await db.pool.query(`INSERT INTO app_jobs(job_id,provider,engine_id,status,progress,video_url,
      thumb_url,preview_frame,message,settings_snapshot,payment_status,provider_job_id)
      VALUES($1,'fal','minimax-h3',$2,100,$3,'/final.webp','/final.webp',NULL,
        '{"providerVideoCopy":{"attempts":1}}','paid_wallet',$4)`,
    [jobId, status, status === 'completed' ? 'https://cdn.maxvideoai.com/final.mp4' : null, 'request-' + jobId]);
  };
  const read = async (id: string) => (await db.pool.query('SELECT * FROM app_jobs WHERE job_id=$1', [id])).rows[0];
  const timeout = (jobId: string, knownId: boolean,
    deps: NonNullable<Parameters<typeof submitFalGenerateTask>[0]['deps']> = {}) => submitFalGenerateTask({
    userId: 'owner', falPayload: { engineId: 'minimax-h3', prompt: 'test', mode: 't2v' },
    jobId, engineId: 'minimax-h3', engineLabel: 'MiniMax H3', isLumaRay2: false,
    batchId: null, durationSec: 5, pendingReceipt: { jobId } as never, paymentMode: 'direct',
    walletChargeReserved: false, getLastProviderJobId: () => knownId ? 'request-' + jobId : null,
    setLastProviderJobId: () => {}, persistProviderJobId: async () => {}, logMetricFn: () => {},
    deps: {
      queryFn, withFalTimeoutFn: async (promise) => promise,
      generateVideoFn: async () => { throw new FalTimeoutError('Submission response timed out'); },
      rollbackPendingPaymentFn: async () => { assert.fail('Timeout must not refund an accepted submission'); },
      ...deps,
    },
  });

  await t.test('completion before the acknowledgment preserves the entire persisted result', async () => {
    await seed('done', 'completed');
    const completed = await read('done');
    await write('done');
    assert.deepEqual(await read('done'), completed);
  });

  await t.test('an acknowledgment cannot reopen a definitively failed job', async () => {
    await seed('failed', 'failed');
    const failed = await read('failed');
    await write('failed', 'running');
    assert.deepEqual(await read('failed'), failed);
  });

  await t.test('a late usable completion can recover a previously failed job', async () => {
    await seed('recovered', 'failed');
    await write('recovered', 'completed', 'https://cdn.maxvideoai.com/late.mp4');
    assert.equal((await read('recovered')).status, 'completed');
    assert.equal((await read('recovered')).video_url, 'https://cdn.maxvideoai.com/late.mp4');
  });

  for (const { terminal, incoming } of [
    { terminal: 'completed', incoming: 'queued' },
    { terminal: 'completed', incoming: 'failed' },
    { terminal: 'failed', incoming: 'running' },
    { terminal: 'failed', incoming: 'completed' },
  ]) {
    await t.test(`SQL rechecks ${terminal} against late ${incoming} after a real row lock`, async () => {
      const jobId = `racing-${terminal}-${incoming}`;
      const witness = `witness-${terminal}-${incoming}`;
      await seed(jobId, 'running');
      await seed(witness, 'pending');
      const completing = await db.pool.connect();
      const submitting = await db.pool.connect();
      let acknowledgment: Promise<void> | undefined;
      try {
        const blockingPid = (await completing.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
        const waitingPid = (await submitting.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
        await completing.query('BEGIN');
        await completing.query(`UPDATE app_jobs SET status=$2,progress=100,
          video_url=$3 WHERE job_id=$1`, [jobId, terminal,
          terminal === 'completed' ? 'https://cdn.maxvideoai.com/concurrent.mp4' : null]);
        const expected = (await completing.query('SELECT * FROM app_jobs WHERE job_id=$1', [jobId])).rows[0];
        acknowledgment = write(jobId, incoming,
          incoming === 'completed' ? 'https://cdn.maxvideoai.com/late.mp4' : null,
          async <T,>(sql: string, params?: unknown[]): Promise<T[]> => (await submitting.query(sql, params)).rows);
        await waitForPostgresBlock(db.pool, waitingPid, blockingPid);
        await write(witness);
        assert.equal((await read(witness)).status, 'queued');
        await completing.query('COMMIT');
        await acknowledgment;
        if (incoming === 'completed') {
          const recovered = await read(jobId);
          assert.equal(recovered.status, 'completed');
          assert.equal(recovered.progress, 100);
          assert.equal(recovered.video_url, 'https://cdn.maxvideoai.com/late.mp4');
        } else {
          assert.deepEqual(await read(jobId), expected);
        }
      } finally {
        await completing.query('ROLLBACK');
        await acknowledgment?.catch(() => {});
        submitting.release();
        completing.release();
      }
    });
  }

  for (const active of ['pending', 'queued', 'running', 'processing', 'in_progress']) {
    await t.test(`an acknowledgment still advances an active ${active} job`, async () => {
      const jobId = `active-${active}`;
      await seed(jobId, active);
      await write(jobId, 'running');
      assert.equal((await read(jobId)).status, 'running');
      assert.equal((await read(jobId)).progress, 5);
    });
  }

  for (const terminal of ['completed', 'failed']) {
    for (const knownId of [true, false]) {
      await t.test(`timeout after ${terminal} preserves the job with ${knownId ? 'known' : 'unknown'} request ID`, async () => {
        const jobId = `timeout-${terminal}-${knownId}`;
        await seed(jobId, 'running');
        const completing = await db.pool.connect();
        const submitting = await db.pool.connect();
        let resultPromise: ReturnType<typeof submitFalGenerateTask> | undefined;
        let submissions = 0;
        let rollbacks = 0;
        try {
          const blockingPid = (await completing.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
          const waitingPid = (await submitting.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
          await completing.query('BEGIN');
          await completing.query(`UPDATE app_jobs SET status=$2,progress=100,video_url=$3 WHERE job_id=$1`,
            [jobId, terminal, terminal === 'completed' ? 'https://cdn.maxvideoai.com/timeout.mp4' : null]);
          const expected = (await completing.query('SELECT * FROM app_jobs WHERE job_id=$1', [jobId])).rows[0];
          resultPromise = timeout(jobId, knownId, {
            queryFn: async (sql, params) => (await submitting.query(sql, params)).rows,
            generateVideoFn: async () => {
              submissions++;
              throw new FalTimeoutError('Submission response timed out after the webhook');
            },
            rollbackPendingPaymentFn: async () => { rollbacks++; },
          });
          await waitForPostgresBlock(db.pool, waitingPid, blockingPid);
          const witness = `${jobId}-witness`;
          await seed(witness, 'pending');
          await write(witness);
          assert.equal((await read(witness)).status, 'queued');
          await completing.query('COMMIT');
          const result = await resultPromise;
          assert.equal(result.ok, false);
          if (!result.ok) assert.equal(result.status, 202);
          assert.equal(submissions, 1);
          assert.equal(rollbacks, 0);
          assert.deepEqual(await read(jobId), expected);
        } finally {
          await completing.query('ROLLBACK');
          await resultPromise?.catch(() => {});
          submitting.release();
          completing.release();
        }
      });
    }
  }

  for (const knownId of [true, false]) {
    for (const active of ['pending', 'queued', 'running', 'processing', 'in_progress']) {
      await t.test(`timeout still advances ${active} with ${knownId ? 'known' : 'unknown'} request ID`, async () => {
        const jobId = `active-timeout-${active}-${knownId}`;
        await seed(jobId, active);
        await db.pool.query('UPDATE app_jobs SET progress=0 WHERE job_id=$1', [jobId]);
        const result = await timeout(jobId, knownId);
        assert.equal(result.ok, false);
        if (!result.ok) assert.equal(result.status, 202);
        const row = await read(jobId);
        assert.equal(row.status, 'running');
        assert.ok(row.progress > 0);
        assert.equal(row.provisional, false);
      });
    }
  }
});
