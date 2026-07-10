import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { getWorkspaceBlockPreset } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-block-presets';
import { validateShotConnections } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-capabilities';
import {
  blockedWorkspacePricingEstimate,
  readyWorkspacePricingEstimate,
  unavailableWorkspacePricingEstimate,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-pricing';
import { buildWorkspaceToolPricingEstimate } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-tool-pricing';

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
  const hookSource = readFileSync(join(process.cwd(), 'frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceShotPricing.ts'), 'utf8');
  const renderNodesSource = readFileSync(join(process.cwd(), 'frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceRenderNodes.ts'), 'utf8');
  const chatNodeSource = readFileSync(join(process.cwd(), 'frontend/app/(core)/(workspace)/app/studio/workspace/_components/nodes/workspace-chat-node.tsx'), 'utf8');

  assert.match(hookSource, /node\.data\.kind === 'chat'[\s\S]*unavailableWorkspacePricingEstimate/);
  assert.match(renderNodesSource, /node\.data\.kind === 'chat'[\s\S]*pricingEstimate: pricingEstimates\[node\.id\]/);
  assert.match(chatNodeSource, /pricingEstimate\.label/);
  assert.match(chatNodeSource, /disabled=\{!canSend\}/);
});

test('upscale pricing is blocked when its required input is missing', () => {
  const settings = defaultShot('upscale-image');
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

test('valid upscale input reports unavailable server-derived pricing without blocking generation', () => {
  const settings = defaultShot('upscale-image');
  const validation = validateShotConnections({ settings, connectedInputs: ['reference'] });
  const estimate = buildWorkspaceToolPricingEstimate({
    settings,
    validation,
    prompt: '',
    connectedInputs: ['reference'],
  });

  assert.equal(validation.canGenerate, true);
  assert.equal(estimate?.status, 'error');
  assert.equal(estimate?.label, 'Price unavailable');
  assert.match(estimate?.error ?? '', /source metadata.*server pricing context/i);
});
