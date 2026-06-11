'use client';

import { useCallback, useMemo } from 'react';
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
  buildWorkspaceSequenceSummaries,
  type WorkspaceSequenceSidebarSummary,
} from '../_state/workspace-selectors';
import { buildWorkspaceActiveSequenceSnapshot } from '../_state/workspace-sequence-snapshot';
import {
  upsertWorkspaceSequence,
  type PersistedWorkspaceState,
  type WorkspaceFocusMode,
  type WorkspaceSequenceRecord,
} from '../_state/workspace-state';

type WorkspaceSequenceSnapshotArgs = {
  activeSequenceId: string;
  activeTemplateId: WorkspaceTemplateId;
  audioTrackCount: number;
  edges: WorkspaceGraphEdge[];
  focusMode: WorkspaceFocusMode;
  hiddenVideoTracks: WorkspaceTimelineVideoTrack[];
  lockedTimelineTracks: WorkspaceTimelineTrack[];
  mutedAudioTracks: WorkspaceTimelineAudioTrack[];
  nodes: WorkspaceGraphNode[];
  projectAssets: WorkspaceAssetRecord[];
  projectMediaFolders: WorkspaceProjectMediaFolder[];
  projectSettings: WorkspaceProjectSettings;
  sequences: WorkspaceSequenceRecord[];
  timelineInPointSec: number | null;
  timelineItems: WorkspaceTimelineItem[];
  timelineOutPointSec: number | null;
  timelinePanelHeight: number | null;
  videoTrackCount: number;
};

export function useWorkspaceSequenceSnapshots({
  activeSequenceId,
  activeTemplateId,
  audioTrackCount,
  edges,
  focusMode,
  hiddenVideoTracks,
  lockedTimelineTracks,
  mutedAudioTracks,
  nodes,
  projectAssets,
  projectMediaFolders,
  projectSettings,
  sequences,
  timelineInPointSec,
  timelineItems,
  timelineOutPointSec,
  timelinePanelHeight,
  videoTrackCount,
}: WorkspaceSequenceSnapshotArgs): {
  buildPersistedWorkspaceState: () => PersistedWorkspaceState;
  sequenceSummaries: WorkspaceSequenceSidebarSummary[];
  snapshotActiveSequence: () => WorkspaceSequenceRecord;
} {
  const liveActiveSequence = useMemo(() => {
    return buildWorkspaceActiveSequenceSnapshot({
      activeSequenceId,
      timelineItems,
      projectSettings,
      audioTrackCount,
      hiddenVideoTracks,
      lockedTimelineTracks,
      mutedAudioTracks,
      videoTrackCount,
      timelinePanelHeight,
      timelineInPointSec,
      timelineOutPointSec,
      sequences,
      preserveStoredUpdatedAt: true,
    });
  }, [
    activeSequenceId,
    audioTrackCount,
    hiddenVideoTracks,
    lockedTimelineTracks,
    mutedAudioTracks,
    projectSettings,
    sequences,
    timelineInPointSec,
    timelineItems,
    timelineOutPointSec,
    timelinePanelHeight,
    videoTrackCount,
  ]);

  const sequenceSummaries = useMemo(() => {
    return buildWorkspaceSequenceSummaries({
      sequences: upsertWorkspaceSequence(sequences, liveActiveSequence),
      activeSequenceId,
    });
  }, [activeSequenceId, liveActiveSequence, sequences]);

  const snapshotActiveSequence = useCallback((): WorkspaceSequenceRecord => {
    return buildWorkspaceActiveSequenceSnapshot({
      activeSequenceId,
      timelineItems,
      projectSettings,
      audioTrackCount,
      hiddenVideoTracks,
      lockedTimelineTracks,
      mutedAudioTracks,
      videoTrackCount,
      timelinePanelHeight,
      timelineInPointSec,
      timelineOutPointSec,
      sequences,
    });
  }, [
    activeSequenceId,
    audioTrackCount,
    hiddenVideoTracks,
    lockedTimelineTracks,
    mutedAudioTracks,
    projectSettings,
    sequences,
    timelineInPointSec,
    timelineItems,
    timelineOutPointSec,
    timelinePanelHeight,
    videoTrackCount,
  ]);

  const buildPersistedWorkspaceState = useCallback((): PersistedWorkspaceState => {
    const sequenceSnapshot = snapshotActiveSequence();
    return {
      nodes,
      edges,
      projectAssets,
      projectMediaFolders,
      timelineItems,
      activeSequenceId,
      sequences: upsertWorkspaceSequence(sequences, sequenceSnapshot),
      activeTemplateId,
      projectSettings,
      focusMode,
      audioTrackCount,
      hiddenVideoTracks,
      lockedTimelineTracks,
      mutedAudioTracks,
      videoTrackCount,
      timelinePanelHeight,
      timelineInPointSec,
      timelineOutPointSec,
    };
  }, [
    activeSequenceId,
    activeTemplateId,
    audioTrackCount,
    edges,
    focusMode,
    hiddenVideoTracks,
    lockedTimelineTracks,
    mutedAudioTracks,
    nodes,
    projectAssets,
    projectMediaFolders,
    projectSettings,
    sequences,
    snapshotActiveSequence,
    timelineInPointSec,
    timelineItems,
    timelineOutPointSec,
    timelinePanelHeight,
    videoTrackCount,
  ]);

  return {
    buildPersistedWorkspaceState,
    sequenceSummaries,
    snapshotActiveSequence,
  };
}
