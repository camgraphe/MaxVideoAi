import assert from 'node:assert/strict';
import test from 'node:test';
import {
  workspaceProjectAssetFromCompletedTimelineExport,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-timeline-export';
import type {
  WorkspaceTimelineRenderManifest,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-timeline-render';

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
    dimensions: '1080p',
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
