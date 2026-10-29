import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createFalClient } from '@fal-ai/client';
import { ENV } from '../frontend/src/lib/env';
import { getDb } from '../frontend/src/lib/db';
import { getFalClient } from '../frontend/src/lib/fal-client';
import { generateVideo } from '../frontend/src/lib/fal';
import { submitFalGenerateTask } from '../frontend/app/api/generate/_lib/fal-submission';
import { persistFinalVideoJobUpdate } from '../frontend/app/api/generate/_lib/final-job-persistence';
import { buildPersistedVideoJobResponse, readPersistedVideoJob } from '../frontend/app/api/generate/_lib/persisted-video-job';
import { submitAlibabaModelStudioGenerateTask } from '../frontend/app/api/generate/_lib/alibaba-model-studio-submission';
import { submitLumaAgentsGenerateTask } from '../frontend/app/api/generate/_lib/luma-agents-submission';
import { submitGoogleVertexVeoGenerateTask } from '../frontend/app/api/generate/_lib/google-vertex-veo-submission';
import { submitKlingDirectGenerateTask } from '../frontend/app/api/generate/_lib/kling-direct-submission';
import { AlibabaModelStudioError } from '../frontend/src/server/video-providers/alibaba-model-studio/errors';
import { LumaAgentsError } from '../frontend/src/server/video-providers/luma-agents/errors';
import { GoogleVertexVeoError } from '../frontend/src/server/video-providers/google-vertex-veo/errors';
import { KlingDirectError } from '../frontend/src/server/video-providers/kling-direct/errors';
import { createPaidGenerationTestSchema, startDisposablePostgres } from './helpers/disposable-postgres';

const providers = [
  { key: 'alibaba', engineId: 'wan-3', directProvider: 'alibaba_model_studio' },
  { key: 'luma', engineId: 'luma-ray-3-2', directProvider: 'luma_agents_direct' },
  { key: 'veo', engineId: 'veo-3-1', directProvider: 'google_vertex_veo_direct' },
  { key: 'kling', engineId: 'kling-3-turbo-standard', directProvider: 'kling_direct' },
] as const;
const scenarios = ['http503', 'network', 'network_status403', 'missing_id', 'malformed_json', 'accepted', 'tracking_failure', 'completed_winner'] as const;
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json' },
});

test('every direct-video Fal fallback uses one queue POST and preserves the paid attempt', { timeout: 90_000 }, async t => {
  const db = await startDisposablePostgres('fal-fallback-enqueue');
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
  for (const method of ['warn', 'error', 'info'] as const) t.mock.method(console, method, () => {});
  await createPaidGenerationTestSchema(db.pool);
  await db.pool.query(readFileSync('neon/migrations/21_provider_attempts.sql', 'utf8'));
  await db.pool.query(`ALTER TABLE app_jobs ADD COLUMN mcp_trial_outcome_disposition text;
    CREATE TABLE fal_queue_log(job_id text,provider text,provider_job_id text,engine_id text,status text,payload jsonb)`);
  const queryFn = async <T = unknown>(sql: string, values?: unknown[]) => (await db.pool.query(sql, values)).rows as T[];

  for (const provider of providers) {
    for (const scenario of scenarios) {
      await t.test(`${provider.key}: ${scenario} retains one Fal POST, one paid job and no automatic rollback`, async t => {
        const jobId = `job_fallback_${provider.key}_${scenario}`;
        const acceptedId = `ack-${provider.key}-${scenario}`;
        const methods: string[] = [];
        let posts = 0;
        let directCalls = 0;
        let fallbackCalls = 0;
        let rollbacks = 0;
        let trackingFailures = 0;
        await db.pool.query(`INSERT INTO app_jobs(job_id,user_id,surface,engine_id,engine_label,status,progress,
          provider,payment_status,final_price_cents,currency,pricing_snapshot,provisional)
          VALUES($1,'owner','video',$2,'Offline fixture','running',10,$3,'paid_wallet',125,'USD','{}',TRUE)`,
        [jobId, provider.engineId, provider.directProvider]);
        await db.pool.query("INSERT INTO app_receipts(user_id,type,job_id,amount_cents,currency) VALUES('owner','charge',$1,125,'USD')", [jobId]);

        // Both the legacy SDK branch and the one-shot branch use this fake wire.
        // A legacy retry gets a valid second ACK so the red test proves two POSTs.
        const fakeFetch: typeof fetch = async (input, init) => {
          const url = new URL(String(input));
          assert.equal(url.origin, 'https://queue.fal.run', 'no live or second-provider request');
          const method = String(init?.method ?? 'GET').toUpperCase();
          methods.push(method);
          if (method !== 'POST') return response(url.pathname.endsWith('/status')
            ? { request_id: acceptedId, status: 'COMPLETED' }
            : { video_url: 'https://cdn.maxvideoai.com/offline-result.mp4' });
          posts++;
          if (posts > 1) return response({ request_id: acceptedId }, 202);
          if (scenario === 'completed_winner') {
            await db.pool.query(`UPDATE app_jobs SET status='completed',progress=100,
              video_url='https://cdn.maxvideoai.com/concurrent-winner.mp4',message=NULL WHERE job_id=$1`, [jobId]);
          }
          if (scenario === 'http503' || scenario === 'completed_winner') return response({ detail: 'Temporarily unavailable' }, 503);
          if (scenario === 'network' || scenario === 'network_status403') {
            throw Object.assign(new Error('Ambiguous network response'), scenario === 'network_status403' ? { status: 403 } : {});
          }
          if (scenario === 'missing_id') return response({ status: 'IN_QUEUE' }, 202);
          if (scenario === 'malformed_json') return new Response('{broken', { status: 202 });
          const callback = url.searchParams.get('fal_webhook');
          if (callback) assert.equal(new URL(callback).searchParams.get('jobId'), jobId);
          return response({ request_id: acceptedId }, 202);
        };
        const sdk = createFalClient({ credentials: 'offline-only', fetch: fakeFetch });
        t.mock.method(getFalClient(), 'subscribe', sdk.subscribe);
        t.mock.method(globalThis, 'fetch', fakeFetch);
        const rollbackPendingPaymentFn = async () => { rollbacks++; };
        const submitFalGenerateTaskFn: typeof submitFalGenerateTask = async params => {
          fallbackCalls++;
          assert.equal(params.jobId, jobId);
          assert.equal(params.falPayload.jobId, jobId);
          return submitFalGenerateTask({ ...params,
            persistProviderJobId: async (...args) => {
              await params.persistProviderJobId(...args);
              if (scenario === 'tracking_failure' && trackingFailures++ === 0) {
                throw Object.assign(new Error('Local accepted-identity persistence outage'), { status: 422 });
              }
            },
            deps: { queryFn, generateVideoFn: generateVideo, rollbackPendingPaymentFn,
              withFalTimeoutFn: promise => promise },
          });
        };
        const durationSec = provider.key === 'veo' ? 8 : 5;
        const common = {
          jobId, userId: 'owner', engineId: provider.engineId, engineLabel: 'Offline fixture',
          mode: 't2v' as const, prompt: 'Offline fallback test', negativePrompt: null, durationSec,
          aspectRatio: '16:9', audioEnabled: false, effectiveResolution: '720p', imageUrl: null,
          placeholderThumb: '/assets/frames/thumb-16x9.svg', pricing: { totalCents: 125, currency: 'USD' },
          paymentStatus: 'paid_wallet', paymentMode: 'wallet' as const, walletChargeReserved: true,
          pendingReceipt: { userId: 'owner', jobId, amountCents: 125, currency: 'USD', description: 'Offline run',
            snapshot: {}, applicationFeeCents: null, vendorAccountId: null },
          fallbackToFalEnabled: true,
          falPayload: { jobId, engineId: provider.engineId, mode: 't2v' as const, prompt: 'Offline fallback test',
            durationSec, durationOption: `${durationSec}s`, resolution: '720p', aspectRatio: '16:9' },
          falInputSummary: { hasImage: false, hasVideo: false, imageCount: 0, videoCount: 0 },
          isLumaRay2: false, batchId: null, groupId: null, iterationIndex: null, iterationCount: null,
          renderIds: null, heroRenderId: null, localKey: null, logMetricFn() {},
        };
        const deps = { queryFn, rollbackPendingPaymentFn, submitFalGenerateTaskFn };
        const directRejection = async () => {
          directCalls++;
          if (provider.key === 'alibaba') throw new AlibabaModelStudioError('Rate limited', {
            status: 429, body: { code: 'Throttling.RateQuota', message: 'Too many requests' },
          });
          if (provider.key === 'luma') throw new LumaAgentsError('Rate limit exceeded', { status: 429 });
          if (provider.key === 'veo') throw new GoogleVertexVeoError('Provider unavailable', { status: 503 });
          throw new KlingDirectError('Account balance not enough', { status: 429, code: '1102',
            body: { code: 1102, message: 'Account balance not enough' } });
        };
        const result = provider.key === 'alibaba'
          ? await submitAlibabaModelStudioGenerateTask({ ...common, deps: { ...deps,
              getAlibabaModelStudioClientFn: () => ({ createVideo: directRejection, getTask: directRejection }) } })
          : provider.key === 'luma'
            ? await submitLumaAgentsGenerateTask({ ...common, advancedDirectOnlyEnabled: false, deps: { ...deps,
                getLumaAgentsClientFn: () => ({ createGeneration: directRejection, getGeneration: directRejection }) } })
            : provider.key === 'veo'
              ? await submitGoogleVertexVeoGenerateTask({ ...common, deps: { ...deps,
                  getGoogleVertexVeoClientFn: (() => ({ createTask: directRejection })) as never } })
              : await submitKlingDirectGenerateTask({ ...common, cfgScale: null, fallbackOnCreditsDepletedEnabled: true,
                  elementRegistrationEnabled: false, deps: { ...deps,
                    getKlingDirectClientFn: (() => ({ createTask: directRejection })) as never } });

        assert.equal(directCalls, 1, 'the direct provider is tried once before the eligible fallback');
        assert.equal(fallbackCalls, 1, 'no second fallback or provider is invoked');
        assert.deepEqual(methods, ['POST'], 'fallback rendering must not enter SDK subscribe or retry its queue POST');
        assert.equal(rollbacks, 0);
        const attempts = await queryFn<{ provider: string; status: string; provider_job_id: string | null }>(
          `SELECT a.provider,a.status,a.provider_job_id FROM provider_attempts a JOIN app_jobs j ON j.id=a.job_id
           WHERE j.job_id=$1 ORDER BY a.attempt_index`, [jobId]);
        assert.equal(attempts.length, 2);
        assert.equal(attempts[0].provider, provider.directProvider);
        assert.equal(attempts[0].status, 'failed');
        assert.equal(attempts[1].provider, 'fal');

        if (scenario === 'accepted') {
          assert.equal(result.ok, true);
          if (!result.ok || result.kind !== 'fal_result') assert.fail('the fallback should return its accepted queue result');
          assert.equal(result.generationResult.providerJobId, acceptedId);
          assert.equal(result.generationResult.status, 'queued');
          assert.equal(attempts[1].provider_job_id, acceptedId);
          assert.equal(attempts[1].status, 'accepted');
          // The route's normal continuation persists the queued result before recovery.
          await persistFinalVideoJobUpdate({ jobId, thumb: result.generationResult.thumbUrl, aspectRatio: '16:9',
            previewFrame: null, etaSeconds: null, etaLabel: null, video: null, status: 'queued', progress: 0,
            providerJobId: acceptedId, finalPriceCents: 125, pricingSnapshotJson: '{}', costBreakdownJson: null,
            currency: 'USD', vendorAccountId: null, paymentStatus: 'paid_wallet', stripePaymentIntentId: null,
            stripeChargeId: null, visibility: 'private', indexable: false, message: null, settingsSnapshotJson: '{}', queryFn });
        } else {
          assert.equal(result.ok, false);
          if (result.ok) assert.fail('an ambiguous submission or concurrent winner should use the durable response');
          assert.equal(result.status, scenario === 'completed_winner' ? 200 : 202);
          assert.equal(result.body.jobId, jobId);
          assert.equal(result.body.status, scenario === 'completed_winner' ? 'completed' : 'running');
          if (scenario === 'completed_winner') assert.equal(result.body.videoUrl, 'https://cdn.maxvideoai.com/concurrent-winner.mp4');
          if (scenario === 'tracking_failure') {
            assert.equal(result.body.providerJobId, acceptedId);
            assert.equal(attempts[1].provider_job_id, acceptedId);
            assert.equal(attempts[1].status, 'accepted');
          } else if (scenario !== 'completed_winner') {
            assert.equal(attempts[1].status, 'fallback_started', 'uncertainty is not a definitive Fal failure');
          }
        }
        const stored = await readPersistedVideoJob(jobId, queryFn);
        assert.equal(stored.payment_status, 'paid_wallet');
        assert.equal(stored.provider, 'fal');
        assert.equal(stored.status, scenario === 'completed_winner' ? 'completed' : scenario === 'accepted' ? 'queued' : 'running');
        assert.equal(stored.provider_job_id, scenario === 'accepted' || scenario === 'tracking_failure' ? acceptedId : null);
        const recovered = buildPersistedVideoJobResponse(await readPersistedVideoJob(jobId, queryFn));
        assert.equal(recovered.jobId, jobId);
        assert.equal(recovered.status, stored.status);
        assert.equal(recovered.paymentStatus, 'paid_wallet');
        assert.deepEqual(await queryFn("SELECT type,amount_cents FROM app_receipts WHERE job_id=$1 ORDER BY id", [jobId]),
          [{ type: 'charge', amount_cents: 125 }]);
        assert.deepEqual(methods, ['POST'], 'reading the durable job must not submit anything');
      });
    }
  }
});
