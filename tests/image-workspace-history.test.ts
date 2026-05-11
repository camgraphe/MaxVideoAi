import assert from 'node:assert/strict';
import test from 'node:test';

import { buildCompletedGroup } from '../frontend/app/(core)/(workspace)/app/image/_lib/image-workspace-history.ts';

test('completed image workspace groups prefer stable thumbnails for previews', () => {
  const providerUrl = 'https://ark-acg-ap-southeast-1.tos-ap-southeast-1.volces.com/seedream-5-0/output.jpeg';
  const stableThumbUrl = 'https://media.maxvideoai.com/renders/thumbs/output.webp';

  const group = buildCompletedGroup({
    id: 'img_test',
    engineId: 'seedream',
    engineLabel: 'Seedream',
    prompt: 'A clean reference image',
    aspectRatio: '16:9',
    images: [{ url: providerUrl, thumbUrl: stableThumbUrl }],
    createdAt: Date.now(),
    totalPriceCents: 6,
    currency: 'USD',
  });

  assert.equal(group.members[0]?.thumbUrl, stableThumbUrl);
  assert.equal(group.previews[0]?.thumbUrl, stableThumbUrl);
});
