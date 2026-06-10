'use client';

import { useMemo, useRef, useState } from 'react';
import { WorkspaceEditorLayout } from './_components/WorkspaceEditorLayout';
import { useExportController } from './_controllers/useExportController';
import { useWorkspaceCanvasController } from './_hooks/useWorkspaceCanvasController';
import { useWorkspaceEditorNotice } from './_hooks/useWorkspaceEditorNotice';
import { useWorkspaceExportState } from './_hooks/useWorkspaceExportState';
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
import { useWorkspaceTimelineSelectionSync } from './_hooks/useWorkspaceTimelineSelectionSync';
import { getWorkspaceModelCapabilities } from './_lib/workspace-capabilities';
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
import {
  DEFAULT_WORKSPACE_PROJECT_SETTINGS,
} from './_lib/workspace-project-settings';
import {
  type WorkspaceTimelineExportRangeMode,
} from './_lib/workspace-timeline-render';
import type { WorkspaceTimelineExportQualityPreset } from './_lib/workspace-timeline-export';
import {
  defaultTimelineSelection,
  defaultTimelineSelectionIds,
  workspaceTimelineCutPoints,
} from './_lib/workspace-timeline-selection';
import {
  DEFAULT_WORKSPACE_SEQUENCE_ID,
  DEFAULT_WORKSPACE_SHOT_MODEL_ID,
  audioTrackCountForTimelineItems,
  createWorkspaceSequenceRecord,
  videoTrackCountForTimelineItems,
  type WorkspaceEditorSurface,
  type WorkspaceFocusMode,
  type WorkspaceSequenceRecord,
  type WorkspaceUserCanvasTemplate,
} from './_state/workspace-state';
import {
  sequenceNameForIndex,
  workspaceTimelineDurationSec,
} from './_state/workspace-selectors';
import {
  workspaceStorageKeyForProject,
} from './_state/workspace-persistence';

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
  const { notice, setNotice } = useWorkspaceEditorNotice();
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
  const {
    exportManifest,
    hasValidTimelineInOut,
    selectedSequenceForInspector,
    selectedTimelineItem,
    viewerTimelineItems,
  } = useWorkspaceExportState({
    activeTemplateName,
    exportRangeMode,
    hiddenVideoTracks,
    inspectedSequenceId,
    mutedAudioTracks,
    nodes,
    previewTimelineItems,
    projectSettings,
    selectedTimelineItemId,
    sequenceSummaries,
    timelineInPointSec,
    timelineItems,
    timelineOutPointSec,
  });
  const previewPlayheadSec = timelinePreview?.playheadSec ?? playheadSec;
  const canGoToPreviousTimelineCut = timelineCutPoints.some((cutPointSec) => cutPointSec < previewPlayheadSec - timelineCutToleranceSec);
  const canGoToNextTimelineCut = timelineCutPoints.some((cutPointSec) => cutPointSec > previewPlayheadSec + timelineCutToleranceSec);
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

  useWorkspaceTimelineSelectionSync({
    applyTimelineSelection,
    selectedTimelineItemId,
    selectedTimelineItemIds,
    setIsTimelinePlaying,
    setSelectedTimelineItemId,
    timelineItems,
    timelineItemsRef,
  });

  const {
    handleCreateNodeFromHandleDrop,
    handleCreateNodeFromPaletteDrop,
    handleApplyCanvasTemplate,
    handleApplyUserCanvasTemplate,
    handleCanvasFileDrop,
    handleCanvasTextPaste,
    handleDeleteUserCanvasTemplate,
    handleOpenAssetLibrary,
    handleDropNodeToTimeline,
    handleDuplicateUserCanvasTemplate,
    handleGenerateShot,
    handleInvalidNodeDropToTimeline,
    handleSaveCanvasTemplate,
    handleSelectLibraryAsset,
    handleSendOutputToTimeline,
    handleSendProgramSnapshotToCanvas,
    isValidConnection,
    onConnect,
    onEdgesChange,
    onNodesChange,
    assetPickerLibrary,
    assetPickerNode,
    patchNodeData,
    patchShot,
    projectMediaLibrary,
    renderEdges,
    renderNodes,
    selectedNode,
  } = useWorkspaceCanvasController({
    activeTemplateId,
    activeUserCanvasTemplateId,
    assetPickerNodeId,
    capabilities,
    commitTimelineItems,
    defaultModelId,
    edges,
    isProjectMediaPickerOpen,
    lockedTimelineTracks,
    mockMode,
    nodes,
    playheadSec,
    pricingEstimates,
    selectedNodeId,
    setActiveEditorSurface,
    setActiveTemplateId,
    setActiveUserCanvasTemplateId,
    setAssetPickerNodeId,
    setCanvasRevision,
    setEdges,
    setFocusMode,
    setIsTimelinePlaying,
    setNodes,
    setNotice,
    setPlayheadSec,
    setSelectedNodeId,
    setSelectedTimelineItemId,
    setSelectedTimelineItemIds,
    setUserCanvasTemplates,
    timelineInsertIntoClipEnabled,
    timelineItemsRef,
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

  return (
    <WorkspaceEditorLayout
      activeEditorSurface={activeEditorSurface}
      canvasKey={`${activeTemplateId}-${canvasRevision}`}
      focusMode={focusMode}
      notice={notice}
      timelinePanelHeight={timelinePanelHeight}
      topbarProps={{
        activeTemplateName,
        focusMode,
        mockMode,
        onEditorSurfaceChange: setActiveEditorSurface,
        onExitToProjects: handleExitToProjects,
        onFocusModeChange: setFocusMode,
        onOpenExportDialog: handleOpenExportDialog,
        onToggleMockMode: () => setMockMode((value) => !value),
      }}
      nodeLibraryProps={{
        activeTemplateId: activeUserCanvasTemplateId ? null : activeTemplateId,
        userTemplates: userCanvasTemplates,
        activeUserTemplateId: activeUserCanvasTemplateId,
        onApplyTemplate: handleApplyCanvasTemplate,
        onApplyUserTemplate: handleApplyUserCanvasTemplate,
        onDeleteUserTemplate: handleDeleteUserCanvasTemplate,
        onDuplicateUserTemplate: handleDuplicateUserCanvasTemplate,
        onSaveCanvasTemplate: handleSaveCanvasTemplate,
      }}
      timelineProjectSidebarProps={{
        nodes: renderNodes,
        projectAssets,
        projectName: activeTemplateName,
        sequences: sequenceSummaries,
        timelineItems,
        onDeleteGeneratedClip: handleDeleteGeneratedClip,
        onDeleteProjectAsset: handleDeleteProjectAsset,
        onImportMedia: handleImportProjectMedia,
        onInspectSequence: handleInspectSequence,
        onInsertGeneratedClip: handleSendOutputToTimeline,
        onInsertProjectAsset: handleInsertProjectAssetToTimeline,
        onNewFolder: handleCreateProjectMediaFolder,
        onNewSequence: handleCreateSequence,
        onSelectSequence: handleSelectSequence,
        onClearSequenceInspector: handleClearSequenceInspector,
      }}
      canvasProps={{
        nodes: renderNodes,
        edges: renderEdges,
        isKeyboardDeleteEnabled: activeEditorSurface === 'canvas',
        onNodesChange,
        onEdgesChange,
        onConnect,
        isValidConnection,
        onCreateNodeFromHandleDrop: handleCreateNodeFromHandleDrop,
        onCreateNodeFromPaletteDrop: handleCreateNodeFromPaletteDrop,
        onCanvasFileDrop: handleCanvasFileDrop,
        onCanvasTextPaste: handleCanvasTextPaste,
        onCanvasInteraction: handleCanvasInteraction,
        onSelectedNodeChange: handleSelectedCanvasNodeChange,
        onSelectedNodeSync: setSelectedNodeId,
      }}
      videoViewerProps={{
        canGoToNextCut: canGoToNextTimelineCut,
        canGoToPreviousCut: canGoToPreviousTimelineCut,
        inPointSec: timelineInPointSec,
        isPlaying: isTimelinePlaying,
        items: viewerTimelineItems,
        outPointSec: timelineOutPointSec,
        playheadSec: previewPlayheadSec,
        projectSettings,
        selectedItemId: selectedTimelineItemId,
        onClearInOut: handleClearTimelineInOut,
        onGoToNextCut: () => handleGoToTimelineCut(1),
        onGoToPreviousCut: () => handleGoToTimelineCut(-1),
        onMarkIn: handleMarkTimelineIn,
        onMarkOut: handleMarkTimelineOut,
        onSelectItem: (itemId) => handleSelectTimelineItem(itemId),
        onSendSnapshotToCanvas: handleSendProgramSnapshotToCanvas,
        onTogglePlayback: handleToggleTimelinePlayback,
      }}
      nodeSettingsProps={{
        selectedNode,
        edges,
        capabilities,
        onPatchNodeData: patchNodeData,
        onPatchShot: patchShot,
        onGenerateShot: handleGenerateShot,
        onSendOutputToTimeline: handleSendOutputToTimeline,
        onOpenAssetLibrary: handleOpenAssetLibrary,
      }}
      timelineClipInspectorProps={{
        selectedItem: selectedTimelineItem,
        selectedSequence: selectedSequenceForInspector,
        projectFps: projectSettings.fps,
        onPatchItem: handlePatchTimelineItem,
        onRenameSequence: handleRenameActiveSequence,
        onSequenceSettingsChange: handleProjectSettingsChange,
      }}
      timelineProps={{
        canRedo: timelineHistory.future.length > 0,
        canUndo: timelineHistory.past.length > 0,
        isShortcutActive: activeEditorSurface === 'timeline',
        audioTrackCount,
        hiddenVideoTracks,
        items: timelineItems,
        isInsertIntoClipEnabled: timelineInsertIntoClipEnabled,
        inPointSec: timelineInPointSec,
        lockedTracks: lockedTimelineTracks,
        mutedAudioTracks,
        selectedItemId: selectedTimelineItemId,
        selectedItemIds: selectedTimelineItemIds,
        outPointSec: timelineOutPointSec,
        panelHeight: timelinePanelHeight,
        videoTrackCount,
        playheadSec,
        projectFps: projectSettings.fps,
        onAddAudioTrack: handleAddTimelineAudioTrack,
        onAddVideoTrack: handleAddTimelineVideoTrack,
        onCutItem: handleCutTimelineItem,
        onDeleteItem: handleDeleteTimelineItem,
        onMarkIn: handleMarkTimelineIn,
        onMarkOut: handleMarkTimelineOut,
        onGoToCut: handleGoToTimelineCut,
        onPanelHeightChange: handleTimelinePanelHeightChange,
        onRedo: handleRedoTimeline,
        onInvalidNodeDropToTimeline: handleInvalidNodeDropToTimeline,
        onMoveItem: handleMoveTimelineItem,
        onNodeDropToTimeline: handleDropNodeToTimeline,
        onPlaybackChange: setIsTimelinePlaying,
        onPlayheadChange: setPlayheadSec,
        onProjectAssetDropToTimeline: handleDropProjectAssetToTimeline,
        onPreviewItemsChange: handleTimelinePreviewItemsChange,
        onTogglePlayback: handleToggleTimelinePlayback,
        onPositionItem: handlePositionTimelineItem,
        onResizeItem: handleResizeTimelineItem,
        onSelectItem: handleSelectTimelineItem,
        onSelectItems: handleSelectTimelineItems,
        onInsertIntoClipChange: setTimelineInsertIntoClipEnabled,
        onDeleteTrack: handleDeleteTimelineTrack,
        onLinkItems: handleLinkTimelineItems,
        onToggleAudioTrackMute: handleToggleAudioTrackMute,
        onToggleTrackLock: handleToggleTimelineTrackLock,
        onToggleVideoTrackVisibility: handleToggleVideoTrackVisibility,
        onUnlinkItems: handleUnlinkTimelineItems,
        onUndo: handleUndoTimeline,
      }}
      runtimeModalsProps={{
        activeExportJob,
        assetPickerLibrary,
        assetPickerNode,
        exportEstimate,
        exportQuota,
        exportRangeMode,
        exportQualityPreset,
        exportVideoFeedback,
        inPointSec: timelineInPointSec,
        isExportDialogOpen,
        isExportEstimateLoading,
        isExportVideoStarting,
        isProjectMediaPickerOpen,
        manifest: exportManifest,
        outPointSec: timelineOutPointSec,
        projectMediaLibrary,
        readinessLabel: exportReadinessLabel,
        sequenceDurationSec: timelineDurationSec,
        onAssetPickerClose: () => setAssetPickerNodeId(null),
        onCloseExportDialog: closeExportDialog,
        onExportEdl: exportTimelineEdl,
        onExportVideo: exportTimelineVideo,
        onPrepareRender: exportTimelineRender,
        onProjectMediaPickerClose: () => setIsProjectMediaPickerOpen(false),
        onQualityPresetChange: handleExportQualityPresetChange,
        onRangeModeChange: handleExportRangeModeChange,
        onSelectAsset: handleSelectLibraryAsset,
        onSelectProjectMediaAsset: handleSelectProjectMediaAsset,
      }}
    />
  );
}
