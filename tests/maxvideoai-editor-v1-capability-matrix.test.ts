import assert from 'node:assert/strict';
import test from 'node:test';

import {
  WORKSPACE_V1_BLOCK_MATRIX,
  getWorkspaceV1BlockContract,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/models/workspace-v1-block-matrix';
import { getWorkspaceBlockCompatibleCapabilities } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/models/workspace-block-capability-policy';
import { getWorkspaceModelCapabilities } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-capabilities';
import {
  getWorkspaceBlockPreset,
  WORKSPACE_BLOCK_PRESETS,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-block-presets';

const expectedV1Presets = [
  'generate-image',
  'modify-image',
  'generate-video',
  'modify-video',
  'audio-music',
  'audio-voiceover',
  'audio-sfx',
  'audio-sound-design',
  'audio-sound-design-voice',
  'angle',
  'character-builder',
  'storyboard',
  'upscale-image',
  'upscale-video',
  'chat-box',
] as const;

function compatibleIds(presetId: Parameters<typeof getWorkspaceBlockPreset>[0]): string[] {
  const preset = getWorkspaceBlockPreset(presetId);
  assert.ok(preset?.defaultShot);
  return getWorkspaceBlockCompatibleCapabilities({
    settings: preset.defaultShot,
    capabilities: getWorkspaceModelCapabilities(),
  }).map((capability) => capability.id);
}

test('Studio V1 has an explicit contract for every generation block preset', () => {
  const presetIds = WORKSPACE_BLOCK_PRESETS
    .filter((preset) => preset.nodeKind === 'shot' || preset.nodeKind === 'chat')
    .map((preset) => preset.id);

  for (const presetId of expectedV1Presets) {
    assert.ok(presetIds.includes(presetId), `${presetId} must be available in the palette`);
    assert.ok(WORKSPACE_V1_BLOCK_MATRIX[presetId], `${presetId} must have a V1 block contract`);
  }
});

test('Studio V1 block contracts define exact workflow intent and output media', () => {
  assert.deepEqual(getWorkspaceV1BlockContract('generate-video').workflows, [
    'text_to_video',
    'image_to_video',
    'storyboard_to_video',
    'character_to_video',
  ]);
  assert.deepEqual(getWorkspaceV1BlockContract('modify-video').workflows, ['video_to_video']);
  assert.deepEqual(getWorkspaceV1BlockContract('generate-image').workflows, ['text_to_image']);
  assert.deepEqual(getWorkspaceV1BlockContract('modify-image').workflows, ['image_to_image']);
  assert.equal(getWorkspaceV1BlockContract('angle').outputKind, 'image');
  assert.equal(getWorkspaceV1BlockContract('audio-music').outputKind, 'audio');
  assert.equal(getWorkspaceV1BlockContract('chat-box').outputKind, 'text');
});

test('Studio V1 keeps generate and modify model lists distinct', () => {
  const generateVideoIds = compatibleIds('generate-video');
  const modifyVideoIds = compatibleIds('modify-video');
  const generateImageIds = compatibleIds('generate-image');
  const modifyImageIds = compatibleIds('modify-image');

  assert.ok(generateVideoIds.some((id) => id.includes('seedance') || id.includes('veo') || id.includes('kling')));
  assert.ok(modifyVideoIds.includes('luma-ray-3-2'));
  assert.ok(!generateVideoIds.includes('upscale-video-seedvr'));
  assert.ok(!modifyVideoIds.includes('audio-music-only'));
  assert.ok(generateImageIds.includes('seedream') || generateImageIds.includes('nano-banana-2'));
  assert.ok(modifyImageIds.every((id) => !id.startsWith('audio-')));
});

test('Studio V1 generate video excludes storyboard-only models without a reference', () => {
  const capabilities = getWorkspaceModelCapabilities();
  const sourceCapability = capabilities.find((capability) => capability.id === 'seedance-2-0');
  const preset = getWorkspaceBlockPreset('generate-video');
  assert.ok(sourceCapability);
  assert.ok(preset?.defaultShot);

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

  const plainPromptCompatible = getWorkspaceBlockCompatibleCapabilities({
    settings: preset.defaultShot,
    capabilities: [...capabilities, storyboardOnlyCapability],
    connectedInputs: ['prompt'],
  });
  const referenceCompatible = getWorkspaceBlockCompatibleCapabilities({
    settings: preset.defaultShot,
    capabilities: [...capabilities, storyboardOnlyCapability],
    connectedInputs: ['prompt', 'reference'],
  });

  assert.equal(plainPromptCompatible.some((capability) => capability.id === storyboardOnlyCapability.id), false);
  assert.ok(referenceCompatible.some((capability) => capability.id === storyboardOnlyCapability.id));
});

test('Studio V1 tool blocks only expose their product tool capabilities', () => {
  assert.deepEqual(compatibleIds('character-builder'), ['character-builder-tool']);
  assert.deepEqual(compatibleIds('storyboard'), ['storyboard-gpt-image-2']);
  assert.ok(compatibleIds('angle').every((id) => id.startsWith('angle-')));
  assert.ok(compatibleIds('upscale-image').every((id) => id.startsWith('upscale-image-')));
  assert.ok(compatibleIds('upscale-video').every((id) => id.startsWith('upscale-video-')));
});
