import type { WorkspaceTimelineAudioTrack, WorkspaceTimelineTrack, WorkspaceTimelineVideoTrack } from './workspace-types';
import type { StudioCopy } from '../../_lib/studio-copy';

const VIDEO_TRACK_PATTERN = /^video(?:-[2-9]\d*)?$/;
const AUDIO_TRACK_PATTERN = /^audio(?:-[2-9]\d*)?$/;

export function isWorkspaceTimelineVideoTrack(track: WorkspaceTimelineTrack): track is WorkspaceTimelineVideoTrack {
  return VIDEO_TRACK_PATTERN.test(track);
}

export function isWorkspaceTimelineAudioTrack(track: WorkspaceTimelineTrack): track is WorkspaceTimelineAudioTrack {
  return AUDIO_TRACK_PATTERN.test(track);
}

export function workspaceTimelineVideoTrackId(index: number): WorkspaceTimelineVideoTrack {
  return index <= 1 ? 'video' : `video-${index}`;
}

export function workspaceTimelineAudioTrackId(index: number): WorkspaceTimelineAudioTrack {
  return index <= 1 ? 'audio' : `audio-${index}`;
}

export function workspaceTimelineVideoTrackIndex(track: WorkspaceTimelineTrack): number {
  if (track === 'video') return 1;
  const match = track.match(/^video-(\d+)$/);
  return match ? Number(match[1]) : 0;
}

export function workspaceTimelineAudioTrackIndex(track: WorkspaceTimelineTrack): number {
  if (track === 'audio') return 1;
  const match = track.match(/^audio-(\d+)$/);
  return match ? Number(match[1]) : 0;
}

export function normalizeWorkspaceTimelineTrack(track: string): WorkspaceTimelineTrack {
  if (VIDEO_TRACK_PATTERN.test(track) || AUDIO_TRACK_PATTERN.test(track)) return track as WorkspaceTimelineTrack;
  if (track === 'linked-audio') return 'audio';
  if (track === 'music') return 'audio-2';
  if (track === 'voiceover') return 'audio-3';
  if (track === 'sfx') return 'audio-4';
  return 'audio';
}

export function workspaceTimelineTrackLabel(track: WorkspaceTimelineTrack): string {
  if (isWorkspaceTimelineVideoTrack(track)) return `V${workspaceTimelineVideoTrackIndex(track)}`;
  return `Audio ${workspaceTimelineAudioTrackIndex(track)}`;
}

export function localizeWorkspaceTimelineTrackKindLabel(
  kind: 'video' | 'audio',
  copy: StudioCopy['canvas']['nodes']
): string {
  return kind === 'video' ? copy.video ?? 'Video' : copy.audio ?? 'Audio';
}

export function localizeWorkspaceTimelineTrackLabel(
  track: WorkspaceTimelineTrack,
  copy: StudioCopy['canvas']['nodes']
): string {
  if (isWorkspaceTimelineVideoTrack(track)) {
    return `${localizeWorkspaceTimelineTrackKindLabel('video', copy)} ${workspaceTimelineVideoTrackIndex(track)}`;
  }
  return `${localizeWorkspaceTimelineTrackKindLabel('audio', copy)} ${workspaceTimelineAudioTrackIndex(track)}`;
}

export function localizeWorkspaceTimelineTrackNoticeLabel(
  track: WorkspaceTimelineTrack,
  copy: StudioCopy['canvas']['nodes']
): string {
  return localizeWorkspaceTimelineTrackLabel(track, copy);
}
