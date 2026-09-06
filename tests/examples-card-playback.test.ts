import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { useExampleCardPlayback } from '../frontend/components/examples/useExampleCardPlayback';
import { mountPublicMedia } from './helpers/public-media-dom';

const ORIGINAL = 'https://media.maxvideoai.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/10186dec-e084-4141-8249-8d39331b3a23.mp4';
function Harness({ requested, src = ORIGINAL }: { requested: boolean; src?: string }) {
  const { videoRef, playbackAttempt, events, videoReady } = useExampleCardPlayback(src, requested, false);
  return React.createElement('div', {},
    React.createElement('span', {}, videoReady ? 'Playing' : 'Poster'),
    playbackAttempt ? React.createElement('video', {
      key: playbackAttempt.id, ref: videoRef, src: playbackAttempt.rendition.src, preload: 'none', ...events,
    }) : null);
}
const card = (requested: boolean, src?: string) => React.createElement(Harness, { requested, src });

test('an idle gallery card has no video request; intent starts a rendition and only playing hides the poster', async () => {
  const f = await mountPublicMedia(card(false));
  try {
    assert.equal(f.video(), null); assert.deepEqual(f.plays, []);
    await f.render(card(true));
    assert.equal(f.video().preload, 'none'); assert.notEqual(f.source(), ORIGINAL);
    assert.equal(f.plays.length, 1); assert.match(f.container.textContent!, /Poster/);
    await f.emit('playing'); assert.match(f.container.textContent!, /Playing/);
    const node = f.video();
    await f.render(card(false));
    assert.equal(node.paused, true); assert.equal(f.video(), null);
    assert.match(f.container.textContent!, /Poster/);
  } finally { await f.cleanup(); }
});

test('short previews stay exact and failure leaves the poster instead of downloading a full original', async () => {
  const preview = 'https://media.maxvideoai.com/previews/short.mp4';
  const f = await mountPublicMedia(card(true, preview));
  try {
    assert.deepEqual(f.plays, [preview]);
    await f.fail();
    assert.equal(f.video(), null); assert.deepEqual(f.plays, [preview]);
    assert.match(f.container.textContent!, /Poster/);
  } finally { await f.cleanup(); }
});

test('gallery full-video fallback happens once and cannot loop after original failure', async () => {
  const f = await mountPublicMedia(card(true));
  try {
    await f.fail(); assert.equal(f.source(), ORIGINAL);
    assert.equal(f.plays.length, 2);
    await f.fail(); assert.equal(f.video(), null); assert.equal(f.plays.length, 2);
  } finally { await f.cleanup(); }
});

test('hidden gallery playback stops and poster returns', async () => {
  const f = await mountPublicMedia(card(true));
  try {
    await f.emit('playing'); const node = f.video();
    await f.documentVisible(false);
    assert.equal(node.paused, true); assert.equal(f.video(), null);
    assert.match(f.container.textContent!, /Poster/);
  } finally { await f.cleanup(); }
});

test('Save-Data and reduced motion prevent incidental gallery playback', async () => {
  for (const options of [{ saveData: true }, { reducedMotion: true }]) {
    const f = await mountPublicMedia(card(true), options);
    try { assert.equal(f.video(), null); assert.deepEqual(f.plays, []); }
    finally { await f.cleanup(); }
  }
});
