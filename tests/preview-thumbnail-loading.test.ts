import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { ModelHeroMedia } from '../frontend/components/marketing/ModelHeroMedia.client';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

test('the active workspace preview keeps its optimized cover until ready without a native poster', async () => {
  const require = createRequire(import.meta.url);
  const previousCssLoader = require.extensions['.css'];
  require.extensions['.css'] = () => {};
  let CompositePreviewDockTile;
  try {
    ({ CompositePreviewDockTile } = await import('../frontend/components/groups/CompositePreviewDockTile'));
  } finally {
    if (previousCssLoader) require.extensions['.css'] = previousCssLoader;
    else delete require.extensions['.css'];
  }
  for (const ready of [false, true]) {
    const markup = renderToStaticMarkup(React.createElement(CompositePreviewDockTile, {
      item: { id: 'take', url: '/renders/take.mp4', thumb: '/renders/take.jpg', aspect: '16:9' },
      itemKey: 'take', activeVideoKey: 'take', index: 0, tileCount: 1,
      isPlaying: true, isVideoReady: ready, isSingleLayout: true, isMuted: true, isLooping: true,
      showGroupError: false, markReady() {}, onVideoCanPlay() {}, onVideoLoadedData() {},
      registerVideo: () => () => {},
    }));
    const dom = new JSDOM(markup);
    try {
      const image = dom.window.document.querySelector('img')!;
      const video = dom.window.document.querySelector('video')!;
      assert.ok(image);
      assert.ok(video);
      assert.match(image.src, /^\/_next\/image\?/);
      assert.equal(image.classList.contains('opacity-0'), ready);
      assert.equal(video.getAttribute('poster'), null);
      assert.equal(video.getAttribute('src'), '/renders/take.mp4');
    } finally {
      dom.window.close();
    }
  }
});

test('model preview retains its cover during loading and on failure without fetching a native poster', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
  const globals = { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = new Map(Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  dom.window.HTMLMediaElement.prototype.play = async () => {};
  const container = dom.window.document.querySelector<HTMLElement>('#root')!;
  const root = createRoot(container);
  try {
    await act(async () => root.render(React.createElement(ModelHeroMedia, {
      posterSrc: '/renders/model.jpg', videoSrc: '/renders/model.mp4', alt: 'Model example', sizes: '100vw',
    })));
    assert.equal(container.querySelector('video'), null, 'Manual previews must not mount video before interaction');
    const image = container.querySelector('img')!;
    assert.match(image.src, /\/_next\/image\?/);
    await act(async () => container.querySelector<HTMLButtonElement>('button')!.click());
    const video = container.querySelector('video')!;
    assert.ok(video);
    assert.equal(video.getAttribute('poster'), null);
    assert.ok(video.classList.contains('opacity-0'), 'The optimized cover stays visible until a frame is available');
    await act(async () => video.dispatchEvent(new dom.window.Event('loadeddata')));
    assert.ok(video.classList.contains('opacity-100'), 'A loaded video must become visible');
    await act(async () => video.dispatchEvent(new dom.window.Event('error')));
    assert.ok(video.classList.contains('opacity-0'), 'A failed video must reveal its cover');
    assert.ok(container.contains(image), 'Keep the optimized image as the fallback throughout playback');
    const retry = container.querySelector<HTMLButtonElement>('button[aria-label="Retry preview"]')!;
    assert.ok(retry, 'A terminal model preview error must expose a retry');
    await act(async () => retry.click());
    assert.notEqual(container.querySelector('video'), video, 'Retry must remount the failed media resource');
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
