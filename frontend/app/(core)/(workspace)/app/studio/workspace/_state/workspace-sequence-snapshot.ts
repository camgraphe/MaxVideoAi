import type {
  WorkspaceProjectSettings,
  WorkspaceTimelineAudioTrack,
  WorkspaceTimelineItem,
  WorkspaceTimelineTrack,
  WorkspaceTimelineVideoTrack,
} from '../_lib/workspace-types';
import { createWorkspaceSequenceRecord, type WorkspaceSequenceRecord } from './workspace-state';
import { sequenceNameForIndex } from './workspace-selectors';

type BuildWorkspaceActiveSequenceSnapshotInput = {
  activeSequenceId: string;
  audioTrackCount: number;
  hiddenVideoTracks: WorkspaceTimelineVideoTrack[];
  lockedTimelineTracks: WorkspaceTimelineTrack[];
  mutedAudioTracks: WorkspaceTimelineAudioTrack[];
  preserveStoredUpdatedAt?: boolean;
  projectSettings: WorkspaceProjectSettings;
  sequences: WorkspaceSequenceRecord[];
  timelineInPointSec: number | null;
  timelineItems: WorkspaceTimelineItem[];
  timelineOutPointSec: number | null;
  timelinePanelHeight: number | null;
  videoTrackCount: number;
};

export function buildWorkspaceActiveSequenceSnapshot({
  activeSequenceId,
  audioTrackCount,
  hiddenVideoTracks,
  lockedTimelineTracks,
  mutedAudioTracks,
  preserveStoredUpdatedAt = false,
  projectSettings,
  sequences,
  timelineInPointSec,
  timelineItems,
  timelineOutPointSec,
  timelinePanelHeight,
  videoTrackCount,
}: BuildWorkspaceActiveSequenceSnapshotInput): WorkspaceSequenceRecord {
  const storedSequence = sequences.find((sequence) => sequence.id === activeSequenceId);
  const sequenceIndex = Math.max(1, sequences.findIndex((sequence) => sequence.id === activeSequenceId) + 1);

  const sequenceRecordParams = {
    id: activeSequenceId,
    name: storedSequence?.name ?? sequenceNameForIndex(sequenceIndex),
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
    createdAt: storedSequence?.createdAt,
  };

  return createWorkspaceSequenceRecord(
    preserveStoredUpdatedAt
      ? {
          ...sequenceRecordParams,
          updatedAt: storedSequence?.updatedAt,
        }
      : sequenceRecordParams
  );
}
