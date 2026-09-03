import assert from 'node:assert/strict';
import test from 'node:test';

import { buildFalRequestParts } from '../frontend/app/api/generate/_lib/fal-request';
import { buildGenerateRequestOptions } from '../frontend/app/api/generate/_lib/request-options';
import { validateRequest } from '../frontend/app/api/generate/_lib/validate';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { KLING_3_TURBO_PRO_ENGINE } from '../frontend/src/config/fal-engines/kling-3-turbo-pro';
import { KLING_3_TURBO_STANDARD_ENGINE } from '../frontend/src/config/fal-engines/kling-3-turbo-standard';
import { buildFalGenerationRequest } from '../frontend/src/lib/fal-request-body';
import {
  resolveEngineMediaFieldConstraint,
  validateMediaFileAgainstConstraint,
} from '../frontend/lib/media-field-constraints';
import type { EngineCaps, EngineInputField, Mode } from '../frontend/types/engines';

function mediaField(engine: EngineCaps, type: 'image' | 'video' | 'audio'): EngineInputField {
  const field = [...(engine.inputSchema?.required ?? []), ...(engine.inputSchema?.optional ?? [])]
    .find((candidate) => candidate.type === type);
  assert.ok(field, `${engine.id} should declare a ${type} field`);
  return field;
}

test('engine-level media formats retain their concrete MIME mappings across image, video, and audio engines', () => {
  const cases = [
    ['pika-text-to-video', 'image', 'frame.gif', 'image/gif'],
    ['pika-text-to-video', 'image', 'frame.avif', 'image/avif'],
    ['seedream', 'image', 'frame.bmp', 'image/bmp'],
    ['seedream', 'image', 'frame.tiff', 'image/tiff'],
    ['lumaRay2', 'video', 'source.m4v', 'video/x-m4v'],
    ['seedance-2-0', 'audio', 'dialogue.mp3', 'audio/mpeg'],
    ['seedance-2-0', 'audio', 'dialogue.wav', 'audio/wav'],
  ] as const;

  for (const [engineId, type, name, mimeType] of cases) {
    const entry = getFalEngineById(engineId);
    assert.ok(entry, `missing ${engineId}`);
    const constraint = resolveEngineMediaFieldConstraint({
      engine: entry.engine,
      field: mediaField(entry.engine, type),
    });
    assert.deepEqual(
      validateMediaFileAgainstConstraint({ name, mimeType, sizeBytes: 1_024, constraint }),
      { ok: true },
      `${engineId} should accept ${name} (${mimeType})`,
    );
  }
});

test('an unmapped declared media format makes the derived format constraint fail closed', () => {
  const entry = getFalEngineById('lumaRay2');
  assert.ok(entry);
  const engine: EngineCaps = {
    ...entry.engine,
    inputSchema: {
      ...entry.engine.inputSchema!,
      constraints: {
        ...entry.engine.inputSchema!.constraints,
        supportedFormats: ['mp4', 'mystery'],
      },
    },
  };
  const constraint = resolveEngineMediaFieldConstraint({
    engine,
    field: mediaField(engine, 'video'),
  });

  assert.deepEqual(
    validateMediaFileAgainstConstraint({
      name: 'source.mp4', mimeType: 'video/mp4', sizeBytes: 1_024, constraint,
    }),
    { ok: false, reason: 'format', acceptedFileExtensions: ['mp4'] },
  );
});

function realKlingRequest(engine: EngineCaps, mode: Extract<Mode, 't2v' | 'i2v'>) {
  const optionsResult = buildGenerateRequestOptions({
    body: { prompt: 'A tracked camera move through a glass pavilion.' },
    engine,
    mode,
    isBytePlusV1a: false,
  });
  assert.equal(optionsResult.ok, true);
  if (!optionsResult.ok) throw new Error('Kling request options failed');
  const options = optionsResult.options;
  const imageUrl = mode === 'i2v' ? 'https://cdn.maxvideoai.com/verified-start.png' : undefined;
  const parts = buildFalRequestParts({
    attachments: [],
    engineId: engine.id,
    prompt: options.prompt,
    mode,
    apiKey: undefined,
    jobId: `job_${engine.id}_${mode}`,
    localKey: null,
    needsImage: mode === 'i2v',
    needsFirstLastFrames: false,
    initialImageUrl: imageUrl,
    resolvedFirstFrameUrl: undefined,
    lastFrameUrl: undefined,
    resolvedAudioUrl: undefined,
    normalizedReferenceImages: [],
    videoUrls: [],
    audioUrls: [],
    soraRequest: null,
    isLumaRay2: false,
    loop: false,
    multiPrompt: options.multiPrompt,
    shotType: options.shotType,
    seed: options.seed,
    cameraFixed: options.cameraFixed,
    safetyChecker: options.safetyChecker,
    voiceIds: options.voiceIds,
    elements: options.elements,
    endImageUrl: options.endImageUrl,
    extraInputValues: {},
    supportsDuration: options.supportsDuration,
    durationSec: options.durationSec,
    durationOption: options.rawDurationOption,
    numFrames: options.numFrames,
    supportsAspectRatio: options.supportsAspectRatio,
    aspectRatio: options.aspectRatio,
    supportsResolution: options.supportsResolution,
    resolution: options.effectiveResolution,
    audioEnabled: options.audioEnabled,
    supportsFps: options.supportsFps,
    fps: undefined,
    cfgScale: undefined,
  });
  const dispatched = buildFalGenerationRequest(parts.falPayload, engine.providerMeta?.modelSlug ?? '');
  return { options, falPayload: parts.falPayload, dispatched };
}

test('real Kling Turbo request options, Fal projection, dispatcher, and schema validator agree for t2v and i2v', () => {
  for (const engine of [KLING_3_TURBO_STANDARD_ENGINE, KLING_3_TURBO_PRO_ENGINE]) {
    for (const mode of ['t2v', 'i2v'] as const) {
      const result = realKlingRequest(engine, mode);
      assert.equal(result.options.durationSec, 5);
      assert.equal(result.falPayload.durationSec, 5);
      assert.equal(result.dispatched.requestBody.duration, '5');
      assert.equal('resolution' in result.falPayload, false);
      assert.equal('resolution' in result.dispatched.requestBody, false);
      assert.equal('aspect_ratio' in result.dispatched.requestBody, mode === 't2v');
      assert.deepEqual(
        validateRequest(engine.id, mode, result.dispatched.requestBody, { inputSchema: engine.inputSchema }),
        { ok: true },
      );
    }
  }
});
