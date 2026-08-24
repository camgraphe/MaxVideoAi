import assert from 'node:assert/strict';
import test from 'node:test';

import { AgentApiError } from '../frontend/src/server/agent-api/errors';
import {
  getAgentModelDetails,
  type AgentModelDetailsDeps,
} from '../frontend/src/server/agent-api/model-details';
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
    modes: [
      {
        mode: 't2v',
        duration: { options: [5, 10], range: null },
        resolutions: ['768P', '2K'],
        aspectRatios: ['16:9', '9:16'],
        fps: [24],
        audio: 'always_generated',
        references: [],
      },
      {
        mode: 'i2v',
        duration: { options: null, range: { min: 5, max: 15 } },
        resolutions: ['768P'],
        aspectRatios: [],
        fps: [24],
        audio: 'optional',
        references: [{ id: 'image_url', type: 'image', required: true, min: 1, max: 1 }],
      },
      {
        mode: 'ref2v',
        duration: { options: [5, 10], range: null },
        resolutions: ['2K'],
        aspectRatios: ['16:9'],
        fps: [24],
        audio: 'always_generated',
        references: [
          { id: 'reference_image_urls', type: 'image', required: false, min: 0, max: 9 },
          { id: 'reference_audio_urls', type: 'audio', required: false, min: 0, max: 3 },
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
    links: {
      model: 'https://maxvideoai.com/models/minimax-h3',
      pricing: 'https://maxvideoai.com/pricing',
      examples: 'https://maxvideoai.com/examples/minimax-h3',
    },
    catalogUpdatedAt: '2026-08-24T12:00:00.000Z',
  });

  const serialized = JSON.stringify(details);
  for (const privateValue of [
    'provider',
    'providerMeta',
    'vendorAccountId',
    'pricingDetails',
    'apiAvailability',
    'Internal provider note',
    'Private upload source',
    'source',
    'unknownPrivateConstraint',
    'do-not-expose',
  ]) {
    assert.doesNotMatch(serialized, new RegExp(privateValue, 'i'));
  }
  assert.equal(Object.hasOwn(details, 'pricing'), false);
});

test('model details reject unknown, hidden, non-executable, and retired public IDs', async () => {
  const engines = [
    engine('minimax-h3', ['t2v']),
    engine('hidden', ['t2v'], { isLab: true }),
    engine('non-executable', ['t2v']),
    engine('retired', ['t2v'], { availability: 'paused', apiAvailability: 'retired' }),
  ];
  const deps = detailsDeps(engines);

  for (const id of ['unknown', 'hidden', 'non-executable', 'retired']) {
    await assert.rejects(
      () => getAgentModelDetails(id, deps),
      (error: unknown) => error instanceof AgentApiError && error.code === 'ENGINE_UNAVAILABLE',
      id,
    );
  }
});
