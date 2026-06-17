'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type KeyboardEvent as ReactKeyboardEvent,
  type SetStateAction,
} from 'react';
import { X } from 'lucide-react';
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
import { NodeSettingsPanel } from './NodeSettingsPanel';
import { TimelineClipInspector } from './TimelineClipInspector';
import { TimelineProjectSidebar } from './TimelineProjectSidebar';
import { WorkspaceCanvas } from './WorkspaceCanvas.client';
import { WorkspaceEditorTopbar } from './WorkspaceEditorTopbar';
import { WorkspaceMobilePanelControls } from './WorkspaceMobilePanelControls';
import { WorkspaceRuntimeModals } from './WorkspaceRuntimeModals';
import { WorkspaceTimeline } from './WorkspaceTimeline';
import { WorkspaceVideoViewer } from './WorkspaceVideoViewer';

const styles = { ...baseStyles, ...shellStyles };
type MobileWorkspacePanel = 'media' | 'inspector' | null;
const FOCUSABLE_DRAWER_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function focusableDrawerElements(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_DRAWER_SELECTOR)).filter((element) => (
    element.offsetParent !== null && element.getAttribute('aria-hidden') !== 'true'
  ));
}

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
  const [mobileWorkspacePanel, setMobileWorkspacePanel] = useState<MobileWorkspacePanel>(null);
  const mobilePanelReturnFocusRef = useRef<HTMLElement | null>(null);
  const mobileProjectMediaPanelRef = useRef<HTMLDivElement | null>(null);
  const mobileInspectorPanelRef = useRef<HTMLDivElement | null>(null);
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

  const closeMobileWorkspacePanel = useCallback(() => {
    setMobileWorkspacePanel(null);
    window.requestAnimationFrame(() => mobilePanelReturnFocusRef.current?.focus());
  }, []);

  const handleToggleMobilePanel = useCallback((panel: Exclude<MobileWorkspacePanel, null>, trigger: HTMLButtonElement) => {
    setMobileWorkspacePanel((current) => {
      mobilePanelReturnFocusRef.current = trigger;
      if (current === panel) {
        window.requestAnimationFrame(() => mobilePanelReturnFocusRef.current?.focus());
        return null;
      }
      return panel;
    });
  }, []);

  const handleMobilePanelKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!mobileWorkspacePanel) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMobileWorkspacePanel();
      return;
    }
    if (event.key !== 'Tab') return;

    const focusables = focusableDrawerElements(event.currentTarget);
    if (!focusables.length) {
      event.preventDefault();
      event.currentTarget.focus();
      return;
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
      return;
    }
    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }, [closeMobileWorkspacePanel, mobileWorkspacePanel]);

  useEffect(() => {
    setMobileWorkspacePanel(null);
  }, [focusMode]);
  useEffect(() => {
    if ((mobileWorkspacePanel === 'media' && !canOpenMobileProjectMedia) || (mobileWorkspacePanel === 'inspector' && !canOpenMobileInspector)) {
      setMobileWorkspacePanel(null);
    }
  }, [canOpenMobileInspector, canOpenMobileProjectMedia, mobileWorkspacePanel]);
  useEffect(() => {
    if (!mobileWorkspacePanel) return;
    const panelRef = mobileWorkspacePanel === 'media' ? mobileProjectMediaPanelRef : mobileInspectorPanelRef;
    const frame = window.requestAnimationFrame(() => {
      const closeButton = panelRef.current?.querySelector<HTMLElement>('[data-mobile-panel-close]');
      (closeButton ?? focusableDrawerElements(panelRef.current)[0] ?? panelRef.current)?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [mobileWorkspacePanel]);

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
        data-mobile-panel={mobileWorkspacePanel ?? 'closed'}
      >
        {mobileWorkspacePanel ? (
          <button
            type="button"
            className={styles.mobilePanelBackdrop}
            aria-label={studioCopy.projects.closeDialog}
            onClick={closeMobileWorkspacePanel}
          />
        ) : null}
        <WorkspaceMobilePanelControls
          activePanel={mobileWorkspacePanel}
          ariaLabel={studioCopy.topbar.workspaceViewLabel}
          inspectorLabel={mobileInspectorLabel}
          mediaLabel={studioCopy.viewer.projectMedia.title}
          showInspector={canOpenMobileInspector}
          showMedia={canOpenMobileProjectMedia}
          onTogglePanel={handleToggleMobilePanel}
        />
        {focusMode === 'viewer' ? (
          <div
            ref={mobileProjectMediaPanelRef}
            id="studio-project-media-panel"
            className={`${styles.projectMediaPanelSlot} ${mobileWorkspacePanel === 'media' ? styles.mobilePanelOpen : ''}`}
            role={mobileWorkspacePanel === 'media' ? 'dialog' : undefined}
            aria-modal={mobileWorkspacePanel === 'media' ? true : undefined}
            aria-label={mobileWorkspacePanel === 'media' ? studioCopy.viewer.projectMedia.title : undefined}
            tabIndex={mobileWorkspacePanel === 'media' ? -1 : undefined}
            onKeyDown={mobileWorkspacePanel === 'media' ? handleMobilePanelKeyDown : undefined}
          >
            <div className={styles.mobilePanelChrome}>
              <button
                type="button"
                className={styles.mobilePanelCloseButton}
                data-mobile-panel-close="true"
                aria-label={closeProjectMediaDrawerLabel}
                onClick={closeMobileWorkspacePanel}
              >
                <span>{studioCopy.viewer.projectMedia.title}</span>
                <X size={16} aria-hidden="true" />
              </button>
              <div className={styles.mobilePanelContent}>
                <TimelineProjectSidebar
                  studioCanvasNodeCopy={studioCopy.canvas.nodes}
                  copy={studioCopy.viewer.projectMedia}
                  nodes={canvas.renderNodes}
                  projectAssets={projectAssets}
                  projectMediaFolders={projectMediaFolders}
                  projectName={activeTemplateName}
                  sequences={sequenceSnapshots.sequenceSummaries}
                  timelineItems={timelineItems}
                  onDeleteGeneratedClip={projectMedia.handleDeleteGeneratedClip}
                  onDeleteGeneratedClips={projectMedia.handleDeleteGeneratedClips}
                  onDeleteProjectAsset={projectMedia.handleDeleteProjectAsset}
                  onDeleteProjectAssets={projectMedia.handleDeleteProjectAssets}
                  onDeleteProjectMediaFolder={projectMedia.handleDeleteProjectMediaFolder}
                  onDeleteProjectMediaFolders={projectMedia.handleDeleteProjectMediaFolders}
                  onDeleteSequence={sequence.handleDeleteSequence}
                  onDeleteSequences={sequence.handleDeleteSequences}
                  onDuplicateSequence={sequence.handleDuplicateSequence}
                  onImportMedia={projectMedia.handleImportProjectMedia}
                  onImportLocalMediaFiles={projectMedia.handleImportLocalProjectMediaFiles}
                  onInspectProjectAsset={selection.handleInspectProjectAsset}
                  onInspectSequence={selection.handleInspectSequence}
                  onInsertGeneratedClip={canvas.handleSendOutputToTimeline}
                  onInsertProjectAsset={projectMedia.handleInsertProjectAssetToTimeline}
                  onMoveGeneratedClipToFolder={projectMedia.handleMoveGeneratedClipToFolder}
                  onMoveProjectAssetToFolder={projectMedia.handleMoveProjectAssetToFolder}
                  onNewFolder={projectMedia.handleCreateProjectMediaFolder}
                  onNewSequence={sequence.handleCreateSequence}
                  onRenameProjectMediaFolder={projectMedia.handleRenameProjectMediaFolder}
                  onSelectSequence={sequence.handleSelectSequence}
                  onClearProjectMediaInspector={selection.handleClearProjectMediaInspector}
                />
              </div>
            </div>
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
            ref={mobileInspectorPanelRef}
            id="studio-inspector-panel"
            className={`${styles.inspectorPanelSlot} ${styles.canvasInspectorSlot} ${mobileWorkspacePanel === 'inspector' ? styles.mobilePanelOpen : ''}`}
            aria-hidden={!shouldShowCanvasInspector}
            role={mobileWorkspacePanel === 'inspector' ? 'dialog' : undefined}
            aria-modal={mobileWorkspacePanel === 'inspector' ? true : undefined}
            aria-label={mobileWorkspacePanel === 'inspector' ? mobileInspectorLabel : undefined}
            tabIndex={mobileWorkspacePanel === 'inspector' ? -1 : undefined}
            onKeyDown={mobileWorkspacePanel === 'inspector' ? handleMobilePanelKeyDown : undefined}
          >
            <div className={styles.mobilePanelChrome}>
              <button
                type="button"
                className={styles.mobilePanelCloseButton}
                data-mobile-panel-close="true"
                aria-label={closeInspectorDrawerLabel}
                onClick={closeMobileWorkspacePanel}
              >
                <span>{mobileInspectorLabel}</span>
                <X size={16} aria-hidden="true" />
              </button>
              <div className={styles.mobilePanelContent}>
                {shouldShowCanvasInspector ? (
                  <NodeSettingsPanel
                    copy={studioCopy.canvas.nodes}
                    selectedNode={canvas.selectedNode}
                    edges={edges}
                    capabilities={capabilities}
                    onPatchNodeData={canvas.patchNodeData}
                    onPatchShot={canvas.patchShot}
                    onGenerateShot={canvas.handleGenerateShot}
                    onRunChat={canvas.handleRunChat}
                    onSendOutputToTimeline={canvas.handleSendOutputToTimeline}
                    onOpenAssetLibrary={canvas.handleOpenAssetLibrary}
                  />
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <div
            ref={mobileInspectorPanelRef}
            id="studio-inspector-panel"
            className={`${styles.inspectorPanelSlot} ${mobileWorkspacePanel === 'inspector' ? styles.mobilePanelOpen : ''}`}
            role={mobileWorkspacePanel === 'inspector' ? 'dialog' : undefined}
            aria-modal={mobileWorkspacePanel === 'inspector' ? true : undefined}
            aria-label={mobileWorkspacePanel === 'inspector' ? mobileInspectorLabel : undefined}
            tabIndex={mobileWorkspacePanel === 'inspector' ? -1 : undefined}
            onKeyDown={mobileWorkspacePanel === 'inspector' ? handleMobilePanelKeyDown : undefined}
          >
            <div className={styles.mobilePanelChrome}>
              <button
                type="button"
                className={styles.mobilePanelCloseButton}
                data-mobile-panel-close="true"
                aria-label={closeInspectorDrawerLabel}
                onClick={closeMobileWorkspacePanel}
              >
                <span>{mobileInspectorLabel}</span>
                <X size={16} aria-hidden="true" />
              </button>
              <div className={styles.mobilePanelContent}>
                <TimelineClipInspector
                  copy={studioCopy.timeline.inspector}
                  canvasNodeCopy={studioCopy.canvas.nodes}
                  projectMediaCopy={studioCopy.viewer.projectMedia}
                  selectedAsset={exportState.selectedProjectAssetForInspector}
                  selectedItem={exportState.selectedTimelineItem}
                  selectedSequence={exportState.selectedSequenceForInspector}
                  projectSettings={projectSettings}
                  projectFps={projectSettings.fps}
                  onPatchItem={timelineClip.handlePatchTimelineItem}
                  onRenameProjectAsset={projectMedia.handleRenameProjectAsset}
                  onRenameSequence={sequence.handleRenameActiveSequence}
                  onSequenceSettingsChange={shell.handleSequenceSettingsChange}
                />
              </div>
            </div>
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
