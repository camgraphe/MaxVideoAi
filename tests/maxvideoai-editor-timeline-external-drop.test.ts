import assert from 'node:assert/strict';
import test from 'node:test';
import {
  durationForTimelineDropPayload,
  insertionBoundaryForTimelineTrack,
  parseTimelineNodeDragPayload,
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
      durationSec: 6,
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
