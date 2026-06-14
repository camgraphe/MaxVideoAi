'use client';

import { GitBranch, Moon, PanelRight, Settings, Sun } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { StudioHeaderSession } from './StudioHeaderSession';
import { StudioLanguageToggle } from './StudioLanguageToggle';
import type { WorkspaceEditorSurface, WorkspaceFocusMode } from '../_state/workspace-state';
import type { useStudioThemeMode } from '../../_hooks/useStudioThemeMode';
import { localizeStudioGeneratedProjectDisplayName, type StudioCopy } from '../../_lib/studio-copy';
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
  onToggleMockMode: () => void;
  studioCopy: StudioCopy;
  studioTheme: ReturnType<typeof useStudioThemeMode>;
};

export function WorkspaceEditorTopbar({
  activeTemplateName,
  focusMode,
  mockMode,
  onEditorSurfaceChange,
  onExitToProjects,
  onFocusModeChange,
  onToggleMockMode,
  studioCopy,
  studioTheme,
}: WorkspaceEditorTopbarProps) {
  const [isHydrated, setIsHydrated] = useState(false);
  const displayTemplateName = localizeStudioGeneratedProjectDisplayName(activeTemplateName, studioCopy);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

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
          <span>{studioCopy.topbar.breadcrumbProjects} / {displayTemplateName} / {studioCopy.topbar.breadcrumbWorkspace}</span>
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
        <button type="button" className={styles.iconButton} onClick={onToggleMockMode} aria-label={studioCopy.topbar.mockAria}>
          <Settings size={15} />
          <span>{mockMode ? studioCopy.topbar.mock : studioCopy.topbar.live}</span>
        </button>
        <StudioHeaderSession onExitToProjects={onExitToProjects} studioCopy={studioCopy} />
        <div className={styles.topbarActions}>
          <StudioLanguageToggle />
          {isHydrated ? (
            <button
              type="button"
              className={styles.iconButton}
              onClick={studioTheme.toggleResolvedTheme}
              aria-label={studioTheme.resolvedTheme === 'light' ? studioCopy.topbar.switchToDark : studioCopy.topbar.switchToLight}
              title={studioTheme.resolvedTheme === 'light' ? studioCopy.topbar.switchToDark : studioCopy.topbar.switchToLight}
            >
              {studioTheme.resolvedTheme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
