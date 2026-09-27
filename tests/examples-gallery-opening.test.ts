import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import type { ExampleGalleryVideo } from '../frontend/components/examples/examples-gallery-types';
import { getOpeningColumnRanges } from '../frontend/components/examples/examples-gallery-helpers';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const videos: ExampleGalleryVideo[] = ['16:9', '9:16', '16:9', '16:9', '16:9', '159:91', '159:91', '159:91'].map((aspectRatio, i) => ({
  id: `v${i}`, href: `/video/v${i}`, engineLabel: 'Example', engineIconId: 'example',
  priceLabel: null, prompt: 'A cinematic public example', aspectRatio, durationSec: 10,
  hasAudio: false, rawPosterUrl: `/test-${i}.jpg`,
}));

async function renderGallery(prioritizeFirstPoster: boolean) {
  const require = createRequire(import.meta.url);
  const previous = require.extensions['.css'];
  require.extensions['.css'] = () => {};
  try {
    const { default: Grid } = await import('../frontend/components/examples/ExamplesGalleryGrid.client');
    return new JSDOM(renderToStaticMarkup(React.createElement(Grid, {
      initialExamples: videos, prioritizeFirstPoster, sort: 'playlist', initialOffset: 8,
      pageOffsetEnd: 16, locale: 'en',
    })));
  } finally {
    if (previous) require.extensions['.css'] = previous;
    else delete require.extensions['.css'];
  }
}

test('opening gallery discovers only the two additional desktop posters before layout', async () => {
  const dom = await renderGallery(true);
  try {
    const doc = dom.window.document;
    const hints = [...doc.querySelectorAll('link[rel="preload"][as="image"]')];
    assert.equal(hints.length, 2, 'additional column leaders need responsive hints');
    for (const hint of hints) {
      assert.equal(hint.getAttribute('media'), '(min-width: 1280px)');
      assert.ok(hint.getAttribute('href'), 'React needs a concrete href to place this discovery hint in the initial head');
      assert.equal(hint.getAttribute('fetchpriority'), 'high', 'desktop leaders must avoid the low-priority wait until layout');
      assert.ok(hint.getAttribute('imagesrcset'));
      const matchingImages = [...doc.querySelectorAll('img')].filter(img => img.getAttribute('srcset') === hint.getAttribute('imagesrcset'));
      assert.equal(matchingImages.length, 1, 'hint must reuse exactly one rendered poster');
      assert.equal(matchingImages[0].getAttribute('sizes'), hint.getAttribute('imagesizes'));
    }
    assert.equal(doc.querySelectorAll('img[fetchpriority="high"]').length, 1);
    assert.equal(doc.querySelectorAll('img').length, 8, 'no duplicated desktop/mobile trees');
    assert.deepEqual([...doc.querySelectorAll('a[data-analytics-cta-name="view_example_details"]')].map(a => a.getAttribute('href')),
      ['/video/v0','/video/v1','/video/v2','/video/v3','/video/v4','/video/v5','/video/v6','/video/v7']);
    assert.equal(doc.querySelector('video'), null);
  } finally { dom.window.close(); }
});

test('opening columns preserve every item once, including short and portrait-heavy lists', () => {
  for (let count = 0; count <= 8; count += 1) {
    for (const aspectRatio of ['16:9', '9:16', '0:0', null]) {
      const list = videos.slice(0, count).map(v => ({ ...v, aspectRatio }));
      const ranges = getOpeningColumnRanges(list);
      const indexes = ranges.flatMap(([start, end]) => Array.from({ length: end - start }, (_, i) => start + i));
      assert.deepEqual(indexes, Array.from({ length: count }, (_, i) => i));
      assert.equal(ranges.length, Math.min(3, count));
      assert.ok(ranges.every(([start, end]) => end > start));
    }
  }
});

test('hero-led galleries retain lazy posters without competing opening hints', async () => {
  const dom = await renderGallery(false);
  try {
    assert.equal(dom.window.document.querySelectorAll('link[rel="preload"]').length, 0);
    assert.equal(dom.window.document.querySelectorAll('img[loading="lazy"]').length, 8);
  } finally { dom.window.close(); }
});
