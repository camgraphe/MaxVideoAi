import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { defaultSelectedNodeId } from '../_lib/workspace-graph-helpers';
import {
  DEFAULT_WORKSPACE_PROJECT_SETTINGS,
  coerceWorkspaceProjectSettings,
} from '../_lib/workspace-project-settings';
import { defaultTimelineSelectionIds } from '../_lib/workspace-timeline-selection';
import type {
  WorkspaceAssetRecord,
  WorkspaceGraphEdge,
  WorkspaceGraphNode,
  WorkspaceProjectSettings,
  WorkspaceTemplateId,
  WorkspaceTimelineAudioTrack,
  WorkspaceTimelineItem,
  WorkspaceTimelineTrack,
  WorkspaceTimelineVideoTrack,
} from '../_lib/workspace-types';
import {
  createStarterWorkspaceTemplate,
} from '../_lib/workspace-templates';
import {
  normalizePersistedWorkspaceState,
  normalizeUserCanvasTemplate,
  readStudioProjectFromApi,
  readUserCanvasTemplatesFromApi,
  saveStudioProjectToApi,
} from '../_state/workspace-api-persistence';
import {
  readPersistedWorkspaceState,
  readStudioProject,
  readUserCanvasTemplates,
  writeUserCanvasTemplates,
} from '../_state/workspace-persistence';
import {
  DEFAULT_WORKSPACE_SEQUENCE_ID,
  audioTrackCountForTimelineItems,
  coerceAudioTrackCount,
  coerceVideoTrackCount,
  createWorkspaceSequenceRecord,
  videoTrackCountForTimelineItems,
  type PersistedWorkspaceState,
  type StudioProjectStorageRecord,
  type WorkspaceEditorSurface,
  type WorkspaceFocusMode,
  type WorkspaceSequenceRecord,
  type WorkspaceUserCanvasTemplate,
} from '../_state/workspace-state';
import { sequenceNameForIndex } from '../_state/workspace-selectors';

type UseWorkspacePersistenceEffectsParams = {
  activeTemplateId: WorkspaceTemplateId;
  activeTemplateName: string;
  applyTimelineSelection: (itemIds: string[]) => void;
  buildPersistedWorkspaceState: () => PersistedWorkspaceState;
  hydrated: boolean;
  projectId?: string;
  resetTimelineHistory: () => void;
  setActiveEditorSurface: Dispatch<SetStateAction<WorkspaceEditorSurface>>;
  setActiveSequenceId: Dispatch<SetStateAction<string>>;
  setActiveTemplateId: Dispatch<SetStateAction<WorkspaceTemplateId>>;
  setActiveUserCanvasTemplateId: Dispatch<SetStateAction<string | null>>;
  setAudioTrackCount: Dispatch<SetStateAction<number>>;
  setCanvasRevision: Dispatch<SetStateAction<number>>;
  setEdges: Dispatch<SetStateAction<WorkspaceGraphEdge[]>>;
  setFocusMode: Dispatch<SetStateAction<WorkspaceFocusMode>>;
  setHiddenVideoTracks: Dispatch<SetStateAction<WorkspaceTimelineVideoTrack[]>>;
  setHydrated: Dispatch<SetStateAction<boolean>>;
  setIsTimelinePlaying: Dispatch<SetStateAction<boolean>>;
  setLockedTimelineTracks: Dispatch<SetStateAction<WorkspaceTimelineTrack[]>>;
  setMutedAudioTracks: Dispatch<SetStateAction<WorkspaceTimelineAudioTrack[]>>;
  setNodes: Dispatch<SetStateAction<WorkspaceGraphNode[]>>;
  setNotice: Dispatch<SetStateAction<string | null>>;
  setPlayheadSec: Dispatch<SetStateAction<number>>;
  setProjectAssets: Dispatch<SetStateAction<WorkspaceAssetRecord[]>>;
  setProjectSettings: Dispatch<SetStateAction<WorkspaceProjectSettings>>;
  setSelectedNodeId: Dispatch<SetStateAction<string | null>>;
  setSequences: Dispatch<SetStateAction<WorkspaceSequenceRecord[]>>;
  setStoredProjectName: Dispatch<SetStateAction<string | null>>;
  setTimelineInPointSec: Dispatch<SetStateAction<number | null>>;
  setTimelineItems: Dispatch<SetStateAction<WorkspaceTimelineItem[]>>;
  setTimelineOutPointSec: Dispatch<SetStateAction<number | null>>;
  setTimelinePanelHeight: Dispatch<SetStateAction<number | null>>;
  setUserCanvasTemplates: Dispatch<SetStateAction<WorkspaceUserCanvasTemplate[]>>;
  setVideoTrackCount: Dispatch<SetStateAction<number>>;
  timelineItemsRef: MutableRefObject<WorkspaceTimelineItem[]>;
  workspaceStorageKey: string;
};

export function useWorkspacePersistenceEffects({
  activeTemplateId,
  activeTemplateName,
  applyTimelineSelection,
  buildPersistedWorkspaceState,
  hydrated,
  projectId,
  resetTimelineHistory,
  setActiveEditorSurface,
  setActiveSequenceId,
  setActiveTemplateId,
  setActiveUserCanvasTemplateId,
  setAudioTrackCount,
  setCanvasRevision,
  setEdges,
  setFocusMode,
  setHiddenVideoTracks,
  setHydrated,
  setIsTimelinePlaying,
  setLockedTimelineTracks,
  setMutedAudioTracks,
  setNodes,
  setNotice,
  setPlayheadSec,
  setProjectAssets,
  setProjectSettings,
  setSelectedNodeId,
  setSequences,
  setStoredProjectName,
  setTimelineInPointSec,
  setTimelineItems,
  setTimelineOutPointSec,
  setTimelinePanelHeight,
  setUserCanvasTemplates,
  setVideoTrackCount,
  timelineItemsRef,
  workspaceStorageKey,
}: UseWorkspacePersistenceEffectsParams): void {
  useEffect(() => {
    let cancelled = false;

    const applyPersistedWorkspace = (persisted: PersistedWorkspaceState) => {
      if (cancelled) return;
      const persistedActiveSequenceId = persisted.activeSequenceId ?? DEFAULT_WORKSPACE_SEQUENCE_ID;
      const persistedSequences = persisted.sequences?.length
        ? persisted.sequences
        : [createWorkspaceSequenceRecord({
            id: persistedActiveSequenceId,
            name: sequenceNameForIndex(1),
            timelineItems: persisted.timelineItems,
            projectSettings: persisted.projectSettings,
            audioTrackCount: persisted.audioTrackCount,
            hiddenVideoTracks: persisted.hiddenVideoTracks,
            lockedTimelineTracks: persisted.lockedTimelineTracks,
            mutedAudioTracks: persisted.mutedAudioTracks,
            videoTrackCount: persisted.videoTrackCount,
            timelinePanelHeight: persisted.timelinePanelHeight,
            timelineInPointSec: persisted.timelineInPointSec,
            timelineOutPointSec: persisted.timelineOutPointSec,
          })];
      setNodes(persisted.nodes);
      setEdges(persisted.edges);
      setProjectAssets(persisted.projectAssets ?? []);
      setSequences(persistedSequences);
      setActiveSequenceId(persistedActiveSequenceId);
      setTimelineItems(persisted.timelineItems);
      timelineItemsRef.current = persisted.timelineItems;
      applyTimelineSelection(defaultTimelineSelectionIds(persisted.timelineItems));
      setPlayheadSec(0);
      setIsTimelinePlaying(false);
      resetTimelineHistory();
      setActiveTemplateId(persisted.activeTemplateId);
      setProjectSettings(persisted.projectSettings);
      setFocusMode(persisted.focusMode ?? 'canvas');
      setActiveEditorSurface((persisted.focusMode ?? 'canvas') === 'viewer' ? 'timeline' : 'canvas');
      setAudioTrackCount(coerceAudioTrackCount(persisted.audioTrackCount, persisted.timelineItems));
      setHiddenVideoTracks(persisted.hiddenVideoTracks ?? []);
      setLockedTimelineTracks(persisted.lockedTimelineTracks ?? []);
      setMutedAudioTracks(persisted.mutedAudioTracks ?? []);
      setVideoTrackCount(coerceVideoTrackCount(persisted.videoTrackCount, persisted.timelineItems));
      setTimelinePanelHeight(persisted.timelinePanelHeight ?? null);
      setTimelineInPointSec(persisted.timelineInPointSec ?? null);
      setTimelineOutPointSec(persisted.timelineOutPointSec ?? null);
      setCanvasRevision((value) => value + 1);
    };

    const applyStoredProjectWorkspace = (project: StudioProjectStorageRecord) => {
      if (cancelled) return;
      const template = createStarterWorkspaceTemplate(project.canvasTemplateId ?? 'product-ad');
      const emptyTimelineItems: WorkspaceTimelineItem[] = [];
      const cleanSequence = createWorkspaceSequenceRecord({
        id: DEFAULT_WORKSPACE_SEQUENCE_ID,
        name: sequenceNameForIndex(1),
        timelineItems: emptyTimelineItems,
        projectSettings: coerceWorkspaceProjectSettings(project.settings ?? DEFAULT_WORKSPACE_PROJECT_SETTINGS),
      });
      setNodes(template.nodes);
      setEdges(template.edges);
      setProjectAssets([]);
      setSequences([cleanSequence]);
      setActiveSequenceId(cleanSequence.id);
      setTimelineItems(emptyTimelineItems);
      timelineItemsRef.current = emptyTimelineItems;
      applyTimelineSelection([]);
      setPlayheadSec(0);
      setIsTimelinePlaying(false);
      resetTimelineHistory();
      setActiveTemplateId(template.id);
      setActiveUserCanvasTemplateId(null);
      setProjectSettings(coerceWorkspaceProjectSettings(project.settings ?? DEFAULT_WORKSPACE_PROJECT_SETTINGS));
      setFocusMode('canvas');
      setActiveEditorSurface('canvas');
      setAudioTrackCount(audioTrackCountForTimelineItems(emptyTimelineItems));
      setHiddenVideoTracks([]);
      setLockedTimelineTracks([]);
      setMutedAudioTracks([]);
      setVideoTrackCount(videoTrackCountForTimelineItems(emptyTimelineItems));
      setTimelinePanelHeight(null);
      setTimelineInPointSec(null);
      setTimelineOutPointSec(null);
      setSelectedNodeId(defaultSelectedNodeId(template.nodes, template.id));
      setCanvasRevision((value) => value + 1);
      setNotice(`${project.name} project loaded with a clean sequence.`);
    };

    const localUserTemplates = readUserCanvasTemplates(normalizeUserCanvasTemplate);
    setUserCanvasTemplates(localUserTemplates);
    const templatesController = new AbortController();
    void readUserCanvasTemplatesFromApi(templatesController.signal).then((serverTemplates) => {
      if (cancelled || !serverTemplates) return;
      setUserCanvasTemplates(serverTemplates);
      writeUserCanvasTemplates(serverTemplates);
    });

    const storedProject = readStudioProject(projectId);
    setStoredProjectName(storedProject?.name ?? null);
    const persisted = readPersistedWorkspaceState(workspaceStorageKey, normalizePersistedWorkspaceState);
    if (persisted) {
      applyPersistedWorkspace(persisted);
    } else if (storedProject) {
      applyStoredProjectWorkspace(storedProject);
    }
    setHydrated(true);

    const projectController = new AbortController();
    if (projectId) {
      void readStudioProjectFromApi(projectId, projectController.signal).then((serverProject) => {
        if (cancelled || !serverProject) return;
        setStoredProjectName(serverProject.name);
        const serverPersisted = normalizePersistedWorkspaceState(serverProject.workspaceState);
        if (serverPersisted) {
          applyPersistedWorkspace(serverPersisted);
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(workspaceStorageKey, JSON.stringify(serverPersisted));
          }
          return;
        }
        if (!persisted && !storedProject) {
          applyStoredProjectWorkspace(serverProject);
        }
      });
    }

    return () => {
      cancelled = true;
      templatesController.abort();
      projectController.abort();
    };
  }, [
    applyTimelineSelection,
    projectId,
    resetTimelineHistory,
    setActiveEditorSurface,
    setActiveSequenceId,
    setActiveTemplateId,
    setActiveUserCanvasTemplateId,
    setAudioTrackCount,
    setCanvasRevision,
    setEdges,
    setFocusMode,
    setHiddenVideoTracks,
    setHydrated,
    setIsTimelinePlaying,
    setLockedTimelineTracks,
    setMutedAudioTracks,
    setNodes,
    setNotice,
    setPlayheadSec,
    setProjectAssets,
    setProjectSettings,
    setSelectedNodeId,
    setSequences,
    setStoredProjectName,
    setTimelineInPointSec,
    setTimelineItems,
    setTimelineOutPointSec,
    setTimelinePanelHeight,
    setUserCanvasTemplates,
    setVideoTrackCount,
    timelineItemsRef,
    workspaceStorageKey,
  ]);

  useEffect(() => {
    if (!hydrated || typeof window === 'undefined') return;
    const state = buildPersistedWorkspaceState();
    window.localStorage.setItem(workspaceStorageKey, JSON.stringify(state));
  }, [buildPersistedWorkspaceState, hydrated, workspaceStorageKey]);

  useEffect(() => {
    if (!hydrated || !projectId || typeof window === 'undefined') return undefined;
    const state = buildPersistedWorkspaceState();
    const controller = new AbortController();
    const saveTimer = window.setTimeout(() => {
      void saveStudioProjectToApi({
        projectId,
        name: activeTemplateName,
        canvasTemplateId: activeTemplateId,
        settings: state.projectSettings,
        workspaceState: state,
        signal: controller.signal,
      });
    }, 900);

    return () => {
      window.clearTimeout(saveTimer);
      controller.abort();
    };
  }, [activeTemplateId, activeTemplateName, buildPersistedWorkspaceState, hydrated, projectId]);
}
