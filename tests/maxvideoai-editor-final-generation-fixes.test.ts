import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { getWorkspaceBlockPreset } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-block-presets';
import {
  createPendingWorkspaceOutputs,
  createWorkspaceGenerationResults,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-generation';
import {
  mapWorkspaceAngleGenerationOutputs,
  mapWorkspaceCharacterBuilderOutputs,
  mapWorkspaceImageGenerationOutputs,
  workspaceCharacterReferenceUrlsForGeneration,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-generation-routing';
import {
  upsertWorkspaceProjectAsset,
  workspaceAssetFromOutputNode,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-generated-media';
import { buildWorkspaceTimelineItemsForOutput } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-timeline-editing';
import { normalizePersistedWorkspaceState } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_state/workspace-api-persistence';
import type {
  WorkspaceGraphEdge,
  WorkspaceGraphNode,
  WorkspaceOutputMetadata,
  WorkspaceShotSettings,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-types';

const CREATED_AT = '2026-07-11T10:00:00.000Z';

function shot(presetId: 'angle' | 'character-builder' | 'generate-image'): WorkspaceShotSettings {
  const preset = getWorkspaceBlockPreset(presetId);
  assert.ok(preset?.defaultShot);
  return preset.defaultShot;
}

function outputContext(settings: WorkspaceShotSettings) {
  return {
    settings,
    capability: null,
    resolvedWorkflowType: settings.workflowType,
    sourceShotId: 'shot-paid',
    createdAt: CREATED_AT,
  } as const;
}

function shotNode(settings: WorkspaceShotSettings): WorkspaceGraphNode {
  return {
    id: 'shot-paid',
    type: 'shot',
    position: { x: 100, y: 100 },
    data: {
      kind: 'shot',
      title: 'Paid generation',
      shot: settings,
    },
  };
}

test('image generation maps every paid provider result with stable provenance', () => {
  const settings = { ...shot('generate-image'), outputCount: 3, aspectRatio: '9:16' as const, resolution: '4k' as const };
  const outputs = mapWorkspaceImageGenerationOutputs({
    ok: true,
    mode: 't2i',
    engineId: 'seedream',
    engineLabel: 'Seedream',
    jobId: 'image-job',
    requestId: 'image-request',
    aspectRatio: '9:16',
    resolution: '4k',
    images: [
      { url: 'https://cdn.example.com/one.png', width: 2160, height: 3840 },
      { url: 'https://cdn.example.com/two.png', width: 2160, height: 3840 },
      { url: 'https://cdn.example.com/three.png', width: 2160, height: 3840 },
    ],
  }, outputContext(settings));

  assert.equal(outputs.length, 3);
  assert.deepEqual(outputs.map((output) => output.providerOutputId), [
    'image-job:image:1',
    'image-job:image:2',
    'image-job:image:3',
  ]);
  assert.deepEqual(outputs.map((output) => output.outputIndex), [0, 1, 2]);
  assert.deepEqual(outputs.map((output) => output.outputCount), [3, 3, 3]);
  assert.deepEqual(outputs[0]?.requestedSettings, {
    durationSec: 1,
    aspectRatio: '9:16',
    resolution: '4k',
    fps: 24,
    outputCount: 3,
  });
  assert.deepEqual(outputs[0]?.sourceMetadata, {
    measurementStatus: 'measured',
    durationSec: null,
    width: 2160,
    height: 3840,
  });
  assert.equal(outputs[0]?.durationSec, undefined);
  assert.equal(outputs[0]?.aspectRatio, undefined);
  assert.equal(outputs[0]?.resolution, undefined);
});

test('Character Builder and Angle map all provider outputs without result-zero truncation', () => {
  const characterSettings = shot('character-builder');
  const characterOutputs = mapWorkspaceCharacterBuilderOutputs({
    ok: true,
    run: {
      id: 'character-run',
      jobId: 'character-job',
      action: 'generate',
      outputMode: 'portrait-reference',
      qualityMode: 'draft',
      formatMode: 'standard',
      engineId: 'character-engine',
      engineLabel: 'Character Engine',
      createdAt: CREATED_AT,
      settingsSnapshot: {} as never,
      results: [
        { id: 'character-result-1', runId: 'character-run', jobId: 'character-job', engineId: 'character-engine', engineLabel: 'Character Engine', action: 'generate', outputMode: 'portrait-reference', qualityMode: 'draft', createdAt: CREATED_AT, url: 'https://cdn.example.com/character-1.png', width: 1024, height: 1024 },
        { id: 'character-result-2', runId: 'character-run', jobId: 'character-job', engineId: 'character-engine', engineLabel: 'Character Engine', action: 'generate', outputMode: 'portrait-reference', qualityMode: 'draft', createdAt: CREATED_AT, url: 'https://cdn.example.com/character-2.png', width: 1024, height: 1024 },
      ],
    },
  }, outputContext(characterSettings));

  const angleSettings = {
    ...shot('angle'),
    toolSettings: {
      ...shot('angle').toolSettings,
      angle: { ...shot('angle').toolSettings!.angle!, generateBestAngles: true },
    },
  };
  const angleOutputs = mapWorkspaceAngleGenerationOutputs({
    ok: true,
    jobId: 'angle-job',
    engineId: 'flux-multiple-angles',
    engineLabel: 'FLUX Multiple Angles',
    requestedOutputCount: 4,
    latencyMs: 20,
    pricing: { estimatedCostUsd: 0.24, estimatedCredits: 24 },
    requested: { rotation: 35, tilt: 0, zoom: 1 },
    applied: { rotation: 35, tilt: 0, zoom: 1, safeMode: true, safeApplied: false },
    outputs: [
      { assetId: 'angle-asset-1', url: 'https://cdn.example.com/angle-1.png', width: 1280, height: 720 },
      { assetId: 'angle-asset-2', url: 'https://cdn.example.com/angle-2.png', width: 1280, height: 720 },
      { assetId: 'angle-asset-3', url: 'https://cdn.example.com/angle-3.png', width: 1280, height: 720 },
      { assetId: 'angle-asset-4', url: 'https://cdn.example.com/angle-4.png', width: 1280, height: 720 },
    ],
  }, outputContext(angleSettings));

  assert.deepEqual(characterOutputs.map((output) => output.providerOutputId), [
    'character-job:character:character-result-1',
    'character-job:character:character-result-2',
  ]);
  assert.deepEqual(angleOutputs.map((output) => output.providerOutputId), [
    'angle-job:angle:angle-asset-1',
    'angle-job:angle:angle-asset-2',
    'angle-job:angle:angle-asset-3',
    'angle-job:angle:angle-asset-4',
  ]);
});

test('multi-output graph nodes and Project media assets keep stable IDs and deduplicate registration', () => {
  const settings = { ...shot('generate-image'), outputCount: 2 };
  const outputs = mapWorkspaceImageGenerationOutputs({
    ok: true,
    mode: 't2i',
    jobId: 'stable-job',
    images: [
      { url: 'https://cdn.example.com/stable-1.png', width: 1024, height: 1024 },
      { url: 'https://cdn.example.com/stable-2.png', width: 1024, height: 1024 },
    ],
  }, outputContext(settings));
  const first = createWorkspaceGenerationResults({
    shotNode: shotNode(settings),
    settings,
    capability: null,
    outputs,
    siblingCount: 0,
  });
  const replay = createWorkspaceGenerationResults({
    shotNode: shotNode(settings),
    settings,
    capability: null,
    outputs,
    siblingCount: 0,
  });

  assert.equal(first.length, 2);
  assert.deepEqual(first.map((result) => result.outputNode.id), replay.map((result) => result.outputNode.id));
  assert.equal(new Set(first.map((result) => result.outputNode.id)).size, 2);

  const generatedAssets = first.map((result) => workspaceAssetFromOutputNode(result.outputNode));
  assert.ok(generatedAssets.every(Boolean));
  const registeredTwice = [...generatedAssets, ...generatedAssets].reduce(
    (assets, asset) => upsertWorkspaceProjectAsset(assets, asset!),
    [] as NonNullable<(typeof generatedAssets)[number]>[]
  );
  assert.equal(registeredTwice.length, 2);
  assert.equal(new Set(registeredTwice.map((asset) => asset.id)).size, 2);
});

test('distinct generation submissions and provider jobs append instead of reusing output slots', () => {
  const settings = { ...shot('generate-image'), outputCount: 2 };
  const target = shotNode(settings);
  const pendingA = createPendingWorkspaceOutputs({
    shotNode: target,
    settings,
    capability: null,
    nodes: [target],
    edges: [],
    submissionId: 'submission-a',
  } as never);
  const pendingB = createPendingWorkspaceOutputs({
    shotNode: target,
    settings,
    capability: null,
    nodes: [target],
    edges: [],
    submissionId: 'submission-b',
  } as never);
  assert.equal(new Set([...pendingA, ...pendingB].map((result) => result.outputNode.id)).size, 4);

  const outputsFor = (jobId: string, submissionId: string) => mapWorkspaceImageGenerationOutputs({
    ok: true,
    mode: 't2i',
    jobId,
    images: [
      { url: `https://cdn.example.com/${jobId}-1.png`, width: 1024, height: 1024 },
      { url: `https://cdn.example.com/${jobId}-2.png`, width: 1024, height: 1024 },
    ],
  }, { ...outputContext(settings), submissionId });
  const jobA = createWorkspaceGenerationResults({
    shotNode: target,
    settings,
    capability: null,
    outputs: outputsFor('provider-job-a', 'submission-a'),
    siblingCount: 0,
  });
  const jobB = createWorkspaceGenerationResults({
    shotNode: target,
    settings,
    capability: null,
    outputs: outputsFor('provider-job-b', 'submission-b'),
    siblingCount: 0,
  });
  const replayA = createWorkspaceGenerationResults({
    shotNode: target,
    settings,
    capability: null,
    outputs: outputsFor('provider-job-a', 'submission-replay'),
    siblingCount: 0,
  });

  assert.equal(new Set([...jobA, ...jobB].map((result) => result.outputNode.id)).size, 4);
  assert.deepEqual(jobA.map((result) => result.outputNode.id), replayA.map((result) => result.outputNode.id));
  assert.equal(new Set([...jobA, ...jobB].map((result) => workspaceAssetFromOutputNode(result.outputNode)?.id)).size, 4);
});

test('generation completion and Project media order are deterministic under reverse completion', async () => {
  const settings = { ...shot('generate-image'), outputCount: 1 };
  const target = shotNode(settings);
  const outputsFor = (jobId: string) => mapWorkspaceImageGenerationOutputs({
    ok: true,
    mode: 't2i',
    jobId,
    images: [{ url: `https://cdn.example.com/${jobId}.png`, width: 1024, height: 1024 }],
  }, { ...outputContext(settings), submissionId: `submission-${jobId}` });
  const jobA = createWorkspaceGenerationResults({
    shotNode: target,
    settings,
    capability: null,
    outputs: outputsFor('provider-job-a'),
    siblingCount: 0,
  });
  const jobB = createWorkspaceGenerationResults({
    shotNode: target,
    settings,
    capability: null,
    outputs: outputsFor('provider-job-b'),
    siblingCount: 0,
  });
  const generationModule = await import('../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-generation');
  const merge = Reflect.get(generationModule, 'mergeWorkspaceGenerationOutputNodes');
  assert.equal(typeof merge, 'function', 'generation completion needs a deterministic append-only merger');

  const apply = (nodes: WorkspaceGraphNode[], results: typeof jobA) => merge({
    nodes,
    shotNode: target,
    results,
    pendingNodeIds: [],
  }) as WorkspaceGraphNode[];
  const forwardNodes = apply(apply([target], jobA), jobB);
  const reverseNodes = apply(apply([target], jobB), jobA);
  const replayNodes = apply(apply([target], jobA), jobA);
  const snapshot = (nodes: WorkspaceGraphNode[]) => nodes
    .filter((node) => node.data.output?.sourceShotId === target.id)
    .map((node) => ({ id: node.id, position: node.position }));
  assert.deepEqual(snapshot(forwardNodes), snapshot(reverseNodes));
  assert.equal(snapshot(replayNodes).length, 1, 'exact provider-output replay must reuse its stable node');

  const assetsA = jobA.map((result) => workspaceAssetFromOutputNode(result.outputNode)).filter(Boolean);
  const assetsB = jobB.map((result) => workspaceAssetFromOutputNode(result.outputNode)).filter(Boolean);
  const register = (batches: Array<typeof assetsA>) => batches.flat().reduce(
    (assets, asset) => upsertWorkspaceProjectAsset(assets, asset!),
    [] as NonNullable<(typeof assetsA)[number]>[]
  );
  assert.deepEqual(
    register([assetsA, assetsB]).map((asset) => asset.id),
    register([assetsB, assetsA]).map((asset) => asset.id)
  );
  assert.equal(register([assetsA, assetsA]).length, 1, 'only exact provider-output replay deduplicates');
});

test('appending a distinct provider output preserves a manually moved prior output', async () => {
  const settings = { ...shot('generate-image'), outputCount: 1 };
  const target = shotNode(settings);
  const outputsFor = (jobId: string) => mapWorkspaceImageGenerationOutputs({
    ok: true,
    mode: 't2i',
    jobId,
    images: [{ url: `https://cdn.example.com/${jobId}.png`, width: 1024, height: 1024 }],
  }, { ...outputContext(settings), submissionId: `submission-${jobId}` });
  const generationModule = await import('../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-generation');
  const merge = Reflect.get(generationModule, 'mergeWorkspaceGenerationOutputNodes');
  const first = createWorkspaceGenerationResults({
    shotNode: target,
    settings,
    capability: null,
    outputs: outputsFor('provider-position-a'),
    siblingCount: 0,
  });
  const second = createWorkspaceGenerationResults({
    shotNode: target,
    settings,
    capability: null,
    outputs: outputsFor('provider-position-b'),
    siblingCount: 1,
  });
  const initial = merge({ nodes: [target], shotNode: target, results: first, pendingNodeIds: [] }) as WorkspaceGraphNode[];
  const movedPosition = { x: 900, y: 700 };
  const moved = initial.map((node) => node.id === first[0]?.outputNode.id ? { ...node, position: movedPosition } : node);
  const appended = merge({ nodes: moved, shotNode: target, results: second, pendingNodeIds: [] }) as WorkspaceGraphNode[];
  const replayed = merge({ nodes: appended, shotNode: target, results: first, pendingNodeIds: [] }) as WorkspaceGraphNode[];
  const outputs = appended.filter((node) => node.data.output?.sourceShotId === target.id);

  assert.deepEqual(outputs.map((node) => node.id), [...outputs].map((node) => node.id).sort());
  assert.deepEqual(appended.find((node) => node.id === first[0]?.outputNode.id)?.position, movedPosition);
  assert.deepEqual(replayed.find((node) => node.id === first[0]?.outputNode.id)?.position, movedPosition);
  assert.equal(replayed.filter((node) => node.data.output?.sourceShotId === target.id).length, 2);
});

test('Project media persistence keeps complete collections beyond 120 assets', () => {
  const assets = Array.from({ length: 125 }, (_, index) => ({
    id: `asset-${index + 1}`,
    kind: 'image' as const,
    filename: `asset-${index + 1}.png`,
    subtitle: 'Image',
    url: `https://cdn.example.com/asset-${index + 1}.png`,
  }));
  const nextAsset = {
    id: 'asset-126',
    kind: 'image' as const,
    filename: 'asset-126.png',
    subtitle: 'Image',
    url: 'https://cdn.example.com/asset-126.png',
  };

  const expanded = upsertWorkspaceProjectAsset(assets, nextAsset);
  const replayed = upsertWorkspaceProjectAsset(expanded, nextAsset);

  assert.equal(expanded.length, 126);
  assert.equal(replayed.length, 126);
  assert.equal(new Set(replayed.map((asset) => asset.id)).size, 126);

  const generatedMediaSource = readFileSync(join(
    process.cwd(),
    'frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-generated-media.ts'
  ), 'utf8');
  const completedExportsSource = readFileSync(join(
    process.cwd(),
    'frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceCompletedExportAssets.ts'
  ), 'utf8');
  const projectMediaActionsSource = readFileSync(join(
    process.cwd(),
    'frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceProjectMediaActions.ts'
  ), 'utf8');
  assert.doesNotMatch(generatedMediaSource, /slice\(0,\s*120\)/);
  assert.doesNotMatch(completedExportsSource, /slice\(0,\s*120\)/);
  assert.doesNotMatch(projectMediaActionsSource, /slice\(0,\s*120\)/);
});

test('requested render settings never become measured Project media facts', () => {
  const output: WorkspaceOutputMetadata = {
    kind: 'video',
    modelId: 'video-model',
    modelLabel: 'Video Model',
    workflowType: 'text_to_video',
    requestedSettings: {
      durationSec: 10,
      aspectRatio: '9:16',
      resolution: '4k',
      fps: 30,
      outputCount: 1,
    },
    sourceMetadata: {
      measurementStatus: 'unknown',
      durationSec: null,
      width: null,
      height: null,
    },
    status: 'ready',
    createdAt: CREATED_AT,
    sourceShotId: 'shot-unknown',
    url: 'https://cdn.example.com/unmeasured.mp4',
  };
  const node: WorkspaceGraphNode = {
    id: 'output-unknown',
    type: 'output',
    position: { x: 0, y: 0 },
    data: { kind: 'output', title: 'Unmeasured output', output },
  };
  const asset = workspaceAssetFromOutputNode(node);

  assert.ok(asset);
  assert.equal(asset.durationSec, undefined);
  assert.equal(asset.dimensions, undefined);

  const [timelineItem] = buildWorkspaceTimelineItemsForOutput({
    outputNodeId: node.id,
    title: node.data.title,
    output,
    startSec: 0,
    idSeed: 'unknown-source',
  });
  assert.equal(timelineItem?.durationSec, 10);
  assert.equal(timelineItem?.sourceDurationSec, undefined);
  assert.equal(timelineItem?.sourceWidth, undefined);
  assert.equal(timelineItem?.sourceHeight, undefined);
});

test('persisted legacy requested values migrate without becoming measured metadata', () => {
  const legacySettings = {
    ...shot('generate-image'),
    durationSec: 10,
    aspectRatio: '9:16' as const,
    resolution: '4k' as const,
    fps: 30,
    outputCount: 2,
  };
  const legacyShot = shotNode(legacySettings);
  const legacyOutput: WorkspaceGraphNode = {
    id: 'legacy-output',
    type: 'output',
    position: { x: 500, y: 100 },
    data: {
      kind: 'output',
      title: 'Legacy output',
      output: {
        kind: 'video',
        modelId: legacySettings.modelId,
        modelLabel: 'Legacy model',
        workflowType: legacySettings.workflowType,
        durationSec: 10,
        aspectRatio: '9:16',
        resolution: '4k',
        outputIndex: 0,
        outputCount: 2,
        status: 'ready',
        createdAt: CREATED_AT,
        sourceShotId: legacyShot.id,
        url: 'https://cdn.example.com/legacy.mp4',
      },
    },
  };
  const persisted = {
    nodes: [legacyShot, legacyOutput],
    edges: [],
    timelineItems: [],
    activeTemplateId: 'blank',
  };
  const normalized = normalizePersistedWorkspaceState(persisted as never);
  assert.ok(normalized);
  const roundTripped = normalizePersistedWorkspaceState(JSON.parse(JSON.stringify(normalized)));
  assert.ok(roundTripped);
  const outputNode = roundTripped.nodes.find((node) => node.id === legacyOutput.id);
  const output = outputNode?.data.output;

  assert.deepEqual(output?.requestedSettings, {
    durationSec: 10,
    aspectRatio: '9:16',
    resolution: '4k',
    fps: 30,
    outputCount: 2,
  });
  assert.deepEqual(output?.sourceMetadata, {
    measurementStatus: 'unknown',
    durationSec: null,
    width: null,
    height: null,
  });
  assert.equal(output?.durationSec, undefined);
  assert.equal(output?.aspectRatio, undefined);
  assert.equal(output?.resolution, undefined);

  const asset = workspaceAssetFromOutputNode(outputNode!);
  assert.ok(asset);
  assert.equal(asset.durationSec, undefined);
  assert.equal(asset.dimensions, undefined);
  const [timelineItem] = buildWorkspaceTimelineItemsForOutput({
    outputNodeId: outputNode!.id,
    title: outputNode!.data.title,
    output: output!,
    startSec: 0,
    idSeed: 'legacy-migration',
  });
  assert.equal(timelineItem?.durationSec, 10);
  assert.equal(timelineItem?.sourceDurationSec, undefined);
  assert.equal(timelineItem?.sourceWidth, undefined);
  assert.equal(timelineItem?.sourceHeight, undefined);
});

test('Character Builder keeps style edges out of identity references', () => {
  const settings = shot('character-builder');
  const target = shotNode(settings);
  const assetNode = (id: string, url: string): WorkspaceGraphNode => ({
    id,
    type: 'asset-image',
    position: { x: 0, y: 0 },
    data: {
      kind: 'asset-image',
      title: id,
      asset: { id, kind: 'image', filename: `${id}.png`, subtitle: '', url },
    },
  });
  const identity = assetNode('identity', 'https://cdn.example.com/identity.png');
  const style = assetNode('style', 'https://cdn.example.com/style.png');
  const edge = (source: string, kind: 'reference' | 'style'): WorkspaceGraphEdge => ({
    id: `${source}-${kind}`,
    source,
    target: target.id,
    sourceHandle: kind,
    targetHandle: kind,
    data: { kind, label: kind, color: '#000000' },
  });
  const references = workspaceCharacterReferenceUrlsForGeneration({
    nodes: [target, identity, style],
    edges: [edge(identity.id, 'reference'), edge(style.id, 'style')],
    shotNode: target,
  });

  assert.deepEqual(references, {
    identityImageUrls: ['https://cdn.example.com/identity.png'],
    styleImageUrls: ['https://cdn.example.com/style.png'],
  });
});

test('generation actions materialize and register every returned output', () => {
  const source = readFileSync(join(
    process.cwd(),
    'frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceGenerationActions.ts'
  ), 'utf8');

  assert.match(source, /createPendingWorkspaceOutputs/);
  assert.match(source, /const results = await submitWorkspaceShotGeneration/);
  assert.match(source, /results\.map\(/);
  assert.match(source, /for \(const readyOutputNode of readyOutputNodes\)/);
  assert.match(source, /onGeneratedProjectAsset\(generatedAsset\)/);
});
