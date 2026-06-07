'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addEdge, applyEdgeChanges, applyNodeChanges, type Connection, type EdgeChange, type NodeChange } from '@xyflow/react';
import { Download, GitBranch, PanelRight, Play, RefreshCcw, Settings, Settings2, Share2, Sparkles } from 'lucide-react';
import Image from 'next/image';
import { NodeLibrarySidebar } from './_components/NodeLibrarySidebar';
import { NodeSettingsPanel } from './_components/NodeSettingsPanel';
import { TimelineClipInspector } from './_components/TimelineClipInspector';
import { WorkspaceCanvas, type WorkspaceHandleDropRequest, type WorkspacePaletteDropRequest } from './_components/WorkspaceCanvas.client';
import { WorkspaceAssetLibraryModal } from './_components/WorkspaceAssetLibraryModal';
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
  WorkspaceTimelineTrack,
  WorkspaceTimelineItem,
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
  moveWorkspaceTimelineItem,
  normalizeWorkspaceTimelineIdentities,
  positionWorkspaceTimelineItem,
  positionWorkspaceTimelineItems,
  resizeWorkspaceTimelineItem,
  splitWorkspaceTimelineItem,
  toggleWorkspaceTimelineCrossfade,
  type WorkspaceTimelineInsertMode,
  type WorkspaceTimelineTrimEdge,
  type WorkspaceTimelineTrimMode,
} from './_lib/workspace-timeline-editing';
import {
  buildWorkspaceTimelineRenderManifest,
  serializeWorkspaceTimelineRenderManifest,
  workspaceTimelineRenderReadinessLabel,
} from './_lib/workspace-timeline-render';
import {
  isWorkspaceTimelineVideoTrack,
  workspaceTimelineVideoTrackIndex,
} from './_lib/workspace-timeline-tracks';
import styles from './maxvideoai-editor.module.css';

const STORAGE_KEY = 'maxvideoai.editor.workspace.v1';
const RENDER_MANIFEST_STORAGE_KEY = 'maxvideoai.editor.timelineRender.v1';
const TIMELINE_HISTORY_LIMIT = 50;
const MAX_TIMELINE_VIDEO_TRACKS = 4;
const STALE_EMPTY_DEMO_AUDIO_URL = 'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQIAAAAAAA==';

type PersistedWorkspaceState = {
  nodes: WorkspaceGraphNode[];
  edges: WorkspaceGraphEdge[];
  timelineItems: WorkspaceTimelineItem[];
  activeTemplateId: WorkspaceTemplateId;
  projectSettings: WorkspaceProjectSettings;
  focusMode?: WorkspaceFocusMode;
  videoTrackCount?: number;
};

type TimelineHistoryState = {
  past: WorkspaceTimelineItem[][];
  future: WorkspaceTimelineItem[][];
};

type WorkspaceFocusMode = 'canvas' | 'viewer';

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
    const normalizedItem: WorkspaceTimelineItem = {
      ...item,
      sourceStartSec: item.sourceStartSec ?? 0,
      sourceDurationSec: item.sourceDurationSec ?? item.durationSec,
      mediaKind: item.mediaKind ?? (item.track === 'linked-audio' || item.track === 'music' || item.track === 'voiceover' || item.track === 'sfx' ? 'audio' : 'video'),
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

function coerceVideoTrackCount(value: unknown, items: WorkspaceTimelineItem[]): number {
  const requestedCount = typeof value === 'number' ? value : 1;
  return Math.max(1, Math.min(MAX_TIMELINE_VIDEO_TRACKS, Math.max(requestedCount, videoTrackCountForTimelineItems(items))));
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
    return {
      nodes,
      edges,
      timelineItems,
      activeTemplateId: parsed.activeTemplateId ?? 'product-ad',
      projectSettings: coerceWorkspaceProjectSettings(parsed.projectSettings),
      focusMode: parsed.focusMode === 'viewer' ? 'viewer' : 'canvas',
      videoTrackCount: coerceVideoTrackCount(parsed.videoTrackCount, timelineItems),
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
  const [timelineEditMode, setTimelineEditMode] = useState<WorkspaceTimelineInsertMode>('insert');
  const [timelineTrimMode, setTimelineTrimMode] = useState<WorkspaceTimelineTrimMode>('trim');
  const [videoTrackCount, setVideoTrackCount] = useState(videoTrackCountForTimelineItems(defaultTemplate.timelineItems));
  const [projectSettings, setProjectSettings] = useState<WorkspaceProjectSettings>(DEFAULT_WORKSPACE_PROJECT_SETTINGS);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('shot-03');
  const [activeTemplateId, setActiveTemplateId] = useState<WorkspaceTemplateId>('product-ad');
  const [focusMode, setFocusMode] = useState<WorkspaceFocusMode>('canvas');
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
  const previewPlayheadSec = timelinePreview?.playheadSec ?? playheadSec;
  const selectedTimelineItem = useMemo(
    () => previewTimelineItems.find((item) => item.id === selectedTimelineItemId) ?? null,
    [previewTimelineItems, selectedTimelineItemId]
  );

  const handleToggleTimelinePlayback = useCallback(() => {
    if (timelineDurationSec <= 0) return;
    setIsTimelinePlaying((currentlyPlaying) => {
      if (!currentlyPlaying && playheadSec >= timelineDurationSec) {
        setPlayheadSec(0);
      }
      return !currentlyPlaying;
    });
  }, [playheadSec, timelineDurationSec]);

  const applyTimelineSelection = useCallback((itemIds: string[]) => {
    const nextItemIds = uniqueTimelineSelectionIds(itemIds);
    setSelectedTimelineItemIds(nextItemIds);
    setSelectedTimelineItemId(nextItemIds.at(-1) ?? null);
  }, []);

  const handleSelectTimelineItem = useCallback((itemId: string, mode: 'replace' | 'toggle' | 'focus' = 'replace') => {
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
      setVideoTrackCount(coerceVideoTrackCount(persisted.videoTrackCount, persisted.timelineItems));
      setCanvasRevision((value) => value + 1);
    }
    setHydrated(true);
  }, [applyTimelineSelection, resetTimelineHistory]);

  useEffect(() => {
    if (!hydrated || typeof window === 'undefined') return;
    const state: PersistedWorkspaceState = { nodes, edges, timelineItems, activeTemplateId, projectSettings, focusMode, videoTrackCount };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [activeTemplateId, edges, focusMode, hydrated, nodes, projectSettings, timelineItems, videoTrackCount]);

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
    const nextSelection = currentSelection.length ? currentSelection : defaultTimelineSelectionIds(timelineItems);
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
    (nodeId: string, modeOverride?: WorkspaceTimelineInsertMode) => {
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
      const selectedTimelineItem = selectedTimelineItemId
        ? timelineItemsRef.current.find((item) => item.id === selectedTimelineItemId) ?? null
        : null;
      const requestedMode = modeOverride ?? timelineEditMode;
      const resolvedMode: WorkspaceTimelineInsertMode =
        requestedMode === 'replace' && !selectedTimelineItem ? 'insert' : requestedMode;
      const startSec = resolvedMode === 'replace' && selectedTimelineItem ? selectedTimelineItem.startSec : playheadSec;
      const nextItems = output
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
      const nextTimelineItemId = nextItems.find((item) => isWorkspaceTimelineVideoTrack(item.track))?.id ?? nextItems[0]?.id ?? null;
      if (!nextItems.length || !nextTimelineItemId) {
        setNotice('This block cannot be placed on the timeline yet.');
        return;
      }
      commitTimelineItems((current) => {
        return insertWorkspaceTimelineItems({
          items: current,
          newItems: nextItems,
          mode: resolvedMode,
          playheadSec: resolvedMode === 'replace' ? startSec : playheadSec,
          selectedItemId: selectedTimelineItemId,
          idSeed: timelineSeed,
        });
      });
      setSelectedTimelineItemId(nextTimelineItemId);
      setSelectedTimelineItemIds([nextTimelineItemId]);
      setPlayheadSec(startSec);
      setIsTimelinePlaying(false);
      const targetTrack = nextItems.find((item) => isWorkspaceTimelineVideoTrack(item.track))?.track ?? nextItems[0]?.track ?? 'timeline';
      setNotice(`${mediaNode.data.title} ${resolvedMode === 'replace' ? 'replaced the selected clip' : resolvedMode === 'overwrite' ? 'overwrote the sequence' : 'inserted at the playhead'} on the ${targetTrack} track.`);
    },
    [commitTimelineItems, nodes, playheadSec, selectedTimelineItemId, timelineEditMode]
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
    setSelectedNodeId(defaultSelectedNodeId(template.nodes, template.id));
    setActiveTemplateId(template.id);
    setVideoTrackCount(videoTrackCountForTimelineItems(template.timelineItems));
    setCanvasRevision((value) => value + 1);
    setNotice(`${template.name} template loaded.`);
  }, [applyTimelineSelection, resetTimelineHistory]);

  const handleMoveTimelineItem = useCallback((itemId: string, direction: -1 | 1) => {
    handleSelectTimelineItem(itemId, 'focus');
    commitTimelineItems((current) => moveWorkspaceTimelineItem(current, itemId, direction));
  }, [commitTimelineItems, handleSelectTimelineItem]);

  const handleCutTimelineItem = useCallback((itemId: string, splitOffsetSec?: number) => {
    const currentItems = timelineItemsRef.current;
    const currentItem = currentItems.find((item) => item.id === itemId);
    const nextSelectedItemId = currentItem && currentItem.durationSec >= 2
      ? nextAvailableTimelineItemId(`${itemId}-split`, currentItems)
      : itemId;
    applyTimelineSelection([nextSelectedItemId]);
    setIsTimelinePlaying(false);
    commitTimelineItems((current) => splitWorkspaceTimelineItem(current, itemId, splitOffsetSec));
  }, [applyTimelineSelection, commitTimelineItems]);

  const handlePositionTimelineItem = useCallback((itemId: string, nextStartSec: number, nextTrack?: WorkspaceTimelineTrack, itemIds?: string[]) => {
    const nextSelectedItemIds = itemIds?.length ? uniqueTimelineSelectionIds(itemIds) : [itemId];
    setSelectedTimelineItemIds(nextSelectedItemIds);
    setSelectedTimelineItemId(itemId);
    setPlayheadSec(nextStartSec);
    setIsTimelinePlaying(false);
    commitTimelineItems((current) =>
      nextSelectedItemIds.length > 1
        ? positionWorkspaceTimelineItems(current, nextSelectedItemIds, itemId, nextStartSec, nextTrack)
        : positionWorkspaceTimelineItem(current, itemId, nextStartSec, nextTrack)
    );
  }, [commitTimelineItems]);

  const handleAddTimelineVideoTrack = useCallback(() => {
    setVideoTrackCount((current) => Math.min(MAX_TIMELINE_VIDEO_TRACKS, current + 1));
  }, []);

  const handleResizeTimelineItem = useCallback((itemId: string, edge: WorkspaceTimelineTrimEdge, nextStartSec: number, nextDurationSec: number, mode: WorkspaceTimelineTrimMode) => {
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
  }, [applyTimelineSelection, commitTimelineItems]);

  const handleTimelinePreviewItemsChange = useCallback((items: WorkspaceTimelineItem[] | null, previewSec: number | null) => {
    setTimelinePreview(items && previewSec !== null ? { items, playheadSec: previewSec } : null);
  }, []);

  const handleToggleTimelineCrossfade = useCallback(() => {
    if (!selectedTimelineItemId) return;
    setIsTimelinePlaying(false);
    commitTimelineItems((current) => toggleWorkspaceTimelineCrossfade(current, selectedTimelineItemId, 1));
  }, [commitTimelineItems, selectedTimelineItemId]);

  const handlePatchTimelineItem = useCallback((itemId: string, patch: Partial<WorkspaceTimelineItem>) => {
    commitTimelineItems((current) => current.map((item) => (item.id === itemId ? { ...item, ...patch } : item)));
  }, [commitTimelineItems]);

  const handleProjectSettingsChange = useCallback((patch: Partial<WorkspaceProjectSettings>) => {
    setProjectSettings((current) => coerceWorkspaceProjectSettings({ ...current, ...patch }));
  }, []);

  const handleOpenProjectSettings = useCallback(() => {
    setIsProjectSettingsOpen(true);
  }, []);

  const handleExportTimelineRender = useCallback(() => {
    const manifest = buildWorkspaceTimelineRenderManifest({
      items: timelineItemsRef.current,
      nodes,
      projectName: activeTemplateName,
      projectSettings,
    });
    const serializedManifest = serializeWorkspaceTimelineRenderManifest(manifest);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(RENDER_MANIFEST_STORAGE_KEY, serializedManifest);
    }
    setNotice(workspaceTimelineRenderReadinessLabel(manifest));
    if (manifest.status === 'blocked' || typeof window === 'undefined') return;

    const blob = new Blob([serializedManifest], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const link = window.document.createElement('a');
    link.href = url;
    link.download = 'maxvideoai-timeline-render.json';
    window.document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => window.URL.revokeObjectURL(url), 0);
  }, [activeTemplateName, nodes, projectSettings]);

  const handleDeleteTimelineItem = useCallback((ripple = false) => {
    const currentItems = timelineItemsRef.current;
    const selectedItemIds = selectedTimelineItemIds.length
      ? selectedTimelineItemIds
      : selectedTimelineItemId
        ? [selectedTimelineItemId]
        : [];
    if (!selectedItemIds.length) return;
    const selectedItem = currentItems.find((item) => item.id === selectedItemIds[0]);
    const nextItems = selectedItemIds.reduce(
      (nextTimelineItems, itemId) => deleteWorkspaceTimelineItem(nextTimelineItems, itemId, { ripple }),
      currentItems
    );
    commitTimelineItems(() => nextItems);
    applyTimelineSelection(defaultTimelineSelectionIds(nextItems));
    setPlayheadSec(selectedItem?.startSec ?? 0);
    setIsTimelinePlaying(false);
  }, [applyTimelineSelection, commitTimelineItems, selectedTimelineItemId, selectedTimelineItemIds]);

  return (
    <main className={`${styles.editorShell} ${focusMode === 'viewer' ? styles.viewerFocus : ''}`}>
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
          <button type="button" className={focusMode === 'canvas' ? styles.modeActive : ''} aria-pressed={focusMode === 'canvas'} onClick={() => setFocusMode('canvas')}>
            <GitBranch size={14} />
            Canvas
          </button>
          <button type="button" className={focusMode === 'viewer' ? styles.modeActive : ''} aria-pressed={focusMode === 'viewer'} onClick={() => setFocusMode('viewer')}>
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
          <button type="button" className={`${styles.exportButton}`} onClick={handleExportTimelineRender} aria-label="Export timeline render">
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
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            isValidConnection={isValidConnection}
            onCreateNodeFromHandleDrop={handleCreateNodeFromHandleDrop}
            onCreateNodeFromPaletteDrop={handleCreateNodeFromPaletteDrop}
            onSelectedNodeChange={setSelectedNodeId}
          />
        ) : (
          <WorkspaceVideoViewer
            isPlaying={isTimelinePlaying}
            items={previewTimelineItems}
            playheadSec={previewPlayheadSec}
            projectSettings={projectSettings}
            selectedItemId={selectedTimelineItemId}
            onSelectItem={(itemId) => handleSelectTimelineItem(itemId)}
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
        isPlaying={isTimelinePlaying}
        items={timelineItems}
        maxVideoTrackCount={MAX_TIMELINE_VIDEO_TRACKS}
        selectedItemId={selectedTimelineItemId}
        selectedItemIds={selectedTimelineItemIds}
        videoTrackCount={videoTrackCount}
        playheadSec={playheadSec}
        projectFps={projectSettings.fps}
        onAddVideoTrack={handleAddTimelineVideoTrack}
        onCutItem={handleCutTimelineItem}
        onDeleteItem={handleDeleteTimelineItem}
        onRedo={handleRedoTimeline}
        onMoveItem={handleMoveTimelineItem}
        onPlaybackChange={setIsTimelinePlaying}
        onPlayheadChange={setPlayheadSec}
        onPreviewItemsChange={handleTimelinePreviewItemsChange}
        onTogglePlayback={handleToggleTimelinePlayback}
        onPositionItem={handlePositionTimelineItem}
        onResizeItem={handleResizeTimelineItem}
        onSelectItem={handleSelectTimelineItem}
        onSelectItems={applyTimelineSelection}
        onTimelineEditModeChange={setTimelineEditMode}
        onTimelineTrimModeChange={setTimelineTrimMode}
        onToggleTransition={handleToggleTimelineCrossfade}
        onUndo={handleUndoTimeline}
        timelineEditMode={timelineEditMode}
        timelineTrimMode={timelineTrimMode}
      />
      <WorkspaceProjectSettingsDialog
        isOpen={isProjectSettingsOpen}
        projectSettings={projectSettings}
        onOpenChange={setIsProjectSettingsOpen}
        onProjectSettingsChange={handleProjectSettingsChange}
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
