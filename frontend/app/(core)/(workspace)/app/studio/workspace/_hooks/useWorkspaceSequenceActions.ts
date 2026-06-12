import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import {
  createWorkspaceSequenceRecord,
  coerceAudioTrackCount,
  coerceVideoTrackCount,
  upsertWorkspaceSequence,
  type WorkspaceEditorSurface,
  type WorkspaceFocusMode,
  type WorkspaceSequenceRecord,
} from '../_state/workspace-state';
import {
  createWorkspaceSequenceDuplicate,
  resolveWorkspaceSequenceDelete,
} from '../_state/workspace-sequence-operations';
import { defaultTimelineSelectionIds } from '../_lib/workspace-timeline-selection';
import { normalizeWorkspaceTimelineIdentities } from '../_lib/workspace-timeline-editing';
import type {
  WorkspaceProjectSettings,
  WorkspaceTimelineAudioTrack,
  WorkspaceTimelineItem,
  WorkspaceTimelineTrack,
  WorkspaceTimelineVideoTrack,
} from '../_lib/workspace-types';
import type { WorkspaceTimelineExportRangeMode } from '../_lib/workspace-timeline-render';
import { localizeStudioGeneratedSequenceDisplayName, type StudioCopy } from '../../_lib/studio-copy';

function formatNotice(value: string, replacements: Record<string, string | number>): string {
  return Object.entries(replacements).reduce(
    (current, [key, replacement]) => current.replaceAll(`{${key}}`, String(replacement)),
    value
  );
}

function createLocalWorkspaceSequenceId(): string {
  if (globalThis.crypto?.randomUUID) return `sequence_${globalThis.crypto.randomUUID()}`;
  return `sequence_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

type UseWorkspaceSequenceActionsParams = {
  activeSequenceId: string;
  applyTimelineSelection: (itemIds: string[]) => void;
  projectSettings: WorkspaceProjectSettings;
  resetTimelineHistory: () => void;
  sequences: WorkspaceSequenceRecord[];
  setActiveEditorSurface: Dispatch<SetStateAction<WorkspaceEditorSurface>>;
  setActiveSequenceId: Dispatch<SetStateAction<string>>;
  setAudioTrackCount: Dispatch<SetStateAction<number>>;
  setExportRangeMode: Dispatch<SetStateAction<WorkspaceTimelineExportRangeMode>>;
  setFocusMode: Dispatch<SetStateAction<WorkspaceFocusMode>>;
  setHiddenVideoTracks: Dispatch<SetStateAction<WorkspaceTimelineVideoTrack[]>>;
  setInspectedSequenceId: Dispatch<SetStateAction<string | null>>;
  setIsTimelinePlaying: Dispatch<SetStateAction<boolean>>;
  setLockedTimelineTracks: Dispatch<SetStateAction<WorkspaceTimelineTrack[]>>;
  setMutedAudioTracks: Dispatch<SetStateAction<WorkspaceTimelineAudioTrack[]>>;
  setNotice: Dispatch<SetStateAction<string | null>>;
  setPlayheadSec: Dispatch<SetStateAction<number>>;
  setProjectSettings: Dispatch<SetStateAction<WorkspaceProjectSettings>>;
  setSequences: Dispatch<SetStateAction<WorkspaceSequenceRecord[]>>;
  setTimelineInPointSec: Dispatch<SetStateAction<number | null>>;
  setTimelineItems: Dispatch<SetStateAction<WorkspaceTimelineItem[]>>;
  setTimelineOutPointSec: Dispatch<SetStateAction<number | null>>;
  setTimelinePanelHeight: Dispatch<SetStateAction<number | null>>;
  setTimelinePreview: Dispatch<SetStateAction<{ items: WorkspaceTimelineItem[]; playheadSec: number } | null>>;
  setVideoTrackCount: Dispatch<SetStateAction<number>>;
  snapshotActiveSequence: () => WorkspaceSequenceRecord;
  studioNotices: StudioCopy['notices'];
  studioProjectMediaCopy: StudioCopy['viewer']['projectMedia'];
  timelineItemsRef: MutableRefObject<WorkspaceTimelineItem[]>;
};

export function useWorkspaceSequenceActions({
  activeSequenceId,
  applyTimelineSelection,
  projectSettings,
  resetTimelineHistory,
  sequences,
  setActiveEditorSurface,
  setActiveSequenceId,
  setAudioTrackCount,
  setExportRangeMode,
  setFocusMode,
  setHiddenVideoTracks,
  setInspectedSequenceId,
  setIsTimelinePlaying,
  setLockedTimelineTracks,
  setMutedAudioTracks,
  setNotice,
  setPlayheadSec,
  setProjectSettings,
  setSequences,
  setTimelineInPointSec,
  setTimelineItems,
  setTimelineOutPointSec,
  setTimelinePanelHeight,
  setTimelinePreview,
  setVideoTrackCount,
  snapshotActiveSequence,
  studioNotices,
  studioProjectMediaCopy,
  timelineItemsRef,
}: UseWorkspaceSequenceActionsParams): {
  handleCreateSequence: () => void;
  handleDeleteSequence: (sequenceId: string) => void;
  handleDuplicateSequence: (sequenceId: string) => void;
  handleRenameActiveSequence: (name: string) => void;
  handleSelectSequence: (sequenceId: string) => void;
} {
  const applyWorkspaceSequence = useCallback(
    (sequence: WorkspaceSequenceRecord) => {
      const nextItems = normalizeWorkspaceTimelineIdentities(sequence.timelineItems);
      setTimelineItems(nextItems);
      timelineItemsRef.current = nextItems;
      applyTimelineSelection(defaultTimelineSelectionIds(nextItems));
      setPlayheadSec(0);
      setIsTimelinePlaying(false);
      setTimelinePreview(null);
      resetTimelineHistory();
      setProjectSettings(sequence.projectSettings);
      setAudioTrackCount(coerceAudioTrackCount(sequence.audioTrackCount, nextItems));
      setHiddenVideoTracks(sequence.hiddenVideoTracks);
      setLockedTimelineTracks(sequence.lockedTimelineTracks);
      setMutedAudioTracks(sequence.mutedAudioTracks);
      setVideoTrackCount(coerceVideoTrackCount(sequence.videoTrackCount, nextItems));
      setTimelinePanelHeight(sequence.timelinePanelHeight);
      setTimelineInPointSec(sequence.timelineInPointSec);
      setTimelineOutPointSec(sequence.timelineOutPointSec);
      setExportRangeMode('sequence');
    },
    [
      applyTimelineSelection,
      resetTimelineHistory,
      setAudioTrackCount,
      setExportRangeMode,
      setHiddenVideoTracks,
      setIsTimelinePlaying,
      setLockedTimelineTracks,
      setMutedAudioTracks,
      setPlayheadSec,
      setProjectSettings,
      setTimelineInPointSec,
      setTimelineItems,
      setTimelineOutPointSec,
      setTimelinePanelHeight,
      setTimelinePreview,
      setVideoTrackCount,
      timelineItemsRef,
    ]
  );

  const handleSelectSequence = useCallback(
    (sequenceId: string) => {
      if (sequenceId === activeSequenceId) return;
      const targetSequence = sequences.find((sequence) => sequence.id === sequenceId);
      if (!targetSequence) {
        setNotice(studioNotices.sequenceNotFound);
        return;
      }
      const currentSequence = snapshotActiveSequence();
      setSequences((current) => upsertWorkspaceSequence(current, currentSequence));
      setActiveSequenceId(targetSequence.id);
      applyWorkspaceSequence(targetSequence);
      applyTimelineSelection([]);
      setActiveEditorSurface('timeline');
      setFocusMode('viewer');
      setNotice(formatNotice(studioNotices.sequenceSelected, {
        name: localizeStudioGeneratedSequenceDisplayName(targetSequence.name, studioProjectMediaCopy),
      }));
    },
    [activeSequenceId, applyTimelineSelection, applyWorkspaceSequence, sequences, setActiveEditorSurface, setActiveSequenceId, setFocusMode, setNotice, setSequences, snapshotActiveSequence, studioNotices.sequenceNotFound, studioNotices.sequenceSelected, studioProjectMediaCopy]
  );

  const handleCreateSequence = useCallback(
    () => {
      const currentSequence = snapshotActiveSequence();
      const sequenceIndex = sequences.length + 1;
      const sequenceName = sequenceIndex <= 1
        ? studioProjectMediaCopy.mainSequenceName
        : formatNotice(studioProjectMediaCopy.sequenceName, { index: sequenceIndex });
      const nextSequence = createWorkspaceSequenceRecord({
        id: createLocalWorkspaceSequenceId(),
        name: sequenceName,
        timelineItems: [],
        projectSettings,
      });
      setSequences((current) => upsertWorkspaceSequence(upsertWorkspaceSequence(current, currentSequence), nextSequence));
      setActiveSequenceId(nextSequence.id);
      applyWorkspaceSequence(nextSequence);
      setInspectedSequenceId(nextSequence.id);
      setActiveEditorSurface('timeline');
      setFocusMode('viewer');
      setNotice(formatNotice(studioNotices.sequenceCreated, { name: nextSequence.name }));
    },
    [applyWorkspaceSequence, projectSettings, sequences.length, setActiveEditorSurface, setActiveSequenceId, setFocusMode, setInspectedSequenceId, setNotice, setSequences, snapshotActiveSequence, studioNotices.sequenceCreated, studioProjectMediaCopy]
  );

  const handleDuplicateSequence = useCallback(
    (sequenceId: string) => {
      const currentSequence = snapshotActiveSequence();
      const savedSequences = upsertWorkspaceSequence(sequences, currentSequence);
      const sourceSequence = savedSequences.find((sequence) => sequence.id === sequenceId);
      if (!sourceSequence) {
        setNotice(studioNotices.sequenceNotFound);
        return;
      }

      const sourceSequenceDisplayName = localizeStudioGeneratedSequenceDisplayName(sourceSequence.name, studioProjectMediaCopy);
      const duplicatedSequence = {
        ...createWorkspaceSequenceDuplicate(sourceSequence, createLocalWorkspaceSequenceId()),
        name: formatNotice(studioProjectMediaCopy.sequenceCopyName, { name: sourceSequenceDisplayName }),
      };
      setSequences((current) => upsertWorkspaceSequence(upsertWorkspaceSequence(current, currentSequence), duplicatedSequence));
      setActiveSequenceId(duplicatedSequence.id);
      applyWorkspaceSequence(duplicatedSequence);
      setInspectedSequenceId(duplicatedSequence.id);
      setActiveEditorSurface('timeline');
      setFocusMode('viewer');
      setNotice(formatNotice(studioNotices.sequenceCreated, { name: duplicatedSequence.name }));
    },
    [applyWorkspaceSequence, sequences, setActiveEditorSurface, setActiveSequenceId, setFocusMode, setInspectedSequenceId, setNotice, setSequences, snapshotActiveSequence, studioNotices.sequenceCreated, studioNotices.sequenceNotFound, studioProjectMediaCopy]
  );

  const handleDeleteSequence = useCallback(
    (sequenceId: string) => {
      const currentSequence = snapshotActiveSequence();
      const savedSequences = upsertWorkspaceSequence(sequences, currentSequence);
      const deleteResult = resolveWorkspaceSequenceDelete({
        activeSequenceId,
        sequenceId,
        sequences: savedSequences,
      });
      if (!deleteResult.ok && deleteResult.reason === 'not_found') {
        setNotice(studioNotices.sequenceNotFound);
        return;
      }
      if (!deleteResult.ok && deleteResult.reason === 'last_sequence') {
        setNotice(studioNotices.keepAtLeastOneSequence);
        return;
      }
      if (!deleteResult.ok) return;
      if (
        typeof window !== 'undefined' &&
        !window.confirm(formatNotice(studioNotices.deleteSequenceConfirm, {
          name: localizeStudioGeneratedSequenceDisplayName(deleteResult.deletedSequence.name, studioProjectMediaCopy),
        }))
      ) return;

      setSequences(deleteResult.nextSequences);
      if (deleteResult.deletedActiveSequence) {
        setActiveSequenceId(deleteResult.nextActiveSequence.id);
        applyWorkspaceSequence(deleteResult.nextActiveSequence);
        setInspectedSequenceId(deleteResult.nextActiveSequence.id);
      } else {
        setInspectedSequenceId((current) => (current === sequenceId ? null : current));
      }
      setActiveEditorSurface('timeline');
      setFocusMode('viewer');
      setNotice(formatNotice(studioNotices.sequenceDeleted, {
        name: localizeStudioGeneratedSequenceDisplayName(deleteResult.deletedSequence.name, studioProjectMediaCopy),
      }));
    },
    [activeSequenceId, applyWorkspaceSequence, sequences, setActiveEditorSurface, setActiveSequenceId, setFocusMode, setInspectedSequenceId, setNotice, setSequences, snapshotActiveSequence, studioNotices.deleteSequenceConfirm, studioNotices.keepAtLeastOneSequence, studioNotices.sequenceDeleted, studioNotices.sequenceNotFound, studioProjectMediaCopy]
  );

  const handleRenameActiveSequence = useCallback(
    (name: string) => {
      setSequences((current) => upsertWorkspaceSequence(current, {
        ...snapshotActiveSequence(),
        name,
      }));
    },
    [setSequences, snapshotActiveSequence]
  );

  return {
    handleCreateSequence,
    handleDeleteSequence,
    handleDuplicateSequence,
    handleRenameActiveSequence,
    handleSelectSequence,
  };
}
