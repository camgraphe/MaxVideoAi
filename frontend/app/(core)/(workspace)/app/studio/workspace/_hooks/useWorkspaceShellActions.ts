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
import { saveStudioWorkspaceToApi } from '../_state/workspace-api-persistence';
import {
  coerceTimelinePanelHeight,
  type PersistedWorkspaceState,
} from '../_state/workspace-state';
import type { StudioCopy } from '../../_lib/studio-copy';

type UseWorkspaceShellActionsParams = {
  activeTemplateId: WorkspaceTemplateId;
  activeTemplateName: string;
  buildPersistedWorkspaceState: () => PersistedWorkspaceState;
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
};

export function useWorkspaceShellActions({
  activeTemplateId,
  activeTemplateName,
  buildPersistedWorkspaceState,
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
}: UseWorkspaceShellActionsParams): {
  handleExitToProjects: () => void;
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

  const handleExitToProjects = useCallback(() => {
    if (typeof window === 'undefined') return;
    const state = buildPersistedWorkspaceState();
    window.localStorage.setItem(workspaceStorageKey, JSON.stringify(state));
    setNotice(studioNotices.workspaceSavedReturningToProjects);

    const navigateToProjects = () => {
      window.location.assign('/app/studio/projects');
    };

    if (!projectId) {
      navigateToProjects();
      return;
    }

    void saveStudioWorkspaceToApi({
      projectId,
      name: activeTemplateName,
      canvasTemplateId: activeTemplateId,
      settings: state.projectSettings,
      workspaceState: state,
    }).finally(navigateToProjects);
  }, [activeTemplateId, activeTemplateName, buildPersistedWorkspaceState, projectId, setNotice, studioNotices.workspaceSavedReturningToProjects, workspaceStorageKey]);

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
    handleExitToProjects,
    handleExportQualityPresetChange,
    handleExportRangeModeChange,
    handleOpenExportDialog,
    handleSequenceSettingsChange,
    handleTimelinePanelHeightChange,
  };
}
