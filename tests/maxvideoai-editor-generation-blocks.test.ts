import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { DEFAULT_STUDIO_COPY } from '../frontend/app/(core)/(workspace)/app/studio/_lib/studio-copy';
import {
  getWorkspaceBlockPreset,
  WORKSPACE_BLOCK_PRESETS,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-block-presets';
import {
  getWorkspaceModelCapabilities,
  validateShotConnections,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-capabilities';
import {
  normalizeWorkspaceGraphNodes,
  shotOutputSourceHandle,
  normalizeChatSettings,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_state/workspace-normalizers';
import {
  audioPackForWorkflow,
  angleEngineIdForStudioModel,
  resolveWorkspaceGenerationRoute,
  upscaleEngineIdForStudioModel,
  workspaceVideoReferencesForGeneration,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-generation-routing';
import {
  buildWorkspaceAngleToolRequest,
  buildWorkspaceAudioGenerateRequest,
  buildWorkspaceCharacterBuilderRequest,
  buildWorkspaceChatApiRequest,
  buildWorkspaceImageGenerationRequest,
  buildWorkspaceUpscaleToolRequest,
  workspaceChatContextSummariesForNode,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-tool-requests';
import {
  buildWorkspaceToolPricingEstimate,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-tool-pricing';
import {
  buildWorkspaceShotPreflightRequest,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-pricing';
import {
  localizeWorkspaceNodeSubtitle,
  localizeWorkspaceNodeTitle,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-generated-copy';
import {
  compactStudioChatMessages,
  formatStudioChatContextSummaries,
  getDefaultStudioChatModel,
  getStudioChatModels,
  isStudioChatModelAllowed,
} from '../frontend/lib/studio-chat-models';
import {
  compatibleCapabilitiesForShot,
  isToolOnlyPreset,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-shot-inspector-helpers';
import { buildWorkspaceShotGenerateRequest } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-generation';
import {
  getWorkspaceBlockCompatibleCapabilities,
  resolveWorkspaceBlockPolicy,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/models/workspace-block-capability-policy';
import { getWorkspaceV1BlockContract } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/models/workspace-v1-block-matrix';
import type {
  WorkspaceEdgeKind,
  WorkspaceGenerationFamily,
  WorkspaceGenerationPresetId,
  WorkspaceGraphNode,
  WorkspaceShotSettings,
  WorkspaceWorkflowType,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-types';
import type { CharacterBuilderTraits } from '../frontend/types/character-builder';

const root = process.cwd();

type PolicyMatrixExpectation = {
  presetId: WorkspaceGenerationPresetId;
  defaultModelId: string;
  family: WorkspaceGenerationFamily;
  workflow: WorkspaceWorkflowType;
  outputMediaKind: 'audio' | 'image' | 'text' | 'video';
  outputCount: number | { min: number; max: number };
  requiredInputs: WorkspaceEdgeKind[];
  optionalInputs: WorkspaceEdgeKind[];
  readyInputs: WorkspaceEdgeKind[];
  missingInputs: WorkspaceEdgeKind[];
  mode: string;
  pricingAvailable: boolean;
  missingReason: boolean;
};

const BASE_POLICY_TEST_SHOT: Omit<WorkspaceShotSettings, 'modelId' | 'workflowType'> = {
  durationSec: 1,
  aspectRatio: '16:9',
  resolution: '1080p',
  fps: 24,
  seed: null,
  audioEnabled: false,
  lipSyncEnabled: false,
  referenceStrength: 0.65,
  outputName: 'Policy matrix test',
  status: 'draft',
};

function policySettingsForPreset(expectation: PolicyMatrixExpectation): WorkspaceShotSettings {
  const preset = getWorkspaceBlockPreset(expectation.presetId);
  assert.ok(preset, `${expectation.presetId} should exist`);
  if (preset.defaultShot) return preset.defaultShot;
  return {
    ...BASE_POLICY_TEST_SHOT,
    presetId: expectation.presetId,
    family: preset.family,
    outputKind: preset.outputKind as WorkspaceShotSettings['outputKind'],
    modelId: preset.defaultModelId,
    workflowType: preset.defaultWorkflowType,
  };
}

function resolvePolicyForPreset(expectation: PolicyMatrixExpectation, connectedInputs: WorkspaceEdgeKind[]) {
  const capabilities = getWorkspaceModelCapabilities();
  const settings = policySettingsForPreset(expectation);
  const capability = capabilities.find((candidate) => candidate.id === expectation.defaultModelId) ?? null;
  assert.ok(capability, `${expectation.defaultModelId} should resolve to a model capability`);
  return resolveWorkspaceBlockPolicy({
    settings,
    capability,
    connectedInputs,
  }) as ReturnType<typeof resolveWorkspaceBlockPolicy> & {
    optionalInputs?: WorkspaceEdgeKind[];
    outputMediaKind?: 'audio' | 'image' | 'text' | 'video';
    outputCount?: number | { min: number; max: number };
    controlFields?: string[];
    pricingRelevantFields?: string[];
    disabledReason?: string;
  };
}

function defaultShotForPreset(presetId: WorkspaceGenerationPresetId): WorkspaceShotSettings {
  const shot = getWorkspaceBlockPreset(presetId)?.defaultShot;
  assert.ok(shot, `${presetId} should expose default shot settings`);
  return shot;
}

test('every Studio V1 generation preset selects a compatible default model', () => {
  const capabilities = getWorkspaceModelCapabilities();
  for (const preset of WORKSPACE_BLOCK_PRESETS.filter((candidate) => candidate.defaultShot)) {
    const compatible = getWorkspaceBlockCompatibleCapabilities({
      settings: preset.defaultShot!,
      capabilities,
    });
    assert.ok(
      compatible.some((capability) => capability.id === preset.defaultShot!.modelId),
      `${preset.id} default model ${preset.defaultShot!.modelId} must be compatible`
    );
  }
});

test('Studio canvas exposes generation block presets for every requested workflow', () => {
  const presetIds = WORKSPACE_BLOCK_PRESETS.map((preset) => preset.id);
  for (const id of [
    'generate-image',
    'modify-image',
    'generate-video',
    'storyboard',
    'character-builder',
    'angle',
    'modify-video',
    'upscale-image',
    'upscale-video',
    'audio-music',
    'audio-voiceover',
    'audio-sfx',
    'audio-sound-design',
    'audio-sound-design-voice',
    'chat-box',
  ]) {
    assert.ok(presetIds.includes(id), `${id} should be exposed as a Studio block preset`);
  }

  assert.equal(getWorkspaceBlockPreset('generate-image')?.outputKind, 'image');
  assert.equal(getWorkspaceBlockPreset('modify-image')?.defaultShot?.workflowType, 'image_to_image');
  assert.equal(getWorkspaceBlockPreset('audio-music')?.outputKind, 'audio');
  assert.equal(getWorkspaceBlockPreset('chat-box')?.family, 'chat');
});

test('Studio block policy derives storyboard controls and pricing from its V1 contract', () => {
  const settings = defaultShotForPreset('storyboard');
  const capability = getWorkspaceModelCapabilities().find((candidate) => candidate.id === settings.modelId) ?? null;
  const contract = getWorkspaceV1BlockContract('storyboard');
  assert.ok(capability);

  const policy = resolveWorkspaceBlockPolicy({
    settings,
    capability,
    connectedInputs: ['prompt'],
  });

  assert.deepEqual(policy.optionalInputs, contract.optionalInputs);
  assert.deepEqual(policy.controlFields, contract.visibleControls);
  assert.deepEqual(policy.pricingRelevantFields, contract.pricingRelevantFields);
});

test('Studio specialized tool presets route to product tools instead of generic video models', () => {
  const character = getWorkspaceBlockPreset('character-builder');
  assert.equal(getWorkspaceBlockPreset('character-video')?.id, 'character-builder');
  assert.equal(character?.defaultShot?.toolKind, 'character-builder');
  assert.equal(character?.family, 'image');
  assert.equal(character?.outputKind, 'image');
  assert.equal(character?.defaultModelId, 'character-builder-tool');
  assert.equal(character?.defaultWorkflowType, 'character_builder');

  const storyboard = getWorkspaceBlockPreset('storyboard');
  assert.equal(getWorkspaceBlockPreset('storyboard-video')?.id, 'storyboard');
  assert.equal(storyboard?.defaultShot?.toolKind, 'storyboard');
  assert.equal(storyboard?.family, 'image');
  assert.equal(storyboard?.outputKind, 'image');
  assert.equal(storyboard?.defaultModelId, 'storyboard-gpt-image-2');
  assert.equal(storyboard?.defaultWorkflowType, 'storyboard_generation');

  const angle = getWorkspaceBlockPreset('angle');
  assert.equal(angle?.defaultShot?.toolKind, 'angle');
  assert.equal(angle?.family, 'image');
  assert.equal(angle?.outputKind, 'image');
  assert.equal(angle?.defaultModelId, 'angle-flux-multiple-angles');
  assert.equal(angle?.defaultWorkflowType, 'angle_generation');

  const modifyVideo = getWorkspaceBlockPreset('modify-video');
  assert.equal(modifyVideo?.defaultModelId, 'luma-ray-3-2');
  assert.equal(modifyVideo?.defaultShot?.modelId, 'luma-ray-3-2');
});

test('Studio generation block output handles match the generated media type', () => {
  const expectedHandles = new Map([
    ['generate-image', 'reference'],
    ['storyboard', 'reference'],
    ['character-builder', 'reference'],
    ['angle', 'reference'],
    ['upscale-image', 'reference'],
    ['generate-video', 'video_reference'],
    ['modify-video', 'video_reference'],
    ['upscale-video', 'video_reference'],
    ['audio-music', 'audio'],
    ['audio-voiceover', 'audio'],
    ['audio-sfx', 'audio'],
    ['audio-sound-design', 'audio'],
    ['audio-sound-design-voice', 'audio'],
  ]);

  for (const [presetId, expectedHandle] of expectedHandles) {
    const preset = getWorkspaceBlockPreset(presetId);
    assert.ok(preset?.defaultShot, `${presetId} should expose default shot settings`);
    assert.equal(
      shotOutputSourceHandle(preset.defaultShot),
      expectedHandle,
      `${presetId} should expose a ${expectedHandle} source handle`
    );
  }
});

test('Studio graph normalization migrates stale generated block source handles to typed media outputs', () => {
  const angleShot = getWorkspaceBlockPreset('angle')?.defaultShot;
  const musicShot = getWorkspaceBlockPreset('audio-music')?.defaultShot;
  const videoShot = getWorkspaceBlockPreset('generate-video')?.defaultShot;
  assert.ok(angleShot);
  assert.ok(musicShot);
  assert.ok(videoShot);

  const normalized = normalizeWorkspaceGraphNodes([
    {
      id: 'angle-node',
      type: 'shot',
      position: { x: 0, y: 0 },
      data: {
        kind: 'shot',
        title: 'Angle',
        subtitle: 'Angle',
        sourceHandles: ['generated_output'],
        targetHandles: [],
        shot: angleShot,
      },
    },
    {
      id: 'music-node',
      type: 'shot',
      position: { x: 0, y: 0 },
      data: {
        kind: 'shot',
        title: 'Music',
        subtitle: 'Music',
        sourceHandles: ['generated_output'],
        targetHandles: [],
        shot: musicShot,
      },
    },
    {
      id: 'video-node',
      type: 'shot',
      position: { x: 0, y: 0 },
      data: {
        kind: 'shot',
        title: 'Video',
        subtitle: 'Video',
        sourceHandles: ['generated_output'],
        targetHandles: [],
        shot: videoShot,
      },
    },
  ]);

  assert.deepEqual(normalized.find((node) => node.id === 'angle-node')?.data.sourceHandles, ['reference']);
  assert.deepEqual(normalized.find((node) => node.id === 'music-node')?.data.sourceHandles, ['audio']);
  assert.deepEqual(normalized.find((node) => node.id === 'video-node')?.data.sourceHandles, ['video_reference']);
});

test('Studio Angle generation materializes pending outputs through an image source handle', async () => {
  const { createPendingWorkspaceOutput } = await import(
    '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-generation'
  );
  const { filterRenderableWorkspaceEdges } = await import(
    '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-render-edges'
  );
  const angleShot = getWorkspaceBlockPreset('angle')?.defaultShot;
  assert.ok(angleShot);
  const shotNode = {
    id: 'angle-node',
    type: 'shot',
    position: { x: 0, y: 0 },
    data: {
      kind: 'shot',
      title: 'Angle generation',
      subtitle: 'Angle generation',
      sourceHandles: ['reference'],
      targetHandles: ['reference', 'prompt'],
      shot: angleShot,
    },
  };

  const pending = createPendingWorkspaceOutput({
    shotNode,
    settings: angleShot,
    capability: null,
    nodes: [shotNode],
    edges: [],
    siblingCount: 0,
  });

  assert.equal(pending.output.kind, 'image');
  assert.deepEqual(pending.outputNode.data.sourceHandles ?? [], ['reference']);
  assert.equal(pending.outputEdge.sourceHandle, 'reference');
  assert.equal(pending.outputEdge.targetHandle, 'generated_output');
  assert.equal(
    filterRenderableWorkspaceEdges([shotNode, pending.outputNode], [pending.outputEdge]).length,
    1,
    'typed image generation output edges should remain renderable into the output block'
  );
});

test('Studio toolbar exposes specialized tool menus without stale generic video duplicates', () => {
  const toolbarSource = readFileSync(
    join(root, 'frontend/app/(core)/(workspace)/app/studio/workspace/_components/canvas/CanvasFloatingToolbar.tsx'),
    'utf8'
  );
  const workspaceTypesSource = readFileSync(
    join(root, 'frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-types.ts'),
    'utf8'
  );

  for (const presetId of [
    'generate-image',
    'character-builder',
    'angle',
    'upscale-image',
    'generate-video',
    'modify-video',
    'upscale-video',
    'audio-music',
    'audio-voiceover',
    'audio-sfx',
    'audio-sound-design',
    'audio-sound-design-voice',
    'chat-box',
  ]) {
    assert.match(toolbarSource, new RegExp(`presetBlock\\('${presetId}'`), `${presetId} should be exposed in the toolbar`);
  }

  assert.doesNotMatch(toolbarSource, /presetBlock\('storyboard-video'/);
  assert.doesNotMatch(toolbarSource, /presetBlock\('character-video'/);
  assert.doesNotMatch(workspaceTypesSource, /'storyboard-video'/);
  assert.doesNotMatch(workspaceTypesSource, /'character-video'/);
});

test('Studio specialized tool copy has real labels instead of preset-id fallbacks', () => {
  assert.equal(DEFAULT_STUDIO_COPY.canvas.nodes.angle, 'Angle');
  assert.match(DEFAULT_STUDIO_COPY.canvas.nodes.angleDescription, /camera angle/i);
  assert.equal(DEFAULT_STUDIO_COPY.canvas.nodes.soundDesign, 'Sound design');
  assert.equal(DEFAULT_STUDIO_COPY.canvas.nodes.soundDesignVoice, 'Sound design + voice');
  assert.doesNotMatch(DEFAULT_STUDIO_COPY.canvas.nodes.characterGenerationSubtitle, /video/i);
  assert.doesNotMatch(DEFAULT_STUDIO_COPY.canvas.nodes.storyboardGenerationSubtitle, /video/i);
});

test('saved specialized nodes without generated copy references re-localize from their preset id', () => {
  const characterShot = getWorkspaceBlockPreset('character-builder')?.defaultShot;
  const storyboardShot = getWorkspaceBlockPreset('storyboard')?.defaultShot;
  assert.ok(characterShot);
  assert.ok(storyboardShot);

  const characterNode = {
    id: 'legacy-character-node',
    type: 'shot',
    position: { x: 0, y: 0 },
    data: {
      kind: 'shot',
      title: 'Generation personnage',
      subtitle: 'Reference personnage vers video.',
      sourceHandles: [],
      targetHandles: [],
      shot: {
        ...characterShot,
        presetId: 'character-video' as WorkspaceShotSettings['presetId'],
      },
    },
  };
  const storyboardNode = {
    id: 'legacy-storyboard-node',
    type: 'shot',
    position: { x: 0, y: 0 },
    data: {
      kind: 'shot',
      title: 'Generation storyboard',
      subtitle: 'Panneaux storyboard vers video.',
      sourceHandles: [],
      targetHandles: [],
      shot: {
        ...storyboardShot,
        presetId: 'storyboard-video' as WorkspaceShotSettings['presetId'],
      },
    },
  };

  assert.equal(localizeWorkspaceNodeTitle(characterNode, DEFAULT_STUDIO_COPY.canvas.nodes), 'Character Builder');
  assert.equal(
    localizeWorkspaceNodeSubtitle(characterNode, DEFAULT_STUDIO_COPY.canvas.nodes),
    'Consistent character reference tool.'
  );
  assert.equal(localizeWorkspaceNodeTitle(storyboardNode, DEFAULT_STUDIO_COPY.canvas.nodes), 'Storyboard generation');
  assert.equal(
    localizeWorkspaceNodeSubtitle(storyboardNode, DEFAULT_STUDIO_COPY.canvas.nodes),
    'Storyboard boards and continuity frames.'
  );
});

test('Studio capabilities expose real tool engines and audio packs', () => {
  const capabilities = getWorkspaceModelCapabilities();
  const families = new Set(capabilities.map((capability) => capability.family));
  assert.equal(families.has('image'), true);
  assert.equal(families.has('video'), true);
  assert.equal(families.has('audio'), true);
  assert.equal(families.has('upscale'), true);
  assert.equal(families.has('chat'), true);

  assert.ok(capabilities.some((capability) => capability.id === 'seedream' && capability.outputKind === 'image'));
  assert.ok(capabilities.some((capability) => capability.id === 'audio-music-only' && capability.outputKind === 'audio'));
  assert.ok(capabilities.some((capability) => capability.id === 'audio-sfx-only' && capability.sfx_generation));
  for (const id of ['upscale-image-seedvr', 'upscale-image-topaz', 'upscale-image-recraft-crisp']) {
    assert.ok(capabilities.some((capability) => (
      capability.id === id &&
      capability.outputKind === 'image' &&
      capability.required_inputs.includes('reference')
    )), `${id} should be exposed as an image upscale tool engine`);
  }
  for (const id of ['upscale-video-seedvr', 'upscale-video-flashvsr', 'upscale-video-topaz']) {
    assert.ok(capabilities.some((capability) => (
      capability.id === id &&
      capability.outputKind === 'video' &&
      capability.required_inputs.includes('video_reference')
    )), `${id} should be exposed as a video upscale tool engine`);
  }
  assert.ok(capabilities.some((capability) => (
    capability.id === 'character-builder-tool' &&
    capability.outputKind === 'image' &&
    capability.workflows.includes('character_builder')
  )));
  assert.ok(capabilities.some((capability) => (
    capability.id === 'storyboard-gpt-image-2' &&
    capability.outputKind === 'image' &&
    capability.workflows.includes('storyboard_generation')
  )));
  assert.ok(capabilities.some((capability) => (
    capability.id === 'angle-flux-multiple-angles' &&
    capability.outputKind === 'image' &&
    capability.required_inputs.includes('reference')
  )));
  assert.ok(capabilities.some((capability) => (
    capability.id === 'audio-cinematic' &&
    capability.outputKind === 'audio' &&
    capability.required_inputs.includes('video_reference')
  )));
  assert.ok(capabilities.some((capability) => (
    capability.id === 'audio-cinematic-voice' &&
    capability.outputKind === 'audio' &&
    capability.required_inputs.includes('video_reference') &&
    capability.required_inputs.includes('prompt')
  )));
  assert.ok(capabilities.some((capability) => (
    capability.id === 'studio-chat-openai' &&
    capability.required_inputs.includes('prompt')
  )));
});

test('shot inspector narrows model choices to the selected specialized tool surface', () => {
  const capabilities = getWorkspaceModelCapabilities();
  const character = getWorkspaceBlockPreset('character-builder')?.defaultShot;
  const angle = getWorkspaceBlockPreset('angle')?.defaultShot;
  const upscaleImage = getWorkspaceBlockPreset('upscale-image')?.defaultShot;
  const modifyVideo = getWorkspaceBlockPreset('modify-video')?.defaultShot;

  assert.ok(character);
  assert.equal(isToolOnlyPreset(character), true);
  assert.deepEqual(
    compatibleCapabilitiesForShot(character, capabilities).map((capability) => capability.id),
    ['character-builder-tool']
  );

  assert.ok(angle);
  assert.deepEqual(
    compatibleCapabilitiesForShot(angle, capabilities).map((capability) => capability.id).sort(),
    ['angle-flux-multiple-angles', 'angle-qwen-multiple-angles']
  );

  assert.ok(upscaleImage);
  assert.deepEqual(
    compatibleCapabilitiesForShot(upscaleImage, capabilities).map((capability) => capability.id).sort(),
    ['upscale-image-recraft-crisp', 'upscale-image-seedvr', 'upscale-image-topaz']
  );

  assert.ok(modifyVideo);
  const modifyVideoModelIds = compatibleCapabilitiesForShot(modifyVideo, capabilities).map((capability) => capability.id);
  assert.ok(modifyVideoModelIds.includes('luma-ray-3-2'));
  assert.equal(modifyVideoModelIds.includes('seedance-2-0'), false);
  assert.equal(modifyVideoModelIds.includes('kling-2-1-pro'), false);

  const spoofedGenericCharacter: WorkspaceShotSettings = {
    ...character,
    toolKind: 'character-builder',
    family: 'video',
    outputKind: 'video',
    workflowType: 'image_to_video',
  };
  assert.deepEqual(
    compatibleCapabilitiesForShot(spoofedGenericCharacter, capabilities).map((capability) => capability.id),
    ['character-builder-tool']
  );
});

test('shot inspector model filtering delegates to the block capability policy', () => {
  const helperSource = readFileSync(
    join(root, 'frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-shot-inspector-helpers.ts'),
    'utf8'
  );

  assert.match(helperSource, /getWorkspaceBlockCompatibleCapabilities/);
  assert.match(helperSource, /return getWorkspaceBlockCompatibleCapabilities\(\{/);
});

test('Studio block capability policy separates generate and modify image/video intent', () => {
  const capabilities = getWorkspaceModelCapabilities();
  const generateImage = getWorkspaceBlockPreset('generate-image')?.defaultShot;
  const modifyImage = getWorkspaceBlockPreset('modify-image')?.defaultShot;
  const modifyVideo = getWorkspaceBlockPreset('modify-video')?.defaultShot;
  assert.ok(generateImage);
  assert.ok(modifyImage);
  assert.ok(modifyVideo);

  const generateImagePolicy = resolveWorkspaceBlockPolicy({
    settings: generateImage,
    capability: capabilities.find((capability) => capability.id === generateImage.modelId) ?? null,
    connectedInputs: ['prompt'],
  });
  assert.equal(generateImagePolicy.mode, 'text-to-image');
  assert.equal(generateImagePolicy.canGenerate, true);
  assert.deepEqual(generateImagePolicy.requiredInputs, ['prompt']);

  const modifyImagePolicy = resolveWorkspaceBlockPolicy({
    settings: modifyImage,
    capability: capabilities.find((capability) => capability.id === modifyImage.modelId) ?? null,
    connectedInputs: ['prompt'],
  });
  assert.equal(modifyImagePolicy.mode, 'image-edit');
  assert.equal(modifyImagePolicy.canGenerate, false);
  assert.deepEqual(modifyImagePolicy.missingInputs, ['reference']);

  const modifyImageCapabilities = getWorkspaceBlockCompatibleCapabilities({
    settings: modifyImage,
    capabilities,
  });
  assert.ok(modifyImageCapabilities.length > 0);
  assert.equal(
    modifyImageCapabilities.every((capability) => capability.family === 'image' && capability.workflows.includes('image_to_image')),
    true
  );

  const modifyVideoCapabilities = getWorkspaceBlockCompatibleCapabilities({
    settings: modifyVideo,
    capabilities,
  });
  assert.ok(modifyVideoCapabilities.some((capability) => capability.id === 'luma-ray-3-2'));
  assert.equal(
    modifyVideoCapabilities.every((capability) => capability.family === 'video' && capability.workflows.includes('video_to_video')),
    true
  );
});

test('modify video validation rejects stale non-allowlisted video-to-video models', () => {
  const capabilities = getWorkspaceModelCapabilities();
  const modifyVideo = getWorkspaceBlockPreset('modify-video')?.defaultShot;
  const staleCapability = capabilities.find((capability) => capability.id === 'happy-horse-1-0');
  assert.ok(modifyVideo);
  assert.ok(staleCapability?.workflows.includes('video_to_video'));

  const validation = validateShotConnections({
    settings: { ...modifyVideo, modelId: staleCapability.id },
    connectedInputs: ['prompt', 'video_reference'],
    capabilities,
  });

  assert.equal(validation.canGenerate, false);
});

test('Generate Video validation rejects storyboard-only models without a reference', () => {
  const capabilities = getWorkspaceModelCapabilities();
  const generateVideo = getWorkspaceBlockPreset('generate-video')?.defaultShot;
  const sourceCapability = capabilities.find((capability) => capability.id === 'seedance-2-0');
  assert.ok(generateVideo);
  assert.ok(sourceCapability);

  const storyboardOnlyCapability = {
    ...sourceCapability,
    id: 'test-storyboard-only-video',
    workflows: ['storyboard_to_video'] as const,
    text_to_video: false,
    image_to_video: false,
    video_to_video: false,
    storyboard_to_video: true,
    character_to_video: false,
  };

  const validation = validateShotConnections({
    settings: { ...generateVideo, modelId: storyboardOnlyCapability.id },
    connectedInputs: ['prompt'],
    capabilities: [...capabilities, storyboardOnlyCapability],
  });

  assert.equal(validation.canGenerate, false);
});

test('Generate Video request routing follows the policy workflow for storyboard, character, and first-last inputs', () => {
  const capabilities = getWorkspaceModelCapabilities();
  const generateVideo = getWorkspaceBlockPreset('generate-video')?.defaultShot;
  const sourceCapability = capabilities.find((capability) => capability.id === 'seedance-2-0');
  assert.ok(generateVideo);
  assert.ok(sourceCapability);

  const capability = {
    ...sourceCapability,
    id: 'test-mode-aware-video',
    modes: ['i2v', 'r2v', 'fl2v'] as const,
    workflows: ['image_to_video', 'storyboard_to_video', 'character_to_video'] as const,
    text_to_video: false,
    image_to_video: true,
    video_to_video: false,
    storyboard_to_video: true,
    character_to_video: true,
  };
  const requestFor = (connectedInputs: WorkspaceEdgeKind[]) => buildWorkspaceShotGenerateRequest({
    settings: { ...generateVideo, modelId: capability.id },
    capability,
    prompt: 'A product film shot.',
    connectedInputs,
    referenceImages: [],
    videoReferences: [],
    audioReferences: [],
    shotNodeId: 'mode-aware-shot',
    outputName: 'Mode aware shot',
  });

  const storyboardPolicy = resolveWorkspaceBlockPolicy({
    settings: { ...generateVideo, modelId: capability.id },
    capability,
    connectedInputs: ['prompt', 'reference'],
  });
  const storyboardValidation = validateShotConnections({
    settings: { ...generateVideo, modelId: capability.id },
    connectedInputs: ['prompt', 'reference'],
    capabilities: [...capabilities, capability],
  });
  assert.equal(storyboardPolicy.mode, 'reference-to-video');
  assert.equal(storyboardPolicy.resolvedWorkflowType, 'storyboard_to_video');
  assert.equal(storyboardValidation.resolvedWorkflowType, 'storyboard_to_video');
  assert.equal(requestFor(['prompt', 'reference']).mode, 'r2v');

  const characterPolicy = resolveWorkspaceBlockPolicy({
    settings: { ...generateVideo, modelId: capability.id },
    capability,
    connectedInputs: ['prompt', 'character'],
  });
  const characterValidation = validateShotConnections({
    settings: { ...generateVideo, modelId: capability.id },
    connectedInputs: ['prompt', 'character'],
    capabilities: [...capabilities, capability],
  });
  assert.equal(characterPolicy.mode, 'text-to-video');
  assert.equal(characterPolicy.resolvedWorkflowType, 'character_to_video');
  assert.equal(characterValidation.resolvedWorkflowType, 'character_to_video');
  assert.equal(requestFor(['prompt', 'character']).mode, 'i2v');

  const firstLastPolicy = resolveWorkspaceBlockPolicy({
    settings: { ...generateVideo, modelId: capability.id },
    capability,
    connectedInputs: ['prompt', 'start_image', 'end_image'],
  });
  const firstLastValidation = validateShotConnections({
    settings: { ...generateVideo, modelId: capability.id },
    connectedInputs: ['prompt', 'start_image', 'end_image'],
    capabilities: [...capabilities, capability],
  });
  assert.equal(firstLastPolicy.mode, 'first-last-video');
  assert.equal(firstLastPolicy.resolvedWorkflowType, 'image_to_video');
  assert.equal(firstLastValidation.resolvedWorkflowType, 'image_to_video');
  assert.equal(requestFor(['prompt', 'start_image', 'end_image']).mode, 'fl2v');

  const firstLastFallbackCapability = {
    ...capability,
    id: 'test-first-last-fallback-video',
    modes: ['i2v', 'r2v'] as const,
  };
  assert.equal(getWorkspaceBlockCompatibleCapabilities({
    settings: { ...generateVideo, modelId: firstLastFallbackCapability.id },
    capabilities: [firstLastFallbackCapability],
    connectedInputs: ['prompt', 'start_image', 'end_image'],
  }).length, 0);
  assert.throws(() => buildWorkspaceShotGenerateRequest({
    settings: { ...generateVideo, modelId: firstLastFallbackCapability.id },
    capability: firstLastFallbackCapability,
    prompt: 'A first and last frame request.',
    connectedInputs: ['prompt', 'start_image', 'end_image'],
    referenceImages: [],
    videoReferences: [],
    audioReferences: [],
    shotNodeId: 'first-last-fallback-shot',
    outputName: 'First last fallback shot',
  }), /not compatible/i);
});

test('Generate Video first-last requests preserve the connected end image in the payload', () => {
  const capabilities = getWorkspaceModelCapabilities();
  const generateVideo = getWorkspaceBlockPreset('generate-video')?.defaultShot;
  const sourceCapability = capabilities.find((capability) => capability.id === 'seedance-2-0');
  assert.ok(generateVideo);
  assert.ok(sourceCapability);

  const capability = {
    ...sourceCapability,
    id: 'test-first-last-payload-video',
    modes: ['i2v', 'fl2v'] as const,
    workflows: ['image_to_video'] as const,
    text_to_video: false,
    image_to_video: true,
    video_to_video: false,
    storyboard_to_video: false,
    character_to_video: false,
  };
  const startImageUrl = 'https://example.com/first-frame.png';
  const endImageUrl = 'https://example.com/last-frame.png';

  const request = buildWorkspaceShotGenerateRequest({
    settings: { ...generateVideo, modelId: capability.id },
    capability,
    prompt: 'Transition from the first frame to the last frame.',
    connectedInputs: ['prompt', 'start_image', 'end_image'],
    referenceImages: [startImageUrl, endImageUrl],
    startImageUrl,
    endImageUrl,
    videoReferences: [],
    audioReferences: [],
    shotNodeId: 'first-last-payload-shot',
    outputName: 'First last payload shot',
  });

  assert.equal(request.mode, 'fl2v');
  assert.equal(request.imageUrl, startImageUrl);
  assert.equal(request.endImageUrl, endImageUrl);
});

test('Generate Video does not route a storyboard-only model for a plain prompt', () => {
  const capabilities = getWorkspaceModelCapabilities();
  const generateVideo = getWorkspaceBlockPreset('generate-video')?.defaultShot;
  const sourceCapability = capabilities.find((capability) => capability.id === 'seedance-2-0');
  assert.ok(generateVideo);
  assert.ok(sourceCapability);

  const storyboardOnlyCapability = {
    ...sourceCapability,
    id: 'test-storyboard-only-request',
    modes: ['r2v'] as const,
    workflows: ['storyboard_to_video'] as const,
    text_to_video: false,
    image_to_video: false,
    video_to_video: false,
    storyboard_to_video: true,
    character_to_video: false,
  };

  assert.throws(() => buildWorkspaceShotGenerateRequest({
    settings: { ...generateVideo, modelId: storyboardOnlyCapability.id },
    capability: storyboardOnlyCapability,
    prompt: 'A plain text request.',
    connectedInputs: ['prompt'],
    referenceImages: [],
    videoReferences: [],
    audioReferences: [],
    shotNodeId: 'storyboard-only-shot',
    outputName: 'Storyboard only shot',
  }), /not compatible/i);
});

test('legacy modify video shots without preset ids retain the V1 model allowlist', () => {
  const capabilities = getWorkspaceModelCapabilities();
  const modifyVideo = getWorkspaceBlockPreset('modify-video')?.defaultShot;
  assert.ok(modifyVideo);

  const { presetId: _presetId, ...legacyModifyVideo } = modifyVideo;
  const compatibleModelIds = getWorkspaceBlockCompatibleCapabilities({
    settings: legacyModifyVideo,
    capabilities,
  }).map((capability) => capability.id);

  assert.deepEqual(compatibleModelIds, ['luma-ray-3-2']);
});

test('Studio V1 input connectors disable inputs unsupported by the selected real engine', () => {
  const capabilities = getWorkspaceModelCapabilities();
  const generateVideo = getWorkspaceBlockPreset('generate-video')?.defaultShot;
  const capability = capabilities.find((candidate) => candidate.id === 'luma-ray-3-2');
  assert.ok(generateVideo);
  assert.ok(capability);
  assert.equal(capability.optional_inputs.includes('audio'), false);

  const policy = resolveWorkspaceBlockPolicy({
    settings: { ...generateVideo, modelId: capability.id },
    capability,
    connectedInputs: ['prompt', 'audio'],
  });
  const validation = validateShotConnections({
    settings: { ...generateVideo, modelId: capability.id },
    connectedInputs: ['prompt', 'audio'],
    capabilities,
  });

  assert.match(policy.inputConnectors.find((connector) => connector.kind === 'audio')?.disabledReason ?? '', /does not support/i);
  assert.deepEqual(validation.incompatibleInputs, ['audio']);
  assert.equal(validation.canGenerate, false);
});

test('Studio V1 pricing fields are limited by the selected real engine capability', () => {
  const capabilities = getWorkspaceModelCapabilities();
  const generateVideo = getWorkspaceBlockPreset('generate-video')?.defaultShot;
  const capability = capabilities.find((candidate) => candidate.id === 'luma-ray-3-2');
  assert.ok(generateVideo);
  assert.ok(capability);

  const policy = resolveWorkspaceBlockPolicy({
    settings: { ...generateVideo, modelId: capability.id },
    capability,
    connectedInputs: ['prompt'],
  });
  const contract = getWorkspaceV1BlockContract('generate-video');

  assert.deepEqual(
    policy.pricingRelevantFields,
    contract.pricingRelevantFields.filter((field) => capability.pricing_relevant_fields?.includes(field))
  );
});

test('Studio block capability policy defines a normalized per-preset capability matrix', () => {
  const matrix: PolicyMatrixExpectation[] = [
    {
      presetId: 'generate-video',
      defaultModelId: 'seedance-2-0',
      family: 'video',
      workflow: 'image_to_video',
      outputMediaKind: 'video',
      outputCount: 1,
      requiredInputs: ['prompt'],
      optionalInputs: ['start_image', 'reference', 'style', 'camera'],
      readyInputs: ['prompt'],
      missingInputs: ['prompt'],
      mode: 'text-to-video',
      pricingAvailable: true,
      missingReason: true,
    },
    {
      presetId: 'modify-video',
      defaultModelId: 'luma-ray-3-2',
      family: 'video',
      workflow: 'video_to_video',
      outputMediaKind: 'video',
      outputCount: 1,
      requiredInputs: ['prompt', 'video_reference'],
      optionalInputs: ['motion_reference', 'previous_shot', 'continuity', 'style'],
      readyInputs: ['prompt', 'video_reference'],
      missingInputs: ['prompt', 'video_reference'],
      mode: 'video-edit',
      pricingAvailable: true,
      missingReason: true,
    },
    {
      presetId: 'generate-image',
      defaultModelId: 'seedream',
      family: 'image',
      workflow: 'text_to_image',
      outputMediaKind: 'image',
      outputCount: 1,
      requiredInputs: ['prompt'],
      optionalInputs: ['reference', 'style'],
      readyInputs: ['prompt'],
      missingInputs: ['prompt'],
      mode: 'text-to-image',
      pricingAvailable: true,
      missingReason: true,
    },
    {
      presetId: 'modify-image',
      defaultModelId: 'seedream',
      family: 'image',
      workflow: 'image_to_image',
      outputMediaKind: 'image',
      outputCount: 1,
      requiredInputs: ['prompt', 'reference'],
      optionalInputs: ['style'],
      readyInputs: ['prompt', 'reference'],
      missingInputs: ['prompt', 'reference'],
      mode: 'image-edit',
      pricingAvailable: true,
      missingReason: true,
    },
    {
      presetId: 'character-builder',
      defaultModelId: 'character-builder-tool',
      family: 'image',
      workflow: 'character_builder',
      outputMediaKind: 'image',
      outputCount: { min: 1, max: 4 },
      requiredInputs: [],
      optionalInputs: ['prompt', 'reference', 'style'],
      readyInputs: [],
      missingInputs: [],
      mode: 'tool',
      pricingAvailable: true,
      missingReason: false,
    },
    {
      presetId: 'angle',
      defaultModelId: 'angle-flux-multiple-angles',
      family: 'image',
      workflow: 'angle_generation',
      outputMediaKind: 'image',
      outputCount: { min: 1, max: 4 },
      requiredInputs: ['reference'],
      optionalInputs: ['prompt'],
      readyInputs: ['reference'],
      missingInputs: ['reference'],
      mode: 'tool',
      pricingAvailable: true,
      missingReason: true,
    },
    {
      presetId: 'upscale-image',
      defaultModelId: 'upscale-image-seedvr',
      family: 'upscale',
      workflow: 'image_upscale',
      outputMediaKind: 'image',
      outputCount: 1,
      requiredInputs: ['reference'],
      optionalInputs: ['prompt'],
      readyInputs: ['reference'],
      missingInputs: ['reference'],
      mode: 'tool',
      pricingAvailable: true,
      missingReason: true,
    },
    {
      presetId: 'upscale-video',
      defaultModelId: 'upscale-video-seedvr',
      family: 'upscale',
      workflow: 'video_upscale',
      outputMediaKind: 'video',
      outputCount: 1,
      requiredInputs: ['video_reference'],
      optionalInputs: ['prompt'],
      readyInputs: ['video_reference'],
      missingInputs: ['video_reference'],
      mode: 'tool',
      pricingAvailable: true,
      missingReason: true,
    },
    {
      presetId: 'audio-music',
      defaultModelId: 'audio-music-only',
      family: 'audio',
      workflow: 'music_generation',
      outputMediaKind: 'audio',
      outputCount: 1,
      requiredInputs: ['prompt'],
      optionalInputs: ['style'],
      readyInputs: ['prompt'],
      missingInputs: ['prompt'],
      mode: 'tool',
      pricingAvailable: true,
      missingReason: true,
    },
    {
      presetId: 'audio-voiceover',
      defaultModelId: 'audio-voice-only',
      family: 'audio',
      workflow: 'voiceover_generation',
      outputMediaKind: 'audio',
      outputCount: 1,
      requiredInputs: ['prompt'],
      optionalInputs: ['voiceover', 'dialogue', 'narration'],
      readyInputs: ['prompt'],
      missingInputs: ['prompt'],
      mode: 'tool',
      pricingAvailable: true,
      missingReason: true,
    },
    {
      presetId: 'audio-sfx',
      defaultModelId: 'audio-sfx-only',
      family: 'audio',
      workflow: 'sfx_generation',
      outputMediaKind: 'audio',
      outputCount: 1,
      requiredInputs: ['prompt'],
      optionalInputs: ['video_reference', 'motion_reference'],
      readyInputs: ['prompt'],
      missingInputs: ['prompt'],
      mode: 'tool',
      pricingAvailable: true,
      missingReason: true,
    },
    {
      presetId: 'audio-sound-design',
      defaultModelId: 'audio-cinematic',
      family: 'audio',
      workflow: 'cinematic_audio',
      outputMediaKind: 'audio',
      outputCount: 1,
      requiredInputs: ['video_reference'],
      optionalInputs: ['prompt', 'music', 'sfx'],
      readyInputs: ['video_reference'],
      missingInputs: ['video_reference'],
      mode: 'tool',
      pricingAvailable: true,
      missingReason: true,
    },
    {
      presetId: 'chat-box',
      defaultModelId: 'studio-chat-openai',
      family: 'chat',
      workflow: 'chat_completion',
      outputMediaKind: 'text',
      outputCount: 1,
      requiredInputs: ['prompt'],
      optionalInputs: [],
      readyInputs: ['prompt'],
      missingInputs: ['prompt'],
      mode: 'chat',
      pricingAvailable: false,
      missingReason: true,
    },
  ];

  for (const expectation of matrix) {
    const preset = getWorkspaceBlockPreset(expectation.presetId);
    assert.ok(preset, `${expectation.presetId} should exist`);
    assert.equal(preset.defaultModelId, expectation.defaultModelId, `${expectation.presetId} default model`);
    assert.equal(preset.family, expectation.family, `${expectation.presetId} family`);
    assert.equal(preset.defaultWorkflowType, expectation.workflow, `${expectation.presetId} workflow`);
    assert.equal(preset.outputKind, expectation.outputMediaKind, `${expectation.presetId} output kind`);

    const missingPolicy = resolvePolicyForPreset(expectation, []);
    assert.equal(missingPolicy.mode, expectation.mode, `${expectation.presetId} mode`);
    assert.deepEqual(missingPolicy.requiredInputs, expectation.requiredInputs, `${expectation.presetId} required inputs`);
    assert.deepEqual(missingPolicy.missingInputs, expectation.missingInputs, `${expectation.presetId} missing inputs`);
    assert.equal(missingPolicy.canGenerate, expectation.missingInputs.length === 0, `${expectation.presetId} canGenerate without inputs`);
    assert.equal(missingPolicy.outputMediaKind, expectation.outputMediaKind, `${expectation.presetId} policy output kind`);
    assert.deepEqual(missingPolicy.outputCount, expectation.outputCount, `${expectation.presetId} policy output count`);
    assert.equal(
      Boolean(missingPolicy.pricingRelevantFields?.length),
      expectation.pricingAvailable,
      `${expectation.presetId} pricing availability`
    );
    assert.ok(missingPolicy.controlFields?.length, `${expectation.presetId} should expose policy control fields`);
    if (expectation.missingReason) {
      assert.match(missingPolicy.disabledReason ?? '', /connect|required|missing/i, `${expectation.presetId} should explain missing inputs`);
    } else {
      assert.equal(missingPolicy.disabledReason ?? '', '', `${expectation.presetId} should not expose a disabled reason`);
    }

    const optionalInputs = missingPolicy.optionalInputs ?? [];
    for (const optionalInput of expectation.optionalInputs) {
      assert.ok(optionalInputs.includes(optionalInput), `${expectation.presetId} should expose optional input ${optionalInput}`);
      assert.equal(
        missingPolicy.requiredInputs.includes(optionalInput),
        false,
        `${expectation.presetId} should not mark ${optionalInput} required and optional`
      );
    }
    if (expectation.presetId === 'chat-box') {
      assert.deepEqual(
        missingPolicy.inputConnectors.map((connector) => connector.kind),
        ['prompt', 'style', 'camera', 'dialogue', 'narration'],
        'chat should expose its V1 text-context connectors'
      );
    }
    for (const kind of [...expectation.requiredInputs, ...expectation.optionalInputs]) {
      const connector = missingPolicy.inputConnectors.find((candidate) => candidate.kind === kind);
      assert.ok(connector, `${expectation.presetId} should expose connector metadata for ${kind}`);
      const connectorMetadata = connector as typeof connector & {
        acceptedFormats?: unknown;
        acceptedMediaKinds?: unknown;
        maxCount?: unknown;
        minCount?: unknown;
      };
      assert.ok(Array.isArray(connectorMetadata.acceptedMediaKinds), `${expectation.presetId} ${kind} should describe accepted media kinds`);
      assert.equal(typeof connectorMetadata.minCount, 'number', `${expectation.presetId} ${kind} should describe a minimum count`);
      assert.equal(typeof connectorMetadata.maxCount, 'number', `${expectation.presetId} ${kind} should describe a maximum count`);
      if (connector.sourceType !== 'text') {
        assert.ok(Array.isArray(connectorMetadata.acceptedFormats), `${expectation.presetId} ${kind} should describe accepted formats`);
      }
    }

    const readyPolicy = resolvePolicyForPreset(expectation, expectation.readyInputs);
    assert.equal(readyPolicy.canGenerate, true, `${expectation.presetId} should generate when required inputs are present`);
    assert.deepEqual(readyPolicy.missingInputs, [], `${expectation.presetId} should have no missing ready inputs`);
  }
});

test('Studio block policy disables video start/reference controls when the selected mode makes them exclusive', () => {
  const capabilities = getWorkspaceModelCapabilities();
  const generateVideo = getWorkspaceBlockPreset('generate-video')?.defaultShot;
  assert.ok(generateVideo);
  const capability = capabilities.find((candidate) => candidate.id === generateVideo.modelId) ?? null;
  assert.ok(capability);

  const startImagePolicy = resolveWorkspaceBlockPolicy({
    settings: generateVideo,
    capability,
    connectedInputs: ['prompt', 'start_image'],
  });
  const referenceControl = startImagePolicy.controls.find((control) => control.id === 'reference');
  assert.equal(referenceControl?.disabled, true);
  assert.match(referenceControl?.reason ?? '', /start image/i);

  const referencePolicy = resolveWorkspaceBlockPolicy({
    settings: generateVideo,
    capability,
    connectedInputs: ['prompt', 'reference'],
  });
  const startImageControl = referencePolicy.controls.find((control) => control.id === 'start_image');
  assert.equal(startImageControl?.disabled, true);
  assert.match(startImageControl?.reason ?? '', /reference/i);
});

test('Studio shot node controls do not expose draft as a user-facing status label', () => {
  const nodeControlsSource = readFileSync(
    join(root, 'frontend/app/(core)/(workspace)/app/studio/workspace/_components/nodes/workspace-shot-node-controls.tsx'),
    'utf8'
  );

  assert.doesNotMatch(nodeControlsSource, /copy\.draft/);
  assert.doesNotMatch(nodeControlsSource, /status-\$\{shot\.status\}/);
});

test('Studio shot generate button uses the full action row after status badge removal', () => {
  const controlsStyles = readFileSync(
    join(root, 'frontend/app/(core)/(workspace)/app/studio/workspace/_styles/canvas-shot-controls.module.css'),
    'utf8'
  );

  assert.match(controlsStyles, /\.shotActionRow\s*\{[\s\S]*grid-template-columns:\s*1fr/);
  assert.doesNotMatch(controlsStyles, /grid-template-columns:\s*minmax\(54px,\s*0\.42fr\)/);
});

test('Studio rendered shot nodes derive input docks and target handles from block policy', () => {
  const renderNodesSource = readFileSync(
    join(root, 'frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceRenderNodes.ts'),
    'utf8'
  );

  assert.match(renderNodesSource, /resolveWorkspaceBlockPolicy/);
  assert.match(renderNodesSource, /policy\.inputConnectors/);
  assert.match(renderNodesSource, /targetHandles:\s*inputConnectors\.map\(\(connector\) => connector\.kind\)/);
  assert.doesNotMatch(renderNodesSource, /getWorkspaceShotTargetHandles\(validation\.capability\)/);
});

test('image generation preset validates against image models and rejects video-only models', () => {
  const capabilities = getWorkspaceModelCapabilities();
  const imagePreset = getWorkspaceBlockPreset('generate-image');
  assert.ok(imagePreset?.defaultShot);

  const valid = validateShotConnections({
    settings: imagePreset.defaultShot,
    connectedInputs: ['prompt'],
    capabilities,
  });
  assert.equal(valid.canGenerate, true);
  assert.equal(valid.capability?.outputKind, 'image');

  const invalid = validateShotConnections({
    settings: { ...imagePreset.defaultShot, modelId: 'seedance-2-0' },
    connectedInputs: ['prompt'],
    capabilities,
  });
  assert.equal(invalid.canGenerate, false);
  assert.notEqual(invalid.capability?.outputKind, 'image');
});

test('modify image preset requires an image source before generation', () => {
  const capabilities = getWorkspaceModelCapabilities();
  const modifyImage = getWorkspaceBlockPreset('modify-image')?.defaultShot;
  assert.ok(modifyImage);

  const missingSource = validateShotConnections({
    settings: modifyImage,
    connectedInputs: ['prompt'],
    capabilities,
  });
  assert.equal(missingSource.canGenerate, false);
  assert.deepEqual(missingSource.missingInputs, ['reference']);

  const ready = validateShotConnections({
    settings: modifyImage,
    connectedInputs: ['prompt', 'reference'],
    capabilities,
  });
  assert.equal(ready.canGenerate, true);
  assert.deepEqual(ready.missingInputs, []);
  assert.equal(ready.resolvedWorkflowType, 'image_to_image');
});

test('tool-only image blocks keep their specialized workflow during validation', () => {
  const capabilities = getWorkspaceModelCapabilities();
  const character = getWorkspaceBlockPreset('character-builder')?.defaultShot;
  assert.ok(character);

  const validation = validateShotConnections({
    settings: character,
    connectedInputs: [],
    capabilities,
  });

  assert.equal(validation.canGenerate, true);
  assert.equal(validation.resolvedWorkflowType, 'character_builder');
  assert.deepEqual(validation.missingInputs, []);
  assert.deepEqual(validation.incompatibleInputs, []);
});

test('specialized tool routes resolve before generic family routing', () => {
  assert.equal(resolveWorkspaceGenerationRoute({
    modelId: 'seedream',
    workflowType: 'text_to_image',
    family: 'image',
    outputKind: 'image',
    durationSec: 1,
    aspectRatio: '16:9',
    resolution: '1080p',
    fps: 24,
    audioEnabled: false,
    lipSyncEnabled: false,
    referenceStrength: 0.5,
    outputName: 'Image',
    status: 'draft',
  }), 'image');

  assert.equal(resolveWorkspaceGenerationRoute({
    modelId: 'character-builder-tool',
    toolKind: 'character-builder',
    workflowType: 'character_builder',
    family: 'image',
    outputKind: 'image',
    durationSec: 1,
    aspectRatio: '16:9',
    resolution: '1080p',
    fps: 24,
    audioEnabled: false,
    lipSyncEnabled: false,
    referenceStrength: 0.5,
    outputName: 'Character',
    status: 'draft',
  }), 'character-builder');

  assert.equal(resolveWorkspaceGenerationRoute({
    modelId: 'angle-flux-multiple-angles',
    toolKind: 'angle',
    workflowType: 'angle_generation',
    family: 'image',
    outputKind: 'image',
    durationSec: 1,
    aspectRatio: '16:9',
    resolution: '1080p',
    fps: 24,
    audioEnabled: false,
    lipSyncEnabled: false,
    referenceStrength: 0.5,
    outputName: 'Angle',
    status: 'draft',
  }), 'angle');

  assert.equal(resolveWorkspaceGenerationRoute({
    modelId: 'audio-cinematic',
    workflowType: 'cinematic_audio',
    family: 'audio',
    outputKind: 'audio',
    durationSec: 10,
    aspectRatio: '16:9',
    resolution: '1080p',
    fps: 24,
    audioEnabled: true,
    lipSyncEnabled: false,
    referenceStrength: 0.5,
    outputName: 'Sound design',
    status: 'draft',
  }), 'audio');
});

test('specialized tool routing maps Studio ids to product API ids', () => {
  assert.equal(upscaleEngineIdForStudioModel('upscale-image-seedvr', 'image'), 'seedvr-image');
  assert.equal(upscaleEngineIdForStudioModel('upscale-image-topaz', 'image'), 'topaz-image');
  assert.equal(upscaleEngineIdForStudioModel('upscale-image-recraft-crisp', 'image'), 'recraft-crisp');
  assert.equal(upscaleEngineIdForStudioModel('upscale-video-seedvr', 'video'), 'seedvr-video');
  assert.equal(upscaleEngineIdForStudioModel('upscale-video-flashvsr', 'video'), 'flashvsr-video');
  assert.equal(upscaleEngineIdForStudioModel('upscale-video-topaz', 'video'), 'topaz-video');

  assert.equal(angleEngineIdForStudioModel('angle-flux-multiple-angles'), 'flux-multiple-angles');
  assert.equal(angleEngineIdForStudioModel('angle-qwen-multiple-angles'), 'qwen-multiple-angles');

  assert.equal(audioPackForWorkflow('music_generation'), 'music_only');
  assert.equal(audioPackForWorkflow('voiceover_generation'), 'voice_only');
  assert.equal(audioPackForWorkflow('sfx_generation'), 'sfx_only');
  assert.equal(audioPackForWorkflow('cinematic_audio'), 'cinematic');
  assert.equal(audioPackForWorkflow('cinematic_voiceover'), 'cinematic_voice');
});

test('chat settings preserve chatbot mode and display name for canvas chatbot blocks', () => {
  const settings = normalizeChatSettings({
    mode: 'chatbot',
    botName: 'Storyboard assistant',
    provider: 'gemini',
    modelId: '',
    systemPrompt: 'Answer as a production planning chatbot.',
    draftMessage: 'How should we stage the next shot?',
    messages: [
      {
        role: 'assistant',
        content: 'Start with a wide establishing frame.',
      },
    ],
    status: 'running',
  });

  assert.equal(settings.mode, 'chatbot');
  assert.equal(settings.botName, 'Storyboard assistant');
  assert.equal(settings.provider, 'gemini');
  assert.equal(settings.modelId, 'gemini-3.5-flash');
  assert.equal(settings.status, 'idle');
  assert.equal(settings.messages[0]?.id, 'chat-message-1');
});

test('Studio chat model registry exposes curated Gemini models and rejects arbitrary ids', () => {
  const geminiModels = getStudioChatModels('gemini');
  assert.deepEqual(
    geminiModels.map((model) => model.modelId),
    [
      'gemini-3.5-flash',
      'gemini-3.1-pro-preview',
      'gemini-3.1-flash-lite',
      'gemini-2.5-pro',
      'gemini-2.5-flash',
    ]
  );
  assert.equal(getDefaultStudioChatModel('gemini').modelId, 'gemini-3.5-flash');
  assert.equal(isStudioChatModelAllowed('gemini', 'gemini-3.1-pro-preview'), true);
  assert.equal(isStudioChatModelAllowed('gemini', 'gemini-unlisted-experimental'), false);
});

test('Studio chat compaction keeps system context and the most recent conversation turns', () => {
  const compacted = compactStudioChatMessages([
    { role: 'system', content: 'Always answer as a storyboard producer.' },
    ...Array.from({ length: 16 }, (_, index) => ({
      role: index % 2 === 0 ? 'user' as const : 'assistant' as const,
      content: `message-${index} ${'x'.repeat(160)}`,
    })),
  ], { maxChars: 900, keepLast: 6 });

  assert.equal(compacted[0]?.role, 'system');
  assert.match(compacted[0]?.content ?? '', /storyboard producer/);
  assert.ok(compacted.length <= 7);
  assert.equal(compacted.at(-1)?.content.startsWith('message-15'), true);
});

test('Studio chat request includes connected text context and preserves multi-turn messages', () => {
  const chatNode: WorkspaceGraphNode = {
    id: 'chat-node',
    type: 'chat',
    position: { x: 0, y: 0 },
    data: {
      kind: 'chat',
      title: 'LLM chat',
      subtitle: '',
      targetHandles: ['prompt'],
      sourceHandles: ['prompt'],
      promptText: '',
      chat: {
        mode: 'chatbot',
        botName: 'Studio assistant',
        provider: 'openai',
        modelId: 'gpt-4.1-mini',
        systemPrompt: 'Answer as a production assistant.',
        draftMessage: 'Turn this into a video prompt.',
        messages: [
          {
            id: 'chat-user-1',
            role: 'user',
            content: 'Earlier question',
            createdAt: '2026-06-17T10:00:00.000Z',
          },
          {
            id: 'chat-assistant-1',
            role: 'assistant',
            content: 'Earlier answer',
            createdAt: '2026-06-17T10:00:01.000Z',
          },
        ],
        status: 'idle',
      },
    },
  };
  const promptNode: WorkspaceGraphNode = {
    id: 'prompt-node',
    type: 'text-prompt',
    position: { x: 0, y: 0 },
    data: {
      kind: 'text-prompt',
      title: 'Scene prompt',
      subtitle: '',
      promptText: 'A neon product reveal with precise camera timing.',
      sourceHandles: ['prompt'],
      targetHandles: [],
    },
  };
  const mediaNode: WorkspaceGraphNode = {
    id: 'image-node',
    type: 'asset',
    position: { x: 0, y: 0 },
    data: {
      kind: 'asset-image',
      title: 'Moodboard',
      subtitle: '',
      sourceHandles: ['reference'],
      targetHandles: [],
      asset: {
        id: 'asset-image',
        kind: 'image',
        filename: 'moodboard.png',
        subtitle: '',
        url: 'https://cdn.example.com/moodboard.png',
      },
    },
  };
  const edges = [
    {
      id: 'prompt-chat',
      source: 'prompt-node',
      target: 'chat-node',
      sourceHandle: 'prompt',
      targetHandle: 'prompt',
      data: { kind: 'prompt' as const, label: 'Prompt', color: '#64748b' },
    },
    {
      id: 'image-chat',
      source: 'image-node',
      target: 'chat-node',
      sourceHandle: 'reference',
      targetHandle: 'reference',
      data: { kind: 'reference' as const, label: 'Reference', color: '#64748b' },
    },
  ];

  const contextSummaries = workspaceChatContextSummariesForNode({
    nodes: [chatNode, promptNode, mediaNode],
    edges,
    chatNodeId: chatNode.id,
  });
  const request = buildWorkspaceChatApiRequest({
    chat: chatNode.data.chat!,
    nextMessages: [
      ...chatNode.data.chat!.messages,
      {
        id: 'chat-user-2',
        role: 'user',
        content: chatNode.data.chat!.draftMessage,
        createdAt: '2026-06-17T10:01:00.000Z',
      },
    ],
    contextSummaries,
  });

  assert.deepEqual(contextSummaries.map((context) => context.kind), ['text']);
  assert.match(contextSummaries[0]?.content ?? '', /neon product reveal/);
  assert.doesNotMatch(JSON.stringify(contextSummaries), /moodboard\.png/);
  assert.deepEqual(request.messages.map((message) => message.role), ['system', 'user', 'assistant', 'user']);
  assert.equal(request.messages.at(-1)?.content, 'Turn this into a video prompt.');
  assert.deepEqual(request.contextSummaries, contextSummaries);
});

test('Studio chat context summaries format text context without binary media claims', () => {
  const formatted = formatStudioChatContextSummaries([
    {
      kind: 'text',
      label: 'Prompt',
      content: 'Use a slow dolly move and warm product reflections.',
    },
    {
      kind: 'unsupported',
      label: 'Image reference',
      content: 'https://cdn.example.com/reference.png',
    },
  ]);

  assert.match(formatted, /Connected Studio text context/);
  assert.match(formatted, /slow dolly move/);
  assert.doesNotMatch(formatted, /reference\.png/);
  assert.doesNotMatch(formatted, /image reference/i);
});

test('Studio chat UI and API use the shared model registry instead of hardcoded model lists', () => {
  const inspectorSource = readFileSync(
    join(root, 'frontend/app/(core)/(workspace)/app/studio/workspace/_components/ChatNodeInspector.tsx'),
    'utf8'
  );
  const routeSource = readFileSync(join(root, 'frontend/app/api/studio/chat/route.ts'), 'utf8');
  const serverSource = readFileSync(join(root, 'frontend/src/server/studio/chat.ts'), 'utf8');

  assert.match(inspectorSource, /getStudioChatModels/);
  assert.match(routeSource, /isStudioChatModelAllowed/);
  assert.match(serverSource, /resolveStudioChatModel/);
  assert.doesNotMatch(inspectorSource, /<option value="gemini-2\.5-flash">/);
});

test('Studio chat node exposes portable conversation actions on the canvas node', () => {
  const chatNodeSource = readFileSync(
    join(root, 'frontend/app/(core)/(workspace)/app/studio/workspace/_components/nodes/workspace-chat-node.tsx'),
    'utf8'
  );
  const renderNodesSource = readFileSync(
    join(root, 'frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceRenderNodes.ts'),
    'utf8'
  );
  const workspaceTypesSource = readFileSync(
    join(root, 'frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-types.ts'),
    'utf8'
  );

  assert.match(workspaceTypesSource, /onPatchChat\?:/);
  assert.match(renderNodesSource, /onPatchChat:/);
  assert.match(chatNodeSource, /chatUtilityBar/);
  assert.match(chatNodeSource, /resolveStudioChatModel/);
  assert.match(chatNodeSource, /slice\(-3\)/);
  assert.match(chatNodeSource, /Output text/);
  assert.match(chatNodeSource, /navigator\.clipboard\.writeText/);
  assert.match(chatNodeSource, /messages:\s*\[\]/);
  assert.doesNotMatch(chatNodeSource, /messages\.map\(\(message\)/);
});

test('Character Builder preset stores full product tool settings instead of a tiny subset', () => {
  const character = getWorkspaceBlockPreset('character-builder')?.defaultShot;
  assert.ok(character);

  const settings = character.toolSettings?.characterBuilder;
  assert.ok(settings);
  assert.equal(settings.outputMode, 'portrait-reference');
  assert.equal(settings.qualityMode, 'draft');
  assert.equal(settings.formatMode, 'standard');
  assert.equal(settings.generateCount, 1);
  assert.equal(settings.traits.realismStyle, 'photoreal');
  assert.equal(settings.traits.hairEnabled, false);
  assert.equal(settings.traits.outfitEnabled, false);
  assert.equal(settings.outputOptions.preserveFacialDetails, true);
  assert.equal(settings.outputOptions.avoid3dRenderLook, true);
  assert.equal(settings.advancedNotes, '');
  assert.deepEqual(settings.mustRemainVisible, []);
});

test('Studio builds Character Builder API requests without dropping node trait and output settings', () => {
  const character = getWorkspaceBlockPreset('character-builder')?.defaultShot;
  assert.ok(character?.toolSettings?.characterBuilder);

  const editedTraits: CharacterBuilderTraits = {
    ...character.toolSettings.characterBuilder.traits,
    hairEnabled: false,
    customHairDescription: 'shaved head with a silver temple tattoo',
    outfitEnabled: true,
    outfitStyle: { value: 'sci-fi', source: 'manual' },
    accessories: ['glasses', 'earrings'],
    realismStyle: 'cinematic',
  };
  const request = buildWorkspaceCharacterBuilderRequest({
    settings: {
      ...character,
      toolSettings: {
        characterBuilder: {
          ...character.toolSettings.characterBuilder,
          outputMode: 'character-sheet',
          consistencyMode: 'strict',
          referenceStrength: 'strong',
          qualityMode: 'final',
          formatMode: '4k',
          generateCount: 4,
          traits: editedTraits,
          outputOptions: {
            ...character.toolSettings.characterBuilder.outputOptions,
            includeCloseUps: true,
            neutralStudioBackground: false,
          },
          advancedNotes: 'Keep the blue jacket visible in every view.',
          mustRemainVisible: ['blue jacket', 'silver temple tattoo'],
        },
      },
    },
    prompt: 'Create a practical hero character reference.',
    identityImageUrls: ['https://cdn.example.com/identity.png'],
    styleImageUrls: ['https://cdn.example.com/style.png'],
    jobId: 'studio_character_test',
  });

  assert.equal(request.sourceMode, 'reference-image');
  assert.equal(request.outputMode, 'character-sheet');
  assert.equal(request.consistencyMode, 'strict');
  assert.equal(request.referenceStrength, 'strong');
  assert.equal(request.qualityMode, 'final');
  assert.equal(request.formatMode, '4k');
  assert.equal(request.generateCount, 4);
  assert.equal(request.traits.hairEnabled, false);
  assert.equal(request.traits.customHairDescription, 'shaved head with a silver temple tattoo');
  assert.equal(request.traits.outfitStyle.value, 'sci-fi');
  assert.deepEqual(request.traits.accessories, ['glasses', 'earrings']);
  assert.equal(request.traits.realismStyle, 'cinematic');
  assert.equal(request.outputOptions.includeCloseUps, true);
  assert.equal(request.outputOptions.neutralStudioBackground, false);
  assert.equal(request.advancedNotes, 'Keep the blue jacket visible in every view.\n\nCreate a practical hero character reference.');
  assert.deepEqual(request.mustRemainVisible, ['blue jacket', 'silver temple tattoo']);
  assert.deepEqual(request.referenceImages.map((image) => image.role), ['identity', 'style']);
});

test('Studio request builders forward supported settings for image, angle, upscale, and audio tools', () => {
  const capabilities = getWorkspaceModelCapabilities();
  const generateImage = defaultShotForPreset('generate-image');
  const modifyImage = defaultShotForPreset('modify-image');
  const angle = defaultShotForPreset('angle');
  const upscaleVideo = defaultShotForPreset('upscale-video');
  const soundDesignVoice = defaultShotForPreset('audio-sound-design-voice');

  const generateImagePolicy = resolveWorkspaceBlockPolicy({
    settings: generateImage,
    capability: capabilities.find((capability) => capability.id === generateImage.modelId) ?? null,
    connectedInputs: ['prompt'],
  });
  const imageRequest = buildWorkspaceImageGenerationRequest({
    settings: {
      ...generateImage,
      aspectRatio: '9:16',
      resolution: '4k',
      seed: 42,
    },
    prompt: 'A product hero frame on a reflective table.',
    referenceImages: [],
    policy: generateImagePolicy,
  });
  assert.equal(imageRequest.mode, 't2i');
  assert.equal(imageRequest.engineId, 'seedream');
  assert.equal(imageRequest.aspectRatio, '9:16');
  assert.equal(imageRequest.resolution, '4k');
  assert.equal(imageRequest.seed, 42);
  assert.equal(imageRequest.imageUrls, undefined);

  const modifyImageRequest = buildWorkspaceImageGenerationRequest({
    settings: {
      ...modifyImage,
      aspectRatio: '1:1',
      resolution: '1080p',
    },
    prompt: 'Keep the product shape and replace the background.',
    referenceImages: ['https://cdn.example.com/source.png', 'https://cdn.example.com/style.png'],
  });
  assert.equal(modifyImageRequest.mode, 'i2i');
  assert.deepEqual(modifyImageRequest.imageUrls, [
    'https://cdn.example.com/source.png',
    'https://cdn.example.com/style.png',
  ]);
  assert.equal(modifyImageRequest.aspectRatio, '1:1');
  assert.equal(modifyImageRequest.resolution, '1080p');

  const angleRequest = buildWorkspaceAngleToolRequest({
    settings: {
      ...angle,
      toolSettings: {
        angle: {
          rotation: 125,
          tilt: -12,
          zoom: 1.4,
          safeMode: false,
          generateBestAngles: true,
        },
      },
    },
    imageUrl: 'https://cdn.example.com/product.png',
  });
  assert.equal(angleRequest.imageUrl, 'https://cdn.example.com/product.png');
  assert.equal(angleRequest.engineId, 'flux-multiple-angles');
  assert.deepEqual(angleRequest.params, { rotation: 125, tilt: -12, zoom: 1.4 });
  assert.equal(angleRequest.safeMode, false);
  assert.equal(angleRequest.generateBestAngles, true);

  const upscaleRequest = buildWorkspaceUpscaleToolRequest({
    settings: {
      ...upscaleVideo,
      resolution: '4k',
      toolSettings: {
        upscale: {
          mode: 'factor',
          upscaleFactor: 4,
          outputFormat: 'webm',
        },
      },
    },
    mediaType: 'video',
    mediaUrl: 'https://cdn.example.com/source.mp4',
    engineId: 'seedvr-video',
  });
  assert.deepEqual(upscaleRequest, {
    mediaType: 'video',
    mediaUrl: 'https://cdn.example.com/source.mp4',
    engineId: 'seedvr-video',
    mode: 'factor',
    upscaleFactor: 4,
    targetResolution: '2160p',
    outputFormat: 'webm',
  });

  const audioRequest = buildWorkspaceAudioGenerateRequest({
    settings: {
      ...soundDesignVoice,
      durationSec: 12,
      toolSettings: {
        audio: {
          mood: 'tense',
          intensity: 'intense',
          musicEnabled: false,
          voiceGender: 'female',
          voiceProfile: 'warm',
          voiceDelivery: 'trailer',
          language: 'french',
        },
      },
    },
    pack: 'cinematic_voice',
    prompt: 'A whispered launch countdown over rising mechanical pulses.',
    sourceVideoUrl: 'https://cdn.example.com/source.mp4',
  });
  assert.deepEqual(audioRequest, {
    sourceVideoUrl: 'https://cdn.example.com/source.mp4',
    pack: 'cinematic_voice',
    prompt: 'A whispered launch countdown over rising mechanical pulses.',
    mood: 'tense',
    intensity: 'intense',
    script: 'A whispered launch countdown over rising mechanical pulses.',
    voiceGender: 'female',
    voiceProfile: 'warm',
    voiceDelivery: 'trailer',
    language: 'french',
    durationSec: 12,
    musicEnabled: false,
  });
});

test('Studio generation routing keeps source video first and blocks unsupported chat generation', () => {
  const modifyVideo = defaultShotForPreset('modify-video');
  const shotNode = {
    id: 'modify-video-shot',
    type: 'shot',
    position: { x: 0, y: 0 },
    data: {
      kind: 'shot' as const,
      title: 'Modify video',
      subtitle: 'Modify video',
      sourceHandles: ['video_reference'],
      targetHandles: ['prompt', 'video_reference', 'motion_reference', 'previous_shot', 'continuity'],
      shot: modifyVideo,
    },
  };
  const nodes = [
    shotNode,
    {
      id: 'source-video',
      type: 'asset',
      position: { x: 0, y: 0 },
      data: {
        kind: 'asset-video' as const,
        title: 'Source',
        subtitle: '',
        sourceHandles: ['video_reference'],
        targetHandles: [],
        asset: { id: 'source-video', kind: 'video' as const, filename: 'source.mp4', subtitle: '', url: 'https://cdn.example.com/source.mp4' },
      },
    },
    {
      id: 'motion-video',
      type: 'asset',
      position: { x: 0, y: 0 },
      data: {
        kind: 'asset-video' as const,
        title: 'Motion',
        subtitle: '',
        sourceHandles: ['video_reference'],
        targetHandles: [],
        asset: { id: 'motion-video', kind: 'video' as const, filename: 'motion.mp4', subtitle: '', url: 'https://cdn.example.com/motion.mp4' },
      },
    },
    {
      id: 'previous-video',
      type: 'asset',
      position: { x: 0, y: 0 },
      data: {
        kind: 'asset-video' as const,
        title: 'Previous',
        subtitle: '',
        sourceHandles: ['video_reference'],
        targetHandles: [],
        asset: { id: 'previous-video', kind: 'video' as const, filename: 'previous.mp4', subtitle: '', url: 'https://cdn.example.com/previous.mp4' },
      },
    },
  ];
  const edges = [
    { id: 'source-edge', source: 'source-video', target: 'modify-video-shot', sourceHandle: 'video_reference', targetHandle: 'video_reference', data: { kind: 'video_reference' as const } },
    { id: 'motion-edge', source: 'motion-video', target: 'modify-video-shot', sourceHandle: 'video_reference', targetHandle: 'motion_reference', data: { kind: 'motion_reference' as const } },
    { id: 'previous-edge', source: 'previous-video', target: 'modify-video-shot', sourceHandle: 'video_reference', targetHandle: 'previous_shot', data: { kind: 'previous_shot' as const } },
  ];

  assert.deepEqual(workspaceVideoReferencesForGeneration({ nodes, edges, shotNode }), [
    'https://cdn.example.com/source.mp4',
    'https://cdn.example.com/motion.mp4',
    'https://cdn.example.com/previous.mp4',
  ]);

  const chatSettings: WorkspaceShotSettings = {
    ...BASE_POLICY_TEST_SHOT,
    presetId: 'chat-box',
    family: 'chat',
    outputKind: 'text',
    modelId: 'studio-chat-openai',
    workflowType: 'chat_completion',
  };
  assert.equal(resolveWorkspaceGenerationRoute(chatSettings), 'unsupported');
});

test('tool-aware pricing blocks missing inputs and estimates ready Character and Audio blocks', () => {
  const capabilities = getWorkspaceModelCapabilities();
  const angle = getWorkspaceBlockPreset('angle')?.defaultShot;
  const character = getWorkspaceBlockPreset('character-builder')?.defaultShot;
  const music = getWorkspaceBlockPreset('audio-music')?.defaultShot;
  assert.ok(angle);
  assert.ok(character);
  assert.ok(music);

  const blockedValidation = validateShotConnections({
    settings: angle,
    connectedInputs: [],
    capabilities,
  });
  const blocked = buildWorkspaceToolPricingEstimate({
    settings: angle,
    validation: blockedValidation,
    prompt: '',
    connectedInputs: [],
  });
  assert.equal(blocked?.status, 'blocked');
  assert.equal(blocked?.label, 'Connect input');

  const characterReady = buildWorkspaceToolPricingEstimate({
    settings: {
      ...character,
      toolSettings: {
        characterBuilder: {
          ...character.toolSettings!.characterBuilder!,
          qualityMode: 'draft',
          formatMode: '2k',
          generateCount: 4,
        },
      },
    },
    validation: validateShotConnections({
      settings: character,
      connectedInputs: [],
      capabilities,
    }),
    prompt: 'A lead character for a product film.',
    connectedInputs: [],
  });
  assert.equal(characterReady?.status, 'ready');
  assert.equal(characterReady?.totalCents, 64);
  assert.equal(characterReady?.label, 'Est. $0.64');

  const audioReady = buildWorkspaceToolPricingEstimate({
    settings: { ...music, durationSec: 30 },
    validation: validateShotConnections({
      settings: music,
      connectedInputs: ['prompt'],
      capabilities,
    }),
    prompt: 'Sparse cinematic pulse with warm analog texture.',
    connectedInputs: ['prompt'],
  });
  assert.equal(audioReady?.status, 'ready');
  assert.equal(audioReady?.currency, 'USD');
  assert.ok((audioReady?.totalCents ?? 0) > 0);
});

test('Studio pricing states stay truthful for missing, estimable, and unsupported blocks', () => {
  const capabilities = getWorkspaceModelCapabilities();
  const modifyVideo = defaultShotForPreset('modify-video');
  const audioSfx = defaultShotForPreset('audio-sfx');
  const chatSettings: WorkspaceShotSettings = {
    ...BASE_POLICY_TEST_SHOT,
    presetId: 'chat-box',
    family: 'chat',
    outputKind: 'text',
    modelId: 'studio-chat-openai',
    workflowType: 'chat_completion',
  };

  const missingModifyVideo = buildWorkspaceToolPricingEstimate({
    settings: modifyVideo,
    validation: validateShotConnections({
      settings: modifyVideo,
      connectedInputs: ['prompt'],
      capabilities,
    }),
    prompt: 'Reframe this clip.',
    connectedInputs: ['prompt'],
  });
  assert.equal(missingModifyVideo?.status, 'blocked');
  assert.equal(missingModifyVideo?.label, 'Connect input');

  const readyModifyVideo = buildWorkspaceToolPricingEstimate({
    settings: modifyVideo,
    validation: validateShotConnections({
      settings: modifyVideo,
      connectedInputs: ['prompt', 'video_reference'],
      capabilities,
    }),
    prompt: 'Reframe this clip.',
    connectedInputs: ['prompt', 'video_reference'],
  });
  assert.equal(readyModifyVideo, null, 'ready video pricing should use backend preflight instead of a local fake estimate');
  const videoPreflight = buildWorkspaceShotPreflightRequest({
    settings: modifyVideo,
    connectedInputs: ['prompt', 'video_reference'],
    capability: capabilities.find((capability) => capability.id === modifyVideo.modelId) ?? null,
  });
  assert.equal(videoPreflight.mode, 'v2v');

  const readyAudio = buildWorkspaceToolPricingEstimate({
    settings: { ...audioSfx, durationSec: 8 },
    validation: validateShotConnections({
      settings: audioSfx,
      connectedInputs: ['prompt'],
      capabilities,
    }),
    prompt: 'A short metallic whoosh.',
    connectedInputs: ['prompt'],
  });
  assert.equal(readyAudio?.status, 'ready');
  assert.ok((readyAudio?.totalCents ?? 0) > 0);

  const chatMissing = buildWorkspaceToolPricingEstimate({
    settings: chatSettings,
    validation: validateShotConnections({
      settings: chatSettings,
      connectedInputs: [],
      capabilities,
    }),
    prompt: '',
    connectedInputs: [],
  });
  assert.equal(chatMissing?.status, 'blocked');
  assert.equal(chatMissing?.label, 'Connect input');

  const chatUnsupported = buildWorkspaceToolPricingEstimate({
    settings: chatSettings,
    validation: validateShotConnections({
      settings: chatSettings,
      connectedInputs: ['prompt'],
      capabilities,
    }),
    prompt: 'Review this context.',
    connectedInputs: ['prompt'],
  });
  assert.equal(chatUnsupported?.status, 'error');
  assert.equal(chatUnsupported?.label, 'Price unavailable');
  assert.match(chatUnsupported?.error ?? '', /chat pricing/i);
});

test('Angle and Upscale Studio routing preserves product API pricing in output metadata', () => {
  const routingSource = readFileSync(
    join(root, 'frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-generation-routing.ts'),
    'utf8'
  );
  const upscaleFunction = routingSource.match(/async function submitUpscaleGeneration[\s\S]*?async function submitAudioGeneration/)?.[0] ?? '';
  const angleFunction = routingSource.match(/async function submitAngleGeneration[\s\S]*?export async function submitWorkspaceGenerationByFamily/)?.[0] ?? '';

  assert.match(upscaleFunction, /pricing:\s*pricingSnapshotFromToolPricing\(result\.pricing\)/);
  assert.doesNotMatch(upscaleFunction, /pricing:\s*null/);
  assert.match(angleFunction, /pricing:\s*pricingSnapshotFromToolPricing\(result\.pricing\)/);
  assert.doesNotMatch(angleFunction, /pricing:\s*null/);
});

test('shot inspector renders specialized mini-tool sections from real tool option data', () => {
  const inspectorSource = readFileSync(
    join(root, 'frontend/app/(core)/(workspace)/app/studio/workspace/_components/ShotNodeInspector.tsx'),
    'utf8'
  );
  const toolSectionsSource = readFileSync(
    join(root, 'frontend/app/(core)/(workspace)/app/studio/workspace/_components/ShotNodeToolSections.tsx'),
    'utf8'
  );

  assert.match(inspectorSource, /ShotNodeToolSections/);
  assert.match(inspectorSource, /toolPanelSectionsForShot/);
  assert.match(toolSectionsSource, /CHARACTER_OUTPUT_OPTIONS/);
  assert.match(toolSectionsSource, /CHARACTER_CONSISTENCY_OPTIONS/);
  assert.match(toolSectionsSource, /CHARACTER_QUALITY_OPTIONS/);
  assert.match(toolSectionsSource, /getAvailableCharacterFormatOptions/);
  assert.match(toolSectionsSource, /AUDIO_MOOD_VALUES/);
  assert.match(toolSectionsSource, /renderCharacterBuilderSection/);
  assert.match(toolSectionsSource, /renderAngleSection/);
  assert.match(toolSectionsSource, /renderUpscaleSection/);
  assert.match(toolSectionsSource, /renderStoryboardSection/);
  assert.match(toolSectionsSource, /renderAudioSection/);
});

test('Studio shot node controls render from policy control fields instead of hardcoded generic controls', () => {
  const source = readFileSync(
    join(root, 'frontend/app/(core)/(workspace)/app/studio/workspace/_components/nodes/workspace-shot-node-controls.tsx'),
    'utf8'
  );

  assert.match(source, /resolveWorkspaceBlockPolicy|policy\.controlFields|controlFields/);
  assert.match(source, /WorkspaceControlField/);
  assert.doesNotMatch(source, /shot\.family !== 'audio' && !shot\.toolKind/);
});

test('Studio policy control renderers preserve capability render-option and chat policy boundaries', () => {
  const controlFieldSource = readFileSync(
    join(root, 'frontend/app/(core)/(workspace)/app/studio/workspace/_components/nodes/WorkspaceControlField.tsx'),
    'utf8'
  );
  const chatInspectorSource = readFileSync(
    join(root, 'frontend/app/(core)/(workspace)/app/studio/workspace/_components/ChatNodeInspector.tsx'),
    'utf8'
  );

  assert.match(controlFieldSource, /audioOption\?\.control === 'included'/);
  assert.match(controlFieldSource, /audioOption\?\.control === 'toggle'/);
  assert.match(controlFieldSource, /chatProvider|chatModel|chatSystemPrompt|chatMessage/);
  assert.match(chatInspectorSource, /resolveWorkspaceBlockPolicy/);
  assert.match(chatInspectorSource, /policy\.controlFields\.map/);
  assert.match(chatInspectorSource, /WorkspaceControlField/);
});

test('Studio specialized inspector fields patch the policy field they render', () => {
  const toolSectionsSource = readFileSync(
    join(root, 'frontend/app/(core)/(workspace)/app/studio/workspace/_components/ShotNodeToolSections.tsx'),
    'utf8'
  );
  const helpersSource = readFileSync(
    join(root, 'frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-shot-inspector-helpers.ts'),
    'utf8'
  );

  assert.match(toolSectionsSource, /has\('tool\.storyboard\.durationSec'\).*patchStoryboard\(\{ durationSec:/);
  assert.match(helpersSource, /field === 'audioLanguage'/);
});

test('Angle node replaces the generic generate placeholder with an inline 3D picker', () => {
  const nodeTypesSource = readFileSync(
    join(root, 'frontend/app/(core)/(workspace)/app/studio/workspace/_components/nodes/workspace-node-types.tsx'),
    'utf8'
  );
  const anglePickerSource = readFileSync(
    join(root, 'frontend/app/(core)/(workspace)/app/studio/workspace/_components/nodes/workspace-angle-reference-picker.tsx'),
    'utf8'
  );
  const renderNodesSource = readFileSync(
    join(root, 'frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceRenderNodes.ts'),
    'utf8'
  );
  const workspaceTypesSource = readFileSync(
    join(root, 'frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-types.ts'),
    'utf8'
  );

  assert.match(nodeTypesSource, /workspace-angle-reference-picker/);
  assert.match(nodeTypesSource, /<AngleReferencePicker/);
  assert.match(nodeTypesSource, /shot\.toolKind === 'angle'/);
  assert.match(anglePickerSource, /function AngleReferencePicker/);
  assert.match(anglePickerSource, /data-angle-picker/);
  assert.match(nodeTypesSource, /onPatchShot\?\.\(props\.id/);
  assert.match(renderNodesSource, /onPatchShot: \(nodeId: string, patch: Partial<WorkspaceShotSettings>\)/);
  assert.match(renderNodesSource, /onPatchShot,\s*$/m);
  assert.match(workspaceTypesSource, /onPatchShot\?: \(nodeId: string, patch: Partial<WorkspaceShotSettings>\) => void/);
});

test('Studio Angle node embeds the product Angle tool picker with connected reference media', () => {
  const nodeTypesSource = readFileSync(
    join(root, 'frontend/app/(core)/(workspace)/app/studio/workspace/_components/nodes/workspace-node-types.tsx'),
    'utf8'
  );
  const anglePickerSource = readFileSync(
    join(root, 'frontend/app/(core)/(workspace)/app/studio/workspace/_components/nodes/workspace-angle-reference-picker.tsx'),
    'utf8'
  );
  const renderNodesSource = readFileSync(
    join(root, 'frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceRenderNodes.ts'),
    'utf8'
  );
  const workspaceTypesSource = readFileSync(
    join(root, 'frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-types.ts'),
    'utf8'
  );

  assert.match(anglePickerSource, /AngleOrbitSelector|AngleOrbitCanvas/);
  assert.doesNotMatch(anglePickerSource, /RotateCcw|RotateCw|anglePickerCube/);
  assert.match(workspaceTypesSource, /referencePreview\?:/);
  assert.match(renderNodesSource, /referencePreview:\s*referencePreviewForShotNode/);
  assert.match(nodeTypesSource, /referencePreview=\{props\.data\.referencePreview/);
});
