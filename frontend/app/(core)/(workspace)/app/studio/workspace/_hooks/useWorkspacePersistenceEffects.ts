import { useEffect, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import {
  DEFAULT_WORKSPACE_PROJECT_SETTINGS,
  coerceWorkspaceProjectSettings,
} from '../_lib/workspace-project-settings';
import { defaultTimelineSelectionIds } from '../_lib/workspace-timeline-selection';
import type {
  WorkspaceAssetRecord,
  WorkspaceCanvasGuideState,
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
import { createStarterWorkspaceTemplate, MINIMAL_START_WORKSPACE_TEMPLATE_ID } from '../_lib/workspace-templates';
import {
  createWorkspaceCanvasGuideState,
  EMPTY_WORKSPACE_CANVAS_GUIDE_STATE,
} from '../_lib/workspace-guide-state';
import {
  classifyStudioProjectWorkspaceSnapshot,
  normalizePersistedWorkspaceState,
  mergePersistedWorkspaceWithServerSequences,
  readStudioConnectedWorkspaceFromApiResult,
  readStudioProjectFromApiResult as readStudioProjectFromApi,
  readStudioSequencesFromApiResult as readStudioSequencesFromApi,
  saveStudioWorkspaceToApi,
  shouldApplyStudioProjectWorkspaceState,
  type StudioApiSyncStatus,
} from '../_state/workspace-api-persistence';
import { createStudioConnectedSaveQueue, type StudioConnectedSaveQueue } from '../_state/studio-connected-save-queue';
import { stripStudioMediaAccess, studioWorkspaceSnapshotFingerprint } from '../_state/workspace-media-access';
import {
  readStudioConnectedWorkspaceDraft,
  readPersistedWorkspaceState,
  readStudioProject,
  resolveStudioConnectedWorkspaceHydration,
  shouldClearStudioWorkspaceForAccountChange,
  workspaceStorageKeyForConnectedProject,
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

export function workspaceApiNotice(status: StudioApiSyncStatus, notices: StudioCopy['notices']): string | null {
  if (status === 'ready') return null;
  if (status === 'unauthorized') return notices.studioApiUnauthorized;
  if (status === 'conflict') return notices.workspaceConflict;
  return notices.studioApiUnavailable;
}

type UseWorkspacePersistenceEffectsParams = {
  activeTemplateId: WorkspaceTemplateId;
  activeTemplateName: string;
  applyTimelineSelection: (itemIds: string[]) => void;
  buildPersistedWorkspaceState: () => PersistedWorkspaceState;
  hydrated: boolean;
  mediaAccountId: string | null;
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
  setGuideState: Dispatch<SetStateAction<WorkspaceCanvasGuideState>>;
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
  setTimelinePreview: Dispatch<SetStateAction<{ items: WorkspaceTimelineItem[]; playheadSec: number } | null>>;
  setUserCanvasTemplates: Dispatch<SetStateAction<WorkspaceUserCanvasTemplate[]>>;
  setVideoTrackCount: Dispatch<SetStateAction<number>>;
  studioNotices: StudioCopy['notices'];
  timelineItemsRef: MutableRefObject<WorkspaceTimelineItem[]>;
  workspaceStorageKey: string;
};

type WorkspaceCanvasHydrationControls = Pick<
  UseWorkspacePersistenceEffectsParams,
  'resetCanvasHistory' | 'setEdges' | 'setGuideState' | 'setNodes'
>;

export function applyPersistedWorkspaceCanvasHydration(
  persisted: PersistedWorkspaceState,
  {
    resetCanvasHistory,
    setEdges,
    setGuideState,
    setNodes,
  }: WorkspaceCanvasHydrationControls
): void {
  setNodes(persisted.nodes);
  setEdges(persisted.edges);
  setGuideState(persisted.guideState ?? EMPTY_WORKSPACE_CANVAS_GUIDE_STATE);
  resetCanvasHistory();
}

export function applyStoredProjectCanvasHydration(
  project: Pick<StudioProjectStorageRecord, 'canvasTemplateId'>,
  {
    resetCanvasHistory,
    setEdges,
    setGuideState,
    setNodes,
  }: WorkspaceCanvasHydrationControls
): ReturnType<typeof createStarterWorkspaceTemplate> {
  const template = createStarterWorkspaceTemplate(project.canvasTemplateId);
  setNodes(template.nodes);
  setEdges(template.edges);
  setGuideState(createWorkspaceCanvasGuideState(template));
  resetCanvasHistory();
  return template;
}

export function useWorkspacePersistenceEffects({
  activeTemplateId,
  activeTemplateName,
  applyTimelineSelection,
  buildPersistedWorkspaceState,
  hydrated,
  mediaAccountId,
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
  setGuideState,
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
  setTimelinePreview,
  setUserCanvasTemplates,
  setVideoTrackCount,
  studioNotices,
  timelineItemsRef,
  workspaceStorageKey,
}: UseWorkspacePersistenceEffectsParams): {
  connectedConflict: boolean;
  connected: boolean;
  projectAccessError: boolean;
  persistLocal: (state: PersistedWorkspaceState) => void;
  reloadServerVersion: () => void;
  saveNow: (state: PersistedWorkspaceState) => Promise<StudioApiSyncStatus>;
  storageKey: string;
} {
  const notifiedAutosaveFallbackStatusesRef = useRef<Set<StudioApiSyncStatus>>(new Set());
  type SavePayload = {
    name: string;
    canvasTemplateId: WorkspaceTemplateId;
    settings: WorkspaceProjectSettings;
    workspaceState: PersistedWorkspaceState;
  };
  const connectedQueueRef = useRef<StudioConnectedSaveQueue<SavePayload> | null>(null);
  const baselineRef = useRef<string | null>(null);
  const previousMediaAccountIdRef = useRef<string | null | undefined>(undefined);
  const [connectedConflict, setConnectedConflict] = useState(false);
  const [projectAccessError, setProjectAccessError] = useState(false);
  const [autosaveReadiness, setAutosaveReadiness] = useState({
    api: false,
    local: false,
    workspaceStorageKey,
  });

  useEffect(() => {
    let cancelled = false;
    const previousMediaAccountId = previousMediaAccountIdRef.current;
    previousMediaAccountIdRef.current = mediaAccountId;
    const accountChanged = previousMediaAccountId !== undefined
      && shouldClearStudioWorkspaceForAccountChange(previousMediaAccountId, mediaAccountId, projectId);
    connectedQueueRef.current?.dispose();
    connectedQueueRef.current = null;
    baselineRef.current = null;
    setConnectedConflict(false);
    setProjectAccessError(false);
    notifiedAutosaveFallbackStatusesRef.current.clear();
    setAutosaveReadiness({ api: false, local: false, workspaceStorageKey });

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
      applyPersistedWorkspaceCanvasHydration(persisted, {
        resetCanvasHistory,
        setEdges,
        setGuideState,
        setNodes,
      });
      setProjectAssets(persisted.projectAssets ?? []);
      setProjectMediaFolders(persisted.projectMediaFolders ?? []);
      setSequences(persistedSequences);
      setActiveSequenceId(persistedActiveSequenceId);
      setTimelineItems(persisted.timelineItems);
      timelineItemsRef.current = persisted.timelineItems;
      applyTimelineSelection(defaultTimelineSelectionIds(persisted.timelineItems));
      setPlayheadSec(0);
      setIsTimelinePlaying(false);
      resetTimelineHistory();
      setActiveTemplateId(persisted.activeTemplateId);
      setActiveUserCanvasTemplateId(persisted.activeCanvasId ?? null);
      setUserCanvasTemplates(persisted.savedCanvases ?? []);
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
      if (persisted.compatibilityAdjustmentCount) {
        setNotice(formatNotice(studioNotices.workspaceSettingsAdjusted, {
          count: persisted.compatibilityAdjustmentCount,
        }));
      }
    };

    const applyStoredProjectWorkspace = (project: StudioProjectStorageRecord) => {
      if (cancelled) return;
      const template = applyStoredProjectCanvasHydration(project, {
        resetCanvasHistory,
        setEdges,
        setGuideState,
        setNodes,
      });
      const emptyTimelineItems: WorkspaceTimelineItem[] = [];
      const cleanSequence = createWorkspaceSequenceRecord({
        id: DEFAULT_WORKSPACE_SEQUENCE_ID,
        name: sequenceNameForIndex(1),
        timelineItems: emptyTimelineItems,
        projectSettings: coerceWorkspaceProjectSettings(project.settings ?? DEFAULT_WORKSPACE_PROJECT_SETTINGS),
      });
      setProjectAssets([]);
      setProjectMediaFolders([]);
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
      setUserCanvasTemplates([]);
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
      setSelectedNodeId(template.focusNodeId ?? null);
      setCanvasRevision((value) => value + 1);
      setNotice(formatNotice(studioNotices.projectLoadedCleanSequence, { name: project.name }));
    };

    if (accountChanged) {
      const template = createStarterWorkspaceTemplate(MINIMAL_START_WORKSPACE_TEMPLATE_ID);
      const emptyTimelineItems: WorkspaceTimelineItem[] = [];
      const cleanSequence = createWorkspaceSequenceRecord({
        id: DEFAULT_WORKSPACE_SEQUENCE_ID,
        name: sequenceNameForIndex(1),
        timelineItems: emptyTimelineItems,
        projectSettings: DEFAULT_WORKSPACE_PROJECT_SETTINGS,
      });
      applyPersistedWorkspace({
        nodes: template.nodes,
        edges: template.edges,
        guideState: createWorkspaceCanvasGuideState(template),
        projectAssets: [],
        projectMediaFolders: [],
        timelineItems: emptyTimelineItems,
        activeSequenceId: cleanSequence.id,
        sequences: [cleanSequence],
        activeTemplateId: template.id,
        projectSettings: DEFAULT_WORKSPACE_PROJECT_SETTINGS,
        focusMode: 'canvas',
      });
      setSelectedNodeId(null);
      setStoredProjectName(null);
      setTimelinePreview(null);
    }

    const storedProject = accountChanged ? null : readStudioProject(projectId);
    setStoredProjectName(storedProject?.name ?? null);
    const persisted = accountChanged
      ? null
      : readPersistedWorkspaceState(workspaceStorageKey, normalizePersistedWorkspaceState);
    if (persisted) {
      applyPersistedWorkspace(persisted);
    } else if (storedProject) {
      applyStoredProjectWorkspace(storedProject);
    }
    setHydrated(true);
    if (!projectId || persisted) {
      setAutosaveReadiness({ api: false, local: true, workspaceStorageKey });
    }

    const projectController = new AbortController();
    if (projectId) {
      void (async () => {
        const initialProjectResult = await readStudioProjectFromApi(projectId, projectController.signal);
        if (cancelled) return;
        if (initialProjectResult.reason === 'not_found') {
          setProjectAccessError(true);
          return;
        }
        let serverProjectResult = initialProjectResult;
        let serverSequencesResult: Awaited<ReturnType<typeof readStudioSequencesFromApi>>;
        if (initialProjectResult.data?.persistenceMode === 'connected') {
          if (!mediaAccountId) return;
          const atomic = await readStudioConnectedWorkspaceFromApiResult(projectId, projectController.signal);
          if (atomic.reason === 'not_found') {
            setProjectAccessError(true);
            return;
          }
          serverProjectResult = { data: atomic.data?.project ?? null, status: atomic.status };
          serverSequencesResult = { data: atomic.data?.sequences ?? null, status: atomic.status };
        } else {
          serverSequencesResult = await readStudioSequencesFromApi(projectId, projectController.signal);
        }
        if (cancelled) return;
        const notice = workspaceApiNotice(
          serverProjectResult.status !== 'ready' ? serverProjectResult.status : serverSequencesResult.status,
          studioNotices
        );
        if (notice) setNotice(notice);
        const serverProject = serverProjectResult.data;
        const serverSequences = serverSequencesResult.data;
        if (!serverProject) {
          const projectApiUnavailable = serverProjectResult.status === 'unauthorized'
            || serverProjectResult.status === 'unavailable'
            || serverProjectResult.status === 'error';
          if (projectApiUnavailable) {
            setAutosaveReadiness({ api: false, local: !accountChanged, workspaceStorageKey });
          }
          return;
        }
        setStoredProjectName(serverProject.name);
        const serverWorkspaceSnapshotKind = classifyStudioProjectWorkspaceSnapshot(serverProject.workspaceState);
        const serverPersistedBase = shouldApplyStudioProjectWorkspaceState(serverProject.workspaceState, serverSequences)
          ? normalizePersistedWorkspaceState(serverProject.workspaceState, { canvasTemplateId: serverProject.canvasTemplateId })
          : null;
        const serverPersisted = serverPersistedBase
          ? mergePersistedWorkspaceWithServerSequences(serverPersistedBase, serverSequences)
          : null;
        if (serverPersisted) {
          const connected = serverProject.persistenceMode === 'connected' && typeof serverProject.revision === 'number';
          const activeStorageKey = connected && mediaAccountId
            ? workspaceStorageKeyForConnectedProject(mediaAccountId, projectId)
            : workspaceStorageKey;
          const connectedDraft = connected && mediaAccountId && typeof window !== 'undefined'
            ? readStudioConnectedWorkspaceDraft(window.localStorage, activeStorageKey, normalizePersistedWorkspaceState)
            : null;
          const hydration = connected
            ? resolveStudioConnectedWorkspaceHydration({
                serverRevision: serverProject.revision!,
                serverState: serverPersisted,
                draft: connectedDraft,
              })
            : { state: serverPersisted, baseRevision: serverProject.revision ?? 0, conflict: false, source: 'server' as const };
          applyPersistedWorkspace(hydration.state);
          if (connected && mediaAccountId) {
            const scope = `${mediaAccountId}:${projectId}`;
            const queue: StudioConnectedSaveQueue<SavePayload> = createStudioConnectedSaveQueue<SavePayload>({
              scope,
              initialRevision: hydration.baseRevision,
              initialConflictDraft: hydration.conflict ? {
                name: serverProject.name,
                canvasTemplateId: serverProject.canvasTemplateId,
                settings: hydration.state.projectSettings,
                workspaceState: hydration.state,
              } : undefined,
              save: async ({ expectedRevision, snapshot }) => {
                return saveStudioWorkspaceToApi({
                  projectId,
                  ...snapshot,
                  expectedRevision,
                });
              },
              onSaved: (snapshot, revision) => {
                baselineRef.current = studioWorkspaceSnapshotFingerprint(snapshot.workspaceState);
                const latest = queue.draft();
                if (typeof window !== 'undefined' && (!latest || studioWorkspaceSnapshotFingerprint(latest.workspaceState)
                  === studioWorkspaceSnapshotFingerprint(snapshot.workspaceState))) {
                  window.localStorage.setItem(activeStorageKey, JSON.stringify({
                    dirty: false,
                    revision,
                    state: stripStudioMediaAccess(snapshot.workspaceState),
                  }));
                }
              },
              onConflict: (draft, revision) => {
                if (cancelled || typeof window === 'undefined') return;
                setConnectedConflict(true);
                window.localStorage.setItem(activeStorageKey, JSON.stringify({
                  dirty: true,
                  revision,
                  state: stripStudioMediaAccess(draft.workspaceState),
                }));
              },
            });
            connectedQueueRef.current = queue;
            baselineRef.current = studioWorkspaceSnapshotFingerprint(serverPersisted);
            setConnectedConflict(hydration.conflict);
          }
          if (typeof window !== 'undefined' && hydration.source === 'server') {
            window.localStorage.setItem(activeStorageKey, connected
              ? JSON.stringify({ dirty: false, revision: serverProject.revision, state: stripStudioMediaAccess(serverPersisted) })
              : JSON.stringify(serverPersisted));
          }
          setAutosaveReadiness({ api: true, local: true, workspaceStorageKey: activeStorageKey });
          return;
        }
        const serverHasCleanWorkspace = serverWorkspaceSnapshotKind === 'missing'
          || (serverWorkspaceSnapshotKind === 'empty' && serverSequences?.length === 0);
        if (serverHasCleanWorkspace) {
          if (!persisted && !storedProject) {
            applyStoredProjectWorkspace(serverProject);
          }
          setAutosaveReadiness({ api: true, local: true, workspaceStorageKey });
          return;
        }
        if (persisted) {
          setAutosaveReadiness({ api: false, local: true, workspaceStorageKey });
          return;
        }
        // A project snapshot stripped of sequences is not authoritative when
        // sequence hydration failed. Keep autosave blocked for this mount.
        setAutosaveReadiness({ api: false, local: false, workspaceStorageKey });
      })().catch(() => {
        if (!cancelled) setAutosaveReadiness({ api: false, local: true, workspaceStorageKey });
      });
    } else {
      setAutosaveReadiness({ api: false, local: true, workspaceStorageKey });
    }

    return () => {
      cancelled = true;
      connectedQueueRef.current?.dispose();
      connectedQueueRef.current = null;
      projectController.abort();
    };
  }, [
    applyTimelineSelection,
    projectId,
    mediaAccountId,
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
    setGuideState,
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
    setTimelinePreview,
    setUserCanvasTemplates,
    setVideoTrackCount,
    studioNotices,
    studioNotices.studioApiUnauthorized,
    studioNotices.studioApiUnavailable,
    studioNotices.projectLoadedCleanSequence,
    studioNotices.workspaceSettingsAdjusted,
    timelineItemsRef,
    workspaceStorageKey,
  ]);

  useEffect(() => {
    if (
      !hydrated
      || !autosaveReadiness.local
      || (!connectedQueueRef.current && autosaveReadiness.workspaceStorageKey !== workspaceStorageKey)
      || typeof window === 'undefined'
    ) return;
    const state = buildPersistedWorkspaceState();
    const queue = connectedQueueRef.current;
    window.localStorage.setItem(autosaveReadiness.workspaceStorageKey, queue
      ? JSON.stringify({
          dirty: studioWorkspaceSnapshotFingerprint(state) !== baselineRef.current,
          revision: queue.state().revision,
          state: stripStudioMediaAccess(state),
        })
      : JSON.stringify(stripStudioMediaAccess(state)));
  }, [
    autosaveReadiness.local,
    autosaveReadiness.workspaceStorageKey,
    buildPersistedWorkspaceState,
    hydrated,
    workspaceStorageKey,
  ]);

  useEffect(() => {
    if (
      !hydrated
      || !autosaveReadiness.api
      || !projectId
      || typeof window === 'undefined'
    ) return undefined;
    const state = buildPersistedWorkspaceState();
    const queue = connectedQueueRef.current;
    if (queue && studioWorkspaceSnapshotFingerprint(state) === baselineRef.current) return undefined;
    const saveTimer = window.setTimeout(() => {
      const payload = {
        name: activeTemplateName,
        canvasTemplateId: activeTemplateId,
        settings: state.projectSettings,
        workspaceState: state,
      };
      if (queue) {
        queue.enqueue(payload);
        void queue.whenIdle().then((status) => {
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
        return;
      }
      void saveStudioWorkspaceToApi({
        projectId,
        ...payload,
      }).then(({ status }) => {
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
    };
  }, [
    activeTemplateId,
    activeTemplateName,
    autosaveReadiness.api,
    autosaveReadiness.workspaceStorageKey,
    buildPersistedWorkspaceState,
    hydrated,
    projectId,
    setNotice,
    studioNotices,
    workspaceStorageKey,
  ]);

  const saveNow = async (state: PersistedWorkspaceState): Promise<StudioApiSyncStatus> => {
    if (!projectId) return 'ready';
    const queue = connectedQueueRef.current;
    const payload = {
      name: activeTemplateName,
      canvasTemplateId: activeTemplateId,
      settings: state.projectSettings,
      workspaceState: state,
    };
    if (queue) {
      queue.enqueue(payload);
      return queue.whenIdle();
    }
    return (await saveStudioWorkspaceToApi({ projectId, ...payload })).status;
  };

  const persistLocal = (state: PersistedWorkspaceState): void => {
    if (typeof window === 'undefined') return;
    const queue = connectedQueueRef.current;
    const stripped = stripStudioMediaAccess(state);
    window.localStorage.setItem(autosaveReadiness.workspaceStorageKey, queue
      ? JSON.stringify({
          dirty: studioWorkspaceSnapshotFingerprint(state) !== baselineRef.current,
          revision: queue.state().revision,
          state: stripped,
        })
      : JSON.stringify(stripped));
  };

  const reloadServerVersion = (): void => {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(autosaveReadiness.workspaceStorageKey);
    window.location.reload();
  };

  return {
    connected: Boolean(connectedQueueRef.current),
    connectedConflict,
    persistLocal,
    projectAccessError,
    reloadServerVersion,
    saveNow,
    storageKey: autosaveReadiness.workspaceStorageKey,
  };
}
