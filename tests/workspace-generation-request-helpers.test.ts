import assert from 'node:assert/strict';
import test from 'node:test';

import { LUMA_RAY2_ERROR_UNSUPPORTED } from '../frontend/src/lib/luma-ray2';
import type { EngineInputField, EngineModeUiCaps } from '../frontend/types/engines';
import {
  buildWorkspaceGeneratePayload,
} from '../frontend/app/(core)/(workspace)/app/_lib/workspace-generation-payload';
import {
  getGenerationIterationGuardMessage,
  getLumaRay2GenerationContext,
  getStartRenderValidationMessage,
} from '../frontend/app/(core)/(workspace)/app/_lib/workspace-generation-guards';
import type { FormState } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-form-state';
import type { GenerationAttachmentPayload } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-generation-inputs';
import type { WorkspaceInputSchemaSummary } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-input-schema';
import type { ReferenceAsset } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-assets';

const textField = (id: string, label: string): EngineInputField => ({ id, label, type: 'text' });
const imageField = (id: string, label: string, minCount?: number): EngineInputField => ({
  id,
  label,
  type: 'image',
  minCount,
});

function baseForm(overrides: Partial<FormState> = {}): FormState {
  return {
    engineId: 'seedance-2-0',
    mode: 't2v',
    durationSec: 5,
    durationOption: '5s',
    resolution: '720p',
    aspectRatio: '16:9',
    fps: 24,
    iterations: 1,
    audio: false,
    extraInputValues: {},
    ...overrides,
  };
}

function baseSchemaSummary(overrides: Partial<WorkspaceInputSchemaSummary> = {}): WorkspaceInputSchemaSummary {
  return {
    assetFields: [],
    promotedFields: [],
    secondaryFields: [],
    promptRequired: false,
    negativePromptRequired: false,
    ...overrides,
  };
}

function readyAsset(overrides: Partial<ReferenceAsset> = {}): ReferenceAsset {
  return {
    id: 'asset-1',
    name: 'reference.png',
    kind: 'image',
    type: 'image/png',
    size: 1234,
    previewUrl: 'https://cdn.example.com/reference.png',
    url: 'https://cdn.example.com/reference.png',
    status: 'ready',
    ...overrides,
  };
}

test('start render validation reports required negative prompts', () => {
  const message = getStartRenderValidationMessage({
    audioWorkflowUnsupported: false,
    audioUnsupportedMessage: 'Audio workflow is unsupported.',
    multiPromptActive: false,
    multiPromptInvalid: false,
    multiPromptError: null,
    promptLength: 10,
    promptCharLimitExceeded: false,
    promptMaxChars: undefined,
    selectedEngineLabel: 'Seedance',
    trimmedPrompt: 'a prompt',
    trimmedNegativePrompt: '',
    inputSchemaSummary: baseSchemaSummary({
      negativePromptField: textField('negative_prompt', 'Safety & people / likeness.'),
      negativePromptRequired: true,
    }),
    inputAssets: {},
    extraInputFields: [],
    form: baseForm(),
    lumaContext: getLumaRay2GenerationContext({
      selectedEngineId: 'seedance-2-0',
      submissionMode: 't2v',
      form: baseForm(),
    }),
  });

  assert.equal(message, 'Safety & people / likeness. is required before generating.');
});

test('start render validation checks asset minimums and Luma Ray 2 limits', () => {
  const missingAssetMessage = getStartRenderValidationMessage({
    audioWorkflowUnsupported: false,
    audioUnsupportedMessage: 'Audio workflow is unsupported.',
    multiPromptActive: false,
    multiPromptInvalid: false,
    multiPromptError: null,
    promptLength: 10,
    promptCharLimitExceeded: false,
    promptMaxChars: undefined,
    selectedEngineLabel: 'Seedance',
    trimmedPrompt: 'a prompt',
    trimmedNegativePrompt: '',
    inputSchemaSummary: baseSchemaSummary({
      assetFields: [{ field: imageField('image_urls', 'Reference images', 2), required: true }],
    }),
    inputAssets: { image_urls: [readyAsset()] },
    extraInputFields: [],
    form: baseForm(),
    lumaContext: getLumaRay2GenerationContext({
      selectedEngineId: 'seedance-2-0',
      submissionMode: 'ref2v',
      form: baseForm({ mode: 'ref2v' }),
    }),
  });

  assert.equal(missingAssetMessage, 'Reference images is required before generating.');

  const lumaMessage = getStartRenderValidationMessage({
    audioWorkflowUnsupported: false,
    audioUnsupportedMessage: 'Audio workflow is unsupported.',
    multiPromptActive: false,
    multiPromptInvalid: false,
    multiPromptError: null,
    promptLength: 10,
    promptCharLimitExceeded: false,
    promptMaxChars: undefined,
    selectedEngineLabel: 'Luma Ray 2',
    trimmedPrompt: 'a prompt',
    trimmedNegativePrompt: '',
    inputSchemaSummary: baseSchemaSummary({ promptRequired: true }),
    inputAssets: {},
    extraInputFields: [],
    form: baseForm({ engineId: 'lumaRay2', durationOption: '12s' }),
    lumaContext: getLumaRay2GenerationContext({
      selectedEngineId: 'lumaRay2',
      submissionMode: 't2v',
      form: baseForm({ engineId: 'lumaRay2', durationOption: '12s' }),
    }),
  });

  assert.equal(lumaMessage, LUMA_RAY2_ERROR_UNSUPPORTED);
});

test('iteration guard preserves mode-specific media requirements', () => {
  assert.equal(
    getGenerationIterationGuardMessage({
      selectedEngineId: 'seedance-2-0',
      submissionMode: 'ref2v',
      allowsUnifiedVeoFirstLast: false,
      hasLastFrameInput: false,
      isUnifiedSeedance: true,
      primaryImageUrl: undefined,
      primaryAudioUrl: undefined,
      primaryAssetFieldLabel: 'Image',
      referenceImageUrls: [],
      referenceVideoUrls: [],
      referenceAudioUrls: ['https://cdn.example.com/audio.wav'],
      inputsPayload: [],
      primaryAttachment: null,
      extendOrRetakeSourceVideoMessage: 'Add a source video before running this mode.',
    }),
    'Add reference media before adding audio.'
  );

  const firstFrame: GenerationAttachmentPayload = {
    name: 'first.png',
    type: 'image/png',
    size: 1,
    kind: 'image',
    slotId: 'first_frame_url',
    url: 'https://cdn.example.com/same.png',
    assetId: 'same',
  };
  const lastFrame: GenerationAttachmentPayload = {
    ...firstFrame,
    name: 'last.png',
    slotId: 'last_frame_url',
  };

  assert.equal(
    getGenerationIterationGuardMessage({
      selectedEngineId: 'veo-3-1',
      submissionMode: 'fl2v',
      allowsUnifiedVeoFirstLast: false,
      hasLastFrameInput: true,
      isUnifiedSeedance: false,
      primaryImageUrl: firstFrame.url,
      primaryAudioUrl: undefined,
      primaryAssetFieldLabel: 'Start image',
      referenceImageUrls: [],
      referenceVideoUrls: [],
      referenceAudioUrls: [],
      inputsPayload: [firstFrame, lastFrame],
      primaryAttachment: firstFrame,
      extendOrRetakeSourceVideoMessage: 'Add a source video before running this mode.',
    }),
    'First and last frames must be two different images for this engine.'
  );
});

test('workspace generate payload resolves provider-specific options', () => {
  const form = baseForm({
    engineId: 'lumaRay2',
    durationSec: 9,
    durationOption: '9s',
    resolution: '1080p',
    loop: true,
    audio: true,
    seed: 42.8,
    cameraFixed: false,
    safetyChecker: true,
  });
  const capability: EngineModeUiCaps = {
    modes: ['t2v'],
    duration: { options: ['5s', '9s'] },
    resolution: ['540p', '720p', '1080p'],
    aspectRatio: ['16:9'],
    fps: [24],
    audioToggle: true,
  };

  const result = buildWorkspaceGeneratePayload({
    selectedEngineId: 'lumaRay2',
    activeMode: 't2v',
    submissionMode: 't2v',
    form,
    trimmedPrompt: 'cinematic prompt',
    trimmedNegativePrompt: 'blur',
    effectiveDurationSec: 9,
    memberTier: 'pro',
    paymentMode: 'wallet',
    cfgScale: 7,
    capability,
    supportsNegativePrompt: true,
    supportsAudioToggle: true,
    isSeedance: false,
    supportsKlingV3Controls: true,
    supportsKlingV3VoiceControl: true,
    voiceIds: ['voice-1'],
    voiceControlEnabled: true,
    shotType: 'intelligent',
    localKey: 'local-1',
    batchId: 'batch-1',
    iterationIndex: 0,
    iterationCount: 2,
    friendlyMessage: 'Take 1 of 2',
    etaSeconds: 6,
    etaLabel: '~6 sec',
    lumaContext: getLumaRay2GenerationContext({
      selectedEngineId: 'lumaRay2',
      submissionMode: 't2v',
      form,
    }),
    inputsPayload: [],
    primaryImageUrl: 'https://cdn.example.com/start.png',
    primaryAudioUrl: 'https://cdn.example.com/audio.wav',
    referenceImageUrls: ['https://cdn.example.com/ref.png'],
    endImageUrl: 'https://cdn.example.com/end.png',
    extraInputValues: { style: 'cinematic' },
    multiPromptPayload: [{ prompt: 'scene one', duration: 5 }],
    klingElementsPayload: [{ frontalImageUrl: 'https://cdn.example.com/frontal.png' }],
  });

  assert.equal(result.resolvedDurationSeconds, 9);
  assert.equal(result.payload.durationOption, '9s');
  assert.equal(result.payload.resolution, '1080p');
  assert.equal(result.payload.loop, true);
  assert.equal(result.payload.shotType, 'intelligent');
  assert.deepEqual(result.payload.voiceIds, ['voice-1']);
  assert.equal(result.payload.imageUrl, 'https://cdn.example.com/start.png');
  assert.deepEqual(result.payload.referenceImages, ['https://cdn.example.com/ref.png']);
  assert.deepEqual(result.payload.extraInputValues, { style: 'cinematic' });
});
