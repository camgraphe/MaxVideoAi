'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { NodeLibrarySidebar } from './_components/NodeLibrarySidebar';
import { NodeSettingsPanel } from './_components/NodeSettingsPanel';
import { TimelineProjectSidebar } from './_components/TimelineProjectSidebar';
import { TimelineClipInspector } from './_components/TimelineClipInspector';
import { WorkspaceCanvas } from './_components/WorkspaceCanvas.client';
import { WorkspaceEditorTopbar } from './_components/WorkspaceEditorTopbar';
import { WorkspaceRuntimeModals } from './_components/WorkspaceRuntimeModals';
import { WorkspaceTimeline } from './_components/WorkspaceTimeline';
import { WorkspaceVideoViewer } from './_components/WorkspaceVideoViewer';
import { useExportController } from './_controllers/useExportController';
import { useWorkspaceCanvasTimelineActions } from './_hooks/useWorkspaceCanvasTimelineActions';
import { useWorkspaceCanvasImportActions } from './_hooks/useWorkspaceCanvasImportActions';
import { useWorkspaceCanvasTemplateActions } from './_hooks/useWorkspaceCanvasTemplateActions';
import { useWorkspaceEditorAssetLibrary } from './_hooks/useWorkspaceEditorAssetLibrary';
import { useWorkspaceGenerationActions } from './_hooks/useWorkspaceGenerationActions';
import { useWorkspaceGraphActions } from './_hooks/useWorkspaceGraphActions';
import { useWorkspacePersistenceEffects } from './_hooks/useWorkspacePersistenceEffects';
import { useWorkspaceProjectMediaActions } from './_hooks/useWorkspaceProjectMediaActions';
import { useWorkspaceSelectionActions } from './_hooks/useWorkspaceSelectionActions';
import { useWorkspaceSequenceActions } from './_hooks/useWorkspaceSequenceActions';
import { useWorkspaceSequenceSnapshots } from './_hooks/useWorkspaceSequenceSnapshots';
import { useWorkspaceShellActions } from './_hooks/useWorkspaceShellActions';
import { useWorkspaceShotPricing } from './_hooks/useWorkspaceShotPricing';
import { useWorkspaceTimelineClipActions } from './_hooks/useWorkspaceTimelineClipActions';
import { useWorkspaceTimelineHistory } from './_hooks/useWorkspaceTimelineHistory';
import { useWorkspaceTimelineTrackActions } from './_hooks/useWorkspaceTimelineTrackActions';
import { useWorkspaceTimelinePlayback } from './_hooks/useWorkspaceTimelinePlayback';
import {
  getWorkspaceModelCapabilities,
  getWorkspaceShotInputConnectors,
  getWorkspaceShotTargetHandles,
  validateShotConnections,
  workspaceConnectionCapacity,
} from './_lib/workspace-capabilities';
import {
  connectedInputCounts,
  connectedInputKinds,
} from './_lib/workspace-graph-helpers';
import type {
  WorkspaceAssetRecord,
  WorkspaceGraphEdge,
  WorkspaceGraphNode,
  WorkspaceProjectSettings,
  WorkspaceTemplateId,
  WorkspaceTimelineItem,
  WorkspaceTimelineAudioTrack,
  WorkspaceTimelineTrack,
  WorkspaceTimelineVideoTrack,
} from './_lib/workspace-types';
import {
  WORKSPACE_TEMPLATE_SUMMARIES,
  createStarterWorkspaceTemplate,
} from './_lib/workspace-templates';
import { filterRenderableWorkspaceEdges } from './_lib/workspace-render-edges';
import {
  DEFAULT_WORKSPACE_PROJECT_SETTINGS,
} from './_lib/workspace-project-settings';
import {
  buildWorkspaceTimelineRenderManifest,
  type WorkspaceTimelineExportQualityPreset,
  type WorkspaceTimelineExportRangeMode,
} from './_lib/workspace-timeline-render';
import {
  defaultTimelineSelection,
  defaultTimelineSelectionIds,
  filterHiddenVideoTrackItems,
  muteAudioTrackItems,
  workspaceTimelineCutPoints,
} from './_lib/workspace-timeline-selection';
import {
  DEFAULT_WORKSPACE_SEQUENCE_ID,
  DEFAULT_WORKSPACE_SHOT_MODEL_ID,
  MAX_TIMELINE_AUDIO_TRACKS,
  MAX_TIMELINE_PANEL_HEIGHT,
  MAX_TIMELINE_VIDEO_TRACKS,
  MIN_TIMELINE_AUDIO_TRACKS,
  MIN_TIMELINE_PANEL_HEIGHT,
  audioTrackCountForTimelineItems,
  createWorkspaceSequenceRecord,
  videoTrackCountForTimelineItems,
  type WorkspaceEditorSurface,
  type WorkspaceFocusMode,
  type WorkspaceSequenceRecord,
  type WorkspaceUserCanvasTemplate,
} from './_state/workspace-state';
import { GENERATED_OUTPUT_TARGET_HANDLE } from './_state/workspace-normalizers';
import {
  selectedWorkspaceSequenceInspectorSummary,
  selectedWorkspaceTimelineItem,
  sequenceNameForIndex,
  workspaceTimelineDurationSec,
} from './_state/workspace-selectors';
import {
  workspaceStorageKeyForProject,
} from './_state/workspace-persistence';
import baseStyles from './maxvideoai-editor.module.css';
import shellStyles from './_styles/shell.module.css';

const styles = { ...baseStyles, ...shellStyles };

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
  const [timelineInsertIntoClipEnabled, setTimelineInsertIntoClipEnabled] = useState(false);
  const [audioTrackCount, setAudioTrackCount] = useState(audioTrackCountForTimelineItems(defaultTemplate.timelineItems));
  const [hiddenVideoTracks, setHiddenVideoTracks] = useState<WorkspaceTimelineVideoTrack[]>([]);
  const [lockedTimelineTracks, setLockedTimelineTracks] = useState<WorkspaceTimelineTrack[]>([]);
  const [mutedAudioTracks, setMutedAudioTracks] = useState<WorkspaceTimelineAudioTrack[]>([]);
  const [videoTrackCount, setVideoTrackCount] = useState(videoTrackCountForTimelineItems(defaultTemplate.timelineItems));
  const [timelinePanelHeight, setTimelinePanelHeight] = useState<number | null>(null);
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
  const previewTimelineItems = timelinePreview?.items ?? timelineItems;
  const timelineCutPoints = useMemo(() => workspaceTimelineCutPoints(previewTimelineItems), [previewTimelineItems]);
  const {
    applyDefaultTimelineSelection,
    applyTimelineSelection,
    handleCanvasInteraction,
    handleClearSequenceInspector,
    handleInspectSequence,
    handleResetExportRangeMode,
    handleSelectTimelineItem,
    handleSelectTimelineItems,
    handleSelectedCanvasNodeChange,
  } = useWorkspaceSelectionActions({
    setActiveEditorSurface,
    setExportRangeMode,
    setInspectedSequenceId,
    setSelectedNodeId,
    setSelectedTimelineItemId,
    setSelectedTimelineItemIds,
    timelineItemsRef,
  });
  const {
    handleClearTimelineInOut,
    handleGoToTimelineCut,
    handleMarkTimelineIn,
    handleMarkTimelineOut,
    handleToggleTimelinePlayback,
    isTimelinePlaying,
    playheadSec,
    setIsTimelinePlaying,
    setPlayheadSec,
    setTimelineInPointSec,
    setTimelineOutPointSec,
    stopTimelinePlayback,
    timelineCutToleranceSec,
    timelineInPointSec,
    timelineOutPointSec,
  } = useWorkspaceTimelinePlayback({
    onNotice: setNotice,
    onResetExportRangeMode: handleResetExportRangeMode,
    projectFps: projectSettings.fps,
    timelineCutPoints,
    timelineDurationSec,
  });
  const {
    buildPersistedWorkspaceState,
    sequenceSummaries,
    snapshotActiveSequence,
  } = useWorkspaceSequenceSnapshots({
    activeSequenceId,
    activeTemplateId,
    audioTrackCount,
    edges,
    focusMode,
    hiddenVideoTracks,
    lockedTimelineTracks,
    mutedAudioTracks,
    nodes,
    projectAssets,
    projectSettings,
    sequences,
    timelineInPointSec,
    timelineItems,
    timelineOutPointSec,
    timelinePanelHeight,
    videoTrackCount,
  });
  const viewerTimelineItems = useMemo(
    () => muteAudioTrackItems(filterHiddenVideoTrackItems(previewTimelineItems, hiddenVideoTracks), mutedAudioTracks),
    [hiddenVideoTracks, mutedAudioTracks, previewTimelineItems]
  );
  const previewPlayheadSec = timelinePreview?.playheadSec ?? playheadSec;
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

  useEffect(() => {
    timelineItemsRef.current = timelineItems;
  }, [timelineItems]);

  useEffect(() => {
    if (!notice) return undefined;
    const timeoutId = window.setTimeout(() => setNotice(null), 5200);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  const {
    handleCreateSequence,
    handleRenameActiveSequence,
    handleSelectSequence,
  } = useWorkspaceSequenceActions({
    activeSequenceId,
    applyTimelineSelection,
    projectSettings,
    resetTimelineHistory,
    sequences,
    setActiveEditorSurface,
    setActiveSequenceId,
    setAudioTrackCount,
    setExportRangeMode,
    setFocusMode,
    setHiddenVideoTracks,
    setInspectedSequenceId,
    setIsTimelinePlaying,
    setLockedTimelineTracks,
    setMutedAudioTracks,
    setNotice,
    setPlayheadSec,
    setProjectSettings,
    setSequences,
    setTimelineInPointSec,
    setTimelineItems,
    setTimelineOutPointSec,
    setTimelinePanelHeight,
    setTimelinePreview,
    setVideoTrackCount,
    snapshotActiveSequence,
    timelineItemsRef,
  });

  useWorkspacePersistenceEffects({
    activeTemplateId,
    activeTemplateName,
    applyTimelineSelection,
    buildPersistedWorkspaceState,
    hydrated,
    projectId,
    resetTimelineHistory,
    setActiveEditorSurface,
    setActiveSequenceId,
    setActiveTemplateId,
    setActiveUserCanvasTemplateId,
    setAudioTrackCount,
    setCanvasRevision,
    setEdges,
    setFocusMode,
    setHiddenVideoTracks,
    setHydrated,
    setIsTimelinePlaying,
    setLockedTimelineTracks,
    setMutedAudioTracks,
    setNodes,
    setNotice,
    setPlayheadSec,
    setProjectAssets,
    setProjectSettings,
    setSelectedNodeId,
    setSequences,
    setStoredProjectName,
    setTimelineInPointSec,
    setTimelineItems,
    setTimelineOutPointSec,
    setTimelinePanelHeight,
    setUserCanvasTemplates,
    setVideoTrackCount,
    timelineItemsRef,
    workspaceStorageKey,
  });

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
  }, [applyTimelineSelection, selectedTimelineItemId, selectedTimelineItemIds, setIsTimelinePlaying, timelineItems]);

  const {
    handleCreateNodeFromHandleDrop,
    handleCreateNodeFromPaletteDrop,
    handleOpenAssetLibrary,
    handleSelectLibraryAsset,
    isValidConnection,
    onConnect,
    onEdgesChange,
    onNodesChange,
    patchNodeData,
    patchShot,
  } = useWorkspaceGraphActions({
    capabilities,
    defaultModelId,
    edges,
    nodes,
    setActiveEditorSurface,
    setAssetPickerNodeId,
    setEdges,
    setNodes,
    setNotice,
    setSelectedNodeId,
  });

  const {
    handleCanvasFileDrop,
    handleCanvasTextPaste,
    handleSendProgramSnapshotToCanvas,
  } = useWorkspaceCanvasImportActions({
    defaultModelId,
    nodes,
    patchNodeData,
    setActiveEditorSurface,
    setFocusMode,
    setNodes,
    setNotice,
    setSelectedNodeId,
  });

  const { handleGenerateShot } = useWorkspaceGenerationActions({
    capabilities,
    edges,
    mockMode,
    nodes,
    patchShot,
    setActiveEditorSurface,
    setEdges,
    setNodes,
    setNotice,
    setSelectedNodeId,
  });

  const {
    handleDropNodeToTimeline,
    handleInvalidNodeDropToTimeline,
    handleSendOutputToTimeline,
  } = useWorkspaceCanvasTimelineActions({
    commitTimelineItems,
    lockedTimelineTracks,
    nodes,
    playheadSec,
    setActiveEditorSurface,
    setIsTimelinePlaying,
    setNotice,
    setPlayheadSec,
    setSelectedTimelineItemId,
    setSelectedTimelineItemIds,
    timelineInsertIntoClipEnabled,
    timelineItemsRef,
  });

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

  const {
    handleApplyCanvasTemplate,
    handleApplyUserCanvasTemplate,
    handleDeleteUserCanvasTemplate,
    handleDuplicateUserCanvasTemplate,
    handleSaveCanvasTemplate,
  } = useWorkspaceCanvasTemplateActions({
    activeTemplateId,
    activeUserCanvasTemplateId,
    edges,
    nodes,
    setActiveEditorSurface,
    setActiveTemplateId,
    setActiveUserCanvasTemplateId,
    setCanvasRevision,
    setEdges,
    setNodes,
    setNotice,
    setSelectedNodeId,
    setUserCanvasTemplates,
    userCanvasTemplates,
  });

  const {
    handleCreateProjectMediaFolder,
    handleDeleteGeneratedClip,
    handleDeleteProjectAsset,
    handleDropProjectAssetToTimeline,
    handleImportProjectMedia,
    handleInsertProjectAssetToTimeline,
    handleSelectProjectMediaAsset,
  } = useWorkspaceProjectMediaActions({
    commitTimelineItems,
    lockedTimelineTracks,
    nodes,
    playheadSec,
    projectAssets,
    setActiveEditorSurface,
    setIsProjectMediaPickerOpen,
    setIsTimelinePlaying,
    setNodes,
    setNotice,
    setPlayheadSec,
    setProjectAssets,
    setSelectedTimelineItemId,
    setSelectedTimelineItemIds,
    timelineInsertIntoClipEnabled,
    timelineItemsRef,
  });

  const {
    handleCutTimelineItem,
    handleDeleteTimelineItem,
    handleLinkTimelineItems,
    handleMoveTimelineItem,
    handlePatchTimelineItem,
    handlePositionTimelineItem,
    handleResizeTimelineItem,
    handleTimelinePreviewItemsChange,
    handleUnlinkTimelineItems,
  } = useWorkspaceTimelineClipActions({
    applyTimelineSelection,
    commitTimelineItems,
    handleSelectTimelineItem,
    lockedTimelineTracks,
    selectedTimelineItemId,
    selectedTimelineItemIds,
    setActiveEditorSurface,
    setIsTimelinePlaying,
    setNotice,
    setPlayheadSec,
    setSelectedTimelineItemId,
    setSelectedTimelineItemIds,
    setTimelinePreview,
    timelineInsertIntoClipEnabled,
    timelineItemsRef,
  });

  const {
    handleAddTimelineAudioTrack,
    handleAddTimelineVideoTrack,
    handleDeleteTimelineTrack,
    handleToggleAudioTrackMute,
    handleToggleTimelineTrackLock,
    handleToggleVideoTrackVisibility,
  } = useWorkspaceTimelineTrackActions({
    applyTimelineSelection,
    audioTrackCount,
    commitTimelineItems,
    setActiveEditorSurface,
    setAudioTrackCount,
    setHiddenVideoTracks,
    setIsTimelinePlaying,
    setLockedTimelineTracks,
    setMutedAudioTracks,
    setNotice,
    setVideoTrackCount,
    timelineItemsRef,
    videoTrackCount,
  });

  const {
    handleExitToProjects,
    handleExportQualityPresetChange,
    handleExportRangeModeChange,
    handleOpenExportDialog,
    handleProjectSettingsChange,
    handleTimelinePanelHeightChange,
  } = useWorkspaceShellActions({
    activeTemplateId,
    activeTemplateName,
    buildPersistedWorkspaceState,
    hasValidTimelineInOut,
    openExportDialog,
    projectId,
    resetExportSession,
    setExportQualityPreset,
    setExportRangeMode,
    setNotice,
    setProjectSettings,
    setTimelinePanelHeight,
    workspaceStorageKey,
  });

  const editorShellStyle = timelinePanelHeight
    ? ({ '--timeline-panel-height': `${timelinePanelHeight}px` } as CSSProperties)
    : undefined;

  return (
    <main
      className={`${styles.editorShell} ${focusMode === 'viewer' ? `${baseStyles.viewerFocus} ${shellStyles.viewerFocus}` : ''}`}
      style={editorShellStyle}
      data-active-editor-surface={activeEditorSurface}
    >
      <WorkspaceEditorTopbar
        activeTemplateName={activeTemplateName}
        focusMode={focusMode}
        mockMode={mockMode}
        onEditorSurfaceChange={setActiveEditorSurface}
        onExitToProjects={handleExitToProjects}
        onFocusModeChange={setFocusMode}
        onOpenExportDialog={handleOpenExportDialog}
        onToggleMockMode={() => setMockMode((value) => !value)}
      />

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
      <WorkspaceRuntimeModals
        activeExportJob={activeExportJob}
        assetPickerLibrary={assetPickerLibrary}
        assetPickerNode={assetPickerNode}
        exportEstimate={exportEstimate}
        exportQuota={exportQuota}
        exportRangeMode={exportRangeMode}
        exportQualityPreset={exportQualityPreset}
        exportVideoFeedback={exportVideoFeedback}
        inPointSec={timelineInPointSec}
        isExportDialogOpen={isExportDialogOpen}
        isExportEstimateLoading={isExportEstimateLoading}
        isExportVideoStarting={isExportVideoStarting}
        isProjectMediaPickerOpen={isProjectMediaPickerOpen}
        manifest={exportManifest}
        outPointSec={timelineOutPointSec}
        projectMediaLibrary={projectMediaLibrary}
        readinessLabel={exportReadinessLabel}
        sequenceDurationSec={timelineDurationSec}
        onAssetPickerClose={() => setAssetPickerNodeId(null)}
        onCloseExportDialog={closeExportDialog}
        onExportEdl={exportTimelineEdl}
        onExportVideo={exportTimelineVideo}
        onPrepareRender={exportTimelineRender}
        onProjectMediaPickerClose={() => setIsProjectMediaPickerOpen(false)}
        onQualityPresetChange={handleExportQualityPresetChange}
        onRangeModeChange={handleExportRangeModeChange}
        onSelectAsset={handleSelectLibraryAsset}
        onSelectProjectMediaAsset={handleSelectProjectMediaAsset}
      />
    </main>
  );
}
