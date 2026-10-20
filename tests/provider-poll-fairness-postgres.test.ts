import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runAlibabaModelStudioPoll } from '../frontend/server/alibaba-model-studio-poll';
import { claimGenerationPoll } from '../frontend/server/generation-poll-state';
import { runGoogleVertexVeoPoll } from '../frontend/server/google-vertex-veo-poll';
import { runKlingDirectPoll } from '../frontend/server/kling-direct-poll';
import { runLumaAgentsPoll } from '../frontend/server/luma-agents-poll';
import {
  createPaidGenerationTestSchema,
  missingDisposablePostgresCommand,
  startDisposablePostgres,
} from './helpers/disposable-postgres';

type QueryFn = <T = unknown>(sql: string, params?: unknown[]) => Promise<T[]>;
type Retrieve = (providerJobId: string) => Promise<void>;
type ProviderCase = {
  name: string;
  provider: string;
  engineId: string;
  run(queryFn: QueryFn, retrieve: Retrieve, jobId?: string): Promise<Response>;
};

// Only the external provider is replaced. Selection, scheduling, claims and job
// updates execute the actual poller SQL against disposable PostgreSQL.
const providers: ProviderCase[] = [
  {
    name: 'Luma', provider: 'luma_agents_direct', engineId: 'luma-ray-3-2',
    run: (queryFn, retrieve, jobId) => runLumaAgentsPoll({ jobId, deps: {
      queryFn,
      getLumaAgentsClientFn: () => ({ getGeneration: async (id) => {
        await retrieve(id);
        return { id, state: 'processing' };
      } }),
    } }),
  },
  {
    name: 'Kling', provider: 'kling_direct', engineId: 'kling-3-pro',
    run: (queryFn, retrieve, jobId) => runKlingDirectPoll({ jobId, deps: {
      queryFn,
      getKlingDirectClientFn: () => ({ retrieveTask: async ({ providerJobId }) => {
        await retrieve(providerJobId);
        return { providerJobId, status: 'running', rawStatus: 'processing', videoUrl: null,
          message: null, usage: null, raw: { task_id: providerJobId, task_status: 'processing' } };
      } }),
    } }),
  },
  {
    name: 'Alibaba', provider: 'alibaba_model_studio', engineId: 'wan-3',
    run: (queryFn, retrieve, jobId) => runAlibabaModelStudioPoll({ jobId, deps: {
      queryFn,
      getAlibabaModelStudioClientFn: () => ({ getTask: async (id) => {
        await retrieve(id);
        return { output: { task_id: id, task_status: 'RUNNING' } };
      } }),
    } }),
  },
  {
    name: 'Veo', provider: 'google_vertex_veo_direct', engineId: 'veo-3-1-lite',
    run: (queryFn, retrieve, jobId) => runGoogleVertexVeoPoll({ jobId, deps: {
      queryFn,
      getGoogleVertexVeoClientFn: () => ({
        fetchOperation: async ({ operationName }) => {
          await retrieve(operationName);
          return { name: operationName, done: false };
        },
        downloadGcsUri: async () => { throw new Error('Running jobs must not download media'); },
      }),
    } }),
  },
];

test('direct provider batches yield after retrieval failures without weakening job or claim guards',
  { timeout: 90_000 }, async (t) => {
    const missing = missingDisposablePostgresCommand();
    if (missing) return t.skip(missing);
    const db = await startDisposablePostgres('provider-poll-fairness');
    t.after(() => db.cleanup());
    t.mock.method(console, 'warn', () => {}); // Expected provider failures, without noisy identifiers.
    await createPaidGenerationTestSchema(db.pool);
    await db.pool.query(readFileSync('neon/migrations/21_provider_attempts.sql', 'utf8'));
    await db.pool.query(readFileSync('neon/migrations/47_generation_poll_state.sql', 'utf8'));
    const queryFn: QueryFn = async (sql, params) => (await db.pool.query(sql, params)).rows;

    async function seed(provider: ProviderCase, count: number) {
      await db.pool.query('TRUNCATE app_jobs, provider_attempts, generation_poll_state RESTART IDENTITY CASCADE');
      await db.pool.query(`INSERT INTO app_jobs
        (job_id, user_id, provider, provider_job_id, engine_id, engine_label,
         status, progress, message, duration_sec, has_audio, aspect_ratio,
         final_price_cents, currency, payment_status, pricing_snapshot, settings_snapshot,
         created_at, updated_at)
        SELECT 'job-' || n, 'poll-user', $1, 'provider-' || n, $2, $2,
          'running', 10, 'Accepted', 8, true, '16:9',
          100, 'USD', 'paid_wallet', '{"totalCents":100,"currency":"USD"}',
          '{"inputMode":"t2v","core":{"mode":"t2v","resolution":"1080p"}}',
          NOW() - INTERVAL '3 minutes', NOW() - INTERVAL '2 minutes' + n * INTERVAL '1 second'
        FROM generate_series(0, $3::integer - 1) n`, [provider.provider, provider.engineId, count]);
    }

    for (const provider of providers) {
      await t.test(`${provider.name}: ten failing oldest jobs yield to the eleventh on the next batch`, async () => {
        await seed(provider, 11);
        const calls: string[] = [];
        const retrieve: Retrieve = async (id) => {
          calls.push(id);
          if (id !== 'provider-10') throw new Error('Persistent retrieval outage');
        };
        const first = await (await provider.run(queryFn, retrieve)).json();
        assert.equal(first.updates, 0);
        assert.deepEqual(calls, Array.from({ length: 10 }, (_, n) => `provider-${n}`));
        const second = await (await provider.run(queryFn, retrieve)).json();
        assert.equal(calls.includes('provider-10'), true, 'a failed full batch must not monopolize later selections');
        assert.equal(second.updates, 1);
        const rows = await queryFn<{ job_id: string; progress: number; checked_at: Date | null }>(
          'SELECT aj.job_id, progress, checked_at FROM app_jobs aj LEFT JOIN generation_poll_state ps USING (job_id) ORDER BY aj.id');
        assert.equal(rows[10].progress, 50);
        assert.ok(rows[10].checked_at, 'a successful retrieval records observation freshness');
        assert.ok(rows.slice(0, 10).every((row) => row.checked_at === null), 'failed retrievals are not successful observations');
      });

      await t.test(`${provider.name}: partial failures rotate without changing job progress or blocking healthy siblings`, async () => {
        await seed(provider, 3);
        const [before] = await queryFn<{ created_at: Date; updated_at: Date }>("SELECT created_at, updated_at FROM app_jobs WHERE job_id='job-0'");
        const body = await (await provider.run(queryFn, async (id) => {
          if (id === 'provider-0') throw new Error('One failed retrieval');
        })).json();
        assert.equal(body.updates, 2);
        const rows = await queryFn<{ status: string; progress: number; message: string; created_at: Date; updated_at: Date }>(
          'SELECT status, progress, message, created_at, updated_at FROM app_jobs ORDER BY id');
        assert.ok(rows[0].updated_at > before.updated_at, 'a failed retrieval advances batch scheduling');
        assert.deepEqual(rows[0].created_at, before.created_at, 'the maximum generation age is not extended');
        assert.equal(rows[0].status, 'running');
        assert.equal(rows[0].progress, 10);
        assert.equal(rows[0].message, 'Accepted');
        assert.deepEqual(rows.slice(1).map((row) => row.progress), [50, 50]);
      });

      await t.test(`${provider.name}: a terminal transition during failed retrieval is preserved exactly`, async () => {
        for (const status of ['completed', 'failed', 'cancelled']) {
          await seed(provider, 1);
          let terminalSnapshot: unknown;
          await provider.run(queryFn, async () => {
            [terminalSnapshot] = await queryFn(`UPDATE app_jobs SET status=$1, progress=100,
              message='Concurrent terminal result', video_url='https://example.invalid/durable.mp4',
              updated_at=NOW()-INTERVAL '1 second' WHERE job_id='job-0' RETURNING *`, [status]);
            throw new Error('Retrieval failed after another owner finished the job');
          });
          const [after] = await queryFn("SELECT * FROM app_jobs WHERE job_id='job-0'");
          assert.deepEqual(after, terminalSnapshot, `failure scheduling must not touch a ${status} job`);
          const [claim] = await queryFn<{ released: boolean; checked_at: Date | null }>(
            "SELECT lease_until <= NOW() AS released, checked_at FROM generation_poll_state WHERE job_id='job-0'");
          assert.equal(claim.released, true);
          assert.equal(claim.checked_at, null);
        }
      });

      await t.test(`${provider.name}: an existing poll claim prevents provider calls and scheduling writes`, async () => {
        await seed(provider, 1);
        const [before] = await queryFn("SELECT * FROM app_jobs WHERE job_id='job-0'");
        const claim = await claimGenerationPoll('job-0', queryFn);
        assert.ok(claim);
        let called = false;
        await provider.run(queryFn, async () => { called = true; });
        assert.equal(called, false);
        assert.deepEqual((await queryFn("SELECT * FROM app_jobs WHERE job_id='job-0'"))[0], before);
        await claim.release();
      });

      await t.test(`${provider.name}: an individual job poll bypasses batch ordering but preserves its claim throttle`, async () => {
        await seed(provider, 11);
        const calls: string[] = [];
        const retrieve: Retrieve = async (id) => { calls.push(id); };
        const first = await (await provider.run(queryFn, retrieve, 'job-10')).json();
        const second = await (await provider.run(queryFn, retrieve, 'job-10')).json();
        assert.equal(first.updates, 1);
        assert.equal(second.updates, 0);
        assert.deepEqual(calls, ['provider-10']);
        const [older] = await queryFn<{ progress: number }>("SELECT progress FROM app_jobs WHERE job_id='job-0'");
        assert.equal(older.progress, 10);
      });

      await t.test(`${provider.name}: scheduling timestamps do not extend the maximum generation age`, async () => {
        await seed(provider, 1);
        await db.pool.query("UPDATE app_jobs SET created_at=NOW()-INTERVAL '4 hours'");
        let called = false;
        await provider.run(queryFn, async () => { called = true; });
        assert.equal(called, false);
        const [job] = await queryFn<{ status: string; payment_status: string }>('SELECT status, payment_status FROM app_jobs');
        assert.equal(job.status, 'provider_polling_stalled');
        assert.equal(job.payment_status, 'paid_wallet', 'uncertain provider state requires review, not an automatic refund');
      });
    }
  });
