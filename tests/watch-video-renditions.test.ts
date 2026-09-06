import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { WatchVideoPlayer } from '../frontend/components/watch/WatchVideoPlayer';
import { mountPublicMedia } from './helpers/public-media-dom';

const ORIGINAL = 'https://media.maxvideoai.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/10186dec-e084-4141-8249-8d39331b3a23.mp4';
const MOBILE = 'https://media.maxvideoai.com/marketing/video-renditions/b24035c64a2c2f87be23637337621e0b480dab68499e498eafb2cf0e520e2266/public-demo-v1/mobile/f46f366b07e5454f5f601710216344ad1216dd3e4a1108621d18adbd7ade1d1c.mp4';
const DESKTOP_OMISSION = 'https://media.maxvideoai.com/media-assets/by-content/c780259ed79d025b4ac74ccc513f18bf/2506829a4f4f3d7e5d2bd864a701fc6cc2fb7c53182f7a7f5ca10cc580c70aa8.mp4';
const player = (src = ORIGINAL) => React.createElement(WatchVideoPlayer, {
  src, poster: '/poster.jpg', title: 'Example', engineLabel: 'Model', hasAudio: true,
});

test('watch SSR retains the original and poster while deferring video transfers', () => {
  (globalThis as typeof globalThis & { React: typeof React }).React = React;
  const html = renderToStaticMarkup(player());
  assert.match(html, /preload="none"/);
  assert.ok(html.includes(ORIGINAL));
  assert.match(html, /poster="\/poster.jpg"/);
  assert.ok(!html.includes(MOBILE), 'The original remains discoverable before hydration');
});

test('watch prepares the mobile rendition without fetching it until Play', async () => {
  const f = await mountPublicMedia(player());
  try {
    assert.equal(f.source(), MOBILE);
    assert.equal(f.video().preload, 'none');
    assert.deepEqual(f.plays, []);
    assert.equal(f.loads(), 0);
    await f.click('Play video');
    assert.deepEqual(f.plays, [MOBILE]);
    assert.ok(f.container.querySelector('[role="status"]'), 'Loading persists until playing');
    await f.emit('playing');
    assert.ok(!f.container.querySelector('[role="status"]'));
    await f.click('Pause video');
    assert.equal(f.video().paused, true);
  } finally { await f.cleanup(); }
});

test('Original quality retains position, mute and volume on the same video node', async () => {
  const f = await mountPublicMedia(player());
  try {
    await f.click('Play video'); await f.emit('playing');
    const node = f.video();
    await act(async () => { node.currentTime = 6; node.muted = true; node.volume = 0.4; });
    await f.emit('timeupdate'); await f.emit('volumechange');
    await f.selectQuality('original');
    assert.equal(f.video(), node, 'Changing display quality must retain the native/fullscreen video');
    assert.equal(f.source(), ORIGINAL);
    assert.equal(f.plays.at(-1), ORIGINAL);
    node.currentTime = 0; await f.emit('loadedmetadata');
    assert.equal(node.currentTime, 6);
    assert.equal(node.muted, true); assert.equal(node.volume, 0.4);
  } finally { await f.cleanup(); }
});

test('a derivative error falls back once, retains intent and stops after original failure', async () => {
  const f = await mountPublicMedia(player());
  try {
    await f.click('Play video'); await f.emit('playing');
    f.video().currentTime = 4; await f.emit('timeupdate');
    await f.fail();
    assert.equal(f.source(), ORIGINAL);
    assert.deepEqual(f.plays, [MOBILE, ORIGINAL]);
    f.video().currentTime = 0; await f.emit('loadedmetadata');
    assert.equal(f.video().currentTime, 4);
    await f.fail(); await f.fail();
    assert.deepEqual(f.plays, [MOBILE, ORIGINAL], 'Repeated errors cannot create retry loops');
    assert.ok(f.container.querySelector('[role="alert"]'));
  } finally { await f.cleanup(); }
});

test('explicit Original before Play is lazy and overrides Save-Data', async () => {
  const f = await mountPublicMedia(player(), { saveData: true });
  try {
    await f.selectQuality('original');
    assert.deepEqual(f.plays, []); assert.equal(f.loads(), 0);
    await f.click('Play video');
    assert.deepEqual(f.plays, [ORIGINAL]);
  } finally { await f.cleanup(); }
});

test('hidden or offscreen manual playback pauses and does not restart on return', async () => {
  const f = await mountPublicMedia(player());
  try {
    await f.click('Play video'); await f.emit('playing');
    await f.documentVisible(false); await f.documentVisible(true);
    assert.equal(f.video().paused, true); assert.equal(f.plays.length, 1);
    await f.click('Play video'); await f.visible(false); await f.visible(true);
    assert.equal(f.video().paused, true); assert.equal(f.plays.length, 2);
  } finally { await f.cleanup(); }
});

test('unknown signed media stays exact and has no misleading quality choice', async () => {
  const signed = 'https://private.example/video.mp4?signature=keep-exact&expires=123';
  const f = await mountPublicMedia(player(signed));
  try {
    assert.equal(f.source(), signed);
    assert.ok(!f.container.querySelector('select'));
    await f.click('Play video');
    assert.deepEqual(f.plays, [signed]);
  } finally { await f.cleanup(); }
});

test('choosing Original when Auto already uses the original does not rebuffer or restart playback', async () => {
  const f = await mountPublicMedia(player(DESKTOP_OMISSION), { width: 1440 });
  try {
    await f.click('Play video'); await f.emit('playing');
    await f.selectQuality('original');
    assert.deepEqual(f.plays, [DESKTOP_OMISSION]);
    assert.ok(!f.container.querySelector('[role="status"]'), 'An unchanged source must not leave a loading overlay');
  } finally { await f.cleanup(); }
});

test('a rejected stale play promise cannot cancel the chosen Original playback', async () => {
  const f = await mountPublicMedia(player());
  try {
    let reject!: (error: Error) => void;
    f.nextPlay(() => new Promise<void>((_resolve, fail) => { reject = fail; }));
    await f.click('Play video');
    await f.selectQuality('original'); await f.emit('playing');
    await act(async () => reject(new Error('Old source aborted')));
    assert.equal(f.source(), ORIGINAL); assert.equal(f.video().paused, false);
    assert.ok(f.container.querySelector('button[aria-label="Pause video"]'));
    assert.ok(!f.container.querySelector('[role="alert"]'));
  } finally { await f.cleanup(); }
});

test('a user pause while fallback is queued prevents the fallback from starting', async () => {
  const f = await mountPublicMedia(player());
  try {
    await f.click('Play video'); await f.emit('playing');
    await act(async () => {
      f.video().dispatchEvent(new f.dom.window.Event('error'));
      f.container.querySelector<HTMLButtonElement>('button[aria-label="Pause video"]')!.click();
    });
    assert.equal(f.source(), ORIGINAL); assert.deepEqual(f.plays, [MOBILE]);
    await f.emit('loadedmetadata'); await f.documentVisible(false); await f.documentVisible(true);
    assert.deepEqual(f.plays, [MOBILE]);
  } finally { await f.cleanup(); }
});

test('replacing the original resets the position and ignores an old pending play', async () => {
  const f = await mountPublicMedia(player());
  try {
    let reject!: (error: Error) => void;
    f.nextPlay(() => new Promise<void>((_resolve, fail) => { reject = fail; }));
    await f.click('Play video');
    const oldNode = f.video();
    await f.render(player('/other.mp4'));
    await act(async () => reject(new Error('Replaced source')));
    assert.notEqual(f.video(), oldNode);
    assert.equal(f.source(), '/other.mp4'); assert.equal(f.video().currentTime, 0);
    assert.equal(f.video().paused, true); assert.equal(f.plays.length, 1);
  } finally { await f.cleanup(); }
});
