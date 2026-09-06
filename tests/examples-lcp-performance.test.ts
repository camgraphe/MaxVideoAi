import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { ExamplesHeroVideo } from '../frontend/components/examples/ExamplesHeroVideo.client';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const root = process.cwd();
const galleryCardPath = join(root, 'frontend/components/examples/ExampleGalleryCard.tsx');
const galleryClientPath = join(root, 'frontend/components/examples/ExamplesGalleryGrid.client.tsx');
const galleryGridPath = join(root, 'frontend/components/examples/ExamplesGalleryGrid.tsx');
const galleryStylesPath = join(root, 'frontend/components/examples/examples-masonry.module.css');
const examplesHeadPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/examples/head.tsx');
const examplesPageViewPath = join(
  root,
  'frontend/app/(localized)/[locale]/(marketing)/examples/_components/examples-page-view.tsx'
);
const examplesRouteSectionsPath = join(
  root,
  'frontend/app/(localized)/[locale]/(marketing)/examples/_components/examples-route-sections.tsx'
);

const readSource = (path: string) => readFileSync(path, 'utf8');

test('examples hero gives its single responsive poster high priority before hydration', () => {
  const dom = new JSDOM(renderToStaticMarkup(React.createElement(ExamplesHeroVideo, {
    src: 'https://media.maxvideoai.com/example.mp4',
    type: 'video/mp4',
    poster: '/poster.jpg',
    ariaLabel: 'Example',
  })));
  try {
    const images = dom.window.document.querySelectorAll('img');
    assert.equal(images.length, 1, 'initial markup must not introduce a second poster');
    assert.equal(images[0].getAttribute('fetchpriority'), 'high');
    assert.notEqual(images[0].getAttribute('loading'), 'lazy');
    assert.ok(images[0].getAttribute('srcset'), 'the browser still chooses a responsive image');
    assert.equal(dom.window.document.querySelector('video'), null, 'the initial poster must not require a video request');
  } finally {
    dom.window.close();
  }
});

test('examples gallery prioritizes its first poster only when no route hero is rendered', () => {
  const cardSource = readSource(galleryCardPath);
  const clientSource = readSource(galleryClientPath);
  const gridSource = readSource(galleryGridPath);
  const pageViewSource = readSource(examplesPageViewPath);
  const routeSectionsSource = readSource(examplesRouteSectionsPath);

  assert.match(pageViewSource, /const hasRouteHero = Boolean\(mainVideo && mainVideoFeature\.contentUrl\)/);
  assert.match(pageViewSource, /prioritizeFirstPoster=\{!hasRouteHero\}/);
  assert.match(routeSectionsSource, /prioritizeFirstPoster=\{prioritizeFirstPoster\}/);
  assert.match(gridSource, /prioritizeFirstPoster=\{prioritizeFirstPoster\}/);
  assert.match(clientSource, /prioritizePoster=\{prioritizeFirstPoster && video\.id === firstVisibleId\}/);
  assert.match(cardSource, /priority=\{prioritizePoster\}/);
  assert.match(cardSource, /fetchPriority=\{prioritizePoster \? 'high' : undefined\}/);
  assert.doesNotMatch(cardSource, /priority=\{isFirst\}/);
});

test('examples gallery keeps one responsive DOM tree through mobile hydration', () => {
  const clientSource = readSource(galleryClientPath);
  const stylesSource = readSource(galleryStylesPath);

  assert.doesNotMatch(clientSource, /const \[isMobile,\s*setIsMobile\]/);
  assert.doesNotMatch(clientSource, /isMobile\s*\?/);
  assert.match(clientSource, /visibleVideos\.map/);
  assert.match(stylesSource, /column-count:\s*1/);
  assert.match(stylesSource, /break-inside:\s*avoid/);
});

test('examples head leaves image selection to the route hero', () => {
  const headSource = readSource(examplesHeadPath);

  assert.match(headSource, /rel="preconnect" href="https:\/\/media\.maxvideoai\.com"/);
  assert.doesNotMatch(headSource, /listExamplesPage|buildOptimizedPosterUrl|rel="preload"|fetchPriority/);
});
