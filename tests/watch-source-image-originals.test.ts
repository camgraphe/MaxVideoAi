import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveWatchSourceImageOriginalUrls } from '../frontend/server/watch-source-image-originals';
import type { WatchPageSourceImage } from '../frontend/server/watch-page-signals';
import type { GalleryVideo } from '../frontend/server/videos-normalization';

test('watch source images replace storyboard thumbnails with original job output urls', async () => {
  const thumbUrl = 'https://media.maxvideoai.com/renders/thumbs/storyboard-thumb.webp';
  const originalUrl = 'https://v3b.fal.media/files/b/0a9cde85/storyboard-original.png';
  const video: GalleryVideo = {
    id: 'video_from_storyboard',
    userId: 'user_123',
    engineId: 'seedance-1-0-lite',
    engineLabel: 'Seedance 1.0 Lite',
    durationSec: 5,
    prompt: 'A cinematic scene generated from a storyboard image.',
    promptExcerpt: 'A cinematic scene generated from a storyboard image.',
    thumbUrl: 'https://media.maxvideoai.com/renders/video_from_storyboard/thumb.webp',
    videoUrl: 'https://media.maxvideoai.com/renders/video_from_storyboard/video.mp4',
    createdAt: '2026-06-08T12:30:00.000Z',
    visibility: 'public',
    indexable: true,
    hasAudio: false,
    canUpscale: false,
    settingsSnapshot: {
      refs: {
        referenceImages: [thumbUrl],
        inputs: [
          {
            kind: 'image',
            slotId: 'referenceImages',
            assetId: 'storyboard_2502a543-8342-4b17-b9fe-a34bdf0efaea',
            url: thumbUrl,
          },
        ],
      },
    },
  };
  const sourceImages: WatchPageSourceImage[] = [
    {
      key: 'storyboardFrame1',
      label: 'Storyboard frame',
      url: thumbUrl,
      alt: 'Storyboard frame for Seedance example',
    },
  ];
  const queries: Array<{ sql: string; params?: readonly unknown[] }> = [];

  const resolved = await resolveWatchSourceImageOriginalUrls({
    video,
    sourceImages,
    query: async (sql, params) => {
      queries.push({ sql, params });
      return [
        {
          job_id: 'storyboard_2502a543-8342-4b17-b9fe-a34bdf0efaea',
          url: originalUrl,
          storage_url: null,
          thumb_url: thumbUrl,
          position: 0,
        },
      ];
    },
  });

  assert.equal(resolved[0]?.url, originalUrl);
  assert.equal(resolved[0]?.thumbUrl, thumbUrl);
  assert.equal(queries[0]?.params?.[0], 'storyboard_2502a543-8342-4b17-b9fe-a34bdf0efaea');
});
