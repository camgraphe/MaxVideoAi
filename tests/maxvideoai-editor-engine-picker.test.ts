import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import type { EngineAvailability } from '../frontend/types/engines';
import { getBaseEnginesByCategory } from '../frontend/src/lib/engines';
import { getWorkspaceModelCapabilities } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-capabilities';
import { validateShotConnections } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-capabilities';
import { WORKSPACE_BLOCK_PRESETS } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-block-presets';
import type { WorkspaceModelCapability } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-types';
import {
  buildWorkspaceEnginePickerGroups,
  workspaceEnginePickerTriggerLabel,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/models/workspace-engine-picker';
import {
  resolveWorkspaceBlockPolicy,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/models/workspace-block-capability-policy';
import {
  resolveWorkspaceEngineOperationalEligibility,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/models/workspace-engine-availability';
import {
  workspaceShotPatchForModelSelection,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/models/workspace-model-selection';

const capabilities = getWorkspaceModelCapabilities();
const generateVideo = structuredClone(
  WORKSPACE_BLOCK_PRESETS.find((preset) => preset.id === 'generate-video')!.defaultShot!
);
const generationActionsSource = readFileSync(
  join(
    process.cwd(),
    'frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceGenerationActions.ts'
  ),
  'utf8'
);
const baseVideoEngine = getBaseEnginesByCategory('video')
  .find((engine) => engine.id === 'seedance-2-0')!;

function syntheticVideoCapability(availability: EngineAvailability): WorkspaceModelCapability {
  const id = `test-${availability}`;
  const capability = getWorkspaceModelCapabilities([{
    ...baseVideoEngine,
    id,
    label: `Synthetic ${availability}`,
    availability,
  }]).find((candidate) => candidate.id === id);
  assert.ok(capability);
  return capability;
}

test('model selection resets model-derived options in one shared patch', () => {
  const next = capabilities.find((capability) => capability.id === 'veo-3-1')!;
  const patch = workspaceShotPatchForModelSelection(generateVideo, next);
  assert.equal(patch.modelId, next.id);
  assert.equal(patch.family, next.family);
  assert.equal(patch.outputKind, next.outputKind);
  assert.equal(typeof patch.audioEnabled, 'boolean');
  assert.equal(typeof patch.lipSyncEnabled, 'boolean');
});

test('picker omits block-incompatible families without a local allowlist', () => {
  const groups = buildWorkspaceEnginePickerGroups({
    settings: generateVideo,
    capabilities,
    connectedInputs: [],
    selectedModelId: generateVideo.modelId,
    incompatibleReason: 'Not compatible with current inputs',
    pausedReason: 'Temporarily paused',
    waitlistReason: 'Waitlist only',
  });
  const items = groups.flatMap((group) => group.items);
  assert.ok(items.some((item) => item.id === generateVideo.modelId));
  assert.equal(items.some((item) => item.capability.family === 'audio'), false);
  assert.equal(items.some((item) => item.capability.family === 'image'), false);
});

test('picker keeps intent-compatible models disabled when current inputs cannot route them', () => {
  const source = capabilities.find((capability) => capability.id === 'seedance-2-0')!;
  const textOnly: WorkspaceModelCapability = {
    ...source,
    id: 'test-text-only',
    label: 'Text only',
    workflows: ['text_to_video'],
    text_to_video: true,
    image_to_video: false,
  };
  const imageOnly: WorkspaceModelCapability = {
    ...source,
    id: 'test-image-only',
    label: 'Image only',
    workflows: ['image_to_video'],
    text_to_video: false,
    image_to_video: true,
  };
  const groups = buildWorkspaceEnginePickerGroups({
    settings: generateVideo,
    capabilities: [textOnly, imageOnly],
    connectedInputs: ['start_image'],
    selectedModelId: generateVideo.modelId,
    incompatibleReason: 'Not compatible with current inputs',
    pausedReason: 'Temporarily paused',
    waitlistReason: 'Waitlist only',
  });
  const disabled = groups.flatMap((group) => group.items).filter((item) => item.disabled);
  assert.deepEqual(disabled.map((item) => item.id), ['test-text-only']);
  assert.ok(disabled.every((item) => item.disabledReason === 'Not compatible with current inputs'));
});

test('operational eligibility keeps available and limited explicit while blocking paused and waitlist', () => {
  const expectations: Array<{ availability: EngineAvailability; operational: boolean }> = [
    { availability: 'available', operational: true },
    { availability: 'limited', operational: true },
    { availability: 'paused', operational: false },
    { availability: 'waitlist', operational: false },
  ];

  for (const expectation of expectations) {
    const capability = syntheticVideoCapability(expectation.availability);
    const eligibility = resolveWorkspaceEngineOperationalEligibility(capability);
    assert.equal(eligibility.availability, expectation.availability);
    assert.equal(eligibility.isOperational, expectation.operational);
  }
});

test('paused and waitlisted persisted selections are disabled, not ready, and blocked by the final guard', () => {
  for (const availability of ['paused', 'waitlist'] as const) {
    const capability = syntheticVideoCapability(availability);
    const settings = { ...generateVideo, modelId: capability.id };
    const groups = buildWorkspaceEnginePickerGroups({
      settings,
      capabilities: [capability],
      connectedInputs: ['prompt'],
      selectedModelId: capability.id,
      incompatibleReason: 'Not compatible with current inputs',
      pausedReason: 'Temporarily paused',
      waitlistReason: 'Waitlist only',
    });
    const item = groups.flatMap((group) => group.items)[0];
    assert.equal(item?.disabled, true);
    assert.equal(item?.disabledReason, availability === 'paused' ? 'Temporarily paused' : 'Waitlist only');

    const policy = resolveWorkspaceBlockPolicy({
      settings,
      capability,
      connectedInputs: ['prompt'],
    });
    assert.equal(policy.canGenerate, false);
    assert.equal(validateShotConnections({
      settings,
      connectedInputs: ['prompt'],
      capabilities: [capability],
    }).canGenerate, false);
  }

  assert.match(generationActionsSource, /resolveWorkspaceEngineOperationalEligibility/);
  assert.match(
    generationActionsSource,
    /!operationalEligibility\.isOperational\s*\|\|\s*!validation\.canGenerate/,
    'the last user-triggered generation boundary must recheck operational availability'
  );
});

test('available and limited selections remain enabled and generation-ready', () => {
  for (const availability of ['available', 'limited'] as const) {
    const capability = syntheticVideoCapability(availability);
    const settings = { ...generateVideo, modelId: capability.id };
    const groups = buildWorkspaceEnginePickerGroups({
      settings,
      capabilities: [capability],
      connectedInputs: ['prompt'],
      selectedModelId: capability.id,
      incompatibleReason: 'Not compatible with current inputs',
      pausedReason: 'Temporarily paused',
      waitlistReason: 'Waitlist only',
    });
    assert.equal(groups.flatMap((group) => group.items)[0]?.disabled, false);
    assert.equal(validateShotConnections({
      settings,
      connectedInputs: ['prompt'],
      capabilities: [capability],
    }).canGenerate, true);
  }
});

test('empty picker uses localized unavailable copy and generation stays blocked', () => {
  assert.equal(workspaceEnginePickerTriggerLabel({
    groups: [],
    selectedModelId: 'missing-model',
    openLabel: 'Choose an engine',
    unavailableLabel: 'Unavailable',
  }), 'Unavailable');
  assert.equal(validateShotConnections({
    settings: { ...generateVideo, modelId: 'missing-model' },
    connectedInputs: ['prompt'],
    capabilities: [],
  }).canGenerate, false);
});
