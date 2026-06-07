import type { WorkspaceTimelineTrack, WorkspaceTimelineVideoTrack } from './workspace-types';

const VIDEO_TRACK_PATTERN = /^video(?:-[2-9]\d*)?$/;

export function isWorkspaceTimelineVideoTrack(track: WorkspaceTimelineTrack): track is WorkspaceTimelineVideoTrack {
  return VIDEO_TRACK_PATTERN.test(track);
}

export function workspaceTimelineVideoTrackId(index: number): WorkspaceTimelineVideoTrack {
  return index <= 1 ? 'video' : `video-${index}`;
}

export function workspaceTimelineVideoTrackIndex(track: WorkspaceTimelineTrack): number {
  if (track === 'video') return 1;
  const match = track.match(/^video-(\d+)$/);
  return match ? Number(match[1]) : 0;
}

export function workspaceTimelineTrackLabel(track: WorkspaceTimelineTrack): string {
  if (isWorkspaceTimelineVideoTrack(track)) return `V${workspaceTimelineVideoTrackIndex(track)}`;
  if (track === 'linked-audio') return 'Linked audio';
  if (track === 'voiceover') return 'Voice Over';
  return track.charAt(0).toUpperCase() + track.slice(1);
}
