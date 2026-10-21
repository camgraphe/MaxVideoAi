import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ModerationWallView } from '../frontend/components/admin/moderation/ModerationWallView';
import { ModerationTableView } from '../frontend/components/admin/moderation/ModerationTableView';
import type { ModerationVideo } from '../frontend/components/admin/moderation/moderation-types';

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
