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
import { timelineTrackHasOverlap } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/timeline/timeline-collisions';
import { deleteTimelineGapAndRipple } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/timeline/timeline-gap-editing';
import { moveLinkedTimelineSelection } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/timeline/timeline-linked-audio';
import {
  deleteWorkspaceTimelineGap,
  deleteWorkspaceTimelineItems,
  moveWorkspaceTimelineSelectionWithMode,
  resizeWorkspaceTimelineItem,
  timelineEditTouchesLockedTracks,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-timeline-editing';
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

function videoClip(overrides: Partial<WorkspaceTimelineItem>): WorkspaceTimelineItem {
  return timelineItem({ mediaKind: 'video', track: 'video', ...overrides });
}

function audioClip(overrides: Partial<WorkspaceTimelineItem>): WorkspaceTimelineItem {
  return timelineItem({ mediaKind: 'audio', track: 'audio', ...overrides });
}

test('linked audio cannot be dragged into an occupied audio range through a video drag', () => {
  const items = [
    videoClip({ id: 'video-a', linkedGroupId: 'group-a', startSec: 0, durationSec: 5, track: 'video' }),
    audioClip({ id: 'audio-a', linkedGroupId: 'group-a', startSec: 0, durationSec: 5, track: 'audio' }),
    audioClip({ id: 'audio-b', startSec: 8, durationSec: 5, track: 'audio' }),
  ];
  const result = moveLinkedTimelineSelection({
    items,
    selectedItemId: 'video-a',
    deltaSec: 6,
    targetTrack: 'video',
  });

  assert.equal(timelineTrackHasOverlap(items), false, 'the fixture must begin overlap-free');
  assert.equal(result.ok, false);
  assert.match(result.reason, /overlap/i);
  assert.deepEqual(result.collidingItemIds, ['audio-a'], 'only the linked audio member should hit occupied media');
  assert.equal(result.items, items);
});

test('production linked video drag reverts when only its audio peer would overlap', () => {
  const items = [
    videoClip({ id: 'video-a', linkedGroupId: 'group-a', startSec: 0, durationSec: 5, track: 'video' }),
    audioClip({ id: 'audio-a', linkedGroupId: 'group-a', startSec: 0, durationSec: 5, track: 'audio' }),
    audioClip({ id: 'audio-b', startSec: 8, durationSec: 5, track: 'audio' }),
  ];

  const result = moveWorkspaceTimelineSelectionWithMode({
    items,
    itemIds: ['video-a'],
    anchorItemId: 'video-a',
    nextStartSec: 6,
    mode: 'insert',
    idSeed: 'audio-peer-overlap',
  });

  assert.equal(timelineTrackHasOverlap(items), false, 'the fixture must begin overlap-free');
  assert.equal(result, items, 'invalid linked drops must return the last committed timeline');
  assert.equal(timelineTrackHasOverlap(result), false);
});

test('gap delete ripples all timeline tracks after the selected empty range', () => {
  const result = deleteTimelineGapAndRipple({
    items: [
      videoClip({ id: 'video-a', startSec: 0, durationSec: 5, track: 'video' }),
      videoClip({ id: 'video-b', startSec: 10, durationSec: 5, track: 'video' }),
      audioClip({ id: 'audio-a', startSec: 10, durationSec: 5, track: 'audio' }),
    ],
    gap: { startSec: 5, endSec: 10, track: 'video' },
  });

  assert.deepEqual(result.items.map((item) => [item.id, item.startSec]), [
    ['video-a', 0],
    ['video-b', 5],
    ['audio-a', 5],
  ]);
});

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

test('timeline gap deletion uses the clicked track to select a gap and ripples all tracks', () => {
  const items = [
    timelineItem({ id: 'video-a', outputNodeId: 'video-a', startSec: 0, durationSec: 4, linkedGroupId: null, linkedGroupKind: null }),
    timelineItem({ id: 'video-b', outputNodeId: 'video-b', startSec: 10, durationSec: 4, linkedGroupId: null, linkedGroupKind: null }),
    timelineItem({
      id: 'audio-a',
      outputNodeId: 'audio-a',
      track: 'audio',
      mediaKind: 'audio',
      startSec: 0,
      durationSec: 4,
      linkedGroupId: null,
      linkedGroupKind: null,
    }),
    timelineItem({
      id: 'audio-b',
      outputNodeId: 'audio-b',
      track: 'audio',
      mediaKind: 'audio',
      startSec: 10,
      durationSec: 4,
      linkedGroupId: null,
      linkedGroupKind: null,
    }),
  ];

  const updated = deleteWorkspaceTimelineGap(items, { startSec: 4, endSec: 10, track: 'video' });

  assert.deepEqual(
    updated.map((item) => [item.id, item.track, item.startSec]),
    [
      ['video-a', 'video', 0],
      ['video-b', 'video', 4],
      ['audio-a', 'audio', 0],
      ['audio-b', 'audio', 4],
    ]
  );
});

test('timeline gap deletion keeps automatic linked audio synced after a clicked-track ripple', () => {
  const items = [
    timelineItem({ id: 'intro', outputNodeId: 'intro', startSec: 0, durationSec: 4, linkedGroupId: null, linkedGroupKind: null }),
    timelineItem({ id: 'linked-video', outputNodeId: 'linked', startSec: 10, durationSec: 4, linkedGroupId: 'linked', linkedGroupKind: 'video-audio' }),
    timelineItem({
      id: 'linked-audio',
      outputNodeId: 'linked',
      track: 'audio',
      mediaKind: 'audio',
      startSec: 10,
      durationSec: 4,
      linkedGroupId: 'linked',
      linkedGroupKind: 'video-audio',
    }),
  ];

  const updated = deleteWorkspaceTimelineGap(items, { startSec: 4, endSec: 10, track: 'video' });

  assert.deepEqual(
    updated.filter((item) => item.linkedGroupId === 'linked').map((item) => [item.id, item.track, item.startSec, item.durationSec]),
    [
      ['linked-video', 'video', 4, 4],
      ['linked-audio', 'audio', 4, 4],
    ]
  );
  assert.equal(timelineTrackHasOverlap(updated), false);
});

test('timeline gap deletion rejects linked sync that would create a same-track overlap', () => {
  const items = [
    timelineItem({ id: 'intro', outputNodeId: 'intro', startSec: 0, durationSec: 4, linkedGroupId: null, linkedGroupKind: null }),
    timelineItem({ id: 'linked-video', outputNodeId: 'linked', startSec: 10, durationSec: 4, linkedGroupId: 'linked', linkedGroupKind: 'video-audio' }),
    timelineItem({
      id: 'linked-audio',
      outputNodeId: 'linked',
      track: 'audio',
      mediaKind: 'audio',
      startSec: 10,
      durationSec: 4,
      linkedGroupId: 'linked',
      linkedGroupKind: 'video-audio',
    }),
    timelineItem({
      id: 'music-bed',
      outputNodeId: 'music-bed',
      track: 'audio',
      mediaKind: 'audio',
      startSec: 5,
      durationSec: 2,
      linkedGroupId: null,
      linkedGroupKind: null,
    }),
  ];

  const updated = deleteWorkspaceTimelineGap(items, { startSec: 4, endSec: 10, track: 'video' });

  assert.equal(updated, items);
});

test('timeline atomic ripple delete removes linked groups once and keeps later groups synced', () => {
  const items = [
    timelineItem({ id: 'clip-a', outputNodeId: 'clip-a', startSec: 0, durationSec: 4, linkedGroupId: 'group-a', linkedGroupKind: 'video-audio' }),
    timelineItem({
      id: 'clip-a-audio',
      outputNodeId: 'clip-a',
      track: 'audio',
      mediaKind: 'audio',
      startSec: 0,
      durationSec: 4,
      linkedGroupId: 'group-a',
      linkedGroupKind: 'video-audio',
    }),
    timelineItem({ id: 'clip-b', outputNodeId: 'clip-b', startSec: 4, durationSec: 4, linkedGroupId: 'group-b', linkedGroupKind: 'video-audio' }),
    timelineItem({
      id: 'clip-b-audio',
      outputNodeId: 'clip-b',
      track: 'audio',
      mediaKind: 'audio',
      startSec: 4,
      durationSec: 4,
      linkedGroupId: 'group-b',
      linkedGroupKind: 'video-audio',
    }),
    timelineItem({ id: 'clip-c', outputNodeId: 'clip-c', startSec: 8, durationSec: 4, linkedGroupId: 'group-c', linkedGroupKind: 'video-audio' }),
    timelineItem({
      id: 'clip-c-audio',
      outputNodeId: 'clip-c',
      track: 'audio',
      mediaKind: 'audio',
      startSec: 8,
      durationSec: 4,
      linkedGroupId: 'group-c',
      linkedGroupKind: 'video-audio',
    }),
  ];

  const updated = deleteWorkspaceTimelineItems(items, ['clip-a', 'clip-a-audio', 'clip-b'], { ripple: true });

  assert.deepEqual(
    updated.map((item) => [item.id, item.track, item.startSec, item.durationSec, item.linkedGroupId]),
    [
      ['clip-c', 'video', 0, 4, 'group-c'],
      ['clip-c-audio', 'audio', 0, 4, 'group-c'],
    ]
  );
  assert.equal(timelineTrackHasOverlap(updated), false);
});

test('timeline atomic ripple delete resyncs linked groups after unrelated shifts', () => {
  const items = [
    timelineItem({ id: 'intro', outputNodeId: 'intro', startSec: 0, durationSec: 4, linkedGroupId: null, linkedGroupKind: null }),
    timelineItem({ id: 'late-video', outputNodeId: 'late', startSec: 8, durationSec: 4, linkedGroupId: 'late', linkedGroupKind: 'video-audio' }),
    timelineItem({
      id: 'late-audio',
      outputNodeId: 'late',
      track: 'audio',
      mediaKind: 'audio',
      startSec: 8,
      durationSec: 4,
      linkedGroupId: 'late',
      linkedGroupKind: 'video-audio',
    }),
  ];

  const updated = deleteWorkspaceTimelineItems(items, ['intro'], { ripple: true });

  assert.deepEqual(
    updated.map((item) => [item.id, item.track, item.startSec, item.durationSec]),
    [
      ['late-video', 'video', 4, 4],
      ['late-audio', 'audio', 4, 4],
    ]
  );
});

test('timeline atomic ripple delete rejects linked sync that would overlap another audio clip', () => {
  const items = [
    timelineItem({ id: 'intro', outputNodeId: 'intro', startSec: 0, durationSec: 4, linkedGroupId: null, linkedGroupKind: null }),
    timelineItem({ id: 'late-video', outputNodeId: 'late', startSec: 8, durationSec: 4, linkedGroupId: 'late', linkedGroupKind: 'video-audio' }),
    timelineItem({
      id: 'late-audio',
      outputNodeId: 'late',
      track: 'audio',
      mediaKind: 'audio',
      startSec: 8,
      durationSec: 4,
      linkedGroupId: 'late',
      linkedGroupKind: 'video-audio',
    }),
    timelineItem({
      id: 'music-bed',
      outputNodeId: 'music-bed',
      track: 'audio',
      mediaKind: 'audio',
      startSec: 5,
      durationSec: 2,
      linkedGroupId: null,
      linkedGroupKind: null,
    }),
  ];

  const updated = deleteWorkspaceTimelineItems(items, ['intro'], { ripple: true });

  assert.equal(updated, items);
});

test('timeline locked-track guard reports only tracks changed by an edit', () => {
  const items = [
    timelineItem({ id: 'video-a', outputNodeId: 'video-a', startSec: 0, durationSec: 4, linkedGroupId: null, linkedGroupKind: null }),
    timelineItem({ id: 'video-b', outputNodeId: 'video-b', startSec: 10, durationSec: 4, linkedGroupId: null, linkedGroupKind: null }),
    timelineItem({
      id: 'audio-b',
      outputNodeId: 'audio-b',
      track: 'audio',
      mediaKind: 'audio',
      startSec: 10,
      durationSec: 4,
      linkedGroupId: null,
      linkedGroupKind: null,
    }),
  ];
  const nextItems = deleteWorkspaceTimelineGap(items, { startSec: 4, endSec: 10, track: 'video' });

  assert.equal(timelineEditTouchesLockedTracks(items, nextItems, ['audio']), true);
  assert.equal(timelineEditTouchesLockedTracks(items, nextItems, ['video']), true);
});
