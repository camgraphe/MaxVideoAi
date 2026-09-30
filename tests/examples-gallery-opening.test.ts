import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import type { ExampleGalleryVideo } from '../frontend/components/examples/examples-gallery-types';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const videos: ExampleGalleryVideo[] = Array.from({length:24},(_,i)=>i%4===1?'9:16':'16:9').map((aspectRatio, i) => ({
  id: `v${i}`, href: `/video/v${i}`, engineLabel: 'Example', engineIconId: 'example',
  priceLabel: null, prompt: 'A cinematic public example', aspectRatio, durationSec: 10,
  hasAudio: false, rawPosterUrl: `/test-${i}.jpg`,
  ...(i === 0 ? { recreateHref: '/app?from=v0' } : {}),
}));

async function renderGallery(prioritizeFirstPoster: boolean, openingEnabled = true) {
  const require = createRequire(import.meta.url);
  const previous = require.extensions['.css'];
  require.extensions['.css'] = () => {};
  try {
    const { default: Grid } = await import('../frontend/components/examples/ExamplesGalleryGrid.client');
    return new JSDOM(renderToStaticMarkup(React.createElement(Grid, {
      initialExamples: videos, prioritizeFirstPoster, openingEnabled, sort: 'playlist', initialOffset: 8,
      pageOffsetEnd: 16, locale: 'en',
    })));
  } finally {
    if (previous) require.extensions['.css'] = previous;
    else delete require.extensions['.css'];
  }
}

test('all24 watch links render once before hydration, with one critical poster and no eager video', async () => {
  const dom=await renderGallery(true);
  try {
    const doc=dom.window.document;
    assert.equal(doc.querySelectorAll('link[rel="preload"][as="image"]').length,0,'no competing manual hints');
    assert.equal(doc.querySelectorAll('img[fetchpriority="high"]').length,1);
    assert.equal(doc.querySelectorAll('img').length,24);
    assert.deepEqual([...doc.querySelectorAll('a[data-analytics-cta-name="view_example_details"]')].map(a=>a.getAttribute('href')),videos.map(v=>v.href));
    assert.deepEqual([...doc.querySelectorAll('a[data-analytics-cta-name="reuse_example"]')].map(a=>a.getAttribute('href')),[]);
    const opening=doc.querySelector('[data-gallery-opening]');
    const guide=opening?.querySelector('[data-gallery-guide]');
    assert.ok(guide, 'one guide explains all four cards');
    assert.equal(opening?.lastElementChild,guide, 'the guide follows all four watch cards in reading order');
    assert.match(guide.textContent ?? '', /Open any video/i);
    assert.match(guide.textContent ?? '', /Prompt/);
    assert.match(guide.textContent ?? '', /Settings/);
    assert.match(guide.textContent ?? '', /Recorded cost/);
    assert.doesNotMatch(guide.textContent ?? '', /A cinematic public example|Featured video/);
    assert.equal(guide.querySelector('a[href="/app"]')?.textContent?.trim(), 'Create in the app');
    assert.equal(doc.querySelector('video'),null);
    assert.equal(opening?.querySelectorAll('[data-frame]').length,4);
    assert.deepEqual([...doc.querySelectorAll('[data-frame]')].map(el=>el.getAttribute('data-frame')),['lead','portrait','side','side']);
    assert.ok(!doc.body.textContent?.includes('Load more'));
  }finally{dom.window.close();}
});
test('later pages keep the complete page without repeating the editorial opening',async()=>{
 const dom=await renderGallery(true,false);
 try{assert.equal(dom.window.document.querySelector('[data-gallery-opening]'),null);assert.equal(dom.window.document.querySelector('[data-gallery-guide]'),null);assert.equal(dom.window.document.querySelectorAll('img').length,24);}
 finally{dom.window.close();}
});

test('the opening posters are eager without demoting visible images behind lazy continuation', async () => {
  const dom = await renderGallery(true);
  try {
    const doc = dom.window.document;
    const openingImages = [...doc.querySelectorAll('[data-gallery-opening] img')];
    assert.equal(openingImages.length, 4);
    assert.deepEqual(openingImages.map(image => image.getAttribute('loading')), ['eager', 'eager', 'eager', 'eager']);
    assert.deepEqual(openingImages.map(image => image.getAttribute('fetchpriority')), ['high', 'auto', 'auto', 'auto']);
    const continuationImages = [...doc.querySelectorAll('img')].slice(4);
    assert.equal(continuationImages.length, 20);
    assert.ok(continuationImages.every(image => image.getAttribute('loading') === 'lazy'));
    assert.equal(doc.querySelector('video'), null, 'poster intent must not start additional videos');
  } finally { dom.window.close(); }

  const laterPage = await renderGallery(true, false);
  try {
    assert.equal(laterPage.window.document.querySelectorAll('img[loading="eager"]').length, 1);
    assert.equal(laterPage.window.document.querySelectorAll('img[loading="lazy"]').length, 23);
  } finally { laterPage.window.close(); }
});

test('opening sides and continuation portraits request their actual desktop widths', async () => {
  const dom=await renderGallery(true);
  try {
    const sideImages=[...dom.window.document.querySelectorAll('[data-frame="side"] img')];
    assert.equal(sideImages.length,2);
    for(const image of sideImages) assert.equal(image.getAttribute('sizes'),'(max-width: 767px) 58vw, 28vw');
    assert.equal(dom.window.document.querySelector('[data-frame="lead"] img')?.getAttribute('sizes'),'(max-width: 767px) 100vw, 55vw');
    const portrait=dom.window.document.querySelector('a[href="/video/v5"] img');
    assert.equal(portrait?.getAttribute('sizes'),'(max-width: 767px) 100vw, (max-width: 1024px) 25vw, 192px');
    assert.match(portrait?.getAttribute('srcset')??'', /w=256[^,]* 256w/, 'Next should offer a small desktop portrait rendition');
    assert.equal(dom.window.document.querySelector('a[href="/video/v4"] img')?.getAttribute('sizes'),'(max-width: 767px) 100vw, 33vw');
  } finally { dom.window.close(); }
});

test('the server gallery sends card summaries while full prompts stay in the on-demand detail reader', async () => {
  const require = createRequire(import.meta.url);
  const previous = require.extensions['.css'];
  require.extensions['.css'] = () => {};
  try {
    const { ExamplesGalleryGrid } = await import('../frontend/components/examples/ExamplesGalleryGrid');
    const props = {
      initialExamples: videos.map(video => ({ ...video, promptFull: 'FULL_PROMPT_LOADED_ON_OPEN ' + 'Long public prompt. '.repeat(100) })),
      sort: 'playlist' as const, initialOffset: 24, pageOffsetEnd: 24, locale: 'en',
    };
    const view = ExamplesGalleryGrid(props);
    assert.deepEqual(view.props.initialExamples, videos, 'preserve each summary, media source, watch link, identity and app handoff');
    assert.equal(view.props.sort, props.sort);
    assert.equal(view.props.initialOffset, 24);
    assert.ok(!JSON.stringify(view.props).includes('FULL_PROMPT_LOADED_ON_OPEN'), 'the unused full prompt must not enter RSC client props');
    assert.ok(props.initialExamples.every(video => video.promptFull), 'do not mutate server-owned source records');
  } finally {
    if (previous) require.extensions['.css'] = previous;
    else delete require.extensions['.css'];
  }
});
