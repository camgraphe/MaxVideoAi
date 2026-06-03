import assert from 'node:assert/strict';
import test from 'node:test';

import { filterGalleryFeedJobs, resolveMediaUrl } from '../frontend/components/gallery-rail-utils.ts';
import type { GroupSummary } from '../frontend/types/groups.ts';
import type { Job } from '../frontend/types/jobs.ts';

test('image gallery copy URL prefers stable media thumbnails over temporary BytePlus originals', () => {
  const providerUrl =
    'https://ark-acg-ap-southeast-1.tos-ap-southeast-1.volces.com/seedream-5-0/output.jpeg?X-Tos-Expires=86400';
  const stableThumbUrl = 'https://media.maxvideoai.com/rendersthumbs/user/output.webp';
  const group: GroupSummary = {
    id: 'img_test',
    source: 'history',
    count: 1,
    totalPriceCents: 6,
    currency: 'USD',
    createdAt: new Date().toISOString(),
    hero: {
      id: 'img_test-image-0',
      jobId: 'img_test',
      engineId: 'seedream',
      engineLabel: 'Seedream',
      durationSec: 0,
      thumbUrl: stableThumbUrl,
      prompt: 'Reference image',
      status: 'completed',
      createdAt: new Date().toISOString(),
      source: 'job',
      job: {
        jobId: 'img_test',
        engineId: 'seedream',
        engineLabel: 'Seedream',
        durationSec: 0,
        prompt: 'Reference image',
        thumbUrl: stableThumbUrl,
        createdAt: new Date().toISOString(),
        renderIds: [providerUrl],
        renderThumbUrls: [stableThumbUrl],
        heroRenderId: providerUrl,
      },
    },
    previews: [{ id: 'img_test-image-0', thumbUrl: stableThumbUrl }],
    members: [],
  };

  assert.equal(resolveMediaUrl(group, true), stableThumbUrl);
});

test('video gallery feed excludes storyboard and other non-video surfaces', () => {
  const baseJob: Job = {
    jobId: 'job_video',
    surface: 'video',
    engineLabel: 'Video model',
    durationSec: 8,
    prompt: 'Video',
    createdAt: new Date().toISOString(),
  };
  const jobs: Job[] = [
    baseJob,
    { ...baseJob, jobId: 'storyboard_1', surface: 'storyboard' },
    { ...baseJob, jobId: 'image_1', surface: 'image' },
    { ...baseJob, jobId: 'angle_1', surface: 'angle' },
    { ...baseJob, jobId: 'audio_1', surface: 'audio' },
    { ...baseJob, jobId: 'upscale_1', surface: 'upscale' },
  ];

  assert.deepEqual(
    filterGalleryFeedJobs('video', jobs).map((job) => job.jobId),
    ['job_video']
  );
  assert.equal(filterGalleryFeedJobs('image', jobs).length, jobs.length);
});
