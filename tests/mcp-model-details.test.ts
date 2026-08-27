import assert from 'node:assert/strict';
import test from 'node:test';

import { listFalEngines } from '../frontend/src/config/falEngines';
import { ENV } from '../frontend/src/lib/env';
import { AgentApiError } from '../frontend/src/server/agent-api/errors';
import {
  getAgentModelDetails,
  type AgentModelDetailsDeps,
} from '../frontend/src/server/agent-api/model-details';
import { isAgentGenerationEngineExecutable } from '../frontend/src/server/agent-api/model-catalog';
import type { EngineCaps, Mode } from '../frontend/types/engines';

function engine(
  id: string,
  modes: Mode[],
  overrides: Partial<EngineCaps> = {},
): EngineCaps {
  return {
    id,
    label: 'MiniMax H3',
    provider: 'private-provider',
    vendorAccountId: 'private-account',
    providerMeta: { provider: 'private-provider', modelSlug: 'private-model' },
    pricing: { unit: 'USD/s', base: 999 },
    pricingDetails: { currency: 'USD', perSecondCents: { default: 999 } },
    apiAvailability: 'public API',
    status: 'live',
    latencyTier: 'standard',
    modes,
    maxDurationSec: 15,
    resolutions: ['768P', '2K'],
    aspectRatios: ['16:9', '9:16'],
    fps: [24],
    audio: true,
    upscale4k: false,
    extend: false,
    motionControls: false,
    keyframes: false,
    params: {},
    inputLimits: {},
    inputSchema: {
      required: [
        {
          id: 'image_url',
          type: 'image',
          label: 'Private upload source',
          modes: ['i2v'],
          requiredInModes: ['i2v'],
          minCount: 1,
          maxCount: 1,
          source: 'url',
        },
      ],
      optional: [
        {
          id: 'reference_image_urls',
          type: 'image',
          label: 'Private upload source',
          modes: ['ref2v'],
          minCount: 0,
          maxCount: 9,
          source: 'either',
        },
        {
          id: 'reference_audio_urls',
          type: 'audio',
          label: 'Private audio source',
          modes: ['ref2v'],
          minCount: 0,
          maxCount: 3,
          source: 'either',
        },
      ],
      constraints: {
        maxImageSizeMB: 30,
        unknownPrivateConstraint: 'do-not-expose',
      },
    },
    modeCaps: {
      t2v: {
        modes: ['t2v'],
        duration: { options: [5, 10], default: 10 },
        resolution: ['768P', '2K'],
        aspectRatio: ['16:9', '9:16'],
        fps: 24,
        audioToggle: false,
        notes: 'Internal provider note.',
      },
      i2v: {
        modes: ['i2v'],
        duration: { min: 5, default: 10 },
        resolution: ['768P'],
        fps: [24],
        audioToggle: true,
      },
      ref2v: {
        modes: ['ref2v'],
        duration: { options: [5, 10], default: 10 },
        resolution: ['2K'],
        aspectRatio: ['16:9'],
        fps: 24,
        audioToggle: false,
        notes: 'Internal provider note.',
      },
    },
    updatedAt: '2026-08-24T12:00:00.000Z',
    ttlSec: 300,
    availability: 'available',
    ...overrides,
  };
}

function detailsDeps(
  engines: EngineCaps[],
  executable = (candidate: EngineCaps) => candidate.id !== 'non-executable',
): AgentModelDetailsDeps {
  return {
    async listEngines() {
      return engines;
    },
    surfaceByEngineId(id) {
      return engines.some((candidate) => candidate.id === id) ? 'video' : null;
    },
    isEngineExecutable: executable,
    getGuidance(id) {
      return id === 'minimax-h3'
        ? {
            engineId: id,
            strengths: ['Character continuity.'],
            bestFor: ['character_scene'],
            considerations: ['Confirm settings before generating.'],
            evidenceUrls: [
              'https://maxvideoai.com/models/minimax-h3',
              'https://maxvideoai.com/examples/minimax-h3',
            ],
            reviewedAt: '2026-08-24',
          }
        : null;
    },
    getPromptingSources(id) {
      return id === 'minimax-h3'
        ? [{
            id: 'minimax-video-generation',
            kind: 'official_provider',
            provider: 'MiniMax',
            title: 'MiniMax video generation guide',
            url: 'https://platform.minimax.io/docs/guides/video-generation',
            modes: ['t2v', 'i2v', 'fl2v', 'ref2v'],
            reviewedAt: '2026-08-28',
          }]
        : [];
    },
  };
}

function realRegistryDetailsDeps(): AgentModelDetailsDeps {
  const entries = listFalEngines();
  return {
    async listEngines() {
      return entries.map((entry) => entry.engine);
    },
    surfaceByEngineId(id) {
      const entry = entries.find((candidate) => candidate.id === id);
      if (!entry) return null;
      return entry.category === 'image' ? 'image' : 'video';
    },
    isEngineExecutable: isAgentGenerationEngineExecutable,
  };
}

test('model details project one executable public model into the exact safe shape', async () => {
  const details = await getAgentModelDetails(
    'minimax-h3',
    detailsDeps([engine('minimax-h3', ['t2v', 'i2v', 'ref2v'])]),
  );

  assert.deepEqual(details, {
    id: 'minimax-h3',
    label: 'MiniMax H3',
    surface: 'video',
    availability: 'available',
    generationEnabled: true,
    modes: [
      {
        mode: 't2v',
        durationPolicy: 'requested',
        duration: { options: [5, 10], range: null },
        resolutions: ['768P', '2K'],
        aspectRatios: ['16:9', '9:16'],
        fps: [24],
        audio: 'always_generated',
        outputCount: { min: 1, max: 1, default: 1 },
        settings: [],
        references: [],
      },
      {
        mode: 'i2v',
        durationPolicy: 'requested',
        duration: { options: null, range: { min: 5, max: 15 } },
        resolutions: ['768P'],
        aspectRatios: [],
        fps: [24],
        audio: 'optional',
        outputCount: { min: 1, max: 1, default: 1 },
        settings: [],
        references: [{
          type: 'image', roles: ['source', 'first_frame'], assetRequired: false,
          required: true, min: 1, max: 1,
        }],
      },
      {
        mode: 'ref2v',
        durationPolicy: 'requested',
        duration: { options: [5, 10], range: null },
        resolutions: ['2K'],
        aspectRatios: ['16:9'],
        fps: [24],
        audio: 'always_generated',
        outputCount: { min: 1, max: 1, default: 1 },
        settings: [],
        references: [
          { type: 'image', roles: ['reference'], assetRequired: false, required: false, min: 0, max: 9 },
          { type: 'audio', roles: ['reference'], assetRequired: false, required: false, min: 0, max: 3 },
        ],
      },
    ],
    guidance: {
      engineId: 'minimax-h3',
      strengths: ['Character continuity.'],
      bestFor: ['character_scene'],
      considerations: ['Confirm settings before generating.'],
      evidenceUrls: [
        'https://maxvideoai.com/models/minimax-h3',
        'https://maxvideoai.com/examples/minimax-h3',
      ],
      reviewedAt: '2026-08-24',
    },
    promptingSources: [{
      id: 'minimax-video-generation',
      kind: 'official_provider',
      provider: 'MiniMax',
      title: 'MiniMax video generation guide',
      url: 'https://platform.minimax.io/docs/guides/video-generation',
      modes: ['t2v', 'i2v', 'ref2v'],
      reviewedAt: '2026-08-28',
    }],
    links: {
      model: 'https://maxvideoai.com/models/minimax-h3',
      pricing: 'https://maxvideoai.com/pricing',
      examples: 'https://maxvideoai.com/examples/minimax-h3',
    },
    catalogUpdatedAt: '2026-08-24T12:00:00.000Z',
  });

  const serialized = JSON.stringify(details);
  for (const privateValue of [
    'private-provider',
    'providerMeta',
    'vendorAccountId',
    'pricingDetails',
    'apiAvailability',
    'Internal provider note',
    'Private upload source',
    'unknownPrivateConstraint',
    'do-not-expose',
  ]) {
    assert.doesNotMatch(serialized, new RegExp(privateValue, 'i'));
  }
  assert.equal(Object.hasOwn(details, 'pricing'), false);
});

test('model details distinguish a public model that is disabled in the connected environment', async () => {
  const engines = [
    engine('minimax-h3', ['t2v']),
    engine('hidden', ['t2v'], { isLab: true }),
    engine('non-executable', ['t2v']),
    engine('retired', ['t2v'], { availability: 'paused', apiAvailability: 'retired' }),
  ];
  const deps = detailsDeps(engines);

  const disabledDetails = await getAgentModelDetails('non-executable', deps);
  assert.equal(disabledDetails.generationEnabled, false);
  assert.equal(disabledDetails.availability, 'available');

  for (const id of ['unknown', 'hidden', 'retired']) {
    await assert.rejects(
      () => getAgentModelDetails(id, deps),
      (error: unknown) => error instanceof AgentApiError && error.code === 'ENGINE_UNAVAILABLE',
      id,
    );
  }
});

test('real i2i model details honor requiredInModes even when the field is stored as optional', async () => {
  const details = await getAgentModelDetails('nano-banana', realRegistryDetailsDeps());
  const textMode = details.modes.find((mode) => mode.mode === 't2i');
  const editMode = details.modes.find((mode) => mode.mode === 'i2i');

  assert.ok(textMode);
  assert.ok(editMode);
  assert.deepEqual(textMode.outputCount, { min: 1, max: 8, default: 1 });
  assert.deepEqual(editMode.outputCount, { min: 1, max: 8, default: 1 });
  assert.deepEqual(textMode.resolutions, ['square_hd', 'landscape_hd', 'portrait_hd']);
  assert.deepEqual(textMode.references, []);
  assert.deepEqual(editMode.references, [
    { type: 'image', roles: ['reference'], assetRequired: false, required: true, min: 1, max: 4 },
  ]);
  assert.equal(Object.isFrozen(editMode.references), true);
  assert.doesNotMatch(
    JSON.stringify(details),
    /google_vertex_image|providerMeta|pricingDetails|acceptedMimeTypes/i,
  );
});

test('real image model details publish canonical controls Claude and ChatGPT can send', async () => {
  const details = await getAgentModelDetails('nano-banana-2', realRegistryDetailsDeps());
  const mode = details.modes.find((candidate) => candidate.mode === 't2i');
  assert.ok(mode);
  assert.deepEqual(mode.outputCount, { min: 1, max: 4, default: 1 });
  assert.deepEqual(mode.resolutions, ['0.5k', '1k', '2k', '4k']);
  assert.deepEqual(mode.settings, [
    { key: 'seed', type: 'number', required: false, values: null, min: null, max: null, default: null },
    { key: 'outputFormat', type: 'enum', required: false, values: ['jpeg', 'png', 'webp'], min: null, max: null, default: 'jpeg' },
    { key: 'enableWebSearch', type: 'boolean', required: false, values: null, min: null, max: null, default: false },
    { key: 'thinkingLevel', type: 'enum', required: false, values: ['minimal', 'high'], min: null, max: null, default: 'minimal' },
    { key: 'limitGenerations', type: 'boolean', required: false, values: null, min: null, max: null, default: false },
  ]);
});

test('GPT Image 2 details explain that auto edit sizing requires an owned asset', async () => {
  const details = await getAgentModelDetails('gpt-image-2', realRegistryDetailsDeps());
  const mode = details.modes.find((candidate) => candidate.mode === 'i2i');
  assert.ok(mode);
  const source = mode.references.find((reference) => reference.roles.includes('reference'));
  assert.ok(source);
  assert.equal(source.assetRequired, false);
  assert.deepEqual(source.assetRequiredWhen, {
    setting: 'resolution',
    values: ['auto'],
  });
});

test('LTX audio-to-video details expose trusted per-file duration limits', async () => {
  const details = await getAgentModelDetails('ltx-2-3', realRegistryDetailsDeps());
  const mode = details.modes.find((candidate) => candidate.mode === 'a2v');
  assert.ok(mode);
  const source = mode.references.find((reference) =>
    reference.type === 'audio' && reference.roles.includes('source'));
  assert.ok(source);
  assert.equal(source.assetRequired, true);
  assert.deepEqual(source.durationSec, { min: 2, max: 20, combinedMax: null });
});

test('Luma Ray 2 V2V details explain source-derived duration and fixed pricing resolution', async () => {
  const details = await getAgentModelDetails('lumaRay2', realRegistryDetailsDeps());
  const mode = details.modes.find((candidate) => candidate.mode === 'v2v');
  assert.ok(mode);
  assert.equal(mode.durationPolicy, 'source_video');
  assert.equal(mode.duration, null);
  assert.deepEqual(mode.resolutions, ['540p']);
  assert.deepEqual(mode.aspectRatios, []);
  assert.deepEqual(mode.references, [
    { type: 'video', roles: ['source'], assetRequired: true, required: true, min: 1, max: 1 },
    { type: 'image', roles: ['reference'], assetRequired: false, required: false, min: 1, max: 1 },
  ]);
});

test('Luma Ray 3.2 V2V details distinguish one guide frame from ordered edit keyframes', async () => {
  const details = await getAgentModelDetails('luma-ray-3-2', realRegistryDetailsDeps());
  const mode = details.modes.find((candidate) => candidate.mode === 'v2v');
  assert.ok(mode);
  assert.deepEqual(mode.references, [
    {
      type: 'video', roles: ['source'], assetRequired: true,
      durationSec: { min: null, max: 30, combinedMax: null },
      required: true, min: 1, max: 1,
    },
    { type: 'image', roles: ['first_frame'], assetRequired: false, required: false, min: 0, max: 1 },
    { type: 'image', roles: ['reference'], assetRequired: false, required: false, min: 0, max: 64 },
  ]);
});

test('Seedream details mirror direct provider credential readiness', { concurrency: false }, async () => {
  const original = {
    bytePlusEnabled: ENV.BYTEPLUS_ARK_ENABLED,
    bytePlusApiKey: ENV.BYTEPLUS_ARK_API_KEY,
  };
  const registryDeps = realRegistryDetailsDeps();

  try {
    ENV.BYTEPLUS_ARK_ENABLED = 'true';
    ENV.BYTEPLUS_ARK_API_KEY = '';
    assert.equal((await getAgentModelDetails('seedream', registryDeps)).generationEnabled, false);

    ENV.BYTEPLUS_ARK_API_KEY = 'test-key';
    assert.equal((await getAgentModelDetails('seedream', registryDeps)).generationEnabled, true);
  } finally {
    ENV.BYTEPLUS_ARK_ENABLED = original.bytePlusEnabled;
    ENV.BYTEPLUS_ARK_API_KEY = original.bytePlusApiKey;
  }
});

test('custom guidance is projected into an immutable detached public DTO', async () => {
  const mutableGuidance = {
    engineId: 'minimax-h3',
    strengths: ['Original strength.'],
    bestFor: ['character_scene'] as const,
    considerations: ['Original consideration.'],
    evidenceUrls: [
      'https://maxvideoai.com/models/minimax-h3',
      'https://maxvideoai.com/examples/minimax-h3',
    ],
    reviewedAt: '2026-08-24',
  };
  const deps = detailsDeps([engine('minimax-h3', ['t2v'])]);
  deps.getGuidance = () => mutableGuidance;

  const details = await getAgentModelDetails('minimax-h3', deps);
  const projected = details.guidance;
  assert.ok(projected);
  assert.notEqual(projected, mutableGuidance);
  assert.notEqual(projected.strengths, mutableGuidance.strengths);
  assert.equal(Object.isFrozen(projected), true);
  assert.equal(Object.isFrozen(projected.strengths), true);
  assert.equal(Object.isFrozen(projected.bestFor), true);
  assert.equal(Object.isFrozen(projected.considerations), true);
  assert.equal(Object.isFrozen(projected.evidenceUrls), true);

  mutableGuidance.strengths[0] = 'Mutated strength.';
  mutableGuidance.evidenceUrls[1] = 'https://maxvideoai.com/examples/mutated';
  assert.deepEqual(projected.strengths, ['Original strength.']);
  assert.deepEqual(projected.evidenceUrls, [
    'https://maxvideoai.com/models/minimax-h3',
    'https://maxvideoai.com/examples/minimax-h3',
  ]);
});

test('prompting sources are filtered to public modes and projected as detached immutable DTOs', async () => {
  const mutableSource = {
    id: 'minimax-video-generation',
    kind: 'official_provider' as const,
    provider: 'MiniMax',
    title: 'MiniMax video generation guide',
    url: 'https://platform.minimax.io/docs/guides/video-generation',
    modes: ['t2v', 'i2v', 'fl2v'] as const,
    reviewedAt: '2026-08-28',
  };
  const deps = detailsDeps([engine('minimax-h3', ['t2v', 'i2v'])]);
  deps.getPromptingSources = () => [mutableSource];

  const details = await getAgentModelDetails('minimax-h3', deps);
  const [projected] = details.promptingSources;
  assert.ok(projected);
  assert.notEqual(projected, mutableSource);
  assert.notEqual(projected.modes, mutableSource.modes);
  assert.deepEqual(projected.modes, ['t2v', 'i2v']);
  assert.equal(Object.isFrozen(details.promptingSources), true);
  assert.equal(Object.isFrozen(projected), true);
  assert.equal(Object.isFrozen(projected.modes), true);
});
