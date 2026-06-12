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
import { resizeWorkspaceTimelineItem } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-timeline-editing';
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

test('timeline ripple end trim closes only directly attached same-track clips', () => {
  const items = [
    timelineItem({ id: 'clip-a', startSec: 0, durationSec: 5, sourceDurationSec: 12 }),
    timelineItem({ id: 'clip-b', outputNodeId: 'node-b', startSec: 5, durationSec: 2 }),
    timelineItem({ id: 'clip-c', outputNodeId: 'node-c', startSec: 7, durationSec: 2 }),
    timelineItem({ id: 'clip-d', outputNodeId: 'node-d', startSec: 11, durationSec: 2 }),
    timelineItem({ id: 'clip-overlay', outputNodeId: 'node-overlay', track: 'video-2', startSec: 5, durationSec: 2 }),
  ];

  const updated = resizeWorkspaceTimelineItem({
    items,
    itemId: 'clip-a',
    edge: 'end',
    nextStartSec: 0,
    nextDurationSec: 4,
    mode: 'ripple',
  });

  assert.deepEqual(
    updated.map((item) => [item.id, item.track, item.startSec, item.durationSec]),
    [
      ['clip-a', 'video', 0, 4],
      ['clip-b', 'video', 4, 2],
      ['clip-c', 'video', 6, 2],
      ['clip-d', 'video', 11, 2],
      ['clip-overlay', 'video-2', 5, 2],
    ]
  );
});

test('timeline ripple end trim preserves one-frame gaps at 60fps', () => {
  const oneFrameAt60Fps = 1 / 60;
  const items = [
    timelineItem({ id: 'clip-a', startSec: 0, durationSec: 5, sourceDurationSec: 12 }),
    timelineItem({ id: 'clip-b', outputNodeId: 'node-b', startSec: 5 + oneFrameAt60Fps, durationSec: 2 }),
  ];

  const updated = resizeWorkspaceTimelineItem({
    items,
    itemId: 'clip-a',
    edge: 'end',
    nextStartSec: 0,
    nextDurationSec: 4,
    mode: 'ripple',
  });

  assert.deepEqual(
    updated.map((item) => [item.id, item.startSec, item.durationSec]),
    [
      ['clip-a', 0, 4],
      ['clip-b', 5 + oneFrameAt60Fps, 2],
    ]
  );
});

test('timeline ripple end expansion uses available gap without pulling later clips', () => {
  const attachedGapSec = 1 / 96;
  const expandBySec = 1 / 192;
  const items = [
    timelineItem({ id: 'clip-a', startSec: 0, durationSec: 4, sourceDurationSec: 12 }),
    timelineItem({ id: 'clip-b', outputNodeId: 'node-b', startSec: 4 + attachedGapSec, durationSec: 2 }),
    timelineItem({ id: 'clip-c', outputNodeId: 'node-c', startSec: 8, durationSec: 2 }),
  ];

  const updated = resizeWorkspaceTimelineItem({
    items,
    itemId: 'clip-a',
    edge: 'end',
    nextStartSec: 0,
    nextDurationSec: 4 + expandBySec,
    mode: 'ripple',
  });

  assert.deepEqual(
    updated.map((item) => [item.id, item.startSec, item.durationSec]),
    [
      ['clip-a', 0, 4.005208],
      ['clip-b', 4 + attachedGapSec, 2],
      ['clip-c', 8, 2],
    ]
  );
});

test('timeline ripple end expansion clamps to the nearest same-track blocker', () => {
  const items = [
    timelineItem({ id: 'clip-a', startSec: 0, durationSec: 4, sourceDurationSec: 12 }),
    timelineItem({ id: 'clip-b', outputNodeId: 'node-b', startSec: 5, durationSec: 2 }),
    timelineItem({ id: 'clip-overlay', outputNodeId: 'node-overlay', track: 'video-2', startSec: 4, durationSec: 3 }),
  ];

  const updated = resizeWorkspaceTimelineItem({
    items,
    itemId: 'clip-a',
    edge: 'end',
    nextStartSec: 0,
    nextDurationSec: 6,
    mode: 'ripple',
  });

  assert.deepEqual(
    updated.map((item) => [item.id, item.track, item.startSec, item.durationSec]),
    [
      ['clip-a', 'video', 0, 5],
      ['clip-b', 'video', 5, 2],
      ['clip-overlay', 'video-2', 4, 3],
    ]
  );
  const clipA = updated.find((item) => item.id === 'clip-a');
  const clipB = updated.find((item) => item.id === 'clip-b');
  assert.ok(clipA && clipB && clipA.startSec + clipA.durationSec <= clipB.startSec);
});
