import { runGenerate } from '@/lib/api';
import type {
  WorkspaceEdgeKind,
  WorkspaceGraphEdge,
  WorkspaceGraphNode,
  WorkspaceModelCapability,
  WorkspaceOutputMetadata,
  WorkspaceShotSettings,
} from './workspace-types';
import {
  workspaceAudioEnabledForRequest,
} from './workspace-capabilities';
import { resolveWorkspaceGenerationIntent } from './models/model-input-connectors';
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

function connectedInputKinds(edges: WorkspaceGraphEdge[], shotNodeId: string): WorkspaceEdgeKind[] {
  return edges
    .filter((edge) => edge.target === shotNodeId)
    .map((edge) => edge.data?.kind ?? edge.targetHandle ?? 'reference')
    .filter((kind): kind is WorkspaceEdgeKind => typeof kind === 'string');
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
  return `${output.durationSec ?? settings.durationSec}s · ${output.aspectRatio ?? settings.aspectRatio}`;
}

function outputIncludesAudio(settings: WorkspaceShotSettings, capability: WorkspaceModelCapability | null): boolean {
  if (settings.outputKind === 'audio') return true;
  const audioOption = capability?.render_options.find((option) => option.id === 'audio');
  if (audioOption?.control === 'included') return true;
  if (audioOption?.control === 'toggle') return settings.audioEnabled;
  return false;
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

export function createPendingWorkspaceOutput(params: {
  shotNode: WorkspaceGraphNode;
  settings: WorkspaceShotSettings;
  capability: WorkspaceModelCapability | null;
  nodes: WorkspaceGraphNode[];
  edges: WorkspaceGraphEdge[];
  siblingCount?: number;
  outputNodeId?: string;
  notices?: StudioCopy['notices'];
}): WorkspaceGenerationResult {
  const resolvedWorkflowType = resolveWorkspaceGenerationIntent({
    settings: params.settings,
    capability: params.capability,
    connectedInputs: connectedInputKinds(params.edges, params.shotNode.id),
  }).workflowType;
  const outputKind = outputKindForSettings(params.settings, params.capability);
  const output: WorkspaceOutputMetadata = {
    kind: outputKind,
    modelId: params.settings.modelId,
    modelLabel: params.capability?.label ?? params.settings.modelId,
    workflowType: resolvedWorkflowType,
    durationSec: params.settings.durationSec,
    aspectRatio: params.settings.aspectRatio,
    resolution: params.settings.resolution,
    pricing: null,
    status: 'processing',
    createdAt: new Date().toISOString(),
    sourceShotId: params.shotNode.id,
    thumbUrl: null,
    url: null,
    audioUrl: null,
    hasAudio: outputKind === 'audio' || outputIncludesAudio(params.settings, params.capability),
    jobId: null,
  };
  const outputNode = buildOutputNode({
    id: params.outputNodeId,
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

export function createMockWorkspaceOutput(params: {
  shotNode: WorkspaceGraphNode;
  settings: WorkspaceShotSettings;
  capability: WorkspaceModelCapability | null;
  nodes: WorkspaceGraphNode[];
  edges: WorkspaceGraphEdge[];
  siblingCount?: number;
}): WorkspaceGenerationResult {
  const sourceImage =
    mediaUrlsFromKinds(params.nodes, params.edges, params.shotNode.id, ['start_image', 'product', 'reference', 'style', 'logo'])[0] ??
    '/assets/placeholders/thumb-16x9.png';
  const resolvedWorkflowType = resolveWorkspaceGenerationIntent({
    settings: params.settings,
    capability: params.capability,
    connectedInputs: connectedInputKinds(params.edges, params.shotNode.id),
  }).workflowType;
  const outputKind = outputKindForSettings(params.settings, params.capability);
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
    durationSec: params.settings.durationSec,
    aspectRatio: params.settings.aspectRatio,
    resolution: params.settings.resolution,
    pricing: null,
    status: 'ready',
    createdAt: new Date().toISOString(),
    sourceShotId: params.shotNode.id,
    thumbUrl: outputKind === 'audio' ? null : sourceImage,
    url: outputUrl,
    audioUrl: outputKind === 'audio' ? outputUrl : null,
    hasAudio: outputKind === 'audio' || outputIncludesAudio(params.settings, params.capability),
    jobId: `mock-${Date.now().toString(36)}`,
  };
  const outputNode = buildOutputNode({
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

export function buildWorkspaceShotGenerateRequest(params: {
  settings: WorkspaceShotSettings;
  capability: WorkspaceModelCapability | null;
  prompt: string;
  connectedInputs: readonly WorkspaceEdgeKind[];
  referenceImages: string[];
  videoReferences: string[];
  audioReferences: string[];
  shotNodeId: string;
  outputName: string;
}): WorkspaceShotGenerateRequest {
  const primaryImageUrl = params.referenceImages[0];
  const primaryAudioUrl = params.audioReferences[0];
  const audioEnabled = workspaceAudioEnabledForRequest(params.settings, params.capability);
  const intent = resolveWorkspaceGenerationIntent({
    settings: params.settings,
    connectedInputs: params.connectedInputs,
    capability: params.capability,
  });
  if (!intent.canRoute) {
    throw new Error(`Selected model is not compatible with the ${intent.workflowType} workflow.`);
  }
  const request: WorkspaceShotGenerateRequest = {
    engineId: params.settings.modelId,
    prompt: params.prompt,
    mode: intent.generationMode,
    durationSec: params.settings.durationSec,
    durationOption: params.settings.durationSec,
    aspectRatio: params.settings.aspectRatio,
    resolution: params.settings.resolution,
    fps: params.settings.fps,
    payment: { mode: 'wallet' },
    idempotencyKey: `editor-${params.shotNodeId}-${Date.now().toString(36)}`,
    localKey: `editor-${params.shotNodeId}`,
    message: params.outputName,
    visibility: 'private',
    indexable: false,
    ...(typeof params.settings.seed === 'number' ? { seed: params.settings.seed } : {}),
    ...(typeof audioEnabled === 'boolean' ? { audio: audioEnabled } : {}),
    ...(primaryImageUrl ? { imageUrl: primaryImageUrl, referenceImages: params.referenceImages } : {}),
    ...(primaryAudioUrl ? { audioUrl: primaryAudioUrl } : {}),
    ...(params.videoReferences.length || params.audioReferences.length
      ? {
          inputs: [
            ...params.videoReferences.map((url, index) => ({
              name: `video-reference-${index + 1}`,
              type: 'video/*',
              size: 0,
              kind: 'video' as const,
              url,
            })),
            ...params.audioReferences.map((url, index) => ({
              name: `audio-reference-${index + 1}`,
              type: 'audio/*',
              size: 0,
              kind: 'audio' as const,
              url,
            })),
          ],
        }
      : {}),
  };
  return request;
}

export async function submitWorkspaceShotGeneration(params: {
  nodes: WorkspaceGraphNode[];
  edges: WorkspaceGraphEdge[];
  shotNodeId: string;
  capability: WorkspaceModelCapability | null;
  generationMode: WorkspaceGenerationMode;
  canvasNodeCopy?: StudioCopy['canvas']['nodes'];
}): Promise<WorkspaceGenerationResult> {
  const shotNode = params.nodes.find((node) => node.id === params.shotNodeId);
  if (!shotNode || !isShotNode(shotNode)) {
    throw new Error('Shot node not found');
  }
  const settings = shotNode.data.shot as WorkspaceShotSettings;
  const siblingCount = params.nodes.filter((node) => node.data.output?.sourceShotId === shotNode.id).length;

  const generationInputs = prepareWorkspaceShotGenerationInputs({
    nodes: params.nodes,
    edges: params.edges,
    shotNode,
    settings,
    canvasNodeCopy: params.canvasNodeCopy,
  });

  if (params.generationMode === 'mock') {
    return createMockWorkspaceOutput({
      shotNode,
      settings: generationInputs.settings,
      capability: params.capability,
      nodes: params.nodes,
      edges: params.edges,
      siblingCount,
    });
  }

  const connectedInputs = connectedInputKinds(params.edges, shotNode.id);
  const resolvedWorkflowType = resolveWorkspaceGenerationIntent({
    settings: generationInputs.settings,
    capability: params.capability,
    connectedInputs,
  }).workflowType;
  try {
    const { submitWorkspaceGenerationByFamily } = await import('./workspace-generation-routing');
    const output = await submitWorkspaceGenerationByFamily({
      nodes: params.nodes,
      edges: params.edges,
      shotNode,
      settings: generationInputs.settings,
      capability: params.capability,
      prompt: generationInputs.prompt,
      outputName: generationInputs.outputName,
      connectedInputs,
      resolvedWorkflowType,
    });
    const outputNode = buildOutputNode({
      shotNode,
      settings: generationInputs.settings,
      capability: params.capability,
      output,
      siblingCount,
    });

    return {
      output,
      outputNode,
      outputEdge: createWorkspaceEdge({
        source: shotNode.id,
        target: outputNode.id,
        sourceHandle: outputSourceHandleForKind(output.kind),
        targetHandle: 'generated_output',
        kind: 'generated_output',
      }),
    };
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      return createMockWorkspaceOutput({
        shotNode,
        settings: generationInputs.settings,
        capability: params.capability,
        nodes: params.nodes,
        edges: params.edges,
        siblingCount,
      });
    }
    throw error;
  }
}
