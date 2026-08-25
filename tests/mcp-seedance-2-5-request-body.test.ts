import assert from 'node:assert/strict';
import test from 'node:test';

import { listFalEngines } from '../frontend/src/config/falEngines';
import {
  hashCanonicalGenerationRequest,
  normalizeGenerationRequest,
} from '../frontend/src/server/agent-api/generation-normalization';
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
import { resolveGenerationReferences } from '../frontend/src/server/agent-api/resolve-generation-references';
import { deriveGenerationAttachmentReferences } from '../frontend/app/api/generate/_lib/attachment-references';
import { buildBytePlusSeedancePayload } from '../frontend/src/server/video-providers/byteplus-modelark';

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
      slot: 1,
      mediaKind: 'video',
      storageUrl: secondVideo,
      width: 1920,
      height: 1080,
      mimeType: 'video/mp4',
    },
    {
      assetId: first.assetId,
      role: 'source',
      slot: 0,
      mediaKind: 'video',
      storageUrl: sourceVideo,
      width: 1920,
      height: 1080,
      mimeType: 'video/mp4',
    },
  ];
  assert.notDeepEqual(left.references, right.references);
  assert.notEqual(hashCanonicalGenerationRequest(left), hashCanonicalGenerationRequest(right));
  const body = await projectedBody(left, resolved);
  assert.deepEqual(body.extensionSourceVideos, [sourceVideo, secondVideo]);
  const reversedResolved: ResolvedReference[] = resolved.map((reference) => ({
    ...reference,
    slot: reference.slot === 0 ? 1 : 0,
  }));
  const reversedBody = await projectedBody(right, reversedResolved);
  assert.deepEqual(reversedBody.extensionSourceVideos, [secondVideo, sourceVideo]);
  assert.equal(JSON.stringify(body).includes('slot-1'), false);
  assert.equal(JSON.stringify(body).includes('mimeType'), false);
});

test('normalized private references reach actual BytePlus payloads for every Seedance mode without internal metadata', async () => {
  const assets = new Map([
    ['start', { mediaKind: 'image' as const, storageUrl: imageStart, width: 1024, height: 576, mimeType: 'image/png' }],
    ['end', { mediaKind: 'image' as const, storageUrl: imageEnd, width: 1024, height: 576, mimeType: 'image/png' }],
    ['image-ref', { mediaKind: 'image' as const, storageUrl: imageRef, width: 1024, height: 576, mimeType: 'image/png' }],
    ['video-ref', { mediaKind: 'video' as const, storageUrl: videoRef, width: 1920, height: 1080, mimeType: 'video/mp4' }],
    ['audio-ref', { mediaKind: 'audio' as const, storageUrl: audioRef, width: null, height: null, mimeType: 'audio/wav' }],
    ['source', { mediaKind: 'video' as const, storageUrl: sourceVideo, width: 1920, height: 1080, mimeType: 'video/mp4' }],
    ['second', { mediaKind: 'video' as const, storageUrl: secondVideo, width: 1920, height: 1080, mimeType: 'video/mp4' }],
  ]);
  const asset = (assetId: string, role: CanonicalGenerationReference['role']) => ({
    kind: 'asset' as const,
    assetId,
    role,
  });
  const scenarios: Array<{
    mode: Extract<CanonicalGenerationMode, 't2v' | 'i2v' | 'ref2v' | 'v2v' | 'extend'>;
    references: CanonicalGenerationReference[];
    expectedMedia: Array<{ type: string; role: string; url: string }>;
  }> = [
    { mode: 't2v', references: [], expectedMedia: [] },
    {
      mode: 'i2v',
      references: [asset('start', 'first_frame'), asset('end', 'last_frame')],
      expectedMedia: [
        { type: 'image_url', role: 'first_frame', url: imageStart },
        { type: 'image_url', role: 'last_frame', url: imageEnd },
      ],
    },
    {
      mode: 'ref2v',
      references: [asset('image-ref', 'reference'), asset('video-ref', 'reference'), asset('audio-ref', 'reference')],
      expectedMedia: [
        { type: 'image_url', role: 'reference_image', url: imageRef },
        { type: 'video_url', role: 'reference_video', url: videoRef },
        { type: 'audio_url', role: 'reference_audio', url: audioRef },
      ],
    },
    {
      mode: 'v2v',
      references: [asset('source', 'source'), asset('image-ref', 'reference'), asset('audio-ref', 'reference')],
      expectedMedia: [
        { type: 'image_url', role: 'reference_image', url: imageRef },
        { type: 'video_url', role: 'reference_video', url: sourceVideo },
        { type: 'audio_url', role: 'reference_audio', url: audioRef },
      ],
    },
    {
      mode: 'extend',
      references: [asset('second', 'source'), asset('source', 'source'), asset('second', 'source')],
      expectedMedia: [
        { type: 'video_url', role: 'reference_video', url: secondVideo },
        { type: 'video_url', role: 'reference_video', url: sourceVideo },
        { type: 'video_url', role: 'reference_video', url: secondVideo },
      ],
    },
  ];

  for (const scenario of scenarios) {
    const request = canonicalRequest(scenario.mode, scenario.references);
    const resolved = await resolveGenerationReferences(request, {
      userId: 'seedance-integration-user',
      clientId: 'local-provider-harness',
      emailVerified: true,
      authMethod: 'oauth',
    }, {
      async resolveOwnedReferenceAsset(_principal, assetId) {
        const value = assets.get(assetId);
        assert.ok(value);
        return { assetId, ...value };
      },
    });
    const body = await projectedBody(request, [...resolved].reverse());
    const attachments = deriveGenerationAttachmentReferences({
      attachments: (body.inputs as Array<Record<string, unknown>>).map((entry) => ({
        name: 'mcp-reference',
        type: 'application/octet-stream',
        size: 0,
        kind: entry.kind as 'video' | 'audio',
        slotId: entry.slotId as string,
        url: entry.url as string,
      })),
      engineId: 'seedance-2-5',
      mode: scenario.mode,
      imageUrl: body.imageUrl,
      endImageUrl: body.endImageUrl as string | undefined,
      referenceImages: body.referenceImages,
      rawAudioUrl: null,
      inputSchema: engine.inputSchema,
      isBytePlusV1a: true,
    });
    const payload = buildBytePlusSeedancePayload({
      modelId: 'dreamina-seedance-2-5-260628',
      prompt: request.prompt,
      durationSec: 4,
      mode: scenario.mode,
      imageUrl: attachments.initialImageUrl,
      endImageUrl: body.endImageUrl as string | undefined,
      referenceImageUrls: attachments.normalizedReferenceImages,
      referenceVideoUrls: attachments.videoUrls,
      referenceAudioUrls: attachments.audioUrls,
      resolution: '480p',
      ratio: body.aspectRatio as string | undefined,
      generateAudio: true,
      allowedModes: ['t2v', 'i2v', 'ref2v', 'v2v', 'extend'],
      allowedAspectRatios: ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
      allowedResolutions: ['480p', '720p'],
      allowedDurationOptions: [4],
    });
    const media = payload.content.slice(1).map((item) => ({
      type: item.type,
      role: item.role,
      url: item.type === 'image_url'
        ? item.image_url.url
        : item.type === 'video_url'
          ? item.video_url.url
          : item.audio_url.url,
    }));
    assert.deepEqual(media, scenario.expectedMedia, scenario.mode);
    assert.doesNotMatch(
      JSON.stringify(payload),
      /assetId|storageUrl|mimeType|width|height|slotId|payment|membershipTier/u,
      scenario.mode,
    );
  }
});
