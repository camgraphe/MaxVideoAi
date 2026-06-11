import assert from 'node:assert/strict';
import test from 'node:test';

import { LUMA_RAY2_ERROR_UNSUPPORTED } from '../frontend/src/lib/luma-ray2';
import type { EngineCaps, EngineInputField, EngineModeUiCaps } from '../frontend/types/engines';
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
import {
  summarizeWorkspaceInputSchema,
  type WorkspaceInputSchemaSummary,
} from '../frontend/app/(core)/(workspace)/app/_lib/workspace-input-schema';
import type { ReferenceAsset } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-assets';
import { listFalEngines } from '../frontend/src/config/falEngines.ts';
import { buildFalGenerationRequest } from '../frontend/src/lib/fal-request-body';
import { supportsAudioPricingToggle } from '../frontend/src/lib/pricing-addons';
import { getBaseEngines } from '../frontend/src/lib/engines';
import {
  buildComposerModeToggles,
  coerceFormState,
  getEngineModeOptions,
  getModeCaps,
  getPreferredEngineMode,
  isWorkspaceModeAvailable,
  resolveSelectedWorkspaceEngine,
  supportsModeAudioControl,
  supportsModeLoopControl,
} from '../frontend/app/(core)/(workspace)/app/_lib/workspace-engine-helpers';

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

function testEngine(id: string, overrides: Partial<EngineCaps> = {}): EngineCaps {
  return {
    id,
    label: id,
    provider: 'test',
    status: 'live',
    latencyTier: 'standard',
    modes: ['t2v'],
    maxDurationSec: 8,
    resolutions: ['720p'],
    aspectRatios: ['16:9'],
    fps: [24],
    audio: false,
    upscale4k: false,
    extend: false,
    motionControls: false,
    keyframes: false,
    params: {},
    inputLimits: {},
    updatedAt: '2026-05-17T00:00:00.000Z',
    ttlSec: 60,
    availability: 'available',
    ...overrides,
  } as EngineCaps;
}

test('selected workspace engine keeps chip changes authoritative over stale engine URL tokens', () => {
  const engines = [testEngine('veo-3-1'), testEngine('veo-3-1-fast'), testEngine('veo-3-1-lite')];
  const standardUrlOverride = engines[0];

  assert.equal(
    resolveSelectedWorkspaceEngine({
      engines,
      form: null,
      engineOverride: standardUrlOverride,
    })?.id,
    'veo-3-1'
  );

  assert.equal(
    resolveSelectedWorkspaceEngine({
      engines,
      form: baseForm({ engineId: 'veo-3-1-fast' }),
      engineOverride: standardUrlOverride,
    })?.id,
    'veo-3-1-fast'
  );
});

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

test('workspace initializes and sends mode-scoped Luma Ray 3.2 loop controls', () => {
  const ray32 = listFalEngines().find((entry) => entry.id === 'luma-ray-3-2')?.engine;
  assert.ok(ray32);

  assert.equal(supportsModeLoopControl(ray32, 't2v'), true);
  assert.equal(supportsModeLoopControl(ray32, 'i2v'), true);

  const form = coerceFormState(ray32, 't2v', null);
  assert.equal(form.loop, false);

  const capability = getModeCaps(ray32, 't2v');
  const result = buildWorkspaceGeneratePayload({
    selectedEngineId: 'luma-ray-3-2',
    activeMode: 't2v',
    submissionMode: 't2v',
    form: { ...form, loop: true },
    trimmedPrompt: 'Cinematic product reveal',
    trimmedNegativePrompt: '',
    effectiveDurationSec: 5,
    memberTier: 'pro',
    paymentMode: 'wallet',
    capability,
    supportsNegativePrompt: false,
    supportsAudioToggle: false,
    isSeedance: false,
    supportsKlingV3Controls: false,
    supportsKlingV3VoiceControl: false,
    voiceIds: [],
    voiceControlEnabled: false,
    shotType: 'customize',
    localKey: 'local-ray32',
    batchId: 'batch-ray32',
    iterationIndex: 0,
    iterationCount: 1,
    friendlyMessage: 'Take 1',
    lumaContext: getLumaRay2GenerationContext({
      selectedEngineId: 'luma-ray-3-2',
      submissionMode: 't2v',
      form: { ...form, loop: true },
    }),
    inputsPayload: [],
    referenceImageUrls: ['https://cdn.example.com/ref.png'],
    extraInputValues: {},
  });

  assert.equal(result.payload.loop, true);
  assert.equal(result.payload.durationOption, '5s');
  assert.deepEqual(result.payload.referenceImages, ['https://cdn.example.com/ref.png']);
});

test('workspace unifies Luma Ray 3.2 text and image generation under Generate Video', () => {
  const ray32 = listFalEngines().find((entry) => entry.id === 'luma-ray-3-2')?.engine;
  assert.ok(ray32);

  assert.equal(getPreferredEngineMode(ray32), 'v2v');
  assert.equal(getPreferredEngineMode(ray32, 't2v'), 't2v');
  assert.deepEqual(
    buildComposerModeToggles({
      selectedEngine: ray32,
      audioWorkflowLocked: false,
      uiLocale: 'en',
      workflowCopy: {
        generateVideo: 'Generate Video',
        removeAudioToUnlock: 'Remove audio',
        audioUnsupported: 'Audio unsupported',
        audioLocked: 'Audio locked',
        audioLockedFallback: 'Audio locked',
      },
    })?.map((entry) => entry.mode),
    [null, 'v2v', 'reframe']
  );

  const generateSchema = summarizeWorkspaceInputSchema({
    selectedEngine: ray32,
    activeMode: 't2v',
    allowsUnifiedVeoFirstLast: false,
    isUnifiedHappyHorse: false,
    isUnifiedSeedance: false,
    uiLocale: 'en',
  });

  assert.ok(generateSchema.assetFields.some(({ field }) => field.id === 'image_url'));
});

test('workspace exposes Veo 3.1 manual modes by variant', () => {
  const veoFast = listFalEngines().find((entry) => entry.id === 'veo-3-1-fast')?.engine;
  const veoLite = listFalEngines().find((entry) => entry.id === 'veo-3-1-lite')?.engine;

  assert.ok(veoFast);
  assert.ok(veoLite);
  assert.deepEqual(getEngineModeOptions(veoFast), ['ref2v', 'extend']);
  assert.deepEqual(getEngineModeOptions(veoLite), ['extend']);
});

test('workspace treats Kling 3.0 Omni as one unified inferred composer', () => {
  const klingO3Pro = listFalEngines().find((entry) => entry.id === 'kling-o3-pro')?.engine;
  const klingO34k = listFalEngines().find((entry) => entry.id === 'kling-o3-4k')?.engine;

  assert.ok(klingO3Pro);
  assert.ok(klingO34k);
  assert.equal(getEngineModeOptions(klingO3Pro), undefined);
  assert.equal(getEngineModeOptions(klingO34k), undefined);
  assert.equal(
    buildComposerModeToggles({
      selectedEngine: klingO3Pro,
      audioWorkflowLocked: false,
      uiLocale: 'en',
      workflowCopy: {
        generateVideo: 'Generate Video',
        removeAudioToUnlock: 'Remove audio',
        audioUnsupported: 'Audio unsupported',
        audioLocked: 'Audio locked',
        audioLockedFallback: 'Audio locked',
      },
    }),
    undefined
  );
  assert.equal(
    buildComposerModeToggles({
      selectedEngine: klingO34k,
      audioWorkflowLocked: false,
      uiLocale: 'en',
      workflowCopy: {
        generateVideo: 'Generate Video',
        removeAudioToUnlock: 'Remove audio',
        audioUnsupported: 'Audio unsupported',
        audioLocked: 'Audio locked',
        audioLockedFallback: 'Audio locked',
      },
    }),
    undefined
  );

  const v2vSchema = summarizeWorkspaceInputSchema({
    selectedEngine: klingO3Pro,
    activeMode: 'v2v',
    allowsUnifiedVeoFirstLast: false,
    isUnifiedHappyHorse: false,
    isUnifiedSeedance: false,
    uiLocale: 'en',
  });

  assert.deepEqual(
    v2vSchema.assetFields.map(({ field }) => field.id),
    ['image_urls', 'image_url', 'end_image_url', 'video_url']
  );
  assert.ok(v2vSchema.secondaryFields.some(({ field }) => field.id === 'keep_audio' && field.type === 'boolean'));

  const generateSchema = summarizeWorkspaceInputSchema({
    selectedEngine: klingO3Pro,
    activeMode: 't2v',
    allowsUnifiedVeoFirstLast: false,
    isUnifiedHappyHorse: false,
    isUnifiedSeedance: false,
    uiLocale: 'en',
  });

  assert.deepEqual(
    generateSchema.assetFields.map(({ field }) => field.id),
    ['image_urls', 'image_url', 'end_image_url', 'video_url']
  );

  const fourKSchema = summarizeWorkspaceInputSchema({
    selectedEngine: klingO34k,
    activeMode: 't2v',
    allowsUnifiedVeoFirstLast: false,
    isUnifiedHappyHorse: false,
    isUnifiedSeedance: false,
    uiLocale: 'en',
  });

  assert.deepEqual(
    fourKSchema.assetFields.map(({ field }) => field.id),
    ['image_urls', 'image_url', 'end_image_url']
  );
});

test('workspace sends Kling 3.0 Omni 4K audio even without a pricing toggle', () => {
  const klingO34k = listFalEngines().find((entry) => entry.id === 'kling-o3-4k')?.engine;
  assert.ok(klingO34k);

  const capability = getModeCaps(klingO34k, 't2v');
  assert.equal(supportsAudioPricingToggle(klingO34k), false);
  assert.equal(supportsModeAudioControl(klingO34k, 't2v', capability), true);

  const result = buildWorkspaceGeneratePayload({
    selectedEngineId: 'kling-o3-4k',
    activeMode: 't2v',
    submissionMode: 't2v',
    form: baseForm({
      engineId: 'kling-o3-4k',
      mode: 't2v',
      durationSec: 5,
      durationOption: '5',
      resolution: '4k',
      audio: true,
    }),
    trimmedPrompt: 'A clean 4K cinematic product reveal with ambient sound.',
    trimmedNegativePrompt: '',
    effectiveDurationSec: 5,
    memberTier: 'pro',
    paymentMode: 'wallet',
    capability,
    supportsNegativePrompt: false,
    supportsAudioToggle: supportsModeAudioControl(klingO34k, 't2v', capability),
    isSeedance: false,
    supportsKlingV3Controls: false,
    supportsKlingV3VoiceControl: false,
    voiceIds: [],
    voiceControlEnabled: false,
    shotType: 'customize',
    localKey: 'local-o3-4k',
    batchId: 'batch-o3-4k',
    iterationIndex: 0,
    iterationCount: 1,
    friendlyMessage: 'Take 1',
    lumaContext: getLumaRay2GenerationContext({
      selectedEngineId: 'kling-o3-4k',
      submissionMode: 't2v',
      form: baseForm({ engineId: 'kling-o3-4k', mode: 't2v' }),
    }),
    inputsPayload: [],
    referenceImageUrls: [],
    extraInputValues: {},
  });

  assert.equal(result.payload.audio, true);

  const falRequest = buildFalGenerationRequest(result.payload, 'fal-ai/kling-video/o3/4k/text-to-video');
  assert.equal(falRequest.requestBody.generate_audio, true);
});

test('iteration guard allows Kling 3.0 Omni reference mode from subject elements only', () => {
  const guardOptions = {
    selectedEngineId: 'kling-o3-pro',
    submissionMode: 'ref2v',
    allowsUnifiedVeoFirstLast: false,
    hasLastFrameInput: false,
    isUnifiedSeedance: false,
    primaryImageUrl: undefined,
    primaryAudioUrl: undefined,
    primaryAssetFieldLabel: 'Image',
    referenceImageUrls: [],
    referenceVideoUrls: [],
    referenceAudioUrls: [],
    inputsPayload: [],
    primaryAttachment: null,
    extendOrRetakeSourceVideoMessage: 'Add a source video before running this mode.',
    hasKlingElements: true,
  };

  assert.equal(getGenerationIterationGuardMessage(guardOptions), null);
});

test('workspace hides Veo manual workflow toggles when the mode is not actually available', () => {
  const veoFast = getBaseEngines().find((entry) => entry.id === 'veo-3-1-fast');
  assert.ok(veoFast);

  const modeCapsWithoutReference = { ...(veoFast.modeCaps ?? {}) };
  delete modeCapsWithoutReference.ref2v;
  const withoutReferenceCaps: EngineCaps = {
    ...veoFast,
    modeCaps: modeCapsWithoutReference,
  };

  assert.equal(isWorkspaceModeAvailable(withoutReferenceCaps, 'ref2v'), false);
  assert.deepEqual(getEngineModeOptions(withoutReferenceCaps), ['extend']);
  assert.deepEqual(
    buildComposerModeToggles({
      selectedEngine: withoutReferenceCaps,
      audioWorkflowLocked: false,
      uiLocale: 'en',
      workflowCopy: {
        generateVideo: 'Generate Video',
        removeAudioToUnlock: 'Remove audio',
        audioUnsupported: 'Audio unsupported',
        audioLocked: 'Audio locked',
        audioLockedFallback: 'Audio locked',
      },
    })?.map((entry) => entry.mode),
    [null, 'extend']
  );

  const withoutExtendInput: EngineCaps = {
    ...veoFast,
    inputSchema: {
      ...veoFast.inputSchema,
      required: veoFast.inputSchema?.required?.filter(
        (field) => !field.modes?.includes('extend') && !field.requiredInModes?.includes('extend')
      ),
    },
  };

  assert.equal(isWorkspaceModeAvailable(withoutExtendInput, 'extend'), false);
  assert.deepEqual(getEngineModeOptions(withoutExtendInput), ['ref2v']);
  assert.deepEqual(
    buildComposerModeToggles({
      selectedEngine: withoutExtendInput,
      audioWorkflowLocked: false,
      uiLocale: 'en',
      workflowCopy: {
        generateVideo: 'Generate Video',
        removeAudioToUnlock: 'Remove audio',
        audioUnsupported: 'Audio unsupported',
        audioLocked: 'Audio locked',
        audioLockedFallback: 'Audio locked',
      },
    })?.map((entry) => entry.mode),
    [null, 'ref2v']
  );
});
