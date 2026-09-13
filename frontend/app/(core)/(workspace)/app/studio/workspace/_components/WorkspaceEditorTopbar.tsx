'use client';

import { GitBranch, PanelRight } from 'lucide-react';
import { usePathname, useSearchParams } from 'next/navigation';
import { AppSiteMenuButton } from '@/components/app/AppSiteMenu.client';
import { useHeaderAccountState } from '@/components/header/useHeaderAccountState';
import { buildAuthReturnTarget, buildLoginHref } from '@/lib/auth-entry-href';
import { StudioHeaderSession } from './StudioHeaderSession';
import type { WorkspaceEditorSurface, WorkspaceFocusMode } from '../_state/workspace-state';
import type { useStudioThemeMode } from '../../_hooks/useStudioThemeMode';
import { localizeStudioGeneratedProjectDisplayName, type StudioCopy } from '../../_lib/studio-copy';
import baseStyles from '../maxvideoai-editor.module.css';
import shellStyles from '../_styles/shell.module.css';

const styles = { ...baseStyles, ...shellStyles };

type WorkspaceEditorTopbarProps = {
  activeTemplateName: string;
  exitToProjectsDisabled: boolean;
  focusMode: WorkspaceFocusMode;
  onAppNavigate: (href: string) => void;
  onEditorSurfaceChange: (surface: WorkspaceEditorSurface) => void;
  onExitToProjects: () => void;
  onFocusModeChange: (focusMode: WorkspaceFocusMode) => void;
  studioCopy: StudioCopy;
  studioTheme: ReturnType<typeof useStudioThemeMode>;
};

export function WorkspaceEditorTopbar({
  activeTemplateName,
  exitToProjectsDisabled,
  focusMode,
  onAppNavigate,
  onEditorSurfaceChange,
  onExitToProjects,
  onFocusModeChange,
  studioCopy,
  studioTheme,
}: WorkspaceEditorTopbarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const account = useHeaderAccountState();
  const displayTemplateName = localizeStudioGeneratedProjectDisplayName(activeTemplateName, studioCopy);
  const authReturnTarget = buildAuthReturnTarget(pathname, searchParams);
  const signinHref = buildLoginHref({ mode: 'signin', nextPath: authReturnTarget });
  const signupHref = buildLoginHref({ mode: 'signup', nextPath: authReturnTarget });
  const themeToggleLabel = studioTheme.resolvedTheme === 'light'
    ? studioCopy.topbar.switchToDark
    : studioCopy.topbar.switchToLight;

  return (
    <header className={styles.editorTopbar}>
      <div className={styles.brandCluster}>
        <AppSiteMenuButton
          email={account.email}
          authResolved={account.authResolved}
          isAdmin={account.isAdmin}
          signinHref={signinHref}
          signupHref={signupHref}
          themeToggleLabel={themeToggleLabel}
          onToggleTheme={studioTheme.toggleResolvedTheme}
          onSignOut={account.signOut}
          onAppNavigate={onAppNavigate}
          studioVisible
        />
        <div className={styles.projectIdentity}>
          <button type="button" className={styles.projectsButton} disabled={exitToProjectsDisabled} onClick={onExitToProjects}>{studioCopy.topbar.breadcrumbProjects}</button>
          <p title={displayTemplateName}>{displayTemplateName}</p>
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
          data-studio-guide-anchor="viewer-tab"
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
        <StudioHeaderSession
          account={account}
          exitToProjectsDisabled={exitToProjectsDisabled}
          onExitToProjects={onExitToProjects}
          studioCopy={studioCopy}
        />
      </div>
    </header>
  );
}
