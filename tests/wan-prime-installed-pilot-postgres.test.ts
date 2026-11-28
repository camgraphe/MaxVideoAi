import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { PricingSnapshot } from '@maxvideoai/pricing';
import {
  createAtomicInitialVideoJob,
  type CreateVideoInitialJobParams,
} from '../frontend/app/api/generate/_lib/initial-video-job';
import { submitAlibabaModelStudioGenerateTask } from '../frontend/app/api/generate/_lib/alibaba-model-studio-submission';
import { getDb } from '../frontend/src/lib/db';
import { ENV } from '../frontend/src/lib/env';
import { getFalClient } from '../frontend/src/lib/fal-client';
import { getWalletBalanceCents } from '../frontend/src/lib/wallet';
import { AlibabaModelStudioError } from '../frontend/src/server/video-providers/alibaba-model-studio/errors';
import type { AlibabaVideoPayload } from '../frontend/src/server/video-providers/alibaba-model-studio/types';
import { createVideoRouterClient } from '../frontend/src/server/video-providers/videorouter/wan-prime';
import type { NormalizedVideoProviderTask } from '../frontend/src/server/video-providers/types';
import { resolveVideoProviderRoutingPlan } from '../frontend/src/server/video-providers/router';
import { createPaidGenerationTestSchema, startDisposablePostgres } from './helpers/disposable-postgres';

const text = { mode: 't2v', seconds: 15, resolution: '480p', supplierMicros: 1_020_000, quoteCents: 147 } as const;
const reference = {
  mode: 'ref2v',
  seconds: 4,
  resolution: '720p',
  supplierMicros: 560_000,
  quoteCents: 85,
} as const;
type Profile = { mode: 't2v' | 'ref2v'; seconds: number; resolution: string; supplierMicros: number; quoteCents: number; audio?: boolean };
const engineId = 'wan-3-prime';
const userId = 'pilot-owner';
const refUrl = 'https://example.test/reference.png';
const prompt = 'Offline Wan Prime preview';

function initialJob(jobId: string, profile: Profile) {
  const totalCents = profile.quoteCents;
  const baseCents = profile.supplierMicros / 10_000;
  const pricing: PricingSnapshot = {
    currency: 'USD',
    totalCents,
    subtotalBeforeDiscountCents: totalCents,
    addons: [],
    base: { seconds: profile.seconds, rate: baseCents / profile.seconds, amountCents: baseCents },
    margin: { amountCents: totalCents - baseCents },
    meta: { pricingMode: 'manual_tariff', customerTariffRevision: 7 },
  };
  const receipt = {
    jobId,
    userId,
    amountCents: totalCents,
    currency: 'USD',
    description: 'Wan Prime offline quote',
    snapshot: pricing,
    auditPricingSnapshot: pricing,
    applicationFeeCents: null,
    vendorAccountId: null,
  };
  const initial: CreateVideoInitialJobParams = {
    jobId,
    userId,
    paymentMode: 'wallet',
    walletReservation: 'reserve',
    funding: { kind: 'wallet', reservation: 'reserve' },
    preferredCurrency: 'usd',
    resolvedCurrencyLower: 'usd',
    pendingReceipt: receipt,
    jobInsert: {
      jobId,
      userId,
      engineId,
      engineLabel: 'Wan 3 Prime',
      durationSec: profile.seconds,
      prompt,
      thumbUrl: '/thumb.svg',
      aspectRatio: '16:9',
      hasAudio: profile.audio ?? true,
      canUpscale: false,
      previewFrame: '/thumb.svg',
      batchId: null,
      groupId: null,
      iterationIndex: null,
      iterationCount: null,
      renderIdsJson: null,
      heroRenderId: null,
      localKey: null,
      message: null,
      etaSeconds: null,
      etaLabel: null,
      provider: 'alibaba_model_studio',
      finalPriceCents: totalCents,
      pricingSnapshotJson: JSON.stringify(pricing),
      costBreakdownJson: null,
      settingsSnapshotJson: JSON.stringify({ inputMode: profile.mode, core: { resolution: profile.resolution } }),
      currency: 'USD',
      vendorAccountId: null,
      paymentStatus: 'paid_wallet',
      stripePaymentIntentId: null,
      stripeChargeId: null,
      visibility: 'private',
      indexable: false,
    },
  };
  return { receipt, pricing, initial };
}

test(
  'Wan Prime installed pilot routes funded quotes in disposable PostgreSQL with offline supplier transports',
  { timeout: 90_000 },
  async (t) => {
    const pg = await startDisposablePostgres('wan-prime-installed-pilot');
    const env = {
      DATABASE_URL: pg.databaseUrl,
      VERCEL_ENV: 'preview',
      WAN_PRIME_EXISTING_PROVIDERS_ADMIN_CANARY: '1',
      APIMART_WAN_PRIME_ADMIN_CANARY: '0',
      APIMART_API_KEY: '',
      ALIBABA_MODEL_STUDIO_POLL_TOKEN: 'offline-cron',
      ALIBABA_MODEL_STUDIO_ENABLED: '0',
      WAN_PRIME_PURCHASE_CEILING_USD: '',
    };
    const previous = Object.fromEntries(Object.keys(env).map((key) => [key, process.env[key]]));
    Object.assign(process.env, env);
    const previousFalKey = ENV.FAL_API_KEY;
    ENV.FAL_API_KEY = 'offline-only';
    t.after(async () => {
      await getDb().end();
      ENV.FAL_API_KEY = previousFalKey;
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
      await pg.cleanup();
    });
    await createPaidGenerationTestSchema(pg.pool);
    await pg.pool.query(readFileSync('neon/migrations/21_provider_attempts.sql', 'utf8'));
    await pg.pool.query(`ALTER TABLE app_jobs ADD COLUMN mcp_trial_outcome_disposition text;
    CREATE TABLE fal_queue_log(job_id text,provider text,provider_job_id text,engine_id text,status text,payload jsonb);
    CREATE TABLE app_customer_tariff_state(singleton boolean PRIMARY KEY, revision bigint, active boolean);
    INSERT INTO app_customer_tariff_state VALUES(true,7,true);`);
    await pg.pool.query(
      "INSERT INTO app_receipts(user_id,type,amount_cents,currency) VALUES($1,'topup',10000,'USD')",
      [userId],
    );
    const read = async <T>(sql: string, values: unknown[] = []): Promise<T[]> =>
      (await pg.pool.query<T>(sql, values)).rows;
    const receipts = (jobId: string) =>
      read<{ type: string; amount_cents: number }>(
        'SELECT type,amount_cents FROM app_receipts WHERE job_id=$1 ORDER BY id',
        [jobId],
      );
    const job = async (jobId: string) =>
      (
        await read<{
          status: string;
          payment_status: string;
          provider: string;
          provider_job_id: string | null;
          final_price_cents: number;
          pricing_snapshot: PricingSnapshot;
        }>('SELECT * FROM app_jobs WHERE job_id=$1', [jobId])
      )[0];
    const attempts = (jobId: string) =>
      read<{
        id: string;
        provider: string;
        status: string;
        fallback_to_attempt_id: string | null;
        provider_job_id: string | null;
        request_snapshot: {
          purchaseRouting: {
            mode: string;
            order: string[];
            ceilingMicros: number;
            candidates: { provider: string; costMicros: number }[];
          };
        };
      }>(
        'SELECT a.* FROM provider_attempts a JOIN app_jobs j ON j.id=a.job_id WHERE j.job_id=$1 ORDER BY a.attempt_index',
        [jobId],
      );
    t.mock.method(getFalClient(), 'subscribe', async () => assert.fail('Fal must enqueue exactly once'));
    const falPosts: { path: string; body: Record<string, unknown> }[] = [];
    t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      assert.equal(url.origin, 'https://queue.fal.run');
      assert.equal(init?.method, 'POST');
      const body = JSON.parse(String(init?.body));
      falPosts.push({ path: url.pathname, body });
      return Response.json({ request_id: 'fal-' + body.metadata.app_job_id }, { status: 202 });
    });

    function request(jobId: string, profile: Profile, direct: (payload: AlibabaVideoPayload) => Promise<NormalizedVideoProviderTask>,
      routerFetch?: typeof fetch) {
      const { initial, pricing, receipt } = initialJob(jobId, profile);
      const plan = resolveVideoProviderRoutingPlan({
        engineId,
        mode: profile.mode,
        isAdmin: true,
        env: { ALIBABA_MODEL_STUDIO_ENABLED: '1', ALIBABA_MODEL_STUDIO_FALLBACK_TO_FAL_ENABLED: '1' },
      });
      assert.equal(plan.kind, 'alibaba_model_studio_primary');
      assert.ok(plan.kind === 'alibaba_model_studio_primary' && plan.purchaseCanary === (routerFetch ? 'with-videorouter' : 'alibaba-fal'));
      const hasImage = profile.mode === 'ref2v';
      const submit = () =>
        submitAlibabaModelStudioGenerateTask({
          jobId,
          userId,
          engineId,
          engineLabel: 'Wan 3 Prime',
          mode: profile.mode,
          prompt,
          durationSec: profile.seconds,
          aspectRatio: '16:9',
          audioEnabled: profile.audio ?? true,
          effectiveResolution: profile.resolution,
          imageUrl: null,
          placeholderThumb: '/thumb.svg',
          pricing,
          paymentStatus: 'paid_wallet',
          pendingReceipt: receipt,
          paymentMode: 'wallet',
          walletChargeReserved: true,
          fallbackToFalEnabled: plan.fallbackEnabled,
          purchaseCanary: plan.purchaseCanary,
          falPayload: {
            jobId,
            engineId,
            mode: profile.mode,
            prompt,
            durationSec: profile.seconds,
            resolution: profile.resolution,
            aspectRatio: '16:9',
            audio: profile.audio ?? true,
            ...(routerFetch ? {} : { seed: 0, extraInputValues: { enable_prompt_expansion: false } }),
            referenceImages: hasImage ? [refUrl] : [],
          },
          falInputSummary: {
            primaryImageUrl: null,
            primaryAudioUrl: null,
            referenceImageCount: Number(hasImage),
            referenceVideoCount: 0,
            referenceAudioCount: 0,
            hasFirstFrame: false,
            hasLastFrame: false,
            inputSlots: [],
          },
          isLumaRay2: false,
          batchId: null,
          groupId: null,
          iterationIndex: null,
          iterationCount: null,
          renderIds: null,
          heroRenderId: null,
          localKey: null,
          logMetricFn() {},
          deps: {
            queryFn: read,
            getVideoRouterClientFn: () => createVideoRouterClient('offline', routerFetch),
            getApimartClientFn: () => assert.fail('APIMart is disabled'),
            createOwnedMediaReadUrlFn: async (input) => input.url,
            getAlibabaModelStudioClientFn: () => ({
              createVideo: direct,
              getTask: () => assert.fail('no polling at submission'),
            }),
          },
        });
      return { submit, pricing, reserve: () => createAtomicInitialVideoJob(initial) };
    }

    await t.test('VideoRouter pre-acceptance quota refusal hands off once to Alibaba; a lost response preserves the reservation', async () => {
      const existingMode = process.env.WAN_PRIME_VIDEOROUTER_CANARY;
      const existingKey = process.env.VIDEOROUTER_API_KEY;
      process.env.WAN_PRIME_VIDEOROUTER_CANARY = 'admin';
      process.env.VIDEOROUTER_API_KEY = 'offline';
      try {
        for (const uncertain of [false, true]) {
          const id = 'pilot-videorouter-' + (uncertain ? 'unknown' : 'quota');
          const seconds = uncertain ? 2 : 15;
          const profile: Profile = { ...text, seconds, supplierMicros: seconds * 68000, quoteCents: seconds * 10 };
          let alibaba = 0;
          const paths: string[] = [];
          const run = request(id, profile, async () => {
            alibaba++;
            return { providerJobId: 'accepted-alibaba', status: 'queued', rawStatus: 'PENDING',
              videoUrl: null, message: null, usage: null, raw: {} };
          }, async (input, init) => {
            const url = new URL(String(input));
            assert.equal(url.origin, 'https://videorouter.sh');
            paths.push(url.pathname);
            const body = JSON.parse(String(init?.body));
            assert.deepEqual(body.provider, { only: ['botsmart'], allow_fallbacks: false });
            assert.equal(body.generate_audio, true);
            assert.equal(body.prompt_extend, true);
            if (url.pathname === '/v1/pricing/estimate') return Response.json({
              object: 'pricing.estimate', type: 'video', currency: 'USD', model: 'botsmart/wan-3.0-prime',
              assumptions: { duration_secs: seconds, resolution: '480p', aspect_ratio: '16:9' },
              estimated_cost_usd: seconds * 0.0402, max_cost_usd: seconds * 0.0402,
            });
            assert.equal(url.pathname, '/v1/videos');
            if (uncertain) throw new Error('response lost after POST');
            return Response.json({ error: { code: 'concurrency_limit', type: 'rate_limit_error' } }, { status: 429 });
          });
          assert.equal((await run.reserve()).kind, 'created');
          await Promise.all([run.submit(), run.submit()]);
          assert.deepEqual(paths, ['/v1/pricing/estimate', '/v1/videos']);
          assert.equal(alibaba, uncertain ? 0 : 1);
          const ledger = await attempts(id);
          assert.deepEqual(ledger.map(a => [a.provider, a.status]), uncertain ? [['videorouter', 'polling_stalled']] :
            [['videorouter', 'failed'], ['alibaba_model_studio', 'accepted']]);
          if (!uncertain) assert.equal(ledger[0].fallback_to_attempt_id, ledger[1].id);
          assert.deepEqual(await receipts(id), [{ type: 'charge', amount_cents: profile.quoteCents }]);
          assert.equal((await job(id)).final_price_cents, profile.quoteCents);
        }
      } finally {
        if (existingMode === undefined) delete process.env.WAN_PRIME_VIDEOROUTER_CANARY;
        else process.env.WAN_PRIME_VIDEOROUTER_CANARY = existingMode;
        if (existingKey === undefined) delete process.env.VIDEOROUTER_API_KEY;
        else process.env.VIDEOROUTER_API_KEY = existingKey;
      }
    });

    const profiles: Profile[] = [text, reference, { ...reference, audio: false }];
    for (const profile of profiles) {
      await t.test(
        `${profile.mode} ${profile.seconds}s ${profile.resolution} ${profile.audio === false ? 'muted' : 'with audio'} · concurrent submit, explicit refusal and one Fal handoff`,
        async () => {
          const id = 'pilot-' + profile.mode + (profile.audio === false ? '-muted' : '');
          const before = falPosts.length;
          const directPosts: AlibabaVideoPayload[] = [];
          const run = request(id, profile, async (payload) => {
            directPosts.push(payload);
            throw new AlibabaModelStudioError(
              'Pre-acceptance refusal',
              profile.mode === 't2v'
                ? { status: 429, code: 'Throttling.RateQuota' }
                : { status: 403, code: 'InsufficientBalance' },
            );
          });
          const reservation = await Promise.all([run.reserve(), run.reserve()]);
          assert.deepEqual(reservation.map((r) => r.kind).sort(), ['created', 'existing_job']);
          const pair = await Promise.all([run.submit(), run.submit()]);
          const accepted = pair.find((result) => result.ok && result.kind === 'fal_result');
          assert.ok(
            accepted?.ok &&
              accepted.kind === 'fal_result' &&
              accepted.generationResult.providerJobId === 'fal-' + id,
            JSON.stringify(pair),
          );
          assert.ok(pair.some((result) => result.ok && result.kind === 'accepted' && result.body.deferred));
          assert.equal(directPosts.length, 1);
          assert.equal(directPosts[0].parameters.duration, profile.seconds);
          assert.equal(directPosts[0].parameters.audio, profile.audio ?? true);
          assert.deepEqual(
            directPosts[0].input.media ?? [],
            profile.mode === 'ref2v' ? [{ type: 'reference_image', url: refUrl }] : [],
          );
          assert.equal(falPosts.length - before, 1);
          const [post] = falPosts.slice(before);
          assert.equal(
            post.path,
            '/alibaba/wan-3.0-prime/' + (profile.mode === 'ref2v' ? 'reference-to-video' : 'text-to-video'),
          );
          assert.equal(Number(post.body.duration), profile.seconds);
          assert.equal(String(post.body.resolution).toLowerCase(), profile.resolution);
          assert.equal(post.body.audio, directPosts[0].parameters.audio);
          assert.equal(post.body.enable_prompt_expansion, false);
          assert.equal(post.body.enable_prompt_expansion, directPosts[0].parameters.prompt_extend);
          assert.equal(post.body.seed, 0);
          assert.equal(post.body.seed, directPosts[0].parameters.seed);
          if (profile.mode === 'ref2v')
            assert.deepEqual(post.body.image_urls ?? post.body.reference_image_urls, [refUrl]);
          const ledger = await attempts(id);
          assert.deepEqual(
            ledger.map((a) => [a.provider, a.status]),
            [
              ['alibaba_model_studio', 'failed'],
              ['fal', 'accepted'],
            ],
          );
          assert.equal(ledger[0].fallback_to_attempt_id, ledger[1].id);
          const decision = ledger[0].request_snapshot.purchaseRouting;
          assert.equal(decision.mode, 'canary');
          assert.deepEqual(decision.order, ['alibaba_model_studio', 'fal']);
          assert.equal(
            decision.candidates.find((candidate) => candidate.provider === 'fal')?.costMicros,
            profile.supplierMicros,
          );
          assert.equal(decision.ceilingMicros, profile.supplierMicros);
          const stored = await job(id);
          assert.equal(stored.provider, 'fal');
          assert.equal(stored.provider_job_id, 'fal-' + id);
          assert.equal(stored.final_price_cents, profile.quoteCents);
          assert.deepEqual(stored.pricing_snapshot, run.pricing);
          assert.deepEqual(await receipts(id), [{ type: 'charge', amount_cents: profile.quoteCents }]);
        },
      );
    }

    await t.test('lost Alibaba acknowledgement retains the reservation across a repeated request', async () => {
      const before = falPosts.length;
      const id = 'pilot-uncertain';
      let directPosts = 0;
      const run = request(id, reference, async () => {
        directPosts++;
        throw Error('network timeout after write');
      });
      assert.equal((await run.reserve()).kind, 'created');
      for (let i = 0; i < 2; i++) {
        const result = await run.submit();
        assert.ok(result.ok && result.kind === 'accepted' && result.body.deferred);
        assert.equal((await run.reserve()).kind, 'existing_job');
      }
      assert.equal(directPosts, 1);
      assert.equal(falPosts.length, before);
      assert.deepEqual(
        (await attempts(id)).map((a) => [a.provider, a.status]),
        [['alibaba_model_studio', 'polling_stalled']],
      );
      assert.equal((await job(id)).status, 'provider_polling_stalled');
      assert.deepEqual(await receipts(id), [{ type: 'charge', amount_cents: reference.quoteCents }]);
    });

    await t.test(
      'a ceiling below both rates rejects the routes and restores the quoted wallet amount exactly once',
      async () => {
        process.env.WAN_PRIME_PURCHASE_CEILING_USD = '0.55';
        const before = falPosts.length;
        const balance = (await getWalletBalanceCents(userId)).balanceCents;
        const id = 'pilot-ceiling';
        const run = request(id, reference, async () => assert.fail('over-ceiling request reached Alibaba'));
        assert.equal((await run.reserve()).kind, 'created');
        const result = await run.submit();
        assert.ok(!result.ok && result.body.error === 'NO_ELIGIBLE_VIDEO_PROVIDER');
        assert.equal((await run.reserve()).kind, 'existing_job');
        await run.submit();
        assert.equal(falPosts.length, before);
        assert.deepEqual(await attempts(id), []);
        assert.deepEqual(await receipts(id), [
          { type: 'charge', amount_cents: 85 },
          { type: 'refund', amount_cents: 85 },
        ]);
        assert.equal((await getWalletBalanceCents(userId)).balanceCents, balance);
      },
    );

    const { GET: runCron } = await import('../frontend/app/api/cron/alibaba-model-studio-poll/route');
    const cron = () =>
      runCron(
        new Request('http://localhost/api/cron/alibaba-model-studio-poll', {
          headers: { 'x-alibaba-model-studio-poll-token': 'offline-cron' },
        }),
      );
    for (const reason of ['ceiling', 'terminal'] as const) {
      await t.test(
        `authenticated cron refunds ${reason} after a receipt outage, without another supplier submission`,
        async () => {
          process.env.WAN_PRIME_EXISTING_PROVIDERS_ADMIN_CANARY = '1';
          process.env.WAN_PRIME_PURCHASE_CEILING_USD = reason === 'ceiling' ? '0.55' : '1.00';
          const id = 'pilot-outage-' + reason;
          const before = falPosts.length;
          const initialBalance = (await getWalletBalanceCents(userId)).balanceCents;
          let directPosts = 0;
          const run = request(id, reference, async () => {
            directPosts++;
            throw new AlibabaModelStudioError('Invalid input', { status: 422, code: 'InvalidParameter' });
          });
          assert.equal((await run.reserve()).kind, 'created');
          await pg.pool
            .query(`CREATE OR REPLACE FUNCTION reject_pilot_refund() RETURNS trigger LANGUAGE plpgsql AS $$
          BEGIN IF NEW.type='refund' THEN RAISE EXCEPTION 'injected refund outage'; END IF; RETURN NEW; END $$;
          CREATE TRIGGER refund_outage BEFORE INSERT ON app_receipts FOR EACH ROW EXECUTE FUNCTION reject_pilot_refund();`);
          try {
            await run.submit().catch(() => undefined);
            assert.equal((await job(id)).payment_status, 'paid_wallet');
            assert.notEqual((await job(id)).status, 'failed');
            assert.deepEqual(await receipts(id), [{ type: 'charge', amount_cents: 85 }]);
          } finally {
            await pg.pool.query('DROP TRIGGER refund_outage ON app_receipts');
          }
          // Cron can drain an already decided stop after flags, prices or credentials change.
          process.env.WAN_PRIME_PURCHASE_CEILING_USD = '1.00';
          process.env.WAN_PRIME_EXISTING_PROVIDERS_ADMIN_CANARY = '0';
          process.env.VERCEL_ENV = 'production';
          try {
            const response = await cron();
            assert.equal(response.status, 200);
            assert.deepEqual(await response.json(), { ok: true, enabled: false, checked: 0, updates: 0 });
            assert.deepEqual(await receipts(id), [{ type: 'charge', amount_cents: 85 }]);
          } finally {
            process.env.VERCEL_ENV = 'preview';
          }
          await Promise.all([cron(), cron()].map(async (response) => assert.equal((await response).status, 200)));
          assert.deepEqual(await receipts(id), [
            { type: 'charge', amount_cents: 85 },
            { type: 'refund', amount_cents: 85 },
          ]);
          assert.equal((await job(id)).status, 'failed');
          assert.equal((await job(id)).payment_status, 'refunded_wallet');
          assert.equal((await run.reserve()).kind, 'existing_job');
          await run.submit();
          assert.equal((await getWalletBalanceCents(userId)).balanceCents, initialBalance);
          assert.equal((await attempts(id)).length, reason === 'ceiling' ? 0 : 1);
          assert.equal(directPosts, reason === 'ceiling' ? 0 : 1);
          assert.equal(falPosts.length, before);
          for (const otherId of ['pilot-t2v', 'pilot-ref2v', 'pilot-uncertain']) {
            assert.equal((await job(otherId)).payment_status, 'paid_wallet');
            assert.equal((await receipts(otherId)).length, 1);
          }
        },
      );
    }
    await t.test('missing recovery evidence leaves the existing poll response available', async () => {
      await pg.pool.query('ALTER TABLE provider_attempts RENAME TO held_pilot_attempts');
      try {
        const response = await cron();
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { ok: true, enabled: false, checked: 0, updates: 0 });
      } finally {
        await pg.pool.query('ALTER TABLE held_pilot_attempts RENAME TO provider_attempts');
      }
    });
  },
);
