import assert from 'node:assert/strict';
import test from 'node:test';

import { getFalEngineById } from '../frontend/src/config/falEngines';
import { isWorkspaceModelCertifiedForBlock } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/models/workspace-model-certification';
import { AgentApiError } from '../frontend/src/server/agent-api/errors';
import * as modelDetails from '../frontend/src/server/agent-api/model-details';
import type { AgentPublicCatalogEngine } from '../frontend/src/server/agent-api/model-catalog';
import type { AgentGenerationMode, AgentModelModeDetails } from '../frontend/src/server/agent-api/types';

type ModeCandidate = Pick<AgentPublicCatalogEngine, 'engine' | 'surface' | 'modeCaps'>;

function certifiedCandidate(modelId: 'wan-3' | 'gpt-image-2-5-flare'): ModeCandidate {
  const entry = getFalEngineById(modelId);
  assert.ok(entry);
  const image = entry.category === 'image';
  for (const mode of image ? ['t2i', 'i2i'] as const : ['t2v', 'i2v'] as const) {
    assert.equal(isWorkspaceModelCertifiedForBlock({
      modelId,
      presetId: image ? mode === 't2i' ? 'generate-image' : 'modify-image' : 'generate-video',
      workflowType: mode === 't2i' ? 'text_to_image'
        : mode === 'i2i' ? 'image_to_image'
          : mode === 't2v' ? 'text_to_video' : 'image_to_video',
    }), true);
  }
  return {
    engine: entry.engine,
    surface: image ? 'image' : 'video',
    modeCaps: Object.fromEntries(entry.modes.map((mode) => [mode.mode, mode.ui])),
  };
}

function project(candidate: ModeCandidate, mode: AgentGenerationMode): AgentModelModeDetails {
  assert.equal(typeof modelDetails.projectAgentModelModeDetails, 'function',
    'Studio needs the existing pure mode facts projection to be exported');
  return modelDetails.projectAgentModelModeDetails(candidate, mode);
}

const wanFacts = {
  durationPolicy: 'requested',
  duration: { options: null, range: { min: 2, max: 30 } },
  resolutions: ['480p', '720p', '1080p'],
  aspectRatios: ['auto', '16:9', '4:3', '1:1', '3:4', '9:16'],
  fps: [30],
  audio: 'optional',
  outputCount: { min: 1, max: 1, default: 1 },
  settings: [
    { key: 'seed', type: 'number', required: false, values: null, min: 0, max: 2147483647, default: null },
    { key: 'enablePromptExpansion', type: 'boolean', required: false, values: null, min: null, max: null, default: true },
  ],
} as const;

const flareResolutions = [
  'landscape_4_3', 'square_hd', 'square', 'portrait_4_3', 'portrait_16_9',
  'landscape_16_9', '1024x768', '1024x1024', '1024x1536', '1920x1080',
  '2560x1440', '3840x2160', 'custom',
];
const flareFacts = {
  durationPolicy: 'requested',
  duration: null,
  aspectRatios: ['auto', '16:9', '4:3', '1:1', '3:4', '9:16'],
  fps: [],
  audio: 'unavailable',
  outputCount: { min: 1, max: 4, default: 1 },
  settings: [
    { key: 'imageWidth', type: 'number', required: false, values: null, min: 16, max: 3840, default: 1024 },
    { key: 'imageHeight', type: 'number', required: false, values: null, min: 16, max: 3840, default: 768 },
    { key: 'quality', type: 'enum', required: false, values: ['low', 'medium', 'high', 'xhigh', 'max'], min: null, max: null, default: 'high' },
    { key: 'outputFormat', type: 'enum', required: false, values: ['png', 'jpeg', 'webp'], min: null, max: null, default: 'png' },
  ],
} as const;

const cases: { modelId: 'wan-3' | 'gpt-image-2-5-flare'; expected: AgentModelModeDetails }[] = [
  {
    modelId: 'wan-3',
    expected: { ...wanFacts, mode: 't2v', references: [] },
  },
  {
    modelId: 'wan-3',
    expected: {
      ...wanFacts,
      mode: 'i2v',
      references: [
        { type: 'image', roles: ['first_frame'], assetRequired: false, required: true, min: 1, max: 1 },
        { type: 'image', roles: ['last_frame'], assetRequired: false, required: false, min: 0, max: 1 },
      ],
    },
  },
  {
    modelId: 'gpt-image-2-5-flare',
    expected: { ...flareFacts, mode: 't2i', resolutions: flareResolutions, references: [] },
  },
  {
    modelId: 'gpt-image-2-5-flare',
    expected: {
      ...flareFacts,
      mode: 'i2i',
      resolutions: ['auto', ...flareResolutions],
      references: [
        {
          type: 'image', roles: ['reference'], assetRequired: false,
          assetRequiredWhen: { setting: 'resolution', values: ['auto'] },
          required: true, min: 1, max: 16,
          maxSizeMB: 25, acceptedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
          acceptedFileExtensions: ['jpg', 'jpeg', 'png', 'webp'],
        },
        { type: 'image', roles: ['mask'], assetRequired: false, required: false, min: 0, max: 1,
          maxSizeMB: 25, acceptedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
          acceptedFileExtensions: ['jpg', 'jpeg', 'png', 'webp'] },
      ],
    },
  },
];

for (const { modelId, expected } of cases) {
  test(`Studio projects exact canonical ${modelId} ${expected.mode} settings and reference limits`, () => {
    assert.deepEqual(project(certifiedCandidate(modelId), expected.mode), expected);
  });
}

test('mode facts projection rejects a missing mode instead of falling back to another mode', () => {
  const candidate = certifiedCandidate('wan-3');
  assert.throws(
    () => project({ ...candidate, modeCaps: { t2v: candidate.modeCaps.t2v } }, 'i2v'),
    (error: unknown) => error instanceof AgentApiError && error.code === 'ENGINE_UNAVAILABLE',
  );
  assert.throws(
    () => project(certifiedCandidate('gpt-image-2-5-flare'), 't2v'),
    (error: unknown) => error instanceof AgentApiError && error.code === 'ENGINE_UNAVAILABLE',
  );
});

test('mode facts projection detaches immutable settings and reference constraints from the input', () => {
  const candidate = structuredClone(certifiedCandidate('gpt-image-2-5-flare'));
  const projected = project(candidate, 'i2i');
  const quality = candidate.engine.inputSchema?.optional?.find((field) => field.id === 'quality');
  const reference = candidate.engine.inputSchema?.optional?.find((field) => field.id === 'image_urls');
  assert.ok(quality?.values);
  assert.ok(reference);
  quality.values[0] = 'changed';
  reference.maxCount = 99;
  candidate.engine.aspectRatios[0] = 'changed';
  const formats = candidate.engine.inputSchema?.constraints?.supportedFormats;
  assert.ok(Array.isArray(formats));
  formats[0] = 'changed';

  assert.deepEqual(projected, cases[3].expected);
  for (const value of [
    projected, projected.resolutions, projected.aspectRatios, projected.fps, projected.outputCount,
    projected.settings, ...projected.settings, projected.references, ...projected.references,
    ...projected.references.flatMap((field) => [field.roles, field.acceptedMimeTypes, field.acceptedFileExtensions]),
    projected.references[0].assetRequiredWhen,
    projected.references[0].assetRequiredWhen?.values,
  ]) assert.equal(Object.isFrozen(value), true);
  for (const setting of projected.settings) {
    if (setting.values) assert.equal(Object.isFrozen(setting.values), true);
  }
});

test('MCP model details preserve the same canonical mode facts after adapter eligibility checks', async () => {
  for (const modelId of ['wan-3', 'gpt-image-2-5-flare'] as const) {
    const candidate = certifiedCandidate(modelId);
    const details = await modelDetails.getAgentModelDetails(modelId, {
      async listEngines() { return [candidate.engine]; },
      surfaceByEngineId() { return candidate.surface; },
      isEngineExecutable() { return false; },
    });
    assert.equal(details.generationEnabled, false);
    assert.equal(details.prelaunch, false);
    assert.equal(details.lifecycle, 'current');
    for (const { expected } of cases.filter((entry) => entry.modelId === modelId)) {
      assert.deepEqual(details.modes.find((mode) => mode.mode === expected.mode), expected);
      assert.deepEqual(project(candidate, expected.mode), expected);
    }
  }
});
