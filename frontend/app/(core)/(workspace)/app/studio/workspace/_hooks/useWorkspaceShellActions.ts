import { useCallback, type Dispatch, type SetStateAction } from 'react';
import {
  DEFAULT_WORKSPACE_PROJECT_SETTINGS,
  coerceWorkspaceProjectSettings,
} from '../_lib/workspace-project-settings';
import type { WorkspaceTimelineExportQualityPreset } from '../_lib/workspace-timeline-export';
import type { WorkspaceTimelineExportRangeMode } from '../_lib/workspace-timeline-render';
import type {
  WorkspaceProjectSettings,
  WorkspaceTemplateId,
} from '../_lib/workspace-types';
import { saveStudioWorkspaceToApi, type StudioApiSyncStatus } from '../_state/workspace-api-persistence';
import {
  coerceTimelinePanelHeight,
  type PersistedWorkspaceState,
} from '../_state/workspace-state';
import type { StudioCopy } from '../../_lib/studio-copy';

type UseWorkspaceShellActionsParams = {
  activeTemplateId: WorkspaceTemplateId;
  activeTemplateName: string;
  buildPersistedWorkspaceState: () => PersistedWorkspaceState;
  connected: boolean;
  exitReady: boolean;
  hasValidTimelineInOut: boolean;
  openExportDialog: () => void;
  projectId?: string;
  resetExportSession: () => void;
  setExportQualityPreset: Dispatch<SetStateAction<WorkspaceTimelineExportQualityPreset>>;
  setExportRangeMode: Dispatch<SetStateAction<WorkspaceTimelineExportRangeMode>>;
  setNotice: Dispatch<SetStateAction<string | null>>;
  setProjectSettings: Dispatch<SetStateAction<WorkspaceProjectSettings>>;
  setTimelinePanelHeight: Dispatch<SetStateAction<number | null>>;
  studioNotices: StudioCopy['notices'];
  workspaceStorageKey: string;
  persistWorkspaceLocally?: (state: PersistedWorkspaceState) => void;
  saveWorkspace?: (state: PersistedWorkspaceState) => Promise<StudioApiSyncStatus>;
};

type WorkspaceExitNotices = Pick<StudioCopy['notices'],
  'studioApiUnauthorized' | 'studioApiUnavailable' | 'workspaceConflict' | 'workspaceSavedReturningToProjects'>;

export async function completeStudioWorkspaceExit(params: {
  connected: boolean;
  save: () => Promise<StudioApiSyncStatus>;
  notices: WorkspaceExitNotices;
  setNotice: (notice: string) => void;
  navigate: () => void;
}): Promise<void> {
  if (!params.connected) {
    params.setNotice(params.notices.workspaceSavedReturningToProjects);
    await params.save().catch(() => 'error' as const);
    params.navigate();
    return;
  }
  const status = await params.save().catch(() => 'error' as const);
  if (status === 'ready') {
    params.setNotice(params.notices.workspaceSavedReturningToProjects);
    params.navigate();
    return;
  }
  params.setNotice(status === 'conflict'
    ? params.notices.workspaceConflict
    : status === 'unauthorized'
      ? params.notices.studioApiUnauthorized
      : params.notices.studioApiUnavailable);
}

export function useWorkspaceShellActions({
  activeTemplateId,
  activeTemplateName,
  buildPersistedWorkspaceState,
  connected,
  exitReady,
  hasValidTimelineInOut,
  openExportDialog,
  projectId,
  resetExportSession,
  setExportQualityPreset,
  setExportRangeMode,
  setNotice,
  setProjectSettings,
  setTimelinePanelHeight,
  studioNotices,
  workspaceStorageKey,
  persistWorkspaceLocally,
  saveWorkspace,
}: UseWorkspaceShellActionsParams): {
  exitToProjectsDisabled: boolean;
  handleExitToProjects: () => void;
  handleNavigateFromStudio: (href: string) => void;
  handleExportQualityPresetChange: (preset: WorkspaceTimelineExportQualityPreset) => void;
  handleExportRangeModeChange: (mode: WorkspaceTimelineExportRangeMode) => void;
  handleOpenExportDialog: () => void;
  handleSequenceSettingsChange: (patch: Partial<WorkspaceProjectSettings>) => void;
  handleTimelinePanelHeightChange: (height: number) => void;
} {
  const handleSequenceSettingsChange = useCallback((patch: Partial<WorkspaceProjectSettings>) => {
    setProjectSettings((current) =>
      coerceWorkspaceProjectSettings({ ...DEFAULT_WORKSPACE_PROJECT_SETTINGS, ...current, ...patch })
    );
  }, [setProjectSettings]);

  const handleOpenExportDialog = useCallback(() => {
    setExportRangeMode(hasValidTimelineInOut ? 'in-out' : 'sequence');
    openExportDialog();
  }, [hasValidTimelineInOut, openExportDialog, setExportRangeMode]);

  const handleNavigateFromStudio = useCallback((href: string) => {
    if (typeof window === 'undefined') return;
    if (!exitReady) {
      setNotice(studioNotices.studioApiUnavailable);
      return;
    }
    const state = buildPersistedWorkspaceState();
    if (persistWorkspaceLocally) persistWorkspaceLocally(state);
    else window.localStorage.setItem(workspaceStorageKey, JSON.stringify(state));
    const safeHref = href.startsWith('/') && !href.startsWith('//') ? href : '/app/studio/projects';
    const navigate = () => {
      window.location.assign(safeHref);
    };

    const save = () => !projectId
      ? Promise.resolve('ready' as const)
      : saveWorkspace
        ? saveWorkspace(state)
        : saveStudioWorkspaceToApi({
          projectId,
          name: activeTemplateName,
          canvasTemplateId: activeTemplateId,
          settings: state.projectSettings,
          workspaceState: state,
        }).then(({ status }) => status);
    void completeStudioWorkspaceExit({
      connected,
      save,
      notices: studioNotices,
      setNotice,
      navigate,
    });
  }, [activeTemplateId, activeTemplateName, buildPersistedWorkspaceState, connected, exitReady, persistWorkspaceLocally, projectId, saveWorkspace, setNotice, studioNotices, workspaceStorageKey]);

  const handleExitToProjects = useCallback(() => {
    handleNavigateFromStudio('/app/studio/projects');
  }, [handleNavigateFromStudio]);

  const handleExportRangeModeChange = useCallback((mode: WorkspaceTimelineExportRangeMode) => {
    resetExportSession();
    setExportRangeMode(mode);
  }, [resetExportSession, setExportRangeMode]);

  const handleExportQualityPresetChange = useCallback((preset: WorkspaceTimelineExportQualityPreset) => {
    resetExportSession();
    setExportQualityPreset(preset);
  }, [resetExportSession, setExportQualityPreset]);

  const handleTimelinePanelHeightChange = useCallback((height: number) => {
    setTimelinePanelHeight(coerceTimelinePanelHeight(height));
  }, [setTimelinePanelHeight]);

  return {
    exitToProjectsDisabled: !exitReady,
    handleExitToProjects,
    handleNavigateFromStudio,
    handleExportQualityPresetChange,
    handleExportRangeModeChange,
    handleOpenExportDialog,
    handleSequenceSettingsChange,
    handleTimelinePanelHeightChange,
  };
}
