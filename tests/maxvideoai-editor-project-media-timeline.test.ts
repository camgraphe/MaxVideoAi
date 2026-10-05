import assert from 'node:assert/strict';
import test from 'node:test';
import {workspaceAssetRecordFromLibraryAsset} from '../frontend/app/(core)/(workspace)/app/studio/_shared/_lib/workspace-library-assets';
import {buildWorkspaceTimelineItemsForAsset} from '../frontend/app/(core)/(workspace)/app/studio/_shared/_lib/timeline/timeline-builders';
import {resolveWorkspaceAudioProvenance,shouldMuteWorkspaceTimelineVideo} from '../frontend/app/(core)/(workspace)/app/studio/_shared/_lib/workspace-audio-provenance';
import {normalizeTimelineMediaUrls} from '../frontend/app/(core)/(workspace)/app/studio/_shared/_state/workspace-normalizers';
import type {WorkspaceAssetRecord,WorkspaceGraphNode,WorkspaceTimelineItem} from '../frontend/app/(core)/(workspace)/app/studio/_shared/_lib/workspace-types';
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
        requestedSettings: {
          durationSec: 6,
          aspectRatio: '16:9',
          resolution: '1080p',
          fps: 24,
          outputCount: 1,
        },
        sourceMetadata: {
          measurementStatus: 'unknown',
          durationSec: null,
          width: null,
          height: null,
        },
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

test('timeline builders keep unknown imported media duration out of source provenance', () => {
  const unknownVideoItems = buildWorkspaceTimelineItemsForAsset({
    assetNodeId: 'unknown-video',
    title: 'Unknown video',
    asset: {
      id: 'unknown-video',
      kind: 'video',
      filename: 'unknown.mp4',
      subtitle: 'Video',
      url: '/media/unknown.mp4',
      hasAudio: false,
    },
    startSec: 0,
    idSeed: 'unknown-video',
  });
  const unknownAudioItems = buildWorkspaceTimelineItemsForAsset({
    assetNodeId: 'unknown-audio',
    title: 'Unknown audio',
    asset: {
      id: 'unknown-audio',
      kind: 'audio',
      filename: 'unknown.wav',
      subtitle: 'Audio',
      url: '/media/unknown.wav',
    },
    startSec: 0,
    idSeed: 'unknown-audio',
  });
  const measuredItems = buildWorkspaceTimelineItemsForAsset({
    assetNodeId: 'measured-video',
    title: 'Measured video',
    asset: {
      id: 'measured-video',
      kind: 'video',
      filename: 'measured.mp4',
      subtitle: 'Video',
      url: '/media/measured.mp4',
      durationSec: 9.25,
      hasAudio: false,
    },
    startSec: 0,
    idSeed: 'measured-video',
  });

  assert.equal(unknownVideoItems[0]?.durationSec, 6, 'unknown video may use a temporary editing duration');
  assert.equal(unknownAudioItems[0]?.durationSec, 12, 'unknown audio may use a temporary editing duration');
  assert.equal(unknownVideoItems[0]?.sourceDurationSec, undefined);
  assert.equal(unknownAudioItems[0]?.sourceDurationSec, undefined);
  assert.equal(measuredItems[0]?.sourceDurationSec, 9.25);
});

test('project media import defers valid-looking library metadata until hydration', () => {
  const libraryAsset = {
    id: 'library-image-1',
    name: 'library-image.png',
    kind: 'image' as const,
    meta: 'Image · 1920x1080',
    url: 'https://example.com/library-image.png',
    durationSec: 12,
    dimensions: '1920x1080',
  };

  const projectAsset = workspaceAssetRecordFromLibraryAsset(libraryAsset);

  assert.equal(projectAsset.subtitle, 'Image');
  assert.equal(projectAsset.durationSec, undefined);
  assert.equal(projectAsset.dimensions, undefined);
});

test('generated video project assets preserve their dedicated linked audio on the timeline',()=>{
  const asset: WorkspaceAssetRecord={id:'generated-video-audio',kind:'video',filename:'Generated.mp4',subtitle:'Video',
    url:'https://example.com/video.mp4',audioUrl:'https://example.com/video-audio.mp3',thumbUrl:'https://example.com/thumb.jpg',
    durationSec:7,audioProvenance:'external',hasAudio:true};
  const items=buildWorkspaceTimelineItemsForAsset({assetNodeId:asset.id,title:'Generated Video With Audio',asset,startSec:0,idSeed:'generated-audio'});
  assert.deepEqual(items.map(item=>[item.track,item.mediaKind,item.mediaUrl,item.audioProvenance,item.hasEmbeddedAudio]),[
    ['video','video','https://example.com/video.mp4','external',false],
    ['audio','audio','https://example.com/video-audio.mp3','external',undefined],
  ]);
  assert.equal(items[0].linkedGroupId,items[1].linkedGroupId);
  assert.deepEqual(items.map(item=>[item.startSec,item.durationSec,item.sourceDurationSec]),[[0,7,7],[0,7,7]]);
});

test('timeline audio normalization prefers dedicated audio but preserves embedded MP4 containers', () => {
  const videoNode = generatedVideoNode({
    data: {
      kind: 'output',
      title: 'Video with dedicated audio',
      output: {
        ...generatedVideoNode().data.output!,
        url: '/media/primary.mp4',
        audioUrl: '/media/dedicated.m4a',
        audioProvenance: 'external',
      },
    },
  });
  const externalItem: WorkspaceTimelineItem = {
    id: 'external-audio-role',
    outputNodeId: videoNode.id,
    title: 'External audio',
    track: 'audio',
    mediaKind: 'audio',
    mediaUrl: '/media/primary.mp4',
    durationSec: 5,
    startSec: 0,
    audioProvenance: 'external',
  };
  const embeddedNode: WorkspaceGraphNode = {
    ...videoNode,
    id: 'embedded-video-node',
    data: {
      ...videoNode.data,
      output: {
        ...videoNode.data.output!,
        audioUrl: null,
        audioProvenance: 'embedded',
      },
    },
  };
  const embeddedItem: WorkspaceTimelineItem = {
    ...externalItem,
    id: 'embedded-audio-role',
    outputNodeId: embeddedNode.id,
    title: 'Embedded audio',
    audioProvenance: 'embedded',
  };

  const normalized = normalizeTimelineMediaUrls([videoNode, embeddedNode], [externalItem, embeddedItem]);
  assert.equal(normalized[0]?.mediaUrl, '/media/dedicated.m4a');
  assert.equal(normalized[1]?.mediaUrl, '/media/primary.mp4');
});

test('timeline audio provenance distinguishes embedded, external, none, and unknown video', () => {
  const embeddedItems = buildWorkspaceTimelineItemsForAsset({
    assetNodeId: 'embedded-video',
    title: 'Embedded video',
    asset: {
      id: 'embedded-video',
      kind: 'video',
      filename: 'embedded.mp4',
      subtitle: 'Video',
      url: '/media/embedded.mp4',
      audioProvenance: 'embedded',
      hasAudio: true,
    },
    startSec: 0,
    idSeed: 'embedded',
  });
  const unknownItems = buildWorkspaceTimelineItemsForAsset({
    assetNodeId: 'upscaled-video',
    title: 'Upscaled video',
    asset: {
      id: 'upscaled-video',
      kind: 'video',
      filename: 'upscaled.mp4',
      subtitle: 'Video',
      url: '/media/upscaled.mp4',
      audioProvenance: 'unknown',
    },
    startSec: 0,
    idSeed: 'upscaled',
  });

  assert.equal(embeddedItems.length, 1);
  assert.equal(embeddedItems[0]?.audioProvenance, 'embedded');
  assert.equal(embeddedItems[0]?.hasEmbeddedAudio, true);
  assert.equal(unknownItems.length, 1);
  assert.equal(unknownItems[0]?.audioProvenance, 'unknown');
  assert.equal(unknownItems[0]?.hasEmbeddedAudio, undefined);
  assert.equal(resolveWorkspaceAudioProvenance({ kind: 'video', hasAudio: true }), 'embedded');
  assert.equal(resolveWorkspaceAudioProvenance({ kind: 'video' }), 'unknown');
});

test('export video audio is muted whenever a separate linked audio clip renders', () => {
  assert.equal(shouldMuteWorkspaceTimelineVideo({
    includeAudio: true,
    audioProvenance: 'embedded',
    hasExternalLinkedAudio: false,
    audioMixMuted: false,
  }), false);
  assert.equal(shouldMuteWorkspaceTimelineVideo({
    includeAudio: true,
    audioProvenance: 'embedded',
    hasExternalLinkedAudio: true,
    audioMixMuted: false,
  }), true);
  assert.equal(shouldMuteWorkspaceTimelineVideo({
    includeAudio: true,
    audioProvenance: 'none',
    hasExternalLinkedAudio: false,
    audioMixMuted: false,
  }), true);
});
