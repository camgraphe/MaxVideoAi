import assert from 'node:assert/strict';
import test from 'node:test';

import { countResolvedVisualSlots, mergeImageProgressGroup } from '../frontend/lib/group-progress';
import type { GroupSummary } from '../frontend/types/groups';

function createPendingGroup(count = 3): GroupSummary {
  const createdAt = '2026-04-05T00:00:00.000Z';
  const members = Array.from({ length: count }, (_, index) => ({
    id: `pending-${index + 1}`,
    jobId: 'job-image-1',
    engineLabel: 'Image Engine',
    durationSec: 0,
    createdAt,
    source: 'render' as const,
    status: 'pending' as const,
  }));

  return {
    id: 'job-image-1',
    source: 'active',
    count,
    totalPriceCents: null,
    createdAt,
    hero: members[0]!,
    previews: members.map((member) => ({
      id: member.id,
      thumbUrl: null,
      videoUrl: null,
      aspectRatio: '1:1',
    })),
    members,
  };
}

test('countResolvedVisualSlots counts only real image slots', () => {
  const group = createPendingGroup(3);
  group.previews[0] = {
    id: 'resolved-1',
    thumbUrl: 'https://cdn.example.com/real-1.webp',
    videoUrl: null,
    aspectRatio: '1:1',
  };
  group.members[0] = {
    ...group.members[0]!,
    id: 'resolved-1',
    thumbUrl: 'https://cdn.example.com/real-1.webp',
    status: 'completed',
  };

  assert.equal(countResolvedVisualSlots(group), 1);
});

test('mergeImageProgressGroup keeps pending slots while remote images arrive incrementally', () => {
  const activeGroup = createPendingGroup(3);
  const historicalGroup: GroupSummary = {
    id: 'job-image-1',
    source: 'history',
    count: 3,
    totalPriceCents: null,
    createdAt: '2026-04-05T00:00:01.000Z',
    hero: {
      id: 'resolved-1',
      jobId: 'job-image-1',
      engineLabel: 'Image Engine',
      durationSec: 0,
      createdAt: '2026-04-05T00:00:01.000Z',
      source: 'job',
      status: 'completed',
      thumbUrl: 'https://cdn.example.com/real-1.webp',
    },
    previews: [
      {
        id: 'resolved-1',
        thumbUrl: 'https://cdn.example.com/real-1.webp',
        videoUrl: null,
        aspectRatio: '1:1',
      },
    ],
    members: [
      {
        id: 'resolved-1',
        jobId: 'job-image-1',
        engineLabel: 'Image Engine',
        durationSec: 0,
        createdAt: '2026-04-05T00:00:01.000Z',
        source: 'job',
        status: 'completed',
        thumbUrl: 'https://cdn.example.com/real-1.webp',
      },
    ],
  };

  const merged = mergeImageProgressGroup(activeGroup, historicalGroup);
  assert.equal(merged.count, 3);
  assert.equal(merged.previews.length, 3);
  assert.equal(merged.members.length, 3);
  assert.equal(merged.previews[0]?.thumbUrl, 'https://cdn.example.com/real-1.webp');
  assert.equal(merged.members[0]?.status, 'completed');
  assert.equal(merged.members[1]?.status, 'pending');
  assert.equal(merged.members[2]?.status, 'pending');
});
