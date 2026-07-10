import assert from 'node:assert/strict';
import test from 'node:test';

import { getWorkspaceBlockPreset } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-block-presets';
import { validateShotConnections } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-capabilities';
import {
  blockedWorkspacePricingEstimate,
  readyWorkspacePricingEstimate,
  unavailableWorkspacePricingEstimate,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-pricing';
import { buildWorkspaceToolPricingEstimate } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-tool-pricing';
import type { WorkspaceShotSettings } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-types';

function defaultShot(presetId: Parameters<typeof getWorkspaceBlockPreset>[0]) {
  const preset = getWorkspaceBlockPreset(presetId);
  assert.ok(preset?.defaultShot);
  return preset.defaultShot;
}

test('shared pricing constructors emit normalized V1 states', () => {
  const settings = defaultShot('angle');
  const validation = validateShotConnections({ settings, connectedInputs: [] });

  assert.equal(blockedWorkspacePricingEstimate(validation).status, 'blocked');
  assert.equal(readyWorkspacePricingEstimate(12).status, 'ready');
  assert.equal(unavailableWorkspacePricingEstimate('Chat pricing is unavailable').status, 'error');
});

test('tool pricing is blocked when required inputs are missing', () => {
  const settings = defaultShot('angle');
  const validation = validateShotConnections({ settings, connectedInputs: [] });
  const estimate = buildWorkspaceToolPricingEstimate({
    settings,
    validation,
    prompt: '',
    connectedInputs: [],
  });

  assert.equal(estimate?.status, 'blocked');
  assert.match(estimate?.label ?? '', /Connect input|Needs attention/);
});

test('character builder can price from scratch because reference is optional', () => {
  const settings = defaultShot('character-builder');
  const validation = validateShotConnections({ settings, connectedInputs: [] });
  const estimate = buildWorkspaceToolPricingEstimate({
    settings,
    validation,
    prompt: 'A consistent young founder character.',
    connectedInputs: [],
  });

  assert.equal(estimate?.status, 'ready');
  assert.ok((estimate?.totalCents ?? 0) > 0);
});

test('chat pricing is explicitly unavailable without blocking chat send', () => {
  const settings: WorkspaceShotSettings = {
    durationSec: 1,
    aspectRatio: '16:9',
    resolution: '1080p',
    fps: 24,
    seed: null,
    audioEnabled: false,
    lipSyncEnabled: false,
    referenceStrength: 0.65,
    outputName: 'Chat response',
    status: 'draft',
    presetId: 'chat-box',
    family: 'chat',
    outputKind: 'text',
    modelId: 'studio-chat-openai',
    workflowType: 'chat_completion',
  };
  const validation = validateShotConnections({ settings, connectedInputs: ['prompt'] });
  const estimate = buildWorkspaceToolPricingEstimate({
    settings,
    validation,
    prompt: 'Improve this shot plan.',
    connectedInputs: ['prompt'],
  });

  assert.equal(estimate?.status, 'error');
  assert.match(estimate?.error ?? '', /chat/i);
});
