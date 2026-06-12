import { useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import {
  DEFAULT_WORKSPACE_PROJECT_SETTINGS,
  coerceWorkspaceProjectSettings,
} from '../_lib/workspace-project-settings';
import { defaultTimelineSelectionIds } from '../_lib/workspace-timeline-selection';
import type {
  WorkspaceAssetRecord,
  WorkspaceGraphEdge,
  WorkspaceGraphNode,
  WorkspaceProjectMediaFolder,
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
  mergePersistedWorkspaceWithServerSequences,
  readStudioProjectFromApiResult as readStudioProjectFromApi,
  readStudioSequencesFromApiResult as readStudioSequencesFromApi,
  readUserCanvasTemplatesFromApiResult,
  saveStudioWorkspaceToApi,
  shouldApplyStudioProjectWorkspaceState,
  type StudioApiSyncStatus,
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
import type { StudioCopy } from '../../_lib/studio-copy';

function formatNotice(value: string, replacements: Record<string, string | number>): string {
  return Object.entries(replacements).reduce(
    (current, [key, replacement]) => current.replaceAll(`{${key}}`, String(replacement)),
    value
  );
}

function workspaceApiNotice(status: StudioApiSyncStatus, notices: StudioCopy['notices']): string | null {
  if (status === 'ready') return null;
  if (status === 'unauthorized') return notices.studioApiUnauthorized;
  if (status === 'unavailable') return notices.studioApiUnavailable;
  return null;
}

type UseWorkspacePersistenceEffectsParams = {
  activeTemplateId: WorkspaceTemplateId;
  activeTemplateName: string;
  applyTimelineSelection: (itemIds: string[]) => void;
  buildPersistedWorkspaceState: () => PersistedWorkspaceState;
  hydrated: boolean;
  projectId?: string;
  resetCanvasHistory: () => void;
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
  setProjectMediaFolders: Dispatch<SetStateAction<WorkspaceProjectMediaFolder[]>>;
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
  studioNotices: StudioCopy['notices'];
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
  resetCanvasHistory,
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
  setProjectMediaFolders,
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
  studioNotices,
  timelineItemsRef,
  workspaceStorageKey,
}: UseWorkspacePersistenceEffectsParams): void {
  const notifiedAutosaveFallbackStatusesRef = useRef<Set<StudioApiSyncStatus>>(new Set());

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
      setProjectMediaFolders(persisted.projectMediaFolders ?? []);
      setSequences(persistedSequences);
      setActiveSequenceId(persistedActiveSequenceId);
      setTimelineItems(persisted.timelineItems);
      timelineItemsRef.current = persisted.timelineItems;
      applyTimelineSelection(defaultTimelineSelectionIds(persisted.timelineItems));
      setPlayheadSec(0);
      setIsTimelinePlaying(false);
      resetCanvasHistory();
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
      setProjectMediaFolders([]);
      setSequences([cleanSequence]);
      setActiveSequenceId(cleanSequence.id);
      setTimelineItems(emptyTimelineItems);
      timelineItemsRef.current = emptyTimelineItems;
      applyTimelineSelection([]);
      setPlayheadSec(0);
      setIsTimelinePlaying(false);
      resetCanvasHistory();
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
      setSelectedNodeId(null);
      setCanvasRevision((value) => value + 1);
      setNotice(formatNotice(studioNotices.projectLoadedCleanSequence, { name: project.name }));
    };

    const localUserTemplates = readUserCanvasTemplates(normalizeUserCanvasTemplate);
    setUserCanvasTemplates(localUserTemplates);
    const templatesController = new AbortController();
    void readUserCanvasTemplatesFromApiResult(templatesController.signal).then((serverTemplatesResult) => {
      if (cancelled) return;
      const notice = workspaceApiNotice(serverTemplatesResult.status, studioNotices);
      if (notice) setNotice(notice);
      if (!serverTemplatesResult.data) return;
      setUserCanvasTemplates(serverTemplatesResult.data);
      writeUserCanvasTemplates(serverTemplatesResult.data);
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
      void Promise.all([
        readStudioProjectFromApi(projectId, projectController.signal),
        readStudioSequencesFromApi(projectId, projectController.signal),
      ]).then(([serverProjectResult, serverSequencesResult]) => {
        if (cancelled) return;
        const notice = workspaceApiNotice(
          serverProjectResult.status !== 'ready' ? serverProjectResult.status : serverSequencesResult.status,
          studioNotices
        );
        if (notice) setNotice(notice);
        const serverProject = serverProjectResult.data;
        const serverSequences = serverSequencesResult.data;
        if (!serverProject) return;
        setStoredProjectName(serverProject.name);
        const serverPersistedBase = shouldApplyStudioProjectWorkspaceState(serverProject.workspaceState, serverSequences)
          ? normalizePersistedWorkspaceState(serverProject.workspaceState, { canvasTemplateId: serverProject.canvasTemplateId })
          : null;
        const serverPersisted = serverPersistedBase
          ? mergePersistedWorkspaceWithServerSequences(serverPersistedBase, serverSequences)
          : null;
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
    resetCanvasHistory,
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
    setProjectMediaFolders,
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
    studioNotices,
    studioNotices.studioApiUnauthorized,
    studioNotices.studioApiUnavailable,
    studioNotices.projectLoadedCleanSequence,
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
      void saveStudioWorkspaceToApi({
        projectId,
        name: activeTemplateName,
        canvasTemplateId: activeTemplateId,
        settings: state.projectSettings,
        workspaceState: state,
        signal: controller.signal,
      }).then((status) => {
        if (controller.signal.aborted) return;
        if (status === 'ready') {
          notifiedAutosaveFallbackStatusesRef.current.clear();
          return;
        }
        if (notifiedAutosaveFallbackStatusesRef.current.has(status)) return;
        const notice = workspaceApiNotice(status, studioNotices);
        if (notice) {
          notifiedAutosaveFallbackStatusesRef.current.add(status);
          setNotice(notice);
        }
      });
    }, 900);

    return () => {
      window.clearTimeout(saveTimer);
      controller.abort();
    };
  }, [activeTemplateId, activeTemplateName, buildPersistedWorkspaceState, hydrated, projectId, setNotice, studioNotices]);
}
