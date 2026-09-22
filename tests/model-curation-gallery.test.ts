import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { finalizeModelGallery } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-gallery-curation';
test('adopted model galleries cannot reinject excluded static media or override manual order', async () => {
  const cards = [
    { id: 'portrait', aspectRatio: '9:16', videoUrl: '/a.mp4' },
    { id: 'landscape', aspectRatio: '16:9', videoUrl: '/b.mp4' },
  ];
  let fetches = 0;
  const options = {
    managed: true,
    cards,
    featuredIds: ['landscape', 'excluded'],
    preferredIds: ['excluded'],
    preferLandscape: true,
    fetchCards: async (ids: string[]) => {
      fetches++;
      return ids.map((id) => ({ id, aspectRatio: '16:9', videoUrl: '/static.mp4' }));
    },
  };
  assert.deepEqual(await finalizeModelGallery(options), cards);
  assert.deepEqual(await finalizeModelGallery({ ...options, cards: [] }), []);
  assert.equal(fetches, 0);
  assert.deepEqual(
    (await finalizeModelGallery({ ...options, managed: false })).map((card) => card.id),
    ['landscape', 'excluded', 'portrait'],
  );
  const route = readFileSync('frontend/app/(localized)/[locale]/(marketing)/models/[slug]/page.tsx', 'utf8');
  assert.match(route, /finalizeModelGallery\(/);
  assert.match(route, /managed: managedCuration/);
  assert.doesNotMatch(route, /galleryVideos = \[\.\.\.galleryVideos\]\.sort/);
});
