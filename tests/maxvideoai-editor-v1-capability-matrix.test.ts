import assert from 'node:assert/strict';
import test from 'node:test';

import {
  WORKSPACE_V1_BLOCK_MATRIX,
  getWorkspaceV1BlockContract,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/models/workspace-v1-block-matrix';
import { WORKSPACE_BLOCK_PRESETS } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-block-presets';

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
