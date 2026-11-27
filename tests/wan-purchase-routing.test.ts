import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createApimartClient,
  buildApimartWanRequest,
  ApimartSubmitError,
} from '../frontend/src/server/video-providers/apimart/wan-prime';
import {
  planWanPrimePurchase,
  rankPurchaseOffers,
  WAN_PRIME_OFFERS,
  type PurchaseRequest,
} from '../frontend/src/server/video-providers/purchase-router';
import { resolveVideoProviderRoutingPlan } from '../frontend/src/server/video-providers/router';
import { nextPurchaseProvider } from '../frontend/src/lib/video-purchase-decision';
import { routeFrames, presetConditions } from '../frontend/app/(core)/admin/routing/_lib/route-playback';
import { installedRoutes } from '../frontend/app/(core)/admin/routing/_lib/installed-routes';

const textClip: PurchaseRequest = {
  engineId: 'wan-3-prime',
  mode: 't2v',
  durationSec: 15,
  resolution: '480p',
  aspectRatio: '16:9',
  images: 0,
  hasVideo: false,
  hasAudioReference: false,
  hasDocument: false,
  hasEndFrame: false,
  inputVideoSeconds: 0,
};
const payload = {
  model: 'wan3.0-video-prime',
  input: { prompt: 'Demo' },
  parameters: {
    resolution: '720P',
    duration: 4,
    ratio: '16:9',
    audio: true,
    watermark: false,
    prompt_extend: false,
    seed: 0,
  },
} as const;

test('ranks compatible suppliers at exact procurement prices and respects the same ceiling on fallback', () => {
  const plan = planWanPrimePurchase(textClip);
  assert.deepEqual(plan.order, ['apimart', 'alibaba_model_studio', 'fal']);
  assert.deepEqual(
    plan.candidates.map((c) => c.costMicros),
    [1020000, 1020000, 771450]
  );
  assert.deepEqual(planWanPrimePurchase(textClip, { ceilingMicros: 771450 }).order, ['apimart']);
  assert.deepEqual(planWanPrimePurchase(textClip, { ceilingMicros: 771449 }).order, []);
  const refs = planWanPrimePurchase({
    ...textClip,
    mode: 'ref2v',
    images: 1,
    durationSec: 4,
    resolution: '720p',
  });
  assert.deepEqual(
    refs.candidates.map((c) => c.costMicros),
    [560000, 560000, 411440]
  );
  assert.deepEqual(planWanPrimePurchase(textClip, { unavailable: { apimart: 'out of funds' } }).order, [
    'alibaba_model_studio',
    'fal',
  ]);
  const extra = [
    ...WAN_PRIME_OFFERS,
    { provider: 'kling_direct' as const, tariff: 'fixture only', quote: () => 500000, exclude: () => null },
  ];
  assert.equal(rankPurchaseOffers(textClip, extra, { ceilingMicros: 1020000 }).order[0], 'kling_direct');
});
test('keeps document, video and special operations outside the new transport; unknown duration cannot win', () => {
  for (const overrides of [
    { hasDocument: true },
    { hasAudioReference: true },
    { hasEndFrame: true },
    { aspectRatio: '26:15' },
    { images: 11, mode: 'ref2v' },
    { images: 1, mode: 'i2v', hasStartFrame: false },
    { images: 2, mode: 'i2v', hasStartFrame: true },
    { images: 1, mode: 'ref2v', hasStartFrame: true },
    { hasUnpricedOptions: true },
  ]) {
    assert.ok(!planWanPrimePurchase({ ...textClip, ...overrides }).order.includes('apimart'));
  }
  const video = planWanPrimePurchase({ ...textClip, mode: 'extend', hasVideo: true, inputVideoSeconds: 5 });
  assert.deepEqual(video.order, ['alibaba_model_studio']);
  assert.equal(video.ceilingMicros, 1360000);
  assert.deepEqual(
    planWanPrimePurchase({ ...textClip, mode: 'ref2v', hasVideo: true, inputVideoSeconds: null }).order,
    []
  );
  for (const outcome of ['uncertain', 'accepted', 'invalid'] as const) {
    assert.equal(nextPurchaseProvider(['apimart', 'fal'], 'apimart', outcome), null);
  }
});
test('Wan Prime pilots require admin preproduction access and keep the installed-provider pilot independent of APIMart', () => {
  const env = {
    ALIBABA_MODEL_STUDIO_ENABLED: '1',
    ALIBABA_MODEL_STUDIO_PUBLIC_ROUTING_ENABLED: '1',
    ALIBABA_MODEL_STUDIO_ADMIN_ONLY: '0',
  };
  const keys = ['VERCEL_ENV', 'WAN_PRIME_EXISTING_PROVIDERS_ADMIN_CANARY', 'APIMART_WAN_PRIME_ADMIN_CANARY', 'APIMART_API_KEY'];
  const old = keys.map(key => process.env[key]);
  const route = (isAdmin: boolean, engineId = 'wan-3-prime') => {
    const plan = resolveVideoProviderRoutingPlan({ engineId, mode: 't2v', env, isAdmin });
    return plan.kind === 'alibaba_model_studio_primary' ? plan.purchaseCanary : undefined;
  };
  try {
    process.env.VERCEL_ENV = 'preview';
    delete process.env.WAN_PRIME_EXISTING_PROVIDERS_ADMIN_CANARY;
    process.env.APIMART_WAN_PRIME_ADMIN_CANARY = '1';
    process.env.APIMART_API_KEY = 'test';
    assert.equal(route(true), 'with-apimart');
    assert.equal(route(false), undefined);
    process.env.VERCEL_ENV = 'production';
    assert.equal(route(true), undefined);
    process.env.VERCEL_ENV = 'preview';
    delete process.env.APIMART_API_KEY;
    assert.equal(route(true), undefined);
    process.env.WAN_PRIME_EXISTING_PROVIDERS_ADMIN_CANARY = '1';
    assert.equal(route(true), 'alibaba-fal');
    assert.equal(route(false), undefined);
    assert.equal(route(true, 'wan-3'), undefined);
    process.env.APIMART_API_KEY = 'test';
    assert.equal(route(true), 'alibaba-fal');
    process.env.VERCEL_ENV = 'production';
    assert.equal(route(true), undefined);
    process.env.VERCEL_ENV = 'preview';
    delete process.env.WAN_PRIME_EXISTING_PROVIDERS_ADMIN_CANARY;
    delete process.env.APIMART_WAN_PRIME_ADMIN_CANARY;
    assert.equal(route(true), undefined);
    assert.equal(installedRoutes().length, 7);
  } finally {
    for (const [i, k] of keys.entries()) {
      if (old[i] == null) delete process.env[k];
      else process.env[k] = old[i];
    }
  }
});
test('APIMart preserves image roles and options, polls an accepted task and stores only safe diagnostics', async () => {
  const refs = {
    ...payload,
    input: { prompt: 'Demo', media: [{ type: 'reference_image' as const, url: 'https://owned.test/image' }] },
  };
  const built = buildApimartWanRequest(refs);
  assert.equal(built.generation_type, 'reference');
  assert.deepEqual(built.image_urls, ['https://owned.test/image']);
  assert.equal(built.prompt_extend, false);
  assert.equal(built.audio, true);
  assert.equal(built.seed, 0);
  const calls: string[] = [];
  const client = createApimartClient('fixture', async (url, init) => {
    calls.push(String(url));
    assert.equal(init?.redirect, 'error');
    return Response.json(
      init?.method === 'POST'
        ? { code: 200, data: [{ task_id: 'task_1' }] }
        : {
            data: {
              id: 'task_1',
              status: 'completed',
              result: { videos: [{ url: ['https://render.test/clip?signature=private'] }] },
            },
          }
    );
  });
  assert.equal((await client.createVideo(refs)).providerJobId, 'task_1');
  const completed = await client.getTask('task_1');
  assert.equal(completed.status, 'completed');
  assert.match(completed.videoUrl!, /signature/);
  assert.doesNotMatch(JSON.stringify(completed.raw), /signature/);
  assert.deepEqual(calls, [
    'https://api.apimart.ai/v1/videos/generations',
    'https://api.apimart.ai/v1/tasks/task_1',
  ]);
});
test('structured refusals can fail over, unknown replies stop, and an ACK outranks an error status', async () => {
  for (const [status, body, outcome] of [
    [402, { error: { code: 'insufficient_quota' } }, 'refused'],
    [429, { code: 429 }, 'refused'],
    [403, { error: {} }, 'invalid'],
    [503, {}, 'uncertain'],
    [200, { data: [] }, 'uncertain'],
  ] as const) {
    await assert.rejects(
      createApimartClient('fixture', async () => Response.json(body, { status })).createVideo(payload),
      (e: unknown) => e instanceof ApimartSubmitError && e.outcome === outcome
    );
  }
  const acknowledged = await createApimartClient('fixture', async () =>
    Response.json({ data: [{ task_id: 'accepted_2' }] }, { status: 429 })
  ).createVideo(payload);
  assert.equal(acknowledged.providerJobId, 'accepted_2');
});

test('simulator plays only the attempts allowed by the price decision and the response', () => {
  const plan = rankPurchaseOffers(textClip, WAN_PRIME_OFFERS, { ceilingMicros: 1_020_000 });
  const trace = routeFrames(plan, presetConditions('double', plan.order));
  assert.deepEqual(trace.filter(frame => frame.kind === 'sending').map(frame => frame.provider), plan.order);
  assert.equal(trace.at(-1)?.kind, 'accepted');
  assert.equal(trace.at(-1)?.provider, 'fal');
  const lost = routeFrames(plan, presetConditions('lost', plan.order));
  assert.deepEqual(lost.map(frame => frame.kind), ['intake', 'sending', 'uncertain']);
  const blocked = rankPurchaseOffers(textClip, WAN_PRIME_OFFERS, { ceilingMicros: 0 });
  assert.deepEqual(routeFrames(blocked, {}).map(frame => frame.kind), ['intake', 'empty']);
});
