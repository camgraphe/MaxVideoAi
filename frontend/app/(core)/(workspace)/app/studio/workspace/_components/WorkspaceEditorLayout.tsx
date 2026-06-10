'use client';

import type { CSSProperties, Dispatch, SetStateAction } from 'react';
import type { useExportController } from '../_controllers/useExportController';
import type { useWorkspaceCanvasController } from '../_hooks/useWorkspaceCanvasController';
import type { useWorkspaceExportState } from '../_hooks/useWorkspaceExportState';
import type { useWorkspaceProjectMediaActions } from '../_hooks/useWorkspaceProjectMediaActions';
import type { useWorkspaceSelectionActions } from '../_hooks/useWorkspaceSelectionActions';
import type { useWorkspaceSequenceActions } from '../_hooks/useWorkspaceSequenceActions';
import type { useWorkspaceSequenceSnapshots } from '../_hooks/useWorkspaceSequenceSnapshots';
import type { useWorkspaceShellActions } from '../_hooks/useWorkspaceShellActions';
import type { useWorkspaceTimelineClipActions } from '../_hooks/useWorkspaceTimelineClipActions';
import type { useWorkspaceTimelineHistory } from '../_hooks/useWorkspaceTimelineHistory';
import type { useWorkspaceTimelinePlayback } from '../_hooks/useWorkspaceTimelinePlayback';
import type { useWorkspaceTimelineTrackActions } from '../_hooks/useWorkspaceTimelineTrackActions';
import type { WorkspaceTimelineExportQualityPreset } from '../_lib/workspace-timeline-export';
import type { WorkspaceTimelineExportRangeMode } from '../_lib/workspace-timeline-render';
import type {
  WorkspaceAssetRecord,
  WorkspaceGraphEdge,
  WorkspaceModelCapability,
  WorkspaceProjectSettings,
  WorkspaceTemplateId,
  WorkspaceTimelineAudioTrack,
  WorkspaceTimelineItem,
  WorkspaceTimelineTrack,
  WorkspaceTimelineVideoTrack,
} from '../_lib/workspace-types';
import { WORKSPACE_TEMPLATE_SUMMARIES } from '../_lib/workspace-templates';
import {
  MAX_TIMELINE_AUDIO_TRACKS,
  MAX_TIMELINE_PANEL_HEIGHT,
  MAX_TIMELINE_VIDEO_TRACKS,
  MIN_TIMELINE_AUDIO_TRACKS,
  MIN_TIMELINE_PANEL_HEIGHT,
  type WorkspaceEditorSurface,
  type WorkspaceFocusMode,
  type WorkspaceUserCanvasTemplate,
} from '../_state/workspace-state';
import baseStyles from '../maxvideoai-editor.module.css';
import shellStyles from '../_styles/shell.module.css';
import { NodeLibrarySidebar } from './NodeLibrarySidebar';
import { NodeSettingsPanel } from './NodeSettingsPanel';
import { TimelineClipInspector } from './TimelineClipInspector';
import { TimelineProjectSidebar } from './TimelineProjectSidebar';
import { WorkspaceCanvas } from './WorkspaceCanvas.client';
import { WorkspaceEditorTopbar } from './WorkspaceEditorTopbar';
import { WorkspaceRuntimeModals } from './WorkspaceRuntimeModals';
import { WorkspaceTimeline } from './WorkspaceTimeline';
import { WorkspaceVideoViewer } from './WorkspaceVideoViewer';

const styles = { ...baseStyles, ...shellStyles };

type WorkspaceEditorLayoutControllers = {
  canvas: ReturnType<typeof useWorkspaceCanvasController>;
  export: ReturnType<typeof useExportController>;
  projectMedia: ReturnType<typeof useWorkspaceProjectMediaActions>;
  selection: ReturnType<typeof useWorkspaceSelectionActions>;
  sequence: ReturnType<typeof useWorkspaceSequenceActions>;
  shell: ReturnType<typeof useWorkspaceShellActions>;
  timelineClip: ReturnType<typeof useWorkspaceTimelineClipActions>;
  timelineHistory: ReturnType<typeof useWorkspaceTimelineHistory>;
  timelinePlayback: ReturnType<typeof useWorkspaceTimelinePlayback>;
  timelineTrack: ReturnType<typeof useWorkspaceTimelineTrackActions>;
};

type WorkspaceEditorLayoutProps = {
  activeEditorSurface: WorkspaceEditorSurface;
  activeTemplateId: WorkspaceTemplateId;
  activeTemplateName: string;
  activeUserCanvasTemplateId: string | null;
  audioTrackCount: number;
  canvasRevision: number;
  canGoToNextTimelineCut: boolean;
  canGoToPreviousTimelineCut: boolean;
  capabilities: WorkspaceModelCapability[];
  controllers: WorkspaceEditorLayoutControllers;
  edges: WorkspaceGraphEdge[];
  exportQualityPreset: WorkspaceTimelineExportQualityPreset;
  exportRangeMode: WorkspaceTimelineExportRangeMode;
  exportState: ReturnType<typeof useWorkspaceExportState>;
  focusMode: WorkspaceFocusMode;
  hiddenVideoTracks: WorkspaceTimelineVideoTrack[];
  isProjectMediaPickerOpen: boolean;
  lockedTimelineTracks: WorkspaceTimelineTrack[];
  mockMode: boolean;
  mutedAudioTracks: WorkspaceTimelineAudioTrack[];
  notice: string | null;
  playheadSec: number;
  previewPlayheadSec: number;
  projectAssets: WorkspaceAssetRecord[];
  projectSettings: WorkspaceProjectSettings;
  selectedTimelineItemId: string | null;
  selectedTimelineItemIds: string[];
  sequenceSnapshots: ReturnType<typeof useWorkspaceSequenceSnapshots>;
  setActiveEditorSurface: Dispatch<SetStateAction<WorkspaceEditorSurface>>;
  setAssetPickerNodeId: Dispatch<SetStateAction<string | null>>;
  setFocusMode: Dispatch<SetStateAction<WorkspaceFocusMode>>;
  setIsProjectMediaPickerOpen: Dispatch<SetStateAction<boolean>>;
  setMockMode: Dispatch<SetStateAction<boolean>>;
  setSelectedNodeId: Dispatch<SetStateAction<string | null>>;
  setTimelineInsertIntoClipEnabled: Dispatch<SetStateAction<boolean>>;
  timelineDurationSec: number;
  timelineInsertIntoClipEnabled: boolean;
  timelineItems: WorkspaceTimelineItem[];
  timelinePanelHeight: number | null;
  userCanvasTemplates: WorkspaceUserCanvasTemplate[];
  videoTrackCount: number;
};

export function WorkspaceEditorLayout({
  activeEditorSurface,
  activeTemplateId,
  activeTemplateName,
  activeUserCanvasTemplateId,
  audioTrackCount,
  canvasRevision,
  canGoToNextTimelineCut,
  canGoToPreviousTimelineCut,
  capabilities,
  controllers,
  edges,
  exportQualityPreset,
  exportRangeMode,
  exportState,
  focusMode,
  hiddenVideoTracks,
  isProjectMediaPickerOpen,
  lockedTimelineTracks,
  mockMode,
  mutedAudioTracks,
  notice,
  playheadSec,
  previewPlayheadSec,
  projectAssets,
  projectSettings,
  selectedTimelineItemId,
  selectedTimelineItemIds,
  sequenceSnapshots,
  setActiveEditorSurface,
  setAssetPickerNodeId,
  setFocusMode,
  setIsProjectMediaPickerOpen,
  setMockMode,
  setSelectedNodeId,
  setTimelineInsertIntoClipEnabled,
  timelineDurationSec,
  timelineInsertIntoClipEnabled,
  timelineItems,
  timelinePanelHeight,
  userCanvasTemplates,
  videoTrackCount,
}: WorkspaceEditorLayoutProps) {
  const editorShellStyle = timelinePanelHeight
    ? ({ '--timeline-panel-height': `${timelinePanelHeight}px` } as CSSProperties)
    : undefined;

  const {
    canvas,
    export: exportController,
    projectMedia,
    selection,
    sequence,
    shell,
    timelineClip,
    timelineHistory,
    timelinePlayback,
    timelineTrack,
  } = controllers;

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
        onExitToProjects={shell.handleExitToProjects}
        onFocusModeChange={setFocusMode}
        onOpenExportDialog={shell.handleOpenExportDialog}
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
            onApplyTemplate={canvas.handleApplyCanvasTemplate}
            onApplyUserTemplate={canvas.handleApplyUserCanvasTemplate}
            onDeleteUserTemplate={canvas.handleDeleteUserCanvasTemplate}
            onDuplicateUserTemplate={canvas.handleDuplicateUserCanvasTemplate}
            onSaveCanvasTemplate={canvas.handleSaveCanvasTemplate}
          />
        ) : (
          <TimelineProjectSidebar
            nodes={canvas.renderNodes}
            projectAssets={projectAssets}
            projectName={activeTemplateName}
            sequences={sequenceSnapshots.sequenceSummaries}
            timelineItems={timelineItems}
            onDeleteGeneratedClip={projectMedia.handleDeleteGeneratedClip}
            onDeleteProjectAsset={projectMedia.handleDeleteProjectAsset}
            onImportMedia={projectMedia.handleImportProjectMedia}
            onInspectSequence={selection.handleInspectSequence}
            onInsertGeneratedClip={canvas.handleSendOutputToTimeline}
            onInsertProjectAsset={projectMedia.handleInsertProjectAssetToTimeline}
            onNewFolder={projectMedia.handleCreateProjectMediaFolder}
            onNewSequence={sequence.handleCreateSequence}
            onSelectSequence={sequence.handleSelectSequence}
            onClearSequenceInspector={selection.handleClearSequenceInspector}
          />
        )}
        {focusMode === 'canvas' ? (
          <WorkspaceCanvas
            key={`${activeTemplateId}-${canvasRevision}`}
            nodes={canvas.renderNodes}
            edges={canvas.renderEdges}
            isKeyboardDeleteEnabled={activeEditorSurface === 'canvas'}
            onNodesChange={canvas.onNodesChange}
            onEdgesChange={canvas.onEdgesChange}
            onConnect={canvas.onConnect}
            isValidConnection={canvas.isValidConnection}
            onCreateNodeFromHandleDrop={canvas.handleCreateNodeFromHandleDrop}
            onCreateNodeFromPaletteDrop={canvas.handleCreateNodeFromPaletteDrop}
            onCanvasFileDrop={canvas.handleCanvasFileDrop}
            onCanvasTextPaste={canvas.handleCanvasTextPaste}
            onCanvasInteraction={selection.handleCanvasInteraction}
            onSelectedNodeChange={selection.handleSelectedCanvasNodeChange}
            onSelectedNodeSync={setSelectedNodeId}
          />
        ) : (
          <WorkspaceVideoViewer
            canGoToNextCut={canGoToNextTimelineCut}
            canGoToPreviousCut={canGoToPreviousTimelineCut}
            inPointSec={timelinePlayback.timelineInPointSec}
            isPlaying={timelinePlayback.isTimelinePlaying}
            items={exportState.viewerTimelineItems}
            outPointSec={timelinePlayback.timelineOutPointSec}
            playheadSec={previewPlayheadSec}
            projectSettings={projectSettings}
            selectedItemId={selectedTimelineItemId}
            onClearInOut={timelinePlayback.handleClearTimelineInOut}
            onGoToNextCut={() => timelinePlayback.handleGoToTimelineCut(1)}
            onGoToPreviousCut={() => timelinePlayback.handleGoToTimelineCut(-1)}
            onMarkIn={timelinePlayback.handleMarkTimelineIn}
            onMarkOut={timelinePlayback.handleMarkTimelineOut}
            onSelectItem={(itemId) => selection.handleSelectTimelineItem(itemId)}
            onSendSnapshotToCanvas={canvas.handleSendProgramSnapshotToCanvas}
            onTogglePlayback={timelinePlayback.handleToggleTimelinePlayback}
          />
        )}
        {focusMode === 'canvas' ? (
          <NodeSettingsPanel
            selectedNode={canvas.selectedNode}
            edges={edges}
            capabilities={capabilities}
            onPatchNodeData={canvas.patchNodeData}
            onPatchShot={canvas.patchShot}
            onGenerateShot={canvas.handleGenerateShot}
            onSendOutputToTimeline={canvas.handleSendOutputToTimeline}
            onOpenAssetLibrary={canvas.handleOpenAssetLibrary}
          />
        ) : (
          <TimelineClipInspector
            selectedItem={exportState.selectedTimelineItem}
            selectedSequence={exportState.selectedSequenceForInspector}
            projectFps={projectSettings.fps}
            onPatchItem={timelineClip.handlePatchTimelineItem}
            onRenameSequence={sequence.handleRenameActiveSequence}
            onSequenceSettingsChange={shell.handleProjectSettingsChange}
          />
        )}
      </div>

      <WorkspaceTimeline
        canRedo={timelineHistory.timelineHistory.future.length > 0}
        canUndo={timelineHistory.timelineHistory.past.length > 0}
        isShortcutActive={activeEditorSurface === 'timeline'}
        audioTrackCount={audioTrackCount}
        hiddenVideoTracks={hiddenVideoTracks}
        items={timelineItems}
        isInsertIntoClipEnabled={timelineInsertIntoClipEnabled}
        inPointSec={timelinePlayback.timelineInPointSec}
        lockedTracks={lockedTimelineTracks}
        mutedAudioTracks={mutedAudioTracks}
        maxAudioTrackCount={MAX_TIMELINE_AUDIO_TRACKS}
        maxPanelHeight={MAX_TIMELINE_PANEL_HEIGHT}
        maxVideoTrackCount={MAX_TIMELINE_VIDEO_TRACKS}
        minAudioTrackCount={MIN_TIMELINE_AUDIO_TRACKS}
        minPanelHeight={MIN_TIMELINE_PANEL_HEIGHT}
        selectedItemId={selectedTimelineItemId}
        selectedItemIds={selectedTimelineItemIds}
        outPointSec={timelinePlayback.timelineOutPointSec}
        panelHeight={timelinePanelHeight}
        videoTrackCount={videoTrackCount}
        playheadSec={playheadSec}
        projectFps={projectSettings.fps}
        onAddAudioTrack={timelineTrack.handleAddTimelineAudioTrack}
        onAddVideoTrack={timelineTrack.handleAddTimelineVideoTrack}
        onCutItem={timelineClip.handleCutTimelineItem}
        onDeleteItem={timelineClip.handleDeleteTimelineItem}
        onMarkIn={timelinePlayback.handleMarkTimelineIn}
        onMarkOut={timelinePlayback.handleMarkTimelineOut}
        onGoToCut={timelinePlayback.handleGoToTimelineCut}
        onPanelHeightChange={shell.handleTimelinePanelHeightChange}
        onRedo={timelineHistory.redoTimeline}
        onInvalidNodeDropToTimeline={canvas.handleInvalidNodeDropToTimeline}
        onMoveItem={timelineClip.handleMoveTimelineItem}
        onNodeDropToTimeline={canvas.handleDropNodeToTimeline}
        onPlaybackChange={timelinePlayback.setIsTimelinePlaying}
        onPlayheadChange={timelinePlayback.setPlayheadSec}
        onProjectAssetDropToTimeline={projectMedia.handleDropProjectAssetToTimeline}
        onPreviewItemsChange={timelineClip.handleTimelinePreviewItemsChange}
        onTogglePlayback={timelinePlayback.handleToggleTimelinePlayback}
        onPositionItem={timelineClip.handlePositionTimelineItem}
        onResizeItem={timelineClip.handleResizeTimelineItem}
        onSelectItem={selection.handleSelectTimelineItem}
        onSelectItems={selection.handleSelectTimelineItems}
        onInsertIntoClipChange={setTimelineInsertIntoClipEnabled}
        onDeleteTrack={timelineTrack.handleDeleteTimelineTrack}
        onLinkItems={timelineClip.handleLinkTimelineItems}
        onToggleAudioTrackMute={timelineTrack.handleToggleAudioTrackMute}
        onToggleTrackLock={timelineTrack.handleToggleTimelineTrackLock}
        onToggleVideoTrackVisibility={timelineTrack.handleToggleVideoTrackVisibility}
        onUnlinkItems={timelineClip.handleUnlinkTimelineItems}
        onUndo={timelineHistory.undoTimeline}
      />
      <WorkspaceRuntimeModals
        activeExportJob={exportController.activeExportJob}
        assetPickerLibrary={canvas.assetPickerLibrary}
        assetPickerNode={canvas.assetPickerNode}
        exportEstimate={exportController.exportEstimate}
        exportQuota={exportController.exportQuota}
        exportRangeMode={exportRangeMode}
        exportQualityPreset={exportQualityPreset}
        exportVideoFeedback={exportController.exportVideoFeedback}
        inPointSec={timelinePlayback.timelineInPointSec}
        isExportDialogOpen={exportController.isExportDialogOpen}
        isExportEstimateLoading={exportController.isExportEstimateLoading}
        isExportVideoStarting={exportController.isExportVideoStarting}
        isProjectMediaPickerOpen={isProjectMediaPickerOpen}
        manifest={exportState.exportManifest}
        outPointSec={timelinePlayback.timelineOutPointSec}
        projectMediaLibrary={canvas.projectMediaLibrary}
        readinessLabel={exportController.exportReadinessLabel}
        sequenceDurationSec={timelineDurationSec}
        onAssetPickerClose={() => setAssetPickerNodeId(null)}
        onCloseExportDialog={exportController.closeExportDialog}
        onExportEdl={exportController.exportTimelineEdl}
        onExportVideo={exportController.exportTimelineVideo}
        onPrepareRender={exportController.exportTimelineRender}
        onProjectMediaPickerClose={() => setIsProjectMediaPickerOpen(false)}
        onQualityPresetChange={shell.handleExportQualityPresetChange}
        onRangeModeChange={shell.handleExportRangeModeChange}
        onSelectAsset={canvas.handleSelectLibraryAsset}
        onSelectProjectMediaAsset={projectMedia.handleSelectProjectMediaAsset}
      />
    </main>
  );
}
