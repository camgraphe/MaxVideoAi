import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { getWorkspaceBlockPreset } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-block-presets';
import { validateShotConnections } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-capabilities';
import { resolveWorkspaceBlockPolicy } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/models/workspace-block-capability-policy';
import {
  blockedWorkspacePricingEstimate,
  buildWorkspaceImageEstimateRequest,
  buildWorkspaceStoryboardImageEstimateRequest,
  formatWorkspaceImagePricingEstimate,
  readyWorkspacePricingEstimate,
  unavailableWorkspacePricingEstimate,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-pricing';
import {
  buildWorkspaceToolBillingProductRequest,
  buildWorkspaceToolPricingEstimate,
  formatWorkspaceBillingProductPricingEstimate,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-tool-pricing';
import { buildWorkspaceImageGenerationRequest } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-tool-requests';

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

test('ordinary image estimate quantity exactly matches one and four image generation payloads', () => {
  for (const outputCount of [1, 4]) {
    const settings = { ...defaultShot('generate-image'), outputCount };
    const validation = validateShotConnections({ settings, connectedInputs: [] });
    const policy = resolveWorkspaceBlockPolicy({
      settings,
      capability: validation.capability,
      connectedInputs: [],
    });
    const generationRequest = buildWorkspaceImageGenerationRequest({
      settings,
      prompt: 'A product portrait',
      referenceImages: [],
      policy,
    });
    const estimateRequest = buildWorkspaceImageEstimateRequest({
      settings,
      connectedInputs: [],
      capability: validation.capability,
    });

    assert.equal(estimateRequest.numImages, outputCount);
    assert.equal(estimateRequest.numImages, generationRequest.numImages);
    assert.equal(estimateRequest.engineId, generationRequest.engineId);
    assert.equal(estimateRequest.mode, generationRequest.mode);
  }

  const hookSource = readFileSync(join(
    process.cwd(),
    'frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceShotPricing.ts'
  ), 'utf8');
  assert.match(hookSource, /settings\.family === 'image'[\s\S]*buildWorkspaceImageEstimateRequest/);
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

test('character builder uses the server billing product and selected quantity', () => {
  const settings = defaultShot('character-builder');
  const configured = {
    ...settings,
    toolSettings: {
      ...settings.toolSettings,
      characterBuilder: {
        ...settings.toolSettings!.characterBuilder!,
        qualityMode: 'draft' as const,
        formatMode: '2k' as const,
        generateCount: 4 as const,
      },
    },
  };
  const request = buildWorkspaceToolBillingProductRequest(configured);
  const estimate = formatWorkspaceBillingProductPricingEstimate(request!, {
    ok: true,
    product: {
      productKey: 'character-draft',
      currency: 'USD',
      unitKind: 'image',
      unitPriceCents: 9,
    },
  });

  assert.deepEqual(request, { productKey: 'character-draft', quantity: 8 });
  assert.equal(estimate.status, 'ready');
  assert.equal(estimate.totalCents, 72);
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

test('Angle pricing uses one-output and four-output server catalog quotes', () => {
  const settings = defaultShot('angle');
  const connectedInputs = ['reference'] as const;
  const validation = validateShotConnections({ settings, connectedInputs: [...connectedInputs] });
  const policy = resolveWorkspaceBlockPolicy({
    settings,
    capability: validation.capability,
    connectedInputs: [...connectedInputs],
  });
  const singleRequest = buildWorkspaceToolBillingProductRequest({
    ...settings,
    toolSettings: {
      ...settings.toolSettings,
      angle: { ...settings.toolSettings?.angle!, generateBestAngles: false },
    },
  });
  const multiRequest = buildWorkspaceToolBillingProductRequest({
    ...settings,
    toolSettings: {
      ...settings.toolSettings,
      angle: { ...settings.toolSettings?.angle!, generateBestAngles: true },
    },
  });
  const singleQuote = formatWorkspaceBillingProductPricingEstimate(singleRequest!, {
    ok: true,
    product: { productKey: 'angle-flux-single', currency: 'USD', unitKind: 'run', unitPriceCents: 4 },
  });
  const multiQuote = formatWorkspaceBillingProductPricingEstimate(multiRequest!, {
    ok: true,
    product: { productKey: 'angle-flux-multi', currency: 'USD', unitKind: 'run', unitPriceCents: 24 },
  });

  assert.deepEqual(policy.outputCount, { min: 1, max: 4 });
  assert.deepEqual(singleRequest, { productKey: 'angle-flux-single', quantity: 1 });
  assert.deepEqual(multiRequest, { productKey: 'angle-flux-multi', quantity: 4 });
  assert.equal(singleQuote.totalCents, 4);
  assert.equal(multiQuote.totalCents, 24);
});

test('invalid ordinary blocks return a local blocked estimate before remote pricing', () => {
  const hookSource = readFileSync(join(
    process.cwd(),
    'frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceShotPricing.ts'
  ), 'utf8');

  assert.match(
    hookSource,
    /if \(!validation\.canGenerate\)[\s\S]*blockedWorkspacePricingEstimate[\s\S]*buildWorkspaceShotPreflightRequest/
  );
  assert.match(hookSource, /\/api\/billing-products\?productKey=/);
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
