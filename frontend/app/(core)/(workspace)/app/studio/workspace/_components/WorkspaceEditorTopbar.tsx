'use client';

import { Download, GitBranch, PanelRight, Settings } from 'lucide-react';
import Image from 'next/image';
import { StudioHeaderSession } from './StudioHeaderSession';
import type { WorkspaceEditorSurface, WorkspaceFocusMode } from '../_state/workspace-state';
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
            onFocusModeChange('canvas');
            onEditorSurfaceChange('canvas');
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
            onFocusModeChange('viewer');
            onEditorSurfaceChange('timeline');
          }}
        >
          <PanelRight size={14} />
          Viewer
        </button>
      </div>
      <div className={styles.topbarRight}>
        <StudioHeaderSession onExitToProjects={onExitToProjects} />
        <div className={styles.topbarActions}>
          <button type="button" className={styles.exportButton} onClick={onOpenExportDialog} aria-label="Open export dialog">
            <Download size={15} />
            Export
          </button>
          <button type="button" className={styles.iconButton} onClick={onToggleMockMode} aria-label="Toggle mock generation">
            <Settings size={15} />
            <span>{mockMode ? 'Mock' : 'Live'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
