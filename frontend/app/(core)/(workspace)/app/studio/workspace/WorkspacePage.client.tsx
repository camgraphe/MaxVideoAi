'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { addEdge, applyEdgeChanges, applyNodeChanges, type Connection, type EdgeChange, type NodeChange } from '@xyflow/react';
import { Download, GitBranch, PanelRight, Settings } from 'lucide-react';
import Image from 'next/image';
import { NodeLibrarySidebar } from './_components/NodeLibrarySidebar';
import { NodeSettingsPanel } from './_components/NodeSettingsPanel';
import { TimelineProjectSidebar, type WorkspaceProjectSequenceSummary } from './_components/TimelineProjectSidebar';
import { TimelineClipInspector } from './_components/TimelineClipInspector';
import {
  WorkspaceCanvas,
  type WorkspaceCanvasFileDropRequest,
  type WorkspaceCanvasTextPasteRequest,
  type WorkspaceHandleDropRequest,
  type WorkspacePaletteDropRequest,
} from './_components/WorkspaceCanvas.client';
import { WorkspaceAssetLibraryModal } from './_components/WorkspaceAssetLibraryModal';
import { WorkspaceExportDialog } from './_components/WorkspaceExportDialog';
import { WorkspaceProjectMediaLibraryModal } from './_components/WorkspaceProjectMediaLibraryModal';
import { StudioHeaderSession } from './_components/StudioHeaderSession';
import { WorkspaceTimeline } from './_components/WorkspaceTimeline';
import { WorkspaceVideoViewer, type WorkspaceProgramSnapshotPayload } from './_components/WorkspaceVideoViewer';
import { useExportController } from './_controllers/useExportController';
import { useWorkspaceEditorAssetLibrary } from './_hooks/useWorkspaceEditorAssetLibrary';
import { useWorkspaceShotPricing } from './_hooks/useWorkspaceShotPricing';
import { useWorkspaceTimelineHistory } from './_hooks/useWorkspaceTimelineHistory';
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
  WorkspaceAssetRecord,
  WorkspaceGraphEdge,
  WorkspaceGraphNode,
  WorkspaceInputConnector,
  WorkspaceNodeKind,
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
  createAdHocWorkspaceNode,
  localCanvasImportFallbackName,
  workspaceAssetRecordFromCanvasFile,
  workspaceNodeKindForCanvasFile,
} from './_lib/workspace-canvas-imports';
import {
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
  buildWorkspaceTimelineRenderManifest,
  type WorkspaceTimelineExportQualityPreset,
  type WorkspaceTimelineExportRangeMode,
} from './_lib/workspace-timeline-render';
import {
  isWorkspaceTimelineAudioTrack,
  isWorkspaceTimelineVideoTrack,
  workspaceTimelineTrackLabel,
} from './_lib/workspace-timeline-tracks';
import { formatWorkspaceTimecode } from './_lib/workspace-timecode';
import {
  DEFAULT_WORKSPACE_SEQUENCE_ID,
  DEFAULT_WORKSPACE_SHOT_MODEL_ID,
  MAX_TIMELINE_AUDIO_TRACKS,
  MAX_TIMELINE_PANEL_HEIGHT,
  MAX_TIMELINE_VIDEO_TRACKS,
  MIN_TIMELINE_AUDIO_TRACKS,
  MIN_TIMELINE_PANEL_HEIGHT,
  audioTrackCountForTimelineItems,
  coerceAudioTrackCount,
  coerceTimelinePanelHeight,
  coerceVideoTrackCount,
  createWorkspaceSequenceRecord,
  deleteWorkspaceTimelineTrackIds,
  deleteWorkspaceTimelineTrackItems,
  upsertWorkspaceSequence,
  videoTrackCountForTimelineItems,
  type PersistedWorkspaceState,
  type StudioProjectStorageRecord,
  type WorkspaceEditorSurface,
  type WorkspaceFocusMode,
  type WorkspaceSequenceRecord,
  type WorkspaceUserCanvasTemplate,
} from './_state/workspace-state';
import {
  GENERATED_OUTPUT_TARGET_HANDLE,
  isPlayableAudioUrl,
  isPlayableImageUrl,
  isPlayableVideoUrl,
  playableOutputTimelineUrl,
} from './_state/workspace-normalizers';
import {
  buildWorkspaceSequenceSummaries,
  selectedWorkspaceSequenceInspectorSummary,
  selectedWorkspaceTimelineItem,
  sequenceNameForIndex,
  workspaceTimelineDurationSec,
} from './_state/workspace-selectors';
import {
  readPersistedWorkspaceState,
  readStudioProject,
  readUserCanvasTemplates,
  workspaceStorageKeyForProject,
  writeUserCanvasTemplates,
} from './_state/workspace-persistence';
import {
  deleteUserCanvasTemplateFromApi,
  describeCanvasTemplate,
  normalizePersistedWorkspaceState,
  normalizeUserCanvasTemplate,
  readStudioProjectFromApi,
  readUserCanvasTemplatesFromApi,
  saveStudioProjectToApi,
  saveUserCanvasTemplateToApi,
} from './_state/workspace-api-persistence';
import baseStyles from './maxvideoai-editor.module.css';
import shellStyles from './_styles/shell.module.css';

const styles = { ...baseStyles, ...shellStyles };

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

function cloneWorkspaceJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createLocalStudioId(prefix: string): string {
  if (globalThis.crypto?.randomUUID) return `${prefix}_${globalThis.crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
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

function projectAssetTimelineNodeId(asset: WorkspaceAssetRecord): string {
  const safeId = asset.id.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'asset';
  return `project-asset-${safeId}`;
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

type WorkspacePageProps = {
  projectId?: string;
};

export default function WorkspacePage({ projectId }: WorkspacePageProps) {
  const defaultTemplate = useMemo(() => createStarterWorkspaceTemplate('product-ad'), []);
  const defaultSequence = useMemo(
    () => createWorkspaceSequenceRecord({
      id: DEFAULT_WORKSPACE_SEQUENCE_ID,
      name: sequenceNameForIndex(1),
      timelineItems: defaultTemplate.timelineItems,
      projectSettings: DEFAULT_WORKSPACE_PROJECT_SETTINGS,
    }),
    [defaultTemplate.timelineItems]
  );
  const capabilities = useMemo(() => getWorkspaceModelCapabilities(), []);
  const defaultModelId =
    capabilities.find((capability) => capability.id === DEFAULT_WORKSPACE_SHOT_MODEL_ID)?.id ??
    capabilities[0]?.id ??
    DEFAULT_WORKSPACE_SHOT_MODEL_ID;
  const playbackFrameRef = useRef<number | null>(null);
  const canvasImportSequenceRef = useRef(0);
  const localCanvasObjectUrlsRef = useRef<string[]>([]);
  const timelineItemsRef = useRef<WorkspaceTimelineItem[]>(defaultTemplate.timelineItems);
  const [nodes, setNodes] = useState<WorkspaceGraphNode[]>(defaultTemplate.nodes);
  const [edges, setEdges] = useState<WorkspaceGraphEdge[]>(defaultTemplate.edges);
  const [projectAssets, setProjectAssets] = useState<WorkspaceAssetRecord[]>([]);
  const [sequences, setSequences] = useState<WorkspaceSequenceRecord[]>([defaultSequence]);
  const [activeSequenceId, setActiveSequenceId] = useState(DEFAULT_WORKSPACE_SEQUENCE_ID);
  const [timelineItems, setTimelineItems] = useState<WorkspaceTimelineItem[]>(defaultTemplate.timelineItems);
  const [timelinePreview, setTimelinePreview] = useState<{ items: WorkspaceTimelineItem[]; playheadSec: number } | null>(null);
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
  const [activeUserCanvasTemplateId, setActiveUserCanvasTemplateId] = useState<string | null>(null);
  const [userCanvasTemplates, setUserCanvasTemplates] = useState<WorkspaceUserCanvasTemplate[]>([]);
  const [storedProjectName, setStoredProjectName] = useState<string | null>(null);
  const [focusMode, setFocusMode] = useState<WorkspaceFocusMode>('canvas');
  const [exportRangeMode, setExportRangeMode] = useState<WorkspaceTimelineExportRangeMode>('sequence');
  const [exportQualityPreset, setExportQualityPreset] = useState<WorkspaceTimelineExportQualityPreset>('standard');
  const [inspectedSequenceId, setInspectedSequenceId] = useState<string | null>(null);
  const [mockMode, setMockMode] = useState(process.env.NODE_ENV !== 'production');
  const [notice, setNotice] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [canvasRevision, setCanvasRevision] = useState(0);
  const [assetPickerNodeId, setAssetPickerNodeId] = useState<string | null>(null);
  const [isProjectMediaPickerOpen, setIsProjectMediaPickerOpen] = useState(false);
  const workspaceStorageKey = useMemo(() => workspaceStorageKeyForProject(projectId), [projectId]);
  const activeUserCanvasTemplate = userCanvasTemplates.find((template) => template.id === activeUserCanvasTemplateId) ?? null;
  const activeTemplateName =
    storedProjectName ??
    activeUserCanvasTemplate?.name ??
    WORKSPACE_TEMPLATE_SUMMARIES.find((template) => template.id === activeTemplateId)?.name ??
    'Workspace';
  const pricingEstimates = useWorkspaceShotPricing({ nodes, edges, capabilities });
  const timelineDurationSec = useMemo(() => workspaceTimelineDurationSec(timelineItems), [timelineItems]);
  const liveActiveSequence = useMemo(() => {
    const storedSequence = sequences.find((sequence) => sequence.id === activeSequenceId);
    return createWorkspaceSequenceRecord({
      id: activeSequenceId,
      name: storedSequence?.name ?? sequenceNameForIndex(Math.max(1, sequences.findIndex((sequence) => sequence.id === activeSequenceId) + 1)),
      timelineItems,
      projectSettings,
      audioTrackCount,
      hiddenVideoTracks,
      lockedTimelineTracks,
      mutedAudioTracks,
      videoTrackCount,
      timelinePanelHeight,
      timelineInPointSec,
      timelineOutPointSec,
      createdAt: storedSequence?.createdAt,
      updatedAt: storedSequence?.updatedAt,
    });
  }, [activeSequenceId, audioTrackCount, hiddenVideoTracks, lockedTimelineTracks, mutedAudioTracks, projectSettings, sequences, timelineInPointSec, timelineItems, timelineOutPointSec, timelinePanelHeight, videoTrackCount]);
  const sequenceSummaries = useMemo<WorkspaceProjectSequenceSummary[]>(() => {
    return buildWorkspaceSequenceSummaries({
      sequences: upsertWorkspaceSequence(sequences, liveActiveSequence),
      activeSequenceId,
    });
  }, [activeSequenceId, liveActiveSequence, sequences]);
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
    () => selectedWorkspaceTimelineItem(previewTimelineItems, selectedTimelineItemId),
    [previewTimelineItems, selectedTimelineItemId]
  );
  const selectedSequenceForInspector = useMemo(
    () => selectedWorkspaceSequenceInspectorSummary({ inspectedSequenceId, sequenceSummaries }),
    [inspectedSequenceId, sequenceSummaries]
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
  const {
    activeExportJob,
    closeExportDialog,
    exportEstimate,
    exportQuota,
    exportReadinessLabel,
    exportTimelineEdl,
    exportTimelineRender,
    exportTimelineVideo,
    exportVideoFeedback,
    isExportDialogOpen,
    isExportEstimateLoading,
    isExportVideoStarting,
    openExportDialog,
    resetExportSession,
  } = useExportController({
    manifest: exportManifest,
    qualityPreset: exportQualityPreset,
    onNotice: setNotice,
  });

  useEffect(() => {
    return () => {
      localCanvasObjectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      localCanvasObjectUrlsRef.current = [];
    };
  }, []);

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

  const applyDefaultTimelineSelection = useCallback((items: WorkspaceTimelineItem[]) => {
    applyTimelineSelection(defaultTimelineSelectionIds(items));
  }, [applyTimelineSelection]);

  const stopTimelinePlayback = useCallback(() => {
    setIsTimelinePlaying(false);
  }, []);

  const {
    timelineHistory,
    commitTimelineItems,
    resetTimelineHistory,
    undoTimeline: handleUndoTimeline,
    redoTimeline: handleRedoTimeline,
  } = useWorkspaceTimelineHistory({
    timelineItemsRef,
    setTimelineItems,
    selectDefaultItems: applyDefaultTimelineSelection,
    stopPlayback: stopTimelinePlayback,
  });

  const handleSelectTimelineItem = useCallback((itemId: string, mode: 'replace' | 'toggle' | 'focus' = 'replace') => {
    setActiveEditorSurface('timeline');
    setInspectedSequenceId(null);
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
    if (itemIds.length) setInspectedSequenceId(null);
    applyTimelineSelection(itemIds);
  }, [applyTimelineSelection]);

  const handleInspectSequence = useCallback((sequenceId: string) => {
    setActiveEditorSurface('timeline');
    setInspectedSequenceId(sequenceId);
    applyTimelineSelection([]);
  }, [applyTimelineSelection]);

  const handleClearSequenceInspector = useCallback(() => {
    setInspectedSequenceId(null);
  }, []);

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

  useEffect(() => {
    if (!notice) return undefined;
    const timeoutId = window.setTimeout(() => setNotice(null), 5200);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  const snapshotActiveSequence = useCallback((): WorkspaceSequenceRecord => {
    const storedSequence = sequences.find((sequence) => sequence.id === activeSequenceId);
    return createWorkspaceSequenceRecord({
      id: activeSequenceId,
      name: storedSequence?.name ?? sequenceNameForIndex(Math.max(1, sequences.findIndex((sequence) => sequence.id === activeSequenceId) + 1)),
      timelineItems,
      projectSettings,
      audioTrackCount,
      hiddenVideoTracks,
      lockedTimelineTracks,
      mutedAudioTracks,
      videoTrackCount,
      timelinePanelHeight,
      timelineInPointSec,
      timelineOutPointSec,
      createdAt: storedSequence?.createdAt,
    });
  }, [activeSequenceId, audioTrackCount, hiddenVideoTracks, lockedTimelineTracks, mutedAudioTracks, projectSettings, sequences, timelineInPointSec, timelineItems, timelineOutPointSec, timelinePanelHeight, videoTrackCount]);

  const buildPersistedWorkspaceState = useCallback((): PersistedWorkspaceState => {
    const sequenceSnapshot = snapshotActiveSequence();
    return {
      nodes,
      edges,
      projectAssets,
      timelineItems,
      activeSequenceId,
      sequences: upsertWorkspaceSequence(sequences, sequenceSnapshot),
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
  }, [activeSequenceId, activeTemplateId, audioTrackCount, edges, focusMode, hiddenVideoTracks, lockedTimelineTracks, mutedAudioTracks, nodes, projectAssets, projectSettings, sequences, snapshotActiveSequence, timelineInPointSec, timelineItems, timelineOutPointSec, timelinePanelHeight, videoTrackCount]);

  const applyWorkspaceSequence = useCallback((sequence: WorkspaceSequenceRecord) => {
    const nextItems = normalizeWorkspaceTimelineIdentities(sequence.timelineItems);
    setTimelineItems(nextItems);
    timelineItemsRef.current = nextItems;
    applyTimelineSelection(defaultTimelineSelectionIds(nextItems));
    setPlayheadSec(0);
    setIsTimelinePlaying(false);
    setTimelinePreview(null);
    resetTimelineHistory();
    setProjectSettings(sequence.projectSettings);
    setAudioTrackCount(coerceAudioTrackCount(sequence.audioTrackCount, nextItems));
    setHiddenVideoTracks(sequence.hiddenVideoTracks);
    setLockedTimelineTracks(sequence.lockedTimelineTracks);
    setMutedAudioTracks(sequence.mutedAudioTracks);
    setVideoTrackCount(coerceVideoTrackCount(sequence.videoTrackCount, nextItems));
    setTimelinePanelHeight(sequence.timelinePanelHeight);
    setTimelineInPointSec(sequence.timelineInPointSec);
    setTimelineOutPointSec(sequence.timelineOutPointSec);
    setExportRangeMode('sequence');
  }, [applyTimelineSelection, resetTimelineHistory]);

  useEffect(() => {
    let cancelled = false;

    const applyPersistedWorkspace = (persisted: PersistedWorkspaceState) => {
      if (cancelled) return;
      const persistedActiveSequenceId = persisted.activeSequenceId ?? DEFAULT_WORKSPACE_SEQUENCE_ID;
      const persistedSequences = persisted.sequences?.length
        ? persisted.sequences
        : [createWorkspaceSequenceRecord({
            id: persistedActiveSequenceId,
            name: sequenceNameForIndex(1),
            timelineItems: persisted.timelineItems,
            projectSettings: persisted.projectSettings,
            audioTrackCount: persisted.audioTrackCount,
            hiddenVideoTracks: persisted.hiddenVideoTracks,
            lockedTimelineTracks: persisted.lockedTimelineTracks,
            mutedAudioTracks: persisted.mutedAudioTracks,
            videoTrackCount: persisted.videoTrackCount,
            timelinePanelHeight: persisted.timelinePanelHeight,
            timelineInPointSec: persisted.timelineInPointSec,
            timelineOutPointSec: persisted.timelineOutPointSec,
          })];
      setNodes(persisted.nodes);
      setEdges(persisted.edges);
      setProjectAssets(persisted.projectAssets ?? []);
      setSequences(persistedSequences);
      setActiveSequenceId(persistedActiveSequenceId);
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
    };

    const applyStoredProjectWorkspace = (project: StudioProjectStorageRecord) => {
      if (cancelled) return;
      const template = createStarterWorkspaceTemplate(project.canvasTemplateId ?? 'product-ad');
      const emptyTimelineItems: WorkspaceTimelineItem[] = [];
      const cleanSequence = createWorkspaceSequenceRecord({
        id: DEFAULT_WORKSPACE_SEQUENCE_ID,
        name: sequenceNameForIndex(1),
        timelineItems: emptyTimelineItems,
        projectSettings: coerceWorkspaceProjectSettings(project.settings),
      });
      setNodes(template.nodes);
      setEdges(template.edges);
      setProjectAssets([]);
      setSequences([cleanSequence]);
      setActiveSequenceId(cleanSequence.id);
      setTimelineItems(emptyTimelineItems);
      timelineItemsRef.current = emptyTimelineItems;
      applyTimelineSelection([]);
      setPlayheadSec(0);
      setIsTimelinePlaying(false);
      resetTimelineHistory();
      setActiveTemplateId(template.id);
      setActiveUserCanvasTemplateId(null);
      setProjectSettings(coerceWorkspaceProjectSettings(project.settings));
      setFocusMode('canvas');
      setActiveEditorSurface('canvas');
      setAudioTrackCount(audioTrackCountForTimelineItems(emptyTimelineItems));
      setHiddenVideoTracks([]);
      setLockedTimelineTracks([]);
      setMutedAudioTracks([]);
      setVideoTrackCount(videoTrackCountForTimelineItems(emptyTimelineItems));
      setTimelinePanelHeight(null);
      setTimelineInPointSec(null);
      setTimelineOutPointSec(null);
      setSelectedNodeId(defaultSelectedNodeId(template.nodes, template.id));
      setCanvasRevision((value) => value + 1);
      setNotice(`${project.name} project loaded with a clean sequence.`);
    };

    const localUserTemplates = readUserCanvasTemplates(normalizeUserCanvasTemplate);
    setUserCanvasTemplates(localUserTemplates);
    const templatesController = new AbortController();
    void readUserCanvasTemplatesFromApi(templatesController.signal).then((serverTemplates) => {
      if (cancelled || !serverTemplates) return;
      setUserCanvasTemplates(serverTemplates);
      writeUserCanvasTemplates(serverTemplates);
    });

    const storedProject = readStudioProject(projectId);
    setStoredProjectName(storedProject?.name ?? null);
    const persisted = readPersistedWorkspaceState(workspaceStorageKey, normalizePersistedWorkspaceState);
    if (persisted) {
      applyPersistedWorkspace(persisted);
    } else if (storedProject) {
      applyStoredProjectWorkspace(storedProject);
    }
    setHydrated(true);

    const projectController = new AbortController();
    if (projectId) {
      void readStudioProjectFromApi(projectId, projectController.signal).then((serverProject) => {
        if (cancelled || !serverProject) return;
        setStoredProjectName(serverProject.name);
        const serverPersisted = normalizePersistedWorkspaceState(serverProject.workspaceState);
        if (serverPersisted) {
          applyPersistedWorkspace(serverPersisted);
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(workspaceStorageKey, JSON.stringify(serverPersisted));
          }
          return;
        }
        if (!persisted && !storedProject) {
          applyStoredProjectWorkspace(serverProject);
        }
      });
    }

    return () => {
      cancelled = true;
      templatesController.abort();
      projectController.abort();
    };
  }, [applyTimelineSelection, projectId, resetTimelineHistory, workspaceStorageKey]);

  useEffect(() => {
    if (!hydrated || typeof window === 'undefined') return;
    const state = buildPersistedWorkspaceState();
    window.localStorage.setItem(workspaceStorageKey, JSON.stringify(state));
  }, [buildPersistedWorkspaceState, hydrated, workspaceStorageKey]);

  useEffect(() => {
    if (!hydrated || !projectId || typeof window === 'undefined') return undefined;
    const state = buildPersistedWorkspaceState();
    const controller = new AbortController();
    const saveTimer = window.setTimeout(() => {
      void saveStudioProjectToApi({
        projectId,
        name: activeTemplateName,
        canvasTemplateId: activeTemplateId,
        settings: state.projectSettings,
        workspaceState: state,
        signal: controller.signal,
      });
    }, 900);

    return () => {
      window.clearTimeout(saveTimer);
      controller.abort();
    };
  }, [activeTemplateId, activeTemplateName, buildPersistedWorkspaceState, hydrated, projectId]);

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

  const handleSelectProjectMediaAsset = useCallback((asset: WorkspaceLibraryAsset) => {
    const assetRecord = workspaceAssetRecordFromLibraryAsset(asset);
    setProjectAssets((current) => [
      assetRecord,
      ...current.filter((candidate) => candidate.id !== assetRecord.id),
    ].slice(0, 120));
    setIsProjectMediaPickerOpen(false);
    setNotice(`${asset.name} imported into Project media.`);
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
      const node = createAdHocWorkspaceNode(request.kind, nodes.length, defaultModelId, {
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

  const applyCanvasImportedNodeData = useCallback(
    (params: {
      kind: WorkspaceNodeKind;
      nodeData: Partial<WorkspaceGraphNode['data']>;
      notice: string;
      position: { x: number; y: number };
      targetNodeId: string | null;
    }) => {
      const targetNode = params.targetNodeId
        ? nodes.find((node) => node.id === params.targetNodeId && node.data.kind === params.kind)
        : null;
      if (targetNode) {
        patchNodeData(targetNode.id, params.nodeData);
        setActiveEditorSurface('canvas');
        setSelectedNodeId(targetNode.id);
        setNotice(params.notice);
        return;
      }

      const importIndex = nodes.length + canvasImportSequenceRef.current;
      canvasImportSequenceRef.current += 1;
      const node = createAdHocWorkspaceNode(params.kind, importIndex, defaultModelId, {
        x: params.position.x - 105,
        y: params.position.y - 48,
      });
      const importedNode = {
        ...node,
        data: {
          ...node.data,
          ...params.nodeData,
        },
      };
      setNodes((current) => appendSelectedWorkspaceGraphNode(current, importedNode));
      setActiveEditorSurface('canvas');
      setSelectedNodeId(importedNode.id);
      setNotice(params.notice);
    },
    [defaultModelId, nodes, patchNodeData]
  );

  const handleCanvasTextPaste = useCallback(
    (request: WorkspaceCanvasTextPasteRequest, sourceLabel = 'pasted-text.txt') => {
      const text = request.text.trim();
      if (!text) return;
      applyCanvasImportedNodeData({
        kind: 'text-prompt',
        nodeData: {
          subtitle: sourceLabel,
          promptRole: 'prompt',
          promptText: text,
        },
        notice: request.targetNodeId ? `${sourceLabel} pasted into the prompt block.` : `${sourceLabel} added to the canvas.`,
        position: request.position,
        targetNodeId: request.targetNodeId,
      });
    },
    [applyCanvasImportedNodeData]
  );

  const handleCanvasFileDrop = useCallback(
    (request: WorkspaceCanvasFileDropRequest) => {
      const unsupportedFiles: string[] = [];
      request.files.forEach((file, index) => {
        const kind = workspaceNodeKindForCanvasFile(file);
        const position = {
          x: request.position.x + index * 28,
          y: request.position.y + index * 22,
        };
        const targetNodeId = index === 0 ? request.targetNodeId : null;
        if (!kind) {
          unsupportedFiles.push(file.name || 'Untitled file');
          return;
        }

        if (kind === 'text-prompt') {
          void file
            .text()
            .then((text) => {
              handleCanvasTextPaste(
                {
                  text,
                  position,
                  targetNodeId,
                },
                file.name || localCanvasImportFallbackName(kind)
              );
            })
            .catch(() => {
              setNotice(`Could not read ${file.name || 'the text file'}.`);
            });
          return;
        }

        const idSeed = `${Date.now().toString(36)}-${index}-${canvasImportSequenceRef.current}`;
        const objectUrl = URL.createObjectURL(file);
        localCanvasObjectUrlsRef.current.push(objectUrl);
        const asset = workspaceAssetRecordFromCanvasFile(file, kind, objectUrl, idSeed);
        if (!asset) {
          unsupportedFiles.push(file.name || 'Untitled file');
          return;
        }
        applyCanvasImportedNodeData({
          kind,
          nodeData: {
            subtitle: asset.filename,
            asset,
          },
          notice: targetNodeId ? `${asset.filename} attached to the media block.` : `${asset.filename} added to the canvas.`,
          position,
          targetNodeId,
        });
      });

      if (unsupportedFiles.length) {
        setNotice(`Unsupported file${unsupportedFiles.length > 1 ? 's' : ''}: ${unsupportedFiles.join(', ')}.`);
      }
    },
    [applyCanvasImportedNodeData, handleCanvasTextPaste]
  );

  const handleSendProgramSnapshotToCanvas = useCallback((snapshot: WorkspaceProgramSnapshotPayload) => {
    const snapshotUrl = snapshot.dataUrl ?? snapshot.sourceUrl;
    if (!snapshotUrl) {
      setNotice('No visible program frame is available for a snapshot.');
      return;
    }

    const importIndex = nodes.length + canvasImportSequenceRef.current;
    canvasImportSequenceRef.current += 1;
    const asset: WorkspaceAssetRecord = {
      id: createLocalStudioId('program_snapshot'),
      kind: 'image',
      filename: snapshot.filename,
      subtitle: `Snapshot · ${snapshot.timecode}`,
      url: snapshotUrl,
      thumbUrl: snapshotUrl,
      dimensions: `${snapshot.width}x${snapshot.height}`,
    };
    const node = createAdHocWorkspaceNode('asset-image', importIndex, defaultModelId, {
      x: -260 + (importIndex % 4) * 180,
      y: -170 + Math.floor(importIndex / 4) * 140,
    });
    const snapshotNode: WorkspaceGraphNode = {
      ...node,
      data: {
        ...node.data,
        title: 'Program Snapshot',
        subtitle: asset.filename,
        asset,
      },
    };

    setNodes((current) => appendSelectedWorkspaceGraphNode(current, snapshotNode));
    setFocusMode('canvas');
    setActiveEditorSurface('canvas');
    setSelectedNodeId(snapshotNode.id);
    setNotice(`${asset.filename} sent to the canvas.`);
  }, [defaultModelId, nodes.length]);

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
  const projectMediaLibrary = useWorkspaceEditorAssetLibrary(isProjectMediaPickerOpen ? null : undefined);

  const handleApplyCanvasTemplate = useCallback((templateId: WorkspaceTemplateId) => {
    const template = createStarterWorkspaceTemplate(templateId);
    setNodes(template.nodes);
    setEdges(template.edges);
    setActiveEditorSurface('canvas');
    setSelectedNodeId(defaultSelectedNodeId(template.nodes, template.id));
    setActiveTemplateId(template.id);
    setActiveUserCanvasTemplateId(null);
    setCanvasRevision((value) => value + 1);
    setNotice(`${template.name} canvas template applied.`);
  }, []);

  const updateUserCanvasTemplates = useCallback((updater: (templates: WorkspaceUserCanvasTemplate[]) => WorkspaceUserCanvasTemplate[]) => {
    setUserCanvasTemplates((currentTemplates) => {
      const nextTemplates = updater(currentTemplates);
      writeUserCanvasTemplates(nextTemplates);
      return nextTemplates;
    });
  }, []);

  const handleSaveCanvasTemplate = useCallback((name: string) => {
    const trimmedName = name.trim();
    const templateName = trimmedName || `Canvas template ${userCanvasTemplates.length + 1}`;
    const createdAt = new Date().toISOString();
    const template: WorkspaceUserCanvasTemplate = {
      id: createLocalStudioId('canvas_template'),
      name: templateName,
      description: describeCanvasTemplate(nodes, edges),
      nodes: cloneWorkspaceJson(nodes),
      edges: cloneWorkspaceJson(edges),
      createdAt,
    };
    updateUserCanvasTemplates((templates) => [template, ...templates].slice(0, 24));
    void saveUserCanvasTemplateToApi(template);
    setActiveUserCanvasTemplateId(template.id);
    setActiveEditorSurface('canvas');
    setNotice(`${template.name} saved as a canvas template.`);
  }, [edges, nodes, updateUserCanvasTemplates, userCanvasTemplates.length]);

  const handleApplyUserCanvasTemplate = useCallback((templateId: string) => {
    const template = userCanvasTemplates.find((candidate) => candidate.id === templateId);
    if (!template) {
      setNotice('Canvas template not found.');
      return;
    }
    const nextNodes = cloneWorkspaceJson(template.nodes);
    const nextEdges = cloneWorkspaceJson(template.edges);
    setNodes(nextNodes);
    setEdges(nextEdges);
    setActiveEditorSurface('canvas');
    setSelectedNodeId(defaultSelectedNodeId(nextNodes, activeTemplateId));
    setActiveUserCanvasTemplateId(template.id);
    setCanvasRevision((value) => value + 1);
    setNotice(`${template.name} canvas template applied.`);
  }, [activeTemplateId, userCanvasTemplates]);

  const handleDuplicateUserCanvasTemplate = useCallback((templateId: string) => {
    const template = userCanvasTemplates.find((candidate) => candidate.id === templateId);
    if (!template) return;
    const duplicate: WorkspaceUserCanvasTemplate = {
      ...template,
      id: createLocalStudioId('canvas_template'),
      name: `${template.name} copy`,
      nodes: cloneWorkspaceJson(template.nodes),
      edges: cloneWorkspaceJson(template.edges),
      createdAt: new Date().toISOString(),
    };
    updateUserCanvasTemplates((templates) => [duplicate, ...templates].slice(0, 24));
    void saveUserCanvasTemplateToApi(duplicate);
    setNotice(`${duplicate.name} saved.`);
  }, [updateUserCanvasTemplates, userCanvasTemplates]);

  const handleDeleteUserCanvasTemplate = useCallback((templateId: string) => {
    const template = userCanvasTemplates.find((candidate) => candidate.id === templateId);
    if (!template) return;
    if (typeof window !== 'undefined' && !window.confirm(`Delete "${template.name}"?`)) return;
    updateUserCanvasTemplates((templates) => templates.filter((candidate) => candidate.id !== templateId));
    void deleteUserCanvasTemplateFromApi(templateId);
    if (activeUserCanvasTemplateId === templateId) {
      setActiveUserCanvasTemplateId(null);
    }
    setNotice(`${template.name} deleted.`);
  }, [activeUserCanvasTemplateId, updateUserCanvasTemplates, userCanvasTemplates]);

  const handleImportProjectMedia = useCallback(() => {
    setIsProjectMediaPickerOpen(true);
    setActiveEditorSurface('timeline');
  }, []);

  const insertProjectAssetIntoTimeline = useCallback((assetId: string, startSec: number, targetTrack?: WorkspaceTimelineTrack) => {
    const asset = projectAssets.find((candidate) => candidate.id === assetId);
    if (!asset) {
      setNotice('Project media asset not found.');
      return;
    }

    const assetUrl = asset.url ?? asset.thumbUrl ?? null;
    const canInsertAsset =
      (asset.kind === 'video' && isPlayableVideoUrl(asset.url)) ||
      (asset.kind === 'audio' && isPlayableAudioUrl(asset.url)) ||
      ((asset.kind === 'image' || asset.kind === 'logo') && isPlayableImageUrl(assetUrl));
    if (!canInsertAsset) {
      setNotice(`${asset.filename} is not a playable timeline media asset.`);
      return;
    }
    if (targetTrack && lockedTimelineTracks.includes(targetTrack)) {
      setNotice(`Unlock ${workspaceTimelineTrackLabel(targetTrack)} before dropping media on it.`);
      return;
    }

    const timelineSeed = Date.now().toString(36);
    const draftItems = buildWorkspaceTimelineItemsForAsset({
      assetNodeId: projectAssetTimelineNodeId(asset),
      title: asset.filename,
      asset,
      startSec,
      idSeed: timelineSeed,
    });
    if (!draftItems.length) {
      setNotice(`${asset.filename} cannot be placed on the timeline.`);
      return;
    }
    if (targetTrack && !workspaceTimelineItemsCompatibleWithTrack(draftItems, targetTrack)) {
      setNotice(`${asset.filename} is not compatible with the ${targetTrack} track.`);
      return;
    }

    const nextItems = targetTrack ? retargetWorkspaceTimelineItemsForTrack(draftItems, targetTrack) : draftItems;
    const nextTimelineItemId = nextItems.find((item) => isWorkspaceTimelineVideoTrack(item.track))?.id ?? nextItems[0]?.id ?? null;
    const resolvedTargetTrack = targetTrack ?? nextItems.find((item) => isWorkspaceTimelineVideoTrack(item.track))?.track ?? nextItems[0]?.track ?? null;
    if (!nextTimelineItemId || !resolvedTargetTrack) {
      setNotice(`${asset.filename} cannot be placed on the timeline.`);
      return;
    }
    if (nextItems.some((item) => lockedTimelineTracks.includes(item.track))) {
      setNotice('Unlock the target track before inserting project media.');
      return;
    }

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
    const insertedItem = nextTimelineItems.find((item) => item.id === nextTimelineItemId) ?? null;
    if (!insertedItem) {
      const isBlockedClipInsert = !timelineInsertIntoClipEnabled && timelineTrackHasClipAt(currentItems, resolvedTargetTrack, startSec);
      setNotice(isBlockedClipInsert ? 'Place the playhead on an edit point or enable Insert into clip.' : `${asset.filename} could not be inserted on the timeline.`);
      return;
    }

    commitTimelineItems(() => nextTimelineItems);
    setActiveEditorSurface('timeline');
    setSelectedTimelineItemId(nextTimelineItemId);
    setSelectedTimelineItemIds([nextTimelineItemId]);
    setPlayheadSec(insertedItem.startSec);
    setIsTimelinePlaying(false);
    setNotice(
      targetTrack
        ? `${asset.filename} dropped on ${resolvedTargetTrack} at ${insertedItem.startSec.toFixed(2)}s.`
        : `${asset.filename} inserted at the playhead on the ${resolvedTargetTrack} track.`
    );
  }, [commitTimelineItems, lockedTimelineTracks, projectAssets, timelineInsertIntoClipEnabled]);

  const handleInsertProjectAssetToTimeline = useCallback((assetId: string) => {
    insertProjectAssetIntoTimeline(assetId, playheadSec);
  }, [insertProjectAssetIntoTimeline, playheadSec]);

  const handleDeleteProjectAsset = useCallback((assetId: string) => {
    const asset = projectAssets.find((candidate) => candidate.id === assetId);
    if (!asset) {
      setNotice('Project media asset not found.');
      return;
    }
    if (typeof window !== 'undefined' && !window.confirm(`Delete "${asset.filename}" from Project media? Timeline clips already placed will stay in the edit.`)) return;
    setProjectAssets((current) => current.filter((candidate) => candidate.id !== assetId));
    setNotice(`${asset.filename} removed from Project media.`);
  }, [projectAssets]);

  const handleDeleteGeneratedClip = useCallback((nodeId: string) => {
    const node = nodes.find((candidate) => candidate.id === nodeId);
    if (!node?.data.output) {
      setNotice('Generated clip not found.');
      return;
    }
    if (typeof window !== 'undefined' && !window.confirm(`Delete "${node.data.title}" from Project media? Timeline clips already placed will stay in the edit.`)) return;
    setNodes((current) =>
      current.map((candidate) => {
        if (candidate.id !== nodeId) return candidate;
        return {
          ...candidate,
          data: {
            ...candidate.data,
            output: undefined,
            subtitle: candidate.data.subtitle ?? 'Generated output',
          },
        };
      })
    );
    setNotice(`${node.data.title} removed from Project media.`);
  }, [nodes]);

  const handleCreateProjectMediaFolder = useCallback(() => {
    setNotice('Project media folders are ready in the UI. Backend folder persistence will be wired in the media library pass.');
  }, []);

  const handleDropProjectAssetToTimeline = useCallback((assetId: string, startSec: number, targetTrack: WorkspaceTimelineTrack) => {
    setActiveEditorSurface('timeline');
    insertProjectAssetIntoTimeline(assetId, startSec, targetTrack);
  }, [insertProjectAssetIntoTimeline]);

  const handleSelectSequence = useCallback((sequenceId: string) => {
    if (sequenceId === activeSequenceId) return;
    const targetSequence = sequences.find((sequence) => sequence.id === sequenceId);
    if (!targetSequence) {
      setNotice('Sequence not found.');
      return;
    }
    const currentSequence = snapshotActiveSequence();
    setSequences((current) => upsertWorkspaceSequence(current, currentSequence));
    setActiveSequenceId(targetSequence.id);
    applyWorkspaceSequence(targetSequence);
    applyTimelineSelection([]);
    setActiveEditorSurface('timeline');
    setFocusMode('viewer');
    setNotice(`${targetSequence.name} selected.`);
  }, [activeSequenceId, applyTimelineSelection, applyWorkspaceSequence, sequences, snapshotActiveSequence]);

  const handleCreateSequence = useCallback(() => {
    const currentSequence = snapshotActiveSequence();
    const nextSequence = createWorkspaceSequenceRecord({
      id: createLocalStudioId('sequence'),
      name: sequenceNameForIndex(sequences.length + 1),
      timelineItems: [],
      projectSettings,
    });
    setSequences((current) => upsertWorkspaceSequence(upsertWorkspaceSequence(current, currentSequence), nextSequence));
    setActiveSequenceId(nextSequence.id);
    applyWorkspaceSequence(nextSequence);
    setInspectedSequenceId(nextSequence.id);
    setActiveEditorSurface('timeline');
    setFocusMode('viewer');
    setNotice(`${nextSequence.name} created.`);
  }, [applyWorkspaceSequence, projectSettings, sequences.length, snapshotActiveSequence]);

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

  const handleRenameActiveSequence = useCallback((name: string) => {
    setSequences((current) => upsertWorkspaceSequence(current, {
      ...snapshotActiveSequence(),
      name,
    }));
  }, [snapshotActiveSequence]);

  const handleOpenExportDialog = useCallback(() => {
    setExportRangeMode(hasValidTimelineInOut ? 'in-out' : 'sequence');
    openExportDialog();
  }, [hasValidTimelineInOut, openExportDialog]);

  const handleExitToProjects = useCallback(() => {
    if (typeof window === 'undefined') return;
    const state = buildPersistedWorkspaceState();
    window.localStorage.setItem(workspaceStorageKey, JSON.stringify(state));
    setNotice('Workspace saved. Returning to projects.');

    const navigateToProjects = () => {
      window.location.assign('/app/studio/projects');
    };

    if (!projectId) {
      navigateToProjects();
      return;
    }

    void saveStudioProjectToApi({
      projectId,
      name: activeTemplateName,
      canvasTemplateId: activeTemplateId,
      settings: state.projectSettings,
      workspaceState: state,
    }).finally(navigateToProjects);
  }, [activeTemplateId, activeTemplateName, buildPersistedWorkspaceState, projectId, workspaceStorageKey]);

  const handleExportRangeModeChange = useCallback((mode: WorkspaceTimelineExportRangeMode) => {
    resetExportSession();
    setExportRangeMode(mode);
  }, [resetExportSession]);

  const handleExportQualityPresetChange = useCallback((preset: WorkspaceTimelineExportQualityPreset) => {
    resetExportSession();
    setExportQualityPreset(preset);
  }, [resetExportSession]);

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
      className={`${styles.editorShell} ${focusMode === 'viewer' ? `${baseStyles.viewerFocus} ${shellStyles.viewerFocus}` : ''}`}
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
        <div className={styles.topbarRight}>
          <StudioHeaderSession onExitToProjects={handleExitToProjects} />
          <div className={styles.topbarActions}>
            <button type="button" className={`${styles.exportButton}`} onClick={handleOpenExportDialog} aria-label="Open export dialog">
              <Download size={15} />
              Export
            </button>
            <button type="button" className={styles.iconButton} onClick={() => setMockMode((value) => !value)} aria-label="Toggle mock generation">
              <Settings size={15} />
              <span>{mockMode ? 'Mock' : 'Live'}</span>
            </button>
          </div>
        </div>
      </header>

      {notice ? (
        <div className={styles.editorToast} role="status" aria-live="polite" data-editor-status="true">
          {notice}
        </div>
      ) : null}

      <div className={styles.editorBody}>
        {focusMode === 'canvas' ? (
          <NodeLibrarySidebar
            templates={WORKSPACE_TEMPLATE_SUMMARIES}
            activeTemplateId={activeUserCanvasTemplateId ? null : activeTemplateId}
            userTemplates={userCanvasTemplates}
            activeUserTemplateId={activeUserCanvasTemplateId}
            onApplyTemplate={handleApplyCanvasTemplate}
            onApplyUserTemplate={handleApplyUserCanvasTemplate}
            onDeleteUserTemplate={handleDeleteUserCanvasTemplate}
            onDuplicateUserTemplate={handleDuplicateUserCanvasTemplate}
            onSaveCanvasTemplate={handleSaveCanvasTemplate}
          />
        ) : (
          <TimelineProjectSidebar
            nodes={renderNodes}
            projectAssets={projectAssets}
            projectName={activeTemplateName}
            sequences={sequenceSummaries}
            timelineItems={timelineItems}
            onDeleteGeneratedClip={handleDeleteGeneratedClip}
            onDeleteProjectAsset={handleDeleteProjectAsset}
            onImportMedia={handleImportProjectMedia}
            onInspectSequence={handleInspectSequence}
            onInsertGeneratedClip={handleSendOutputToTimeline}
            onInsertProjectAsset={handleInsertProjectAssetToTimeline}
            onNewFolder={handleCreateProjectMediaFolder}
            onNewSequence={handleCreateSequence}
            onSelectSequence={handleSelectSequence}
            onClearSequenceInspector={handleClearSequenceInspector}
          />
        )}
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
            onCanvasFileDrop={handleCanvasFileDrop}
            onCanvasTextPaste={handleCanvasTextPaste}
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
            onSendSnapshotToCanvas={handleSendProgramSnapshotToCanvas}
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
            selectedSequence={selectedSequenceForInspector}
            projectFps={projectSettings.fps}
            onPatchItem={handlePatchTimelineItem}
            onRenameSequence={handleRenameActiveSequence}
            onSequenceSettingsChange={handleProjectSettingsChange}
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
        onGoToCut={handleGoToTimelineCut}
        onPanelHeightChange={handleTimelinePanelHeightChange}
        onRedo={handleRedoTimeline}
        onInvalidNodeDropToTimeline={handleInvalidNodeDropToTimeline}
        onMoveItem={handleMoveTimelineItem}
        onNodeDropToTimeline={handleDropNodeToTimeline}
        onPlaybackChange={setIsTimelinePlaying}
        onPlayheadChange={setPlayheadSec}
        onProjectAssetDropToTimeline={handleDropProjectAssetToTimeline}
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
      <WorkspaceExportDialog
        activeExportJob={activeExportJob}
        exportEstimate={exportEstimate}
        exportQuota={exportQuota}
        exportRangeMode={exportRangeMode}
        exportQualityPreset={exportQualityPreset}
        exportVideoFeedback={exportVideoFeedback}
        inPointSec={timelineInPointSec}
        isEstimateLoading={isExportEstimateLoading}
        isExportStarting={isExportVideoStarting}
        isOpen={isExportDialogOpen}
        manifest={exportManifest}
        outPointSec={timelineOutPointSec}
        readinessLabel={exportReadinessLabel}
        sequenceDurationSec={timelineDurationSec}
        onClose={closeExportDialog}
        onExportEdl={exportTimelineEdl}
        onExportVideo={exportTimelineVideo}
        onPrepareRender={exportTimelineRender}
        onQualityPresetChange={handleExportQualityPresetChange}
        onRangeModeChange={handleExportRangeModeChange}
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
      <WorkspaceProjectMediaLibraryModal
        isOpen={isProjectMediaPickerOpen}
        assets={projectMediaLibrary.assets}
        isLoading={projectMediaLibrary.isLoading}
        error={projectMediaLibrary.error}
        usingFallback={projectMediaLibrary.usingFallback}
        source={projectMediaLibrary.source}
        sourceOptions={projectMediaLibrary.sourceOptions}
        sourceLabels={projectMediaLibrary.sourceLabels}
        onClose={() => setIsProjectMediaPickerOpen(false)}
        onSelectAsset={handleSelectProjectMediaAsset}
        onSourceChange={projectMediaLibrary.setSource}
      />
    </main>
  );
}
