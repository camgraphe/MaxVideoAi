import assert from 'node:assert/strict';
import test from 'node:test';

import { groupJobsIntoSummaries } from '../frontend/lib/job-groups';
import type { Job } from '../frontend/types/jobs';

test('image grouping prefers renderThumbUrls for preview/member thumbnails', () => {
  const jobs: Job[] = [
    {
      jobId: 'img-job-1',
      engineLabel: 'Image Engine',
      durationSec: 2,
      prompt: 'A landscape',
      createdAt: '2026-02-16T00:00:00.000Z',
      engineId: 'fal-image',
      iterationCount: 2,
      renderIds: ['https://cdn.example.com/full-1.png', 'https://cdn.example.com/full-2.png'],
      renderThumbUrls: ['https://cdn.example.com/thumb-1.webp', 'https://cdn.example.com/thumb-2.webp'],
    },
  ];

  const { groups } = groupJobsIntoSummaries(jobs, { includeSinglesAsGroups: true });
  assert.equal(groups.length, 1);
  const [group] = groups;
  assert.equal(group.members[0]?.thumbUrl, 'https://cdn.example.com/thumb-1.webp');
  assert.equal(group.members[1]?.thumbUrl, 'https://cdn.example.com/thumb-2.webp');
  assert.equal(group.previews[0]?.thumbUrl, 'https://cdn.example.com/thumb-1.webp');
});

test('single image jobs fall back to render ids when thumbUrl is not ready yet', () => {
  const jobs: Job[] = [
    {
      jobId: 'img-job-single',
      engineLabel: 'Image Engine',
      durationSec: 2,
      prompt: 'A portrait',
      createdAt: '2026-02-16T00:00:00.000Z',
      engineId: 'fal-image',
      status: 'completed',
      renderIds: ['https://cdn.example.com/full-single.png'],
      renderThumbUrls: null,
      thumbUrl: null,
    },
  ];

  const { groups } = groupJobsIntoSummaries(jobs, { includeSinglesAsGroups: true });
  assert.equal(groups.length, 1);
  const [group] = groups;
  assert.equal(group.hero.thumbUrl, 'https://cdn.example.com/full-single.png');
  assert.equal(group.previews[0]?.thumbUrl, 'https://cdn.example.com/full-single.png');
  assert.equal(group.hero.status, 'completed');
});
