'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { useStudioThemeMode } from '../_hooks/useStudioThemeMode';
import { resolveStudioCopy } from '../_lib/studio-copy';
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
  WorkspaceProjectMediaFolder,
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
import {
  workspaceProjectAssetFromCompletedTimelineExport,
  type WorkspaceTimelineExportQualityPreset,
} from './_lib/workspace-timeline-export';
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
  const { dictionary } = useI18n();
  const studioCopy = useMemo(() => resolveStudioCopy(dictionary), [dictionary]);
  const studioTheme = useStudioThemeMode();
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
  const [projectMediaFolders, setProjectMediaFolders] = useState<WorkspaceProjectMediaFolder[]>([]);
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
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isCanvasInspectorOpen, setIsCanvasInspectorOpen] = useState(false);
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
  const registeredExportAssetJobIdRef = useRef<string | null>(null);
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
  const selectionActions = useWorkspaceSelectionActions({
    setActiveEditorSurface,
    setExportRangeMode,
    setIsCanvasInspectorOpen,
    setInspectedSequenceId,
    setSelectedNodeId,
    setSelectedTimelineItemId,
    setSelectedTimelineItemIds,
    timelineItemsRef,
  });
  const timelinePlayback = useWorkspaceTimelinePlayback({
    onNotice: setNotice,
    onResetExportRangeMode: selectionActions.handleResetExportRangeMode,
    projectFps: projectSettings.fps,
    timelineCutPoints,
    timelineDurationSec,
  });
  const sequenceSnapshots = useWorkspaceSequenceSnapshots({
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
    projectMediaFolders,
    projectSettings,
    sequences,
    timelineInPointSec: timelinePlayback.timelineInPointSec,
    timelineItems,
    timelineOutPointSec: timelinePlayback.timelineOutPointSec,
    timelinePanelHeight,
    videoTrackCount,
  });
  const exportState = useWorkspaceExportState({
    activeSequenceId,
    activeTemplateName,
    exportRangeMode,
    hiddenVideoTracks,
    inspectedSequenceId,
    mutedAudioTracks,
    nodes,
    previewTimelineItems,
    projectSettings,
    selectedTimelineItemId,
    sequenceSummaries: sequenceSnapshots.sequenceSummaries,
    timelineInPointSec: timelinePlayback.timelineInPointSec,
    timelineItems,
    timelineOutPointSec: timelinePlayback.timelineOutPointSec,
  });
  const previewPlayheadSec = timelinePreview?.playheadSec ?? timelinePlayback.playheadSec;
  const canGoToPreviousTimelineCut = timelineCutPoints.some((cutPointSec) => cutPointSec < previewPlayheadSec - timelinePlayback.timelineCutToleranceSec);
  const canGoToNextTimelineCut = timelineCutPoints.some((cutPointSec) => cutPointSec > previewPlayheadSec + timelinePlayback.timelineCutToleranceSec);
  const exportController = useExportController({
    manifest: exportState.exportManifest,
    qualityPreset: exportQualityPreset,
    onNotice: setNotice,
  });

  useEffect(() => {
    const job = exportController.activeExportJob;
    if (!job || registeredExportAssetJobIdRef.current === job.id) return;
    const exportAsset = workspaceProjectAssetFromCompletedTimelineExport(job, exportState.exportManifest);
    if (!exportAsset) return;

    registeredExportAssetJobIdRef.current = job.id;
    setProjectAssets((current) => [
      exportAsset,
      ...current.filter((asset) => asset.id !== exportAsset.id),
    ].slice(0, 120));
    setNotice(`${exportAsset.filename} added to Project media.`);
  }, [exportController.activeExportJob, exportState.exportManifest, setNotice]);

  const timelineHistoryController = useWorkspaceTimelineHistory({
    timelineItemsRef,
    setTimelineItems,
    selectDefaultItems: selectionActions.applyDefaultTimelineSelection,
    stopPlayback: timelinePlayback.stopTimelinePlayback,
  });

  const sequenceActions = useWorkspaceSequenceActions({
    activeSequenceId,
    applyTimelineSelection: selectionActions.applyTimelineSelection,
    projectSettings,
    resetTimelineHistory: timelineHistoryController.resetTimelineHistory,
    sequences,
    setActiveEditorSurface,
    setActiveSequenceId,
    setAudioTrackCount,
    setExportRangeMode,
    setFocusMode,
    setHiddenVideoTracks,
    setInspectedSequenceId,
    setIsTimelinePlaying: timelinePlayback.setIsTimelinePlaying,
    setLockedTimelineTracks,
    setMutedAudioTracks,
    setNotice,
    setPlayheadSec: timelinePlayback.setPlayheadSec,
    setProjectSettings,
    setSequences,
    setTimelineInPointSec: timelinePlayback.setTimelineInPointSec,
    setTimelineItems,
    setTimelineOutPointSec: timelinePlayback.setTimelineOutPointSec,
    setTimelinePanelHeight,
    setTimelinePreview,
    setVideoTrackCount,
    snapshotActiveSequence: sequenceSnapshots.snapshotActiveSequence,
    timelineItemsRef,
  });

  useWorkspacePersistenceEffects({
    activeTemplateId,
    activeTemplateName,
    applyTimelineSelection: selectionActions.applyTimelineSelection,
    buildPersistedWorkspaceState: sequenceSnapshots.buildPersistedWorkspaceState,
    hydrated,
    projectId,
    resetTimelineHistory: timelineHistoryController.resetTimelineHistory,
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
    setIsTimelinePlaying: timelinePlayback.setIsTimelinePlaying,
    setLockedTimelineTracks,
    setMutedAudioTracks,
    setNodes,
    setNotice,
    setPlayheadSec: timelinePlayback.setPlayheadSec,
    setProjectAssets,
    setProjectMediaFolders,
    setProjectSettings,
    setSelectedNodeId,
    setSequences,
    setStoredProjectName,
    setTimelineInPointSec: timelinePlayback.setTimelineInPointSec,
    setTimelineItems,
    setTimelineOutPointSec: timelinePlayback.setTimelineOutPointSec,
    setTimelinePanelHeight,
    setUserCanvasTemplates,
    setVideoTrackCount,
    timelineItemsRef,
    workspaceStorageKey,
  });

  useWorkspaceTimelineSelectionSync({
    applyTimelineSelection: selectionActions.applyTimelineSelection,
    selectedTimelineItemId,
    selectedTimelineItemIds,
    setIsTimelinePlaying: timelinePlayback.setIsTimelinePlaying,
    setSelectedTimelineItemId,
    timelineItems,
    timelineItemsRef,
  });

  useEffect(() => {
    if (!selectedNodeId || focusMode !== 'canvas') {
      setIsCanvasInspectorOpen(false);
    }
  }, [focusMode, selectedNodeId]);

  const canvasController = useWorkspaceCanvasController({
    activeUserCanvasTemplateId,
    assetPickerNodeId,
    capabilities,
    commitTimelineItems: timelineHistoryController.commitTimelineItems,
    defaultModelId,
    edges,
    isProjectMediaPickerOpen,
    lockedTimelineTracks,
    mockMode,
    nodes,
    playheadSec: timelinePlayback.playheadSec,
    pricingEstimates,
    selectedNodeId,
    setActiveEditorSurface,
    setActiveTemplateId,
    setActiveUserCanvasTemplateId,
    setAssetPickerNodeId,
    setCanvasRevision,
    setEdges,
    setFocusMode,
    setIsTimelinePlaying: timelinePlayback.setIsTimelinePlaying,
    setNodes,
    setNotice,
    setPlayheadSec: timelinePlayback.setPlayheadSec,
    setSelectedNodeId,
    setSelectedTimelineItemId,
    setSelectedTimelineItemIds,
    setUserCanvasTemplates,
    studioNotices: studioCopy.notices,
    timelineInsertIntoClipEnabled,
    timelineItemsRef,
    userCanvasTemplates,
  });

  const projectMediaActions = useWorkspaceProjectMediaActions({
    commitTimelineItems: timelineHistoryController.commitTimelineItems,
    lockedTimelineTracks,
    nodes,
    playheadSec: timelinePlayback.playheadSec,
    projectAssets,
    projectMediaFolders,
    setActiveEditorSurface,
    setIsProjectMediaPickerOpen,
    setIsTimelinePlaying: timelinePlayback.setIsTimelinePlaying,
    setNodes,
    setNotice,
    setPlayheadSec: timelinePlayback.setPlayheadSec,
    setProjectAssets,
    setProjectMediaFolders,
    setSelectedTimelineItemId,
    setSelectedTimelineItemIds,
    studioNotices: studioCopy.notices,
    timelineInsertIntoClipEnabled,
    timelineItemsRef,
  });

  const timelineClipActions = useWorkspaceTimelineClipActions({
    applyTimelineSelection: selectionActions.applyTimelineSelection,
    commitTimelineItems: timelineHistoryController.commitTimelineItems,
    handleSelectTimelineItem: selectionActions.handleSelectTimelineItem,
    lockedTimelineTracks,
    selectedTimelineItemId,
    selectedTimelineItemIds,
    setActiveEditorSurface,
    setIsTimelinePlaying: timelinePlayback.setIsTimelinePlaying,
    setNotice,
    setPlayheadSec: timelinePlayback.setPlayheadSec,
    setSelectedTimelineItemId,
    setSelectedTimelineItemIds,
    setTimelinePreview,
    studioNotices: studioCopy.notices,
    timelineInsertIntoClipEnabled,
    timelineItemsRef,
  });

  const timelineTrackActions = useWorkspaceTimelineTrackActions({
    applyTimelineSelection: selectionActions.applyTimelineSelection,
    audioTrackCount,
    commitTimelineItems: timelineHistoryController.commitTimelineItems,
    setActiveEditorSurface,
    setAudioTrackCount,
    setHiddenVideoTracks,
    setIsTimelinePlaying: timelinePlayback.setIsTimelinePlaying,
    setLockedTimelineTracks,
    setMutedAudioTracks,
    setNotice,
    setVideoTrackCount,
    timelineItemsRef,
    videoTrackCount,
  });

  const shellActions = useWorkspaceShellActions({
    activeTemplateId,
    activeTemplateName,
    buildPersistedWorkspaceState: sequenceSnapshots.buildPersistedWorkspaceState,
    hasValidTimelineInOut: exportState.hasValidTimelineInOut,
    openExportDialog: exportController.openExportDialog,
    projectId,
    resetExportSession: exportController.resetExportSession,
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
      activeTemplateId={activeTemplateId}
      activeTemplateName={activeTemplateName}
      activeUserCanvasTemplateId={activeUserCanvasTemplateId}
      audioTrackCount={audioTrackCount}
      canvasRevision={canvasRevision}
      canGoToNextTimelineCut={canGoToNextTimelineCut}
      canGoToPreviousTimelineCut={canGoToPreviousTimelineCut}
      capabilities={capabilities}
      controllers={{
        canvas: canvasController,
        export: exportController,
        projectMedia: projectMediaActions,
        selection: selectionActions,
        sequence: sequenceActions,
        shell: shellActions,
        timelineClip: timelineClipActions,
        timelineHistory: timelineHistoryController,
        timelinePlayback,
        timelineTrack: timelineTrackActions,
      }}
      edges={edges}
      exportQualityPreset={exportQualityPreset}
      exportRangeMode={exportRangeMode}
      exportState={exportState}
      focusMode={focusMode}
      hiddenVideoTracks={hiddenVideoTracks}
      isCanvasInspectorOpen={isCanvasInspectorOpen}
      isProjectMediaPickerOpen={isProjectMediaPickerOpen}
      lockedTimelineTracks={lockedTimelineTracks}
      mockMode={mockMode}
      mutedAudioTracks={mutedAudioTracks}
      notice={notice}
      playheadSec={timelinePlayback.playheadSec}
      previewPlayheadSec={previewPlayheadSec}
      projectAssets={projectAssets}
      projectMediaFolders={projectMediaFolders}
      projectSettings={projectSettings}
      selectedTimelineItemId={selectedTimelineItemId}
      selectedTimelineItemIds={selectedTimelineItemIds}
      sequenceSnapshots={sequenceSnapshots}
      setActiveEditorSurface={setActiveEditorSurface}
      setAssetPickerNodeId={setAssetPickerNodeId}
      setFocusMode={setFocusMode}
      setIsProjectMediaPickerOpen={setIsProjectMediaPickerOpen}
      setMockMode={setMockMode}
      setTimelineInsertIntoClipEnabled={setTimelineInsertIntoClipEnabled}
      studioCopy={studioCopy}
      studioTheme={studioTheme}
      timelineDurationSec={timelineDurationSec}
      timelineInsertIntoClipEnabled={timelineInsertIntoClipEnabled}
      timelineItems={timelineItems}
      timelinePanelHeight={timelinePanelHeight}
      userCanvasTemplates={userCanvasTemplates}
      videoTrackCount={videoTrackCount}
    />
  );
}
