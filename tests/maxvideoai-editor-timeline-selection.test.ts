import assert from 'node:assert/strict';
import test from 'node:test';
import {
  defaultTimelineSelectionIds,
  filterHiddenVideoTrackItems,
  muteAudioTrackItems,
  nextAvailableTimelineItemId,
  timelineSelectionTouchesLockedTrack,
  workspaceTimelineCutPoints,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-timeline-selection';
import type { WorkspaceTimelineItem } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-types';

const videoItem: WorkspaceTimelineItem = {
  id: 'clip-video',
  outputNodeId: 'node-video',
  title: 'Clip video',
  track: 'video',
  mediaKind: 'video',
  mediaUrl: '/media/clip.mp4',
  thumbnailUrl: '/media/clip.jpg',
  durationSec: 5,
  startSec: 1,
  sourceStartSec: 0,
  sourceDurationSec: 5,
  status: 'completed',
  linkedGroupId: 'group-1',
  linkedGroupKind: 'video-audio',
};

const linkedAudioItem: WorkspaceTimelineItem = {
  ...videoItem,
  id: 'clip-audio',
  title: 'Clip audio',
  track: 'audio',
  mediaKind: 'audio',
  thumbnailUrl: null,
};

test('timeline selection helpers keep linked lock rules and default selection stable', () => {
  const items = [linkedAudioItem, videoItem];

  assert.deepEqual(defaultTimelineSelectionIds(items), ['clip-video']);
  assert.equal(timelineSelectionTouchesLockedTrack(items, ['clip-video'], ['audio']), true);
  assert.equal(timelineSelectionTouchesLockedTrack(items, ['clip-video'], ['audio-2']), false);
  assert.equal(nextAvailableTimelineItemId('clip-video', items), 'clip-video-2');
});

test('timeline selection helpers derive preview cut points, hidden video, and muted audio', () => {
  const hiddenVideoItem: WorkspaceTimelineItem = {
    ...videoItem,
    id: 'clip-video-2',
    track: 'video-2',
    startSec: 6,
    linkedGroupId: null,
    linkedGroupKind: null,
  };
  const items = [videoItem, linkedAudioItem, hiddenVideoItem];

  assert.deepEqual(workspaceTimelineCutPoints(items), [0, 1, 6, 11]);
  assert.deepEqual(filterHiddenVideoTrackItems(items, ['video-2']).map((item) => item.id), ['clip-video', 'clip-audio']);

  const mutedItems = muteAudioTrackItems(items, ['audio']);
  assert.equal(mutedItems.find((item) => item.id === 'clip-audio')?.audioMix?.muted, true);
  assert.equal(mutedItems.find((item) => item.id === 'clip-video')?.audioMix?.muted, undefined);
});
