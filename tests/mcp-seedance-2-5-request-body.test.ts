import assert from 'node:assert/strict';
import test from 'node:test';

import { listFalEngines } from '../frontend/src/config/falEngines';
import { normalizeGenerationRequest } from '../frontend/src/server/agent-api/generation-normalization';
import type {
  CanonicalGenerationMode,
  CanonicalGenerationReference,
  CanonicalGenerationRequest,
} from '../frontend/src/server/agent-api/generation-types';
import {
  submitReservedPaidGeneration,
  type PaidGenerationExecution,
} from '../frontend/src/server/agent-api/paid-generation-execution';
import type { ResolvedReference } from '../frontend/src/server/agent-api/reference-types';

const engine = listFalEngines().find((candidate) => candidate.id === 'seedance-2-5')?.engine;
assert.ok(engine);

const imageStart = 'https://cdn.maxvideoai.com/mcp/start.png';
const imageEnd = 'https://cdn.maxvideoai.com/mcp/end.png';
const imageRef = 'https://cdn.maxvideoai.com/mcp/reference.png';
const videoRef = 'https://cdn.maxvideoai.com/mcp/reference.mp4';
const audioRef = 'https://cdn.maxvideoai.com/mcp/reference.wav';
const sourceVideo = 'https://cdn.maxvideoai.com/mcp/source.mp4';
const secondVideo = 'https://cdn.maxvideoai.com/mcp/z-second.mp4';

function httpsReference(
  url: string,
  role: CanonicalGenerationReference['role'],
  mediaKind: 'image' | 'video' | 'audio',
): CanonicalGenerationReference {
  return { kind: 'https', url, role, mediaKind };
}

function canonicalRequest(
  mode: CanonicalGenerationMode,
  references: CanonicalGenerationReference[],
): CanonicalGenerationRequest {
  return normalizeGenerationRequest({
    surface: 'video',
    engineId: 'seedance-2-5',
    mode,
    prompt: `Exercise ${mode} projection`,
    settings: {
      durationSec: 4,
      resolution: '480p',
      ...(mode === 'i2v' ? {} : { aspectRatio: '16:9' }),
      audio: true,
    },
    references,
    outputCount: 1,
  });
}

async function projectedBody(
  request: CanonicalGenerationRequest,
  resolvedReferences: ResolvedReference[] = [],
): Promise<Record<string, unknown>> {
  const execution: PaidGenerationExecution = {
    surface: 'video',
    quoteId: '123e4567-e89b-42d3-a456-426614174000',
    userId: 'seedance-request-body-user',
    request,
    resolvedReferences,
    engine,
    canonicalPricing: { membershipTier: 'member' },
    trustedInitialState: {
      kind: 'created',
      jobId: '123e4567-e89b-42d3-a456-426614174000',
      walletChargeReserved: true,
    },
  };
  let body: Record<string, unknown> | null = null;
  const outcome = await submitReservedPaidGeneration(execution, {
    async executeVideo(options) {
      body = options.body;
      return { status: 202, body: { ok: true, status: 'pending' } };
    },
    async executeImage() {
      throw new Error('wrong surface');
    },
  });
  assert.deepEqual(outcome, { kind: 'accepted' });
  assert.ok(body);
  return body;
}

test('Seedance 2.5 paid projection routes all five modes into exact app request fields', async () => {
  const cases: Array<{
    mode: CanonicalGenerationMode;
    references: CanonicalGenerationReference[];
    expected: Record<string, unknown>;
    expectedInputs: Array<Record<string, unknown>>;
  }> = [
    { mode: 't2v', references: [], expected: {}, expectedInputs: [] },
    {
      mode: 'i2v',
      references: [
        httpsReference(imageStart, 'first_frame', 'image'),
        httpsReference(imageEnd, 'last_frame', 'image'),
      ],
      expected: { imageUrl: imageStart, endImageUrl: imageEnd },
      expectedInputs: [],
    },
    {
      mode: 'ref2v',
      references: [
        httpsReference(imageRef, 'reference', 'image'),
        httpsReference(videoRef, 'reference', 'video'),
        httpsReference(audioRef, 'reference', 'audio'),
      ],
      expected: {
        referenceImages: [imageRef],
        referenceVideos: [videoRef],
        referenceAudio: [audioRef],
      },
      expectedInputs: [
        { kind: 'video', slotId: 'video_urls', url: videoRef },
        { kind: 'audio', slotId: 'audio_urls', url: audioRef },
      ],
    },
    {
      mode: 'v2v',
      references: [
        httpsReference(sourceVideo, 'source', 'video'),
        httpsReference(imageRef, 'reference', 'image'),
        httpsReference(audioRef, 'reference', 'audio'),
      ],
      expected: {
        videoUrl: sourceVideo,
        referenceImages: [imageRef],
        referenceAudio: [audioRef],
      },
      expectedInputs: [
        { kind: 'video', slotId: 'video_url', url: sourceVideo },
        { kind: 'audio', slotId: 'audio_urls', url: audioRef },
      ],
    },
    {
      mode: 'extend',
      references: [
        httpsReference(sourceVideo, 'source', 'video'),
        httpsReference(secondVideo, 'source', 'video'),
      ],
      expected: { extensionSourceVideos: [sourceVideo, secondVideo] },
      expectedInputs: [
        { kind: 'video', slotId: 'extension_source_videos', url: sourceVideo },
        { kind: 'video', slotId: 'extension_source_videos', url: secondVideo },
      ],
    },
  ];

  for (const scenario of cases) {
    const body = await projectedBody(canonicalRequest(scenario.mode, scenario.references));
    for (const [field, value] of Object.entries(scenario.expected)) {
      assert.deepEqual(body[field], value, `${scenario.mode}.${field}`);
    }
    assert.deepEqual(body.inputs, scenario.expectedInputs, `${scenario.mode}.inputs`);
    if (scenario.mode === 'i2v') {
      assert.equal(Object.hasOwn(body, 'aspectRatio'), false);
    }
  }
});

test('ordered Seedance source slots come from canonical request order, never resolver or caller order', async () => {
  const first = { kind: 'asset' as const, assetId: 'slot-1', role: 'source' as const };
  const second = { kind: 'asset' as const, assetId: 'slot-2', role: 'source' as const };
  const left = canonicalRequest('extend', [first, second]);
  const right = canonicalRequest('extend', [second, first]);
  const resolved: ResolvedReference[] = [
    {
      assetId: second.assetId,
      role: 'source',
      mediaKind: 'video',
      storageUrl: secondVideo,
      width: 1920,
      height: 1080,
      mimeType: 'video/mp4',
    },
    {
      assetId: first.assetId,
      role: 'source',
      mediaKind: 'video',
      storageUrl: sourceVideo,
      width: 1920,
      height: 1080,
      mimeType: 'video/mp4',
    },
  ];
  assert.deepEqual(left.references, right.references);
  assert.deepEqual(
    (await projectedBody(left, resolved)).extensionSourceVideos,
    (await projectedBody(right, [...resolved].reverse())).extensionSourceVideos,
  );
  const body = await projectedBody(left, resolved);
  assert.deepEqual(body.extensionSourceVideos, [sourceVideo, secondVideo]);
  assert.equal(JSON.stringify(body).includes('slot-1'), false);
  assert.equal(JSON.stringify(body).includes('mimeType'), false);
});
