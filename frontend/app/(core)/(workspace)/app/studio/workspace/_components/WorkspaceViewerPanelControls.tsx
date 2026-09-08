'use client';

import {
  Maximize2,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';
import type { StudioCopy } from '../../_lib/studio-copy';
import type { WorkspaceViewerPanels } from '../_hooks/useWorkspaceViewerPanels';
import styles from '../_styles/shell.module.css';

type WorkspaceViewerPanelControlsProps = {
  copy: StudioCopy['viewer']['controls'];
  panels: WorkspaceViewerPanels;
};

export function WorkspaceViewerPanelControls({ copy, panels }: WorkspaceViewerPanelControlsProps) {
  return (
    <nav className={styles.viewerPanelControls} aria-label={copy.viewerLayout} data-viewer-panel-controls="true">
      {!panels.isViewerFocused ? (
        <>
          <button
            type="button"
            className={styles.viewerPanelToggle}
            aria-label={panels.mediaVisible ? copy.hideProjectMedia : copy.showProjectMedia}
            aria-controls="studio-project-media-panel"
            aria-expanded={panels.mediaVisible}
            title={panels.mediaVisible ? copy.hideProjectMedia : copy.showProjectMedia}
            onClick={panels.toggleMedia}
          >
            {panels.mediaVisible ? <PanelLeftClose size={17} /> : <PanelLeftOpen size={17} />}
          </button>
          <button
            type="button"
            className={styles.viewerPanelToggle}
            aria-label={panels.inspectorVisible ? copy.hideInspector : copy.showInspector}
            aria-controls="studio-inspector-panel"
            aria-expanded={panels.inspectorVisible}
            title={panels.inspectorVisible ? copy.hideInspector : copy.showInspector}
            onClick={panels.toggleInspector}
          >
            {panels.inspectorVisible ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}
          </button>
        </>
      ) : null}
      <button
        type="button"
        className={styles.viewerPanelToggle}
        aria-label={panels.isViewerFocused ? copy.exitViewerFocus : copy.focusViewer}
        aria-pressed={panels.isViewerFocused}
        title={panels.isViewerFocused ? copy.exitViewerFocus : copy.focusViewer}
        onClick={panels.isViewerFocused ? panels.exitViewerFocus : panels.enterViewerFocus}
      >
        {panels.isViewerFocused ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
      </button>
    </nav>
  );
}
