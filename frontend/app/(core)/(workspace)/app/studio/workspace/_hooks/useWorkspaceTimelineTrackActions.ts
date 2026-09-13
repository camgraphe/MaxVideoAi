import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { defaultTimelineSelectionIds } from '../_lib/workspace-timeline-selection';
import {
  isWorkspaceTimelineAudioTrack,
  isWorkspaceTimelineVideoTrack,
  localizeWorkspaceTimelineTrackLabel,
} from '../_lib/workspace-timeline-tracks';
import type {
  WorkspaceTimelineAudioTrack,
  WorkspaceTimelineItem,
  WorkspaceTimelineTrack,
  WorkspaceTimelineVideoTrack,
} from '../_lib/workspace-types';
import {
  MAX_TIMELINE_AUDIO_TRACKS,
  MAX_TIMELINE_VIDEO_TRACKS,
  MIN_TIMELINE_AUDIO_TRACKS,
  deleteWorkspaceTimelineTrackIds,
  deleteWorkspaceTimelineTrackItems,
  type WorkspaceEditorSurface,
} from '../_state/workspace-state';
import type { StudioCopy } from '../../_lib/studio-copy';

function formatNotice(value: string, replacements: Record<string, string | number>): string {
  return Object.entries(replacements).reduce(
    (current, [key, replacement]) => current.replaceAll(`{${key}}`, String(replacement)),
    value
  );
}

type UseWorkspaceTimelineTrackActionsParams = {
  applyTimelineSelection: (itemIds: string[]) => void;
  audioTrackCount: number;
  commitTimelineItems: (updater: (current: WorkspaceTimelineItem[]) => WorkspaceTimelineItem[]) => void;
  setActiveEditorSurface: Dispatch<SetStateAction<WorkspaceEditorSurface>>;
  setAudioTrackCount: Dispatch<SetStateAction<number>>;
  setHiddenVideoTracks: Dispatch<SetStateAction<WorkspaceTimelineVideoTrack[]>>;
  setIsTimelinePlaying: Dispatch<SetStateAction<boolean>>;
  setLockedTimelineTracks: Dispatch<SetStateAction<WorkspaceTimelineTrack[]>>;
  setMutedAudioTracks: Dispatch<SetStateAction<WorkspaceTimelineAudioTrack[]>>;
  setNotice: Dispatch<SetStateAction<string | null>>;
  setVideoTrackCount: Dispatch<SetStateAction<number>>;
  studioCanvasNodeCopy: StudioCopy['canvas']['nodes'];
  studioNotices: StudioCopy['notices'];
  timelineItemsRef: MutableRefObject<WorkspaceTimelineItem[]>;
  videoTrackCount: number;
};

export function useWorkspaceTimelineTrackActions({
  applyTimelineSelection,
  audioTrackCount,
  commitTimelineItems,
  setActiveEditorSurface,
  setAudioTrackCount,
  setHiddenVideoTracks,
  setIsTimelinePlaying,
  setLockedTimelineTracks,
  setMutedAudioTracks,
  setNotice,
  setVideoTrackCount,
  studioCanvasNodeCopy,
  studioNotices,
  timelineItemsRef,
  videoTrackCount,
}: UseWorkspaceTimelineTrackActionsParams): {
  handleAddTimelineAudioTrack: () => void;
  handleAddTimelineVideoTrack: () => void;
  handleDeleteTimelineTrack: (track: WorkspaceTimelineTrack) => void;
  handleToggleAudioTrackMute: (track: WorkspaceTimelineAudioTrack) => void;
  handleToggleTimelineTrackLock: (track: WorkspaceTimelineTrack) => void;
  handleToggleVideoTrackVisibility: (track: WorkspaceTimelineVideoTrack) => void;
} {
  const handleAddTimelineVideoTrack = useCallback(() => {
    setVideoTrackCount((current) => Math.min(MAX_TIMELINE_VIDEO_TRACKS, current + 1));
  }, [setVideoTrackCount]);

  const handleAddTimelineAudioTrack = useCallback(() => {
    setAudioTrackCount((current) => Math.min(MAX_TIMELINE_AUDIO_TRACKS, current + 1));
  }, [setAudioTrackCount]);

  const handleToggleVideoTrackVisibility = useCallback(
    (track: WorkspaceTimelineVideoTrack) => {
      setHiddenVideoTracks((current) => (
        current.includes(track)
          ? current.filter((trackId) => trackId !== track)
          : [...current, track]
      ));
      setIsTimelinePlaying(false);
    },
    [setHiddenVideoTracks, setIsTimelinePlaying]
  );

  const handleToggleAudioTrackMute = useCallback(
    (track: WorkspaceTimelineAudioTrack) => {
      setMutedAudioTracks((current) => (
        current.includes(track)
          ? current.filter((trackId) => trackId !== track)
          : [...current, track]
      ));
      setIsTimelinePlaying(false);
    },
    [setIsTimelinePlaying, setMutedAudioTracks]
  );

  const handleToggleTimelineTrackLock = useCallback(
    (track: WorkspaceTimelineTrack) => {
      setLockedTimelineTracks((current) => (
        current.includes(track)
          ? current.filter((trackId) => trackId !== track)
          : [...current, track]
      ));
      setIsTimelinePlaying(false);
    },
    [setIsTimelinePlaying, setLockedTimelineTracks]
  );

  const handleDeleteTimelineTrack = useCallback(
    (track: WorkspaceTimelineTrack) => {
      const isVideoTrack = isWorkspaceTimelineVideoTrack(track);
      if (isVideoTrack && videoTrackCount <= 1) return;
      if (!isVideoTrack && audioTrackCount <= MIN_TIMELINE_AUDIO_TRACKS) return;

      const trackLabel = localizeWorkspaceTimelineTrackLabel(track, studioCanvasNodeCopy);
      const hasClips = timelineItemsRef.current.some((item) => item.track === track);
      const confirmed = typeof window === 'undefined' || window.confirm(
        hasClips
          ? formatNotice(studioNotices.deleteTrackWithClipsConfirm, { track: trackLabel })
          : formatNotice(studioNotices.deleteTrackConfirm, { track: trackLabel })
      );
      if (!confirmed) return;

      const nextItems = deleteWorkspaceTimelineTrackItems(timelineItemsRef.current, track);
      setActiveEditorSurface('timeline');
      setIsTimelinePlaying(false);
      setHiddenVideoTracks((current) => (
        deleteWorkspaceTimelineTrackIds(current, track)
          .filter((trackId): trackId is WorkspaceTimelineVideoTrack => isWorkspaceTimelineVideoTrack(trackId))
      ));
      setLockedTimelineTracks((current) => deleteWorkspaceTimelineTrackIds(current, track));
      setMutedAudioTracks((current) => (
        deleteWorkspaceTimelineTrackIds(current, track)
          .filter((trackId): trackId is WorkspaceTimelineAudioTrack => isWorkspaceTimelineAudioTrack(trackId))
      ));
      if (isVideoTrack) {
        setVideoTrackCount((current) => Math.max(1, current - 1));
      } else {
        setAudioTrackCount((current) => Math.max(MIN_TIMELINE_AUDIO_TRACKS, current - 1));
      }
      commitTimelineItems(() => nextItems);
      applyTimelineSelection(defaultTimelineSelectionIds(nextItems));
      setNotice(formatNotice(studioNotices.timelineTrackDeleted, { track: trackLabel }));
    },
    [
      applyTimelineSelection,
      audioTrackCount,
      commitTimelineItems,
      setActiveEditorSurface,
      setAudioTrackCount,
      setHiddenVideoTracks,
      setIsTimelinePlaying,
      setLockedTimelineTracks,
      setMutedAudioTracks,
      setNotice,
      setVideoTrackCount,
      studioCanvasNodeCopy,
      studioNotices.deleteTrackConfirm,
      studioNotices.deleteTrackWithClipsConfirm,
      studioNotices.timelineTrackDeleted,
      timelineItemsRef,
      videoTrackCount,
    ]
  );

  return {
    handleAddTimelineAudioTrack,
    handleAddTimelineVideoTrack,
    handleDeleteTimelineTrack,
    handleToggleAudioTrackMute,
    handleToggleTimelineTrackLock,
    handleToggleVideoTrackVisibility,
  };
}
