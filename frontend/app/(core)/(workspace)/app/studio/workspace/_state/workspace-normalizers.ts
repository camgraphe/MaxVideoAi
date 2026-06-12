import {
  WORKSPACE_DEMO_AUDIO_URL,
} from '../_lib/workspace-library-assets';
import { DEFAULT_STUDIO_COPY } from '../../_lib/studio-copy';
import {
  isWorkspaceTimelineAudioTrack,
  normalizeWorkspaceTimelineTrack,
} from '../_lib/workspace-timeline-tracks';
import type {
  WorkspaceEdgeKind,
  WorkspaceGraphEdge,
  WorkspaceGraphNode,
  WorkspaceNodeKind,
  WorkspaceOutputMetadata,
  WorkspaceTimelineItem,
} from '../_lib/workspace-types';
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
    if (
      node.data.targetHandles?.length === 1 &&
      node.data.targetHandles[0] === GENERATED_OUTPUT_TARGET_HANDLE &&
      node.data.sourceHandles?.length === 1 &&
      node.data.sourceHandles[0] === GENERATED_OUTPUT_SOURCE_HANDLE
    ) {
      return node;
    }
    return {
      ...node,
      data: {
        ...node.data,
        targetHandles: [GENERATED_OUTPUT_TARGET_HANDLE],
        sourceHandles: [GENERATED_OUTPUT_SOURCE_HANDLE],
      },
    };
  });
}

export function normalizeGeneratedOutputEdges(nodes: WorkspaceGraphNode[], edges: WorkspaceGraphEdge[]): WorkspaceGraphEdge[] {
  const outputNodeIds = new Set(nodes.filter((node) => node.data.kind === 'output').map((node) => node.id));
  return edges.map((edge) => {
    const nextEdge = { ...edge };
    if (outputNodeIds.has(edge.target) && edge.data?.kind === GENERATED_OUTPUT_TARGET_HANDLE) {
      nextEdge.targetHandle = GENERATED_OUTPUT_TARGET_HANDLE;
    }
    if (outputNodeIds.has(edge.source)) {
      nextEdge.sourceHandle = GENERATED_OUTPUT_SOURCE_HANDLE;
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
    if (node.data.sourceHandles?.length === 1 && node.data.sourceHandles[0] === GENERATED_OUTPUT_TARGET_HANDLE) {
      return node;
    }
    return {
      ...node,
      data: {
        ...node.data,
        sourceHandles: [GENERATED_OUTPUT_TARGET_HANDLE],
      },
    };
  });
}

export function normalizeShotOutputEdges(nodes: WorkspaceGraphNode[], edges: WorkspaceGraphEdge[]): WorkspaceGraphEdge[] {
  const shotNodeIds = new Set(nodes.filter((node) => node.data.kind === 'shot').map((node) => node.id));
  return edges.map((edge) => {
    if (!shotNodeIds.has(edge.source) || edge.sourceHandle === GENERATED_OUTPUT_TARGET_HANDLE) return edge;
    return {
      ...edge,
      sourceHandle: GENERATED_OUTPUT_TARGET_HANDLE,
    };
  });
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
    if (normalizedItem.mediaUrl && normalizedItem.mediaUrl !== STALE_EMPTY_DEMO_AUDIO_URL) return normalizedItem;
    const sourceNode = nodes.find((node) => node.id === item.outputNodeId);
    const output = sourceNode?.data.output;
    const asset = sourceNode?.data.asset;
    const mediaUrl = normalizedItem.mediaKind === 'audio'
      ? [output?.audioUrl, output?.url, asset?.url]
        .map((url) => normalizePlayableAudioUrl(url))
        .find((url): url is string => Boolean(url)) ?? null
      : normalizedItem.mediaKind === 'image'
        ? [output?.url, output?.thumbUrl, asset?.url, asset?.thumbUrl].find(isPlayableImageUrl) ?? null
        : [output?.url, asset?.url].find(isPlayableVideoUrl) ?? null;
    if (!mediaUrl) return normalizedItem;
    return {
      ...normalizedItem,
      mediaUrl,
      thumbnailUrl: item.thumbnailUrl ?? output?.thumbUrl ?? asset?.thumbUrl ?? null,
    };
  });
}
