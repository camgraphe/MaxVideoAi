import assert from 'node:assert/strict';
import test from 'node:test';
import { consumeMediaHandoff, stageMediaHandoff, MEDIA_HANDOFF_KEY, supportsMediaDestination } from '../frontend/lib/media-handoff';
import { galleryMediaAssets } from '../frontend/components/library/gallery-media-assets';
import type { GroupSummary } from '../frontend/types/groups';

const asset = { id: 'owned-original', kind: 'image' as const, url: 'https://private.example/original.png?signature=secret', thumbUrl: 'https://private.example/small.webp', mime: 'image/png' };
function storage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
}
test('continuation keeps the exact original off navigation and consumes one account-bound request once', () => {
  const store = storage();
  const href = stageMediaHandoff(store, 'account-a', asset, 'image', 'opaque', 100);
  assert.equal(href, '/app/image?media=opaque');
  assert.equal(consumeMediaHandoff(store, 'account-a', 'image', 'opaque', 200)?.url, asset.url);
  assert.equal(consumeMediaHandoff(store, 'account-a', 'image', 'opaque', 201), null);
  assert.equal(store.getItem(MEDIA_HANDOFF_KEY), null);
});
test('wrong account, route, token, expired and malformed requests never insert', () => {
  for (const [account, destination, token, now] of [
    ['account-b', 'video', 'opaque', 200], ['account-a', 'image', 'opaque', 200],
    ['account-a', 'video', 'wrong', 200], ['account-a', 'video', 'opaque', 700_000], ['account-a', 'video', 'opaque', 50],
  ] as const) {
    const store = storage(); stageMediaHandoff(store, 'account-a', asset, 'video', 'opaque', 100);
    assert.equal(consumeMediaHandoff(store, account, destination, token, now), null);
  }
  const store = storage(); store.setItem(MEDIA_HANDOFF_KEY, '{');
  assert.equal(consumeMediaHandoff(store, 'account-a', 'image', 'opaque'), null);
});
test('the bounded pending request replaces its predecessor and image destination accepts only images', () => {
  const store = storage();
  stageMediaHandoff(store, 'account-a', asset, 'video', 'first', 100);
  stageMediaHandoff(store, 'account-a', { ...asset, id: 'second' }, 'image', 'second', 101);
  assert.equal(consumeMediaHandoff(store, 'account-a', 'image', 'second', 102)?.id, 'second');
  assert.equal(supportsMediaDestination({ kind: 'audio' }, 'image'), false);
  assert.equal(supportsMediaDestination({ kind: 'video' }, 'image'), false);
  assert.equal(supportsMediaDestination({ kind: 'audio' }, 'video'), true);
  assert.throws(() => stageMediaHandoff(store, 'account-a', { ...asset, kind: 'video' }, 'image', 'bad'));
});
test('gallery continuation refuses thumbnail-only and pending outputs and keeps each proven image original', () => {
  const member = { id: 'job-image-1', thumbUrl: asset.thumbUrl, engineLabel: 'Engine', durationSec: 0, createdAt: '2026-09-07', source: 'job' as const };
  const group: GroupSummary = { id: 'job', hero: member, members: [member], previews: [], count: 1, source: 'history', totalPriceCents: null, createdAt: '2026-09-07' };
  assert.deepEqual(galleryMediaAssets(group, 'image'), []);
  group.members = [{ ...member, originalUrl: asset.url }, { ...member, id: 'job-image-2', originalUrl: 'https://private.example/second.png' }];
  assert.deepEqual(galleryMediaAssets(group, 'image').map((entry) => entry.url), [asset.url, 'https://private.example/second.png']);
  group.members = [{ ...member, originalUrl: asset.url, status: 'pending' }];
  assert.deepEqual(galleryMediaAssets(group, 'image'), []);
  group.members = [{ ...member, videoUrl: 'https://private.example/original.mp4', previewVideoUrl: 'https://private.example/preview.mp4' }];
  assert.equal(galleryMediaAssets(group, 'video')[0].url, 'https://private.example/original.mp4');
});
