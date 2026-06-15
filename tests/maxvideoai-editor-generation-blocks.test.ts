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
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-generation-routing';
import {
  buildWorkspaceCharacterBuilderRequest,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-tool-requests';
import {
  buildWorkspaceToolPricingEstimate,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-tool-pricing';
import {
  localizeWorkspaceNodeSubtitle,
  localizeWorkspaceNodeTitle,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-generated-copy';
import {
  compactStudioChatMessages,
  getDefaultStudioChatModel,
  getStudioChatModels,
  isStudioChatModelAllowed,
} from '../frontend/lib/studio-chat-models';
import {
  compatibleCapabilitiesForShot,
  isToolOnlyPreset,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-shot-inspector-helpers';
import {
  getWorkspaceBlockCompatibleCapabilities,
  resolveWorkspaceBlockPolicy,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/models/workspace-block-capability-policy';
import type { WorkspaceShotSettings } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-types';
import type { CharacterBuilderTraits } from '../frontend/types/character-builder';

const root = process.cwd();

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
  assert.match(chatNodeSource, /navigator\.clipboard\.writeText/);
  assert.match(chatNodeSource, /messages:\s*\[\]/);
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
