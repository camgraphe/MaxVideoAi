import assert from 'node:assert/strict';
import test from 'node:test';
import {
  durationForTimelineDropPayload,
  insertionBoundaryForTimelineTrack,
  parseTimelineNodeDragPayload,
  resolveTimelineExternalDropDisplacements,
  resolveTimelineExternalDropPreview,
  TIMELINE_NODE_DRAG_TYPE,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/timeline/timeline-external-drop';
import type { WorkspaceTimelineItem } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-types';

function dataTransfer(payload: unknown, type = TIMELINE_NODE_DRAG_TYPE) {
  return {
    types: [type],
    getData: (format: string) => (format === type ? JSON.stringify(payload) : ''),
  };
}

function timelineItem(overrides: Partial<WorkspaceTimelineItem>): WorkspaceTimelineItem {
  return {
    id: 'clip-a',
    outputNodeId: 'node-a',
    title: 'Clip A',
    track: 'video',
    durationSec: 10,
    startSec: 0,
    mediaKind: 'video',
    mediaUrl: '/media/a.mp4',
    thumbnailUrl: '/media/a.jpg',
    status: 'completed',
    ...overrides,
  };
}

test('timeline external drop helper parses node and asset payloads safely', () => {
  assert.deepEqual(
    parseTimelineNodeDragPayload(dataTransfer({ nodeId: 'node-1', mediaKind: 'video', title: 'Video block' })),
    { nodeId: 'node-1', mediaKind: 'video', title: 'Video block' }
  );
  assert.deepEqual(
    parseTimelineNodeDragPayload(dataTransfer({ assetId: 'asset-1', mediaKind: 'audio', durationSec: 3 })),
    { assetId: 'asset-1', mediaKind: 'audio', durationSec: 3 }
  );
  assert.equal(parseTimelineNodeDragPayload(dataTransfer({ nodeId: 'node-1' })), null);
  assert.equal(parseTimelineNodeDragPayload(dataTransfer({ nodeId: 'node-1', mediaKind: 'video' }, 'text/plain')), null);
});

test('timeline external drop helper resolves ghost duration and insertion boundary', () => {
  const clip = timelineItem({ startSec: 4, durationSec: 8 });

  assert.equal(durationForTimelineDropPayload({ nodeId: 'node-1', mediaKind: 'video', durationSec: 0 }), 5);
  assert.equal(durationForTimelineDropPayload({ nodeId: 'node-1', mediaKind: 'video', durationSec: 0.5 }), 1);
  assert.equal(insertionBoundaryForTimelineTrack([clip], 'video', 5), 4);
  assert.equal(insertionBoundaryForTimelineTrack([clip], 'video', 11), 12);

  assert.deepEqual(
    resolveTimelineExternalDropPreview({
      isInsertIntoClipEnabled: false,
      items: [clip],
      lockedTracks: new Set(),
      payload: { nodeId: 'node-1', mediaKind: 'video', durationSec: 6, title: 'Generated clip' },
      rawStartSec: 11,
      track: 'video',
    }),
    {
      displacedItems: [],
      durationSec: 6,
      ghostItems: [
        {
          durationSec: 6,
          isPrimary: true,
          mediaKind: 'video',
          previewUrl: undefined,
          startSec: 12,
          title: 'Generated clip',
          trackId: 'video',
        },
      ],
      isValid: true,
      mediaKind: 'video',
      previewUrl: undefined,
      startSec: 12,
      title: 'Generated clip',
      trackId: 'video',
    }
  );
});

test('timeline external drop helper rejects incompatible and locked tracks', () => {
  const lockedPreview = resolveTimelineExternalDropPreview({
    isInsertIntoClipEnabled: true,
    items: [],
    lockedTracks: new Set(['video']),
    payload: { nodeId: 'node-1', mediaKind: 'video' },
    rawStartSec: 3,
    track: 'video',
  });
  const incompatiblePreview = resolveTimelineExternalDropPreview({
    isInsertIntoClipEnabled: true,
    items: [],
    lockedTracks: new Set(),
    payload: { nodeId: 'node-2', mediaKind: 'audio' },
    rawStartSec: 3,
    track: 'video',
  });

  assert.equal(lockedPreview?.isValid, false);
  assert.equal(incompatiblePreview?.isValid, false);
  assert.equal(incompatiblePreview?.title, 'Audio clip');
});

test('timeline external drop helper previews shifted clips on affected tracks', () => {
  const items = [
    timelineItem({
      id: 'clip-a',
      linkedGroupId: 'group-a',
      linkedGroupKind: 'video-audio',
      startSec: 0,
      durationSec: 4,
    }),
    timelineItem({
      id: 'clip-a-audio',
      linkedGroupId: 'group-a',
      linkedGroupKind: 'video-audio',
      mediaKind: 'audio',
      track: 'audio',
      startSec: 0,
      durationSec: 4,
      title: 'Clip A Audio',
    }),
    timelineItem({
      id: 'clip-b',
      startSec: 4,
      durationSec: 6,
      title: 'Clip B',
    }),
    timelineItem({
      id: 'music-a',
      mediaKind: 'audio',
      track: 'audio-2',
      startSec: 0,
      durationSec: 12,
      title: 'Music',
    }),
  ];

  assert.deepEqual(
    resolveTimelineExternalDropDisplacements({
      insertDurationSec: 5,
      insertStartSec: 4,
      items,
      track: 'video',
    }).map((item) => [item.itemId, item.trackId, item.fromStartSec, item.toStartSec, item.durationSec]),
    [
      ['clip-b', 'video', 4, 9, 6],
    ],
    'whole-clip insertion should preview later visual clips moving right'
  );

  assert.deepEqual(
    resolveTimelineExternalDropDisplacements({
      insertDurationSec: 5,
      insertStartSec: 2,
      items,
      track: 'video',
    }).map((item) => [item.itemId, item.trackId, item.fromStartSec, item.toStartSec, item.durationSec]),
    [
      ['clip-a:tail-preview', 'video', 2, 7, 2],
      ['clip-a-audio:tail-preview', 'audio', 2, 7, 2],
      ['clip-b', 'video', 4, 9, 6],
    ],
    'insert-into-clip preview should include split tails and linked audio tails'
  );

  const preview = resolveTimelineExternalDropPreview({
    isInsertIntoClipEnabled: false,
    items,
    lockedTracks: new Set(),
    payload: { assetId: 'asset-1', mediaKind: 'video', durationSec: 5, title: 'Insert me' },
    rawStartSec: 1,
    track: 'video',
  });
  assert.deepEqual(
    preview?.displacedItems.map((item) => [item.itemId, item.trackId, item.toStartSec]),
    [
      ['clip-a', 'video', 5],
      ['clip-a-audio', 'audio', 5],
      ['clip-b', 'video', 9],
    ],
    'external drop preview should show the final pushed positions used by whole-clip insert'
  );
});

test('timeline external drop helper previews linked audio ghosts for video assets with audio', () => {
  const preview = resolveTimelineExternalDropPreview({
    isInsertIntoClipEnabled: true,
    items: [],
    lockedTracks: new Set(),
    payload: {
      assetId: 'asset-linked',
      durationSec: 8,
      hasTimelineAudio: true,
      mediaKind: 'video',
      previewUrl: '/media/linked.jpg',
      title: 'Linked video',
    },
    rawStartSec: 2,
    track: 'video-2',
  });

  assert.deepEqual(preview?.ghostItems, [
    {
      durationSec: 8,
      isPrimary: true,
      mediaKind: 'video',
      previewUrl: '/media/linked.jpg',
      startSec: 2,
      title: 'Linked video',
      trackId: 'video-2',
    },
    {
      durationSec: 8,
      isPrimary: false,
      mediaKind: 'audio',
      previewUrl: null,
      startSec: 2,
      title: 'Linked video Audio',
      trackId: 'audio',
    },
  ]);
});
