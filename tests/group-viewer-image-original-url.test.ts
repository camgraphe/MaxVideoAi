import assert from 'node:assert/strict';
import test from 'node:test';

import { adaptGroupSummary } from '../frontend/lib/video-group-adapter';
import type { GroupMemberSummary, GroupSummary } from '../frontend/types/groups';

test('history image groups expose the original render url while keeping the thumbnail separate', () => {
  const originalUrl = 'https://v3b.fal.media/files/b/0a9cde85/storyboard-original.png';
  const thumbUrl = 'https://media.maxvideoai.com/renders/thumbs/storyboard-thumb.webp';
  const createdAt = '2026-06-08T12:00:00.000Z';
  const member: GroupMemberSummary = {
    id: 'storyboard_2502a543-8342-4b17-b9fe-a34bdf0efaea',
    jobId: 'storyboard_2502a543-8342-4b17-b9fe-a34bdf0efaea',
    engineLabel: 'Storyboard',
    durationSec: 0,
    thumbUrl,
    aspectRatio: '9:16',
    prompt: 'Storyboard reference frame',
    status: 'completed',
    createdAt,
    source: 'job',
    job: {
      jobId: 'storyboard_2502a543-8342-4b17-b9fe-a34bdf0efaea',
      engineLabel: 'Storyboard',
      durationSec: 0,
      prompt: 'Storyboard reference frame',
      thumbUrl,
      renderIds: [originalUrl],
      heroRenderId: originalUrl,
      createdAt,
    },
  };
  const group: GroupSummary = {
    id: 'storyboard_2502a543-8342-4b17-b9fe-a34bdf0efaea',
    source: 'history',
    count: 1,
    totalPriceCents: null,
    createdAt,
    hero: member,
    previews: [],
    members: [member],
  };

  const adapted = adaptGroupSummary(group, 'fal');

  assert.equal(adapted.items[0]?.url, originalUrl);
  assert.equal(adapted.items[0]?.thumb, thumbUrl);
  assert.equal(adapted.items[0]?.meta?.mediaType, 'image');
});
