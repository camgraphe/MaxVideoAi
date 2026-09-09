'use client';

import { useCallback, useMemo } from 'react';
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
  type WorkspaceUserCanvasTemplate,
} from '../_state/workspace-state';

export type WorkspaceSequenceSnapshotArgs = {
  activeCanvasId: string | null;
  activeSequenceId: string;
  activeTemplateId: WorkspaceTemplateId;
  audioTrackCount: number;
  edges: WorkspaceGraphEdge[];
  focusMode: WorkspaceFocusMode;
  guideState: WorkspaceCanvasGuideState;
  hiddenVideoTracks: WorkspaceTimelineVideoTrack[];
  lockedTimelineTracks: WorkspaceTimelineTrack[];
  mutedAudioTracks: WorkspaceTimelineAudioTrack[];
  nodes: WorkspaceGraphNode[];
  projectAssets: WorkspaceAssetRecord[];
  projectMediaFolders: WorkspaceProjectMediaFolder[];
  projectSettings: WorkspaceProjectSettings;
  savedCanvases: WorkspaceUserCanvasTemplate[];
  sequences: WorkspaceSequenceRecord[];
  timelineInPointSec: number | null;
  timelineItems: WorkspaceTimelineItem[];
  timelineOutPointSec: number | null;
  timelinePanelHeight: number | null;
  videoTrackCount: number;
};

export function buildPersistedWorkspaceSequenceSnapshot(
  args: WorkspaceSequenceSnapshotArgs,
  activeSequenceSnapshot: WorkspaceSequenceRecord
): PersistedWorkspaceState {
  return {
    nodes: args.nodes,
    edges: args.edges,
    guideState: args.guideState,
    activeCanvasId: args.activeCanvasId,
    savedCanvases: args.savedCanvases,
    projectAssets: args.projectAssets,
    projectMediaFolders: args.projectMediaFolders,
    timelineItems: args.timelineItems,
    activeSequenceId: args.activeSequenceId,
    sequences: upsertWorkspaceSequence(args.sequences, activeSequenceSnapshot),
    activeTemplateId: args.activeTemplateId,
    projectSettings: args.projectSettings,
    focusMode: args.focusMode,
    audioTrackCount: args.audioTrackCount,
    hiddenVideoTracks: args.hiddenVideoTracks,
    lockedTimelineTracks: args.lockedTimelineTracks,
    mutedAudioTracks: args.mutedAudioTracks,
    videoTrackCount: args.videoTrackCount,
    timelinePanelHeight: args.timelinePanelHeight,
    timelineInPointSec: args.timelineInPointSec,
    timelineOutPointSec: args.timelineOutPointSec,
  };
}

export function useWorkspaceSequenceSnapshots({
  activeCanvasId,
  activeSequenceId,
  activeTemplateId,
  audioTrackCount,
  edges,
  focusMode,
  guideState,
  hiddenVideoTracks,
  lockedTimelineTracks,
  mutedAudioTracks,
  nodes,
  projectAssets,
  projectMediaFolders,
  projectSettings,
  savedCanvases,
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
    return buildPersistedWorkspaceSequenceSnapshot(
      {
        activeCanvasId,
        activeSequenceId,
        activeTemplateId,
        audioTrackCount,
        edges,
        focusMode,
        guideState,
        hiddenVideoTracks,
        lockedTimelineTracks,
        mutedAudioTracks,
        nodes,
        projectAssets,
        projectMediaFolders,
        projectSettings,
        savedCanvases,
        sequences,
        timelineInPointSec,
        timelineItems,
        timelineOutPointSec,
        timelinePanelHeight,
        videoTrackCount,
      },
      liveActiveSequence
    );
  }, [
    activeCanvasId,
    activeSequenceId,
    activeTemplateId,
    audioTrackCount,
    edges,
    focusMode,
    guideState,
    hiddenVideoTracks,
    lockedTimelineTracks,
    mutedAudioTracks,
    nodes,
    projectAssets,
    projectMediaFolders,
    projectSettings,
    savedCanvases,
    sequences,
    liveActiveSequence,
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
