import assert from 'node:assert/strict';
import test from 'node:test';
import {
  workspaceProjectAssetFromCompletedTimelineExport,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-timeline-export';
import {
  buildWorkspaceTimelineRenderManifest,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-timeline-render';
import {
  buildWorkspaceClipComposition,
  resolveWorkspaceClipFitHeightScale,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-clip-composition';
import type {
  WorkspaceTimelineRenderManifest,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-timeline-render';
import type {
  WorkspaceGraphNode,
  WorkspaceTimelineItem,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-types';

const readyManifest: WorkspaceTimelineRenderManifest = {
  version: 1,
  source: 'maxvideoai-editor',
  projectName: 'Product Ad',
  projectSettings: {
    aspectRatio: '16:9',
    resolution: '1080p',
    fps: 30,
  },
  createdAt: '2026-06-10T10:00:00.000Z',
  status: 'ready',
  durationSec: 12,
  exportRange: {
    mode: 'sequence',
    startSec: 0,
    endSec: 12,
    durationSec: 12,
  },
  tracks: [],
  issues: [],
};

test('viewer composition keeps source dimensions separate from sequence dimensions', () => {
  const composition = buildWorkspaceClipComposition({
    sourceWidth: 1280,
    sourceHeight: 720,
    sequenceWidth: 1920,
    sequenceHeight: 1080,
    transform: { scale: 1, x: 0, y: 0, rotation: 0, opacity: 1 },
  });

  assert.equal(composition.renderWidth, 1280);
  assert.equal(composition.renderHeight, 720);
  assert.equal(composition.sequenceWidth, 1920);
  assert.equal(composition.sequenceHeight, 1080);
});

test('completed timeline export becomes a reusable project media video asset', () => {
  const asset = workspaceProjectAssetFromCompletedTimelineExport({
    id: 'export-123',
    status: 'completed',
    outputUrl: 'https://cdn.maxvideoai.test/exports/export-123.mp4',
  }, readyManifest);

  assert.deepEqual(asset, {
    id: 'timeline-export-export-123',
    kind: 'video',
    filename: 'Product_Ad-sequence-export.mp4',
    subtitle: 'Server export • 1080p • 16:9 • 30 fps',
    url: 'https://cdn.maxvideoai.test/exports/export-123.mp4',
    durationSec: 12,
    dimensions: '1920x1080',
  });
});

test('unfinished timeline export does not create a project media asset', () => {
  const asset = workspaceProjectAssetFromCompletedTimelineExport({
    id: 'export-123',
    status: 'rendering',
    outputUrl: null,
  }, readyManifest);

  assert.equal(asset, null);
});

test('timeline render manifest carries native source composition for sequence-scale renders', () => {
  const timelineItems = [
    {
      id: 'clip-720p',
      outputNodeId: 'node-720p',
      track: 'video',
      title: '720p upload',
      durationSec: 4,
      startSec: 0,
      sourceStartSec: 0,
      sourceDurationSec: 4,
      mediaKind: 'video',
      mediaUrl: '/media/clip-720p.mp4',
      sourceWidth: 1280,
      sourceHeight: 720,
      transform: {
        opacity: 0.75,
        positionX: 10,
        positionY: -5,
        rotation: 4,
        scale: 1.5,
      },
    },
  ] as unknown as WorkspaceTimelineItem[];

  const manifest = buildWorkspaceTimelineRenderManifest({
    items: timelineItems,
    nodes: [],
    projectName: 'Native source test',
    projectSettings: {
      aspectRatio: '16:9',
      resolution: '1080p',
      fps: 24,
    },
    createdAt: '2026-06-14T10:00:00.000Z',
  });
  const clip = manifest.tracks.find((track) => track.id === 'video')?.clips[0];

  assert.deepEqual(clip?.composition, {
    height: 720,
    left: 1152,
    opacity: 0.75,
    rotation: 4,
    scale: 1.5,
    sequenceHeight: 1080,
    sequenceWidth: 1920,
    sourceHeight: 720,
    sourceWidth: 1280,
    top: 486,
    width: 1280,
  });
});

test('timeline render manifest derives source composition from output resolution metadata', () => {
  const timelineItems = [
    {
      id: 'generated-720p',
      outputNodeId: 'output-720p',
      track: 'video',
      title: 'Generated 720p',
      durationSec: 5,
      startSec: 0,
      sourceStartSec: 0,
      sourceDurationSec: 5,
      mediaKind: 'video',
    },
  ] as WorkspaceTimelineItem[];
  const nodes = [
    {
      id: 'output-720p',
      data: {
        kind: 'output',
        output: {
          kind: 'video',
          modelId: 'luma-ray-3-2',
          modelLabel: 'Luma Ray 3.2',
          workflowType: 'image_to_video',
          durationSec: 5,
          aspectRatio: '16:9',
          resolution: '720p',
          status: 'ready',
          createdAt: '2026-06-14T10:00:00.000Z',
          sourceShotId: 'shot-01',
          url: '/media/generated-720p.mp4',
        },
      },
    },
  ] as unknown as WorkspaceGraphNode[];

  const manifest = buildWorkspaceTimelineRenderManifest({
    items: timelineItems,
    nodes,
    projectName: 'Generated source test',
    projectSettings: {
      aspectRatio: '16:9',
      resolution: '1080p',
      fps: 24,
    },
    createdAt: '2026-06-14T10:00:00.000Z',
  });
  const clip = manifest.tracks.find((track) => track.id === 'video')?.clips[0];

  assert.equal(clip?.composition?.sourceWidth, 1280);
  assert.equal(clip?.composition?.sourceHeight, 720);
  assert.equal(clip?.composition?.width, 1280);
  assert.equal(clip?.composition?.height, 720);
});

test('timeline clip fit-height scale matches source height to sequence height', () => {
  assert.equal(
    resolveWorkspaceClipFitHeightScale({
      item: {
        id: 'clip-720p',
        outputNodeId: 'asset-720p',
        track: 'video',
        title: '720p upload',
        durationSec: 4,
        startSec: 0,
        mediaKind: 'video',
        sourceWidth: 1280,
        sourceHeight: 720,
      },
      projectSettings: {
        aspectRatio: '16:9',
        resolution: '1080p',
        fps: 24,
      },
    }),
    1.5,
    'a 720p source should scale to 150% to match a 1080p sequence height'
  );

  assert.equal(
    resolveWorkspaceClipFitHeightScale({
      item: {
        id: 'clip-unknown',
        outputNodeId: 'asset-unknown',
        track: 'video',
        title: 'Unknown source',
        durationSec: 4,
        startSec: 0,
        mediaKind: 'video',
      },
      projectSettings: {
        aspectRatio: '16:9',
        resolution: '1080p',
        fps: 24,
      },
    }),
    null,
    'fit-height should stay unavailable when source dimensions are unknown'
  );
});

test('timeline render manifest warns when visual clips have unknown source dimensions', () => {
  const timelineItems = [
    {
      id: 'unknown-source-video',
      outputNodeId: 'project-asset-unknown-source',
      track: 'video',
      title: 'Unknown source video',
      durationSec: 5,
      startSec: 0,
      sourceStartSec: 0,
      sourceDurationSec: 5,
      mediaKind: 'video',
      mediaUrl: '/media/unknown-source.mp4',
    },
  ] as WorkspaceTimelineItem[];

  const manifest = buildWorkspaceTimelineRenderManifest({
    items: timelineItems,
    nodes: [],
    projectName: 'Unknown dimensions test',
    projectSettings: {
      aspectRatio: '16:9',
      resolution: '1080p',
      fps: 24,
    },
    createdAt: '2026-06-14T10:00:00.000Z',
  });
  const clip = manifest.tracks.find((track) => track.id === 'video')?.clips[0];

  assert.equal(manifest.status, 'ready');
  assert.equal(clip?.composition, null);
  assert.deepEqual(
    manifest.issues.map((issue) => [issue.code, issue.severity, issue.itemId]),
    [['missing_dimensions', 'warning', 'unknown-source-video']],
    'visual clips without source dimensions should be visible export warnings instead of silent full-frame fallbacks'
  );
});
