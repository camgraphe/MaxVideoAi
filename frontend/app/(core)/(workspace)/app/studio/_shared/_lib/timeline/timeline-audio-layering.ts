import type {WorkspaceTimelineItem,WorkspaceTimelineTrack} from '../workspace-types';
import {workspaceTimelineAudioTrackId} from '../workspace-timeline-tracks';
import {timelineRangeOverlapsItem,timelineTrackHasOverlap} from './timeline-collisions';
import {timelineFrameToSeconds} from './timeline-frames';

/** Layer a standalone sound at an exact time without rippling any existing clip. */
export function layerWorkspaceTimelineAudioItem(params: {
  items: WorkspaceTimelineItem[];
  item: WorkspaceTimelineItem;
  startFrame: number;
  fps: number;
  maxAudioTracks: number;
  unavailableTracks?: WorkspaceTimelineTrack[];
}): WorkspaceTimelineItem[] {
  if (params.item.mediaKind !== 'audio' || params.item.linkedGroupId) throw new Error('Timeline clip must be standalone audio.');
  if (!Number.isInteger(params.startFrame) || params.startFrame < 0 || !Number.isInteger(params.fps) || params.fps < 1 || params.fps > 60 || !Number.isInteger(params.maxAudioTracks) || params.maxAudioTracks < 1) throw new Error('Invalid Studio audio placement.');
  if (params.items.some(item => item.id === params.item.id)) throw new Error('Timeline clip already exists.');
  const startSec = timelineFrameToSeconds(params.startFrame,params.fps);
  const endSec = startSec + params.item.durationSec;
  for (let index = 1; index <= params.maxAudioTracks; index++) {
    const track = workspaceTimelineAudioTrackId(index);
    if (params.unavailableTracks?.includes(track)) continue;
    if (params.items.some(item => item.track === track && timelineRangeOverlapsItem(item,startSec,endSec))) continue;
    const next = [...params.items,{...params.item,track,startSec}];
    if (timelineTrackHasOverlap(next)) throw new Error('Invalid Studio timeline overlap.');
    return next;
  }
  throw new Error('Timeline track capacity reached. Free an audio track before adding another sound.');
}
