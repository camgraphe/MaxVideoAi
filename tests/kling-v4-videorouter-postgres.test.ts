import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { submitGenerateProviderTask, type GenerateProviderSubmissionParams } from '../frontend/app/api/generate/_lib/video-provider-submission';
import { customerGenerationResponse } from '../frontend/app/api/generate/_lib/customer-generation-response';
import { runAlibabaModelStudioPoll } from '../frontend/server/alibaba-model-studio-poll';
import { reconcileKlingV4WalletStops } from '../frontend/src/server/video-providers/videorouter/kling-v4-wallet-stop';
import { reconcileVideoRouterCosts } from '../frontend/src/server/video-providers/videorouter/settlement';
import { createPinnedVideoRouterClient, VideoRouterSubmitError } from '../frontend/src/server/video-providers/videorouter/client';
import { klingV4SandBaseRequest } from '../frontend/src/server/video-providers/videorouter/kling-v4';
import { getDb } from '../frontend/src/lib/db';
import { ENV } from '../frontend/src/lib/env';
import { klingV4SandBasePlan, klingV4SandBaseReferences } from '../frontend/src/server/video-providers/videorouter/kling-v4';
import { createPaidGenerationTestSchema, startDisposablePostgres } from './helpers/disposable-postgres';

const images = [1, 2, 3].map(n => 'https://fixture.example/' + n + '.jpg');
function request(jobId: string, totalCents = 70): GenerateProviderSubmissionParams {
  const prompt = 'Use the ordered reference images in a three-second shot.';
  const inputs = images.map((url, i) => ({ name: i + '.jpg', type: 'image/jpeg', size: 5000, kind: 'image' as const,
    slotId: 'image_urls', url, assetId: 'asset-' + i }));
  return {
    providerRoutingPlan: { kind: 'fal_only', primaryProvider: 'fal', fallbackEnabled: false },
    engineId: 'kling-v4', jobId, userId: 'fixture-user', engineLabel: 'Kling V4', providerKey: 'fal', mode: 'ref2v',
    durationSec: 3, prompt, aspectRatio: '16:9', effectiveResolution: '720p', audioEnabled: true, cfgScale: null, imageUrl: null,
    falPayload: { engineId: 'kling-v4', prompt, durationSec: 3, durationOption: '3', resolution: '720p', mode: 'ref2v',
      jobId, aspectRatio: '16:9', audio: true, inputs, referenceImages: [...images] },
    falInputSummary: { primaryImageUrl: null, primaryAudioUrl: null, referenceImageCount: 3, referenceVideoCount: 0,
      referenceAudioCount: 0, hasFirstFrame: false, hasLastFrame: false, inputSlots: [] },
    pricing: { currency: 'USD', totalCents, subtotalBeforeDiscountCents: totalCents, base: { amountCents: totalCents, seconds: 3, rate: 0.157 },
      addons: [], margin: { amountCents: 0 } },
    walletChargeReserved: true, pendingReceipt: null, paymentMode: 'wallet', paymentStatus: 'paid_wallet', placeholderThumb: '/thumb.svg',
    isLumaRay2: false, groupId: null, batchId: null, renderIds: null, heroRenderId: null, localKey: null, iterationCount: null,
    iterationIndex: null, logMetricFn() {},
  };
}

test('Kling profiles preserve original requests and admit only the reviewed contract', async () => {
  assert.equal(klingV4SandBasePlan(30, 50_000_000).candidates[0].costMicros, 4_105_125);
  assert.equal(klingV4SandBasePlan(30, 50_000_000).baselineMicros, 4_710_000);
  const valid = request('fixture').falPayload;
  assert.deepEqual(klingV4SandBaseReferences(valid), images);
  assert.deepEqual(klingV4SandBaseReferences({ ...valid, referenceImages: undefined }), images);
  for (const variation of [{ audio: false }, { videoUrl: 'https://fixture.example/source.mp4' }, { extraInputValues: { hdr: true } },
    { seed: 0 }, { multiPrompt: [{ prompt: 'A different shot', duration: 3 }] }, { durationSec: 31 }, { durationOption: 2 },
    { aspectRatio: 'auto' }, { resolution: '1080p' }, { imageUrl: images[0] }, { apiKey: 'caller-key' },
    { referenceImages: images.slice(0, 2) }, { inputs: valid.inputs!.slice().reverse() },
    { inputs: valid.inputs!.map(item => ({ ...item, assetId: undefined })) }, { engineId: 'kling-v4-flash' }]) {
    const params = request('fixture');
    Object.assign(params.falPayload, variation);
    const before = structuredClone(params.falPayload);
    assert.equal(klingV4SandBaseReferences(params.falPayload), null);
    assert.deepEqual(params.falPayload, before);
  }
});

test('Kling price preflight checks the quoted host, each requested dimension and the maximum before purchase', async () => {
  const assumptions = { duration_secs: 3, resolution: '720p', reference_images: 3, aspect_ratio: '16:9' };
  const quote = { object: 'pricing.estimate', type: 'video', model: 'sandbase/kling-v4.0', currency: 'USD',
    estimated_cost_usd: 0.405, max_cost_usd: 0.41, assumptions };
  for (const patch of [{ model: 'another/kling-v4.0' }, { max_cost_usd: 0.42 }, { max_cost_usd: null }, { max_cost_usd: 0.39 },
    { currency: 'EUR' }, ...Object.entries({ duration_secs: 4, resolution: '1080p', reference_images: 2, aspect_ratio: '9:16' })
      .map(([field, value]) => ({ assumptions: { ...assumptions, [field]: value } }))]) {
    let calls = 0;
    const client = createPinnedVideoRouterClient('offline', async input => {
      assert.equal(new URL(String(input)).pathname, '/v1/pricing/estimate');
      calls++;
      return Response.json({ ...quote, ...patch });
    });
    await assert.rejects(client.createVideo(klingV4SandBaseRequest('The scene.', 3, images, 0.41)),
      error => error instanceof VideoRouterSubmitError && error.outcome === 'refused');
    assert.equal(calls, 1);
  }
});

test('Kling wallet purchases reconcile SandBase, direct Fal fallback receipts and ambiguous submissions', async t => {
  const pg = await startDisposablePostgres('kling-v4-videorouter');
  const env = { DATABASE_URL: pg.databaseUrl, KLING_V4_VIDEOROUTER_CANARY: 'public', VIDEOROUTER_API_KEY: 'offline' };
  const previous = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  const previousFal = ENV.FAL_API_KEY;
  Object.assign(process.env, env);
  ENV.FAL_API_KEY = 'offline';
  t.after(async () => {
    await getDb().end();
    ENV.FAL_API_KEY = previousFal;
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    await pg.cleanup();
  });
  await createPaidGenerationTestSchema(pg.pool);
  await pg.pool.query(readFileSync('neon/migrations/21_provider_attempts.sql', 'utf8'));
  await pg.pool.query('CREATE TABLE fal_queue_log(job_id text,provider text,provider_job_id text,engine_id text,status text,payload jsonb)');
  for (const scenario of ['success', 'quota', 'timeout', 'invalid', 'budget', 'estimate', 'over-budget-fallback', 'flag-off', 'other-settings', 'refund-outage', 'budget-outage']) {
    await t.test(scenario, async sub => {
      const budget = scenario === 'budget' || scenario === 'budget-outage';
      const refundOutage = scenario.endsWith('-outage');
      const params = request(scenario, budget ? 35 : scenario === 'over-budget-fallback' ? 42 : 70);
      if (scenario === 'other-settings') {
        // This valid setting is native-only. Direct Fal must receive the exact original shape.
        params.falPayload.resolution = '1080p';
        params.effectiveResolution = '1080p';
        params.falPayload.aspectRatio = '9:16';
        params.aspectRatio = '9:16';
      }
      const original = structuredClone(params.falPayload);
      await pg.pool.query(`INSERT INTO app_jobs(job_id,user_id,surface,engine_id,engine_label,duration_sec,provider,status,
        currency,final_price_cents,has_audio,payment_status,settings_snapshot,pricing_snapshot)
        VALUES($1,$2,'video','kling-v4','Kling V4',3,'fal','queued','USD',$3,true,'paid_wallet','{}',$4)`,
      [scenario, params.userId, params.pricing.totalCents, JSON.stringify(params.pricing)]);
      await pg.pool.query("INSERT INTO app_receipts(job_id,user_id,type,amount_cents,currency,surface) VALUES($1,$2,'charge',$3,'USD','video')",
        [scenario, params.userId, params.pricing.totalCents]);
      if (refundOutage) await pg.pool.query(`CREATE OR REPLACE FUNCTION reject_test_refund() RETURNS trigger LANGUAGE plpgsql
        AS $$ BEGIN IF NEW.type='refund' THEN RAISE EXCEPTION 'simulated temporary refund outage'; END IF; RETURN NEW; END $$;
        CREATE TRIGGER reject_test_refund BEFORE INSERT ON app_receipts FOR EACH ROW EXECUTE FUNCTION reject_test_refund();`);
      let quotes = 0, routerPosts = 0, falPosts = 0;
      if (scenario === 'flag-off') delete process.env.KLING_V4_VIDEOROUTER_CANARY;
      sub.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(String(input));
        assert.equal(init?.method, 'POST');
        const body = JSON.parse(String(init.body));
        if (url.hostname === 'queue.fal.run') {
          falPosts++;
          assert.equal(url.pathname, '/kling/v4/reference-to-video');
          assert.deepEqual(body.image_urls, images);
          assert.equal(body.resolution, params.effectiveResolution);
          assert.equal(body.aspect_ratio, params.aspectRatio);
          const id = 'fal-fixture';
          const base = 'https://queue.fal.run/kling/v4/requests/' + id;
          return Response.json({ request_id: id, status_url: base + '/status', response_url: base, cancel_url: base + '/cancel' });
        }
        assert.equal(url.hostname, 'videorouter.sh');
        assert.deepEqual(body.provider, { only: ['sandbase'], allow_fallbacks: false });
        assert.equal(body.strict_duration, true);
        assert.equal(body.generate_audio, undefined);
        assert.deepEqual(body.input_references.map((item: {image_url: {url:string}}) => item.image_url.url), images);
        if (url.pathname === '/v1/pricing/estimate') {
          quotes++;
          return Response.json({ object: 'pricing.estimate', type: 'video', model: 'sandbase/kling-v4.0', currency: 'USD',
            estimated_cost_usd: 0.4, max_cost_usd: scenario === 'estimate' ? 5 : 0.4,
            assumptions: { duration_secs: 3, resolution: '720p', reference_images: 3, aspect_ratio: '16:9' } });
        }
        assert.equal(url.pathname, '/v1/videos');
        routerPosts++;
        if (scenario === 'timeout') throw new Error('lost ACK');
        if (scenario === 'invalid' || scenario === 'refund-outage') return Response.json({ error: { code: 'policy_violation' } }, { status: 422 });
        if (scenario === 'quota' || scenario === 'over-budget-fallback') return Response.json({ error: { code: 'insufficient_credits' } }, { status: 402 });
        return Response.json({ id: 'sandbase:opaque-id' });
      });
      const [response] = await Promise.all([submitGenerateProviderTask(params), submitGenerateProviderTask(params)]);
      assert.deepEqual(params.falPayload, original);
      assert.equal(quotes, (budget || ['flag-off', 'other-settings'].includes(scenario)) ? 0 : 1);
      assert.equal(routerPosts, (budget || ['estimate', 'flag-off', 'other-settings'].includes(scenario)) ? 0 : 1);
      assert.equal(falPosts, ['quota', 'estimate', 'flag-off', 'other-settings'].includes(scenario) ? 1 : 0);
      if (refundOutage) {
        const held = (await pg.pool.query('SELECT * FROM app_jobs WHERE job_id=$1', [scenario])).rows[0];
        assert.equal(held.status, 'provider_polling_stalled');
        assert.equal(held.payment_status, 'paid_wallet');
        assert.equal(held.settings_snapshot.klingV4WalletStop.reason, budget ? 'refused' : 'invalid');
        const prior = (await pg.pool.query('SELECT a.status,a.error_class,a.accepted_at FROM provider_attempts a JOIN app_jobs j ON j.id=a.job_id WHERE j.job_id=$1', [scenario])).rows;
        assert.deepEqual(prior, budget ? [] : [{ status: 'failed', error_class: 'invalid', accepted_at: null }]);
        // The same job, a different profile and a disabled canary must never become a new purchase.
        process.env.KLING_V4_VIDEOROUTER_CANARY = '';
        try {
          await submitGenerateProviderTask({ ...params, effectiveResolution: '1080p',
            falPayload: { ...params.falPayload, resolution: '1080p' } });
          assert.equal(falPosts, 0);
          assert.equal(routerPosts, budget ? 0 : 1);
          await pg.pool.query('DROP TRIGGER reject_test_refund ON app_receipts');
          const concurrent = await Promise.all([reconcileKlingV4WalletStops(), reconcileKlingV4WalletStops()]);
          assert.equal(concurrent.reduce((sum, r) => sum + r.settled, 0), 1);
          assert.deepEqual(await reconcileKlingV4WalletStops(), { checked: 0, settled: 0, errors: 0 });
        } finally { process.env.KLING_V4_VIDEOROUTER_CANARY = 'public'; }
      }
      const [job] = (await pg.pool.query('SELECT * FROM app_jobs WHERE job_id=$1', [scenario])).rows;
      const attempts = (await pg.pool.query('SELECT a.* FROM provider_attempts a JOIN app_jobs j ON j.id=a.job_id WHERE j.job_id=$1 ORDER BY a.attempt_index', [scenario])).rows;
      const receipts = (await pg.pool.query('SELECT type,amount_cents FROM app_receipts WHERE job_id=$1 ORDER BY id', [scenario])).rows;
      const refused = budget || refundOutage || ['invalid', 'over-budget-fallback'].includes(scenario);
      assert.equal(job.payment_status, refused ? 'refunded_wallet' : 'paid_wallet');
      assert.equal(receipts[0].amount_cents, params.pricing.totalCents);
      assert.deepEqual(receipts.map(r => r.type), refused ? ['charge','refund'] : ['charge']);
      if (refused) assert.equal(receipts[1].amount_cents, params.pricing.totalCents);
      if (scenario === 'success') {
        assert.equal(job.provider, 'videorouter');
        assert.equal(job.provider_job_id, 'sandbase:opaque-id');
        assert.equal(attempts[0].status, 'accepted');
        assert.equal(attempts[0].request_snapshot.purchaseRouting.baselineProvider, 'fal');
        await pg.pool.query("UPDATE app_jobs SET updated_at=NOW()-INTERVAL '2 minutes' WHERE job_id=$1", [scenario]);
        let reads = 0;
        const readTask = createPinnedVideoRouterClient('offline', async (input, init) => {
          assert.equal(init?.method, 'GET');
          assert.equal(new URL(String(input)).pathname, '/v1/videos/sandbase%3Aopaque-id');
          return Response.json({ id: 'sandbase:opaque-id', status: 'completed', data: [{ url: 'https://fixture.example/output.mp4' }],
            ...(reads++ ? { cost_usd: 0.405354 } : {}) });
        });
        const poll = await runAlibabaModelStudioPoll({ provider: 'videorouter', jobId: scenario, deps: {
          queryFn: async (sql, args) => (await pg.pool.query(sql, args)).rows,
          claimPollFn: async () => ({ checked: async () => {}, release: async () => {} }),
          getVideoRouterClientFn: () => ({ getTask: readTask.getTask, createVideo: async () => assert.fail('no generation on poll') }),
          ensureFastStartVideoFn: async () => 'https://media.example/owned.mp4', detectVideoDimensionsFn: async () => ({ width: 1280, height: 720 }),
          ensureJobThumbnailFn: async () => null, generateAndPersistJobKeyframesFn: async () => null,
          upsertLegacyJobOutputsFn: async () => {}, generateAndPersistJobPreviewVideoFn: async () => null,
        } });
        assert.equal((await poll.json()).updates, 1);
        const settlement = await reconcileVideoRouterCosts(async (sql, args) => (await pg.pool.query(sql, args)).rows, readTask);
        assert.deepEqual(settlement, { checked: 1, errors: 0 });
        const completed = (await pg.pool.query('SELECT status,video_url,cost_breakdown_usd FROM app_jobs WHERE job_id=$1', [scenario])).rows[0];
        assert.equal(completed.status, 'completed');
        assert.equal(completed.video_url, 'https://media.example/owned.mp4');
        assert.equal(completed.cost_breakdown_usd.provider_cost_usd_effective, 0.405354);
        assert.ok(response.kind !== 'generation_result');
        assert.doesNotMatch(JSON.stringify(customerGenerationResponse(response.body, 'kling-v4')), /sandbase|videorouter|quotedUsd|providerJobId/i);
      }
      if (scenario === 'timeout') {
        assert.equal(job.status, 'provider_polling_stalled');
        assert.equal(attempts[0].status, 'polling_stalled');
        process.env.KLING_V4_VIDEOROUTER_CANARY = '';
        try {
          await submitGenerateProviderTask({ ...params, effectiveResolution: '1080p',
            falPayload: { ...params.falPayload, resolution: '1080p' } });
        } finally { process.env.KLING_V4_VIDEOROUTER_CANARY = 'public'; }
        assert.equal(falPosts, 0);
      }
      if (falPosts) {
        assert.equal(job.provider, 'fal');
        assert.equal(job.provider_job_id, 'fal-fixture');
        if (scenario === 'flag-off' || scenario === 'other-settings') {
          process.env.KLING_V4_VIDEOROUTER_CANARY = 'public';
          await submitGenerateProviderTask(params);
          assert.equal(quotes, 0);
          assert.equal(falPosts, 1);
          assert.equal(attempts[0].status, 'accepted');
        } else {
          assert.equal(attempts[0].fallback_to_attempt_id, attempts[1].id);
          assert.equal(attempts[1].status, 'accepted');
        }
        const logs = await pg.pool.query("SELECT payload->'falQueueReceipt' AS receipt FROM fal_queue_log WHERE job_id=$1 AND status='enqueue'", [scenario]);
        assert.equal(logs.rows[0].receipt.metadataState, 'verified');
      }
    });
  }
});
