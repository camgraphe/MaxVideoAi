import {
  WORKSPACE_DEMO_AUDIO_URL,
} from '../_lib/workspace-library-assets';
import { resolveStudioChatModel } from '@/lib/studio-chat-models';
import { DEFAULT_STUDIO_COPY } from '../../_lib/studio-copy';
import {
  workspaceMediaDimensionsForTimelineSource,
} from '../_lib/workspace-clip-composition';
import {
  isWorkspaceTimelineAudioTrack,
  normalizeWorkspaceTimelineTrack,
} from '../_lib/workspace-timeline-tracks';
import type {
  WorkspaceChatMode,
  WorkspaceChatMessage,
  WorkspaceChatProvider,
  WorkspaceChatSettings,
  WorkspaceEdgeKind,
  WorkspaceGraphEdge,
  WorkspaceGraphNode,
  WorkspaceNodeKind,
  WorkspaceOutputMetadata,
  WorkspaceShotSettings,
  WorkspaceTimelineItem,
  WorkspaceWorkflowType,
} from '../_lib/workspace-types';
import { normalizeWorkspaceShotToolSettings } from '../_lib/workspace-tool-settings';
import { STALE_EMPTY_DEMO_AUDIO_URL } from './workspace-state';

export const OUTPUT_ONLY_SOURCE_HANDLES: Partial<Record<WorkspaceNodeKind, WorkspaceEdgeKind>> = {
  'asset-image': 'reference',
  'asset-video': 'video_reference',
  'asset-audio': 'audio',
  'text-prompt': 'prompt',
};

export const GENERATED_OUTPUT_TARGET_HANDLE: WorkspaceEdgeKind = 'generated_output';
export const GENERATED_OUTPUT_SOURCE_HANDLE: WorkspaceEdgeKind = 'video_reference';
export const WORKSPACE_EDGE_TYPE = 'workspace-smart';

export function isPlayableVideoUrl(url?: string | null): boolean {
  if (!url) return false;
  if (url.startsWith('blob:') || url.startsWith('data:video/')) return true;
  return /\.(mp4|webm|mov|m4v)(?:[?#].*)?$/i.test(url);
}

export function isPlayableAudioUrl(url?: string | null): boolean {
  if (!url) return false;
  if (url.startsWith('blob:') || url.startsWith('data:audio/')) return true;
  return /\.(mp3|wav|ogg|m4a|aac|mp4|webm|mov|m4v)(?:[?#].*)?$/i.test(url);
}

export function isPlayableImageUrl(url?: string | null): boolean {
  if (!url) return false;
  if (url.startsWith('blob:') || url.startsWith('data:image/')) return true;
  return /\.(png|jpe?g|webp|gif|avif)(?:[?#].*)?$/i.test(url);
}

export function playableOutputTimelineUrl(output: WorkspaceOutputMetadata): string | null {
  if (output.kind === 'audio') {
    const audioUrl = output.audioUrl ?? output.url ?? null;
    return isPlayableAudioUrl(audioUrl) ? audioUrl : null;
  }
  if (output.kind === 'image') {
    const imageUrl = output.url ?? output.thumbUrl ?? null;
    return isPlayableImageUrl(imageUrl) ? imageUrl : null;
  }
  return isPlayableVideoUrl(output.url) ? output.url ?? null : null;
}

function normalizePlayableAudioUrl(url?: string | null): string | null {
  if (url === STALE_EMPTY_DEMO_AUDIO_URL) return WORKSPACE_DEMO_AUDIO_URL;
  return isPlayableAudioUrl(url) ? url ?? null : null;
}

function outputOnlySourceHandle(node: WorkspaceGraphNode): WorkspaceEdgeKind | null {
  return OUTPUT_ONLY_SOURCE_HANDLES[node.data.kind] ?? null;
}

export function generatedOutputSourceHandle(output?: WorkspaceOutputMetadata | null): WorkspaceEdgeKind {
  return outputSourceHandleForKind(output?.kind);
}

export function outputSourceHandleForKind(kind?: WorkspaceOutputMetadata['kind'] | WorkspaceShotSettings['outputKind'] | null): WorkspaceEdgeKind {
  if (kind === 'image') return 'reference';
  if (kind === 'audio') return 'audio';
  return GENERATED_OUTPUT_SOURCE_HANDLE;
}

export function shotOutputSourceHandle(shot?: Pick<WorkspaceShotSettings, 'outputKind' | 'workflowType'> | null): WorkspaceEdgeKind {
  return outputSourceHandleForKind(shot?.outputKind ?? (shot?.workflowType ? outputKindForWorkflow(shot.workflowType) : null));
}

export function normalizeOutputOnlySourceNodes(nodes: WorkspaceGraphNode[]): WorkspaceGraphNode[] {
  return nodes.map((node) => {
    const sourceHandle = outputOnlySourceHandle(node);
    if (!sourceHandle) return node;
    if (node.data.sourceHandles?.length === 1 && node.data.sourceHandles[0] === sourceHandle && !node.data.targetHandles?.length) {
      return node;
    }
    return {
      ...node,
      data: {
        ...node.data,
        targetHandles: [],
        sourceHandles: [sourceHandle],
      },
    };
  });
}

export function normalizeOutputOnlySourceEdges(nodes: WorkspaceGraphNode[], edges: WorkspaceGraphEdge[]): WorkspaceGraphEdge[] {
  const sourceHandleByNodeId = new Map(
    nodes
      .map((node): [string, WorkspaceEdgeKind] | null => {
        const sourceHandle = outputOnlySourceHandle(node);
        return sourceHandle ? [node.id, sourceHandle] : null;
      })
      .filter((entry): entry is [string, WorkspaceEdgeKind] => Boolean(entry))
  );

  return edges.map((edge) => {
    const sourceHandle = sourceHandleByNodeId.get(edge.source);
    if (!sourceHandle || edge.sourceHandle === sourceHandle) return edge;
    return {
      ...edge,
      sourceHandle,
    };
  });
}

export function normalizeGeneratedOutputNodes(nodes: WorkspaceGraphNode[]): WorkspaceGraphNode[] {
  return nodes.map((node) => {
    if (node.data.kind !== 'output') return node;
    const sourceHandle = generatedOutputSourceHandle(node.data.output);
    if (
      node.data.targetHandles?.length === 1 &&
      node.data.targetHandles[0] === GENERATED_OUTPUT_TARGET_HANDLE &&
      node.data.sourceHandles?.length === 1 &&
      node.data.sourceHandles[0] === sourceHandle
    ) {
      return node;
    }
    return {
      ...node,
      data: {
        ...node.data,
        targetHandles: [GENERATED_OUTPUT_TARGET_HANDLE],
        sourceHandles: [sourceHandle],
      },
    };
  });
}

export function normalizeGeneratedOutputEdges(nodes: WorkspaceGraphNode[], edges: WorkspaceGraphEdge[]): WorkspaceGraphEdge[] {
  const outputSourceHandleByNodeId = new Map(
    nodes
      .filter((node) => node.data.kind === 'output')
      .map((node): [string, WorkspaceEdgeKind] => [node.id, generatedOutputSourceHandle(node.data.output)])
  );
  const outputNodeIds = new Set(outputSourceHandleByNodeId.keys());
  return edges.map((edge) => {
    const nextEdge = { ...edge };
    if (outputNodeIds.has(edge.target) && edge.data?.kind === GENERATED_OUTPUT_TARGET_HANDLE) {
      nextEdge.targetHandle = GENERATED_OUTPUT_TARGET_HANDLE;
    }
    const sourceHandle = outputSourceHandleByNodeId.get(edge.source);
    if (sourceHandle) {
      nextEdge.sourceHandle = sourceHandle;
    }
    return nextEdge;
  });
}

export function normalizePlaceholderOutputNodes(nodes: WorkspaceGraphNode[]): WorkspaceGraphNode[] {
  return nodes.map((node) => {
    const output = node.data.output;
    if (node.data.kind !== 'output' || !output || output.status || output.kind !== 'video' || isPlayableVideoUrl(output.url)) {
      return node;
    }
    return {
      ...node,
      data: {
        ...node.data,
        subtitle: DEFAULT_STUDIO_COPY.notices.outputWaitingForMedia,
        output: {
          ...output,
          status: 'placeholder',
          thumbUrl: null,
          url: null,
        },
      },
    };
  });
}

export function normalizeShotOutputNodes(nodes: WorkspaceGraphNode[]): WorkspaceGraphNode[] {
  return nodes.map((node) => {
    if (node.data.kind !== 'shot') return node;
    const sourceHandle = shotOutputSourceHandle(node.data.shot);
    if (node.data.sourceHandles?.length === 1 && node.data.sourceHandles[0] === sourceHandle) {
      return node;
    }
    return {
      ...node,
      data: {
        ...node.data,
        sourceHandles: [sourceHandle],
      },
    };
  });
}

export function normalizeShotOutputEdges(nodes: WorkspaceGraphNode[], edges: WorkspaceGraphEdge[]): WorkspaceGraphEdge[] {
  const sourceHandleByShotNodeId = new Map(
    nodes
      .filter((node) => node.data.kind === 'shot')
      .map((node): [string, WorkspaceEdgeKind] => [node.id, shotOutputSourceHandle(node.data.shot)])
  );
  return edges.map((edge) => {
    const sourceHandle = sourceHandleByShotNodeId.get(edge.source);
    if (!sourceHandle || edge.sourceHandle === sourceHandle) return edge;
    return {
      ...edge,
      sourceHandle,
    };
  });
}

function familyForWorkflow(workflowType: WorkspaceWorkflowType): WorkspaceShotSettings['family'] {
  if (
    workflowType === 'text_to_image' ||
    workflowType === 'image_to_image' ||
    workflowType === 'character_builder' ||
    workflowType === 'storyboard_generation' ||
    workflowType === 'angle_generation'
  ) return 'image';
  if (workflowType === 'image_upscale' || workflowType === 'video_upscale') return 'upscale';
  if (
    workflowType === 'music_generation' ||
    workflowType === 'voiceover_generation' ||
    workflowType === 'sfx_generation' ||
    workflowType === 'cinematic_audio' ||
    workflowType === 'cinematic_voiceover'
  ) return 'audio';
  if (workflowType === 'chat_completion') return 'chat';
  return 'video';
}

function outputKindForWorkflow(workflowType: WorkspaceWorkflowType): WorkspaceShotSettings['outputKind'] {
  if (
    workflowType === 'text_to_image' ||
    workflowType === 'image_to_image' ||
    workflowType === 'image_upscale' ||
    workflowType === 'character_builder' ||
    workflowType === 'storyboard_generation' ||
    workflowType === 'angle_generation'
  ) return 'image';
  if (
    workflowType === 'music_generation' ||
    workflowType === 'voiceover_generation' ||
    workflowType === 'sfx_generation' ||
    workflowType === 'cinematic_audio' ||
    workflowType === 'cinematic_voiceover'
  ) return 'audio';
  return 'video';
}

export function normalizeWorkspaceGenerationNode(node: WorkspaceGraphNode): WorkspaceGraphNode {
  if (node.data.kind !== 'shot' || !node.data.shot) return node;
  const shot = node.data.shot;
  const normalizedShot: WorkspaceShotSettings = {
    ...shot,
    family: shot.family ?? familyForWorkflow(shot.workflowType),
    outputKind: shot.outputKind ?? outputKindForWorkflow(shot.workflowType),
  };
  const normalizedToolShot = normalizeWorkspaceShotToolSettings(normalizedShot);
  if (shot.family && shot.outputKind && normalizedToolShot === shot) return node;
  return {
    ...node,
    data: {
      ...node.data,
      shot: normalizedToolShot,
    },
  };
}

function normalizeChatProvider(value: unknown): WorkspaceChatProvider {
  return value === 'gemini' ? 'gemini' : 'openai';
}

function normalizeChatMode(value: unknown): WorkspaceChatMode {
  return value === 'chatbot' ? 'chatbot' : 'assistant';
}

function normalizeChatMessage(value: unknown, index: number): WorkspaceChatMessage | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Partial<WorkspaceChatMessage>;
  if (record.role !== 'system' && record.role !== 'user' && record.role !== 'assistant') return null;
  if (typeof record.content !== 'string' || !record.content.trim()) return null;
  return {
    id: typeof record.id === 'string' && record.id.trim() ? record.id : `chat-message-${index + 1}`,
    role: record.role,
    content: record.content,
    createdAt: typeof record.createdAt === 'string' && record.createdAt.trim() ? record.createdAt : new Date().toISOString(),
  };
}

export function normalizeChatSettings(value: unknown): WorkspaceChatSettings {
  const record = value && typeof value === 'object' ? value as Partial<WorkspaceChatSettings> : {};
  const provider = normalizeChatProvider(record.provider);
  const model = resolveStudioChatModel(provider, record.modelId);
  const messages = Array.isArray(record.messages)
    ? record.messages.map(normalizeChatMessage).filter((message): message is WorkspaceChatMessage => Boolean(message))
    : [];
  return {
    mode: normalizeChatMode(record.mode),
    botName: typeof record.botName === 'string' && record.botName.trim()
      ? record.botName
      : DEFAULT_STUDIO_COPY.canvas.nodes.chatbotDefaultName,
    provider,
    modelId: model.modelId,
    systemPrompt: typeof record.systemPrompt === 'string' ? record.systemPrompt : '',
    draftMessage: typeof record.draftMessage === 'string' ? record.draftMessage : '',
    messages,
    status: record.status === 'failed' ? 'failed' : 'idle',
  };
}

export function normalizeWorkspaceChatNodes(nodes: WorkspaceGraphNode[]): WorkspaceGraphNode[] {
  return nodes.map((node) => {
    if (node.data.kind !== 'chat') return node;
    const chat = normalizeChatSettings(node.data.chat);
    return {
      ...node,
      data: {
        ...node.data,
        promptText: typeof node.data.promptText === 'string' ? node.data.promptText : '',
        chat,
        targetHandles: ['prompt'],
        sourceHandles: ['prompt'],
      },
    };
  });
}

export function normalizeWorkspaceGraphNodes(nodes: WorkspaceGraphNode[]): WorkspaceGraphNode[] {
  return normalizePlaceholderOutputNodes(
    normalizeWorkspaceChatNodes(
      normalizeGeneratedOutputNodes(
        normalizeShotOutputNodes(normalizeOutputOnlySourceNodes(nodes).map(normalizeWorkspaceGenerationNode))
      )
    )
  );
}

export function normalizeWorkspaceEdgeTypes(edges: WorkspaceGraphEdge[]): WorkspaceGraphEdge[] {
  return edges.map((edge) => (edge.type === WORKSPACE_EDGE_TYPE ? edge : { ...edge, type: WORKSPACE_EDGE_TYPE }));
}

export function normalizeTimelineMediaUrls(nodes: WorkspaceGraphNode[], items: WorkspaceTimelineItem[]): WorkspaceTimelineItem[] {
  return items.map((item) => {
    const track = normalizeWorkspaceTimelineTrack(item.track);
    const normalizedItem: WorkspaceTimelineItem = {
      ...item,
      track,
      sourceStartSec: item.sourceStartSec ?? 0,
      sourceDurationSec: item.sourceDurationSec ?? item.durationSec,
      mediaKind: item.mediaKind ?? (isWorkspaceTimelineAudioTrack(track) ? 'audio' : 'video'),
    };
    const sourceNode = nodes.find((node) => node.id === item.outputNodeId);
    const sourceDimensions = normalizedItem.mediaKind === 'audio'
      ? null
      : workspaceMediaDimensionsForTimelineSource(normalizedItem, sourceNode);
    const itemWithSourceDimensions = sourceDimensions &&
      (!normalizedItem.sourceWidth || !normalizedItem.sourceHeight)
      ? {
          ...normalizedItem,
          sourceWidth: sourceDimensions.width,
          sourceHeight: sourceDimensions.height,
        }
      : normalizedItem;
    if (itemWithSourceDimensions.mediaUrl && itemWithSourceDimensions.mediaUrl !== STALE_EMPTY_DEMO_AUDIO_URL) {
      return itemWithSourceDimensions;
    }
    const output = sourceNode?.data.output;
    const asset = sourceNode?.data.asset;
    const mediaUrl = itemWithSourceDimensions.mediaKind === 'audio'
      ? [output?.audioUrl, output?.url, asset?.url]
        .map((url) => normalizePlayableAudioUrl(url))
        .find((url): url is string => Boolean(url)) ?? null
      : itemWithSourceDimensions.mediaKind === 'image'
        ? [output?.url, output?.thumbUrl, asset?.url, asset?.thumbUrl].find(isPlayableImageUrl) ?? null
        : [output?.url, asset?.url].find(isPlayableVideoUrl) ?? null;
    if (!mediaUrl) return itemWithSourceDimensions;
    return {
      ...itemWithSourceDimensions,
      mediaUrl,
      thumbnailUrl: item.thumbnailUrl ?? output?.thumbUrl ?? asset?.thumbUrl ?? null,
    };
  });
}
