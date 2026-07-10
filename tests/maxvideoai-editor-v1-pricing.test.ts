import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { getWorkspaceBlockPreset } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-block-presets';
import { validateShotConnections } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-capabilities';
import { resolveWorkspaceBlockPolicy } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/models/workspace-block-capability-policy';
import {
  blockedWorkspacePricingEstimate,
  buildWorkspaceStoryboardImageEstimateRequest,
  formatWorkspaceImagePricingEstimate,
  readyWorkspacePricingEstimate,
  unavailableWorkspacePricingEstimate,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-pricing';
import {
  buildWorkspaceAnglePricingEstimate,
  buildWorkspaceToolPricingEstimate,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-tool-pricing';

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

test('ready storyboard pricing uses its image estimate payload instead of virtual video preflight', () => {
  const settings = defaultShot('storyboard');
  const request = buildWorkspaceStoryboardImageEstimateRequest({
    settings: {
      ...settings,
      toolSettings: {
        ...settings.toolSettings,
        storyboard: {
          ...settings.toolSettings?.storyboard!,
          orientation: 'portrait',
          tier: 'ultra',
          targetModel: 'kling',
        },
      },
    },
  });

  assert.deepEqual(request, {
    engineId: 'gpt-image-2',
    mode: 'i2i',
    numImages: 1,
    referenceImageSizes: [{ width: 1000, height: 1600 }],
    resolution: 'custom',
    customImageSize: { width: 2160, height: 3840 },
    quality: 'high',
    source: 'storyboard',
    metadata: { storyboard: { role: 'board', targetModel: 'kling' } },
    aspectRatio: '9:16',
  });
  assert.notEqual(request.engineId, settings.modelId);
});

test('Storyboard image estimate responses map to ready and explanatory error pricing states', () => {
  const ready = formatWorkspaceImagePricingEstimate({
    ok: true,
    pricing: { totalCents: 42, currency: 'USD' },
  });
  const error = formatWorkspaceImagePricingEstimate({ ok: false, error: 'engine_unavailable' });

  assert.equal(ready.status, 'ready');
  assert.equal(ready.totalCents, 42);
  assert.equal(error.status, 'error');
  assert.equal(error.error, 'engine_unavailable');
});

test('Angle pricing uses the policy output count instead of the legacy best-angles toggle', () => {
  const settings = defaultShot('angle');
  const connectedInputs = ['reference'] as const;
  const validation = validateShotConnections({ settings, connectedInputs: [...connectedInputs] });
  const policy = resolveWorkspaceBlockPolicy({
    settings,
    capability: validation.capability,
    connectedInputs: [...connectedInputs],
  });
  const withoutLegacyToggle = buildWorkspaceToolPricingEstimate({
    settings: {
      ...settings,
      toolSettings: {
        ...settings.toolSettings,
        angle: { ...settings.toolSettings?.angle!, generateBestAngles: false },
      },
    },
    validation,
    prompt: '',
    connectedInputs: [...connectedInputs],
  });
  const withLegacyToggle = buildWorkspaceToolPricingEstimate({
    settings: {
      ...settings,
      toolSettings: {
        ...settings.toolSettings,
        angle: { ...settings.toolSettings?.angle!, generateBestAngles: true },
      },
    },
    validation,
    prompt: '',
    connectedInputs: [...connectedInputs],
  });

  assert.deepEqual(policy.outputCount, { min: 1, max: 4 });
  assert.equal(buildWorkspaceAnglePricingEstimate(settings, 1).totalCents, 4);
  assert.equal(buildWorkspaceAnglePricingEstimate(settings, policy.outputCount).totalCents, 24);
  assert.equal(withoutLegacyToggle?.totalCents, 24);
  assert.equal(withLegacyToggle?.totalCents, withoutLegacyToggle?.totalCents);
});

test('chat pricing is explicitly unavailable without blocking chat send', () => {
  const hookSource = readFileSync(join(process.cwd(), 'frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceShotPricing.ts'), 'utf8');
  const renderNodesSource = readFileSync(join(process.cwd(), 'frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceRenderNodes.ts'), 'utf8');
  const chatNodeSource = readFileSync(join(process.cwd(), 'frontend/app/(core)/(workspace)/app/studio/workspace/_components/nodes/workspace-chat-node.tsx'), 'utf8');
  const chatNodeStyles = readFileSync(join(process.cwd(), 'frontend/app/(core)/(workspace)/app/studio/workspace/_styles/canvas-chat-node.module.css'), 'utf8');

  assert.match(hookSource, /node\.data\.kind === 'chat'[\s\S]*unavailableWorkspacePricingEstimate/);
  assert.match(renderNodesSource, /node\.data\.kind === 'chat'[\s\S]*pricingEstimate: pricingEstimates\[node\.id\]/);
  assert.match(chatNodeSource, /pricingEstimate\.label/);
  assert.match(chatNodeSource, /pricingEstimate\.error \? \(\s*<span className=\{chatStyles\.chatPricingDetail\}>\s*\{pricingEstimate\.error\}/);
  assert.match(chatNodeStyles, /\.chatPricingDetail\s*\{[\s\S]*line-clamp:\s*2/);
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
