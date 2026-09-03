import assert from 'node:assert/strict';
import test from 'node:test';

import { getFalEngineById, listFalEngines } from '../frontend/src/config/falEngines';
import type { GenerateAttachment, GeneratePayload } from '../frontend/src/lib/fal-types';
import { buildFalGenerationRequest } from '../frontend/src/lib/fal-request-body';
import type { CanonicalGenerationRequest } from '../frontend/src/server/agent-api/generation-types';
import { buildPaidVideoRequestBody } from '../frontend/src/server/agent-api/paid-video-request-body';
import type { ResolvedReference } from '../frontend/src/server/agent-api/reference-types';

const prompt = 'Create one controlled cinematic transition.';
const startUrl = 'https://cdn.example.com/start.png';
const endUrl = 'https://cdn.example.com/end.png';
const imageUrl = 'https://cdn.example.com/reference.png';
const videoUrl = 'https://cdn.example.com/reference.mp4';
const audioUrl = 'https://cdn.example.com/reference.wav';

function attachment(kind: 'image' | 'video' | 'audio', slotId: string, url: string): GenerateAttachment {
  return {
    name: `${slotId}.${kind}`,
    type: `${kind}/*`,
    size: 1,
    kind,
    slotId,
    url,
  };
}

function siteRequest(
  payload: GeneratePayload,
  model: string,
  expectedBody: Record<string, unknown>,
): void {
  assert.deepEqual(buildFalGenerationRequest(payload, model), {
    model,
    requestBody: expectedBody,
  });
}

function paidRequest(params: {
  engineId: string;
  mode: CanonicalGenerationRequest['mode'];
  settings: CanonicalGenerationRequest['settings'];
  references: CanonicalGenerationRequest['references'];
  resolvedReferences?: readonly ResolvedReference[];
  expected: Record<string, unknown>;
}): void {
  const engine = getFalEngineById(params.engineId)?.engine;
  assert.ok(engine, params.engineId);
  const request: CanonicalGenerationRequest = {
    schemaVersion: 1,
    surface: 'video',
    engineId: params.engineId,
    mode: params.mode,
    prompt,
    settings: params.settings,
    references: params.references,
    outputCount: 1,
  };
  assert.deepEqual(buildPaidVideoRequestBody({
    quoteId: `quote-${params.engineId}-${params.mode}`,
    request,
    resolvedReferences: params.resolvedReferences,
    engine,
    canonicalPricing: { membershipTier: 'member' },
  }), params.expected);
}

function paidBase(
  engineId: string,
  mode: CanonicalGenerationRequest['mode'],
  settings: CanonicalGenerationRequest['settings'],
): Record<string, unknown> {
  return {
    engineId,
    mode,
    prompt,
    jobId: `quote-${engineId}-${mode}`,
    payment: { mode: 'wallet' },
    membershipTier: 'member',
    ...settings,
    inputs: [],
  };
}

test('Wan i2v uses schema-selected start/end fields in site and paid MCP bodies', () => {
  siteRequest({
    engineId: 'wan-3',
    mode: 'i2v',
    prompt,
    durationOption: 5,
    resolution: '720p',
    aspectRatio: 'auto',
    audio: true,
    imageUrl: startUrl,
    endImageUrl: endUrl,
  }, 'alibaba/wan-3.0/image-to-video', {
    prompt,
    duration: 5,
    resolution: '720p',
    aspect_ratio: 'adaptive',
    audio: true,
    start_image_url: startUrl,
    end_image_url: endUrl,
  });

  const settings = { durationSec: 5, resolution: '720p', aspectRatio: 'auto', audio: true };
  paidRequest({
    engineId: 'wan-3',
    mode: 'i2v',
    settings,
    references: [
      { kind: 'https', url: startUrl, role: 'source', mediaKind: 'image' },
      { kind: 'https', url: endUrl, role: 'last_frame', mediaKind: 'image' },
    ],
    expected: {
      ...paidBase('wan-3', 'i2v', settings),
      imageUrl: startUrl,
      endImageUrl: endUrl,
      inputs: [
        { kind: 'image', slotId: 'start_image_url', url: startUrl },
        { kind: 'image', slotId: 'end_image_url', url: endUrl },
      ],
    },
  });
});

test('Wan ref2v preserves typed provider arrays in site and paid MCP bodies', () => {
  const inputs = [
    attachment('image', 'reference_image_urls', imageUrl),
    attachment('video', 'reference_video_urls', videoUrl),
    attachment('audio', 'reference_audio_urls', audioUrl),
  ];
  siteRequest({
    engineId: 'wan-3-prime',
    mode: 'ref2v',
    prompt,
    durationOption: 5,
    resolution: '720p',
    aspectRatio: 'auto',
    audio: true,
    inputs,
  }, 'alibaba/wan-3.0-prime/reference-to-video', {
    prompt,
    duration: 5,
    resolution: '720p',
    aspect_ratio: 'adaptive',
    audio: true,
    reference_image_urls: [imageUrl],
    reference_video_urls: [videoUrl],
    reference_audio_urls: [audioUrl],
  });

  const settings = { durationSec: 5, resolution: '720p', aspectRatio: 'auto', audio: true };
  paidRequest({
    engineId: 'wan-3-prime',
    mode: 'ref2v',
    settings,
    references: [
      { kind: 'https', url: imageUrl, role: 'reference', mediaKind: 'image' },
      { kind: 'https', url: videoUrl, role: 'reference', mediaKind: 'video' },
      { kind: 'https', url: audioUrl, role: 'reference', mediaKind: 'audio' },
    ],
    expected: {
      ...paidBase('wan-3-prime', 'ref2v', settings),
      referenceImages: [imageUrl],
      referenceVideos: [videoUrl],
      referenceAudio: [audioUrl],
      inputs: [
        { kind: 'image', slotId: 'reference_image_urls', url: imageUrl },
        { kind: 'video', slotId: 'reference_video_urls', url: videoUrl },
        { kind: 'audio', slotId: 'reference_audio_urls', url: audioUrl },
      ],
    },
  });
});

test('Wan ref2v preserves validated document and web references in exact Fal bodies', () => {
  for (const field of ['file_url', 'web_url'] as const) {
    siteRequest({
      engineId: 'wan-3',
      mode: 'ref2v',
      prompt,
      durationOption: 5,
      resolution: '720p',
      aspectRatio: 'auto',
      audio: true,
      extraInputValues: {
        [field]: `https://example.com/${field === 'file_url' ? 'reference.pdf' : 'reference'}`,
        enable_thinking: true,
      },
    }, 'alibaba/wan-3.0/reference-to-video', {
      prompt,
      duration: 5,
      resolution: '720p',
      aspect_ratio: 'adaptive',
      audio: true,
      [field]: `https://example.com/${field === 'file_url' ? 'reference.pdf' : 'reference'}`,
      enable_thinking: true,
    });
  }
});

test('LTX a2v sends source audio and optional image without output controls or audio toggle', () => {
  siteRequest({
    engineId: 'ltx-2-5-fast',
    mode: 'a2v',
    prompt,
    durationSec: 8,
    resolution: '1080p',
    aspectRatio: 'auto',
    audio: true,
    audioUrl,
    imageUrl: startUrl,
  }, 'lightricks/ltx-2.5/audio-to-video/fast', {
    prompt,
    aspect_ratio: 'auto',
    audio_url: audioUrl,
    image_url: startUrl,
  });

  const assetId = 'ma_audioaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const settings = { durationSec: 8, resolution: '1080p', aspectRatio: 'auto' };
  paidRequest({
    engineId: 'ltx-2-5-fast',
    mode: 'a2v',
    settings,
    references: [
      { kind: 'asset', assetId, role: 'source' },
      { kind: 'https', url: startUrl, role: 'first_frame', mediaKind: 'image' },
    ],
    resolvedReferences: [{
      assetId,
      role: 'source',
      mediaKind: 'audio',
      storageUrl: audioUrl,
      width: null,
      height: null,
      durationSec: 7.8,
      mimeType: 'audio/wav',
    }],
    expected: {
      ...paidBase('ltx-2-5-fast', 'a2v', settings),
      audioUrl,
      imageUrl: startUrl,
      inputs: [
        { assetId, kind: 'audio', slotId: 'audio_url', url: audioUrl, durationSec: 7.8, type: 'audio/wav' },
        { kind: 'image', slotId: 'image_url', url: startUrl },
      ],
    },
  });
});

test('LTX Fast maps canonical 4k to provider 2160p only in the site Fal body', () => {
  siteRequest({
    engineId: 'ltx-2-5-fast', mode: 'i2v', prompt,
    durationOption: 6, resolution: '4k', aspectRatio: '16:9', audio: true,
    imageUrl: startUrl,
  }, 'lightricks/ltx-2.5/image-to-video/fast', {
    prompt,
    duration: 6,
    resolution: '2160p',
    aspect_ratio: '16:9',
    generate_audio: true,
    image_url: startUrl,
  });

  const settings = { durationSec: 6, resolution: '4k', aspectRatio: '16:9', audio: true };
  paidRequest({
    engineId: 'ltx-2-5-fast', mode: 'i2v', settings,
    references: [{ kind: 'https', url: startUrl, role: 'source', mediaKind: 'image' }],
    expected: {
      ...paidBase('ltx-2-5-fast', 'i2v', settings),
      imageUrl: startUrl,
      inputs: [{ kind: 'image', slotId: 'image_url', url: startUrl }],
    },
  });
});

test('Grok ref2v uses reference_image_urls and no generic or audio fields', () => {
  siteRequest({
    engineId: 'grok-imagine-video-1-5',
    mode: 'ref2v',
    prompt,
    durationSec: 8,
    resolution: '480p',
    aspectRatio: '16:9',
    audio: false,
    referenceImages: [imageUrl],
  }, 'xai/grok-imagine-video/v1.5/reference-to-video', {
    prompt,
    duration: 8,
    resolution: '480p',
    aspect_ratio: '16:9',
    reference_image_urls: [imageUrl],
  });

  const settings = { durationSec: 8, resolution: '480p', aspectRatio: '16:9' };
  paidRequest({
    engineId: 'grok-imagine-video-1-5',
    mode: 'ref2v',
    settings,
    references: [{ kind: 'https', url: imageUrl, role: 'reference', mediaKind: 'image' }],
    expected: {
      ...paidBase('grok-imagine-video-1-5', 'ref2v', settings),
      referenceImages: [imageUrl],
      inputs: [{ kind: 'image', slotId: 'reference_image_urls', url: imageUrl }],
    },
  });
});

test('FLUX fl2v uses start/end provider fields in site and paid MCP bodies', () => {
  siteRequest({
    engineId: 'flux-3',
    mode: 'fl2v',
    prompt,
    durationSec: 5,
    resolution: '720p',
    aspectRatio: '2:1',
    audio: true,
    imageUrl: startUrl,
    endImageUrl: endUrl,
  }, 'blackforestlabs/flux-3/first-last-frame-to-video', {
    prompt,
    duration: 5,
    resolution: '720p',
    aspect_ratio: '2:1',
    generate_audio: true,
    start_image_url: startUrl,
    end_image_url: endUrl,
  });

  const settings = { durationSec: 5, resolution: '720p', aspectRatio: '2:1', audio: true };
  paidRequest({
    engineId: 'flux-3',
    mode: 'fl2v',
    settings,
    references: [
      { kind: 'https', url: startUrl, role: 'first_frame', mediaKind: 'image' },
      { kind: 'https', url: endUrl, role: 'last_frame', mediaKind: 'image' },
    ],
    expected: {
      ...paidBase('flux-3', 'fl2v', settings),
      imageUrl: startUrl,
      endImageUrl: endUrl,
      inputs: [
        { kind: 'image', slotId: 'start_image_url', url: startUrl },
        { kind: 'image', slotId: 'end_image_url', url: endUrl },
      ],
    },
  });
});

test('FLUX extend keeps one video_url and Draft omits its locked resolution field', () => {
  siteRequest({
    engineId: 'flux-3-draft',
    mode: 'extend',
    prompt,
    durationSec: 5,
    resolution: '720p',
    aspectRatio: '2:1',
    audio: true,
    inputs: [attachment('video', 'video_url', videoUrl)],
  }, 'blackforestlabs/flux-3/extend-video/draft', {
    prompt,
    duration: 5,
    aspect_ratio: '2:1',
    generate_audio: true,
    video_url: videoUrl,
  });

  const settings = { durationSec: 5, resolution: '720p', aspectRatio: '2:1', audio: true };
  paidRequest({
    engineId: 'flux-3-draft',
    mode: 'extend',
    settings,
    references: [{ kind: 'https', url: videoUrl, role: 'source', mediaKind: 'video' }],
    expected: {
      ...paidBase('flux-3-draft', 'extend', settings),
      videoUrl,
      inputs: [{ kind: 'video', slotId: 'video_url', url: videoUrl }],
    },
  });
});

test('paid MCP provider slots are selected from each active P0 schema', () => {
  const wanSettings = { durationSec: 5, resolution: '720p', aspectRatio: 'auto', audio: true };
  paidRequest({
    engineId: 'wan-3',
    mode: 'i2v',
    settings: wanSettings,
    references: [{ kind: 'https', url: startUrl, role: 'source', mediaKind: 'image' }],
    expected: {
      ...paidBase('wan-3', 'i2v', wanSettings),
      imageUrl: startUrl,
      inputs: [{ kind: 'image', slotId: 'start_image_url', url: startUrl }],
    },
  });

  const grokSettings = { durationSec: 8, resolution: '480p', aspectRatio: '16:9' };
  paidRequest({
    engineId: 'grok-imagine-video-1-5',
    mode: 'ref2v',
    settings: grokSettings,
    references: [{ kind: 'https', url: imageUrl, role: 'reference', mediaKind: 'image' }],
    expected: {
      ...paidBase('grok-imagine-video-1-5', 'ref2v', grokSettings),
      referenceImages: [imageUrl],
      inputs: [{ kind: 'image', slotId: 'reference_image_urls', url: imageUrl }],
    },
  });
});

test('all 23 P0 engine modes have exact whole site and paid MCP request bodies', () => {
  const p0Ids = new Set([
    'wan-3', 'wan-3-prime', 'ltx-2-5-fast', 'ltx-2-5-pro',
    'grok-imagine-video-1-5', 'flux-3', 'flux-3-draft',
  ]);
  const cases = listFalEngines()
    .filter((entry) => p0Ids.has(entry.id))
    .flatMap((entry) => entry.modes.map(({ mode, falModelId }) => ({ entry, mode, falModelId })));
  assert.equal(cases.length, 23);

  for (const { entry, mode, falModelId } of cases) {
    const isWan = entry.id === 'wan-3' || entry.id === 'wan-3-prime';
    const isLtx = entry.id === 'ltx-2-5-fast' || entry.id === 'ltx-2-5-pro';
    const isGrok = entry.id === 'grok-imagine-video-1-5';
    const isFlux = entry.id === 'flux-3' || entry.id === 'flux-3-draft';
    assert.equal(isWan || isLtx || isGrok || isFlux, true, entry.id);

    const settings: CanonicalGenerationRequest['settings'] = isWan
      ? { durationSec: 5, resolution: '720p', aspectRatio: 'auto', audio: true }
      : isLtx
        ? mode === 'a2v'
          ? { durationSec: 8, resolution: '1080p', aspectRatio: 'auto' }
          : { durationSec: 6, resolution: '1080p', aspectRatio: mode === 't2v' ? '16:9' : 'auto', audio: true }
        : isGrok
          ? mode === 'ref2v'
            ? { durationSec: 8, resolution: '480p', aspectRatio: '16:9' }
            : mode === 'i2v'
              ? { durationSec: 6, resolution: '720p' }
              : { durationSec: 6, resolution: '720p', aspectRatio: '16:9' }
          : { durationSec: 5, resolution: '720p', aspectRatio: '2:1', audio: true };

    const references: CanonicalGenerationRequest['references'] = [];
    const resolvedReferences: ResolvedReference[] = [];
    const payload: GeneratePayload = {
      engineId: entry.id,
      mode,
      prompt,
      durationSec: settings.durationSec as number,
      resolution: settings.resolution as string,
      aspectRatio: settings.aspectRatio as string | undefined,
      audio: settings.audio as boolean | undefined,
    };
    const expectedSite: Record<string, unknown> = { prompt };
    const expectedPaid: Record<string, unknown> = paidBase(entry.id, mode, settings);

    if (isWan) {
      Object.assign(expectedSite, {
        duration: 5, resolution: '720p', aspect_ratio: 'adaptive', audio: true,
      });
      if (mode === 'i2v') {
        payload.imageUrl = startUrl;
        payload.endImageUrl = endUrl;
        Object.assign(expectedSite, { start_image_url: startUrl, end_image_url: endUrl });
        references.push(
          { kind: 'https', url: startUrl, role: 'source', mediaKind: 'image' },
          { kind: 'https', url: endUrl, role: 'last_frame', mediaKind: 'image' },
        );
        Object.assign(expectedPaid, {
          imageUrl: startUrl,
          endImageUrl: endUrl,
          inputs: [
            { kind: 'image', slotId: 'start_image_url', url: startUrl },
            { kind: 'image', slotId: 'end_image_url', url: endUrl },
          ],
        });
      } else if (mode === 'ref2v') {
        payload.inputs = [attachment('image', 'reference_image_urls', imageUrl)];
        expectedSite.reference_image_urls = [imageUrl];
        references.push({ kind: 'https', url: imageUrl, role: 'reference', mediaKind: 'image' });
        Object.assign(expectedPaid, {
          referenceImages: [imageUrl],
          inputs: [{ kind: 'image', slotId: 'reference_image_urls', url: imageUrl }],
        });
      }
    } else if (isLtx) {
      if (mode === 'a2v') {
        payload.aspectRatio = 'auto';
        payload.audioUrl = audioUrl;
        Object.assign(expectedSite, { aspect_ratio: 'auto', audio_url: audioUrl });
        const assetId = `ma_${entry.id.replace(/[^a-z0-9]/g, '')}aaaaaaaaaaaaaaaaaaaa`;
        references.push({ kind: 'asset', assetId, role: 'source' });
        resolvedReferences.push({
          assetId, role: 'source', mediaKind: 'audio', storageUrl: audioUrl,
          width: null, height: null, durationSec: 8, mimeType: 'audio/wav',
        });
        Object.assign(expectedPaid, {
          audioUrl,
          inputs: [{ assetId, kind: 'audio', slotId: 'audio_url', url: audioUrl, durationSec: 8, type: 'audio/wav' }],
        });
      } else {
        payload.durationSec = undefined;
        payload.durationOption = 6;
        Object.assign(expectedSite, {
          duration: 6, resolution: '1080p',
          aspect_ratio: mode === 't2v' ? '16:9' : 'auto', generate_audio: true,
        });
        if (mode === 'i2v') {
          payload.imageUrl = startUrl;
          expectedSite.image_url = startUrl;
          references.push({ kind: 'https', url: startUrl, role: 'source', mediaKind: 'image' });
          Object.assign(expectedPaid, {
            imageUrl: startUrl,
            inputs: [{ kind: 'image', slotId: 'image_url', url: startUrl }],
          });
        }
      }
    } else if (isGrok) {
      Object.assign(expectedSite, {
        duration: mode === 'ref2v' ? 8 : 6,
        resolution: mode === 'ref2v' ? '480p' : '720p',
        ...(mode === 'i2v' ? {} : { aspect_ratio: '16:9' }),
      });
      if (mode === 'i2v') {
        payload.imageUrl = startUrl;
        expectedSite.image_url = startUrl;
        references.push({ kind: 'https', url: startUrl, role: 'source', mediaKind: 'image' });
        Object.assign(expectedPaid, {
          imageUrl: startUrl,
          inputs: [{ kind: 'image', slotId: 'image_url', url: startUrl }],
        });
      } else if (mode === 'ref2v') {
        payload.referenceImages = [imageUrl];
        expectedSite.reference_image_urls = [imageUrl];
        references.push({ kind: 'https', url: imageUrl, role: 'reference', mediaKind: 'image' });
        Object.assign(expectedPaid, {
          referenceImages: [imageUrl],
          inputs: [{ kind: 'image', slotId: 'reference_image_urls', url: imageUrl }],
        });
      }
    } else {
      Object.assign(expectedSite, {
        duration: 5,
        ...(entry.id === 'flux-3' ? { resolution: '720p' } : {}),
        aspect_ratio: '2:1', generate_audio: true,
      });
      if (mode === 'i2v') {
        payload.imageUrl = startUrl;
        expectedSite.image_url = startUrl;
        references.push({ kind: 'https', url: startUrl, role: 'source', mediaKind: 'image' });
        Object.assign(expectedPaid, {
          imageUrl: startUrl,
          inputs: [{ kind: 'image', slotId: 'image_url', url: startUrl }],
        });
      } else if (mode === 'fl2v') {
        payload.imageUrl = startUrl;
        payload.endImageUrl = endUrl;
        Object.assign(expectedSite, { start_image_url: startUrl, end_image_url: endUrl });
        references.push(
          { kind: 'https', url: startUrl, role: 'first_frame', mediaKind: 'image' },
          { kind: 'https', url: endUrl, role: 'last_frame', mediaKind: 'image' },
        );
        Object.assign(expectedPaid, {
          imageUrl: startUrl,
          endImageUrl: endUrl,
          inputs: [
            { kind: 'image', slotId: 'start_image_url', url: startUrl },
            { kind: 'image', slotId: 'end_image_url', url: endUrl },
          ],
        });
      } else if (mode === 'extend') {
        payload.inputs = [attachment('video', 'video_url', videoUrl)];
        expectedSite.video_url = videoUrl;
        references.push({ kind: 'https', url: videoUrl, role: 'source', mediaKind: 'video' });
        Object.assign(expectedPaid, {
          videoUrl,
          inputs: [{ kind: 'video', slotId: 'video_url', url: videoUrl }],
        });
      }
    }

    assert.deepEqual(
      buildFalGenerationRequest(payload, falModelId),
      { model: falModelId, requestBody: expectedSite },
      `${entry.id}:${mode}:site`,
    );
    const request: CanonicalGenerationRequest = {
      schemaVersion: 1, surface: 'video', engineId: entry.id, mode,
      prompt, settings, references, outputCount: 1,
    };
    assert.deepEqual(buildPaidVideoRequestBody({
      quoteId: `quote-${entry.id}-${mode}`,
      request,
      resolvedReferences,
      engine: entry.engine,
      canonicalPricing: { membershipTier: 'member' },
    }), expectedPaid, `${entry.id}:${mode}:paid`);
  }
});
