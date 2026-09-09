import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { LibraryImageThumbnail } from '../frontend/components/library/LibraryImageThumbnail.client';

test('stored signed and unknown-host thumbnails retain exact URLs, lazy loading and original fallback in both library layouts', async () => {
  const browserSource = readFileSync('frontend/components/library/AssetLibraryBrowser.tsx', 'utf8');
  assert.doesNotMatch(browserSource, /from 'next\/image'/);
  assert.match(browserSource, /<LibraryImageThumbnail asset=\{asset\}/);
  assert.match(browserSource, /asset=\{\{ \.\.\.asset, url: asset.thumbUrl \}\}/, 'video poster fallback must remain an image');
  const dom = new JSDOM('<div id="root"></div>');
  const globals = { window: dom.window, document: dom.window.document, React, IS_REACT_ACT_ENVIRONMENT: true };
  const saved = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, value });
  const root = createRoot(dom.window.document.getElementById('root')!);
  try {
    for (const thumbUrl of ['https://unknown.example/thumb.webp', 'https://private.example/thumb.webp?signature=keep%2Bexact&expires=123', 'http://localhost:3036/thumb.webp']) {
      const asset = Object.freeze({ url: 'https://private.example/original.png?signature=original', thumbUrl });
      await act(async () => root.render(React.createElement(LibraryImageThumbnail, { asset })));
      const img = dom.window.document.querySelector('img')!;
      assert.equal(img.getAttribute('src'), thumbUrl);
      assert.equal(img.getAttribute('srcset'), null);
      assert.equal(img.getAttribute('loading'), 'lazy');
      assert.equal(img.getAttribute('decoding'), 'async');
      await act(async () => img.dispatchEvent(new dom.window.Event('error')));
      assert.equal(img.getAttribute('src'), asset.url);
      assert.equal(asset.thumbUrl, thumbUrl, 'display fallback must not change selection identity');
    }
  } finally {
    await act(async () => root.unmount()); dom.window.close();
    for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  }
});
