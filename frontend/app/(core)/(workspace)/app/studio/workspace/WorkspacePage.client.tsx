'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { addEdge, applyEdgeChanges, applyNodeChanges, type Connection, type EdgeChange, type NodeChange } from '@xyflow/react';
import { Download, GitBranch, PanelRight, Play, RefreshCcw, Settings, Settings2, Share2, Sparkles } from 'lucide-react';
import Image from 'next/image';
import { NodeLibrarySidebar } from './_components/NodeLibrarySidebar';
import { NodeSettingsPanel } from './_components/NodeSettingsPanel';
import { TimelineClipInspector } from './_components/TimelineClipInspector';
import { WorkspaceCanvas, type WorkspaceHandleDropRequest, type WorkspacePaletteDropRequest } from './_components/WorkspaceCanvas.client';
import { WorkspaceAssetLibraryModal } from './_components/WorkspaceAssetLibraryModal';
import { WorkspaceExportDialog } from './_components/WorkspaceExportDialog';
import { WorkspaceProjectSettingsDialog } from './_components/WorkspaceProjectSettingsDialog';
import { WorkspaceTimeline } from './_components/WorkspaceTimeline';
import { WorkspaceVideoViewer } from './_components/WorkspaceVideoViewer';
import { useWorkspaceEditorAssetLibrary } from './_hooks/useWorkspaceEditorAssetLibrary';
import { useWorkspaceShotPricing } from './_hooks/useWorkspaceShotPricing';
import {
  getWorkspaceModelCapability,
  getWorkspaceModelCapabilities,
  getWorkspaceShotInputConnectors,
  getWorkspaceShotTargetHandles,
  isWorkspaceConnectionCompatible,
  validateShotConnections,
  workspaceConnectionCapacity,
} from './_lib/workspace-capabilities';
import { createPendingWorkspaceOutput, submitWorkspaceShotGeneration } from './_lib/workspace-generation';
import type {
  WorkspaceEdgeKind,
  WorkspaceGraphEdge,
  WorkspaceGraphNode,
  WorkspaceInputConnector,
  WorkspaceNodeKind,
  WorkspaceOutputMetadata,
  WorkspaceProjectSettings,
  WorkspaceShotSettings,
  WorkspaceTemplateId,
  WorkspaceTimelineItem,
  WorkspaceTimelineAudioTrack,
  WorkspaceTimelineTrack,
  WorkspaceTimelineVideoTrack,
} from './_lib/workspace-types';
import { createWorkspaceHandleDropNode, resolveWorkspaceHandleDropDraft } from './_lib/workspace-handle-drop';
import {
  WORKSPACE_DEMO_AUDIO_URL,
  workspaceAssetRecordFromLibraryAsset,
  type WorkspaceLibraryAsset,
} from './_lib/workspace-library-assets';
import {
  WORKSPACE_TEMPLATE_SUMMARIES,
  createStarterWorkspaceTemplate,
  createWorkspaceEdge,
  inferWorkspaceEdgeKind,
} from './_lib/workspace-templates';
import { filterRenderableWorkspaceEdges } from './_lib/workspace-render-edges';
import {
  DEFAULT_WORKSPACE_PROJECT_SETTINGS,
  coerceWorkspaceProjectSettings,
} from './_lib/workspace-project-settings';
import {
  buildWorkspaceTimelineItemsForAsset,
  buildWorkspaceTimelineItemsForOutput,
  deleteWorkspaceTimelineItem,
  insertWorkspaceTimelineItems,
  linkWorkspaceTimelineSelection,
  moveWorkspaceTimelineItem,
  moveWorkspaceTimelineSelectionWithMode,
  normalizeWorkspaceTimelineIdentities,
  resizeWorkspaceTimelineItem,
  splitWorkspaceTimelineItem,
  unlinkWorkspaceTimelineSelection,
  type WorkspaceTimelineTrimEdge,
  type WorkspaceTimelineTrimMode,
} from './_lib/workspace-timeline-editing';
import {
  buildWorkspaceTimelineEdl,
  buildWorkspaceTimelineRenderManifest,
  serializeWorkspaceTimelineRenderManifest,
  type WorkspaceTimelineExportRangeMode,
  workspaceTimelineRenderReadinessLabel,
} from './_lib/workspace-timeline-render';
import {
  isWorkspaceTimelineAudioTrack,
  isWorkspaceTimelineVideoTrack,
  normalizeWorkspaceTimelineTrack,
  workspaceTimelineAudioTrackId,
  workspaceTimelineAudioTrackIndex,
  workspaceTimelineTrackLabel,
  workspaceTimelineVideoTrackId,
  workspaceTimelineVideoTrackIndex,
} from './_lib/workspace-timeline-tracks';
import { formatWorkspaceTimecode } from './_lib/workspace-timecode';
import styles from './maxvideoai-editor.module.css';

const STORAGE_KEY = 'maxvideoai.editor.workspace.v1';
const RENDER_MANIFEST_STORAGE_KEY = 'maxvideoai.editor.timelineRender.v1';
const TIMELINE_HISTORY_LIMIT = 50;
const MAX_TIMELINE_VIDEO_TRACKS = 4;
const MIN_TIMELINE_AUDIO_TRACKS = 3;
const MAX_TIMELINE_AUDIO_TRACKS = 8;
const MIN_TIMELINE_PANEL_HEIGHT = 220;
const MAX_TIMELINE_PANEL_HEIGHT = 620;
const STALE_EMPTY_DEMO_AUDIO_URL = 'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQIAAAAAAA==';

type PersistedWorkspaceState = {
  nodes: WorkspaceGraphNode[];
  edges: WorkspaceGraphEdge[];
  timelineItems: WorkspaceTimelineItem[];
  activeTemplateId: WorkspaceTemplateId;
  projectSettings: WorkspaceProjectSettings;
  focusMode?: WorkspaceFocusMode;
  audioTrackCount?: number;
  hiddenVideoTracks?: WorkspaceTimelineVideoTrack[];
  lockedTimelineTracks?: WorkspaceTimelineTrack[];
  mutedAudioTracks?: WorkspaceTimelineAudioTrack[];
  videoTrackCount?: number;
  timelinePanelHeight?: number | null;
  timelineInPointSec?: number | null;
  timelineOutPointSec?: number | null;
};

type TimelineHistoryState = {
  past: WorkspaceTimelineItem[][];
  future: WorkspaceTimelineItem[][];
};

type WorkspaceFocusMode = 'canvas' | 'viewer';
type WorkspaceEditorSurface = 'canvas' | 'timeline';

const OUTPUT_ONLY_SOURCE_HANDLES: Partial<Record<WorkspaceNodeKind, WorkspaceEdgeKind>> = {
  'asset-image': 'reference',
  'asset-video': 'video_reference',
  'asset-audio': 'audio',
  'text-prompt': 'prompt',
};

const GENERATED_OUTPUT_TARGET_HANDLE: WorkspaceEdgeKind = 'generated_output';
const GENERATED_OUTPUT_SOURCE_HANDLE: WorkspaceEdgeKind = 'video_reference';
const WORKSPACE_EDGE_TYPE = 'workspace-smart';

function isPlayableVideoUrl(url?: string | null): boolean {
  if (!url) return false;
  if (url.startsWith('blob:') || url.startsWith('data:video/')) return true;
  return /\.(mp4|webm|mov|m4v)(?:[?#].*)?$/i.test(url);
}

function isPlayableAudioUrl(url?: string | null): boolean {
  if (!url) return false;
  if (url.startsWith('blob:') || url.startsWith('data:audio/')) return true;
  return /\.(mp3|wav|ogg|m4a|aac|mp4|webm|mov|m4v)(?:[?#].*)?$/i.test(url);
}

function isPlayableImageUrl(url?: string | null): boolean {
  if (!url) return false;
  if (url.startsWith('blob:') || url.startsWith('data:image/')) return true;
  return /\.(png|jpe?g|webp|gif|avif)(?:[?#].*)?$/i.test(url);
}

function playableOutputTimelineUrl(output: WorkspaceOutputMetadata): string | null {
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

function workspaceTimelineItemsCompatibleWithTrack(items: WorkspaceTimelineItem[], track: WorkspaceTimelineTrack): boolean {
  const hasVisualItem = items.some((item) => isWorkspaceTimelineVideoTrack(item.track) && item.mediaKind !== 'audio');
  const hasOnlyAudioItems = items.every((item) => item.mediaKind === 'audio' || isWorkspaceTimelineAudioTrack(item.track));
  return isWorkspaceTimelineVideoTrack(track) ? hasVisualItem : isWorkspaceTimelineAudioTrack(track) && hasOnlyAudioItems;
}

function retargetWorkspaceTimelineItemsForTrack(items: WorkspaceTimelineItem[], track: WorkspaceTimelineTrack): WorkspaceTimelineItem[] {
  if (isWorkspaceTimelineVideoTrack(track)) {
    return items.map((item) => (isWorkspaceTimelineVideoTrack(item.track) ? { ...item, track } : item));
  }
  if (isWorkspaceTimelineAudioTrack(track)) {
    return items.map((item) => (item.mediaKind === 'audio' || isWorkspaceTimelineAudioTrack(item.track) ? { ...item, track } : item));
  }
  return items;
}

function deleteWorkspaceTimelineTrackItems(items: WorkspaceTimelineItem[], track: WorkspaceTimelineTrack): WorkspaceTimelineItem[] {
  if (isWorkspaceTimelineVideoTrack(track)) {
    const deletedIndex = workspaceTimelineVideoTrackIndex(track);
    return items
      .filter((item) => item.track !== track)
      .map((item) => {
        if (!isWorkspaceTimelineVideoTrack(item.track)) return item;
        const itemTrackIndex = workspaceTimelineVideoTrackIndex(item.track);
        if (itemTrackIndex <= deletedIndex) return item;
        return {
          ...item,
          track: workspaceTimelineVideoTrackId(itemTrackIndex - 1),
        };
      });
  }

  const deletedIndex = workspaceTimelineAudioTrackIndex(track);
  return items
    .filter((item) => item.track !== track)
    .map((item) => {
      if (!isWorkspaceTimelineAudioTrack(item.track)) return item;
      const itemTrackIndex = workspaceTimelineAudioTrackIndex(item.track);
      if (itemTrackIndex <= deletedIndex) return item;
      return {
        ...item,
        track: workspaceTimelineAudioTrackId(itemTrackIndex - 1),
      };
    });
}

function deleteWorkspaceTimelineTrackIds(trackIds: WorkspaceTimelineTrack[], track: WorkspaceTimelineTrack): WorkspaceTimelineTrack[] {
  const nextTrackIds = trackIds
    .filter((trackId) => trackId !== track)
    .map((trackId) => {
      if (isWorkspaceTimelineVideoTrack(track) && isWorkspaceTimelineVideoTrack(trackId)) {
        const deletedIndex = workspaceTimelineVideoTrackIndex(track);
        const trackIndex = workspaceTimelineVideoTrackIndex(trackId);
        return trackIndex > deletedIndex ? workspaceTimelineVideoTrackId(trackIndex - 1) : trackId;
      }
      if (isWorkspaceTimelineAudioTrack(track) && isWorkspaceTimelineAudioTrack(trackId)) {
        const deletedIndex = workspaceTimelineAudioTrackIndex(track);
        const trackIndex = workspaceTimelineAudioTrackIndex(trackId);
        return trackIndex > deletedIndex ? workspaceTimelineAudioTrackId(trackIndex - 1) : trackId;
      }
      return trackId;
    });
  return Array.from(new Set(nextTrackIds));
}

function timelineTrackHasClipAt(items: WorkspaceTimelineItem[], track: WorkspaceTimelineTrack, seconds: number): boolean {
  return items.some((item) => (
    item.track === track &&
    seconds > item.startSec &&
    seconds < item.startSec + item.durationSec
  ));
}

function workspaceTimelineCutPoints(items: WorkspaceTimelineItem[]): number[] {
  const cutPoints = new Set<number>([0]);
  items
    .filter((item) => isWorkspaceTimelineVideoTrack(item.track))
    .forEach((item) => {
      cutPoints.add(Math.round(item.startSec * 1_000_000) / 1_000_000);
      cutPoints.add(Math.round((item.startSec + item.durationSec) * 1_000_000) / 1_000_000);
    });
  return Array.from(cutPoints).sort((left, right) => left - right);
}

function normalizePlayableAudioUrl(url?: string | null): string | null {
  if (url === STALE_EMPTY_DEMO_AUDIO_URL) return WORKSPACE_DEMO_AUDIO_URL;
  return isPlayableAudioUrl(url) ? url ?? null : null;
}

function outputOnlySourceHandle(node: WorkspaceGraphNode): WorkspaceEdgeKind | null {
  return OUTPUT_ONLY_SOURCE_HANDLES[node.data.kind] ?? null;
}

function normalizeOutputOnlySourceNodes(nodes: WorkspaceGraphNode[]): WorkspaceGraphNode[] {
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

function normalizeOutputOnlySourceEdges(nodes: WorkspaceGraphNode[], edges: WorkspaceGraphEdge[]): WorkspaceGraphEdge[] {
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

function normalizeGeneratedOutputNodes(nodes: WorkspaceGraphNode[]): WorkspaceGraphNode[] {
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

function normalizeGeneratedOutputEdges(nodes: WorkspaceGraphNode[], edges: WorkspaceGraphEdge[]): WorkspaceGraphEdge[] {
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

function normalizePlaceholderOutputNodes(nodes: WorkspaceGraphNode[]): WorkspaceGraphNode[] {
  return nodes.map((node) => {
    const output = node.data.output;
    if (node.data.kind !== 'output' || !output || output.status || output.kind !== 'video' || isPlayableVideoUrl(output.url)) {
      return node;
    }
    return {
      ...node,
      data: {
        ...node.data,
        subtitle: 'Waiting for generated media',
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

function normalizeShotOutputNodes(nodes: WorkspaceGraphNode[]): WorkspaceGraphNode[] {
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

function normalizeShotOutputEdges(nodes: WorkspaceGraphNode[], edges: WorkspaceGraphEdge[]): WorkspaceGraphEdge[] {
  const shotNodeIds = new Set(nodes.filter((node) => node.data.kind === 'shot').map((node) => node.id));
  return edges.map((edge) => {
    if (!shotNodeIds.has(edge.source) || edge.sourceHandle === GENERATED_OUTPUT_TARGET_HANDLE) return edge;
    return {
      ...edge,
      sourceHandle: GENERATED_OUTPUT_TARGET_HANDLE,
    };
  });
}

function normalizeWorkspaceEdgeTypes(edges: WorkspaceGraphEdge[]): WorkspaceGraphEdge[] {
  return edges.map((edge) => (edge.type === WORKSPACE_EDGE_TYPE ? edge : { ...edge, type: WORKSPACE_EDGE_TYPE }));
}

function normalizeTimelineMediaUrls(nodes: WorkspaceGraphNode[], items: WorkspaceTimelineItem[]): WorkspaceTimelineItem[] {
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

function videoTrackCountForTimelineItems(items: WorkspaceTimelineItem[]): number {
  return Math.max(1, ...items.map((item) => workspaceTimelineVideoTrackIndex(item.track)));
}

function audioTrackCountForTimelineItems(items: WorkspaceTimelineItem[]): number {
  return Math.max(MIN_TIMELINE_AUDIO_TRACKS, ...items.map((item) => workspaceTimelineAudioTrackIndex(item.track)));
}

function coerceVideoTrackCount(value: unknown, items: WorkspaceTimelineItem[]): number {
  const requestedCount = typeof value === 'number' ? value : 1;
  return Math.max(1, Math.min(MAX_TIMELINE_VIDEO_TRACKS, Math.max(requestedCount, videoTrackCountForTimelineItems(items))));
}

function coerceAudioTrackCount(value: unknown, items: WorkspaceTimelineItem[]): number {
  const requestedCount = typeof value === 'number' ? value : MIN_TIMELINE_AUDIO_TRACKS;
  return Math.max(MIN_TIMELINE_AUDIO_TRACKS, Math.min(MAX_TIMELINE_AUDIO_TRACKS, Math.max(requestedCount, audioTrackCountForTimelineItems(items))));
}

function coerceTimelinePanelHeight(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.max(MIN_TIMELINE_PANEL_HEIGHT, Math.min(MAX_TIMELINE_PANEL_HEIGHT, Math.round(value)));
}

function coerceTimelineMarker(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 1000) / 1000;
}

function coerceTimelineTrackList(value: unknown, videoTrackCount: number, audioTrackCount: number): WorkspaceTimelineTrack[] {
  if (!Array.isArray(value)) return [];
  const normalizedTracks = value
    .map((track) => normalizeWorkspaceTimelineTrack(String(track)))
    .filter((track) => {
      if (isWorkspaceTimelineVideoTrack(track)) return workspaceTimelineVideoTrackIndex(track) <= videoTrackCount;
      return workspaceTimelineAudioTrackIndex(track) <= audioTrackCount;
    });
  return Array.from(new Set(normalizedTracks));
}

function coerceHiddenVideoTracks(value: unknown, videoTrackCount: number): WorkspaceTimelineVideoTrack[] {
  return coerceTimelineTrackList(value, videoTrackCount, MIN_TIMELINE_AUDIO_TRACKS)
    .filter((track): track is WorkspaceTimelineVideoTrack => isWorkspaceTimelineVideoTrack(track));
}

function coerceMutedAudioTracks(value: unknown, audioTrackCount: number): WorkspaceTimelineAudioTrack[] {
  return coerceTimelineTrackList(value, MAX_TIMELINE_VIDEO_TRACKS, audioTrackCount)
    .filter((track): track is WorkspaceTimelineAudioTrack => isWorkspaceTimelineAudioTrack(track));
}

function timelineSelectionTouchesLockedTrack(items: WorkspaceTimelineItem[], itemIds: string[], lockedTracks: WorkspaceTimelineTrack[]): boolean {
  if (!itemIds.length || !lockedTracks.length) return false;
  const selectedItemIds = new Set(itemIds);
  const selectedLinkedGroupIds = new Set(
    items
      .filter((item) => selectedItemIds.has(item.id) && item.linkedGroupId)
      .map((item) => item.linkedGroupId as string)
  );
  const lockedTrackSet = new Set(lockedTracks);
  return items.some((item) => (
    lockedTrackSet.has(item.track) &&
    (selectedItemIds.has(item.id) || Boolean(item.linkedGroupId && selectedLinkedGroupIds.has(item.linkedGroupId)))
  ));
}

function filterHiddenVideoTrackItems(items: WorkspaceTimelineItem[], hiddenVideoTracks: WorkspaceTimelineVideoTrack[]): WorkspaceTimelineItem[] {
  if (!hiddenVideoTracks.length) return items;
  const hiddenVideoTrackSet = new Set<WorkspaceTimelineTrack>(hiddenVideoTracks);
  return items.filter((item) => !isWorkspaceTimelineVideoTrack(item.track) || !hiddenVideoTrackSet.has(item.track));
}

function muteAudioTrackItems(items: WorkspaceTimelineItem[], mutedAudioTracks: WorkspaceTimelineAudioTrack[]): WorkspaceTimelineItem[] {
  if (!mutedAudioTracks.length) return items;
  const mutedAudioTrackSet = new Set<WorkspaceTimelineTrack>(mutedAudioTracks);
  return items.map((item) => {
    if (!isWorkspaceTimelineAudioTrack(item.track) || !mutedAudioTrackSet.has(item.track)) return item;
    return {
      ...item,
      audioMix: {
        volume: item.audioMix?.volume ?? 100,
        muted: true,
      },
    };
  });
}

function downloadWorkspaceTextFile(filename: string, contents: string, type: string): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob([contents], { type });
  const url = window.URL.createObjectURL(blob);
  const link = window.document.createElement('a');
  link.href = url;
  link.download = filename;
  window.document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 0);
}

function readPersistedWorkspaceState(): PersistedWorkspaceState | null {
  if (typeof window === 'undefined') return null;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<PersistedWorkspaceState> | null;
    if (!parsed || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges) || !Array.isArray(parsed.timelineItems)) return null;
    const nodes = normalizePlaceholderOutputNodes(
      normalizeGeneratedOutputNodes(normalizeShotOutputNodes(normalizeOutputOnlySourceNodes(parsed.nodes)))
    );
    const edges = normalizeWorkspaceEdgeTypes(
      normalizeGeneratedOutputEdges(nodes, normalizeShotOutputEdges(nodes, normalizeOutputOnlySourceEdges(nodes, parsed.edges)))
    );
    const timelineItems = normalizeWorkspaceTimelineIdentities(normalizeTimelineMediaUrls(nodes, parsed.timelineItems));
    const audioTrackCount = coerceAudioTrackCount(parsed.audioTrackCount, timelineItems);
    const videoTrackCount = coerceVideoTrackCount(parsed.videoTrackCount, timelineItems);
    return {
      nodes,
      edges,
      timelineItems,
      activeTemplateId: parsed.activeTemplateId ?? 'product-ad',
      projectSettings: coerceWorkspaceProjectSettings(parsed.projectSettings),
      focusMode: parsed.focusMode === 'viewer' ? 'viewer' : 'canvas',
      audioTrackCount,
      hiddenVideoTracks: coerceHiddenVideoTracks(parsed.hiddenVideoTracks, videoTrackCount),
      lockedTimelineTracks: coerceTimelineTrackList(parsed.lockedTimelineTracks, videoTrackCount, audioTrackCount),
      mutedAudioTracks: coerceMutedAudioTracks(parsed.mutedAudioTracks, audioTrackCount),
      videoTrackCount,
      timelinePanelHeight: coerceTimelinePanelHeight(parsed.timelinePanelHeight),
      timelineInPointSec: coerceTimelineMarker(parsed.timelineInPointSec),
      timelineOutPointSec: coerceTimelineMarker(parsed.timelineOutPointSec),
    };
  } catch {
    return null;
  }
}

function connectedInputKinds(nodeId: string, edges: WorkspaceGraphEdge[]): WorkspaceEdgeKind[] {
  return edges
    .filter((edge) => edge.target === nodeId)
    .map((edge) => edge.data?.kind ?? inferWorkspaceEdgeKind(edge.sourceHandle, edge.targetHandle))
    .filter((kind) => kind !== 'generated_output' && kind !== 'output_to_timeline');
}

function connectedInputCounts(nodeId: string, edges: WorkspaceGraphEdge[]): Map<WorkspaceEdgeKind, number> {
  return edges
    .filter((edge) => edge.target === nodeId)
    .reduce((counts, edge) => {
      const kind = edge.data?.kind ?? inferWorkspaceEdgeKind(edge.sourceHandle, edge.targetHandle);
      counts.set(kind, (counts.get(kind) ?? 0) + 1);
      return counts;
    }, new Map<WorkspaceEdgeKind, number>());
}

function findGeneratedOutputNodeForShot(
  shotNodeId: string,
  nodes: WorkspaceGraphNode[],
  edges: WorkspaceGraphEdge[]
): WorkspaceGraphNode | null {
  const outputEdge = edges.find(
    (edge) =>
      edge.source === shotNodeId &&
      (edge.data?.kind === GENERATED_OUTPUT_TARGET_HANDLE || edge.targetHandle === GENERATED_OUTPUT_TARGET_HANDLE)
  );
  if (!outputEdge) return null;
  return nodes.find((node) => node.id === outputEdge.target && node.data.kind === 'output') ?? null;
}

function outputNodeSubtitle(output: NonNullable<WorkspaceGraphNode['data']['output']>): string {
  if (output.status === 'processing') return 'Processing render...';
  if (output.status === 'placeholder') return 'Waiting for generated media';
  if (output.status === 'failed') return 'Generation failed';
  if (output.durationSec && output.aspectRatio) return `${output.durationSec}s · ${output.aspectRatio}`;
  return 'Generated media';
}

function connectorForTarget({
  targetNode,
  targetHandle,
  capabilities,
}: {
  targetNode: WorkspaceGraphNode | null;
  targetHandle: WorkspaceEdgeKind;
  capabilities: ReturnType<typeof getWorkspaceModelCapabilities>;
}): WorkspaceInputConnector | null {
  if (!targetNode) return null;
  if (targetNode.data.kind === 'shot' && targetNode.data.shot) {
    const capability = getWorkspaceModelCapability(targetNode.data.shot.modelId, capabilities);
    return getWorkspaceShotInputConnectors(capability).find((connector) => connector.kind === targetHandle) ?? null;
  }
  if (targetNode.data.kind === 'output' && targetHandle === 'generated_output') {
    return {
      kind: 'generated_output',
      label: 'Output',
      required: true,
      maxCount: 1,
      sourceType: 'video',
    };
  }
  return null;
}

function workspaceConnectionRejectionReason({
  connection,
  nodes,
  edges,
  capabilities,
}: {
  connection: Pick<Connection, 'source' | 'target'> & { sourceHandle?: string | null; targetHandle?: string | null };
  nodes: WorkspaceGraphNode[];
  edges: WorkspaceGraphEdge[];
  capabilities: ReturnType<typeof getWorkspaceModelCapabilities>;
}): string | null {
  if (!connection.source || !connection.target || !connection.sourceHandle || !connection.targetHandle) {
    return 'This link needs a source and a target connector.';
  }
  if (connection.source === connection.target) {
    return 'A block cannot link to itself.';
  }
  if (!isWorkspaceConnectionCompatible({ sourceHandle: connection.sourceHandle, targetHandle: connection.targetHandle })) {
    return 'These block connectors are not compatible.';
  }
  const targetHandle = inferWorkspaceEdgeKind(connection.sourceHandle, connection.targetHandle);
  const targetNode = nodes.find((node) => node.id === connection.target) ?? null;
  const connector = connectorForTarget({ targetNode, targetHandle, capabilities });
  if (!connector) return null;
  const capacity = workspaceConnectionCapacity({
    connector,
    connectedCount: connectedInputCounts(connection.target, edges).get(targetHandle) ?? 0,
  });
  if (capacity.isFull) {
    return `${connector.label} is full.`;
  }
  return null;
}

function defaultTimelineSelection(items: WorkspaceTimelineItem[]): string | null {
  return items.find((item) => isWorkspaceTimelineVideoTrack(item.track))?.id ?? items[0]?.id ?? null;
}

function defaultTimelineSelectionIds(items: WorkspaceTimelineItem[]): string[] {
  const itemId = defaultTimelineSelection(items);
  return itemId ? [itemId] : [];
}

function uniqueTimelineSelectionIds(itemIds: string[]): string[] {
  return Array.from(new Set(itemIds.filter(Boolean)));
}

function nextAvailableTimelineItemId(baseId: string, items: WorkspaceTimelineItem[]): string {
  const usedIds = new Set(items.map((item) => item.id));
  if (!usedIds.has(baseId)) return baseId;

  let suffix = 2;
  let nextId = `${baseId}-${suffix}`;
  while (usedIds.has(nextId)) {
    suffix += 1;
    nextId = `${baseId}-${suffix}`;
  }
  return nextId;
}

function createAdHocNode(kind: WorkspaceNodeKind, index: number, modelId: string, positionOverride?: { x: number; y: number }): WorkspaceGraphNode {
  const position = positionOverride ?? { x: -220 + (index % 4) * 180, y: -120 + Math.floor(index / 4) * 140 };
  const id = `${kind}-${Date.now().toString(36)}-${index}`;

  if (kind === 'asset-image') {
    return {
      id,
      type: 'asset-image',
      position,
      data: {
        kind,
        title: 'Image Reference',
        subtitle: 'No image selected',
        accent: '#8b5cf6',
        targetHandles: [],
        sourceHandles: ['reference'],
      },
    };
  }

  if (kind === 'asset-video') {
    return {
      id,
      type: 'asset-video',
      position,
      data: {
        kind,
        title: 'Video Reference',
        subtitle: 'No video selected',
        accent: '#2563eb',
        targetHandles: [],
        sourceHandles: ['video_reference'],
      },
    };
  }

  if (kind === 'asset-audio') {
    return {
      id,
      type: 'asset-audio',
      position,
      data: {
        kind,
        title: 'Audio Reference',
        subtitle: 'No audio selected',
        accent: '#22c55e',
        targetHandles: [],
        sourceHandles: ['audio'],
      },
    };
  }

  if (kind === 'text-prompt') {
    return {
      id,
      type: 'text-prompt',
      position,
      data: {
        kind,
        title: 'Prompt',
        subtitle: 'prompt.txt',
        accent: '#60a5fa',
        promptRole: 'prompt',
        promptText: 'Describe the next shot with subject, motion, lighting, lens, and mood.',
        sourceHandles: ['prompt'],
      },
    };
  }

  return {
    id,
    type: 'shot',
    position,
    data: {
      kind: 'shot',
      title: 'Shot',
      subtitle: 'New generation block',
      accent: '#f97316',
      shot: {
        modelId,
        workflowType: 'image_to_video',
        durationSec: 7,
        aspectRatio: '16:9',
        resolution: '1080p',
        fps: 24,
        seed: null,
        audioEnabled: false,
        lipSyncEnabled: false,
        referenceStrength: 0.65,
        outputName: 'New Shot',
        status: 'draft',
      },
      targetHandles: ['prompt', 'negative_prompt', 'product', 'character', 'style', 'video_reference', 'motion_reference', 'audio', 'voiceover', 'music', 'camera', 'dialogue', 'narration', 'previous_shot'],
      sourceHandles: [GENERATED_OUTPUT_TARGET_HANDLE],
    },
  };
}

function defaultSelectedNodeId(nodes: WorkspaceGraphNode[], templateId: WorkspaceTemplateId): string | null {
  if (templateId === 'product-ad' && nodes.some((node) => node.id === 'shot-03')) return 'shot-03';
  return nodes[0]?.id ?? null;
}

function selectWorkspaceGraphNode(nodes: WorkspaceGraphNode[], nodeId: string): WorkspaceGraphNode[] {
  return nodes.map((node) => ({
    ...node,
    selected: node.id === nodeId,
  }));
}

function appendSelectedWorkspaceGraphNode(nodes: WorkspaceGraphNode[], node: WorkspaceGraphNode): WorkspaceGraphNode[] {
  return [
    ...selectWorkspaceGraphNode(nodes, node.id),
    {
      ...node,
      selected: true,
    },
  ];
}

export default function WorkspacePage() {
  const defaultTemplate = useMemo(() => createStarterWorkspaceTemplate('product-ad'), []);
  const capabilities = useMemo(() => getWorkspaceModelCapabilities(), []);
  const defaultModelId = capabilities.find((capability) => capability.id === 'kling-3-pro')?.id ?? capabilities[0]?.id ?? 'kling-3-pro';
  const playbackFrameRef = useRef<number | null>(null);
  const timelineItemsRef = useRef<WorkspaceTimelineItem[]>(defaultTemplate.timelineItems);
  const [nodes, setNodes] = useState<WorkspaceGraphNode[]>(defaultTemplate.nodes);
  const [edges, setEdges] = useState<WorkspaceGraphEdge[]>(defaultTemplate.edges);
  const [timelineItems, setTimelineItems] = useState<WorkspaceTimelineItem[]>(defaultTemplate.timelineItems);
  const [timelinePreview, setTimelinePreview] = useState<{ items: WorkspaceTimelineItem[]; playheadSec: number } | null>(null);
  const [timelineHistory, setTimelineHistory] = useState<TimelineHistoryState>({ past: [], future: [] });
  const [selectedTimelineItemId, setSelectedTimelineItemId] = useState<string | null>(defaultTimelineSelection(defaultTemplate.timelineItems));
  const [selectedTimelineItemIds, setSelectedTimelineItemIds] = useState<string[]>(defaultTimelineSelectionIds(defaultTemplate.timelineItems));
  const [playheadSec, setPlayheadSec] = useState(0);
  const [isTimelinePlaying, setIsTimelinePlaying] = useState(false);
  const [timelineInsertIntoClipEnabled, setTimelineInsertIntoClipEnabled] = useState(false);
  const [audioTrackCount, setAudioTrackCount] = useState(audioTrackCountForTimelineItems(defaultTemplate.timelineItems));
  const [hiddenVideoTracks, setHiddenVideoTracks] = useState<WorkspaceTimelineVideoTrack[]>([]);
  const [lockedTimelineTracks, setLockedTimelineTracks] = useState<WorkspaceTimelineTrack[]>([]);
  const [mutedAudioTracks, setMutedAudioTracks] = useState<WorkspaceTimelineAudioTrack[]>([]);
  const [videoTrackCount, setVideoTrackCount] = useState(videoTrackCountForTimelineItems(defaultTemplate.timelineItems));
  const [timelinePanelHeight, setTimelinePanelHeight] = useState<number | null>(null);
  const [timelineInPointSec, setTimelineInPointSec] = useState<number | null>(null);
  const [timelineOutPointSec, setTimelineOutPointSec] = useState<number | null>(null);
  const [projectSettings, setProjectSettings] = useState<WorkspaceProjectSettings>(DEFAULT_WORKSPACE_PROJECT_SETTINGS);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('shot-03');
  const [activeEditorSurface, setActiveEditorSurface] = useState<WorkspaceEditorSurface>('canvas');
  const [activeTemplateId, setActiveTemplateId] = useState<WorkspaceTemplateId>('product-ad');
  const [focusMode, setFocusMode] = useState<WorkspaceFocusMode>('canvas');
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [exportRangeMode, setExportRangeMode] = useState<WorkspaceTimelineExportRangeMode>('sequence');
  const [isProjectSettingsOpen, setIsProjectSettingsOpen] = useState(false);
  const [mockMode, setMockMode] = useState(process.env.NODE_ENV !== 'production');
  const [notice, setNotice] = useState('Product Ad template loaded. Select Shot 03 to generate an output.');
  const [hydrated, setHydrated] = useState(false);
  const [canvasRevision, setCanvasRevision] = useState(0);
  const [assetPickerNodeId, setAssetPickerNodeId] = useState<string | null>(null);
  const activeTemplateName = WORKSPACE_TEMPLATE_SUMMARIES.find((template) => template.id === activeTemplateId)?.name ?? 'Workspace';
  const pricingEstimates = useWorkspaceShotPricing({ nodes, edges, capabilities });
  const timelineDurationSec = useMemo(
    () => Math.max(0, ...timelineItems.map((item) => item.startSec + item.durationSec)),
    [timelineItems]
  );
  const previewTimelineItems = timelinePreview?.items ?? timelineItems;
  const viewerTimelineItems = useMemo(
    () => muteAudioTrackItems(filterHiddenVideoTrackItems(previewTimelineItems, hiddenVideoTracks), mutedAudioTracks),
    [hiddenVideoTracks, mutedAudioTracks, previewTimelineItems]
  );
  const previewPlayheadSec = timelinePreview?.playheadSec ?? playheadSec;
  const timelineCutPoints = useMemo(() => workspaceTimelineCutPoints(previewTimelineItems), [previewTimelineItems]);
  const timelineCutToleranceSec = 1 / Math.max(1, projectSettings.fps || 24) / 2;
  const canGoToPreviousTimelineCut = timelineCutPoints.some((cutPointSec) => cutPointSec < previewPlayheadSec - timelineCutToleranceSec);
  const canGoToNextTimelineCut = timelineCutPoints.some((cutPointSec) => cutPointSec > previewPlayheadSec + timelineCutToleranceSec);
  const selectedTimelineItem = useMemo(
    () => previewTimelineItems.find((item) => item.id === selectedTimelineItemId) ?? null,
    [previewTimelineItems, selectedTimelineItemId]
  );
  const exportTimelineItems = useMemo(
    () => muteAudioTrackItems(filterHiddenVideoTrackItems(timelineItems, hiddenVideoTracks), mutedAudioTracks),
    [hiddenVideoTracks, mutedAudioTracks, timelineItems]
  );
  const hasValidTimelineInOut = timelineInPointSec !== null && timelineOutPointSec !== null && timelineOutPointSec > timelineInPointSec;
  const activeExportRange = useMemo(
    () => (
      exportRangeMode === 'in-out' && hasValidTimelineInOut
        ? {
            mode: 'in-out' as const,
            startSec: timelineInPointSec,
            endSec: timelineOutPointSec,
          }
        : { mode: 'sequence' as const }
    ),
    [exportRangeMode, hasValidTimelineInOut, timelineInPointSec, timelineOutPointSec]
  );
  const exportManifest = useMemo(
    () => buildWorkspaceTimelineRenderManifest({
      items: exportTimelineItems,
      nodes,
      projectName: activeTemplateName,
      projectSettings,
      exportRange: activeExportRange,
    }),
    [activeExportRange, activeTemplateName, exportTimelineItems, nodes, projectSettings]
  );
  const exportReadinessLabel = useMemo(() => workspaceTimelineRenderReadinessLabel(exportManifest), [exportManifest]);

  const handleToggleTimelinePlayback = useCallback(() => {
    if (timelineDurationSec <= 0) return;
    setIsTimelinePlaying((currentlyPlaying) => {
      if (!currentlyPlaying && playheadSec >= timelineDurationSec) {
        setPlayheadSec(0);
      }
      return !currentlyPlaying;
    });
  }, [playheadSec, timelineDurationSec]);

  const handleGoToTimelineCut = useCallback((direction: -1 | 1) => {
    const cutPointSec = direction > 0
      ? timelineCutPoints.find((candidateSec) => candidateSec > playheadSec + timelineCutToleranceSec)
      : [...timelineCutPoints].reverse().find((candidateSec) => candidateSec < playheadSec - timelineCutToleranceSec);
    if (cutPointSec === undefined) return;
    setIsTimelinePlaying(false);
    setPlayheadSec(cutPointSec);
  }, [playheadSec, timelineCutPoints, timelineCutToleranceSec]);

  const handleMarkTimelineIn = useCallback(() => {
    const nextInPointSec = Math.max(0, Math.min(playheadSec, timelineDurationSec));
    setTimelineInPointSec(nextInPointSec);
    setNotice(`In point set at ${formatWorkspaceTimecode(nextInPointSec, projectSettings.fps)}.`);
  }, [playheadSec, projectSettings.fps, timelineDurationSec]);

  const handleMarkTimelineOut = useCallback(() => {
    const nextOutPointSec = Math.max(0, Math.min(playheadSec, timelineDurationSec));
    setTimelineOutPointSec(nextOutPointSec);
    setNotice(`Out point set at ${formatWorkspaceTimecode(nextOutPointSec, projectSettings.fps)}.`);
  }, [playheadSec, projectSettings.fps, timelineDurationSec]);

  const handleClearTimelineInOut = useCallback(() => {
    setTimelineInPointSec(null);
    setTimelineOutPointSec(null);
    setExportRangeMode('sequence');
    setNotice('In and Out points cleared.');
  }, []);

  const applyTimelineSelection = useCallback((itemIds: string[]) => {
    const nextItemIds = uniqueTimelineSelectionIds(itemIds);
    setSelectedTimelineItemIds(nextItemIds);
    setSelectedTimelineItemId(nextItemIds.at(-1) ?? null);
  }, []);

  const handleSelectTimelineItem = useCallback((itemId: string, mode: 'replace' | 'toggle' | 'focus' = 'replace') => {
    setActiveEditorSurface('timeline');
    setSelectedTimelineItemIds((current) => {
      if (mode === 'focus') {
        const focusedItem = timelineItemsRef.current.find((item) => item.id === itemId);
        const focusedGroupId = focusedItem?.linkedGroupId ?? null;
        const isAlreadyInSelection = current.some((currentItemId) => {
          if (currentItemId === itemId) return true;
          if (!focusedGroupId) return false;
          return timelineItemsRef.current.find((item) => item.id === currentItemId)?.linkedGroupId === focusedGroupId;
        });
        const nextItemIds = isAlreadyInSelection ? current : [itemId];
        setSelectedTimelineItemId(itemId);
        return nextItemIds;
      }
      if (mode === 'toggle') {
        const nextItemIds = current.includes(itemId)
          ? current.filter((candidateId) => candidateId !== itemId)
          : [...current, itemId];
        setSelectedTimelineItemId(nextItemIds.at(-1) ?? null);
        return nextItemIds;
      }
      setSelectedTimelineItemId(itemId);
      return [itemId];
    });
  }, []);

  const handleSelectTimelineItems = useCallback((itemIds: string[]) => {
    setActiveEditorSurface('timeline');
    applyTimelineSelection(itemIds);
  }, [applyTimelineSelection]);

  const handleCanvasInteraction = useCallback(() => {
    setActiveEditorSurface('canvas');
  }, []);

  const handleSelectedCanvasNodeChange = useCallback((nodeId: string | null) => {
    setActiveEditorSurface('canvas');
    setSelectedNodeId(nodeId);
  }, []);

  useEffect(() => {
    timelineItemsRef.current = timelineItems;
  }, [timelineItems]);

  const commitTimelineItems = useCallback((updater: (current: WorkspaceTimelineItem[]) => WorkspaceTimelineItem[]) => {
    setTimelineItems((current) => {
      const nextItems = normalizeWorkspaceTimelineIdentities(updater(current));
      if (nextItems === current) return current;
      timelineItemsRef.current = nextItems;
      setTimelineHistory((history) => ({
        past: [...history.past, current].slice(-TIMELINE_HISTORY_LIMIT),
        future: [],
      }));
      return nextItems;
    });
  }, []);

  const resetTimelineHistory = useCallback(() => {
    setTimelineHistory({ past: [], future: [] });
  }, []);

  const handleUndoTimeline = useCallback(() => {
    setTimelineHistory((history) => {
      const previousItems = history.past.at(-1);
      if (!previousItems) return history;
      const currentItems = timelineItemsRef.current;
      timelineItemsRef.current = previousItems;
      setTimelineItems(previousItems);
      applyTimelineSelection(defaultTimelineSelectionIds(previousItems));
      setIsTimelinePlaying(false);
      return {
        past: history.past.slice(0, -1),
        future: [currentItems, ...history.future].slice(0, TIMELINE_HISTORY_LIMIT),
      };
    });
  }, [applyTimelineSelection]);

  const handleRedoTimeline = useCallback(() => {
    setTimelineHistory((history) => {
      const nextItems = history.future[0];
      if (!nextItems) return history;
      const currentItems = timelineItemsRef.current;
      timelineItemsRef.current = nextItems;
      setTimelineItems(nextItems);
      applyTimelineSelection(defaultTimelineSelectionIds(nextItems));
      setIsTimelinePlaying(false);
      return {
        past: [...history.past, currentItems].slice(-TIMELINE_HISTORY_LIMIT),
        future: history.future.slice(1),
      };
    });
  }, [applyTimelineSelection]);

  useEffect(() => {
    const persisted = readPersistedWorkspaceState();
    if (persisted) {
      setNodes(persisted.nodes);
      setEdges(persisted.edges);
      setTimelineItems(persisted.timelineItems);
      timelineItemsRef.current = persisted.timelineItems;
      applyTimelineSelection(defaultTimelineSelectionIds(persisted.timelineItems));
      setPlayheadSec(0);
      setIsTimelinePlaying(false);
      resetTimelineHistory();
      setActiveTemplateId(persisted.activeTemplateId);
      setProjectSettings(persisted.projectSettings);
      setFocusMode(persisted.focusMode ?? 'canvas');
      setActiveEditorSurface((persisted.focusMode ?? 'canvas') === 'viewer' ? 'timeline' : 'canvas');
      setAudioTrackCount(coerceAudioTrackCount(persisted.audioTrackCount, persisted.timelineItems));
      setHiddenVideoTracks(persisted.hiddenVideoTracks ?? []);
      setLockedTimelineTracks(persisted.lockedTimelineTracks ?? []);
      setMutedAudioTracks(persisted.mutedAudioTracks ?? []);
      setVideoTrackCount(coerceVideoTrackCount(persisted.videoTrackCount, persisted.timelineItems));
      setTimelinePanelHeight(persisted.timelinePanelHeight ?? null);
      setTimelineInPointSec(persisted.timelineInPointSec ?? null);
      setTimelineOutPointSec(persisted.timelineOutPointSec ?? null);
      setCanvasRevision((value) => value + 1);
    }
    setHydrated(true);
  }, [applyTimelineSelection, resetTimelineHistory]);

  useEffect(() => {
    if (!hydrated || typeof window === 'undefined') return;
    const state: PersistedWorkspaceState = {
      nodes,
      edges,
      timelineItems,
      activeTemplateId,
      projectSettings,
      focusMode,
      audioTrackCount,
      hiddenVideoTracks,
      lockedTimelineTracks,
      mutedAudioTracks,
      videoTrackCount,
      timelinePanelHeight,
      timelineInPointSec,
      timelineOutPointSec,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [activeTemplateId, audioTrackCount, edges, focusMode, hiddenVideoTracks, hydrated, lockedTimelineTracks, mutedAudioTracks, nodes, projectSettings, timelineInPointSec, timelineItems, timelineOutPointSec, timelinePanelHeight, videoTrackCount]);

  useEffect(() => {
    if (!timelineItems.length) {
      if (selectedTimelineItemId || selectedTimelineItemIds.length) {
        applyTimelineSelection([]);
      }
      setIsTimelinePlaying(false);
      return;
    }
    const existingItemIds = new Set(timelineItems.map((item) => item.id));
    const currentSelection = selectedTimelineItemIds.filter((itemId) => existingItemIds.has(itemId));
    const nextSelection = selectedTimelineItemIds.length
      ? currentSelection.length
        ? currentSelection
        : defaultTimelineSelectionIds(timelineItems)
      : [];
    if (
      nextSelection.length !== selectedTimelineItemIds.length ||
      nextSelection.some((itemId, index) => itemId !== selectedTimelineItemIds[index])
    ) {
      applyTimelineSelection(nextSelection);
      return;
    }
    const nextSelectedItemId = nextSelection.at(-1) ?? null;
    if (selectedTimelineItemId !== nextSelectedItemId) {
      setSelectedTimelineItemId(nextSelectedItemId);
    }
  }, [applyTimelineSelection, selectedTimelineItemId, selectedTimelineItemIds, timelineItems]);

  useEffect(() => {
    if (playheadSec <= timelineDurationSec) return;
    setPlayheadSec(timelineDurationSec);
  }, [playheadSec, timelineDurationSec]);

  useEffect(() => {
    setTimelineInPointSec((current) => (current !== null && current > timelineDurationSec ? timelineDurationSec : current));
    setTimelineOutPointSec((current) => (current !== null && current > timelineDurationSec ? timelineDurationSec : current));
  }, [timelineDurationSec]);

  useEffect(() => {
    if (!isTimelinePlaying || timelineDurationSec <= 0 || typeof window === 'undefined') return undefined;
    let previousTimestamp = Date.now();

    const tick = () => {
      const timestamp = Date.now();
      const deltaSec = (timestamp - previousTimestamp) / 1000;
      previousTimestamp = timestamp;
      setPlayheadSec((current) => {
        const nextPlayheadSec = Math.min(timelineDurationSec, current + deltaSec);
        if (nextPlayheadSec >= timelineDurationSec) {
          setIsTimelinePlaying(false);
          return timelineDurationSec;
        }
        return nextPlayheadSec;
      });
    };

    playbackFrameRef.current = window.setInterval(tick, 50);
    return () => {
      if (playbackFrameRef.current !== null) {
        window.clearInterval(playbackFrameRef.current);
        playbackFrameRef.current = null;
      }
    };
  }, [isTimelinePlaying, timelineDurationSec]);

  const patchNodeData = useCallback((nodeId: string, patch: Partial<WorkspaceGraphNode['data']>) => {
    setNodes((current) =>
      current.map((node) => (node.id === nodeId ? { ...node, data: { ...node.data, ...patch } } : node))
    );
  }, []);

  const patchShot = useCallback((nodeId: string, patch: Partial<WorkspaceShotSettings>) => {
    setNodes((current) =>
      current.map((node) => {
        if (node.id !== nodeId || !node.data.shot) return node;
        const nextShot = {
          ...node.data.shot,
          ...patch,
          status: patch.status ?? (node.data.shot.status === 'incompatible' ? 'draft' : node.data.shot.status),
        };
        return {
          ...node,
          data: {
            ...node.data,
            subtitle: patch.outputName ?? node.data.subtitle,
            shot: nextShot,
          },
        };
      })
    );
  }, []);

  const handleOpenAssetLibrary = useCallback((nodeId: string) => {
    setActiveEditorSurface('canvas');
    setSelectedNodeId(nodeId);
    setAssetPickerNodeId(nodeId);
  }, []);

  const handleSelectLibraryAsset = useCallback((nodeId: string, asset: WorkspaceLibraryAsset) => {
    const assetRecord = workspaceAssetRecordFromLibraryAsset(asset);
    setNodes((current) =>
      current.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              data: {
                ...node.data,
                subtitle: asset.name,
                asset: assetRecord,
              },
            }
          : node
      )
    );
    setActiveEditorSurface('canvas');
    setSelectedNodeId(nodeId);
    setAssetPickerNodeId(null);
    setNotice(`${asset.name} attached to the media block.`);
  }, []);

  const onNodesChange = useCallback((changes: NodeChange<WorkspaceGraphNode>[]) => {
    setNodes((current) => applyNodeChanges(changes, current));
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange<WorkspaceGraphEdge>[]) => {
    setEdges((current) => applyEdgeChanges(changes, current));
  }, []);

  const isValidConnection = useCallback(
    (connection: Connection | WorkspaceGraphEdge) => !workspaceConnectionRejectionReason({ connection, nodes, edges, capabilities }),
    [capabilities, edges, nodes]
  );

  const onConnect = useCallback((connection: Connection) => {
    const rejectionReason = workspaceConnectionRejectionReason({ connection, nodes, edges, capabilities });
    if (rejectionReason) {
      setNotice(rejectionReason);
      return;
    }
    if (!connection.source || !connection.target) return;
    const kind = inferWorkspaceEdgeKind(connection.sourceHandle, connection.targetHandle);
    const edge = createWorkspaceEdge({
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle ?? kind,
      targetHandle: connection.targetHandle ?? kind,
      kind,
    });
    setEdges((current) => addEdge(edge, current));
    setNotice(`${edge.data?.label ?? 'Graph'} link connected.`);
  }, [capabilities, edges, nodes]);

  const handleCreateNodeFromHandleDrop = useCallback(
    (request: WorkspaceHandleDropRequest) => {
      const draft = resolveWorkspaceHandleDropDraft(request.handleId, request.handleType);
      if (!draft) {
        setNotice('No matching block is available for this connector.');
        return;
      }
      if (request.handleType === 'target') {
        const rejectionReason = workspaceConnectionRejectionReason({
          connection: {
            source: 'pending-node',
            target: request.sourceNodeId,
            sourceHandle: draft.sourceHandle,
            targetHandle: request.handleId,
          },
          nodes,
          edges,
          capabilities,
        });
        if (rejectionReason) {
          setNotice(rejectionReason);
          return;
        }
      }

      const node = createWorkspaceHandleDropNode({
        draft,
        defaultModelId,
        index: nodes.length,
        position: {
          x: request.position.x - 110,
          y: request.position.y - 48,
        },
      });
      const edge =
        request.handleType === 'target'
          ? createWorkspaceEdge({
              source: node.id,
              target: request.sourceNodeId,
              sourceHandle: draft.sourceHandle,
              targetHandle: request.handleId,
              kind: request.handleId,
            })
          : createWorkspaceEdge({
              source: request.sourceNodeId,
              target: node.id,
              sourceHandle: request.handleId,
              targetHandle: draft.targetHandle,
              kind: request.handleId,
            });

      setNodes((current) => appendSelectedWorkspaceGraphNode(current, node));
      setEdges((current) => addEdge(edge, current));
      setActiveEditorSurface('canvas');
      setSelectedNodeId(node.id);
      setNotice(`${node.data.title} created from the ${edge.data?.label ?? 'connector'} connector.`);
    },
    [capabilities, defaultModelId, edges, nodes]
  );

  const handleCreateNodeFromPaletteDrop = useCallback(
    (request: WorkspacePaletteDropRequest) => {
      const node = createAdHocNode(request.kind, nodes.length, defaultModelId, {
        x: request.position.x - 105,
        y: request.position.y - 48,
      });
      setNodes((current) => appendSelectedWorkspaceGraphNode(current, node));
      setActiveEditorSurface('canvas');
      setSelectedNodeId(node.id);
      setNotice(`${node.data.title} dropped onto the canvas.`);
    },
    [defaultModelId, nodes.length]
  );

  const handleGenerateShot = useCallback(
    async (nodeId: string): Promise<void> => {
      const shotNode = nodes.find((node) => node.id === nodeId);
      if (!shotNode?.data.shot) return;
      const validation = validateShotConnections({
        settings: shotNode.data.shot,
        connectedInputs: connectedInputKinds(nodeId, edges),
        capabilities,
      });
      if (!validation.canGenerate) {
        patchShot(nodeId, { status: 'incompatible' });
        setNotice('This shot has incompatible or missing inputs for the selected model.');
        return;
      }

      const capability = getWorkspaceModelCapability(shotNode.data.shot.modelId, capabilities);
      const existingOutputNode = findGeneratedOutputNodeForShot(nodeId, nodes, edges);
      const pendingOutput = createPendingWorkspaceOutput({
        shotNode,
        settings: shotNode.data.shot,
        capability,
        nodes,
        edges,
        siblingCount: nodes.filter((node) => node.data.output?.sourceShotId === shotNode.id).length,
        outputNodeId: existingOutputNode?.id,
      });
      const pendingOutputNode = existingOutputNode
        ? {
            ...existingOutputNode,
            data: {
              ...existingOutputNode.data,
              title: shotNode.data.shot.outputName || existingOutputNode.data.title,
              subtitle: outputNodeSubtitle(pendingOutput.output),
              output: pendingOutput.output,
            },
          }
        : pendingOutput.outputNode;

      setNodes((current) => {
        const hasOutputNode = current.some((node) => node.id === pendingOutputNode.id);
        const nextNodes = current.map((node) => {
          if (node.id === nodeId && node.data.shot) {
            return {
              ...node,
              data: {
                ...node.data,
                shot: {
                  ...node.data.shot,
                  status: 'generating' as const,
                },
              },
            };
          }
          if (node.id === pendingOutputNode.id) return pendingOutputNode;
          return node;
        });
        return hasOutputNode ? nextNodes : [...nextNodes, pendingOutputNode];
      });
      if (!existingOutputNode) {
        setEdges((current) => addEdge(pendingOutput.outputEdge, current));
      }
      setActiveEditorSurface('canvas');
      setSelectedNodeId(pendingOutputNode.id);
      setNotice(`${shotNode.data.title} generation started${mockMode ? ' in mock mode' : ''}.`);
      try {
        const result = await submitWorkspaceShotGeneration({
          nodes,
          edges,
          shotNodeId: nodeId,
          capability,
          generationMode: mockMode ? 'mock' : 'real',
        });
        setNodes((current) =>
          current.map((node) => {
            if (node.id === nodeId && node.data.shot) {
              const nextShotStatus =
                result.output.status === 'ready'
                  ? 'completed'
                  : result.output.status === 'failed'
                    ? 'failed'
                    : 'generating';
              return {
                ...node,
                data: {
                  ...node.data,
                  shot: {
                    ...node.data.shot,
                    status: nextShotStatus,
                  },
                },
              };
            }
            if (node.id === pendingOutputNode.id) {
              return {
                ...node,
                data: {
                  ...node.data,
                  title: shotNode.data.shot?.outputName || node.data.title,
                  subtitle: outputNodeSubtitle(result.output),
                  output: result.output,
                },
              };
            }
            return node;
          })
        );
        setActiveEditorSurface('canvas');
        setSelectedNodeId(pendingOutputNode.id);
        setNotice(
          result.output.status === 'ready'
            ? `${result.output.modelLabel} output created. Send it to the timeline when ready.`
            : result.output.status === 'failed'
              ? `${result.output.modelLabel} generation failed.`
              : `${result.output.modelLabel} render is still processing. It will be available when the job completes.`
        );
      } catch (error) {
        setNodes((current) =>
          current.map((node) => {
            if (node.id === nodeId && node.data.shot) {
              return {
                ...node,
                data: {
                  ...node.data,
                  shot: {
                    ...node.data.shot,
                    status: 'failed' as const,
                  },
                },
              };
            }
            if (node.id === pendingOutputNode.id && node.data.output) {
              const failedOutput = {
                ...node.data.output,
                status: 'failed' as const,
                thumbUrl: null,
                url: null,
              };
              return {
                ...node,
                data: {
                  ...node.data,
                  subtitle: outputNodeSubtitle(failedOutput),
                  output: failedOutput,
                },
              };
            }
            return node;
          })
        );
        const message = error instanceof Error ? error.message : 'Generation failed.';
        setNotice(message);
      }
    },
    [capabilities, edges, mockMode, nodes, patchShot]
  );

  const handleSendOutputToTimeline = useCallback(
    (nodeId: string) => {
      const mediaNode = nodes.find((node) => node.id === nodeId);
      if (!mediaNode) return;

      const output = mediaNode.data.output;
      const asset = mediaNode.data.asset;
      if (!output && !asset) {
        setNotice('Select a generated output or media block before sending it to the timeline.');
        return;
      }

      if (output && (
        !playableOutputTimelineUrl(output) ||
        output.status === 'placeholder' ||
        output.status === 'processing' ||
        output.status === 'failed'
      )) {
        setNotice('This output is not ready for the timeline yet.');
        return;
      }

      if (asset) {
        const assetUrl = asset.url ?? asset.thumbUrl ?? null;
        const canSendAsset =
          (asset.kind === 'video' && isPlayableVideoUrl(asset.url)) ||
          (asset.kind === 'audio' && isPlayableAudioUrl(asset.url)) ||
          ((asset.kind === 'image' || asset.kind === 'logo') && isPlayableImageUrl(assetUrl));
        if (!canSendAsset) {
          setNotice('Select a playable media file before sending this block to the timeline.');
          return;
        }
      }

      const timelineSeed = Date.now().toString(36);
      const nextItems = output
        ? buildWorkspaceTimelineItemsForOutput({
            outputNodeId: nodeId,
            title: mediaNode.data.title,
            output,
            startSec: playheadSec,
            idSeed: timelineSeed,
          })
        : asset
          ? buildWorkspaceTimelineItemsForAsset({
              assetNodeId: nodeId,
              title: mediaNode.data.title,
              asset,
              startSec: playheadSec,
              idSeed: timelineSeed,
            })
          : [];
      const nextTimelineItemId = nextItems.find((item) => isWorkspaceTimelineVideoTrack(item.track))?.id ?? nextItems[0]?.id ?? null;
      if (!nextItems.length || !nextTimelineItemId) {
        setNotice('This block cannot be placed on the timeline yet.');
        return;
      }
      const targetTrack = nextItems.find((item) => isWorkspaceTimelineVideoTrack(item.track))?.track ?? nextItems[0]?.track ?? 'timeline';
      const nextTimelineItems = insertWorkspaceTimelineItems({
        items: timelineItemsRef.current,
        newItems: nextItems,
        mode: 'insert',
        playheadSec,
        selectedItemId: null,
        idSeed: timelineSeed,
        allowInsertIntoClip: timelineInsertIntoClipEnabled,
      });
      const insertedItem = nextTimelineItems.find((item) => item.id === nextTimelineItemId) ?? null;
      if (!insertedItem) {
        const isBlockedClipInsert = !timelineInsertIntoClipEnabled && timelineTrackHasClipAt(timelineItemsRef.current, targetTrack, playheadSec);
        setNotice(isBlockedClipInsert ? 'Drop on an edit point or enable Insert into clip to splice inside an existing clip.' : 'This block could not be inserted on the timeline.');
        return;
      }
      commitTimelineItems(() => nextTimelineItems);
      setSelectedTimelineItemId(nextTimelineItemId);
      setSelectedTimelineItemIds([nextTimelineItemId]);
      setPlayheadSec(insertedItem.startSec);
      setIsTimelinePlaying(false);
      setNotice(`${mediaNode.data.title} inserted at the playhead on the ${targetTrack} track.`);
    },
    [commitTimelineItems, nodes, playheadSec, timelineInsertIntoClipEnabled]
  );

  const renderNodes = useMemo(() => {
    return nodes.map((node) => {
      if (node.data.kind !== 'shot' || !node.data.shot) {
        return {
          ...node,
          data: {
            ...node.data,
            onPromptChange: (nodeId: string, value: string) => patchNodeData(nodeId, { promptText: value }),
            onOpenAssetLibrary: handleOpenAssetLibrary,
            onSendOutputToTimeline: handleSendOutputToTimeline,
          },
        };
      }
      const validation = validateShotConnections({
        settings: node.data.shot,
        connectedInputs: connectedInputKinds(node.id, edges),
        capabilities,
      });
      const inputCounts = connectedInputCounts(node.id, edges);
      const inputConnectors = getWorkspaceShotInputConnectors(validation.capability).map((connector) => {
        const connectedCount = inputCounts.get(connector.kind) ?? 0;
        const capacity = workspaceConnectionCapacity({ connector, connectedCount });
        return {
          ...connector,
          connectedCount,
          remainingCount: capacity.remainingCount,
          capacityLabel: capacity.capacityLabel,
        };
      });
      return {
        ...node,
        data: {
          ...node.data,
          sourceHandles: [GENERATED_OUTPUT_TARGET_HANDLE],
          targetHandles: getWorkspaceShotTargetHandles(validation.capability),
          inputConnectors,
          validation,
          pricingEstimate: pricingEstimates[node.id],
          onGenerateShot: (nodeId: string): void => {
            void handleGenerateShot(nodeId);
          },
        },
      };
    });
  }, [capabilities, edges, handleGenerateShot, handleOpenAssetLibrary, handleSendOutputToTimeline, nodes, patchNodeData, pricingEstimates]);

  const renderEdges = useMemo(() => filterRenderableWorkspaceEdges(renderNodes, edges), [edges, renderNodes]);
  const selectedNode = renderNodes.find((node) => node.id === selectedNodeId) ?? null;
  const assetPickerNode = renderNodes.find((node) => node.id === assetPickerNodeId) ?? null;
  const assetPickerLibrary = useWorkspaceEditorAssetLibrary(assetPickerNode ? assetPickerNode.data.kind : undefined);

  const handleAddNode = useCallback(
    (kind: WorkspaceNodeKind) => {
      const node = createAdHocNode(kind, nodes.length, defaultModelId);
      setNodes((current) => appendSelectedWorkspaceGraphNode(current, node));
      setActiveEditorSurface('canvas');
      setSelectedNodeId(node.id);
      setNotice(`${node.data.title} added to the canvas.`);
    },
    [defaultModelId, nodes.length]
  );

  const handleApplyTemplate = useCallback((templateId: WorkspaceTemplateId) => {
    const template = createStarterWorkspaceTemplate(templateId);
    setNodes(template.nodes);
    setEdges(template.edges);
    setTimelineItems(template.timelineItems);
    timelineItemsRef.current = template.timelineItems;
    applyTimelineSelection(defaultTimelineSelectionIds(template.timelineItems));
    setPlayheadSec(0);
    setIsTimelinePlaying(false);
    resetTimelineHistory();
    setActiveEditorSurface('canvas');
    setSelectedNodeId(defaultSelectedNodeId(template.nodes, template.id));
    setActiveTemplateId(template.id);
    setAudioTrackCount(audioTrackCountForTimelineItems(template.timelineItems));
    setHiddenVideoTracks([]);
    setLockedTimelineTracks([]);
    setMutedAudioTracks([]);
    setVideoTrackCount(videoTrackCountForTimelineItems(template.timelineItems));
    setTimelineInPointSec(null);
    setTimelineOutPointSec(null);
    setExportRangeMode('sequence');
    setIsExportDialogOpen(false);
    setCanvasRevision((value) => value + 1);
    setNotice(`${template.name} template loaded.`);
  }, [applyTimelineSelection, resetTimelineHistory]);

  const handleMoveTimelineItem = useCallback((itemId: string, direction: -1 | 1) => {
    setActiveEditorSurface('timeline');
    if (timelineSelectionTouchesLockedTrack(timelineItemsRef.current, [itemId], lockedTimelineTracks)) {
      setNotice('Unlock the track before moving clips.');
      return;
    }
    handleSelectTimelineItem(itemId, 'focus');
    commitTimelineItems((current) => moveWorkspaceTimelineItem(current, itemId, direction));
  }, [commitTimelineItems, handleSelectTimelineItem, lockedTimelineTracks]);

  const handleCutTimelineItem = useCallback((itemId: string, splitOffsetSec?: number) => {
    setActiveEditorSurface('timeline');
    if (timelineSelectionTouchesLockedTrack(timelineItemsRef.current, [itemId], lockedTimelineTracks)) {
      setNotice('Unlock the track before cutting clips.');
      return;
    }
    const currentItems = timelineItemsRef.current;
    const currentItem = currentItems.find((item) => item.id === itemId);
    const nextSelectedItemId = currentItem && currentItem.durationSec >= 2
      ? nextAvailableTimelineItemId(`${itemId}-split`, currentItems)
      : itemId;
    applyTimelineSelection([nextSelectedItemId]);
    setIsTimelinePlaying(false);
    commitTimelineItems((current) => splitWorkspaceTimelineItem(current, itemId, splitOffsetSec));
  }, [applyTimelineSelection, commitTimelineItems, lockedTimelineTracks]);

  const handlePositionTimelineItem = useCallback((itemId: string, nextStartSec: number, nextTrack?: WorkspaceTimelineTrack, itemIds?: string[]) => {
    setActiveEditorSurface('timeline');
    const nextSelectedItemIds = itemIds?.length ? uniqueTimelineSelectionIds(itemIds) : [itemId];
    const currentItems = timelineItemsRef.current;
    if ((nextTrack && lockedTimelineTracks.includes(nextTrack)) || timelineSelectionTouchesLockedTrack(currentItems, nextSelectedItemIds, lockedTimelineTracks)) {
      setNotice('Unlock the track before moving clips.');
      setIsTimelinePlaying(false);
      return;
    }
    const nextItems = moveWorkspaceTimelineSelectionWithMode({
      items: currentItems,
      itemIds: nextSelectedItemIds,
      anchorItemId: itemId,
      nextStartSec,
      nextTrack,
      mode: 'insert',
      idSeed: Date.now().toString(36),
      allowInsertIntoClip: timelineInsertIntoClipEnabled,
    });
    const nextAnchorItem = nextItems.find((item) => item.id === itemId);
    setSelectedTimelineItemIds(nextSelectedItemIds);
    setSelectedTimelineItemId(itemId);
    setPlayheadSec(nextAnchorItem?.startSec ?? nextStartSec);
    setIsTimelinePlaying(false);
    commitTimelineItems(() => nextItems);
  }, [commitTimelineItems, lockedTimelineTracks, timelineInsertIntoClipEnabled]);

  const handleDropNodeToTimeline = useCallback((nodeId: string, startSec: number, targetTrack: WorkspaceTimelineTrack) => {
    setActiveEditorSurface('timeline');
    if (lockedTimelineTracks.includes(targetTrack)) {
      setNotice(`Unlock ${workspaceTimelineTrackLabel(targetTrack)} before dropping media on it.`);
      return;
    }
    const mediaNode = nodes.find((node) => node.id === nodeId);
    if (!mediaNode) return;
    const output = mediaNode.data.output;
    const asset = mediaNode.data.asset;
    if (!output && !asset) {
      setNotice('Only ready media blocks can be dropped on the timeline.');
      return;
    }
    if (output && !playableOutputTimelineUrl(output)) {
      setNotice('This generated output is not ready for timeline drop yet.');
      return;
    }

    const timelineSeed = Date.now().toString(36);
    const draftItems = output
      ? buildWorkspaceTimelineItemsForOutput({
          outputNodeId: nodeId,
          title: mediaNode.data.title,
          output,
          startSec,
          idSeed: timelineSeed,
        })
      : asset
        ? buildWorkspaceTimelineItemsForAsset({
            assetNodeId: nodeId,
            title: mediaNode.data.title,
            asset,
            startSec,
            idSeed: timelineSeed,
          })
        : [];
    if (!draftItems.length) {
      setNotice('This block cannot be placed on the timeline yet.');
      return;
    }
    if (!workspaceTimelineItemsCompatibleWithTrack(draftItems, targetTrack)) {
      setNotice(`${mediaNode.data.title} is not compatible with the ${targetTrack} track.`);
      return;
    }

    const nextItems = retargetWorkspaceTimelineItemsForTrack(draftItems, targetTrack);
    const currentItems = timelineItemsRef.current;
    const nextTimelineItems = insertWorkspaceTimelineItems({
      items: currentItems,
      newItems: nextItems,
      mode: 'insert',
      playheadSec: startSec,
      selectedItemId: null,
      idSeed: timelineSeed,
      allowInsertIntoClip: timelineInsertIntoClipEnabled,
    });
    const nextTimelineItemId = nextItems.find((item) => isWorkspaceTimelineVideoTrack(item.track))?.id ?? nextItems[0]?.id ?? null;
    const insertedItem = nextTimelineItemId ? nextTimelineItems.find((item) => item.id === nextTimelineItemId) ?? null : null;
    if (!nextTimelineItemId || !insertedItem) {
      const isBlockedClipInsert = !timelineInsertIntoClipEnabled && timelineTrackHasClipAt(currentItems, targetTrack, startSec);
      setNotice(isBlockedClipInsert ? 'Drop on an edit point or enable Insert into clip to splice inside an existing clip.' : 'This block could not be inserted on the timeline.');
      return;
    }

    commitTimelineItems(() => nextTimelineItems);
    setSelectedTimelineItemId(nextTimelineItemId);
    setSelectedTimelineItemIds([nextTimelineItemId]);
    setPlayheadSec(insertedItem.startSec);
    setIsTimelinePlaying(false);
    setNotice(`${mediaNode.data.title} dropped on ${targetTrack} at ${insertedItem.startSec.toFixed(2)}s.`);
  }, [commitTimelineItems, lockedTimelineTracks, nodes, timelineInsertIntoClipEnabled]);

  const handleInvalidNodeDropToTimeline = useCallback((reason: 'incompatible' | 'locked-track' | 'occupied-clip') => {
    setActiveEditorSurface('timeline');
    setIsTimelinePlaying(false);
    setNotice(
      reason === 'locked-track'
        ? 'Unlock the track before dropping media on it.'
        : reason === 'occupied-clip'
        ? 'Drop on an edit point or enable Insert into clip to splice inside an existing clip.'
        : 'This block is not compatible with that timeline track.'
    );
  }, []);

  const handleAddTimelineVideoTrack = useCallback(() => {
    setVideoTrackCount((current) => Math.min(MAX_TIMELINE_VIDEO_TRACKS, current + 1));
  }, []);

  const handleAddTimelineAudioTrack = useCallback(() => {
    setAudioTrackCount((current) => Math.min(MAX_TIMELINE_AUDIO_TRACKS, current + 1));
  }, []);

  const handleToggleVideoTrackVisibility = useCallback((track: WorkspaceTimelineVideoTrack) => {
    setHiddenVideoTracks((current) => (
      current.includes(track)
        ? current.filter((trackId) => trackId !== track)
        : [...current, track]
    ));
    setIsTimelinePlaying(false);
  }, []);

  const handleToggleAudioTrackMute = useCallback((track: WorkspaceTimelineAudioTrack) => {
    setMutedAudioTracks((current) => (
      current.includes(track)
        ? current.filter((trackId) => trackId !== track)
        : [...current, track]
    ));
    setIsTimelinePlaying(false);
  }, []);

  const handleToggleTimelineTrackLock = useCallback((track: WorkspaceTimelineTrack) => {
    setLockedTimelineTracks((current) => (
      current.includes(track)
        ? current.filter((trackId) => trackId !== track)
        : [...current, track]
    ));
    setIsTimelinePlaying(false);
  }, []);

  const handleDeleteTimelineTrack = useCallback((track: WorkspaceTimelineTrack) => {
    const isVideoTrack = isWorkspaceTimelineVideoTrack(track);
    if (isVideoTrack && videoTrackCount <= 1) return;
    if (!isVideoTrack && audioTrackCount <= MIN_TIMELINE_AUDIO_TRACKS) return;

    const trackLabel = workspaceTimelineTrackLabel(track);
    const hasClips = timelineItemsRef.current.some((item) => item.track === track);
    const confirmed = typeof window === 'undefined' || window.confirm(
      hasClips
        ? `Delete ${trackLabel} and all clips on this track?`
        : `Delete ${trackLabel}?`
    );
    if (!confirmed) return;

    const nextItems = deleteWorkspaceTimelineTrackItems(timelineItemsRef.current, track);
    setActiveEditorSurface('timeline');
    setIsTimelinePlaying(false);
    setHiddenVideoTracks((current) => (
      deleteWorkspaceTimelineTrackIds(current, track)
        .filter((trackId): trackId is WorkspaceTimelineVideoTrack => isWorkspaceTimelineVideoTrack(trackId))
    ));
    setLockedTimelineTracks((current) => deleteWorkspaceTimelineTrackIds(current, track));
    setMutedAudioTracks((current) => (
      deleteWorkspaceTimelineTrackIds(current, track)
        .filter((trackId): trackId is WorkspaceTimelineAudioTrack => isWorkspaceTimelineAudioTrack(trackId))
    ));
    if (isVideoTrack) {
      setVideoTrackCount((current) => Math.max(1, current - 1));
    } else {
      setAudioTrackCount((current) => Math.max(MIN_TIMELINE_AUDIO_TRACKS, current - 1));
    }
    commitTimelineItems(() => nextItems);
    applyTimelineSelection(defaultTimelineSelectionIds(nextItems));
    setNotice(`${trackLabel} deleted.`);
  }, [applyTimelineSelection, audioTrackCount, commitTimelineItems, videoTrackCount]);

  const handleResizeTimelineItem = useCallback((itemId: string, edge: WorkspaceTimelineTrimEdge, nextStartSec: number, nextDurationSec: number, mode: WorkspaceTimelineTrimMode) => {
    setActiveEditorSurface('timeline');
    if (timelineSelectionTouchesLockedTrack(timelineItemsRef.current, [itemId], lockedTimelineTracks)) {
      setNotice('Unlock the track before trimming clips.');
      return;
    }
    applyTimelineSelection([itemId]);
    setPlayheadSec(nextStartSec);
    setIsTimelinePlaying(false);
    commitTimelineItems((current) =>
      resizeWorkspaceTimelineItem({
        items: current,
        itemId,
        edge,
        nextStartSec,
        nextDurationSec,
        mode,
      })
    );
  }, [applyTimelineSelection, commitTimelineItems, lockedTimelineTracks]);

  const handleTimelinePreviewItemsChange = useCallback((items: WorkspaceTimelineItem[] | null, previewSec: number | null) => {
    setTimelinePreview(items && previewSec !== null ? { items, playheadSec: previewSec } : null);
  }, []);

  const handleUnlinkTimelineItems = useCallback((itemIds: string[]) => {
    if (!itemIds.length) return;
    setActiveEditorSurface('timeline');
    if (timelineSelectionTouchesLockedTrack(timelineItemsRef.current, itemIds, lockedTimelineTracks)) {
      setNotice('Unlock the track before unlinking clips.');
      return;
    }
    setIsTimelinePlaying(false);
    commitTimelineItems((current) => unlinkWorkspaceTimelineSelection(current, itemIds));
    applyTimelineSelection(itemIds);
    setNotice('Selected timeline clips unlinked.');
  }, [applyTimelineSelection, commitTimelineItems, lockedTimelineTracks]);

  const handleLinkTimelineItems = useCallback((itemIds: string[]) => {
    if (itemIds.length < 2) return;
    setActiveEditorSurface('timeline');
    if (timelineSelectionTouchesLockedTrack(timelineItemsRef.current, itemIds, lockedTimelineTracks)) {
      setNotice('Unlock the track before linking clips.');
      return;
    }
    setIsTimelinePlaying(false);
    commitTimelineItems((current) => linkWorkspaceTimelineSelection(current, itemIds, `manual-link-${Date.now().toString(36)}`));
    applyTimelineSelection(itemIds);
    setNotice('Selected timeline clips linked.');
  }, [applyTimelineSelection, commitTimelineItems, lockedTimelineTracks]);

  const handlePatchTimelineItem = useCallback((itemId: string, patch: Partial<WorkspaceTimelineItem>) => {
    setActiveEditorSurface('timeline');
    commitTimelineItems((current) => current.map((item) => (item.id === itemId ? { ...item, ...patch } : item)));
  }, [commitTimelineItems]);

  const handleProjectSettingsChange = useCallback((patch: Partial<WorkspaceProjectSettings>) => {
    setProjectSettings((current) => coerceWorkspaceProjectSettings({ ...current, ...patch }));
  }, []);

  const handleOpenProjectSettings = useCallback(() => {
    setIsProjectSettingsOpen(true);
  }, []);

  const handleExportTimelineRender = useCallback(() => {
    const serializedManifest = serializeWorkspaceTimelineRenderManifest(exportManifest);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(RENDER_MANIFEST_STORAGE_KEY, serializedManifest);
    }
    setNotice(workspaceTimelineRenderReadinessLabel(exportManifest));
    if (exportManifest.status === 'blocked') return;

    downloadWorkspaceTextFile('maxvideoai-timeline-render.json', serializedManifest, 'application/json');
  }, [exportManifest]);

  const handleExportTimelineEdl = useCallback(() => {
    const edl = buildWorkspaceTimelineEdl(exportManifest);
    setNotice(
      exportManifest.status === 'blocked'
        ? workspaceTimelineRenderReadinessLabel(exportManifest)
        : `EDL ready for ${exportManifest.exportRange.mode === 'in-out' ? 'In/Out' : 'sequence'} export.`
    );
    if (exportManifest.status === 'blocked') return;
    downloadWorkspaceTextFile('maxvideoai-timeline.edl', edl, 'text/plain');
  }, [exportManifest]);

  const handleOpenExportDialog = useCallback(() => {
    setExportRangeMode(hasValidTimelineInOut ? 'in-out' : 'sequence');
    setIsExportDialogOpen(true);
  }, [hasValidTimelineInOut]);

  const handleDeleteTimelineItem = useCallback((ripple = false) => {
    setActiveEditorSurface('timeline');
    const currentItems = timelineItemsRef.current;
    const selectedItemIds = selectedTimelineItemIds.length
      ? selectedTimelineItemIds
      : selectedTimelineItemId
        ? [selectedTimelineItemId]
        : [];
    if (!selectedItemIds.length) return;
    if (timelineSelectionTouchesLockedTrack(currentItems, selectedItemIds, lockedTimelineTracks)) {
      setNotice('Unlock the track before deleting clips.');
      return;
    }
    const selectedItem = currentItems.find((item) => item.id === selectedItemIds[0]);
    const nextItems = selectedItemIds.reduce(
      (nextTimelineItems, itemId) => deleteWorkspaceTimelineItem(nextTimelineItems, itemId, { ripple }),
      currentItems
    );
    commitTimelineItems(() => nextItems);
    applyTimelineSelection(defaultTimelineSelectionIds(nextItems));
    setPlayheadSec(selectedItem?.startSec ?? 0);
    setIsTimelinePlaying(false);
  }, [applyTimelineSelection, commitTimelineItems, lockedTimelineTracks, selectedTimelineItemId, selectedTimelineItemIds]);

  const handleTimelinePanelHeightChange = useCallback((height: number) => {
    setTimelinePanelHeight(coerceTimelinePanelHeight(height));
  }, []);

  const editorShellStyle = timelinePanelHeight
    ? ({ '--timeline-panel-height': `${timelinePanelHeight}px` } as CSSProperties)
    : undefined;

  return (
    <main
      className={`${styles.editorShell} ${focusMode === 'viewer' ? styles.viewerFocus : ''}`}
      style={editorShellStyle}
      data-active-editor-surface={activeEditorSurface}
    >
      <header className={styles.editorTopbar}>
        <div className={styles.brandCluster}>
          <Image
            src="/assets/branding/logo-mark.svg"
            alt=""
            aria-hidden="true"
            width={28}
            height={28}
            className={styles.brandLogo}
            priority
          />
          <div>
            <p>MaxVideoAI Editor</p>
            <span>Projects / {activeTemplateName} / Workspace</span>
          </div>
        </div>
        <div className={styles.modeSwitch} aria-label="Workspace view">
          <button
            type="button"
            className={focusMode === 'canvas' ? styles.modeActive : ''}
            aria-pressed={focusMode === 'canvas'}
            onClick={() => {
              setFocusMode('canvas');
              setActiveEditorSurface('canvas');
            }}
          >
            <GitBranch size={14} />
            Canvas
          </button>
          <button
            type="button"
            className={focusMode === 'viewer' ? styles.modeActive : ''}
            aria-pressed={focusMode === 'viewer'}
            onClick={() => {
              setFocusMode('viewer');
              setActiveEditorSurface('timeline');
            }}
          >
            <PanelRight size={14} />
            Viewer
          </button>
        </div>
        <div className={styles.topbarActions}>
          <button type="button" className={styles.iconButton} onClick={() => selectedNode?.data.kind === 'shot' && void handleGenerateShot(selectedNode.id)} aria-label="Generate selected shot">
            <Play size={15} />
          </button>
          <button type="button" className={styles.iconButton} aria-label="Share project">
            <Share2 size={15} />
          </button>
          <button
            type="button"
            className={styles.iconButton}
            onClick={handleOpenProjectSettings}
            title="Open project settings"
            aria-haspopup="dialog"
            aria-expanded={isProjectSettingsOpen}
            aria-label="Open project settings"
          >
            <Settings2 size={15} />
          </button>
          <button type="button" className={`${styles.exportButton}`} onClick={handleOpenExportDialog} aria-label="Open export dialog">
            <Download size={15} />
            Export
          </button>
          <button type="button" className={styles.iconButton} onClick={() => setMockMode((value) => !value)} aria-label="Toggle mock generation">
            <Settings size={15} />
            <span>{mockMode ? 'Mock' : 'Live'}</span>
          </button>
        </div>
      </header>

      <div className={styles.noticeBar}>
        <Sparkles size={14} />
        <span>{notice}</span>
        <button type="button" onClick={() => handleApplyTemplate(activeTemplateId)}>
          <RefreshCcw size={13} />
          Reset template
        </button>
      </div>

      <div className={styles.editorBody}>
        <NodeLibrarySidebar
          templates={WORKSPACE_TEMPLATE_SUMMARIES}
          activeTemplateId={activeTemplateId}
          onAddNode={handleAddNode}
          onApplyTemplate={handleApplyTemplate}
        />
        {focusMode === 'canvas' ? (
          <WorkspaceCanvas
            key={`${activeTemplateId}-${canvasRevision}`}
            nodes={renderNodes}
            edges={renderEdges}
            isKeyboardDeleteEnabled={activeEditorSurface === 'canvas'}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            isValidConnection={isValidConnection}
            onCreateNodeFromHandleDrop={handleCreateNodeFromHandleDrop}
            onCreateNodeFromPaletteDrop={handleCreateNodeFromPaletteDrop}
            onCanvasInteraction={handleCanvasInteraction}
            onSelectedNodeChange={handleSelectedCanvasNodeChange}
            onSelectedNodeSync={setSelectedNodeId}
          />
        ) : (
          <WorkspaceVideoViewer
            canGoToNextCut={canGoToNextTimelineCut}
            canGoToPreviousCut={canGoToPreviousTimelineCut}
            inPointSec={timelineInPointSec}
            isPlaying={isTimelinePlaying}
            items={viewerTimelineItems}
            outPointSec={timelineOutPointSec}
            playheadSec={previewPlayheadSec}
            projectSettings={projectSettings}
            selectedItemId={selectedTimelineItemId}
            onClearInOut={handleClearTimelineInOut}
            onGoToNextCut={() => handleGoToTimelineCut(1)}
            onGoToPreviousCut={() => handleGoToTimelineCut(-1)}
            onMarkIn={handleMarkTimelineIn}
            onMarkOut={handleMarkTimelineOut}
            onSelectItem={(itemId) => handleSelectTimelineItem(itemId)}
            onTogglePlayback={handleToggleTimelinePlayback}
          />
        )}
        {focusMode === 'canvas' ? (
          <NodeSettingsPanel
            selectedNode={selectedNode}
            edges={edges}
            capabilities={capabilities}
            onPatchNodeData={patchNodeData}
            onPatchShot={patchShot}
            onGenerateShot={handleGenerateShot}
            onSendOutputToTimeline={handleSendOutputToTimeline}
            onOpenAssetLibrary={handleOpenAssetLibrary}
          />
        ) : (
          <TimelineClipInspector
            selectedItem={selectedTimelineItem}
            projectFps={projectSettings.fps}
            onPatchItem={handlePatchTimelineItem}
          />
        )}
      </div>

      <WorkspaceTimeline
        canRedo={timelineHistory.future.length > 0}
        canUndo={timelineHistory.past.length > 0}
        isShortcutActive={activeEditorSurface === 'timeline'}
        audioTrackCount={audioTrackCount}
        hiddenVideoTracks={hiddenVideoTracks}
        items={timelineItems}
        isInsertIntoClipEnabled={timelineInsertIntoClipEnabled}
        inPointSec={timelineInPointSec}
        lockedTracks={lockedTimelineTracks}
        mutedAudioTracks={mutedAudioTracks}
        maxAudioTrackCount={MAX_TIMELINE_AUDIO_TRACKS}
        maxPanelHeight={MAX_TIMELINE_PANEL_HEIGHT}
        maxVideoTrackCount={MAX_TIMELINE_VIDEO_TRACKS}
        minAudioTrackCount={MIN_TIMELINE_AUDIO_TRACKS}
        minPanelHeight={MIN_TIMELINE_PANEL_HEIGHT}
        selectedItemId={selectedTimelineItemId}
        selectedItemIds={selectedTimelineItemIds}
        outPointSec={timelineOutPointSec}
        panelHeight={timelinePanelHeight}
        videoTrackCount={videoTrackCount}
        playheadSec={playheadSec}
        projectFps={projectSettings.fps}
        onAddAudioTrack={handleAddTimelineAudioTrack}
        onAddVideoTrack={handleAddTimelineVideoTrack}
        onCutItem={handleCutTimelineItem}
        onDeleteItem={handleDeleteTimelineItem}
        onMarkIn={handleMarkTimelineIn}
        onMarkOut={handleMarkTimelineOut}
        onPanelHeightChange={handleTimelinePanelHeightChange}
        onRedo={handleRedoTimeline}
        onInvalidNodeDropToTimeline={handleInvalidNodeDropToTimeline}
        onMoveItem={handleMoveTimelineItem}
        onNodeDropToTimeline={handleDropNodeToTimeline}
        onPlaybackChange={setIsTimelinePlaying}
        onPlayheadChange={setPlayheadSec}
        onPreviewItemsChange={handleTimelinePreviewItemsChange}
        onTogglePlayback={handleToggleTimelinePlayback}
        onPositionItem={handlePositionTimelineItem}
        onResizeItem={handleResizeTimelineItem}
        onSelectItem={handleSelectTimelineItem}
        onSelectItems={handleSelectTimelineItems}
        onInsertIntoClipChange={setTimelineInsertIntoClipEnabled}
        onDeleteTrack={handleDeleteTimelineTrack}
        onLinkItems={handleLinkTimelineItems}
        onToggleAudioTrackMute={handleToggleAudioTrackMute}
        onToggleTrackLock={handleToggleTimelineTrackLock}
        onToggleVideoTrackVisibility={handleToggleVideoTrackVisibility}
        onUnlinkItems={handleUnlinkTimelineItems}
        onUndo={handleUndoTimeline}
      />
      <WorkspaceProjectSettingsDialog
        isOpen={isProjectSettingsOpen}
        projectSettings={projectSettings}
        onOpenChange={setIsProjectSettingsOpen}
        onProjectSettingsChange={handleProjectSettingsChange}
      />
      <WorkspaceExportDialog
        exportRangeMode={exportRangeMode}
        inPointSec={timelineInPointSec}
        isOpen={isExportDialogOpen}
        manifest={exportManifest}
        outPointSec={timelineOutPointSec}
        readinessLabel={exportReadinessLabel}
        sequenceDurationSec={timelineDurationSec}
        onClose={() => setIsExportDialogOpen(false)}
        onExportEdl={handleExportTimelineEdl}
        onPrepareRender={handleExportTimelineRender}
        onRangeModeChange={setExportRangeMode}
      />
      <WorkspaceAssetLibraryModal
        node={assetPickerNode}
        assets={assetPickerLibrary.assets}
        isLoading={assetPickerLibrary.isLoading}
        error={assetPickerLibrary.error}
        usingFallback={assetPickerLibrary.usingFallback}
        source={assetPickerLibrary.source}
        sourceOptions={assetPickerLibrary.sourceOptions}
        sourceLabels={assetPickerLibrary.sourceLabels}
        onClose={() => setAssetPickerNodeId(null)}
        onSelectAsset={handleSelectLibraryAsset}
        onSourceChange={assetPickerLibrary.setSource}
      />
    </main>
  );
}
