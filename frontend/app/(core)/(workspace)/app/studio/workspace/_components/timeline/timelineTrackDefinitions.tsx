import { Play, Volume2 } from 'lucide-react';
import type { ReactNode } from 'react';

import type {
  WorkspaceTimelineAudioTrack,
  WorkspaceTimelineItem,
  WorkspaceTimelineTrack,
  WorkspaceTimelineVideoTrack,
} from '../../_lib/workspace-types';
import type { StudioCopy } from '../../../_lib/studio-copy';
import {
  isWorkspaceTimelineAudioTrack,
  isWorkspaceTimelineVideoTrack,
  workspaceTimelineAudioTrackId,
  workspaceTimelineAudioTrackIndex,
  workspaceTimelineVideoTrackId,
  workspaceTimelineVideoTrackIndex,
} from '../../_lib/workspace-timeline-tracks';

export type TimelineTrackDefinition = {
  id: WorkspaceTimelineTrack;
  label: string;
  icon: ReactNode;
  kind: 'video' | 'audio';
};

export function isVideoTimelineTrack(track: WorkspaceTimelineTrack): track is WorkspaceTimelineVideoTrack {
  return isWorkspaceTimelineVideoTrack(track);
}

export function isAudioTimelineTrack(track: WorkspaceTimelineTrack): track is WorkspaceTimelineAudioTrack {
  return isWorkspaceTimelineAudioTrack(track);
}

export function timelineVideoTrackId(index: number): WorkspaceTimelineVideoTrack {
  return workspaceTimelineVideoTrackId(index);
}

export function timelineVideoTrackIndex(track: WorkspaceTimelineTrack): number {
  return workspaceTimelineVideoTrackIndex(track);
}

export function timelineAudioTrackId(index: number): WorkspaceTimelineTrack {
  return workspaceTimelineAudioTrackId(index);
}

export function timelineAudioTrackIndex(track: WorkspaceTimelineTrack): number {
  return workspaceTimelineAudioTrackIndex(track);
}

export function buildTimelineTracks(
  videoTrackCount: number,
  audioTrackCount: number,
  items: WorkspaceTimelineItem[],
  copy: StudioCopy['timeline']['tracks']
): TimelineTrackDefinition[] {
  const requiredVideoTrackCount = Math.max(1, videoTrackCount, ...items.map((item) => timelineVideoTrackIndex(item.track)));
  const videoTracks = Array.from({ length: requiredVideoTrackCount }, (_, index): TimelineTrackDefinition => ({
    id: timelineVideoTrackId(index + 1),
    label: `V${index + 1}`,
    icon: <Play size={14} />,
    kind: 'video',
  }));
  const requiredAudioTrackCount = Math.max(1, audioTrackCount, ...items.map((item) => timelineAudioTrackIndex(item.track)));
  const audioTracks = Array.from({ length: requiredAudioTrackCount }, (_, index): TimelineTrackDefinition => ({
    id: timelineAudioTrackId(index + 1),
    label: copy.audioTrack.replace('{index}', String(index + 1)),
    icon: <Volume2 size={14} />,
    kind: 'audio',
  }));
  const displayedVideoTracks = [...videoTracks].reverse();
  return [...displayedVideoTracks, ...audioTracks];
}
