import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyStudioMediaAccess,
  stripStudioMediaAccess,
  studioMediaAssetId,
  studioWorkspaceSnapshotFingerprint,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_state/workspace-media-access';
import { workspaceSequencePreviewUrl } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_state/workspace-selectors';

const assetId = `ma_${'a'.repeat(32)}`;
const otherId = `ma_${'b'.repeat(32)}`;
const item = (id: string, refId = assetId) => ({
  id, title: id, mediaKind: 'video' as const, track: 'video' as const, startSec: 0, durationSec: 2,
  mediaUrl: 'https://private.invalid/original.mp4', mediaAccessRequired: true,
  ref: { type: 'asset' as const, assetId: refId, kind: 'video' as const },
});

test('renewed private access reaches every project and sequence occurrence without changing edit fields', () => {
  const state = {
    projectAssets: [{ id: 'asset', kind: 'video' as const, filename: 'A', ref: item('x').ref, mediaAccessRequired: true }],
    timelineItems: [item('active')],
    sequences: [{ id: 'main', timelineItems: [item('nested'), item('other', otherId)], marker: 7 }],
  };
  const result = applyStudioMediaAccess(state, [{
    assetId, url: 'https://signed.invalid/a.mp4?token=one', expiresAt: '2026-09-08T10:05:00.000Z',
  }]);
  assert.equal(result.projectAssets[0].mediaAccessUrl, 'https://signed.invalid/a.mp4?token=one');
  assert.equal(result.timelineItems[0].mediaAccessUrl, 'https://signed.invalid/a.mp4?token=one');
  assert.equal(result.sequences[0].timelineItems[0].mediaAccessUrl, 'https://signed.invalid/a.mp4?token=one');
  assert.equal(result.sequences[0].timelineItems[1].mediaAccessUrl, undefined);
  assert.equal(result.sequences[0].marker, 7);
  assert.equal(studioMediaAssetId(result.timelineItems[0]), assetId);
});

test('transient access URLs and expiries are recursively excluded from local and server persistence', () => {
  const stripped = stripStudioMediaAccess({
    timelineItems: [{ ...item('clip'), mediaAccessUrl: 'https://signed.invalid', mediaAccessExpiresAt: 'soon' }],
    nested: { mediaAccessUrl: 'https://signed.invalid', keep: true },
  });
  assert.doesNotMatch(JSON.stringify(stripped), /signed|mediaAccessUrl|mediaAccessExpiresAt/u);
  assert.equal((stripped as { nested: { keep: boolean } }).nested.keep, true);
});

test('autosave fingerprints ignore object key order, transient access and hydration-only compatibility notices', () => {
  assert.equal(
    studioWorkspaceSnapshotFingerprint({ b: 2, a: { mediaAccessUrl: 'signed', value: 1 }, compatibilityAdjustmentCount: 2 }),
    studioWorkspaceSnapshotFingerprint({ a: { value: 1 }, b: 2 }),
  );
  assert.notEqual(
    studioWorkspaceSnapshotFingerprint({ a: { value: 1 }, b: 2 }),
    studioWorkspaceSnapshotFingerprint({ a: { value: 3 }, b: 2 }),
  );
});

test('sequence cards never send a video original through an image reader', () => {
  assert.equal(workspaceSequencePreviewUrl({ timelineItems: [item('video')] } as never), null);
  assert.equal(workspaceSequencePreviewUrl({ timelineItems: [{ ...item('poster'), thumbnailUrl: '/poster.jpg' }] } as never), '/poster.jpg');
  assert.equal(workspaceSequencePreviewUrl({ timelineItems: [{ ...item('image'), mediaKind: 'image', mediaUrl: '/still.jpg' }] } as never), '/still.jpg');
});
