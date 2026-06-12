'use client';

import { Download, GitBranch, PanelRight, Settings } from 'lucide-react';
import Image from 'next/image';
import { StudioHeaderSession } from './StudioHeaderSession';
import type { WorkspaceEditorSurface, WorkspaceFocusMode } from '../_state/workspace-state';
import type { StudioCopy } from '../../_lib/studio-copy';
import baseStyles from '../maxvideoai-editor.module.css';
import shellStyles from '../_styles/shell.module.css';

const styles = { ...baseStyles, ...shellStyles };

type WorkspaceEditorTopbarProps = {
  activeTemplateName: string;
  focusMode: WorkspaceFocusMode;
  mockMode: boolean;
  onEditorSurfaceChange: (surface: WorkspaceEditorSurface) => void;
  onExitToProjects: () => void;
  onFocusModeChange: (focusMode: WorkspaceFocusMode) => void;
  onOpenExportDialog: () => void;
  onToggleMockMode: () => void;
  studioCopy: StudioCopy;
};

export function WorkspaceEditorTopbar({
  activeTemplateName,
  focusMode,
  mockMode,
  onEditorSurfaceChange,
  onExitToProjects,
  onFocusModeChange,
  onOpenExportDialog,
  onToggleMockMode,
  studioCopy,
}: WorkspaceEditorTopbarProps) {
  return (
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
          <p>{studioCopy.topbar.productName}</p>
          <span>{studioCopy.topbar.breadcrumbProjects} / {activeTemplateName} / {studioCopy.topbar.breadcrumbWorkspace}</span>
        </div>
      </div>
      <div className={styles.modeSwitch} aria-label={studioCopy.topbar.workspaceViewLabel}>
        <button
          type="button"
          className={focusMode === 'canvas' ? styles.modeActive : ''}
          aria-pressed={focusMode === 'canvas'}
          onClick={() => {
            onFocusModeChange('canvas');
            onEditorSurfaceChange('canvas');
          }}
        >
          <GitBranch size={14} />
          {studioCopy.topbar.canvas}
        </button>
        <button
          type="button"
          className={focusMode === 'viewer' ? styles.modeActive : ''}
          aria-pressed={focusMode === 'viewer'}
          onClick={() => {
            onFocusModeChange('viewer');
            onEditorSurfaceChange('timeline');
          }}
        >
          <PanelRight size={14} />
          {studioCopy.topbar.viewer}
        </button>
      </div>
      <div className={styles.topbarRight}>
        <StudioHeaderSession onExitToProjects={onExitToProjects} />
        <div className={styles.topbarActions}>
          <button type="button" className={styles.exportButton} onClick={onOpenExportDialog} aria-label={studioCopy.topbar.exportAria}>
            <Download size={15} />
            {studioCopy.topbar.export}
          </button>
          <button type="button" className={styles.iconButton} onClick={onToggleMockMode} aria-label={studioCopy.topbar.mockAria}>
            <Settings size={15} />
            <span>{mockMode ? studioCopy.topbar.mock : studioCopy.topbar.live}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
