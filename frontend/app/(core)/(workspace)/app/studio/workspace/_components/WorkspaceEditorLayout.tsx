'use client';
import { type CSSProperties, type Dispatch, type SetStateAction } from 'react';
import type { useExportController } from '../_controllers/useExportController';
import type { useWorkspaceCanvasController } from '../_hooks/useWorkspaceCanvasController';
import type { useWorkspaceExportState } from '../_hooks/useWorkspaceExportState';
import { useWorkspaceMobilePanels } from '../_hooks/useWorkspaceMobilePanels';
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
import type { useStudioThemeMode } from '../../_hooks/useStudioThemeMode';
import {
  localizeStudioGeneratedSequenceDisplayName,
  localizeStudioTemplateSummaries,
  type StudioCopy,
} from '../../_lib/studio-copy';
import type {
  WorkspaceAssetRecord,
  WorkspaceGraphEdge,
  WorkspaceModelCapability,
  WorkspaceProjectMediaFolder,
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
import { WorkspaceCanvasInspectorPanel } from './WorkspaceCanvasInspectorPanel';
import { WorkspaceCanvas } from './WorkspaceCanvas.client';
import { WorkspaceEditorTopbar } from './WorkspaceEditorTopbar';
import { WorkspaceMobilePanelFrame } from './WorkspaceMobilePanelFrame';
import { WorkspaceMobilePanelControls } from './WorkspaceMobilePanelControls';
import { WorkspaceProjectMediaPanel } from './WorkspaceProjectMediaPanel';
import { WorkspaceRuntimeModals } from './WorkspaceRuntimeModals';
import { WorkspaceTimeline } from './WorkspaceTimeline';
import { WorkspaceTimelineInspectorPanel } from './WorkspaceTimelineInspectorPanel';
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
  isCanvasInspectorOpen: boolean;
  isProjectMediaPickerOpen: boolean;
  lockedTimelineTracks: WorkspaceTimelineTrack[];
  mockMode: boolean;
  mutedAudioTracks: WorkspaceTimelineAudioTrack[];
  notice: string | null;
  playheadSec: number;
  previewPlayheadSec: number;
  projectAssets: WorkspaceAssetRecord[];
  projectMediaFolders: WorkspaceProjectMediaFolder[];
  projectSettings: WorkspaceProjectSettings;
  selectedTimelineItemId: string | null;
  selectedTimelineItemIds: string[];
  sequenceSnapshots: ReturnType<typeof useWorkspaceSequenceSnapshots>;
  setActiveEditorSurface: Dispatch<SetStateAction<WorkspaceEditorSurface>>;
  setAssetPickerNodeId: Dispatch<SetStateAction<string | null>>;
  setFocusMode: Dispatch<SetStateAction<WorkspaceFocusMode>>;
  setIsProjectMediaPickerOpen: Dispatch<SetStateAction<boolean>>;
  setMockMode: Dispatch<SetStateAction<boolean>>;
  setTimelineInsertIntoClipEnabled: Dispatch<SetStateAction<boolean>>;
  studioCopy: StudioCopy;
  studioTheme: ReturnType<typeof useStudioThemeMode>;
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
  isCanvasInspectorOpen,
  isProjectMediaPickerOpen,
  lockedTimelineTracks,
  mockMode,
  mutedAudioTracks,
  notice,
  playheadSec,
  previewPlayheadSec,
  projectAssets,
  projectMediaFolders,
  projectSettings,
  selectedTimelineItemId,
  selectedTimelineItemIds,
  sequenceSnapshots,
  setActiveEditorSurface,
  setAssetPickerNodeId,
  setFocusMode,
  setIsProjectMediaPickerOpen,
  setMockMode,
  setTimelineInsertIntoClipEnabled,
  studioCopy,
  studioTheme,
  timelineDurationSec,
  timelineInsertIntoClipEnabled,
  timelineItems,
  timelinePanelHeight,
  userCanvasTemplates,
  videoTrackCount,
}: WorkspaceEditorLayoutProps) {
  const editorShellStyle = timelinePanelHeight ? ({ '--timeline-panel-height': `${timelinePanelHeight}px` } as CSSProperties) : undefined;
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
  const localizedTemplateSummaries = localizeStudioTemplateSummaries(WORKSPACE_TEMPLATE_SUMMARIES, studioCopy);
  const exportManifest = {
    ...exportState.exportManifest,
    sequenceName: localizeStudioGeneratedSequenceDisplayName(exportState.exportManifest.sequenceName, studioCopy.viewer.projectMedia),
  };
  const shouldShowCanvasInspector = focusMode === 'canvas' && isCanvasInspectorOpen && Boolean(canvas.selectedNode);
  const canOpenMobileProjectMedia = focusMode === 'viewer';
  const canOpenMobileInspector = focusMode === 'viewer' || shouldShowCanvasInspector;
  const mobileInspectorLabel = focusMode === 'canvas' ? studioCopy.canvas.nodes.inspectorTitle : studioCopy.timeline.inspector.clipInspector;
  const closeProjectMediaDrawerLabel = `${studioCopy.projects.closeDialog}: ${studioCopy.viewer.projectMedia.title}`;
  const closeInspectorDrawerLabel = `${studioCopy.projects.closeDialog}: ${mobileInspectorLabel}`;
  const mobilePanels = useWorkspaceMobilePanels({
    canOpenInspector: canOpenMobileInspector,
    canOpenProjectMedia: canOpenMobileProjectMedia,
    focusMode,
  });
  return (
    <main
      className={`${styles.editorShell} ${focusMode === 'viewer' ? `${baseStyles.viewerFocus} ${shellStyles.viewerFocus}` : ''}`}
      style={editorShellStyle}
      data-active-editor-surface={activeEditorSurface}
      data-studio-theme={studioTheme.resolvedTheme}
    >
      <WorkspaceEditorTopbar
        activeTemplateName={activeTemplateName}
        focusMode={focusMode}
        mockMode={mockMode}
        onEditorSurfaceChange={setActiveEditorSurface}
        onExitToProjects={shell.handleExitToProjects}
        onFocusModeChange={setFocusMode}
        onToggleMockMode={() => setMockMode((value) => !value)}
        studioCopy={studioCopy}
        studioTheme={studioTheme}
      />
      {notice ? (
        <div className={styles.editorToast} role="status" aria-live="polite" data-editor-status="true">
          {notice}
        </div>
      ) : null}

      <div
        className={`${styles.editorBody} ${focusMode === 'canvas' ? styles.canvasEditorBody : ''} ${
          shouldShowCanvasInspector ? styles.canvasEditorBodyInspectorOpen : ''
        }`}
        data-mobile-panel={mobilePanels.activePanel ?? 'closed'}
      >
        {mobilePanels.activePanel ? (
          <button
            type="button"
            className={styles.mobilePanelBackdrop}
            aria-label={studioCopy.projects.closeDialog}
            onClick={mobilePanels.closePanel}
          />
        ) : null}
        <WorkspaceMobilePanelControls
          activePanel={mobilePanels.activePanel}
          ariaLabel={studioCopy.topbar.workspaceViewLabel}
          inspectorLabel={mobileInspectorLabel}
          mediaLabel={studioCopy.viewer.projectMedia.title}
          showInspector={canOpenMobileInspector}
          showMedia={canOpenMobileProjectMedia}
          onTogglePanel={mobilePanels.togglePanel}
        />
        {focusMode === 'viewer' ? (
          <div
            ref={mobilePanels.projectMediaPanelRef}
            id="studio-project-media-panel"
            className={`${styles.projectMediaPanelSlot} ${mobilePanels.activePanel === 'media' ? styles.mobilePanelOpen : ''}`}
            role={mobilePanels.activePanel === 'media' ? 'dialog' : undefined}
            aria-modal={mobilePanels.activePanel === 'media' ? true : undefined}
            aria-label={mobilePanels.activePanel === 'media' ? studioCopy.viewer.projectMedia.title : undefined}
            tabIndex={mobilePanels.activePanel === 'media' ? -1 : undefined}
            onKeyDown={mobilePanels.activePanel === 'media' ? mobilePanels.handlePanelKeyDown : undefined}
          >
            <WorkspaceMobilePanelFrame
              closeLabel={closeProjectMediaDrawerLabel}
              title={studioCopy.viewer.projectMedia.title}
              onClose={mobilePanels.closePanel}
            >
              <WorkspaceProjectMediaPanel
                activeTemplateName={activeTemplateName}
                canvas={canvas}
                projectAssets={projectAssets}
                projectMedia={projectMedia}
                projectMediaFolders={projectMediaFolders}
                selection={selection}
                sequence={sequence}
                sequenceSnapshots={sequenceSnapshots}
                studioCopy={studioCopy}
                timelineItems={timelineItems}
              />
            </WorkspaceMobilePanelFrame>
          </div>
        ) : null}
        {focusMode === 'canvas' ? (
          <WorkspaceCanvas
            copy={studioCopy.canvas}
            notices={studioCopy.notices}
            key={`${activeTemplateId}-${canvasRevision}`}
            autoCenterNodeId={canvas.canvasAutoCenterNodeId}
            nodes={canvas.renderNodes}
            edges={canvas.renderEdges}
            isKeyboardDeleteEnabled={activeEditorSurface === 'canvas'}
            isShortcutActive={activeEditorSurface === 'canvas'}
            onNodesChange={canvas.onNodesChange}
            onEdgesChange={canvas.onEdgesChange}
            onConnect={canvas.onConnect}
            isValidConnection={canvas.isValidConnection}
            onCreateNodeFromHandleDrop={canvas.handleCreateNodeFromHandleDrop}
            onCreateNodeFromPaletteDrop={canvas.handleCreateNodeFromPaletteDrop}
            onCanvasFileDrop={canvas.handleCanvasFileDrop}
            onCopySelectedNodes={canvas.handleCopySelectedNodes} onPasteCopiedNodes={canvas.handlePasteCanvasClipboard}
            onCanvasTextPaste={canvas.handleCanvasTextPaste}
            onAutoCenterNodeConsumed={canvas.handleCanvasAutoCenterNodeConsumed}
            onCanvasInteraction={selection.handleCanvasInteraction}
            onSelectedNodeChange={selection.handleSelectedCanvasNodeChange}
            onSelectedNodeSync={selection.handleSyncSelectedCanvasNode}
            onInspectNode={selection.handleInspectCanvasNode}
            toolbar={{
              activeCanvasName: userCanvasTemplates.find((template) => template.id === activeUserCanvasTemplateId)?.name ?? null,
              canRedo: canvas.canvasHistory.future.length > 0,
              canUndo: canvas.canvasHistory.past.length > 0,
              canRenameActiveCanvas: Boolean(activeUserCanvasTemplateId),
              onRedo: canvas.redoCanvas,
              onRenameActiveCanvas: (name) => {
                if (activeUserCanvasTemplateId) {
                  canvas.handleRenameUserCanvasTemplate(activeUserCanvasTemplateId, name);
                  return;
                }
                canvas.handleSaveCanvasTemplate(name);
              },
              onSaveActiveCanvas: canvas.handleSaveActiveCanvasTemplate,
              onSaveCanvasTemplate: canvas.handleSaveCanvasTemplate,
              onUndo: canvas.undoCanvas,
            }}
            canvasNavigator={{
              templates: localizedTemplateSummaries,
              activeTemplateId: activeUserCanvasTemplateId ? null : activeTemplateId,
              userTemplates: userCanvasTemplates,
              activeUserTemplateId: activeUserCanvasTemplateId,
              onAddTemplate: canvas.handleAddCanvasTemplate,
              onApplyTemplate: canvas.handleApplyCanvasTemplate,
              onApplyUserTemplate: canvas.handleApplyUserCanvasTemplate,
              onCreateCanvasFromTemplate: canvas.handleCreateCanvasFromTemplate,
              onDeleteUserTemplate: canvas.handleDeleteUserCanvasTemplate,
              onDuplicateUserTemplate: canvas.handleDuplicateUserCanvasTemplate,
            }}
          />
        ) : (
          <WorkspaceVideoViewer
            copy={studioCopy.viewer}
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
          <div
            ref={mobilePanels.inspectorPanelRef}
            id="studio-inspector-panel"
            className={`${styles.inspectorPanelSlot} ${styles.canvasInspectorSlot} ${mobilePanels.activePanel === 'inspector' ? styles.mobilePanelOpen : ''}`}
            aria-hidden={!shouldShowCanvasInspector}
            role={mobilePanels.activePanel === 'inspector' ? 'dialog' : undefined}
            aria-modal={mobilePanels.activePanel === 'inspector' ? true : undefined}
            aria-label={mobilePanels.activePanel === 'inspector' ? mobileInspectorLabel : undefined}
            tabIndex={mobilePanels.activePanel === 'inspector' ? -1 : undefined}
            onKeyDown={mobilePanels.activePanel === 'inspector' ? mobilePanels.handlePanelKeyDown : undefined}
          >
            <WorkspaceMobilePanelFrame
              closeLabel={closeInspectorDrawerLabel}
              title={mobileInspectorLabel}
              onClose={mobilePanels.closePanel}
            >
              {shouldShowCanvasInspector ? (
                <WorkspaceCanvasInspectorPanel
                  canvas={canvas}
                  capabilities={capabilities}
                  edges={edges}
                  studioCopy={studioCopy}
                />
              ) : null}
            </WorkspaceMobilePanelFrame>
          </div>
        ) : (
          <div
            ref={mobilePanels.inspectorPanelRef}
            id="studio-inspector-panel"
            className={`${styles.inspectorPanelSlot} ${mobilePanels.activePanel === 'inspector' ? styles.mobilePanelOpen : ''}`}
            role={mobilePanels.activePanel === 'inspector' ? 'dialog' : undefined}
            aria-modal={mobilePanels.activePanel === 'inspector' ? true : undefined}
            aria-label={mobilePanels.activePanel === 'inspector' ? mobileInspectorLabel : undefined}
            tabIndex={mobilePanels.activePanel === 'inspector' ? -1 : undefined}
            onKeyDown={mobilePanels.activePanel === 'inspector' ? mobilePanels.handlePanelKeyDown : undefined}
          >
            <WorkspaceMobilePanelFrame
              closeLabel={closeInspectorDrawerLabel}
              title={mobileInspectorLabel}
              onClose={mobilePanels.closePanel}
            >
              <WorkspaceTimelineInspectorPanel
                exportState={exportState}
                projectMedia={projectMedia}
                projectSettings={projectSettings}
                sequence={sequence}
                shell={shell}
                studioCopy={studioCopy}
                timelineClip={timelineClip}
              />
            </WorkspaceMobilePanelFrame>
          </div>
        )}
      </div>

      <WorkspaceTimeline
        copy={studioCopy.timeline}
        canvasNodeCopy={studioCopy.canvas.nodes}
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
        onDeleteGap={timelineClip.handleDeleteTimelineGap}
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
        onOpenExportDialog={shell.handleOpenExportDialog}
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
        assetLibraryCopy={studioCopy.assetLibrary}
        exportDialogCopy={studioCopy.exportDialog}
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
        manifest={exportManifest}
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
        onSelectProjectMediaAssets={projectMedia.handleSelectProjectMediaAssets}
      />
    </main>
  );
}
