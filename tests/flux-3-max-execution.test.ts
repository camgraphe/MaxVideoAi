import assert from 'node:assert/strict';
import test from 'node:test';

import { getFalEngineById } from '../frontend/src/config/falEngines';
import { buildFalGenerationRequest } from '../frontend/src/lib/fal-request-body';
import { resolveFalModelSlug } from '../frontend/src/lib/fal-model-helpers';
import { resolveEngineIdFromModelSlug, resolveFalModelId } from '../frontend/src/lib/fal-catalog';
import { buildGenerateRequestOptions } from '../frontend/app/api/generate/_lib/request-options';
import { validateRequest } from '../frontend/app/api/generate/_lib/validate';
import { buildBillingPricingFacts } from '../frontend/src/lib/pricing-billing-facts';
import { buildPublicPricingFacts } from '../frontend/src/lib/pricing-public-facts';
import type { GeneratePayload } from '../frontend/src/lib/fal-types';
import { parsePreflightRequestPayload } from '../frontend/app/api/preflight/_lib/preflight-request';
import { computeCanonicalBillingSnapshot } from '../frontend/server/pricing/quote-billing';

const textEndpoint = 'blackforestlabs/flux-3-max/text-to-video';
const imageEndpoint = 'blackforestlabs/flux-3-max/image-to-video';
const base: GeneratePayload = { engineId: 'flux-3-max', mode: 't2v', prompt: 'A glass bird unfolds its wings.' };

test('FLUX 3 Max generation accepts the workspace numeric duration strings in all four modes', () => {
  const engine = getFalEngineById('flux-3-max')!.engine;
  for (const mode of ['t2v', 'i2v', 'fl2v', 'ref2v'] as const) {
    for (const durationSec of [8, 16]) {
      const payload: GeneratePayload = { ...base, mode, durationSec, durationOption: String(durationSec),
        ...(mode === 'i2v' || mode === 'fl2v' ? { imageUrl: 'https://media.example/start.png' } : {}),
        ...(mode === 'fl2v' ? { endImageUrl: 'https://media.example/end.png' } : {}),
        ...(mode === 'ref2v' ? { referenceImages: ['https://media.example/start.png', 'https://media.example/end.png'],
          extraInputValues: { keyframe_indexes: `0,${durationSec * 24}` } } : {}),
      };
      const options = buildGenerateRequestOptions({ body: payload, engine, mode, isBytePlusV1a: false });
      assert.equal(options.ok, true);
      if (options.ok) assert.equal(options.options.durationSec, durationSec);
      assert.equal(buildFalGenerationRequest(payload, textEndpoint).requestBody.duration, durationSec);
    }
  }
});

test('FLUX 3 Max 2:1 option reaches preflight while unknown aspect ratios are rejected', () => {
  const request = { engine: 'flux-3-max', mode: 't2v', durationSec: 5, resolution: '720p', aspectRatio: '2:1', fps: 24 };
  assert.equal(parsePreflightRequestPayload(request).ok, true);
  assert.equal(parsePreflightRequestPayload({ ...request, aspectRatio: '7:3' }).ok, false);
});

test('FLUX 3 Max dispatches integer provider defaults to the canonical text endpoint', () => {
  assert.deepEqual(buildFalGenerationRequest(base, 'fal-ai/video/flux-3-max'), {
    model: textEndpoint,
    requestBody: {
      prompt: base.prompt, duration: 5, resolution: '720p', aspect_ratio: 'auto',
      generate_audio: true, reasoning_level: 'high',
    },
  });
});

test('FLUX 3 Max maps two-frame workspace attachments to image-to-video', () => {
  const payload: GeneratePayload = {
    ...base, mode: 'fl2v', durationOption: '20', resolution: '1080p', aspectRatio: '2:1', audio: false, seed: 42,
    extraInputValues: { reasoning_level: 'low', safety_tolerance: 4 },
    inputs: [
      { slotId: 'start_image_url', kind: 'image', name: 'start.png', type: 'image/png', size: 12, url: 'https://media.example/start.png' },
      { slotId: 'end_image_url', kind: 'image', name: 'end.png', type: 'image/png', size: 12, url: 'https://media.example/end.png' },
    ],
  };
  assert.equal(resolveFalModelSlug(payload, textEndpoint), imageEndpoint);
  assert.deepEqual(buildFalGenerationRequest(payload, textEndpoint), {
    model: imageEndpoint,
    requestBody: {
      prompt: base.prompt, duration: 20, resolution: '1080p', aspect_ratio: '2:1',
      generate_audio: false, reasoning_level: 'low', seed: 42,
      image_url: 'https://media.example/start.png', end_image_url: 'https://media.example/end.png',
    },
  });
});

test('FLUX 3 Max image-to-video accepts an optional final frame and requires its opening frame', () => {
  const payload = { ...base, mode: 'i2v', imageUrl: 'https://media.example/start.png', endImageUrl: 'https://media.example/end.png' };
  const request = buildFalGenerationRequest(payload, textEndpoint);
  assert.equal(request.model, imageEndpoint);
  assert.equal(request.requestBody.image_url, payload.imageUrl);
  assert.equal(request.requestBody.end_image_url, payload.endImageUrl);
  assert.throws(() => buildFalGenerationRequest({ ...base, mode: 'i2v', endImageUrl: payload.endImageUrl }, textEndpoint), /opening image/i);
  assert.throws(() => buildFalGenerationRequest({ ...base, mode: 'fl2v', imageUrl: payload.imageUrl }, textEndpoint), /end image/i);
});

test('FLUX 3 Max rejects inherited unsupported modes and invalid provider controls before dispatch', () => {
  for (const mode of ['extend', 'v2v']) {
    assert.equal(resolveFalModelSlug({ ...base, mode }, textEndpoint), undefined);
    assert.throws(() => buildFalGenerationRequest({ ...base, mode }, textEndpoint), /mode/i);
  }
  for (const durationOption of ['auto', '5s', '5.5', 4, 5.5, 21]) {
    assert.throws(() => buildFalGenerationRequest({ ...base, durationOption }, textEndpoint), /duration/i);
  }
  assert.throws(() => buildFalGenerationRequest({ ...base, resolution: '4k' }, textEndpoint), /resolution/i);
  assert.throws(() => buildFalGenerationRequest({ ...base, extraInputValues: { reasoning_level: 'medium' } }, textEndpoint), /reasoning/i);
  assert.throws(() => buildFalGenerationRequest({ ...base, imageUrl: 'https://media.example/start.png' }, textEndpoint), /image/i);
});

test('FLUX 3 Max seed bounds match the workspace and preserve both accepted endpoints', () => {
  const engine = getFalEngineById('flux-3-max')!.engine;
  const seedField = engine.inputSchema!.optional.find(field => field.id === 'seed')!;
  assert.equal(seedField.min, 0);
  assert.equal(seedField.max, 2147483647);
  for (const seed of [0, 2147483647]) {
    assert.equal(buildFalGenerationRequest({ ...base, seed }, textEndpoint).requestBody.seed, seed);
    assert.equal(validateRequest(engine.id, 't2v', { prompt: base.prompt, duration: 5, seed }, { inputSchema: engine.inputSchema }).ok, true);
  }
  for (const seed of [-1, 2147483648, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => buildFalGenerationRequest({ ...base, seed }, textEndpoint), /seed/i);
    assert.equal(validateRequest(engine.id, 't2v', { prompt: base.prompt, duration: 5, seed }, { inputSchema: engine.inputSchema }).ok, false);
  }
});

test('FLUX 3 Max maps ordered keyframes with exact inclusive 24fps positions', () => {
  const payload = { ...base, mode: 'ref2v', durationSec: 5,
    referenceImages: ['https://media.example/z.png', 'https://media.example/a.png'],
    extraInputValues: { keyframe_indexes: '120, 0', reasoning_level: 'low' } };
  const result = buildFalGenerationRequest(payload, textEndpoint);
  assert.equal(result.model, 'blackforestlabs/flux-3-max/keyframes-to-video');
  assert.deepEqual(result.requestBody.keyframes, [
    { image_url: payload.referenceImages[0], frame_index: 120 },
    { image_url: payload.referenceImages[1], frame_index: 0 },
  ]);
  assert.equal(result.requestBody.keyframe_indexes, undefined);
  assert.equal(result.requestBody.reference_image_urls, undefined);
  for (const keyframe_indexes of ['', '0', '0,0', '0,121', '-1,120', '0,0.5', '0,NaN']) {
    assert.throws(() => buildFalGenerationRequest({ ...payload, extraInputValues: { keyframe_indexes } }, textEndpoint), /keyframe/i);
  }
  assert.throws(() => buildFalGenerationRequest({ ...payload, referenceImages: Array(11).fill('https://media.example/a.png'), extraInputValues: { keyframe_indexes: '0,1,2,3,4,5,6,7,8,9,10' } }, textEndpoint), /keyframe/i);
  assert.equal(validateRequest('flux-3-max', 'ref2v', { prompt: base.prompt, duration: 5,
    reference_image_urls: payload.referenceImages, keyframe_indexes: '0,120' },
  { inputSchema: getFalEngineById('flux-3-max')!.engine.inputSchema }).ok, true);
});

test('FLUX 3 Max catalog and runtime defaults reach supported request validation without fixed FPS', async () => {
  const engine = getFalEngineById('flux-3-max')?.engine;
  assert.ok(engine, 'FLUX 3 Max must be registered');
  assert.equal(await resolveFalModelId(engine.id), textEndpoint);
  assert.equal(await resolveEngineIdFromModelSlug(imageEndpoint), engine.id);
  const result = buildGenerateRequestOptions({ body: { prompt: base.prompt }, engine, mode: 't2v', isBytePlusV1a: false });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.options.durationSec, 5);
  assert.equal(result.options.effectiveResolution, '720p');
  assert.equal(result.options.aspectRatio, 'auto');
  assert.equal(result.options.supportsFps, false);
  assert.deepEqual(validateRequest(engine.id, 't2v', {
    prompt: base.prompt, duration: 20, resolution: '1080p', aspect_ratio: '2:1', generate_audio: false,
    reasoning_level: 'low',
  }, { inputSchema: engine.inputSchema }), { ok: true });
  for (const duration of ['auto', 4, 5.5, 21]) {
    const invalid = validateRequest(engine.id, 't2v', {
      prompt: base.prompt, duration, resolution: '720p',
    }, { inputSchema: engine.inputSchema });
    assert.equal(invalid.ok, false, `must reject duration ${duration}`);
  }
  assert.equal(validateRequest(engine.id, 't2v', {
    prompt: base.prompt, duration: 5, resolution: '720p', reasoning_level: 'medium',
  }, { inputSchema: engine.inputSchema }).ok, false);
});

test('FLUX 3 Max billing and public provider facts retain normal list rates without promotion or audio surcharge', () => {
  const engine = getFalEngineById('flux-3-max')?.engine;
  assert.ok(engine);
  for (const mode of ['t2v', 'i2v', 'fl2v', 'ref2v'] as const) {
    for (const audio of [false, true]) {
      for (const [resolution, expected] of [['720p', 85], ['1080p', 145]] as const) {
        const context = { engine, mode, durationSec: 5, resolution, addons: { audio } };
        assert.equal(buildBillingPricingFacts(context, engine.pricingDetails, 'USD').facts.vendorSubtotalExactCents, expected);
        assert.equal(buildPublicPricingFacts(context).facts.vendorSubtotalExactCents, expected);
      }
    }
  }
});

test('FLUX 3 Max canonical retail uses regular Fal cost plus 30 percent with standard rounding', async () => {
  const engine = getFalEngineById('flux-3-max')!.engine;
  for (const audio of [false, true]) {
    for (const [durationSec, resolution, expected] of [[5, '720p', 111], [10, '720p', 221], [5, '1080p', 189], [10, '1080p', 377]] as const) {
      const snapshot = await computeCanonicalBillingSnapshot({ engine, mode: 't2v', durationSec, resolution, addons: { audio } }, {
        loadCustomerTariffState: async () => ({ status: 'loaded', active: false, revision: 0, databaseCells: [], versionedCells: [] }),
        pricingPolicy: { loadOverrides: async () => ({ status: 'loaded', rules: [], routingRules: [] }) },
      });
      assert.equal(snapshot.totalCents, expected, `${durationSec}s ${resolution}, audio ${audio}`);
    }
  }
});
