import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createApimartClient,
  buildApimartWanRequest,
  ApimartSubmitError,
} from '../frontend/src/server/video-providers/apimart/wan-prime';
import {
  planWanPrimePurchase,
  planWanPurchase,
  rankPurchaseOffers,
  WAN_PRIME_OFFERS,
  type PurchaseRequest,
  type PurchaseOffer,
} from '../frontend/src/server/video-providers/purchase-router';
import { isWanDirectProvider, enabledWanPollProviders, wanTransports } from '../frontend/src/server/video-providers/wan-transports';
import { resolveAlibabaModelRoute } from '../frontend/src/server/video-providers/alibaba-model-studio/model-map';
import { resolveVideoProviderRoutingPlan } from '../frontend/src/server/video-providers/router';
import { nextPurchaseProvider } from '../frontend/src/lib/video-purchase-decision';
import { computeCanonicalBillingSnapshot } from '../frontend/server/pricing/quote-billing';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { WAN_3_PRIME_FAL_ENGINE_REGISTRY } from '../frontend/src/config/fal-engines/wan-3-prime';
import { WAN_3_PRIME_FAL_USD_PER_SECOND } from '../frontend/src/lib/wan3-prime-fal-rates';
import { buildBillingPricingFacts } from '../frontend/src/lib/pricing-billing-facts';
import { buildManualTariffScenario } from '../frontend/src/lib/pricing-manual-scenario';
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
test('a change to Fal procurement reroutes Wan Prime without changing its published context or a new customer quote', async t => {
  const engine = getFalEngineById('wan-3-prime')!.engine;
  const context = { engine, mode: 't2v' as const, durationSec: 15, resolution: '480p', aspectRatio: '16:9', audioEnabled: true };
  const selector = buildManualTariffScenario(context, buildBillingPricingFacts(context, engine.pricingDetails, 'USD').facts).selector;
  const cell = { id: 'wan-approved-sale-price', source: 'versioned' as const, version: 1, currency: 'USD',
    effectiveFrom: '2026-01-01T00:00:00Z', selector, price: { kind: 'fixed' as const, customerCents: 200 } };
  async function customerQuote(active: boolean) {
    const snapshot = await computeCanonicalBillingSnapshot(context, {
      pricingPolicy: { loadOverrides: async () => ({ status: 'loaded', rules: [] }) },
      loadCustomerTariffState: async () => ({ status: 'loaded', active, revision: 7, databaseCells: [], versionedCells: [cell] }),
    });
    return [snapshot.currency, snapshot.totalCents];
  }

  const legacyQuote = await customerQuote(false);
  assert.deepEqual(await customerQuote(true), ['USD', 200]);
  const commercialRates = WAN_3_PRIME_FAL_ENGINE_REGISTRY[0].engine.pricing!.byResolution;
  const commercial480p = commercialRates?.['480p'];
  assert.equal(commercial480p, 0.068);
  assert.equal(planWanPrimePurchase(textClip).order[0], 'apimart');

  const original = WAN_3_PRIME_FAL_USD_PER_SECOND['480p'];
  t.after(() => { Object.assign(WAN_3_PRIME_FAL_USD_PER_SECOND, { '480p': original }); });
  Object.assign(WAN_3_PRIME_FAL_USD_PER_SECOND, { '480p': 0.01 });
  const cheaperFal = planWanPrimePurchase(textClip);
  assert.equal(cheaperFal.order[0], 'fal');
  assert.equal(cheaperFal.candidates.find(offer => offer.provider === 'fal')?.costMicros, 150_000);
  assert.equal(commercialRates?.['480p'], commercial480p);
  assert.deepEqual(await customerQuote(false), legacyQuote);
  assert.deepEqual(await customerQuote(true), ['USD', 200]);
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
  const keys = ['VERCEL_ENV', 'WAN_STANDARD_EXISTING_PROVIDERS_ADMIN_CANARY', 'WAN_PRIME_EXISTING_PROVIDERS_ADMIN_CANARY', 'APIMART_WAN_PRIME_ADMIN_CANARY', 'APIMART_API_KEY'];
  const old = keys.map(key => process.env[key]);
  const route = (isAdmin: boolean, engineId = 'wan-3-prime') => {
    const plan = resolveVideoProviderRoutingPlan({ engineId, mode: 't2v', env, isAdmin });
    return plan.kind === 'alibaba_model_studio_primary' ? plan.purchaseCanary : undefined;
  };
  try {
    process.env.VERCEL_ENV = 'preview';
    delete process.env.WAN_PRIME_EXISTING_PROVIDERS_ADMIN_CANARY;
    delete process.env.WAN_STANDARD_EXISTING_PROVIDERS_ADMIN_CANARY;
    process.env.APIMART_WAN_PRIME_ADMIN_CANARY = '1';
    process.env.APIMART_API_KEY = 'test';
    assert.equal(route(true), 'with-apimart');
    assert.equal(route(true, 'wan-3'), undefined);
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
    process.env.WAN_STANDARD_EXISTING_PROVIDERS_ADMIN_CANARY = '1';
    assert.equal(route(true, 'wan-3'), 'alibaba-fal');
    assert.equal(route(false, 'wan-3'), undefined);
    process.env.APIMART_API_KEY = 'test';
    assert.equal(route(true), 'alibaba-fal');
    process.env.VERCEL_ENV = 'production';
    assert.equal(route(true), undefined);
    process.env.VERCEL_ENV = 'preview';
    delete process.env.WAN_PRIME_EXISTING_PROVIDERS_ADMIN_CANARY;
    delete process.env.APIMART_WAN_PRIME_ADMIN_CANARY;
    assert.equal(route(true), undefined);
    assert.equal(route(true, 'wan-3'), 'alibaba-fal');
    assert.equal(route(true, 'happyhorse'), undefined);
    process.env.VERCEL_ENV = 'production';
    assert.equal(route(true, 'wan-3'), undefined);
    assert.equal(installedRoutes().length, 7);
  } finally {
    for (const [i, k] of keys.entries()) {
      if (old[i] == null) delete process.env[k];
      else process.env[k] = old[i];
    }
  }
});
test('Wan Standard qualifies only reviewed requests on the installed pilot, always leaving APIMart out of execution', () => {
  const request = { ...textClip, engineId: 'wan-3', mode: 'ref2v', images: 1, durationSec: 30, aspectRatio: '9:16' };
  assert.equal(planWanPurchase(request).canaryEligible, false);
  assert.equal(planWanPurchase(request, {}, 'with-apimart').canaryEligible, false);
  const paired = planWanPurchase(request, {}, 'alibaba-fal');
  assert.equal(paired.canaryEligible, true);
  assert.deepEqual(paired.order, ['alibaba_model_studio', 'fal']);
  assert.equal(paired.ceilingMicros, 1_500_000);
  assert.deepEqual(planWanPurchase(request, { unavailable: { fal: 'disabled' } }, 'alibaba-fal').order, ['alibaba_model_studio']);
  assert.deepEqual(planWanPurchase(request, { ceilingMicros: 1_499_999 }, 'alibaba-fal').order, []);
  for (const override of [{hasAudioReference: true}, {hasVideo: true, inputVideoSeconds: 5}, {hasDocument: true},
    {hasUnpricedOptions: true}, {hasEndFrame: true}, {images: 11}, {durationSec: 1}, {resolution: '2k'}]) {
    assert.equal(planWanPurchase({ ...request, ...override }, {}, 'alibaba-fal').canaryEligible, false);
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

test('an additional executable offer cannot enter a previously qualified Wan pilot', t => {
  const offers = WAN_PRIME_OFFERS as PurchaseOffer[];
  offers.push({ provider: 'kling_direct', tariff: 'Test offer', quote: () => 100, exclude: () => null });
  t.after(() => { offers.pop(); });
  assert.equal(planWanPrimePurchase(textClip).order[0], 'kling_direct');
  for (const pilot of ['alibaba-fal', 'with-apimart'] as const) {
    const plan = planWanPurchase(textClip, {}, pilot);
    assert.ok(plan.canaryEligible);
    assert.ok(!plan.order.includes('kling_direct'));
    assert.match(plan.candidates.find(r => r.provider === 'kling_direct')?.excluded ?? '', /Outside the selected Wan pilot/);
  }
});

test('registered transports own accepted tasks, supplier model names and accounting independently of new dispatch', t => {
  const key = process.env.APIMART_API_KEY;
  const gate = process.env.APIMART_WAN_PRIME_ADMIN_CANARY;
  t.after(() => {
    if (key === undefined) delete process.env.APIMART_API_KEY;
    else process.env.APIMART_API_KEY = key;
    if (gate === undefined) delete process.env.APIMART_WAN_PRIME_ADMIN_CANARY;
    else process.env.APIMART_WAN_PRIME_ADMIN_CANARY = gate;
  });
  process.env.APIMART_WAN_PRIME_ADMIN_CANARY = '0';
  delete process.env.APIMART_API_KEY;
  assert.ok(!enabledWanPollProviders().includes('apimart'));
  process.env.APIMART_API_KEY = 'offline-test-only';
  assert.ok(enabledWanPollProviders().includes('apimart'));
  assert.equal(isWanDirectProvider('wavespeed'), false);
  const prime = resolveAlibabaModelRoute('wan-3-prime', 't2v')!;
  const standard = resolveAlibabaModelRoute('wan-3', 't2v')!;
  assert.equal(wanTransports.apimart.modelId(prime), 'wan3.0-video-prime');
  assert.equal(wanTransports.apimart.modelId(standard), null);
  assert.equal(wanTransports.alibaba_model_studio.modelId(standard), 'wan3.0-video');
  const job = {engine_id: 'wan-3-prime', duration_sec: 4, settings_snapshot: {}, pricing_snapshot: {}};
  assert.equal(wanTransports.apimart.estimateCost(job, undefined, '720p').providerCostUsd, 0.41144);
  assert.equal(wanTransports.apimart.estimateCost(job, undefined, '2K').providerCostUsd, null);
  assert.equal(wanTransports.apimart.estimateCost({...job, engine_id: 'wan-3'}, undefined, '720p').providerCostUsd, null);
});
