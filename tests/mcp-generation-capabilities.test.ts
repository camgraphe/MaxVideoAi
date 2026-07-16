import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { listFalEngines } from '../frontend/src/config/falEngines';
import { computeGenerationCatalogRevision } from '../frontend/src/server/agent-api/catalog-revision';
import {
  GenerationCapabilityError,
  validateCanonicalGenerationCapabilities,
} from '../frontend/src/server/agent-api/generation-capability-validation';
import type { CanonicalGenerationRequest } from '../frontend/src/server/agent-api/generation-types';
import type { AgentPublicGenerationEngine } from '../frontend/src/server/agent-api/model-catalog';
import type { EngineCaps, EngineInputField, EngineModeUiCaps } from '../frontend/types/engines';

function engine(overrides: Partial<EngineCaps> = {}): EngineCaps {
  return {
    id: 'video-engine',
    label: 'Video Engine',
    provider: 'test',
    status: 'live',
    latencyTier: 'standard',
    modes: ['t2v', 'i2v', 'ref2v'],
    maxDurationSec: 12,
    resolutions: ['720p', '1080p'],
    aspectRatios: ['16:9', '9:16'],
    fps: [24, 30],
    audio: true,
    upscale4k: false,
    extend: false,
    motionControls: false,
    keyframes: false,
    params: {},
    inputLimits: { promptMaxChars: 1_000 },
    inputSchema: {
      required: [{ id: 'prompt', type: 'text', label: 'Prompt' }],
      optional: [
        { id: 'duration', type: 'enum', label: 'Duration', values: ['4', '8', '12'] },
        { id: 'resolution', type: 'enum', label: 'Resolution', values: ['720p', '1080p'] },
        { id: 'aspect_ratio', type: 'enum', label: 'Ratio', values: ['16:9', '9:16'] },
        { id: 'generate_audio', type: 'boolean', label: 'Audio' },
        { id: 'seed', type: 'number', label: 'Seed', min: 0, max: 100 },
        { id: 'image_url', type: 'image', label: 'Source', modes: ['i2v'], requiredInModes: ['i2v'], minCount: 1, maxCount: 1 },
        { id: 'end_image_url', type: 'image', label: 'End', modes: ['i2v'], minCount: 0, maxCount: 1 },
        { id: 'image_urls', type: 'image', label: 'References', modes: ['ref2v'], requiredInModes: ['ref2v'], minCount: 1, maxCount: 2 },
      ],
    },
    updatedAt: '2026-07-16T00:00:00.000Z',
    ttlSec: 600,
    availability: 'available',
    ...overrides,
  };
}

const t2vCaps: EngineModeUiCaps = {
  modes: ['t2v'],
  duration: { options: [4, 8, 12], default: 4 },
  resolution: ['720p', '1080p'],
  aspectRatio: ['16:9', '9:16'],
  fps: [24, 30],
  audioToggle: true,
};

function capability(overrides: Partial<AgentPublicGenerationEngine> = {}): AgentPublicGenerationEngine {
  return {
    engine: engine(),
    surface: 'video',
    publicModes: ['t2v', 'i2v', 'ref2v'],
    modeCaps: {
      t2v: t2vCaps,
      i2v: { ...t2vCaps, modes: ['i2v'] },
      ref2v: { ...t2vCaps, modes: ['ref2v'] },
    },
    ...overrides,
  };
}

function request(overrides: Partial<CanonicalGenerationRequest> = {}): CanonicalGenerationRequest {
  return {
    schemaVersion: 1,
    surface: 'video',
    engineId: 'video-engine',
    mode: 't2v',
    prompt: 'Executable request',
    settings: { durationSec: 4, resolution: '720p', aspectRatio: '16:9', fps: 24, audio: true },
    references: [],
    outputCount: 1,
    ...overrides,
  };
}

function registryCapability(engineId: string): AgentPublicGenerationEngine {
  const entry = listFalEngines().find((candidate) => candidate.id === engineId);
  assert.ok(entry, `Missing registry engine ${engineId}`);
  const publicModes = entry.modes
    .map((mode) => mode.mode)
    .filter((mode): mode is AgentPublicGenerationEngine['publicModes'][number] =>
      ['t2v', 'i2v', 'ref2v', 't2i', 'i2i'].includes(mode));
  return {
    engine: entry.engine,
    surface: entry.category === 'image' ? 'image' : 'video',
    publicModes,
    modeCaps: Object.fromEntries(entry.modes.map((mode) => [mode.mode, mode.ui])),
  };
}

function rejectsCapability(candidate: AgentPublicGenerationEngine, value: CanonicalGenerationRequest): void {
  assert.throws(
    () => validateCanonicalGenerationCapabilities(value, candidate),
    (error: unknown) => error instanceof GenerationCapabilityError,
  );
}

test('video capability validation enforces discrete/min durations, fps, enums, and unsupported fields', () => {
  assert.doesNotThrow(() => validateCanonicalGenerationCapabilities(request(), capability()));
  rejectsCapability(capability(), request({ settings: { ...request().settings, durationSec: 5 } }));
  rejectsCapability(
    capability({ modeCaps: { t2v: { ...t2vCaps, duration: { min: 6, default: 6 } } } }),
    request({ settings: { ...request().settings, durationSec: 4 } }),
  );
  rejectsCapability(capability(), request({ settings: { ...request().settings, fps: 25 } }));
  rejectsCapability(capability(), request({ settings: { ...request().settings, audio: 'yes' } }));
  rejectsCapability(capability(), request({ settings: { ...request().settings, resolution: '4k' } }));
  rejectsCapability(capability(), request({ settings: { ...request().settings, aspectRatio: '1:1' } }));
  rejectsCapability(
    capability(),
    request({ settings: { ...request().settings, negativePrompt: 'not exposed by schema' } }),
  );
  rejectsCapability(
    capability({
      engine: engine({
        inputSchema: {
          ...engine().inputSchema,
          optional: (engine().inputSchema?.optional ?? []).map((field) =>
            field.id === 'duration' ? { ...field, values: ['4'] } : field),
        },
      }),
    }),
    request({ settings: { ...request().settings, durationSec: 8 } }),
  );
});

test('actual input schema owns reference roles, required counts, and maximums', () => {
  const source = { kind: 'asset' as const, assetId: 'asset-1', role: 'source' as const };
  const end = { kind: 'asset' as const, assetId: 'asset-2', role: 'last_frame' as const };
  const reference = (id: string) => ({ kind: 'asset' as const, assetId: id, role: 'reference' as const });
  assert.doesNotThrow(() => validateCanonicalGenerationCapabilities(
    request({ mode: 'i2v', references: [source, end] }),
    capability(),
  ));
  assert.doesNotThrow(() => validateCanonicalGenerationCapabilities(
    request({
      mode: 'i2v',
      references: [{ ...source, role: 'first_frame' }],
    }),
    capability(),
  ));
  rejectsCapability(capability(), request({ mode: 'i2v', references: [] }));
  rejectsCapability(capability(), request({ mode: 'i2v', references: [source, source] }));
  assert.doesNotThrow(() => validateCanonicalGenerationCapabilities(
    request({ mode: 'ref2v', references: [reference('a'), reference('b')] }),
    capability(),
  ));
  rejectsCapability(
    capability(),
    request({ mode: 'ref2v', references: [reference('a'), reference('b'), reference('c')] }),
  );
});

test('image capability validation uses execution input-schema enums and reference limits', () => {
  const imageFields: EngineInputField[] = [
    { id: 'prompt', type: 'text', label: 'Prompt' },
    { id: 'resolution', type: 'enum', label: 'Size', values: ['1k', '2k'] },
    { id: 'aspect_ratio', type: 'enum', label: 'Ratio', values: ['1:1'] },
    { id: 'quality', type: 'enum', label: 'Quality', values: ['low', 'high'] },
    { id: 'output_format', type: 'enum', label: 'Format', values: ['png'] },
    { id: 'image_urls', type: 'image', label: 'Images', modes: ['i2i'], requiredInModes: ['i2i'], minCount: 1, maxCount: 2 },
  ];
  const imageCapability = capability({
    surface: 'image',
    publicModes: ['t2i', 'i2i'],
    engine: engine({
      id: 'image-engine',
      modes: ['t2i', 'i2i'],
      maxDurationSec: 0,
      resolutions: ['1k', '2k'],
      aspectRatios: ['1:1'],
      fps: [1],
      audio: false,
      inputSchema: { required: [imageFields[0]], optional: imageFields.slice(1) },
    }),
    modeCaps: {
      t2i: { modes: ['t2i'], resolution: ['1k', '2k'], aspectRatio: ['1:1'] },
      i2i: { modes: ['i2i'], resolution: ['1k', '2k'], aspectRatio: ['1:1'] },
    },
  });
  const imageRequest: CanonicalGenerationRequest = {
    schemaVersion: 1,
    surface: 'image',
    engineId: 'image-engine',
    mode: 't2i',
    prompt: 'Image',
    settings: { resolution: '1k', aspectRatio: '1:1', quality: 'high', outputFormat: 'png' },
    references: [],
    outputCount: 1,
  };
  assert.doesNotThrow(() => validateCanonicalGenerationCapabilities(imageRequest, imageCapability));
  rejectsCapability(
    imageCapability,
    { ...imageRequest, settings: { ...imageRequest.settings, quality: 'ultra' } },
  );
  rejectsCapability(
    imageCapability,
    { ...imageRequest, settings: { ...imageRequest.settings, style: 'unsupported' } },
  );
  rejectsCapability(imageCapability, { ...imageRequest, mode: 'i2i', references: [] });
});

test('catalog revision covers every eligibility-determining capability and ignores ordering', () => {
  const base = capability();
  const revision = computeGenerationCatalogRevision([base]);
  const reorderedSchema = engine({
    inputSchema: {
      required: [...(base.engine.inputSchema?.required ?? [])].reverse(),
      optional: [...(base.engine.inputSchema?.optional ?? [])].reverse(),
    },
  });
  assert.equal(
    revision,
    computeGenerationCatalogRevision([{ ...base, engine: reorderedSchema }]),
  );

  const mutations: AgentPublicGenerationEngine[] = [
    { ...base, publicModes: ['t2v'] },
    { ...base, modeCaps: { ...base.modeCaps, t2v: { ...t2vCaps, duration: { options: [4, 8] } } } },
    { ...base, modeCaps: { ...base.modeCaps, t2v: { ...t2vCaps, fps: [24] } } },
    {
      ...base,
      engine: engine({
        inputSchema: {
          ...base.engine.inputSchema,
          optional: (base.engine.inputSchema?.optional ?? []).map((field) =>
            field.id === 'resolution' ? { ...field, values: ['720p'] } : field),
        },
      }),
    },
    {
      ...base,
      engine: engine({
        inputSchema: {
          ...base.engine.inputSchema,
          optional: (base.engine.inputSchema?.optional ?? []).map((field) =>
            field.id === 'image_urls' ? { ...field, maxCount: 1 } : field),
        },
      }),
    },
  ];
  for (const mutation of mutations) {
    assert.notEqual(computeGenerationCatalogRevision([mutation]), revision);
  }
});

test('real execution duration options accept numeric MCP seconds for Veo 3.1 and Luma Ray 2 only when supported', () => {
  const veo = registryCapability('veo-3-1');
  const luma = registryCapability('lumaRay2');
  const videoRequest = (candidate: AgentPublicGenerationEngine, durationSec: number): CanonicalGenerationRequest => ({
    schemaVersion: 1,
    surface: 'video',
    engineId: candidate.engine.id,
    mode: 't2v',
    prompt: 'Duration parity',
    settings: {
      durationSec,
      resolution: candidate.modeCaps.t2v?.resolution?.[0] ?? candidate.engine.resolutions[0],
      aspectRatio: candidate.modeCaps.t2v?.aspectRatio?.[0] ?? candidate.engine.aspectRatios[0],
    },
    references: [],
    outputCount: 1,
  });

  assert.doesNotThrow(() => validateCanonicalGenerationCapabilities(videoRequest(veo, 8), veo));
  assert.doesNotThrow(() => validateCanonicalGenerationCapabilities(videoRequest(luma, 5), luma));
  rejectsCapability(veo, videoRequest(veo, 5));
  rejectsCapability(luma, videoRequest(luma, 6));
});

test('global provider controls reject an out-of-range seed even when a provider field omits bounds', () => {
  const veo = registryCapability('veo-3-1');
  rejectsCapability(veo, {
    schemaVersion: 1,
    surface: 'video',
    engineId: 'veo-3-1',
    mode: 't2v',
    prompt: 'Seed parity',
    settings: {
      durationSec: 8,
      resolution: '720p',
      aspectRatio: '16:9',
      seed: 2_147_483_648,
    },
    references: [],
    outputCount: 1,
  });
});

test('HTTP route validators delegate provider rules to a route-independent server owner', () => {
  const shared = readFileSync('frontend/src/server/video-generation/execution-constraints.ts', 'utf8');
  const providerWrapper = readFileSync('frontend/app/api/generate/_lib/validate-provider-constraints.ts', 'utf8');
  const controlsWrapper = readFileSync('frontend/app/api/generate/_lib/validate-provider-controls.ts', 'utf8');
  assert.doesNotMatch(shared, /app\/api\/generate|\.\.\/\.\.\/\.\.\/app/u);
  assert.match(providerWrapper, /@\/server\/video-generation\/execution-constraints/u);
  assert.match(controlsWrapper, /@\/server\/video-generation\/execution-constraints/u);
});
