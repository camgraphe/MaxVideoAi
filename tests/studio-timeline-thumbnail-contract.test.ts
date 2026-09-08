import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildWorkspaceTimelineItemsForAsset,
  buildWorkspaceTimelineItemsForOutput,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/timeline/timeline-builders';

test('timeline builders never promote a video original to an image thumbnail', () => {
  const [assetVideo] = buildWorkspaceTimelineItemsForAsset({
    assetNodeId: 'asset-video', title: 'Video', startSec: 0, idSeed: 'asset',
    asset: { id: 'asset', kind: 'video', filename: 'video.mp4', subtitle: 'Video', url: '/private/video.mp4', durationSec: 2 },
  });
  const [outputVideo] = buildWorkspaceTimelineItemsForOutput({
    outputNodeId: 'output-video', title: 'Output', startSec: 0, idSeed: 'output',
    output: {
      kind: 'video', modelId: 'model', modelLabel: 'Model', workflowType: 'text_to_video',
      createdAt: '2026-09-08T00:00:00.000Z', sourceShotId: 'shot', url: '/private/output.mp4',
    },
  });
  assert.equal(assetVideo.thumbnailUrl, null);
  assert.equal(outputVideo.thumbnailUrl, null);
});

test('timeline builders preserve real thumbnails and image-original fallback', () => {
  const [video] = buildWorkspaceTimelineItemsForAsset({
    assetNodeId: 'asset-video', title: 'Video', startSec: 0, idSeed: 'asset',
    asset: { id: 'asset', kind: 'video', filename: 'video.mp4', subtitle: 'Video', url: '/video.mp4', thumbUrl: '/video.jpg', durationSec: 2 },
  });
  const [image] = buildWorkspaceTimelineItemsForAsset({
    assetNodeId: 'asset-image', title: 'Image', startSec: 0, idSeed: 'asset',
    asset: { id: 'image', kind: 'image', filename: 'image.png', subtitle: 'Image', url: '/image.png' },
  });
  assert.equal(video.thumbnailUrl, '/video.jpg');
  assert.equal(image.thumbnailUrl, '/image.png');
});
