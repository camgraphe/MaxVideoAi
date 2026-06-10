'use client';

import type { ComponentProps, CSSProperties } from 'react';
import { NodeLibrarySidebar } from './NodeLibrarySidebar';
import { NodeSettingsPanel } from './NodeSettingsPanel';
import { TimelineClipInspector } from './TimelineClipInspector';
import { TimelineProjectSidebar } from './TimelineProjectSidebar';
import { WorkspaceCanvas } from './WorkspaceCanvas.client';
import { WorkspaceEditorTopbar } from './WorkspaceEditorTopbar';
import { WorkspaceRuntimeModals } from './WorkspaceRuntimeModals';
import { WorkspaceTimeline } from './WorkspaceTimeline';
import { WorkspaceVideoViewer } from './WorkspaceVideoViewer';
import { WORKSPACE_TEMPLATE_SUMMARIES } from '../_lib/workspace-templates';
import {
  MAX_TIMELINE_AUDIO_TRACKS,
  MAX_TIMELINE_PANEL_HEIGHT,
  MAX_TIMELINE_VIDEO_TRACKS,
  MIN_TIMELINE_AUDIO_TRACKS,
  MIN_TIMELINE_PANEL_HEIGHT,
  type WorkspaceEditorSurface,
  type WorkspaceFocusMode,
} from '../_state/workspace-state';
import baseStyles from '../maxvideoai-editor.module.css';
import shellStyles from '../_styles/shell.module.css';

const styles = { ...baseStyles, ...shellStyles };

type WorkspaceEditorLayoutProps = {
  activeEditorSurface: WorkspaceEditorSurface;
  canvasKey: string;
  canvasProps: ComponentProps<typeof WorkspaceCanvas>;
  focusMode: WorkspaceFocusMode;
  nodeLibraryProps: Omit<ComponentProps<typeof NodeLibrarySidebar>, 'templates'>;
  nodeSettingsProps: ComponentProps<typeof NodeSettingsPanel>;
  notice: string | null;
  runtimeModalsProps: ComponentProps<typeof WorkspaceRuntimeModals>;
  timelineClipInspectorProps: ComponentProps<typeof TimelineClipInspector>;
  timelinePanelHeight: number | null;
  timelineProjectSidebarProps: ComponentProps<typeof TimelineProjectSidebar>;
  timelineProps: Omit<
    ComponentProps<typeof WorkspaceTimeline>,
    | 'maxAudioTrackCount'
    | 'maxPanelHeight'
    | 'maxVideoTrackCount'
    | 'minAudioTrackCount'
    | 'minPanelHeight'
  >;
  topbarProps: ComponentProps<typeof WorkspaceEditorTopbar>;
  videoViewerProps: ComponentProps<typeof WorkspaceVideoViewer>;
};

export function WorkspaceEditorLayout({
  activeEditorSurface,
  canvasKey,
  canvasProps,
  focusMode,
  nodeLibraryProps,
  nodeSettingsProps,
  notice,
  runtimeModalsProps,
  timelineClipInspectorProps,
  timelinePanelHeight,
  timelineProjectSidebarProps,
  timelineProps,
  topbarProps,
  videoViewerProps,
}: WorkspaceEditorLayoutProps) {
  const editorShellStyle = timelinePanelHeight
    ? ({ '--timeline-panel-height': `${timelinePanelHeight}px` } as CSSProperties)
    : undefined;

  return (
    <main
      className={`${styles.editorShell} ${focusMode === 'viewer' ? `${baseStyles.viewerFocus} ${shellStyles.viewerFocus}` : ''}`}
      style={editorShellStyle}
      data-active-editor-surface={activeEditorSurface}
    >
      <WorkspaceEditorTopbar {...topbarProps} />

      {notice ? (
        <div className={styles.editorToast} role="status" aria-live="polite" data-editor-status="true">
          {notice}
        </div>
      ) : null}

      <div className={styles.editorBody}>
        {focusMode === 'canvas' ? (
          <NodeLibrarySidebar templates={WORKSPACE_TEMPLATE_SUMMARIES} {...nodeLibraryProps} />
        ) : (
          <TimelineProjectSidebar {...timelineProjectSidebarProps} />
        )}
        {focusMode === 'canvas' ? (
          <WorkspaceCanvas key={canvasKey} {...canvasProps} />
        ) : (
          <WorkspaceVideoViewer {...videoViewerProps} />
        )}
        {focusMode === 'canvas' ? (
          <NodeSettingsPanel {...nodeSettingsProps} />
        ) : (
          <TimelineClipInspector {...timelineClipInspectorProps} />
        )}
      </div>

      <WorkspaceTimeline
        maxAudioTrackCount={MAX_TIMELINE_AUDIO_TRACKS}
        maxPanelHeight={MAX_TIMELINE_PANEL_HEIGHT}
        maxVideoTrackCount={MAX_TIMELINE_VIDEO_TRACKS}
        minAudioTrackCount={MIN_TIMELINE_AUDIO_TRACKS}
        minPanelHeight={MIN_TIMELINE_PANEL_HEIGHT}
        {...timelineProps}
      />
      <WorkspaceRuntimeModals {...runtimeModalsProps} />
    </main>
  );
}
