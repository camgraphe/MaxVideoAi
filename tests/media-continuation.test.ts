import assert from 'node:assert/strict';
import test from 'node:test';
import { consumeMediaHandoff, stageMediaHandoff, MEDIA_HANDOFF_KEY, supportsMediaDestination } from '../frontend/lib/media-handoff';
import { groupJobsIntoSummaries } from '../frontend/lib/job-groups';
import type { Job } from '../frontend/types/jobs';
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

test('activity audio originals and separate single-image jobs retain their exact assets', () => {
  const member = { id: 'one', engineLabel: 'Engine', durationSec: 4, createdAt: '2026-09-07', source: 'job' as const, status: 'completed' as const };
  const group: GroupSummary = { id: 'group', hero: member, members: [member], previews: [], count: 1, source: 'history', totalPriceCents: null, createdAt: '2026-09-07' };
  group.members = [{ ...member, audioUrl: 'https://private.example/original.wav?signature=exact', thumbUrl: 'https://private.example/cover.webp' }];
  assert.equal(galleryMediaAssets(group, 'audio')[0].url, 'https://private.example/original.wav?signature=exact');
  group.members = ['one', 'two'].map((id) => ({ ...member, id, job: { jobId: id, engineLabel: 'Engine', durationSec: 0, prompt: '', createdAt: member.createdAt, renderIds: [`https://private.example/${id}.png`] } }));
  assert.deepEqual(galleryMediaAssets(group, 'image').map((entry) => entry.url), ['https://private.example/one.png', 'https://private.example/two.png']);
});

test('Activity maps every real grouped image output to its own original and thumbnail', () => {
  const jobs: Job[] = ['first', 'last'].map((jobId) => ({
    jobId, groupId: 'batch', surface: 'image', status: 'completed', engineLabel: 'Image engine',
    durationSec: 0, prompt: '', createdAt: '2026-09-07T12:00:00Z',
    renderIds: [0, 1, 2].map((index) => `https://private.example/${jobId}-${index}.png?signature=exact`),
    renderThumbUrls: [0, 1, 2].map((index) => `https://private.example/${jobId}-${index}-thumb.webp`),
  }));
  const group = groupJobsIntoSummaries(jobs, { includeSinglesAsGroups: true }).groups[0];
  assert.deepEqual(group.members.map((member) => member.id), ['first-image-0', 'first-image-1', 'first-image-2', 'last-image-0', 'last-image-1', 'last-image-2']);
  const assets = galleryMediaAssets(group, 'image');
  assert.equal(assets.length, 6);
  assert.deepEqual(assets.map(({ url, thumbUrl }) => ({ url, thumbUrl })), jobs.flatMap((job) => job.renderIds!.map((url, index) => ({ url, thumbUrl: job.renderThumbUrls![index] }))));
  assert.equal(assets[0].url, jobs[0].renderIds![0]);
  assert.equal(assets.at(-1)?.url, jobs[1].renderIds![2]);
});
