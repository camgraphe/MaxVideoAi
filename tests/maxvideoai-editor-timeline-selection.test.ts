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
import { resolveWorkspaceTimelineGapSelection } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/timeline/timeline-gap-editing';
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

test('timeline gap selection resolves the clicked track independently', () => {
  const items: WorkspaceTimelineItem[] = [
    {
      ...videoItem,
      id: 'wide-video',
      outputNodeId: 'wide-video',
      startSec: 0,
      durationSec: 12,
      linkedGroupId: null,
      linkedGroupKind: null,
    },
    {
      ...linkedAudioItem,
      id: 'audio-a',
      outputNodeId: 'audio-a',
      startSec: 0,
      durationSec: 4,
      linkedGroupId: null,
      linkedGroupKind: null,
    },
    {
      ...linkedAudioItem,
      id: 'audio-b',
      outputNodeId: 'audio-b',
      startSec: 10,
      durationSec: 4,
      linkedGroupId: null,
      linkedGroupKind: null,
    },
  ];

  assert.equal(
    resolveWorkspaceTimelineGapSelection(items, 8),
    null,
    'without a clicked track, media on any track should still block a sequence-wide gap'
  );
  assert.deepEqual(
    resolveWorkspaceTimelineGapSelection(items, 8, 'audio'),
    { startSec: 4, endSec: 10, track: 'audio' },
    'clicked audio lanes should select their own gap even when video covers that time'
  );
  assert.equal(
    resolveWorkspaceTimelineGapSelection(items, 8, 'video'),
    null,
    'clicked video lanes should not select a gap under video media'
  );
});
