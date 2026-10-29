import assert from 'node:assert/strict';
import test from 'node:test';
import { createFalClient } from '@fal-ai/client';
import { getFalClient } from '../frontend/src/lib/fal-client';
import { generateVideo } from '../frontend/src/lib/fal';
import { FalTimeoutError } from '../frontend/app/api/generate/_lib/fal-error-handling';
import { ENV } from '../frontend/src/lib/env';
import { getDb } from '../frontend/src/lib/db';
import { FalGenerationError, type FalGenerationPhase } from '../frontend/src/lib/fal-error';
import { submitFalGenerateTask } from '../frontend/app/api/generate/_lib/fal-submission';
import { createPaidGenerationTestSchema, startDisposablePostgres } from './helpers/disposable-postgres';

test('Fal acceptance phase controls durable deferral and terminal wallet settlement', { timeout: 90_000 }, async t => {
  const db = await startDisposablePostgres('fal-accepted-state');
  const previousDb = process.env.DATABASE_URL;
  const previousKey = ENV.FAL_API_KEY;
  process.env.DATABASE_URL = db.databaseUrl;
  ENV.FAL_API_KEY = 'offline-only';
  t.after(async () => {
    await getDb().end();
    if (previousDb === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previousDb;
    ENV.FAL_API_KEY = previousKey;
    await db.cleanup();
  });
  t.mock.method(console, 'warn', () => {});
  t.mock.method(console, 'error', () => {});
  await createPaidGenerationTestSchema(db.pool);
  await db.pool.query('CREATE TABLE fal_queue_log(job_id text,provider text,provider_job_id text,engine_id text,status text,payload jsonb)');
  let sequence = 0;
  const run = async (phase: FalGenerationPhase, status?: number, winner = false, engineId = 'minimax-h3', failRead = false, sdkTransport = false, unverifiedLocalId = false, timeoutSignal?: Promise<void>) => {
    const jobId = `phase-${sequence++}`;
    const knownId = !sdkTransport && (phase === 'accepted' || phase === 'provider_terminal') ? `accepted-${jobId}` : null;
    await db.pool.query(`INSERT INTO app_jobs(job_id,user_id,engine_id,engine_label,status,progress,
      provider,payment_status,provider_job_id,final_price_cents,currency,pricing_snapshot)
      VALUES($1,'owner',$2,'Offline fixture','running',10,'fal','paid_wallet',$3,125,'USD','{}')`, [jobId, engineId, knownId]);
    await db.pool.query("INSERT INTO app_receipts(user_id,type,job_id,amount_cents,currency) VALUES('owner','charge',$1,125,'USD')", [jobId]);
    let calls = 0;
    let tracked = 0;
    let lastKnownId = unverifiedLocalId ? 'forged-local-id' : knownId;
    const metrics: string[] = [];
    const result = await submitFalGenerateTask({
      userId: 'owner', falPayload: { engineId, prompt: 'Offline', mode: 't2v', ...(engineId === 'kling-v4' || sdkTransport ? {} : { submissionMode: 'enqueue' as const }) },
      jobId, engineId, engineLabel: 'Offline fixture', isLumaRay2: false, batchId: null, durationSec: 5,
      pendingReceipt: { userId: 'owner', jobId, amountCents: 999, currency: 'USD', description: 'Run', snapshot: {}, applicationFeeCents: null, vendorAccountId: null },
      paymentMode: 'wallet', walletChargeReserved: true,
      getLastProviderJobId: () => lastKnownId, setLastProviderJobId: id => { lastKnownId = id; },
      persistProviderJobId: async id => { tracked++; lastKnownId = id; },
      logMetricFn: kind => { metrics.push(kind); },
      deps: {
        queryFn: async (sql, values) => {
          if (failRead && sql.startsWith('SELECT * FROM app_jobs')) throw new Error('Temporary read outage');
          return (await db.pool.query(sql, values)).rows;
        },
        withFalTimeoutFn: async promise => {
          if (timeoutSignal) { await timeoutSignal; throw new FalTimeoutError('Local deadline after status update'); }
          return promise;
        },
        generateVideoFn: async (wirePayload, hooks) => {
          calls++;
          if (sdkTransport) return generateVideo(wirePayload, hooks);
          if (winner) await db.pool.query(`UPDATE app_jobs SET status='completed',progress=100,
            video_url='https://cdn.maxvideoai.com/winner.mp4',thumb_url='/winner.webp',message=NULL WHERE job_id=$1`, [jobId]);
          throw new FalGenerationError('Offline outcome', { phase, status, providerJobId: knownId ?? undefined,
            body: status === 422 ? { detail: [{ type: 'content_policy_violation', msg: 'Content blocked' }] } : undefined });
        },
        rollbackPendingPaymentFn: async () => { assert.fail('Wallet settlements use the atomic owner'); },
      },
    });
    assert.equal(calls, 1, 'the application must not submit a replacement');
    const row = (await db.pool.query('SELECT * FROM app_jobs WHERE job_id=$1', [jobId])).rows[0];
    const refunds = (await db.pool.query("SELECT amount_cents,currency FROM app_receipts WHERE job_id=$1 AND type='refund'", [jobId])).rows;
    return { result, row, refunds, metrics, knownId, tracked };
  };

  for (const status of [401, 403, 429, 500, 422, undefined]) {
    await t.test(`accepted read ${status ?? 'network outage'} keeps the original job and charge active`, async () => {
      const { result, row, refunds, metrics, knownId } = await run('accepted', status);
      assert.equal(result.ok, false);
      if (result.ok) return;
      assert.equal(result.status, 202);
      assert.equal(result.body.providerJobId, knownId);
      assert.equal(row.provider_job_id, knownId);
      assert.equal(row.status, 'running');
      assert.equal(row.payment_status, 'paid_wallet');
      assert.deepEqual(refunds, []);
      assert.deepEqual(metrics, []);
    });
  }
  for (const status of [401, 403, 429, 422]) {
    await t.test(`a definitive single POST ${status} remains refundable`, async () => {
      const { result, row, refunds } = await run('submission_rejected', status);
      assert.equal(result.ok, false);
      if (result.ok) return;
      assert.equal(result.status, status);
      assert.equal(row.status, 'failed');
      assert.equal(row.payment_status, 'refunded_wallet');
      assert.deepEqual(refunds, [{ amount_cents: 125, currency: 'USD' }]);
    });
  }
  for (const [phase, status] of [['pre_submission', undefined], ['provider_terminal', 422]] as const) {
    await t.test(`${phase} still settles a definitive failure`, async () => {
      const { result, row, refunds } = await run(phase, status);
      assert.equal(result.ok, false);
      if (result.ok) return;
      assert.notEqual(result.status, 202);
      assert.equal(row.status, 'failed');
      assert.deepEqual(refunds, [{ amount_cents: 125, currency: 'USD' }]);
    });
  }
  await t.test('a forced Kling enqueue with an uncertain acknowledgment remains recoverable', async () => {
    const { result, row, refunds } = await run('submission_unknown', undefined, false, 'kling-v4');
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.status, 202);
    assert.equal(result.body.message, 'We are checking whether this generation was accepted. Do not submit again.');
    assert.equal(row.status, 'running');
    assert.deepEqual(refunds, []);
  });
  await t.test('SDK uncertainty does not turn its last 403 into proof of a rejected POST', async () => {
    const { result, row, refunds } = await run('submission_unknown', 403);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.status, 202);
    assert.equal(row.status, 'running');
    assert.deepEqual(refunds, []);
  });
  await t.test('a winning completion is returned after an accepted read error', async () => {
    const { result, row, refunds, metrics } = await run('accepted', 401, true);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.status, 200);
    assert.equal(result.body.status, 'completed');
    assert.equal(result.body.videoUrl, row.video_url);
    assert.equal(result.body.paymentStatus, 'paid_wallet');
    assert.deepEqual(refunds, []);
    assert.deepEqual(metrics, []);
  });
  await t.test('a lost status read after acceptance never authorizes a refund', async () => {
    const { result, row, refunds } = await run('accepted', 403, false, 'minimax-h3', true);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.status, 202);
    assert.equal(row.status, 'running');
    assert.deepEqual(refunds, []);
  });

  await t.test('SDK ACK and status 403 flow through transport and submission into the same paid PostgreSQL job', async t => {
    const methods: string[] = [];
    const sdk = createFalClient({ credentials: 'offline-only', fetch: async (_url, init) => {
      methods.push(String(init?.method).toUpperCase());
      return new Response(JSON.stringify(methods.length === 1 ? { request_id: 'joint-accepted' } : { detail: 'Read forbidden' }),
        { status: methods.length === 1 ? 200 : 403, headers: { 'content-type': 'application/json' } });
    } });
    t.mock.method(getFalClient(), 'subscribe', sdk.subscribe);
    const { result, row, refunds } = await run('accepted', 403, false, 'minimax-h3', false, true);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.status, 202);
    assert.equal(result.body.providerJobId, 'joint-accepted');
    assert.equal(row.provider_job_id, 'joint-accepted');
    assert.equal(row.payment_status, 'paid_wallet');
    assert.deepEqual(refunds, []);
    assert.deepEqual(methods, ['POST', 'GET']);
  });
  await t.test('SDK error-only IDs never become an ACK, persisted provider identity or refund', async t => {
    const methods: string[] = [];
    const sdk = createFalClient({ credentials: 'offline-only', fetch: async (_url, init) => {
      methods.push(String(init?.method).toUpperCase());
      throw Object.assign(new Error('Untrusted transport diagnostic'), { status: 403, providerJobId: 'forged-provider-id', phase: 'accepted' });
    } });
    t.mock.method(getFalClient(), 'subscribe', sdk.subscribe);
    const { result, row, refunds, tracked } = await run('submission_unknown', 403, false, 'minimax-h3', false, true, true);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.status, 202);
    assert.equal(result.body.providerJobId, null);
    assert.equal(row.provider_job_id, null);
    assert.equal(tracked, 0);
    assert.equal(row.payment_status, 'paid_wallet');
    assert.deepEqual(refunds, []);
    assert.deepEqual(methods, ['POST']);
  });
  await t.test('forced Kling pretransport failure remains a definitive local failure', async () => {
    const { result, row, refunds } = await run('pre_submission', undefined, false, 'kling-v4');
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.notEqual(result.status, 202);
    assert.equal(row.status, 'failed');
    assert.deepEqual(refunds, [{ amount_cents: 125, currency: 'USD' }]);
  });

  await t.test('a mismatched SDK status cannot replace the accepted identity when the outer deadline wins', async t => {
    let release!: () => void;
    const timeoutSignal = new Promise<void>(resolve => { release = resolve; });
    let posts = 0;
    const sdk = createFalClient({ credentials: 'offline-only', fetch: async () => {
      posts++;
      return new Response(JSON.stringify({ request_id: 'accepted-A' }), { headers: { 'content-type': 'application/json' } });
    } });
    t.mock.method(sdk.queue, 'subscribeToStatus', async (_endpoint, options) => {
      options.onQueueUpdate?.({ request_id: 'untrusted-B', status: 'IN_PROGRESS', logs: [] });
      release();
      return new Promise(() => {});
    });
    t.mock.method(getFalClient(), 'subscribe', sdk.subscribe);
    const { result, row, refunds } = await run('accepted', undefined, false, 'minimax-h3', false, true, false, timeoutSignal);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.status, 202);
    assert.equal(result.body.providerJobId, 'accepted-A');
    assert.equal(row.provider_job_id, 'accepted-A');
    assert.equal(row.payment_status, 'paid_wallet');
    assert.deepEqual(refunds, []);
    assert.equal(posts, 1);
  });
});
