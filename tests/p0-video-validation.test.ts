import assert from 'node:assert/strict';
import test from 'node:test';

import { validateModeMediaInputs } from '../frontend/app/api/generate/_lib/validate-media-inputs';
import { buildGenerateValidationPayload } from '../frontend/app/api/generate/_lib/validation-payload';
import { validateExtraInputValues } from '../frontend/app/api/generate/_lib/extra-input-values';
import { validateRequest } from '../frontend/app/api/generate/_lib/validate';
import { listFalEngines } from '../frontend/src/config/falEngines';
import {
  GenerationCapabilityError,
  validateCanonicalGenerationCapabilities,
} from '../frontend/src/server/agent-api/generation-capability-validation';
import type { CanonicalGenerationRequest } from '../frontend/src/server/agent-api/generation-types';
import type { AgentPublicGenerationEngine } from '../frontend/src/server/agent-api/model-catalog';
import { toCanonicalGenerationMode } from '../frontend/src/server/agent-api/generation-mode-aliases';

function candidate(engineId: string): AgentPublicGenerationEngine {
  const entry = listFalEngines().find((item) => item.id === engineId);
  assert.ok(entry);
  return {
    engine: entry.engine,
    surface: 'video',
    publicModes: entry.modes.flatMap(({ mode }) => {
      const canonical = toCanonicalGenerationMode(entry.id, 'video', mode);
      return canonical ? [canonical] : [];
    }),
    modeCaps: Object.fromEntries(entry.modes.flatMap(({ mode, ui }) => {
      const canonical = toCanonicalGenerationMode(entry.id, 'video', mode);
      return canonical ? [[canonical, ui]] : [];
    })),
  };
}

function request(
  engineId: string,
  mode: CanonicalGenerationRequest['mode'],
  overrides: Partial<CanonicalGenerationRequest> = {},
): CanonicalGenerationRequest {
  return {
    schemaVersion: 1,
    surface: 'video',
    engineId,
    mode,
    prompt: 'Create one controlled cinematic transition.',
    settings: { durationSec: 5, resolution: '720p', aspectRatio: '16:9' },
    references: [],
    outputCount: 1,
    ...overrides,
  };
}

function expectCapabilityFailure(
  value: CanonicalGenerationRequest,
  field: string,
  options: Parameters<typeof validateCanonicalGenerationCapabilities>[2] = {},
): void {
  assert.throws(
    () => validateCanonicalGenerationCapabilities(value, candidate(value.engineId), options),
    (error) => error instanceof GenerationCapabilityError && error.field === field,
  );
}

test('Wan ref2v requires any supported reference, including video-only or audio-only', () => {
  const base = request('wan-3', 'ref2v', {
    settings: { durationSec: 5, resolution: '720p', aspectRatio: 'auto', audio: true },
  });
  expectCapabilityFailure(base, 'references');
  for (const mediaKind of ['video', 'audio'] as const) {
    assert.doesNotThrow(() => validateCanonicalGenerationCapabilities({
      ...base,
      references: [{
        kind: 'https',
        url: `https://cdn.example.com/reference.${mediaKind === 'video' ? 'mp4' : 'wav'}`,
        role: 'reference',
        mediaKind,
      }],
    }, candidate('wan-3')));
  }
});

test('site validation uses Wan provider field names and accepts audio-only references', () => {
  const schema = candidate('wan-3').engine.inputSchema;
  assert.deepEqual(validateModeMediaInputs({
    engineId: 'wan-3', normalizedMode: 'ref2v', inputSchema: schema,
    payload: { reference_audio_urls: ['https://cdn.example.com/reference.wav'] },
    referenceValuesByField: { reference_audio_urls: ['https://cdn.example.com/reference.wav'] },
  }), { ok: true });
  assert.equal(validateModeMediaInputs({
    engineId: 'wan-3', normalizedMode: 'ref2v', inputSchema: schema,
    payload: {}, referenceValuesByField: {},
  }).ok, false);
});

test('Wan file and web references require thinking and remain mutually exclusive', () => {
  const schema = candidate('wan-3').engine.inputSchema;
  const context = { inputSchema: schema, referenceValuesByField: {} };
  assert.equal(validateRequest('wan-3', 'ref2v', {
    prompt: 'P', duration: 5, resolution: '720p', aspect_ratio: 'auto', audio: true,
    file_url: 'https://cdn.example.com/reference.pdf', enable_thinking: false,
  }, context).ok, false);
  assert.equal(validateRequest('wan-3', 'ref2v', {
    prompt: 'P', duration: 5, resolution: '720p', aspect_ratio: 'auto', audio: true,
    file_url: 'https://cdn.example.com/reference.pdf', enable_thinking: true,
    web_url: 'https://example.com/reference',
  }, context).ok, false);
  for (const field of ['file_url', 'web_url'] as const) {
    assert.deepEqual(validateRequest('wan-3', 'ref2v', {
      prompt: 'P', duration: 5, resolution: '720p', aspect_ratio: 'auto', audio: true,
      [field]: 'https://example.com/reference', enable_thinking: true,
    }, context), { ok: true });
  }
});

test('site generation pipeline validates and preserves schema-active Wan document and web references', () => {
  const engine = candidate('wan-3').engine;
  const base = {
    engineId: engine.id, mode: 'ref2v' as const, prompt: 'P', multiPrompt: null,
    supportsResolution: true, effectiveResolution: '720p', supportsAspectRatio: true,
    aspectRatio: '16:9', audioEnabled: true, isBytePlusV1a: false,
    supportsDuration: true, supportsFps: false, fps: undefined, numFrames: null,
    validationDuration: 5, maxUploadedBytes: 0, resolvedFirstFrameUrl: null,
    lastFrameUrl: null, normalizedReferenceImages: [] as string[], videoUrls: [] as string[],
    audioUrls: [] as string[], resolvedAudioUrl: null, sourceInputVideoUrl: null,
    elements: null, endImageUrl: null, startImageUrl: null, isLumaRay2: false,
    initialImageUrl: null, inputSchema: engine.inputSchema, referenceValuesByField: {},
    referenceMediaItems: [], referenceProvenanceIssues: [],
  };
  for (const field of ['file_url', 'web_url'] as const) {
    const extra = validateExtraInputValues({
      engine,
      mode: 'ref2v',
      rawExtraInputValues: { [field]: 'https://example.com/reference', enable_thinking: true },
    });
    assert.equal(extra.ok, true);
    if (!extra.ok) continue;
    const result = buildGenerateValidationPayload({ ...base, validatedExtraInputValues: extra.values });
    assert.equal(result.ok, true, `${field}: ${JSON.stringify(result)}`);
    if (result.ok) {
      assert.equal(result.payload[field], 'https://example.com/reference');
      assert.equal(result.payload.enable_thinking, true);
    }
  }

  for (const rawExtraInputValues of [
    { file_url: 'https://example.com/reference.pdf', enable_thinking: false },
    { web_url: 'https://example.com/reference', enable_thinking: false },
    {
      file_url: 'https://example.com/reference.pdf',
      web_url: 'https://example.com/reference',
      enable_thinking: true,
    },
  ]) {
    const extra = validateExtraInputValues({ engine, mode: 'ref2v', rawExtraInputValues });
    assert.equal(extra.ok, true);
    if (!extra.ok) continue;
    assert.equal(buildGenerateValidationPayload({
      ...base,
      validatedExtraInputValues: extra.values,
    }).ok, false);
  }
});

test('LTX Fast enforces schema duration ceilings for high fps and high resolution on site and MCP', () => {
  const fast = candidate('ltx-2-5-fast');
  const fastSchema = fast.engine.inputSchema;
  const site = (duration: number, resolution: string, fps: number) => buildGenerateValidationPayload({
    engineId: fast.engine.id, mode: 't2v', prompt: 'P', multiPrompt: null,
    supportsResolution: true, effectiveResolution: resolution, supportsAspectRatio: true,
    aspectRatio: '16:9', audioEnabled: true, isBytePlusV1a: false,
    supportsDuration: true, supportsFps: true, fps, numFrames: null,
    validationDuration: duration, maxUploadedBytes: 0, resolvedFirstFrameUrl: null,
    lastFrameUrl: null, normalizedReferenceImages: [], videoUrls: [], audioUrls: [],
    resolvedAudioUrl: null, sourceInputVideoUrl: null, elements: null, endImageUrl: null,
    startImageUrl: null, isLumaRay2: false, initialImageUrl: null, inputSchema: fastSchema,
    referenceValuesByField: {}, referenceMediaItems: [], referenceProvenanceIssues: [],
  });
  assert.equal(site(20, '1080p', 50).ok, false);
  assert.equal(site(20, '4k', 25).ok, false);
  assert.equal(site(10, '1080p', 50).ok, true);
  assert.equal(site(10, '4k', 25).ok, true);

  const mcp = (durationSec: number, resolution: string, fps: number) => request('ltx-2-5-fast', 't2v', {
    settings: { durationSec, resolution, aspectRatio: '16:9', fps, audio: true },
  });
  expectCapabilityFailure(mcp(20, '1080p', 50), 'durationSec');
  expectCapabilityFailure(mcp(20, '4k', 25), 'durationSec');
  assert.doesNotThrow(() => validateCanonicalGenerationCapabilities(mcp(10, '1080p', 50), fast));
  assert.doesNotThrow(() => validateCanonicalGenerationCapabilities(mcp(10, '4k', 25), fast));
});

test('LTX Pro rejects canonical 4k on site and MCP', () => {
  const pro = candidate('ltx-2-5-pro');
  const site = buildGenerateValidationPayload({
    engineId: pro.engine.id, mode: 't2v', prompt: 'P', multiPrompt: null,
    supportsResolution: true, effectiveResolution: '4k', supportsAspectRatio: true,
    aspectRatio: '16:9', audioEnabled: true, isBytePlusV1a: false,
    supportsDuration: true, supportsFps: true, fps: 25, numFrames: null,
    validationDuration: 6, maxUploadedBytes: 0, resolvedFirstFrameUrl: null,
    lastFrameUrl: null, normalizedReferenceImages: [], videoUrls: [], audioUrls: [],
    resolvedAudioUrl: null, sourceInputVideoUrl: null, elements: null, endImageUrl: null,
    startImageUrl: null, isLumaRay2: false, initialImageUrl: null,
    inputSchema: pro.engine.inputSchema, referenceValuesByField: {}, referenceMediaItems: [],
    referenceProvenanceIssues: [],
  });
  assert.equal(site.ok, false);
  expectCapabilityFailure(request('ltx-2-5-pro', 't2v', {
    settings: { durationSec: 6, resolution: '4k', aspectRatio: '16:9', fps: 25, audio: true },
  }), 'resolution');
});

test('site validation payload projects Wan and FLUX exact media field names', () => {
  const base = {
    prompt: 'Create one controlled cinematic transition.', multiPrompt: null,
    supportsResolution: true, effectiveResolution: '720p', supportsAspectRatio: true,
    aspectRatio: '16:9', audioEnabled: true, isBytePlusV1a: false,
    supportsDuration: true, numFrames: null, validationDuration: 5,
    maxUploadedBytes: 0, normalizedReferenceImages: [] as string[],
    videoUrls: [] as string[], audioUrls: [] as string[], resolvedAudioUrl: null,
    sourceInputVideoUrl: null, elements: null, endImageUrl: null, startImageUrl: null,
    isLumaRay2: false, initialImageUrl: null, referenceValuesByField: {},
    referenceMediaItems: [], referenceProvenanceIssues: [],
  };
  const wanSchema = candidate('wan-3').engine.inputSchema;
  const wanI2v = buildGenerateValidationPayload({
    ...base, engineId: 'wan-3', mode: 'i2v', inputSchema: wanSchema,
    initialImageUrl: 'https://cdn.example.com/start.png',
    resolvedFirstFrameUrl: null, lastFrameUrl: null,
  });
  assert.equal(wanI2v.ok, true);
  if (wanI2v.ok) {
    assert.equal(wanI2v.payload.start_image_url, 'https://cdn.example.com/start.png');
    assert.equal('image_url' in wanI2v.payload, false);
  }
  const wan = buildGenerateValidationPayload({
    ...base, engineId: 'wan-3', mode: 'ref2v', inputSchema: wanSchema,
    resolvedFirstFrameUrl: null, lastFrameUrl: null,
    audioUrls: ['https://cdn.example.com/reference.wav'],
    referenceValuesByField: { reference_audio_urls: ['https://cdn.example.com/reference.wav'] },
  });
  assert.equal(wan.ok, true);
  if (wan.ok) assert.deepEqual(wan.payload.reference_audio_urls, ['https://cdn.example.com/reference.wav']);

  const fluxSchema = candidate('flux-3').engine.inputSchema;
  const flux = buildGenerateValidationPayload({
    ...base, engineId: 'flux-3', mode: 'fl2v', inputSchema: fluxSchema,
    resolvedFirstFrameUrl: 'https://cdn.example.com/start.png',
    lastFrameUrl: 'https://cdn.example.com/end.png',
  });
  assert.equal(flux.ok, true);
  if (flux.ok) {
    assert.equal(flux.payload.start_image_url, 'https://cdn.example.com/start.png');
    assert.equal(flux.payload.end_image_url, 'https://cdn.example.com/end.png');
    assert.equal('first_frame_url' in flux.payload, false);
    assert.equal('last_frame_url' in flux.payload, false);
  }
});

test('LTX 2.5 a2v requires private audio with trusted duration bounds', () => {
  const assetId = 'ma_audioaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const base = request('ltx-2-5-fast', 'a2v', {
    settings: { durationSec: 8, resolution: '1080p', aspectRatio: 'auto' },
    references: [{ kind: 'asset', assetId, role: 'source' }],
  });
  expectCapabilityFailure({
    ...base,
    references: [{ kind: 'https', url: 'https://cdn.example.com/audio.wav', role: 'source', mediaKind: 'audio' }],
  }, 'references');
  for (const durationSec of [1.9, 20.1]) {
    expectCapabilityFailure(base, 'references', { resolvedReferences: [{
      assetId, role: 'source', mediaKind: 'audio', storageUrl: 'https://cdn.example.com/audio.wav',
      width: null, height: null, durationSec, mimeType: 'audio/wav',
    }] });
  }
  const resolved = { resolvedReferences: [{
    assetId, role: 'source' as const, mediaKind: 'audio' as const,
    storageUrl: 'https://cdn.example.com/audio.wav', width: null, height: null,
    durationSec: 8, mimeType: 'audio/wav',
  }] };
  expectCapabilityFailure({ ...base, prompt: '' }, 'prompt', resolved);
  assert.doesNotThrow(() => validateCanonicalGenerationCapabilities({
    ...base,
    prompt: '',
    references: [
      ...base.references,
      { kind: 'https', url: 'https://cdn.example.com/frame.png', role: 'first_frame', mediaKind: 'image' },
    ],
  }, candidate('ltx-2-5-fast'), resolved));
});

test('Grok rejects unsupported reference media and output extras', () => {
  const grok = request('grok-imagine-video-1-5', 'ref2v', {
    settings: { durationSec: 8, resolution: '480p', aspectRatio: '16:9', audio: false },
    references: [{ kind: 'https', url: 'https://cdn.example.com/reference.wav', role: 'reference', mediaKind: 'audio' }],
  });
  expectCapabilityFailure(grok, 'audio');
  expectCapabilityFailure({ ...grok, settings: { ...grok.settings, audio: undefined } }, 'references');
});

test('FLUX accepts exact 2:1 fl2v slots and Draft rejects an exposed resolution control', () => {
  const flux = request('flux-3', 'fl2v', {
    settings: { durationSec: 5, resolution: '720p', aspectRatio: '2:1', audio: true },
    references: [
      { kind: 'https', url: 'https://cdn.example.com/start.png', role: 'first_frame', mediaKind: 'image' },
      { kind: 'https', url: 'https://cdn.example.com/end.png', role: 'last_frame', mediaKind: 'image' },
    ],
  });
  assert.doesNotThrow(() => validateCanonicalGenerationCapabilities(flux, candidate('flux-3')));

  expectCapabilityFailure(request('flux-3-draft', 'extend', {
    settings: { durationSec: 5, resolution: '1080p', aspectRatio: '16:9', audio: true },
    references: [{ kind: 'https', url: 'https://cdn.example.com/source.mp4', role: 'source', mediaKind: 'video' }],
  }), 'resolution');

  const assetId = 'ma_videoaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const extend = request('flux-3', 'extend', {
    settings: { durationSec: 5, resolution: '720p', aspectRatio: '16:9', audio: true },
    references: [{ kind: 'asset', assetId, role: 'source' }],
  });
  expectCapabilityFailure(extend, 'references', { resolvedReferences: [{
    assetId, role: 'source', mediaKind: 'video', storageUrl: 'https://cdn.example.com/source.mp4',
    width: 1280, height: 720, durationSec: 15, mimeType: 'video/mp4',
  }] });
});
