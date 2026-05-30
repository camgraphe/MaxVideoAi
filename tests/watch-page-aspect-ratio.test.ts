import assert from 'node:assert/strict';
import test from 'node:test';

import { deriveWatchPageSignals } from '../frontend/server/watch-page-signals';
import { mapGalleryVideoRow, type GalleryVideo, type VideoRow } from '../frontend/server/videos-normalization';

const prompt =
  'A cartoon bunny character dances in a bright studio, with a gentle camera push and clean product-style lighting for a reusable video example.';

test('watch page signals prefer measured output dimensions over requested snapshot aspect ratio', () => {
  const video: GalleryVideo & { outputWidth: number; outputHeight: number } = {
    id: 'job_square_output',
    userId: 'user_123',
    engineId: 'kling-3-pro',
    engineLabel: 'Kling 3 Pro',
    durationSec: 5,
    prompt,
    promptExcerpt: prompt,
    thumbUrl: 'https://media.maxvideoai.com/renders/job_square/thumb.jpg',
    videoUrl: 'https://media.maxvideoai.com/renders/job_square/video.mp4',
    aspectRatio: '16:9',
    outputWidth: 1440,
    outputHeight: 1440,
    createdAt: '2026-05-30T08:00:00.000Z',
    visibility: 'public',
    indexable: true,
    hasAudio: false,
    canUpscale: false,
    settingsSnapshot: {
      surface: 'video',
      inputMode: 'i2v',
      engineId: 'kling-3-pro',
      engineLabel: 'Kling 3 Pro',
      prompt,
      core: {
        durationSec: 5,
        aspectRatio: '16:9',
        resolution: '1080p',
      },
      refs: {
        imageUrl: 'https://media.maxvideoai.com/renders/job_square/source.png',
      },
    },
  };

  const signals = deriveWatchPageSignals({ video });

  assert.equal(signals.aspectRatio, '1:1');
  assert.equal(signals.detailRows.find((row) => row.key === 'aspectRatio')?.value, '1:1');
  assert.ok(signals.whatThisShows.some((item) => item.includes('1:1')));
});

test('gallery video normalization carries persisted output dimensions', () => {
  const row: VideoRow & { output_width: number; output_height: number } = {
    job_id: 'job_square_output',
    user_id: 'user_123',
    engine_id: 'kling-3-pro',
    engine_label: 'Kling 3 Pro',
    duration_sec: 5,
    prompt,
    thumb_url: 'https://media.maxvideoai.com/renders/job_square/thumb.jpg',
    video_url: 'https://media.maxvideoai.com/renders/job_square/video.mp4',
    preview_video_url: null,
    keyframe_urls: null,
    aspect_ratio: '16:9',
    output_width: 1440,
    output_height: 1440,
    has_audio: false,
    can_upscale: false,
    created_at: '2026-05-30T08:00:00.000Z',
    visibility: 'public',
    indexable: true,
    featured: null,
    featured_order: null,
    final_price_cents: null,
    currency: null,
  };

  const video = mapGalleryVideoRow(row) as GalleryVideo & { outputWidth?: number; outputHeight?: number };

  assert.equal(video.outputWidth, 1440);
  assert.equal(video.outputHeight, 1440);
});
