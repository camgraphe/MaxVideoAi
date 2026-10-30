import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { submitKlingDirectGenerateTask } from '../frontend/app/api/generate/_lib/kling-direct-submission';
import { submitGoogleVertexVeoGenerateTask } from '../frontend/app/api/generate/_lib/google-vertex-veo-submission';
import { submitLumaAgentsGenerateTask } from '../frontend/app/api/generate/_lib/luma-agents-submission';
import { submitAlibabaModelStudioGenerateTask } from '../frontend/app/api/generate/_lib/alibaba-model-studio-submission';
import { KlingDirectError } from '../frontend/src/server/video-providers/kling-direct/errors';
import { GoogleVertexVeoError } from '../frontend/src/server/video-providers/google-vertex-veo/errors';
import { LumaAgentsError } from '../frontend/src/server/video-providers/luma-agents/errors';
import { AlibabaModelStudioError } from '../frontend/src/server/video-providers/alibaba-model-studio/errors';
import { createPaidGenerationTestSchema, startDisposablePostgres } from './helpers/disposable-postgres';
import { waitForPostgresBlock } from './helpers/postgres-row-lock';

type QueryFn = <T = unknown>(sql: string, values?: unknown[]) => Promise<T[]>;
const owners = [
  { key: 'kling', engineId: 'kling-3-turbo-standard', provider: 'kling_direct' },
  { key: 'veo', engineId: 'veo-3-1', provider: 'google_vertex_veo_direct' },
  { key: 'luma', engineId: 'luma-ray-3-2', provider: 'luma_agents_direct' },
  { key: 'alibaba', engineId: 'wan-3', provider: 'alibaba_model_studio' },
] as const;
type Owner = typeof owners[number];

function submit(owner: Owner, jobId: string, queryFn: QueryFn, hooks: {
  createTask(): Promise<unknown>;
  onFallback(): void;
  onRollback(): void;
  onMetric?(): void;
}) {
  const durationSec = owner.key === 'veo' ? 8 : 5;
  const common = {
    jobId, userId: 'owner', engineId: owner.engineId, engineLabel: owner.key, mode: 't2v' as const,
    prompt: 'Offline accepted identity', negativePrompt: null, durationSec, aspectRatio: '16:9',
    audioEnabled: false, effectiveResolution: '720p', imageUrl: null, cfgScale: null,
    placeholderThumb: '/placeholder.svg', pricing: { totalCents: 125, currency: 'USD' },
    paymentStatus: 'paid_wallet', paymentMode: 'wallet' as const, walletChargeReserved: true,
    pendingReceipt: { userId: 'owner', jobId, amountCents: 125, currency: 'USD', description: 'Offline',
      snapshot: {}, applicationFeeCents: null, vendorAccountId: null },
    fallbackToFalEnabled: true, fallbackOnCreditsDepletedEnabled: true, elementRegistrationEnabled: false,
    falPayload: { jobId, engineId: owner.engineId, mode: 't2v' as const, prompt: 'Offline', durationSec,
      aspectRatio: '16:9', resolution: '720p' },
    falInputSummary: { hasImage: false, hasVideo: false, imageCount: 0, videoCount: 0 }, isLumaRay2: false,
    batchId: null, groupId: null, iterationIndex: null, iterationCount: null,
    renderIds: null, heroRenderId: null, localKey: null, logMetricFn: () => hooks.onMetric?.(),
  };
  const deps = {
    queryFn,
    submitFalGenerateTaskFn: async () => {
      hooks.onFallback();
      return { ok: true as const, generationResult: { provider: 'fal' as const, providerJobId: 'unexpected-fal',
        status: 'queued' as const, progress: 0, thumbUrl: '/placeholder.svg' } };
    },
    rollbackPendingPaymentFn: async () => { hooks.onRollback(); },
  };
  return owner.key === 'kling'
    ? submitKlingDirectGenerateTask({ ...common, deps: { ...deps,
        getKlingDirectClientFn: (() => ({ createTask: hooks.createTask })) as never } })
    : owner.key === 'veo'
      ? submitGoogleVertexVeoGenerateTask({ ...common, deps: { ...deps,
          getGoogleVertexVeoClientFn: (() => ({ createTask: hooks.createTask })) as never } })
      : owner.key === 'luma'
        ? submitLumaAgentsGenerateTask({ ...common, advancedDirectOnlyEnabled: false, deps: { ...deps,
            getLumaAgentsClientFn: (() => ({ createGeneration: async (_payload: unknown, options?: { requestId?: string }) => {
              assert.equal(options?.requestId, jobId);
              return hooks.createTask();
            } })) as never } })
        : submitAlibabaModelStudioGenerateTask({ ...common, deps: { ...deps,
            getAlibabaModelStudioClientFn: (() => ({ createVideo: hooks.createTask })) as never } });
}

test('validated direct acknowledgments survive local persistence outages and terminal winners', { timeout: 90_000 }, async t => {
  const db = await startDisposablePostgres('direct-ack-persistence');
  t.after(() => db.cleanup());
  const diagnosticLogs: unknown[][] = [];
  for (const method of ['warn', 'error', 'info'] as const) t.mock.method(console, method, (...args) => { diagnosticLogs.push(args); });
  await createPaidGenerationTestSchema(db.pool);
  await db.pool.query(readFileSync('neon/migrations/21_provider_attempts.sql', 'utf8'));
  const queryFn: QueryFn = async (sql, values) => (await db.pool.query(sql, values)).rows;
  const seed = async (owner: Owner, jobId: string) => {
    await db.pool.query(`INSERT INTO app_jobs(job_id,user_id,surface,engine_id,status,progress,provider,
      payment_status,final_price_cents,currency,pricing_snapshot,settings_snapshot,provisional)
      VALUES($1,'owner','video',$2,'running',3,$3,'paid_wallet',125,'USD','{"totalCents":125,"currency":"USD"}','{}',TRUE)`,
    [jobId, owner.engineId, owner.provider]);
    await db.pool.query("INSERT INTO app_receipts(user_id,type,job_id,amount_cents,currency) VALUES('owner','charge',$1,125,'USD')", [jobId]);
  };
  const read = async (jobId: string) => (await db.pool.query('SELECT * FROM app_jobs WHERE job_id=$1', [jobId])).rows[0];
  const receipts = async (jobId: string) => (await db.pool.query('SELECT type,amount_cents,currency FROM app_receipts WHERE job_id=$1 ORDER BY id', [jobId])).rows;
  const ack = (owner: Owner, id: string) => owner.key === 'veo'
    ? { name: id }
    : { providerJobId: id, status: 'queued', raw: { task_id: id } };

  for (const owner of owners) {
    const scenarios = ['attempt_reset', 'attempt_timeout', 'job_reset', 'job_timeout', 'both_saves', 'all_storage', 'read_only', 'metric', 'completed', 'failed', 'identity_winner', 'provider_winner',
      ...(owner.key === 'luma' || owner.key === 'alibaba' ? ['sanitize_raw', 'sanitize_getter'] : [])];
    for (const scenario of scenarios) {
      await t.test(`${owner.key}: ${scenario} after ACK cannot submit Fal or roll payment back`, async () => {
        const jobId = `job_ack_${owner.key}_${scenario}`;
        const acceptedId = `${owner.key}-accepted-${scenario}`;
        await seed(owner, jobId);
        let directCalls = 0;
        let falCalls = 0;
        let rollbackCalls = 0;
        let attemptSaveTried = false;
        let jobSaveTried = false;
        const diagnosticStart = diagnosticLogs.length;
        let terminalBefore: Awaited<ReturnType<typeof read>> | undefined;
        const execute: QueryFn = async (sql, values) => {
          const attemptSave = /UPDATE provider_attempts/.test(sql) && values?.[1] === acceptedId;
          const jobSave = /UPDATE app_jobs/.test(sql) && values?.includes(acceptedId);
          if (attemptSave) attemptSaveTried = true;
          if (jobSave) jobSaveTried = true;
          if ((attemptSave && (scenario.startsWith('attempt_') || scenario === 'both_saves' || scenario === 'all_storage'))
            || (jobSave && (scenario.startsWith('job_') || scenario === 'both_saves' || scenario === 'all_storage'))
            || (/SELECT \* FROM app_jobs/.test(sql) && (scenario === 'read_only' || scenario === 'all_storage'))) {
            throw Object.assign(new Error(scenario.endsWith('reset') ? 'read ECONNRESET' : 'query read timeout (ECONNRESET)'), { code: 'ECONNRESET' });
          }
          return queryFn(sql, values);
        };
        const result = await submit(owner, jobId, execute, {
          createTask: async () => {
            directCalls++;
            if (scenario === 'completed' || scenario === 'failed') {
              await db.pool.query(`UPDATE app_jobs SET status=$2,progress=100,provider_job_id=$3,video_url=$4,
                payment_status=$5,thumb_url='/winner.webp',message='Durable winner' WHERE job_id=$1`,
              [jobId, scenario, acceptedId, scenario === 'completed' ? 'https://cdn.maxvideoai.com/winner.mp4' : null,
                scenario === 'failed' ? 'refunded_wallet' : 'paid_wallet']);
              if (scenario === 'failed') await db.pool.query("INSERT INTO app_receipts(user_id,type,job_id,amount_cents,currency) VALUES('owner','refund',$1,125,'USD')", [jobId]);
              terminalBefore = await read(jobId);
            }
            if (scenario === 'identity_winner' || scenario === 'provider_winner') {
              await db.pool.query("UPDATE app_jobs SET provider=$2,provider_job_id=$3 WHERE job_id=$1", [jobId,
                scenario === 'provider_winner' ? 'fal' : owner.provider, `winner-${acceptedId}`]);
              terminalBefore = await read(jobId);
            }
            const task = ack(owner, acceptedId);
            if (scenario === 'sanitize_raw') Object.defineProperty(task, 'raw', {
              value: { get echoedInput() { throw new Error('https://private.example/input?X-Amz-Signature=ack-private-secret'); } },
            });
            if (scenario === 'sanitize_getter') Object.defineProperty(task, 'raw', {
              get() { throw new Error('https://private.example/input?X-Amz-Signature=ack-private-secret'); },
            });
            return task;
          },
          onFallback: () => { falCalls++; }, onRollback: () => { rollbackCalls++; },
          onMetric: () => { if (scenario === 'metric') throw new Error('Local metric unavailable'); },
        });
        assert.equal(directCalls, 1);
        assert.equal(falCalls, 0, 'an ACK cannot become permission for a second provider POST');
        assert.equal(rollbackCalls, 0, 'a local error after ACK is not refundable provider failure');
        assert.equal(result.ok, true);
        if (!result.ok || result.kind !== 'accepted') assert.fail('retain the accepted direct response');
        assert.equal(result.body.jobId, jobId);
        assert.equal(result.body.providerJobId, scenario.endsWith('_winner') ? `winner-${acceptedId}` : acceptedId);
        assert.equal(result.body.provider, scenario === 'provider_winner' ? 'fal' : owner.provider);
        assert.equal(attemptSaveTried, true);
        assert.equal(jobSaveTried, true, 'attempt-save failure must not skip job-save');
        const row = await read(jobId);
        const attempts = await queryFn<{ status: string; provider_job_id: string | null; response_snapshot: unknown }>(
          'SELECT status,provider_job_id,response_snapshot FROM provider_attempts WHERE job_id=$1', [row.id]);
        assert.equal(attempts.length, 1);
        assert.notEqual(attempts[0].status, 'failed');
        if (scenario.startsWith('sanitize_')) {
          assert.equal(attempts[0].response_snapshot, null, 'unsafe diagnostics are omitted without losing accepted identity');
          assert.equal(attempts[0].provider_job_id, acceptedId);
          assert.doesNotMatch(JSON.stringify({ body: result.body, attempts, logs: diagnosticLogs.slice(diagnosticStart) }),
            /ack-private-secret|X-Amz-Signature|private\.example/);
        }
        if (scenario.startsWith('job_') || scenario === 'read_only' || scenario === 'metric') {
          assert.equal(attempts[0].provider_job_id, acceptedId);
        }
        if (scenario.startsWith('attempt_') || scenario === 'read_only' || scenario === 'metric') {
          assert.equal(row.provider_job_id, acceptedId);
        }
        if (scenario === 'completed' || scenario === 'failed') {
          assert.deepEqual(row, terminalBefore, 'the accepted write must not reopen or replace the terminal winner');
          assert.equal(result.body.status, scenario);
          assert.equal(result.body.paymentStatus, row.payment_status);
          assert.equal(result.body.videoUrl, row.video_url);
        } else if (scenario.endsWith('_winner')) {
          assert.deepEqual(row, terminalBefore, 'an ACK cannot replace a different already-bound identity');
          assert.equal(attempts[0].provider_job_id, acceptedId, 'keep this ACK in its own attempt for reconciliation');
          assert.equal(result.body.deferred, true);
          assert.equal(result.body.paymentStatus, row.payment_status);
        } else {
          assert.equal(row.payment_status, 'paid_wallet');
          if (scenario === 'both_saves' || scenario === 'all_storage' || scenario === 'read_only' || scenario.startsWith('job_')) {
            assert.equal(result.body.deferred, true);
          }
          if (scenario === 'all_storage' || scenario === 'read_only') assert.equal(Object.hasOwn(result.body, 'paymentStatus'), false);
          else assert.equal(result.body.paymentStatus, 'paid_wallet');
        }
        assert.deepEqual(await receipts(jobId), scenario === 'failed'
          ? [{ type: 'charge', amount_cents: 125, currency: 'USD' }, { type: 'refund', amount_cents: 125, currency: 'USD' }]
          : [{ type: 'charge', amount_cents: 125, currency: 'USD' }]);
      });
    }

    for (const terminal of ['completed', 'failed'] as const) {
      await t.test(`${owner.key}: a real row-lock winner ${terminal} survives the ACK write`, async () => {
        const jobId = `job_ack_race_${owner.key}_${terminal}`;
        const acceptedId = `${owner.key}-race-${terminal}`;
        await seed(owner, jobId);
        const completing = await db.pool.connect();
        const accepting = await db.pool.connect();
        let pending: ReturnType<typeof submit> | undefined;
        try {
          const blockingPid = (await completing.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
          const waitingPid = (await accepting.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
          await completing.query('BEGIN');
          await completing.query(`UPDATE app_jobs SET status=$2,provider_job_id=$3,progress=100,
            video_url=$4,payment_status=$5 WHERE job_id=$1`, [jobId, terminal, acceptedId,
            terminal === 'completed' ? 'https://cdn.maxvideoai.com/concurrent.mp4' : null,
            terminal === 'failed' ? 'refunded_wallet' : 'paid_wallet']);
          const expected = (await completing.query('SELECT * FROM app_jobs WHERE job_id=$1', [jobId])).rows[0];
          pending = submit(owner, jobId, async (sql, values) => (await accepting.query(sql, values)).rows, {
            createTask: async () => ack(owner, acceptedId), onFallback: () => assert.fail('no Fal after ACK'),
            onRollback: () => assert.fail('no rollback after ACK'),
          });
          await waitForPostgresBlock(db.pool, waitingPid, blockingPid);
          const witnessId = `witness_${jobId}`;
          await seed(owner, witnessId);
          await db.pool.query("UPDATE app_jobs SET status='queued' WHERE job_id=$1", [witnessId]);
          assert.equal((await read(witnessId)).status, 'queued');
          await completing.query('COMMIT');
          const result = await pending;
          assert.equal(result.ok, true);
          if (!result.ok || result.kind !== 'accepted') assert.fail('durable terminal recovery response expected');
          assert.equal(result.body.status, terminal);
          assert.equal(result.body.paymentStatus, expected.payment_status);
          assert.equal(result.body.videoUrl, expected.video_url);
          assert.deepEqual(await read(jobId), expected);
        } finally {
          await completing.query('ROLLBACK');
          if (pending) await pending.catch(() => {});
          completing.release(); accepting.release();
        }
      });
    }

    for (const eligible of [false, true]) {
      await t.test(`${owner.key}: pre-ACK ${eligible ? 'eligible fallback' : 'definitive refusal'} keeps its existing rule`, async () => {
        const jobId = `job_preack_${owner.key}_${eligible}`;
        await seed(owner, jobId);
        let falCalls = 0;
        let rollbackCalls = 0;
        const result = await submit(owner, jobId, queryFn, {
          createTask: async () => {
            if (owner.key === 'kling') throw new KlingDirectError(eligible ? 'Account balance not enough' : 'Invalid prompt', {
              status: eligible ? 429 : 400, code: eligible ? '1102' : '1201',
            });
            if (owner.key === 'luma') throw Object.assign(new LumaAgentsError(eligible ? 'Rate limit exceeded' : 'Invalid prompt', {
              status: eligible ? 429 : 400, errorClass: eligible ? 'rate_limit' : 'invalid_request',
            }), { providerJobId: 'untrusted-error-id' });
            if (owner.key === 'alibaba') throw Object.assign(new AlibabaModelStudioError(eligible ? 'Rate limited' : 'Invalid prompt', {
              status: eligible ? 429 : 400, body: { code: eligible ? 'Throttling.RateQuota' : 'InvalidParameter', message: 'Offline refusal' },
            }), { providerJobId: 'untrusted-error-id' });
            throw new GoogleVertexVeoError(eligible ? 'Provider unavailable' : 'Invalid prompt', {
              status: eligible ? 503 : 400, errorClass: eligible ? 'provider_unavailable' : 'invalid_request',
            });
          },
          onFallback: () => { falCalls++; }, onRollback: () => { rollbackCalls++; },
        });
        assert.equal(falCalls, eligible ? 1 : 0);
        assert.equal(rollbackCalls, eligible ? 0 : 1);
        assert.equal(result.ok, eligible);
      });
    }
  }
});
