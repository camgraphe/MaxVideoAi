import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveJobsRailThumb, resolveJobsRailVideo } from '../frontend/src/lib/jobs-rail-thumb';
import type { GroupSummary } from '../frontend/types/groups';

function createGroup(overrides: Partial<GroupSummary>): GroupSummary {
  return {
    id: 'group-1',
    source: 'history',
    count: 1,
    totalPriceCents: null,
    createdAt: '2026-02-16T00:00:00.000Z',
    hero: {
      id: 'member-1',
      engineLabel: 'Test Engine',
      durationSec: 0,
      createdAt: '2026-02-16T00:00:00.000Z',
      source: 'job',
      ...overrides.hero,
    },
    previews: overrides.previews ?? [],
    members: overrides.members ?? [],
    ...overrides,
  };
}

test('rail thumb ignores placeholder preview and picks first real preview thumb', () => {
  const group = createGroup({
    previews: [
      { id: 'p-1', thumbUrl: '/assets/frames/thumb-16x9.svg' },
      { id: 'p-2', thumbUrl: 'https://cdn.example.com/real-thumb.jpg' },
    ],
  });

  assert.equal(resolveJobsRailThumb(group), 'https://cdn.example.com/real-thumb.jpg');
});

test('rail thumb falls back to aspect placeholder when no real media exists', () => {
  const group = createGroup({
    hero: {
      id: 'member-1',
      engineLabel: 'Test Engine',
      durationSec: 0,
      createdAt: '2026-02-16T00:00:00.000Z',
      source: 'job',
      aspectRatio: '9:16',
      thumbUrl: '/assets/frames/thumb-16x9.svg',
    },
    previews: [{ id: 'p-1', thumbUrl: '/assets/frames/thumb-16x9.svg', aspectRatio: '9:16' }],
  });

  assert.equal(resolveJobsRailThumb(group), '/assets/frames/thumb-9x16.svg');
});

test('rail thumb uses hero job previewFrame before placeholder fallback', () => {
  const group = createGroup({
    hero: {
      id: 'member-1',
      engineLabel: 'Test Engine',
      durationSec: 0,
      createdAt: '2026-02-16T00:00:00.000Z',
      source: 'job',
      aspectRatio: '16:9',
      thumbUrl: '/assets/frames/thumb-16x9.svg',
      job: { previewFrame: 'https://cdn.example.com/preview-frame.jpg' } as GroupSummary['hero']['job'],
    },
    previews: [{ id: 'p-1', thumbUrl: '/assets/frames/thumb-16x9.svg' }],
  });

  assert.equal(resolveJobsRailThumb(group), 'https://cdn.example.com/preview-frame.jpg');
});

test('rail video resolves from preview video first', () => {
  const group = createGroup({
    previews: [
      { id: 'p-1', videoUrl: 'https://cdn.example.com/preview-video.mp4' },
      { id: 'p-2', videoUrl: 'https://cdn.example.com/preview-video-2.mp4' },
    ],
  });

  assert.equal(resolveJobsRailVideo(group), 'https://cdn.example.com/preview-video.mp4');
});

test('rail video falls back to hero job video when preview has none', () => {
  const group = createGroup({
    hero: {
      id: 'member-1',
      engineLabel: 'Test Engine',
      durationSec: 0,
      createdAt: '2026-02-16T00:00:00.000Z',
      source: 'job',
      job: { videoUrl: 'https://cdn.example.com/hero-video.mp4' } as GroupSummary['hero']['job'],
    },
    previews: [{ id: 'p-1' }],
  });

  assert.equal(resolveJobsRailVideo(group), 'https://cdn.example.com/hero-video.mp4');
});
