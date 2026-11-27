import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  planVideoPurchase,
  quoteVideoPurchase,
  customerPurchaseCeiling,
  type PurchaseRequest,
} from '../frontend/src/server/video-providers/purchase-router';
import { rankQuotedOffers } from '../frontend/src/lib/video-purchase-decision';
import { routeFrames } from '../frontend/app/(core)/admin/routing/_lib/route-playback';
import { routingScenarios } from '../frontend/app/(core)/admin/routing/_lib/routing-scenarios';
import { submitKlingDirectGenerateTask } from '../frontend/app/api/generate/_lib/kling-direct-submission';
import { KlingDirectError } from '../frontend/src/server/video-providers/kling-direct/errors';
import { createPaidGenerationTestSchema, startDisposablePostgres } from './helpers/disposable-postgres';

const request: PurchaseRequest = {
  engineId: 'kling-o3-pro',
  mode: 'ref2v',
  durationSec: 10,
  resolution: '1080p',
  aspectRatio: '1:1',
  images: 2,
  audioEnabled: true,
  hasVideo: false,
  hasAudioReference: false,
  hasDocument: false,
  hasEndFrame: false,
  inputVideoSeconds: null,
};

test('O3 price and backup policies use the same raw offers and respect the same hard cap', () => {
  const quote = quoteVideoPurchase(request)!;
  assert.deepEqual(
    quote.candidates.map((row) => row.costMicros),
    [1_680_000, 1_400_000]
  );
  const protectedPlan = planVideoPurchase(request)!;
  assert.deepEqual(protectedPlan.order, ['kling_direct', 'fal']);
  const economicPlan = planVideoPurchase(request, { strategy: 'lowest-cost' })!;
  assert.deepEqual(economicPlan.order, ['fal']);
  assert.match(economicPlan.candidates[0].excluded!, /terminal Fal/);
  assert.deepEqual(planVideoPurchase(request, { ceilingMicros: 1_400_000 })?.order, ['fal']);
  assert.deepEqual(planVideoPurchase(request, { ceilingMicros: 1_399_999 })?.order, []);
  assert.deepEqual(planVideoPurchase(request, { unavailable: { fal: 'offline' } })?.order, ['kling_direct']);
  assert.deepEqual(
    routeFrames(protectedPlan, { kling_direct: 'uncertain' }).map((s) => s.kind),
    ['intake', 'sending', 'uncertain']
  );
  assert.deepEqual(
    routeFrames(protectedPlan, { kling_direct: 'refused' })
      .filter((s) => s.kind === 'sending')
      .map((s) => s.provider),
    protectedPlan.order
  );
  const preview = routingScenarios().find((s) => s.id === 'omni-reference')!;
  assert.deepEqual(
    rankQuotedOffers(preview.candidates, { ceilingMicros: preview.ceiling, strategy: preview.strategy })
      .order,
    protectedPlan.order
  );
  assert.ok(preview.candidates.every((row) => row.excluded === null));
  const conflict = rankQuotedOffers([...quote.candidates, quote.candidates[0]], {
    ceilingMicros: quote.baselineMicros,
  });
  assert.deepEqual(conflict.order, ['fal']);
  assert.equal(conflict.candidates.length, 2);
  assert.match(conflict.candidates[0].excluded!, /Conflicting offers/);
});

test('variant, mode, audio and direct-only features cannot leak a quote to another route', () => {
  const image = { ...request, engineId: 'kling-3-pro', mode: 'i2v', images: 1, durationSec: 5 };
  assert.deepEqual(
    quoteVideoPurchase(image)?.candidates.map((c) => c.costMicros),
    [840000, 840000]
  );
  assert.deepEqual(
    quoteVideoPurchase({ ...image, audioEnabled: false })?.candidates.map((c) => c.costMicros),
    [560000, 560000]
  );
  assert.deepEqual(planVideoPurchase({ ...image, requiresDirectControls: true })?.order, ['kling_direct']);
  for (const invalid of [
    { mode: 'v2v' },
    { audioEnabled: undefined },
    { hasVideo: true },
    { images: 5 },
    { hasUnpricedOptions: true },
    { hasAudioReference: true },
    { hasDocument: true },
    { durationSec: 2 },
  ]) {
    assert.deepEqual(planVideoPurchase({ ...request, ...invalid })?.order, []);
  }
  for (const engineId of ['kling-o3-4k', 'kling-v4', 'seedance-2-5', '__proto__']) {
    assert.equal(planVideoPurchase({ ...request, engineId }), null);
  }
  assert.equal(customerPurchaseCeiling({ totalCents: 100, currency: 'EUR' }), -1);
  assert.equal(customerPurchaseCeiling({ totalCents: Number.MAX_SAFE_INTEGER, currency: 'USD' }), -1);
});

test('direct credit refusal records the shadow decision and two actual attempts against one charge', async (t) => {
  const db = await startDisposablePostgres('kling-purchase');
  t.after(() => db.cleanup());
  await createPaidGenerationTestSchema(db.pool);
  await db.pool.query(readFileSync('neon/migrations/21_provider_attempts.sql', 'utf8'));
  const queryFn = async <T = unknown>(sql: string, values?: unknown[]) =>
    (await db.pool.query(sql, values)).rows as T[];
  const jobId = 'job_kling_purchase';
  await db.pool.query(
    `INSERT INTO app_jobs(job_id,user_id,surface,engine_id,engine_label,status,provider,payment_status,final_price_cents,currency,pricing_snapshot,provisional)
    VALUES($1,'owner','video','kling-o3-pro','Kling','running','kling_direct','paid_wallet',200,'USD','{}',true)`,
    [jobId]
  );
  await db.pool.query(
    "INSERT INTO app_receipts(user_id,type,job_id,amount_cents,currency) VALUES('owner','charge',$1,200,'USD')",
    [jobId]
  );
  let sends = 0;
  const result = await submitKlingDirectGenerateTask({
    jobId,
    userId: 'owner',
    engineId: request.engineId,
    engineLabel: 'Kling',
    mode: 'ref2v',
    prompt: 'private prompt fixture',
    durationSec: 10,
    aspectRatio: '1:1',
    audioEnabled: true,
    imageUrl: null,
    cfgScale: null,
    placeholderThumb: '/thumb.svg',
    pricing: { currency: 'USD', totalCents: 200 } as never,
    paymentStatus: 'paid_wallet',
    paymentMode: 'wallet',
    pendingReceipt: null,
    walletChargeReserved: true,
    fallbackToFalEnabled: true,
    fallbackOnCreditsDepletedEnabled: true,
    elementRegistrationEnabled: false,
    falPayload: {
      engineId: request.engineId,
      prompt: 'private prompt fixture',
      mode: 'ref2v',
      resolution: '1080p',
      audio: true,
      referenceImages: ['https://owned.test/one', 'https://owned.test/two'],
    },
    falInputSummary: { hasImage: true, hasVideo: false, imageCount: 2, videoCount: 0 },
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
      queryFn,
      getKlingDirectClientFn: (() => ({
        createTask: async () => {
          sends++;
          throw new KlingDirectError('Insufficient balance', {
            status: 403,
            code: '1102',
            body: { code: 1102 },
          });
        },
      })) as never,
      submitFalGenerateTaskFn: async (args) => {
        sends++;
        assert.equal(args.jobId, jobId);
        return {
          ok: true,
          generationResult: {
            provider: 'fal',
            providerJobId: 'fal-fixture',
            status: 'queued',
            thumbUrl: '/thumb.svg',
          },
        };
      },
      rollbackPendingPaymentFn: async () => assert.fail('accepted fallback must keep original charge'),
    },
  });
  assert.equal(result.ok, true);
  assert.equal(sends, 2);
  const attempts = await queryFn<{
    provider: string;
    plan: ReturnType<typeof planVideoPurchase> & { version: number; mode: string };
    reason: string;
  }>(
    `SELECT provider,request_snapshot->'purchaseRouting' AS plan,request_snapshot->>'fallbackErrorCode' AS reason FROM provider_attempts ORDER BY attempt_index`
  );
  assert.deepEqual(
    attempts.map((a) => a.provider),
    ['kling_direct', 'fal']
  );
  assert.deepEqual(attempts[0].plan.order, ['kling_direct', 'fal']);
  assert.equal(attempts[0].plan.version, 2);
  assert.equal(attempts[0].plan.mode, 'shadow');
  assert.equal(attempts[0].plan.strategy, 'preserve-fallback');
  assert.doesNotMatch(JSON.stringify(attempts[0].plan), /private prompt|owned\.test/);
  assert.equal(attempts[1].reason, '1102');
  assert.deepEqual(await queryFn('SELECT type, amount_cents FROM app_receipts WHERE job_id=$1', [jobId]), [
    { type: 'charge', amount_cents: 200 },
  ]);
});
