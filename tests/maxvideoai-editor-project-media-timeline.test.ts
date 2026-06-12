import assert from 'node:assert/strict';
import test from 'node:test';
import { TIMELINE_NODE_DRAG_TYPE } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/timeline/timeline-external-drop';
import {
  applyProjectMediaTimelineDragPayload,
  projectMediaTimelineDragPayloadForAsset,
  projectMediaTimelineDragPayloadForGeneratedNode,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-project-media-drag';
import { resolveProjectAssetTimelineInsert } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-project-media-timeline';
import type {
  WorkspaceAssetRecord,
  WorkspaceGraphNode,
  WorkspaceTimelineItem,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-types';

const baseTimelineItem: WorkspaceTimelineItem = {
  id: 'existing-v2',
  outputNodeId: 'existing-node',
  title: 'Existing V2 clip',
  track: 'video-2',
  mediaKind: 'video',
  mediaUrl: '/media/existing.mp4',
  thumbnailUrl: '/media/existing.jpg',
  durationSec: 5,
  startSec: 0,
  sourceStartSec: 0,
  sourceDurationSec: 5,
  status: 'completed',
};

function imageAsset(overrides: Partial<WorkspaceAssetRecord> = {}): WorkspaceAssetRecord {
  return {
    id: 'image-asset',
    kind: 'image',
    filename: 'Product_shot.png',
    subtitle: 'Image · 1920x1080',
    url: '/media/product-shot.png',
    thumbUrl: '/media/product-shot.png',
    durationSec: 5,
    dimensions: '1920x1080',
    ...overrides,
  };
}

function generatedVideoNode(overrides: Partial<WorkspaceGraphNode> = {}): WorkspaceGraphNode {
  return {
    id: 'generated-video-node',
    type: 'output',
    position: { x: 0, y: 0 },
    data: {
      kind: 'output',
      title: 'Dev Output Block',
      output: {
        kind: 'video',
        modelId: 'veo-3.1',
        modelLabel: 'Veo 3.1',
        workflowType: 'image_to_video',
        durationSec: 6,
        status: 'ready',
        createdAt: '2026-01-01T00:00:00.000Z',
        sourceShotId: 'shot-1',
        url: '/media/generated.mp4',
        thumbUrl: '/media/generated.jpg',
      },
    },
    ...overrides,
  };
}

test('project media drag payload preserves asset timeline duration and preview metadata', () => {
  const payload = projectMediaTimelineDragPayloadForAsset(imageAsset({
    id: 'asset-product',
    filename: 'Product_shot.png',
    durationSec: 4.2,
    thumbUrl: '/media/product-thumb.jpg',
  }));

  assert.deepEqual(payload, {
    assetId: 'asset-product',
    durationSec: 4.2,
    mediaKind: 'image',
    previewUrl: '/media/product-thumb.jpg',
    title: 'Product_shot.png',
  });

  const transferWrites = new Map<string, string>();
  const dataTransfer = {
    effectAllowed: 'none' as DataTransfer['effectAllowed'],
    setData(format: string, value: string) {
      transferWrites.set(format, value);
    },
  };

  assert.ok(payload);
  applyProjectMediaTimelineDragPayload(dataTransfer, payload);
  assert.equal(dataTransfer.effectAllowed, 'copyMove');
  assert.deepEqual(JSON.parse(transferWrites.get(TIMELINE_NODE_DRAG_TYPE) ?? '{}'), payload);
  assert.equal(transferWrites.get('text/plain'), 'Product_shot.png');
});

test('project media drag payload only exposes completed generated media', () => {
  const payload = projectMediaTimelineDragPayloadForGeneratedNode(generatedVideoNode());

  assert.deepEqual(payload, {
    durationSec: 6,
    mediaKind: 'video',
    nodeId: 'generated-video-node',
    previewUrl: '/media/generated.jpg',
    title: 'Dev Output Block',
  });

  const placeholderPayload = projectMediaTimelineDragPayloadForGeneratedNode(generatedVideoNode({
    data: {
      kind: 'output',
      title: 'Processing Output',
      output: {
        kind: 'video',
        modelId: 'veo-3.1',
        modelLabel: 'Veo 3.1',
        workflowType: 'image_to_video',
        durationSec: 6,
        status: 'processing',
        createdAt: '2026-01-01T00:00:00.000Z',
        sourceShotId: 'shot-1',
        url: '/media/generated.mp4',
        thumbUrl: '/media/generated.jpg',
      },
    },
  }));

  assert.equal(placeholderPayload, null);
});

test('project media timeline resolver places compatible media on the requested track', () => {
  const result = resolveProjectAssetTimelineInsert({
    assetId: 'image-asset',
    projectAssets: [imageAsset()],
    currentItems: [baseTimelineItem],
    startSec: 5,
    targetTrack: 'video-2',
    lockedTimelineTracks: [],
    allowInsertIntoClip: false,
    idSeed: 'unit',
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;

  const insertedItem = result.items.find((item) => item.id === result.selectedItemId);
  assert.ok(insertedItem, 'resolver should report the inserted timeline item');
  assert.equal(insertedItem.track, 'video-2');
  assert.equal(insertedItem.startSec, 5);
  assert.equal(insertedItem.durationSec, 5);
  assert.equal(result.playheadSec, 5);
  assert.match(result.notice, /dropped on video-2/);

  const v2Items = result.items
    .filter((item) => item.track === 'video-2')
    .sort((left, right) => left.startSec - right.startSec);
  for (let index = 1; index < v2Items.length; index += 1) {
    const previous = v2Items[index - 1];
    const current = v2Items[index];
    assert.ok(previous.startSec + previous.durationSec <= current.startSec, 'inserted project media should not overlap the target track');
  }
});

test('project media timeline resolver rejects incompatible target tracks', () => {
  const result = resolveProjectAssetTimelineInsert({
    assetId: 'video-asset',
    projectAssets: [
      {
        id: 'video-asset',
        kind: 'video',
        filename: 'Motorcycle_ride.mp4',
        subtitle: 'Video · 5s',
        url: '/media/motorcycle-ride.mp4',
        thumbUrl: '/media/motorcycle-ride.jpg',
        durationSec: 5,
        dimensions: '3840x2160',
      },
    ],
    currentItems: [],
    startSec: 0,
    targetTrack: 'audio-2',
    lockedTimelineTracks: [],
    allowInsertIntoClip: false,
    idSeed: 'unit',
  });

  assert.equal(result.ok, false);
  assert.match(result.notice, /not compatible with the audio-2 track/);
});
