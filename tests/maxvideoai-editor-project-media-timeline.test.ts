import assert from 'node:assert/strict';
import test from 'node:test';
import { TIMELINE_NODE_DRAG_TYPE } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/timeline/timeline-external-drop';
import {
  applyProjectMediaTimelineDragPayload,
  projectMediaTimelineKindForGeneratedNode,
  projectMediaTimelineDragPayloadForAsset,
  projectMediaTimelineDragPayloadForGeneratedNode,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-project-media-drag';
import {
  applyWorkspaceProjectAssetMetadataToTimelineItems,
  workspaceAssetNeedsMeasuredDimensions,
  workspaceProjectMediaNeedsMetadata,
  workspaceProjectMediaResolutionLabel,
  workspaceProjectAssetMetadataSource,
  workspaceProjectAssetMetadataSourceUrl,
  workspaceAssetWithMeasuredMetadata,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-project-media-metadata';
import {
  mediaSubtitleForAsset,
  mediaSubtitleForGeneratedNode,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_controllers/useProjectMediaController';
import {
  synchronizeGeneratedOutputNodeProjectMediaFolder,
  workspaceAssetFromOutputNode,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-generated-media';
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

test('project media metadata helpers do not invent resolution for unknown videos', () => {
  const asset = {
    id: 'asset-unknown-video',
    kind: 'video',
    filename: 'unknown.mp4',
    subtitle: 'Video',
    url: 'https://example.com/unknown.mp4',
  } as WorkspaceAssetRecord;

  assert.equal(workspaceProjectMediaNeedsMetadata(asset), true);
  assert.equal(workspaceProjectMediaResolutionLabel(asset), null);
});

test('ready generated output nodes become typed project media assets', () => {
  const asset = workspaceAssetFromOutputNode({
    id: 'output-video-1',
    type: 'output',
    position: { x: 0, y: 0 },
    data: {
      kind: 'output',
      title: 'Generated Output',
      subtitle: 'Video',
      output: {
        kind: 'video',
        modelId: 'seedance-2-0',
        modelLabel: 'Seedance 2.0',
        workflowType: 'text_to_video',
        durationSec: 7,
        aspectRatio: '16:9',
        resolution: '1080p',
        pricing: null,
        status: 'ready',
        createdAt: '2026-07-10T00:00:00.000Z',
        sourceShotId: 'shot-1',
        url: 'https://example.com/video.mp4',
        audioUrl: null,
        thumbUrl: 'https://example.com/thumb.jpg',
        hasAudio: false,
        jobId: 'job-1',
      },
    },
  } as WorkspaceGraphNode);

  assert.equal(asset?.kind, 'video');
  assert.equal(asset?.url, 'https://example.com/video.mp4');
  assert.equal(asset?.thumbUrl, 'https://example.com/thumb.jpg');
});

test('moving a persisted generated asset synchronizes its output node folder', () => {
  const generatedNode = generatedVideoNode();
  const importedAssetId = 'imported-video-1';

  const movedNodes = synchronizeGeneratedOutputNodeProjectMediaFolder(
    [generatedNode],
    workspaceAssetFromOutputNode(generatedNode)?.id ?? '',
    'folder-deliverables'
  );
  const importedAssetMoveNodes = synchronizeGeneratedOutputNodeProjectMediaFolder(
    [generatedNode],
    importedAssetId,
    'folder-imports'
  );

  assert.equal(movedNodes[0].data.output?.projectMediaFolderId, 'folder-deliverables');
  assert.equal(importedAssetMoveNodes[0], generatedNode);
});

test('generated video project assets preserve their dedicated linked audio on the timeline', () => {
  const asset = workspaceAssetFromOutputNode({
    id: 'output-video-audio-1',
    type: 'output',
    position: { x: 0, y: 0 },
    data: {
      kind: 'output',
      title: 'Generated Video With Audio',
      output: {
        kind: 'video',
        modelId: 'seedance-2-0',
        modelLabel: 'Seedance 2.0',
        workflowType: 'text_to_video',
        durationSec: 7,
        pricing: null,
        status: 'ready',
        createdAt: '2026-07-10T00:00:00.000Z',
        sourceShotId: 'shot-1',
        url: 'https://example.com/video.mp4',
        audioUrl: 'https://example.com/video-audio.mp3',
        thumbUrl: 'https://example.com/thumb.jpg',
        hasAudio: true,
      },
    },
  } as WorkspaceGraphNode);
  assert.ok(asset);

  const result = resolveProjectAssetTimelineInsert({
    assetId: asset.id,
    projectAssets: [asset],
    currentItems: [],
    startSec: 0,
    lockedTimelineTracks: [],
    allowInsertIntoClip: false,
    idSeed: 'generated-audio',
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(
    result.items.map((item) => [item.track, item.mediaKind, item.mediaUrl]),
    [
      ['video', 'video', 'https://example.com/video.mp4'],
      ['audio', 'audio', 'https://example.com/video-audio.mp3'],
    ]
  );
});

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
    hasTimelineAudio: false,
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
    hasTimelineAudio: false,
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

test('project media drag payload excludes generated text outputs', () => {
  const textOutputNode = generatedVideoNode({
    data: {
      kind: 'output',
      title: 'Generated Copy',
      output: {
        kind: 'text',
        modelId: 'gpt-4.1',
        modelLabel: 'GPT-4.1',
        workflowType: 'chat',
        status: 'ready',
        createdAt: '2026-01-01T00:00:00.000Z',
        sourceShotId: 'shot-1',
        url: '/media/generated.txt',
      },
    },
  });

  assert.equal(projectMediaTimelineKindForGeneratedNode(textOutputNode), null);
  assert.equal(projectMediaTimelineDragPayloadForGeneratedNode(textOutputNode), null);
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
  assert.match(result.notice, /dropped on Video 2/);

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
  assert.match(result.notice, /not compatible with the Audio 2 track/);
});

test('project media measured video metadata hydrates assets and existing timeline clips', () => {
  const videoAsset: WorkspaceAssetRecord = {
    id: 'video-asset',
    kind: 'video',
    filename: 'Character_scene.mp4',
    subtitle: 'Video',
    url: '/media/character-scene.mp4',
  };

  assert.equal(workspaceAssetNeedsMeasuredDimensions(videoAsset), true);
  assert.equal(workspaceProjectAssetMetadataSourceUrl(videoAsset, []), '/media/character-scene.mp4');
  assert.deepEqual(workspaceProjectAssetMetadataSource(videoAsset, []), {
    kind: 'video',
    url: '/media/character-scene.mp4',
  });

  const hydratedAsset = workspaceAssetWithMeasuredMetadata(videoAsset, {
    durationSec: 15.2,
    height: 720,
    width: 1280,
  });

  assert.deepEqual(
    {
      dimensions: hydratedAsset.dimensions,
      durationSec: hydratedAsset.durationSec,
      subtitle: hydratedAsset.subtitle,
    },
    {
      dimensions: '1280x720',
      durationSec: 15.2,
      subtitle: 'Video · 1280x720',
    }
  );

  const insertResult = resolveProjectAssetTimelineInsert({
    assetId: videoAsset.id,
    projectAssets: [hydratedAsset],
    currentItems: [],
    startSec: 0,
    lockedTimelineTracks: [],
    allowInsertIntoClip: false,
    idSeed: 'metadata',
  });
  assert.equal(insertResult.ok, true);
  if (!insertResult.ok) return;
  assert.deepEqual(
    insertResult.items
      .filter((item) => item.mediaKind === 'video')
      .map((item) => [item.sourceWidth, item.sourceHeight]),
    [[1280, 720]],
    'new timeline clips from hydrated project media should preserve source dimensions'
  );

  const patchedItems = applyWorkspaceProjectAssetMetadataToTimelineItems(
    [
      {
        id: 'timeline-project-asset-video-asset-existing',
        outputNodeId: 'project-asset-video-asset',
        title: 'Character_scene.mp4',
        track: 'video',
        mediaKind: 'video',
        durationSec: 6,
        startSec: 0,
        mediaUrl: '/media/character-scene.mp4',
      },
      {
        id: 'timeline-project-asset-video-asset-existing-audio',
        outputNodeId: 'project-asset-video-asset',
        title: 'Character_scene.mp4 Audio',
        track: 'audio',
        mediaKind: 'audio',
        durationSec: 6,
        startSec: 0,
        mediaUrl: '/media/character-scene.mp4',
      },
    ],
    hydratedAsset
  );

  assert.deepEqual(
    patchedItems.map((item) => [
      item.id,
      item.sourceWidth ?? null,
      item.sourceHeight ?? null,
      item.sourceDurationSec ?? null,
    ]),
    [
      ['timeline-project-asset-video-asset-existing', 1280, 720, 15.2],
      ['timeline-project-asset-video-asset-existing-audio', null, null, 15.2],
    ],
    'hydrating a project media asset should repair source metadata on timeline clips that were inserted before metadata was known'
  );

  const legacyVideoAsset: WorkspaceAssetRecord = {
    id: videoAsset.id,
    kind: videoAsset.kind,
    filename: videoAsset.filename,
    subtitle: videoAsset.subtitle,
  };

  assert.equal(
    workspaceProjectAssetMetadataSourceUrl(
      legacyVideoAsset,
      [{
        id: 'timeline-project-asset-video-asset-existing',
        outputNodeId: 'project-asset-video-asset',
        title: 'Character_scene.mp4',
        track: 'video',
        mediaKind: 'video',
        durationSec: 6,
        startSec: 0,
        mediaUrl: '/media/legacy-character-scene.mp4',
      }]
    ),
    '/media/legacy-character-scene.mp4',
    'legacy project media without direct asset URLs should hydrate from existing timeline clip media'
  );

  assert.deepEqual(
    workspaceProjectAssetMetadataSource(
      {
        ...legacyVideoAsset,
        thumbUrl: 'https://media.maxvideoai.com/renders/user/render-preview.jpg',
      },
      []
    ),
    {
      kind: 'image-preview',
      url: 'https://media.maxvideoai.com/renders/user/render-preview.jpg',
    },
    'generated render previews can provide pixel dimensions when no video URL is still available'
  );

  assert.equal(
    workspaceProjectAssetMetadataSource(
      {
        ...legacyVideoAsset,
        thumbUrl: 'https://media.maxvideoai.com/user-asset-thumbs/user/compressed-preview.jpg',
      },
      []
    ),
    null,
    'compressed user upload thumbnails should not be treated as native source dimensions'
  );
});

test('project media metadata hydration candidates include missing image dimensions and video duration', () => {
  assert.equal(
    workspaceAssetNeedsMeasuredDimensions(imageAsset({
      dimensions: undefined,
      subtitle: 'Image',
      thumbUrl: 'https://media.maxvideoai.com/renders/user/still-preview.jpg',
      url: undefined,
    })),
    true,
    'render-backed image assets without dimensions should be repaired by browser metadata hydration'
  );

  assert.equal(
    workspaceAssetNeedsMeasuredDimensions({
      id: 'durationless-video',
      kind: 'video',
      filename: 'Durationless_scene.mp4',
      subtitle: 'Video · 1920x1080',
      url: '/media/durationless-scene.mp4',
      dimensions: '1920x1080',
    }),
    true,
    'video assets with dimensions but missing duration should still be metadata hydration candidates'
  );

  const durationOnlyHydratedAsset = workspaceAssetWithMeasuredMetadata(
    {
      id: 'durationless-video',
      kind: 'video',
      filename: 'Durationless_scene.mp4',
      subtitle: 'Video · 1920x1080',
      url: '/media/durationless-scene.mp4',
      dimensions: '1920x1080',
    },
    { durationSec: 9.25 }
  );

  assert.equal(durationOnlyHydratedAsset.durationSec, 9.25);
  assert.equal(durationOnlyHydratedAsset.subtitle, 'Video · 1920x1080');

  const patchedItems = applyWorkspaceProjectAssetMetadataToTimelineItems(
    [
      {
        id: 'timeline-project-asset-durationless-video',
        outputNodeId: 'project-asset-durationless-video',
        title: 'Durationless_scene.mp4',
        track: 'video',
        mediaKind: 'video',
        durationSec: 5,
        startSec: 0,
        mediaUrl: '/media/durationless-scene.mp4',
      },
    ],
    durationOnlyHydratedAsset
  );

  assert.deepEqual(
    patchedItems.map((item) => ({
      sourceDurationSec: item.sourceDurationSec ?? null,
      sourceHeight: item.sourceHeight ?? null,
      sourceWidth: item.sourceWidth ?? null,
    })),
    [{ sourceDurationSec: 9.25, sourceHeight: 1080, sourceWidth: 1920 }],
    'duration-only repairs should still update derived timeline clip source duration'
  );
});

test('project media subtitles do not hide missing source dimensions', () => {
  assert.equal(
    mediaSubtitleForAsset({
      id: 'unknown-video',
      kind: 'video',
      filename: 'unknown-source.mp4',
      subtitle: 'Video',
      url: '/media/unknown-source.mp4',
      durationSec: 15,
    }),
    '00:15',
    'video assets without measured dimensions should not display a fake aspect ratio'
  );

  assert.equal(
    mediaSubtitleForAsset({
      id: 'unknown-audio',
      kind: 'audio',
      filename: 'unknown-source.wav',
      subtitle: 'Audio',
      url: '/media/unknown-source.wav',
    }),
    '',
    'audio assets without measured details should not display a fabricated sample rate'
  );

  assert.equal(
    mediaSubtitleForAsset({
      id: 'measured-audio',
      kind: 'audio',
      filename: 'measured-source.wav',
      subtitle: 'Audio',
      url: '/media/measured-source.wav',
      durationSec: 12,
    }),
    '00:12',
    'audio assets should only display measured metadata'
  );

  assert.equal(
    mediaSubtitleForGeneratedNode(generatedVideoNode({
      data: {
        kind: 'output',
        title: 'Generated 720p',
        output: {
          kind: 'video',
          modelId: 'luma-ray-3-2',
          modelLabel: 'Luma Ray 3.2',
          workflowType: 'image_to_video',
          durationSec: 6,
          aspectRatio: '16:9',
          resolution: '720p',
          status: 'ready',
          createdAt: '2026-06-14T10:00:00.000Z',
          sourceShotId: 'shot-1',
          url: '/media/generated-720p.mp4',
        },
      },
    })),
    '00:06 • 1280x720 • 16:9 • Luma Ray 3.2',
    'generated video cards should expose derived source dimensions from output metadata'
  );
});
