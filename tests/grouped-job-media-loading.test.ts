import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { GroupPreviewMedia } from '../frontend/components/GroupedJobCardMedia';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

test('idle history media uses a lazy optimized thumbnail without fetching the original as a video poster', () => {
  const markup = renderToStaticMarkup(React.createElement(GroupPreviewMedia, {
    preview: { id: 'history-video', videoUrl: '/video.mp4', thumbUrl: '/renders/history-thumb.jpg' },
    shouldPlay: false,
    shouldWarm: false,
  }));
  const dom = new JSDOM(markup);
  try {
    const image = dom.window.document.querySelector('img');
    const video = dom.window.document.querySelector('video');
    assert.ok(image, 'The paused card must still display a thumbnail');
    assert.equal(image.getAttribute('loading'), 'lazy');
    assert.match(image.getAttribute('src') ?? '', /^\/_next\/image\?/);
    assert.ok(video);
    assert.equal(video.getAttribute('preload'), 'none');
    assert.equal(video.getAttribute('poster'), null, 'A video poster bypasses lazy image loading and fetches the full original');
  } finally {
    dom.window.close();
  }
});
