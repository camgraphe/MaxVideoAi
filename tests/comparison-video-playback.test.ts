import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { act } from 'react';
import { PublicVideoPlayer } from '../frontend/components/media/PublicVideoPlayer.client';
import { buildPublicVideoPosterUrl } from '../frontend/lib/media-helpers';
import { mountPublicMedia } from './helpers/public-media-dom';

const ORIGINAL = 'https://media.maxvideoai.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/10186dec-e084-4141-8249-8d39331b3a23.mp4';
const player = (src = ORIGINAL) => React.createElement(PublicVideoPlayer, {
  src, poster: '/poster.jpg', title: 'Comparaison', locale: 'fr', className: 'object-contain',
});

test('comparison preserves the original by default even with Save-Data, and uses native controls', async () => {
  const f = await mountPublicMedia(player(), { saveData: true });
  try {
    assert.equal(f.source(), ORIGINAL);
    assert.equal(f.video().controls, true);
    assert.equal(f.video().preload, 'none');
    assert.deepEqual(f.plays, []);
    assert.equal(f.container.querySelector('select')?.value, 'original');
    await act(async () => { await f.video().play(); });
    await f.emit('playing');
    await f.selectQuality('auto');
    assert.notEqual(f.source(), ORIGINAL);
    assert.equal(f.plays.length, 2);
    await f.fail();
    assert.equal(f.source(), ORIGINAL);
    await act(async () => f.video().pause());
    await f.documentVisible(false); await f.documentVisible(true);
    assert.equal(f.video().paused, true);
    assert.equal(f.plays.length, 3);
  } finally { await f.cleanup(); }
});

test('an original failure offers a localized explicit retry without a loop', async () => {
  const f = await mountPublicMedia(player());
  try {
    await act(async () => { await f.video().play(); });
    await f.fail(); await f.fail();
    assert.equal(f.plays.length, 1);
    assert.ok(f.container.querySelector('[role="alert"]')?.textContent?.includes('indisponible'));
    const mutations: MutationRecord[] = [];
    const observer = new f.dom.window.MutationObserver((records) => mutations.push(...records));
    observer.observe(f.video(), { attributes: true, attributeFilter: ['src'] });
    await f.click('Réessayer');
    assert.equal(f.plays.length, 2);
    assert.equal(f.source(), ORIGINAL);
    assert.equal(mutations.length, 1, 'Retry must reset the failed native resource even when its URL is unchanged');
    observer.disconnect();
  } finally { await f.cleanup(); }
});

test('native video posters optimize only unsigned public CDN images', () => {
  const publicUrl = 'https://media.maxvideoai.com/renders/example/thumb.jpg';
  assert.equal(buildPublicVideoPosterUrl(publicUrl), `/_next/image?url=${encodeURIComponent(publicUrl)}&w=1080&q=75`);
  for (const src of [
    `${publicUrl}?signature=private`, 'https://private.example/poster.jpg',
    'https://media.maxvideoai.com.evil.example/poster.jpg',
    '/api/private-poster?id=1', 'blob:local', 'data:image/png;base64,abc',
    '/_next/image?url=keep&w=640&q=75',
  ]) assert.equal(buildPublicVideoPosterUrl(src), src);
  assert.equal(buildPublicVideoPosterUrl(undefined), null);
});
