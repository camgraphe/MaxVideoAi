import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { GenerateProviderSubmissionParams } from '../frontend/app/api/generate/_lib/video-provider-submission';
import { customerGenerationResponse } from '../frontend/app/api/generate/_lib/customer-generation-response';
import { reconcileFalBackedWalletStops } from '../frontend/src/server/video-providers/videorouter/fal-backed-wallet-stop';
import { reconcileVideoRouterCosts } from '../frontend/src/server/video-providers/videorouter/settlement';
import { createPinnedVideoRouterClient, VideoRouterSubmitError } from '../frontend/src/server/video-providers/videorouter/client';
import { klingV4SandBaseRequest } from '../frontend/src/server/video-providers/videorouter/kling-v4';
import { getDb } from '../frontend/src/lib/db';
import { ENV } from '../frontend/src/lib/env';
import { klingV4SandBasePlan, klingV4SandBaseReferences } from '../frontend/src/server/video-providers/videorouter/kling-v4';
import { createPaidGenerationTestSchema, startDisposablePostgres } from './helpers/disposable-postgres';

const storageOrigin = 'https://kling-read-fixture.s3.us-east-1.amazonaws.com';
const images = [1, 2, 3].map(n => storageOrigin + '/media-assets/fixture-user/' + n + '.jpg');
const externalImage = 'https://external-fixture.example/media-assets/fixture-user/2.jpg';

function assertReferenceTransport(urls: string[], originals: string[]) {
  assert.equal(urls.length, originals.length);
  originals.forEach((original, i) => {
    if (original === externalImage) {
      assert.equal(urls[i], original);
      return;
    }
    const signed = new URL(urls[i]);
    assert.equal(signed.origin + signed.pathname, original);
    assert.equal(signed.searchParams.get('X-Amz-Expires'), '3600');
    assert.ok(signed.searchParams.get('X-Amz-Signature'));
  });
}

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
  assert.equal(klingV4SandBasePlan(30, 50_000_000).candidates[0].costMicros, 4_103_588);
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

const purchaseProfiles = [
  { engineId: 'kling-v4', label: 'Kling V4', resolution: '720p', ratio: '16:9', count: 3, duration: 3,
    flag: 'KLING_V4_VIDEOROUTER_CANARY', host: 'sandbase', model: 'kuaishou/kling-v4.0/sandbase', hostModel: 'sandbase/kling-v4.0',
    falModel: 'kling/v4/reference-to-video', slot: 'image_urls', estimate: 0.4, finalCost: 0.405354,
    marker: 'klingV4WalletStop', partialBudget: 42 },
  { engineId: 'minimax-h3', label: 'MiniMax H3', resolution: '480P', ratio: '21:9', count: 2, duration: 15,
    flag: 'MINIMAX_H3_VIDEOROUTER_CANARY', host: 'wavespeed', model: 'minimax/h3/wavespeed', hostModel: 'wavespeed/minimax-h3-native',
    falModel: 'minimax/h3/reference-to-video', slot: 'reference_image_urls', estimate: 0.615, finalCost: 0.6075,
    marker: 'videoRouterWalletStop', partialBudget: 67 },
] as const;

test('Fal-backed purchases reconcile pinned video jobs, fallback receipts and ambiguous submissions', async t => {
  const pg = await startDisposablePostgres('kling-v4-videorouter');
  const env = { DATABASE_URL: pg.databaseUrl, KLING_V4_VIDEOROUTER_CANARY: 'public', MINIMAX_H3_VIDEOROUTER_CANARY: 'public', VIDEOROUTER_API_KEY: 'offline',
    S3_BUCKET: 'kling-read-fixture', S3_REGION: 'us-east-1', S3_PUBLIC_BASE_URL: storageOrigin,
    S3_ACCESS_KEY_ID: 'fixture-access', S3_SECRET_ACCESS_KEY: 'fixture-secret' };
  const previous = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  const previousFal = ENV.FAL_API_KEY;
  Object.assign(process.env, env);
  ENV.FAL_API_KEY = 'offline';
  // Storage reads configuration on import. Use the real local signer with synthetic credentials.
  const { submitGenerateProviderTask } = await import('../frontend/app/api/generate/_lib/video-provider-submission');
  const { runAlibabaModelStudioPoll } = await import('../frontend/server/alibaba-model-studio-poll');
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
  await pg.pool.query(`CREATE TABLE user_assets(asset_id text PRIMARY KEY, user_id text, url text, mime_type text);
    CREATE TABLE media_assets(id text PRIMARY KEY, public_id text, user_id text, url text, mime_type text, kind text, status text, deleted_at timestamptz)`);
  await pg.pool.query('INSERT INTO user_assets VALUES ($1,$2,$3,$4)', ['asset-0', 'fixture-user', images[0], 'image/jpeg']);
  await pg.pool.query("INSERT INTO media_assets VALUES ('internal-id',$1,$2,$3,'image/jpeg','image','ready',NULL)",
    ['asset-1', 'fixture-user', images[1]]);
  const scenarios = ['success', 'quota', 'timeout', 'invalid', 'budget', 'estimate', 'over-budget-fallback', 'flag-off', 'other-settings', 'external-image', 'refund-outage', 'budget-outage'];
  const cases = purchaseProfiles.flatMap(profile => {
    const profileScenarios = profile.engineId === 'minimax-h3' ? [...scenarios, 'mismatched-asset'] : scenarios;
    return profileScenarios.map(scenario => ({ profile, scenario }));
  });
  for (const { profile, scenario } of cases) {
    await t.test(profile.engineId + ' ' + scenario, async sub => {
      const jobId = profile.engineId + '-' + scenario;
      const taskId = profile.host + ':opaque-id';
      const budget = scenario === 'budget' || scenario === 'budget-outage';
      const refundOutage = scenario.endsWith('-outage');
      const params = request(jobId, budget ? 35 : scenario === 'over-budget-fallback' ? profile.partialBudget : 100);
      Object.assign(params, { engineId: profile.engineId, engineLabel: profile.label, durationSec: profile.duration,
        effectiveResolution: profile.resolution, aspectRatio: profile.ratio });
      const orderedImages = images.slice(0, profile.count);
      Object.assign(params.falPayload, { engineId: profile.engineId, durationSec: profile.duration, durationOption: String(profile.duration),
        resolution: profile.resolution, aspectRatio: profile.ratio, referenceImages: orderedImages.slice(),
        inputs: params.falPayload.inputs!.slice(0, profile.count).map(input => ({ ...input, slotId: profile.slot })),
        ...(profile.engineId === 'minimax-h3' ? { extraInputValues: { prompt_expansion_mode: 'balanced' } } : {}) });
      params.falInputSummary.referenceImageCount = profile.count;
      params.pricing.base.seconds = profile.duration;
      if (scenario === 'mismatched-asset') params.falPayload.inputs![0].assetId = 'unrelated-asset';
      const nativeOnly = ['other-settings', 'flag-off', 'external-image', 'mismatched-asset'].includes(scenario);
      if (scenario === 'external-image') {
        // Same user-looking prefix, slot and asset ID, but a different host.
        params.falPayload.inputs![1].url = externalImage;
        params.falPayload.referenceImages![1] = externalImage;
      }
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
        VALUES($1,$2,'video',$5,$6,$7,'fal','queued','USD',$3,true,'paid_wallet','{}',$4)`,
      [jobId, params.userId, params.pricing.totalCents, JSON.stringify(params.pricing), profile.engineId, profile.label, profile.duration]);
      await pg.pool.query("INSERT INTO app_receipts(job_id,user_id,type,amount_cents,currency,surface) VALUES($1,$2,'charge',$3,'USD','video')",
        [jobId, params.userId, params.pricing.totalCents]);
      if (refundOutage) await pg.pool.query(`CREATE OR REPLACE FUNCTION reject_test_refund() RETURNS trigger LANGUAGE plpgsql
        AS $$ BEGIN IF NEW.type='refund' THEN RAISE EXCEPTION 'simulated temporary refund outage'; END IF; RETURN NEW; END $$;
        CREATE TRIGGER reject_test_refund BEFORE INSERT ON app_receipts FOR EACH ROW EXECUTE FUNCTION reject_test_refund();`);
      let quotes = 0, routerPosts = 0, falPosts = 0;
      if (scenario === 'flag-off') delete process.env[profile.flag];
      sub.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(String(input));
        assert.equal(init?.method, 'POST');
        const body = JSON.parse(String(init.body));
        if (url.hostname === 'queue.fal.run') {
          falPosts++;
          assert.equal(url.pathname, '/' + profile.falModel);
          if (profile.engineId === 'minimax-h3') assert.equal(body.prompt_expansion_mode, 'balanced');
          assertReferenceTransport(body[profile.slot], original.referenceImages!);
          assert.equal(body.resolution, params.effectiveResolution);
          assert.equal(body.aspect_ratio, params.aspectRatio);
          const id = 'fal-fixture';
          const base = 'https://queue.fal.run/' + profile.falModel.split('/').slice(0, 2).join('/') + '/requests/' + id;
          return Response.json({ request_id: id, status_url: base + '/status', response_url: base, cancel_url: base + '/cancel' });
        }
        assert.equal(url.hostname, 'videorouter.sh');
        assert.deepEqual(body.provider, { only: [profile.host], allow_fallbacks: false });
        assert.equal(body.strict_duration, true);
        assert.equal(body.generate_audio, undefined);
        assert.equal(body.model, profile.model);
        assert.equal(body.prompt_extend, profile.engineId === 'minimax-h3' ? true : undefined);
        assertReferenceTransport(body.input_references.map((item: {image_url: {url:string}}) => item.image_url.url), orderedImages);
        if (url.pathname === '/v1/pricing/estimate') {
          quotes++;
          return Response.json({ object: 'pricing.estimate', type: 'video', model: profile.hostModel, currency: 'USD',
            estimated_cost_usd: profile.estimate, max_cost_usd: scenario === 'estimate' ? profile.estimate + 0.02 : profile.estimate,
            assumptions: { duration_secs: profile.duration, resolution: profile.resolution, reference_images: profile.count, aspect_ratio: profile.ratio } });
        }
        assert.equal(url.pathname, '/v1/videos');
        routerPosts++;
        if (scenario === 'timeout') throw new Error('lost ACK');
        if (scenario === 'invalid' || scenario === 'refund-outage') return Response.json({ error: { code: 'policy_violation' } }, { status: 422 });
        if (scenario === 'quota' || scenario === 'over-budget-fallback') return Response.json({ error: { code: 'insufficient_credits' } }, { status: 402 });
        return Response.json({ id: taskId });
      });
      const [response] = await Promise.all([submitGenerateProviderTask(params), submitGenerateProviderTask(params)]);
      assert.deepEqual(params.falPayload, original);
      assert.equal(quotes, (budget || nativeOnly) ? 0 : 1);
      assert.equal(routerPosts, (budget || scenario === 'estimate' || nativeOnly) ? 0 : 1);
      assert.equal(falPosts, (nativeOnly || ['quota', 'estimate'].includes(scenario)) ? 1 : 0);
      if (refundOutage) {
        const held = (await pg.pool.query('SELECT * FROM app_jobs WHERE job_id=$1', [jobId])).rows[0];
        assert.equal(held.status, 'provider_polling_stalled');
        assert.equal(held.payment_status, 'paid_wallet');
        assert.equal(held.settings_snapshot[profile.marker].reason, budget ? 'refused' : 'invalid');
        const prior = (await pg.pool.query('SELECT a.status,a.error_class,a.accepted_at FROM provider_attempts a JOIN app_jobs j ON j.id=a.job_id WHERE j.job_id=$1', [jobId])).rows;
        assert.deepEqual(prior, budget ? [] : [{ status: 'failed', error_class: 'invalid', accepted_at: null }]);
        // The same job, a different profile and a disabled canary must never become a new purchase.
        process.env[profile.flag] = '';
        try {
          await submitGenerateProviderTask({ ...params, effectiveResolution: '1080p',
            falPayload: { ...params.falPayload, resolution: '1080p' } });
          assert.equal(falPosts, 0);
          assert.equal(routerPosts, budget ? 0 : 1);
          await pg.pool.query('DROP TRIGGER reject_test_refund ON app_receipts');
          const concurrent = await Promise.all([reconcileFalBackedWalletStops(), reconcileFalBackedWalletStops()]);
          assert.equal(concurrent.reduce((sum, r) => sum + r.settled, 0), 1);
          assert.deepEqual(await reconcileFalBackedWalletStops(), { checked: 0, settled: 0, errors: 0 });
        } finally { process.env[profile.flag] = 'public'; }
      }
      const [job] = (await pg.pool.query('SELECT * FROM app_jobs WHERE job_id=$1', [jobId])).rows;
      const attempts = (await pg.pool.query('SELECT a.* FROM provider_attempts a JOIN app_jobs j ON j.id=a.job_id WHERE j.job_id=$1 ORDER BY a.attempt_index', [jobId])).rows;
      const receipts = (await pg.pool.query('SELECT type,amount_cents FROM app_receipts WHERE job_id=$1 ORDER BY id', [jobId])).rows;
      const refused = budget || refundOutage || ['invalid', 'over-budget-fallback'].includes(scenario);
      assert.equal(job.payment_status, refused ? 'refunded_wallet' : 'paid_wallet');
      assert.equal(receipts[0].amount_cents, params.pricing.totalCents);
      assert.deepEqual(receipts.map(r => r.type), refused ? ['charge','refund'] : ['charge']);
      if (refused) assert.equal(receipts[1].amount_cents, params.pricing.totalCents);
      if (scenario === 'success') {
        assert.equal(job.provider, 'videorouter');
        assert.equal(job.provider_job_id, taskId);
        assert.equal(attempts[0].status, 'accepted');
        assert.equal(attempts[0].provider_model, profile.model);
        const snapshot = attempts[0].request_snapshot;
        if (profile.engineId === 'minimax-h3') {
          assert.equal(snapshot.promptExpansionMode, 'balanced');
          assert.equal(snapshot.providerPromptExtend, true);
        }
        assert.equal(snapshot.purchaseRouting.baselineProvider, 'fal');
        assert.equal(snapshot.ownedReferenceImages, true);
        assert.equal(snapshot.hasSeed, false);
        assert.equal(snapshot.unreviewedOptions, false);
        assert.doesNotMatch(JSON.stringify(snapshot), /X-Amz-|fixture-user/);
        await pg.pool.query("UPDATE app_jobs SET updated_at=NOW()-INTERVAL '2 minutes' WHERE job_id=$1", [jobId]);
        let reads = 0;
        const readTask = createPinnedVideoRouterClient('offline', async (input, init) => {
          assert.equal(init?.method, 'GET');
          assert.equal(new URL(String(input)).pathname, '/v1/videos/' + encodeURIComponent(taskId));
          return Response.json({ id: taskId, status: 'completed', data: [{ url: 'https://fixture.example/output.mp4' }],
            ...(reads++ ? { cost_usd: profile.finalCost } : {}) });
        });
        const poll = await runAlibabaModelStudioPoll({ provider: 'videorouter', jobId, deps: {
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
        const completed = (await pg.pool.query('SELECT status,video_url,cost_breakdown_usd FROM app_jobs WHERE job_id=$1', [jobId])).rows[0];
        assert.equal(completed.status, 'completed');
        assert.equal(completed.video_url, 'https://media.example/owned.mp4');
        assert.equal(completed.cost_breakdown_usd.provider_model, profile.model);
        assert.equal(completed.cost_breakdown_usd.provider_cost_usd_effective, profile.finalCost);
        assert.ok(response.kind !== 'generation_result');
        assert.doesNotMatch(JSON.stringify(customerGenerationResponse(response.body, profile.engineId)), /sandbase|wavespeed|videorouter|quotedUsd|providerJobId/i);
      }
      if (scenario === 'timeout') {
        assert.equal(job.status, 'provider_polling_stalled');
        assert.equal(attempts[0].status, 'polling_stalled');
        process.env[profile.flag] = '';
        try {
          await submitGenerateProviderTask({ ...params, effectiveResolution: '1080p',
            falPayload: { ...params.falPayload, resolution: '1080p' } });
        } finally { process.env[profile.flag] = 'public'; }
        assert.equal(falPosts, 0);
      }
      if (falPosts) {
        assert.equal(job.provider, 'fal');
        assert.equal(job.provider_job_id, 'fal-fixture');
        if (nativeOnly) {
          assert.deepEqual(attempts.map(a => a.provider), ['fal']);
          if (scenario === 'flag-off') {
            assert.equal(attempts[0].request_snapshot.ownedReferenceImages, true);
            assert.equal(attempts[0].request_snapshot.hasSeed, false);
            assert.equal(attempts[0].request_snapshot.unreviewedOptions, false);
          } else assert.equal(attempts[0].request_snapshot, null);
          process.env[profile.flag] = 'public';
          await submitGenerateProviderTask(params);
          assert.equal(quotes, 0);
          assert.equal(falPosts, 1);
          assert.equal(attempts[0].status, 'accepted');
        } else {
          assert.equal(attempts[0].fallback_to_attempt_id, attempts[1].id);
          assert.equal(attempts[1].status, 'accepted');
        }
        const logs = await pg.pool.query(`SELECT provider_job_id, payload->'falQueueReceipt' AS receipt FROM fal_queue_log
          WHERE job_id=$1 AND engine_id=$2 AND provider='fal' AND status='enqueue'`, [jobId, profile.engineId]);
        assert.equal(logs.rows[0].provider_job_id, job.provider_job_id);
        // Kling queue reads bind the host's status URL. H3 uses the existing Fal ID-based status path.
        if (profile.engineId === 'kling-v4') assert.equal(logs.rows[0].receipt.metadataState, 'verified');
      }
    });
  }
});
