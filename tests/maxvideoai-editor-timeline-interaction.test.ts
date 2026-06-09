import assert from 'node:assert/strict';
import test from 'node:test';
import {
  frameStepSeconds,
  interactionMatchesTimelineItem,
  layoutForTimelineItem,
  nextTimelineInteractionState,
  selectedItemIdsForMarquee,
  selectionKeyForTimelineItem,
  selectionKeysForTimelineItemIds,
  snapTimelineSeconds,
  trackForTimelineItem,
  type TimelineInteractionState,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/timeline/timeline-interaction';
import type { WorkspaceTimelineItem } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-types';

function timelineItem(overrides: Partial<WorkspaceTimelineItem>): WorkspaceTimelineItem {
  return {
    id: 'clip-a',
    outputNodeId: 'node-a',
    title: 'Clip A',
    track: 'video',
    durationSec: 4,
    startSec: 0,
    sourceStartSec: 0,
    sourceDurationSec: 8,
    mediaKind: 'video',
    mediaUrl: '/media/a.mp4',
    thumbnailUrl: '/media/a.jpg',
    status: 'completed',
    ...overrides,
  };
}

function interaction(overrides: Partial<TimelineInteractionState> = {}): TimelineInteractionState {
  return {
    itemId: 'clip-a',
    linkedGroupId: null,
    selectedItemIds: ['clip-a'],
    selectedKeys: ['item:clip-a'],
    originLayoutsById: {
      'clip-a': { startSec: 0, durationSec: 4 },
    },
    kind: 'move',
    originClientX: 0,
    originTrack: 'video',
    originStartSec: 0,
    originDurationSec: 4,
    originSourceStartSec: 0,
    originSourceDurationSec: 8,
    snapStepSec: 1 / 24,
    previewTrack: 'video',
    previewStartSec: 0,
    previewDurationSec: 4,
    snapGuideSec: null,
    ...overrides,
  };
}

test('timeline interaction helpers snap moves to nearby cut boundaries', () => {
  const active = timelineItem({ id: 'clip-a', startSec: 0, durationSec: 4 });
  const next = timelineItem({ id: 'clip-b', outputNodeId: 'node-b', startSec: 8, durationSec: 3 });
  const updated = nextTimelineInteractionState(
    interaction(),
    399,
    [active, next],
    0,
    true,
    100
  );

  assert.equal(frameStepSeconds(24), 1 / 24);
  assert.equal(snapTimelineSeconds(1.02, 1 / 24), 1);
  assert.equal(updated.previewStartSec, 4);
  assert.equal(updated.previewDurationSec, 4);
  assert.equal(updated.snapGuideSec, 8);
});

test('timeline interaction helpers constrain trim expansion to same-track gaps', () => {
  const active = timelineItem({ id: 'clip-a', startSec: 0, durationSec: 4, sourceDurationSec: 12 });
  const blocker = timelineItem({ id: 'clip-b', outputNodeId: 'node-b', startSec: 6, durationSec: 3 });
  const updated = nextTimelineInteractionState(
    interaction({
      kind: 'resize-end',
      originDurationSec: 4,
      previewDurationSec: 4,
      originSourceDurationSec: 12,
    }),
    900,
    [active, blocker],
    0,
    false,
    100
  );

  assert.equal(updated.previewStartSec, 0);
  assert.equal(updated.previewDurationSec, 6);
  assert.equal(updated.snapGuideSec, 6);
});

test('timeline interaction helpers preserve linked selection and marquee behavior', () => {
  const video = timelineItem({ id: 'clip-a', linkedGroupId: 'linked-1' });
  const audio = timelineItem({
    id: 'clip-audio',
    outputNodeId: 'node-audio',
    track: 'audio',
    mediaKind: 'audio',
    linkedGroupId: 'linked-1',
  });
  const other = timelineItem({ id: 'clip-b', outputNodeId: 'node-b', startSec: 7, linkedGroupId: null });
  const linkedInteraction = interaction({
    itemId: 'clip-a',
    linkedGroupId: 'linked-1',
    selectedKeys: ['group:linked-1'],
    previewTrack: 'video-2',
    previewStartSec: 2,
  });

  assert.equal(selectionKeyForTimelineItem(video), 'group:linked-1');
  assert.deepEqual(Array.from(selectionKeysForTimelineItemIds([video, audio, other], ['clip-a', 'clip-audio'])), ['group:linked-1']);
  assert.equal(interactionMatchesTimelineItem(linkedInteraction, audio), true);
  assert.equal(trackForTimelineItem(video, linkedInteraction), 'video-2');
  assert.equal(trackForTimelineItem(audio, linkedInteraction), 'audio');
  assert.deepEqual(layoutForTimelineItem(audio, linkedInteraction), { startSec: 2, durationSec: 4 });

  assert.deepEqual(
    selectedItemIdsForMarquee({
      originClientX: 0,
      originClientY: 0,
      currentClientX: 120,
      currentClientY: 60,
      containerLeft: 0,
      containerTop: 0,
      itemRects: [
        { id: 'clip-a', left: 10, right: 80, top: 10, bottom: 40 },
        { id: 'clip-b', left: 140, right: 180, top: 10, bottom: 40 },
      ],
    }),
    ['clip-a']
  );
});
