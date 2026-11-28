import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveGenerationAttachmentReferences } from '../frontend/app/api/generate/_lib/attachment-references';
import type { NormalizedAttachment } from '../frontend/app/api/generate/_lib/attachments';
import { validateExtraInputValues } from '../frontend/app/api/generate/_lib/extra-input-values';
import { buildFalRequestParts } from '../frontend/app/api/generate/_lib/fal-request';
import { buildGenerateRequestOptions } from '../frontend/app/api/generate/_lib/request-options';
import { MINIMAX_H3_ENGINE } from '../frontend/src/config/fal-engines/minimax-h3';
import type { GeneratePayload } from '../frontend/src/lib/fal-types';
import { buildPaidVideoRequestBody } from '../frontend/src/server/agent-api/paid-video-request-body';
import { createPinnedVideoRouterClient, VideoRouterSubmitError } from '../frontend/src/server/video-providers/videorouter/client';
import {
  MINIMAX_H3_WAVESPEED_MODEL, minimaxH3VideoRouterEnabled, minimaxH3WaveSpeedPlan,
  minimaxH3WaveSpeedReferences, minimaxH3WaveSpeedRequest,
} from '../frontend/src/server/video-providers/videorouter/minimax-h3';

const urls = ['https://media.maxvideoai.com/first.jpg', 'https://media.maxvideoai.com/second.jpg'];
const prompt = 'Match @image1, then turn toward @image2.';

function canonicalFalPayload(explicitExpansion = true) {
  const engine = MINIMAX_H3_ENGINE;
  const mode = 'ref2v';
  const resolvedReferences = urls.map((storageUrl, index) => ({
    role: 'reference' as const, slot: index + 1, assetId: 'asset-' + index, mediaKind: 'image' as const, storageUrl,
    width: 800, height: 600, durationSec: null, mimeType: 'image/jpeg', sizeBytes: 1_500, originalName: index + '.jpg',
  }));
  const jobId = 'h3-quote';
  const body = buildPaidVideoRequestBody({ quoteId: jobId, engine, canonicalPricing: { membershipTier: 'member' }, resolvedReferences,
    request: {
      schemaVersion: 1, surface: 'video', engineId: engine.id, mode, prompt, outputCount: 1,
      references: resolvedReferences.map(({ assetId, role, slot }) => ({ kind: 'asset', assetId, role, slot })),
      settings: { durationSec: 15, aspectRatio: '21:9', resolution: '480P', ...(explicitExpansion ? { promptExpansionMode: 'balanced' } : {}) },
    },
  });
  const result = buildGenerateRequestOptions({ body, engine, mode, isBytePlusV1a: false });
  assert.ok(result.ok);
  const options = result.options;
  const attachments = body.inputs as NormalizedAttachment[];
  const refs = deriveGenerationAttachmentReferences({ engineId: engine.id, mode, inputSchema: engine.inputSchema, attachments,
    referenceImages: body.referenceImages });
  const extras = validateExtraInputValues({ engine, mode, rawExtraInputValues: options.rawExtraInputValues });
  assert.ok(extras.ok);
  return buildFalRequestParts({
    ...options, ...refs, attachments, engineId: engine.id, mode, jobId, localKey: null, needsImage: false, needsFirstLastFrames: false,
    apiKey: body.apiKey, durationOption: options.rawDurationOption, resolution: options.effectiveResolution,
    fps: body.fps, cfgScale: body.cfgScale, extraInputValues: extras.values,
  }).falPayload;
}

test('H3 admits both balanced forms from the canonical paid request and preserves original image order', () => {
  for (const explicit of [true, false]) {
    const payload = canonicalFalPayload(explicit);
    assert.equal(payload.resolution, '480P');
    assert.equal(payload.audio, undefined);
    assert.equal(payload.extraInputValues?.prompt_expansion_mode, explicit ? 'balanced' : undefined);
    const retained = JSON.parse(JSON.stringify(payload)) as GeneratePayload;
    assert.deepEqual(minimaxH3WaveSpeedReferences(payload), urls);
    assert.deepEqual(minimaxH3WaveSpeedReferences(retained), urls);
    assert.deepEqual(minimaxH3WaveSpeedReferences({ ...payload, audio: true, durationOption: '15', referenceImages: undefined }), urls);
    assert.deepEqual(minimaxH3WaveSpeedReferences({ ...payload, referenceImages: [...urls].reverse(), inputs: [...payload.inputs!].reverse() }),
      [...urls].reverse());
  }
});

test('every unqualified H3 input keeps the original Fal payload intact', () => {
  const payload = canonicalFalPayload();
  const [first, second] = payload.inputs!;
  const changes: Partial<GeneratePayload>[] = [
    { engineId: 'minimax-h3-max' }, { mode: 'i2v' }, { mode: 't2v' }, { operation: 'h3-recast' },
    { durationSec: 14 }, { durationOption: 14 }, { resolution: '768P' }, { aspectRatio: 'auto' }, { prompt: ' ' },
    { audio: false }, { seed: 0 }, { apiKey: 'fixture' }, { fps: 24 }, { imageUrl: urls[0] }, { endImageUrl: urls[0] },
    { videoUrl: 'https://example.com/motion.mp4' }, { audioUrl: 'https://example.com/audio.wav' },
    ...['fast', 'disabled', 'quality', '', null].map(mode => ({ extraInputValues: { prompt_expansion_mode: mode } })),
    { extraInputValues: { prompt_expansion_mode: 'balanced', seed: 0 } }, { extraInputValues: { generate_audio: true } },
    { referenceImages: [urls[0]] }, { referenceImages: [...urls].reverse() }, { referenceImages: [urls[0], urls[0], urls[1]] },
    { inputs: [first] }, { inputs: [first, second, first] }, { inputs: [second, first] },
    { inputs: [first, { ...second, kind: 'video' }] }, { inputs: [first, { ...second, kind: 'audio' }] },
    { inputs: [first, { ...second, slotId: 'image_url' }] }, { inputs: [first, { ...second, assetId: '  ' }] },
    { inputs: [first, { ...second, assetId: first.assetId }] }, { inputs: [first, { ...second, dataUrl: 'data:image/png;base64,AA' }] },
    { inputs: [first, { ...second, url: 'http://example.com/plain.jpg' }], referenceImages: undefined },
  ];
  for (const change of changes) {
    const variant = { ...payload, ...change };
    const before = structuredClone(variant);
    assert.equal(minimaxH3WaveSpeedReferences(variant), null, JSON.stringify(change));
    assert.deepEqual(variant, before);
  }
});

test('H3 ranks the standard purchase maximum and keeps Fal reachable only within the customer ceiling', () => {
  const plan = minimaxH3WaveSpeedPlan(15, 950_000);
  assert.equal(plan.baselineMicros, 750_000);
  assert.equal(plan.ceilingMicros, 750_000);
  assert.deepEqual(plan.candidates.map(offer => offer.costMicros), [615_000, 750_000]);
  assert.deepEqual(plan.order, ['videorouter', 'fal']);
  assert.deepEqual(minimaxH3WaveSpeedPlan(15, 615_000).order, ['videorouter']);
  assert.deepEqual(minimaxH3WaveSpeedPlan(15, 614_999).order, []);
  assert.deepEqual(minimaxH3WaveSpeedPlan(14, 950_000).order, ['fal']);
});

test('H3 pins the verified WaveSpeed model for quote and submission and rejects over-ceiling quotes before submission', async () => {
  const request = minimaxH3WaveSpeedRequest(' ' + prompt + ' ', 15, urls, 1);
  assert.equal(MINIMAX_H3_WAVESPEED_MODEL, 'minimax/h3/wavespeed');
  assert.equal(request.hostModel, 'wavespeed/minimax-h3-native');
  assert.equal(request.maximumUsd, 0.615);
  assert.equal(minimaxH3WaveSpeedRequest(prompt, 15, urls, 0.61).maximumUsd, 0.61);
  assert.deepEqual(request.body, {
    model: 'minimax/h3/wavespeed', provider: { only: ['wavespeed'], allow_fallbacks: false }, duration_secs: 15,
    strict_duration: true, resolution: '480p', aspect_ratio: '21:9', prompt, prompt_extend: true,
    input_references: urls.map(url => ({ type: 'image_url', image_url: { url } })),
  });
  for (const maximum of [0.6075, 0.615001]) {
    const paths: string[] = [];
    const client = createPinnedVideoRouterClient('offline', async (url, init) => {
      const path = new URL(String(url)).pathname;
      paths.push(path);
      const body = JSON.parse(String(init?.body));
      if (path === '/v1/pricing/estimate') {
        assert.deepEqual(body, { ...request.body, type: 'video' });
        return Response.json({ object: 'pricing.estimate', type: 'video', model: request.hostModel, currency: 'USD',
          estimated_cost_usd: 0.6075, max_cost_usd: maximum,
          assumptions: { duration_secs: 15, resolution: '480p', aspect_ratio: '21:9', reference_images: 2 },
        });
      }
      assert.deepEqual(body, request.body);
      return Response.json({ id: 'video:fixture' });
    });
    if (maximum <= request.maximumUsd) {
      assert.equal((await client.createVideo(request)).providerJobId, 'video:fixture');
      assert.deepEqual(paths, ['/v1/pricing/estimate', '/v1/videos']);
    } else {
      await assert.rejects(client.createVideo(request), error => error instanceof VideoRouterSubmitError && error.outcome === 'refused');
      assert.deepEqual(paths, ['/v1/pricing/estimate']);
    }
  }
});

test('H3 canary requires an explicit public setting and a configured VideoRouter key', () => {
  const previousKey = process.env.VIDEOROUTER_API_KEY;
  const previousFlag = process.env.MINIMAX_H3_VIDEOROUTER_CANARY;
  try {
    process.env.VIDEOROUTER_API_KEY = 'offline';
    for (const flag of ['', '1', 'admin', 'public']) {
      process.env.MINIMAX_H3_VIDEOROUTER_CANARY = flag;
      assert.equal(minimaxH3VideoRouterEnabled(), flag === 'public');
    }
    process.env.VIDEOROUTER_API_KEY = ' ';
    assert.equal(minimaxH3VideoRouterEnabled(), false);
  } finally {
    if (previousKey === undefined) delete process.env.VIDEOROUTER_API_KEY;
    else process.env.VIDEOROUTER_API_KEY = previousKey;
    if (previousFlag === undefined) delete process.env.MINIMAX_H3_VIDEOROUTER_CANARY;
    else process.env.MINIMAX_H3_VIDEOROUTER_CANARY = previousFlag;
  }
});
