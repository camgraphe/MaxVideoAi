import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { PublicVideoPlayer } from '../frontend/components/media/PublicVideoPlayer.client';
import { mountPublicMedia } from './helpers/public-media-dom';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const player = (src = '/film.mp4', poster = '/poster.webp', deferPoster = true) =>
  React.createElement(PublicVideoPlayer, { src, poster, deferPoster, title: 'Film' });

test('below-fold posters wait for visibility without replacing the native player or starting video', async () => {
  const f = await mountPublicMedia(player());
  try {
    const node = f.video();
    assert.equal(node.getAttribute('poster'), null);
    assert.equal(node.preload, 'none');
    assert.equal(node.controls, true);
    await f.visible(false);
    assert.equal(node.getAttribute('poster'), null);
    assert.deepEqual(f.plays, []);
    await f.visible(true);
    assert.equal(f.video(), node);
    assert.equal(node.getAttribute('poster'), '/poster.webp');
    await act(async () => { await node.play(); });
    assert.deepEqual(f.plays, ['/film.mp4']);
    await f.visible(false);
    assert.equal(node.getAttribute('poster'), '/poster.webp');
    assert.equal(node.paused, true);
  } finally { await f.cleanup(); }
});

test('a changed poster or original cannot inherit the previous visible poster state', async () => {
  const f = await mountPublicMedia(player());
  try {
    await f.visible(true);
    const first = f.video();
    await f.render(player('/film.mp4', '/second.webp'));
    assert.equal(f.video(), first);
    assert.equal(f.video().getAttribute('poster'), null);
    await f.visible(true);
    assert.equal(f.video().getAttribute('poster'), '/second.webp');
    await f.render(player('/second.mp4', '/second.webp'));
    assert.notEqual(f.video(), first);
    assert.equal(f.video().getAttribute('poster'), null);
    await f.visible(true);
    assert.equal(f.video().getAttribute('poster'), '/second.webp');
    assert.deepEqual(f.plays, []);
  } finally { await f.cleanup(); }
});

test('the deferred SSR reader has an original-poster native fallback when scripting is disabled', () => {
  const html = renderToStaticMarkup(player());
  const scripted = new JSDOM(html, { runScripts: 'dangerously' });
  const primary = scripted.window.document.querySelector('video')!;
  assert.equal(primary.getAttribute('poster'), null);
  assert.equal(scripted.window.document.querySelectorAll('video').length, 1);
  scripted.window.close();
  const plain = new JSDOM(html);
  const fallback = plain.window.document.querySelector('noscript video')!;
  assert.ok(fallback);
  assert.equal(fallback.getAttribute('src'), '/film.mp4');
  assert.equal(fallback.getAttribute('poster'), '/poster.webp');
  assert.equal(fallback.preload, 'none');
  assert.equal(fallback.controls, true);
  assert.equal(fallback.hasAttribute('playsinline'), true);
  assert.equal(fallback.hasAttribute('data-deferred-poster'), false);
  assert.equal(plain.window.getComputedStyle(plain.window.document.querySelector('video')!).display, 'none');
  assert.notEqual(plain.window.getComputedStyle(fallback).display, 'none');
  plain.window.close();
});

test('ordinary readers retain eager posters and browsers without IntersectionObserver still show the deferred poster', async () => {
  const f = await mountPublicMedia(player('/film.mp4', '/poster.webp', false));
  const observer = Object.getOwnPropertyDescriptor(globalThis, 'IntersectionObserver');
  try {
    assert.equal(f.video().getAttribute('poster'), '/poster.webp');
    assert.equal(f.container.querySelector('noscript'), null);
    Reflect.deleteProperty(globalThis, 'IntersectionObserver');
    await f.render(player());
    assert.equal(f.video().getAttribute('poster'), '/poster.webp');
    assert.deepEqual(f.plays, []);
  } finally {
    if (observer) Object.defineProperty(globalThis, 'IntersectionObserver', observer);
    await f.cleanup();
  }
});
