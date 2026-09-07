import { runGenerate } from '@/lib/api';
import type {
  WorkspaceEdgeKind,
  WorkspaceGraphEdge,
  WorkspaceGraphNode,
  WorkspaceGenerationMediaInput,
  WorkspaceModelCapability,
  WorkspaceOutputMetadata,
  WorkspaceShotSettings,
} from './workspace-types';
import {
  resolveWorkspaceGenerationIntent,
} from './models/model-input-connectors';
import { resolveWorkspaceGenerationFacts } from './workspace-generation-facts';
import { connectedInputKinds } from './workspace-graph-helpers';
import { outputSourceHandleForKind } from '../_state/workspace-normalizers';
import { WORKSPACE_EDGE_COLORS, createWorkspaceEdge } from './workspace-templates';
import {
  DEFAULT_STUDIO_COPY,
  type StudioCopy,
} from '../../_lib/studio-copy';
import {
  localizeWorkspacePromptText,
  localizeWorkspaceShotOutputName,
  workspaceOutputNodeTitleDataForShot,
} from './workspace-generated-copy';
import { WORKSPACE_DEMO_AUDIO_URL } from './workspace-library-assets';
import { resolveWorkspaceSelectedOutputCount } from './workspace-output-count';

type WorkspaceGenerationMode = 'real' | 'mock';
type WorkspaceShotGenerateRequest = Parameters<typeof runGenerate>[0] & {
  seed?: number;
  imageUrl?: string;
  referenceImages?: string[];
};

export type WorkspaceGenerationResult = {
  outputNode: WorkspaceGraphNode;
  outputEdge: WorkspaceGraphEdge;
  output: WorkspaceOutputMetadata;
};

function isShotNode(node: WorkspaceGraphNode): boolean {
  return node.data.kind === 'shot' && Boolean(node.data.shot);
}

function findSourceNodes(params: {
  nodes: WorkspaceGraphNode[];
  edges: WorkspaceGraphEdge[];
  shotNodeId: string;
  kind?: WorkspaceEdgeKind;
}): WorkspaceGraphNode[] {
  const edges = params.edges.filter((edge) => {
    if (edge.target !== params.shotNodeId) return false;
    if (!params.kind) return true;
    return edge.data?.kind === params.kind || edge.targetHandle === params.kind;
  });
  return edges
    .map((edge) => params.nodes.find((node) => node.id === edge.source))
    .filter((node): node is WorkspaceGraphNode => Boolean(node));
}

function textFromKinds(
  nodes: WorkspaceGraphNode[],
  edges: WorkspaceGraphEdge[],
  shotNodeId: string,
  kinds: WorkspaceEdgeKind[],
  canvasNodeCopy?: StudioCopy['canvas']['nodes']
): string[] {
  return kinds.flatMap((kind) =>
    findSourceNodes({ nodes, edges, shotNodeId, kind })
      .map((node) => {
        if (typeof node.data.promptText !== 'string') return '';
        const promptText = canvasNodeCopy
          ? localizeWorkspacePromptText(node, canvasNodeCopy) ?? node.data.promptText
          : node.data.promptText;
        return promptText.trim();
      })
      .filter(Boolean)
  );
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function mediaUrlFromConnectedNode(node: WorkspaceGraphNode, kind: WorkspaceEdgeKind): string | null {
  const assetUrl = stringOrNull(node.data.asset?.url);
  if (assetUrl) return assetUrl;

  const output = node.data.output;
  if (!output || output.status === 'placeholder' || output.status === 'processing' || output.status === 'failed') {
    return null;
  }

  const outputUrl = stringOrNull(output.url);
  const audioUrl = stringOrNull(output.audioUrl);
  const thumbUrl = stringOrNull(output.thumbUrl);
  if (kind === 'audio' || kind === 'music' || kind === 'voiceover' || kind === 'sfx' || kind === 'dialogue' || kind === 'narration') {
    return audioUrl ?? (output.kind === 'audio' ? outputUrl : null);
  }
  if (kind === 'video_reference' || kind === 'motion_reference' || kind === 'previous_shot' || kind === 'continuity') {
    return output.kind === 'video' ? outputUrl : null;
  }
  if (kind === 'start_image' || kind === 'end_image' || kind === 'product' || kind === 'reference' || kind === 'style' || kind === 'character' || kind === 'logo') {
    return output.kind === 'image' ? outputUrl ?? thumbUrl : thumbUrl;
  }
  return outputUrl ?? audioUrl ?? thumbUrl;
}

function generationMediaKindForEdge(kind: WorkspaceEdgeKind): WorkspaceGenerationMediaInput['kind'] | null {
  if (['audio', 'music', 'voiceover', 'sfx'].includes(kind)) return 'audio';
  if (['video_reference', 'motion_reference', 'previous_shot', 'continuity'].includes(kind)) return 'video';
  if (['start_image', 'end_image', 'product', 'reference', 'style', 'character', 'logo'].includes(kind)) return 'image';
  return null;
}

function dimensionsFromAsset(node: WorkspaceGraphNode): { width?: number; height?: number } {
  const asset = node.data.asset;
  if (asset?.width && asset.height) return { width: asset.width, height: asset.height };
  const match = asset?.dimensions?.match(/^(\d+)x(\d+)$/i);
  if (match) return { width: Number(match[1]), height: Number(match[2]) };
  const sourceMetadata = node.data.output?.sourceMetadata;
  return {
    width: sourceMetadata?.width ?? undefined,
    height: sourceMetadata?.height ?? undefined,
  };
}

export function workspaceGenerationMediaInputsFromGraph(params: {
  nodes: WorkspaceGraphNode[];
  edges: WorkspaceGraphEdge[];
  shotNodeId: string;
}): WorkspaceGenerationMediaInput[] {
  return params.edges.flatMap((edge) => {
    if (edge.target !== params.shotNodeId) return [];
    const semanticKind = (edge.targetHandle ?? edge.data?.kind) as WorkspaceEdgeKind | undefined;
    if (!semanticKind) return [];
    const kind = generationMediaKindForEdge(semanticKind);
    if (!kind) return [];
    const node = params.nodes.find((candidate) => candidate.id === edge.source);
    if (!node) return [];
    const url = mediaUrlFromConnectedNode(node, semanticKind);
    if (!url) return [];
    const dimensions = dimensionsFromAsset(node);
    const asset = node.data.asset;
    const output = node.data.output;
    return [{
      semanticKind,
      kind,
      url,
      name: asset?.filename ?? node.data.title,
      assetId: asset?.id ?? output?.providerOutputId ?? node.id,
      mimeType: asset?.mimeType,
      sizeBytes: asset?.sizeBytes,
      width: dimensions.width,
      height: dimensions.height,
      durationSec: asset?.durationSec ?? output?.sourceMetadata?.durationSec ?? undefined,
    }];
  });
}

export function mediaUrlsFromKinds(
  nodes: WorkspaceGraphNode[],
  edges: WorkspaceGraphEdge[],
  shotNodeId: string,
  kinds: WorkspaceEdgeKind[]
): string[] {
  return kinds.flatMap((kind) =>
    findSourceNodes({ nodes, edges, shotNodeId, kind })
      .map((node) => mediaUrlFromConnectedNode(node, kind))
      .filter((url): url is string => Boolean(url))
  );
}

function buildPrompt(
  nodes: WorkspaceGraphNode[],
  edges: WorkspaceGraphEdge[],
  shotNode: WorkspaceGraphNode,
  settings: WorkspaceShotSettings,
  canvasNodeCopy?: StudioCopy['canvas']['nodes']
): string {
  const promptParts = textFromKinds(nodes, edges, shotNode.id, ['prompt', 'style', 'camera', 'dialogue', 'narration'], canvasNodeCopy);
  if (promptParts.length) return promptParts.join('\n\n');
  const outputName = canvasNodeCopy ? localizeWorkspaceShotOutputName(shotNode, canvasNodeCopy) : settings.outputName;
  return `${outputName}. Premium AI video shot for a polished MaxVideoAI project.`;
}

export function prepareWorkspaceShotGenerationInputs(params: {
  nodes: WorkspaceGraphNode[];
  edges: WorkspaceGraphEdge[];
  shotNode: WorkspaceGraphNode;
  settings: WorkspaceShotSettings;
  canvasNodeCopy?: StudioCopy['canvas']['nodes'];
}): {
  outputName: string;
  prompt: string;
  settings: WorkspaceShotSettings;
} {
  const outputName = params.canvasNodeCopy
    ? localizeWorkspaceShotOutputName(params.shotNode, params.canvasNodeCopy)
    : params.settings.outputName;
  return {
    outputName,
    prompt: buildPrompt(params.nodes, params.edges, params.shotNode, params.settings, params.canvasNodeCopy),
    settings: outputName === params.settings.outputName
      ? params.settings
      : { ...params.settings, outputName },
  };
}

function createOutputPosition(shotNode: WorkspaceGraphNode, siblingCount: number) {
  return {
    x: shotNode.position.x + 390,
    y: shotNode.position.y + siblingCount * 36,
  };
}

function outputSubtitle(output: WorkspaceOutputMetadata, settings: WorkspaceShotSettings, notices: StudioCopy['notices']): string {
  if (output.status === 'processing') return notices.outputProcessingRender;
  if (output.status === 'placeholder') return notices.outputWaitingForMedia;
  if (output.status === 'failed') return notices.generationFailed;
  return `${output.requestedSettings?.durationSec ?? settings.durationSec}s · ${output.requestedSettings?.aspectRatio ?? settings.aspectRatio}`;
}

function outputKindForSettings(
  settings: WorkspaceShotSettings,
  capability: WorkspaceModelCapability | null
): WorkspaceOutputMetadata['kind'] {
  if (settings.outputKind === 'image' || settings.outputKind === 'audio' || settings.outputKind === 'video') {
    return settings.outputKind;
  }
  if (capability?.outputKind === 'image' || capability?.outputKind === 'audio' || capability?.outputKind === 'video') {
    return capability.outputKind;
  }
  return 'video';
}

function buildOutputNode(params: {
  id?: string;
  shotNode: WorkspaceGraphNode;
  settings: WorkspaceShotSettings;
  capability: WorkspaceModelCapability | null;
  output: WorkspaceOutputMetadata;
  siblingCount: number;
  notices?: StudioCopy['notices'];
}): WorkspaceGraphNode {
  const notices = params.notices ?? DEFAULT_STUDIO_COPY.notices;
  const titleData = workspaceOutputNodeTitleDataForShot(params.shotNode);
  return {
    id: params.id ?? `output-${params.shotNode.id}-${Date.now().toString(36)}`,
    type: 'output',
    position: createOutputPosition(params.shotNode, params.siblingCount),
    data: {
      kind: 'output',
      title: titleData.title || params.settings.outputName || notices.generatedOutputTitle,
      subtitle: outputSubtitle(params.output, params.settings, notices),
      accent: WORKSPACE_EDGE_COLORS.generated_output,
      generatedCopy: titleData.generatedCopy,
      output: params.output,
      targetHandles: ['generated_output'],
      sourceHandles: [outputSourceHandleForKind(params.output.kind)],
    },
  };
}

function stableGenerationIdentityHash(value: string): string {
  let left = 0x811c9dc5;
  let right = 0x9e3779b9;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    left = Math.imul(left ^ code, 0x01000193);
    right = Math.imul(right ^ code, 0x27d4eb2d);
  }
  return `${(left >>> 0).toString(16).padStart(8, '0')}${(right >>> 0).toString(16).padStart(8, '0')}`;
}

export function createWorkspaceGenerationSubmissionId(shotNodeId: string): string {
  const randomId = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${shotNodeId}:${randomId}`;
}

export function workspaceGenerationOutputNodeId(params: {
  output: WorkspaceOutputMetadata;
  submissionId?: string | null;
}): string {
  const providerOutputId = params.output.providerOutputId?.trim();
  const jobId = params.output.jobId?.trim();
  const submissionId = params.output.submissionId?.trim() || params.submissionId?.trim() || 'legacy';
  const outputIndex = params.output.outputIndex ?? 0;
  const identity = providerOutputId
    ? `provider:${providerOutputId}`
    : jobId
      ? `job:${jobId}:${params.output.kind}:${outputIndex}`
      : `submission:${submissionId}:${params.output.kind}:${outputIndex}`;
  return `output-${params.output.sourceShotId}-${stableGenerationIdentityHash(identity)}`;
}

function requestedSettingsForGeneration(
  settings: WorkspaceShotSettings,
  outputCount: number
): NonNullable<WorkspaceOutputMetadata['requestedSettings']> {
  return {
    durationSec: settings.durationSec,
    aspectRatio: settings.aspectRatio,
    resolution: settings.resolution,
    fps: settings.fps,
    outputCount,
  };
}

function unknownSourceMetadata(): NonNullable<WorkspaceOutputMetadata['sourceMetadata']> {
  return {
    measurementStatus: 'unknown',
    durationSec: null,
    width: null,
    height: null,
  };
}

export function createPendingWorkspaceOutput(params: {
  shotNode: WorkspaceGraphNode;
  settings: WorkspaceShotSettings;
  capability: WorkspaceModelCapability | null;
  nodes: WorkspaceGraphNode[];
  edges: WorkspaceGraphEdge[];
  siblingCount?: number;
  outputNodeId?: string;
  outputIndex?: number;
  outputCount?: number;
  attemptOrdinal?: number;
  submissionId?: string;
  notices?: StudioCopy['notices'];
}): WorkspaceGenerationResult {
  const resolvedWorkflowType = resolveWorkspaceGenerationIntent({
    settings: params.settings,
    capability: params.capability,
    connectedInputs: connectedInputKinds(params.shotNode.id, params.edges),
  }).workflowType;
  const outputKind = outputKindForSettings(params.settings, params.capability);
  const outputIndex = params.outputIndex ?? 0;
  const outputCount = params.outputCount ?? 1;
  const submissionId = params.submissionId ?? createWorkspaceGenerationSubmissionId(params.shotNode.id);
  const output: WorkspaceOutputMetadata = {
    kind: outputKind,
    modelId: params.settings.modelId,
    modelLabel: params.capability?.label ?? params.settings.modelId,
    workflowType: resolvedWorkflowType,
    requestedSettings: requestedSettingsForGeneration(params.settings, outputCount),
    sourceMetadata: unknownSourceMetadata(),
    submissionId,
    providerOutputId: null,
    attemptOrdinal: params.attemptOrdinal,
    outputIndex,
    outputCount,
    pricing: null,
    status: 'processing',
    createdAt: new Date().toISOString(),
    sourceShotId: params.shotNode.id,
    thumbUrl: null,
    url: null,
    audioUrl: null,
    hasAudio: outputKind === 'audio' ? true : outputKind === 'image' ? false : undefined,
    audioProvenance: outputKind === 'audio' ? 'external' : outputKind === 'image' ? 'none' : 'unknown',
    jobId: null,
  };
  const outputNode = buildOutputNode({
    id: params.outputNodeId ?? workspaceGenerationOutputNodeId({ output, submissionId }),
    shotNode: params.shotNode,
    settings: params.settings,
    capability: params.capability,
    output,
    siblingCount: params.siblingCount ?? 0,
    notices: params.notices,
  });

  return {
    output,
    outputNode,
    outputEdge: createWorkspaceEdge({
      source: params.shotNode.id,
      target: outputNode.id,
      sourceHandle: outputSourceHandleForKind(output.kind),
      targetHandle: 'generated_output',
      kind: 'generated_output',
    }),
  };
}

export function createPendingWorkspaceOutputs(params: {
  shotNode: WorkspaceGraphNode;
  settings: WorkspaceShotSettings;
  capability: WorkspaceModelCapability | null;
  nodes: WorkspaceGraphNode[];
  edges: WorkspaceGraphEdge[];
  siblingCount?: number;
  attemptOrdinal?: number;
  submissionId?: string;
  outputNodeIds?: Array<string | undefined>;
  notices?: StudioCopy['notices'];
}): WorkspaceGenerationResult[] {
  const outputCount = resolveWorkspaceSelectedOutputCount(
    params.settings,
    params.capability?.output_count
  );
  const submissionId = params.submissionId ?? createWorkspaceGenerationSubmissionId(params.shotNode.id);
  return Array.from({ length: outputCount }, (_, outputIndex) => createPendingWorkspaceOutput({
    ...params,
    siblingCount: (params.siblingCount ?? 0) + outputIndex,
    outputNodeId: params.outputNodeIds?.[outputIndex],
    outputIndex,
    outputCount,
    submissionId,
  }));
}

export function createMockWorkspaceOutput(params: {
  shotNode: WorkspaceGraphNode;
  settings: WorkspaceShotSettings;
  capability: WorkspaceModelCapability | null;
  nodes: WorkspaceGraphNode[];
  edges: WorkspaceGraphEdge[];
  siblingCount?: number;
  outputIndex?: number;
  outputCount?: number;
  submissionId?: string;
  outputNodeId?: string;
}): WorkspaceGenerationResult {
  const sourceImage =
    mediaUrlsFromKinds(params.nodes, params.edges, params.shotNode.id, ['start_image', 'product', 'reference', 'style', 'logo'])[0] ??
    '/assets/placeholders/thumb-16x9.png';
  const resolvedWorkflowType = resolveWorkspaceGenerationIntent({
    settings: params.settings,
    capability: params.capability,
    connectedInputs: connectedInputKinds(params.shotNode.id, params.edges),
  }).workflowType;
  const outputKind = outputKindForSettings(params.settings, params.capability);
  const outputIndex = params.outputIndex ?? 0;
  const outputCount = params.outputCount ?? 1;
  const submissionId = params.submissionId ?? createWorkspaceGenerationSubmissionId(params.shotNode.id);
  const outputUrl =
    outputKind === 'video'
      ? '/hero/veo3.mp4'
      : outputKind === 'audio'
        ? WORKSPACE_DEMO_AUDIO_URL
        : sourceImage;
  const output: WorkspaceOutputMetadata = {
    kind: outputKind,
    modelId: params.settings.modelId,
    modelLabel: params.capability?.label ?? params.settings.modelId,
    workflowType: resolvedWorkflowType,
    requestedSettings: requestedSettingsForGeneration(params.settings, outputCount),
    sourceMetadata: unknownSourceMetadata(),
    submissionId,
    providerOutputId: `mock-${submissionId}:${outputIndex + 1}`,
    outputIndex,
    outputCount,
    pricing: null,
    status: 'ready',
    createdAt: new Date().toISOString(),
    sourceShotId: params.shotNode.id,
    thumbUrl: outputKind === 'audio' ? null : sourceImage,
    url: outputUrl,
    audioUrl: outputKind === 'audio' ? outputUrl : null,
    hasAudio: outputKind === 'audio' ? true : outputKind === 'image' ? false : undefined,
    audioProvenance: outputKind === 'audio' ? 'external' : outputKind === 'image' ? 'none' : 'unknown',
    jobId: `mock-${submissionId}`,
  };
  const outputNode = buildOutputNode({
    id: params.outputNodeId ?? workspaceGenerationOutputNodeId({ output, submissionId }),
    shotNode: params.shotNode,
    settings: params.settings,
    capability: params.capability,
    output,
    siblingCount: params.siblingCount ?? 0,
  });

  return {
    output,
    outputNode,
    outputEdge: createWorkspaceEdge({
      source: params.shotNode.id,
      target: outputNode.id,
      sourceHandle: outputSourceHandleForKind(output.kind),
      targetHandle: 'generated_output',
      kind: 'generated_output',
    }),
  };
}

export function createMockWorkspaceOutputs(params: {
  shotNode: WorkspaceGraphNode;
  settings: WorkspaceShotSettings;
  capability: WorkspaceModelCapability | null;
  nodes: WorkspaceGraphNode[];
  edges: WorkspaceGraphEdge[];
  siblingCount?: number;
  submissionId?: string;
  outputNodeIds?: Array<string | undefined>;
}): WorkspaceGenerationResult[] {
  const outputCount = resolveWorkspaceSelectedOutputCount(
    params.settings,
    params.capability?.output_count
  );
  const submissionId = params.submissionId ?? createWorkspaceGenerationSubmissionId(params.shotNode.id);
  return Array.from({ length: outputCount }, (_, outputIndex) => createMockWorkspaceOutput({
    ...params,
    siblingCount: (params.siblingCount ?? 0) + outputIndex,
    outputNodeId: params.outputNodeIds?.[outputIndex],
    outputIndex,
    outputCount,
    submissionId,
  }));
}

export function createWorkspaceGenerationResults(params: {
  shotNode: WorkspaceGraphNode;
  settings: WorkspaceShotSettings;
  capability: WorkspaceModelCapability | null;
  outputs: WorkspaceOutputMetadata[];
  siblingCount: number;
  submissionId?: string;
  outputNodeIds?: Array<string | undefined>;
  notices?: StudioCopy['notices'];
}): WorkspaceGenerationResult[] {
  return params.outputs.map((output, outputIndex) => {
    const resolvedOutput = output.submissionId || !params.submissionId
      ? output
      : { ...output, submissionId: params.submissionId };
    const outputNode = buildOutputNode({
      id: params.outputNodeIds?.[outputIndex] ?? workspaceGenerationOutputNodeId({
        output: resolvedOutput,
        submissionId: params.submissionId,
      }),
      shotNode: params.shotNode,
      settings: params.settings,
      capability: params.capability,
      output: resolvedOutput,
      siblingCount: params.siblingCount + outputIndex,
      notices: params.notices,
    });
    return {
      output: resolvedOutput,
      outputNode,
      outputEdge: createWorkspaceEdge({
        source: params.shotNode.id,
        target: outputNode.id,
        sourceHandle: outputSourceHandleForKind(resolvedOutput.kind),
        targetHandle: 'generated_output',
        kind: 'generated_output',
      }),
    };
  });
}

function isOutputForShot(node: WorkspaceGraphNode, shotNodeId: string): boolean {
  return node.data.kind === 'output' && node.data.output?.sourceShotId === shotNodeId;
}

function shotStatusForOutputs(nodes: WorkspaceGraphNode[], shotNodeId: string): WorkspaceShotSettings['status'] | null {
  const outputs = nodes
    .filter((node) => isOutputForShot(node, shotNodeId))
    .map((node) => node.data.output)
    .filter((output): output is WorkspaceOutputMetadata => Boolean(output));
  if (!outputs.length) return null;
  if (outputs.some((output) => output.status === 'processing')) return 'generating';
  if (outputs.some((output) => output.status === 'ready' || (!output.status && Boolean(output.url)))) return 'completed';
  if (outputs.every((output) => output.status === 'failed')) return 'failed';
  return 'generating';
}

export function mergeWorkspaceGenerationOutputNodes(params: {
  nodes: WorkspaceGraphNode[];
  shotNode: WorkspaceGraphNode;
  results: WorkspaceGenerationResult[];
  pendingNodeIds: readonly string[];
}): WorkspaceGraphNode[] {
  const shotNodeId = params.shotNode.id;
  const pendingNodeIds = new Set(params.pendingNodeIds);
  const incomingNodeIds = new Set(params.results.map((result) => result.outputNode.id));
  const incomingProviderOutputIds = new Set(params.results.flatMap((result) => {
    const providerOutputId = result.output.providerOutputId?.trim();
    return providerOutputId ? [providerOutputId] : [];
  }));
  const firstShotOutputIndex = params.nodes.findIndex((node) => isOutputForShot(node, shotNodeId));
  const baseNodes = params.nodes.filter((node) => {
    if (pendingNodeIds.has(node.id)) return false;
    if (!isOutputForShot(node, shotNodeId)) return true;
    const providerOutputId = node.data.output?.providerOutputId?.trim();
    return !providerOutputId
      || !incomingProviderOutputIds.has(providerOutputId)
      || incomingNodeIds.has(node.id);
  });
  const manuallyPositionedOutputs = new Map(
    baseNodes
      .filter((node) => isOutputForShot(node, shotNodeId))
      .sort((left, right) => left.id.localeCompare(right.id))
      .flatMap((node, index) => {
        const automaticPosition = createOutputPosition(params.shotNode, index);
        return node.position.x === automaticPosition.x && node.position.y === automaticPosition.y
          ? []
          : [[node.id, node.position] as const];
      })
  );
  const nodesById = new Map(baseNodes.map((node) => [node.id, node]));
  for (const result of params.results) {
    const previous = nodesById.get(result.outputNode.id);
    const projectMediaFolderId = result.outputNode.data.output?.projectMediaFolderId
      ?? previous?.data.output?.projectMediaFolderId
      ?? null;
    nodesById.set(result.outputNode.id, {
      ...result.outputNode,
      data: {
        ...result.outputNode.data,
        output: result.outputNode.data.output
          ? { ...result.outputNode.data.output, projectMediaFolderId }
          : result.outputNode.data.output,
      },
    });
  }

  const allNodes = Array.from(nodesById.values());
  const shotOutputs = allNodes
    .filter((node) => isOutputForShot(node, shotNodeId))
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((node, index) => ({
      ...node,
      position: manuallyPositionedOutputs.get(node.id) ?? createOutputPosition(params.shotNode, index),
    }));
  const otherNodes = allNodes.filter((node) => !isOutputForShot(node, shotNodeId));
  const insertIndex = firstShotOutputIndex < 0
    ? otherNodes.length
    : Math.min(
        otherNodes.length,
        params.nodes.slice(0, firstShotOutputIndex).filter((node) => (
          !isOutputForShot(node, shotNodeId) && !pendingNodeIds.has(node.id)
        )).length
      );
  const merged = [
    ...otherNodes.slice(0, insertIndex),
    ...shotOutputs,
    ...otherNodes.slice(insertIndex),
  ];
  const shotStatus = shotStatusForOutputs(merged, shotNodeId);
  if (!shotStatus) return merged;
  return merged.map((node) => node.id === shotNodeId && node.data.shot
    ? {
        ...node,
        data: {
          ...node.data,
          shot: { ...node.data.shot, status: shotStatus },
        },
      }
    : node);
}

export function buildWorkspaceShotGenerateRequest(params: {
  settings: WorkspaceShotSettings;
  capability: WorkspaceModelCapability | null;
  prompt: string;
  connectedInputs: readonly WorkspaceEdgeKind[];
  referenceImages: string[];
  startImageUrl?: string;
  endImageUrl?: string;
  videoReferences: string[];
  audioReferences: string[];
  mediaInputs?: WorkspaceGenerationMediaInput[];
  shotNodeId: string;
  outputName: string;
  submissionId?: string;
}): WorkspaceShotGenerateRequest {
  const facts = resolveWorkspaceGenerationFacts({
    settings: params.settings,
    connectedInputs: params.connectedInputs,
    capability: params.capability,
    mediaInputs: params.mediaInputs,
  });
  if (!facts.canRoute) {
    throw new Error(`Selected model is not compatible with the ${facts.workflowType} workflow.`);
  }
  if (facts.issues.length) {
    throw new Error(facts.issues.map((issue) => issue.message).join(' '));
  }
  const activeConnectors = facts.activeConnectors;
  const supportsAny = (kinds: WorkspaceEdgeKind[]) => activeConnectors.some((connector) => kinds.includes(connector.kind));
  const referenceImages = supportsAny(['start_image', 'end_image', 'reference', 'product', 'character', 'logo'])
    ? params.referenceImages
    : [];
  const videoReferences = supportsAny(['video_reference']) ? params.videoReferences : [];
  const audioReferences = supportsAny(['audio']) ? params.audioReferences : [];
  const primaryImageUrl = supportsAny(['start_image'])
    ? params.startImageUrl ?? referenceImages[0]
    : referenceImages[0];
  const primaryAudioUrl = audioReferences[0];
  const exactMediaInputs = facts.assignments.map((input) => {
    const name = input.name ?? input.url.split('/').pop()?.split('?')[0] ?? `${input.semanticKind}-${input.kind}`;
    return {
      name,
      type: input.mimeType ?? `${input.kind}/*`,
      size: input.sizeBytes ?? 0,
      kind: input.kind,
      slotId: input.fieldId,
      label: input.label,
      url: input.url,
      width: input.width,
      height: input.height,
      durationSec: input.durationSec,
      assetId: input.assetId,
    };
  });
  const fallbackMediaInputs = exactMediaInputs.length
    ? []
    : [
        ...videoReferences.map((url, index) => {
          const connector = activeConnectors.find((candidate) => candidate.kind === 'video_reference');
          return {
            name: `video-reference-${index + 1}`,
            type: 'video/*',
            size: 0,
            kind: 'video' as const,
            slotId: connector?.fieldId,
            label: connector?.label,
            url,
          };
        }),
        ...audioReferences.map((url, index) => {
          const connector = activeConnectors.find((candidate) => candidate.kind === 'audio');
          return {
            name: `audio-reference-${index + 1}`,
            type: 'audio/*',
            size: 0,
            kind: 'audio' as const,
            slotId: connector?.fieldId,
            label: connector?.label,
            url,
          };
        }),
      ];
  const requestMediaInputs = exactMediaInputs.length ? exactMediaInputs : fallbackMediaInputs;
  const request: WorkspaceShotGenerateRequest = {
    engineId: params.settings.modelId,
    prompt: params.prompt,
    mode: facts.mode,
    durationSec: facts.durationSec,
    durationOption: params.settings.durationSec,
    aspectRatio: params.settings.aspectRatio,
    resolution: params.settings.resolution,
    fps: params.settings.fps,
    payment: { mode: 'wallet' },
    idempotencyKey: `editor-${params.submissionId ?? `${params.shotNodeId}-${Date.now().toString(36)}`}`,
    localKey: `editor-${params.shotNodeId}`,
    message: params.outputName,
    visibility: 'private',
    indexable: false,
    ...(typeof params.settings.seed === 'number' ? { seed: params.settings.seed } : {}),
    ...(typeof facts.audio === 'boolean' ? { audio: facts.audio } : {}),
    ...(primaryImageUrl ? { imageUrl: primaryImageUrl, referenceImages } : {}),
    ...((facts.mode === 'fl2v' || facts.mode === 'i2v') && params.endImageUrl ? { endImageUrl: params.endImageUrl } : {}),
    ...(primaryAudioUrl ? { audioUrl: primaryAudioUrl } : {}),
    ...(requestMediaInputs.length ? { inputs: requestMediaInputs } : {}),
  };
  return request;
}

export async function submitWorkspaceShotGeneration(params: {
  nodes: WorkspaceGraphNode[];
  edges: WorkspaceGraphEdge[];
  shotNodeId: string;
  capability: WorkspaceModelCapability | null;
  generationMode: WorkspaceGenerationMode;
  submissionId?: string;
  canvasNodeCopy?: StudioCopy['canvas']['nodes'];
}): Promise<WorkspaceGenerationResult[]> {
  const shotNode = params.nodes.find((node) => node.id === params.shotNodeId);
  if (!shotNode || !isShotNode(shotNode)) {
    throw new Error('Shot node not found');
  }
  const settings = shotNode.data.shot as WorkspaceShotSettings;
  const siblingCount = params.nodes.filter((node) => node.data.output?.sourceShotId === shotNode.id).length;
  const submissionId = params.submissionId ?? createWorkspaceGenerationSubmissionId(shotNode.id);

  const generationInputs = prepareWorkspaceShotGenerationInputs({
    nodes: params.nodes,
    edges: params.edges,
    shotNode,
    settings,
    canvasNodeCopy: params.canvasNodeCopy,
  });

  if (params.generationMode === 'mock') {
    return createMockWorkspaceOutputs({
      shotNode,
      settings: generationInputs.settings,
      capability: params.capability,
      nodes: params.nodes,
      edges: params.edges,
      siblingCount,
      submissionId,
    });
  }

  const connectedInputs = connectedInputKinds(shotNode.id, params.edges);
  const resolvedWorkflowType = resolveWorkspaceGenerationIntent({
    settings: generationInputs.settings,
    capability: params.capability,
    connectedInputs,
  }).workflowType;
  try {
    const { submitWorkspaceGenerationByFamily } = await import('./workspace-generation-routing');
    const outputs = await submitWorkspaceGenerationByFamily({
      nodes: params.nodes,
      edges: params.edges,
      shotNode,
      settings: generationInputs.settings,
      capability: params.capability,
      prompt: generationInputs.prompt,
      outputName: generationInputs.outputName,
      connectedInputs,
      resolvedWorkflowType,
      submissionId,
    });
    return createWorkspaceGenerationResults({
      shotNode,
      settings: generationInputs.settings,
      capability: params.capability,
      outputs,
      siblingCount,
      submissionId,
    });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      return createMockWorkspaceOutputs({
        shotNode,
        settings: generationInputs.settings,
        capability: params.capability,
        nodes: params.nodes,
        edges: params.edges,
        siblingCount,
        submissionId,
      });
    }
    throw error;
  }
}
