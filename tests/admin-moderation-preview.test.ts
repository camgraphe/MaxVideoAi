import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ModerationWallView } from '../frontend/components/admin/moderation/ModerationWallView';
import { ModerationTableView } from '../frontend/components/admin/moderation/ModerationTableView';
import type { ModerationVideo } from '../frontend/components/admin/moderation/moderation-types';
import { getModerationPreviewUrls } from '../frontend/components/admin/moderation/moderation-table-utils';

Object.assign(globalThis, { React });
const noop = () => {};

for (const [extension, tag] of [['gif?token=preserved', 'img'], ['mp4', 'video']] as const) {
  test(`moderation can preview tool ${extension} output without a stored thumbnail`, () => {
    const url = `https://media.maxvideoai.com/tool-result.${extension}`;
    const video: ModerationVideo = {
      id: 'tool-result', userId: 'owner', engineId: 'seedvr-video', engineLabel: 'Upscale', durationSec: 5,
      prompt: '', videoUrl: url, thumbUrl: '/assets/frames/thumb-1x1.svg', createdAt: '2026-10-22T00:00:00Z',
      visibility: 'private', indexable: false, seoWatch: false, publicationState: 'private',
      isPublishedOnSite: false, hasLegacyMismatch: false,
    };
    const common = { bucket: 'all' as const, displayItems: [video], isLoadingMore: false, nextCursor: null,
      loadBucket: noop, renderModerationActions: () => null, renderPlaylistControls: () => null, surface: 'upscale' as const };
    const wall = renderToStaticMarkup(React.createElement(ModerationWallView, { ...common,
      onSelectVideo: noop, onThumbnailUpdated: noop, playlistAssignments: {}, selectedVideo: video }));
    const table = renderToStaticMarkup(React.createElement(ModerationTableView, { ...common, isPending: false }));
    for (const html of [wall, table]) {
      assert.match(html, new RegExp(`<${tag}[^>]*src="https://media\\.maxvideoai\\.com/tool-result\\.${extension.replace('?', '\\?')}"`));
      if (tag === 'img') {
        assert.doesNotMatch(html, /<video/);
        assert.doesNotMatch(html, /_next\/image/);
      }
    }
  });
}

test('signed creator image grants retain their exact host and bypass the public image optimizer', () => {
  const previous = { bucket: process.env.S3_BUCKET, region: process.env.S3_REGION, base: process.env.S3_PUBLIC_BASE_URL };
  Object.assign(process.env, { S3_BUCKET: 'private-bucket', S3_REGION: 'eu-west-1', S3_PUBLIC_BASE_URL: 'https://media.maxvideoai.com' });
  try {
    const url = 'https://private-bucket.s3.eu-west-1.amazonaws.com/files/photo.png?X-Amz-Signature=test';
    const preview = getModerationPreviewUrls({ originalUrl: url, thumbUrl: url });
    assert.equal(preview.originalUrl, url);
    assert.equal(preview.thumbUrl, url);
    assert.equal(preview.videoUrl, undefined);
    assert.equal(preview.unoptimizedThumbnail, true);
  } finally {
    for (const [key, value] of Object.entries({ S3_BUCKET: previous.bucket, S3_REGION: previous.region, S3_PUBLIC_BASE_URL: previous.base })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
