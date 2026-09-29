import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { ExampleReaderContext } from '../frontend/components/examples/ExampleReaderContext';
import type { ExampleWatchDetail } from '../frontend/lib/example-watch-detail';

const emptyContext: ExampleWatchDetail['context'] = {
  intro: 'Video description', visualContext: null, negativePrompt: null, createdAt: '',
  details: [], controls: [], highlights: [], notes: [], engineDescription: '',
  engineBadges: [], compareLinks: [], keyframes: null,
};
const detail = { engineLabel: 'Kling', title: 'Observatory', videoUrl: '/video.mp4', posterUrl: null, durationSec: 8 } as ExampleWatchDetail;
function renderContext(context: ExampleWatchDetail['context'], locale = 'en') {
  const savedReact = Object.getOwnPropertyDescriptor(globalThis, 'React');
  Object.defineProperty(globalThis, 'React', { configurable: true, writable: true, value: React });
  try { return new JSDOM(renderToStaticMarkup(React.createElement(ExampleReaderContext, { context, detail, locale }))); }
  finally {
    if (savedReact) Object.defineProperty(globalThis, 'React', savedReact);
    else Reflect.deleteProperty(globalThis, 'React');
  }
}

test('intro-only and blank context do not offer an empty disclosure or empty sections', () => {
  const dom = renderContext({ ...emptyContext, notes: [' '], highlights: [''], engineBadges: [' '],
    details: [{ key: 'duration', label: 'Duration', value: ' ' }],
    keyframes: { start: null, middle: '', end: null } });
  try {
    assert.equal(dom.window.document.querySelector('p')?.textContent, emptyContext.intro);
    assert.equal(dom.window.document.querySelector('details'), null, 'no control when there is no additional information');
    assert.equal(dom.window.document.querySelector('h3'), null);
  } finally { dom.window.close(); }
  const blank = renderContext({ ...emptyContext, intro: ' ' });
  try { assert.equal(blank.window.document.querySelector('section'), null, 'no empty section or separator'); }
  finally { blank.window.close(); }
});

test('useful context stays in the initial watch HTML and sparse records have no empty headings', () => {
  const dom = renderContext({ ...emptyContext, notes: ['Keep one camera movement.'],
    controls: [{ key: 'seed', label: 'Seed', value: '42' }],
    compareLinks: [{ href: '/compare/kling-vs-wan', label: 'Kling vs Wan', reason: '' }] }, 'fr');
  try {
    const doc = dom.window.document;
    assert.ok(doc.querySelector('details:not([open])'), 'native disclosure stays closed initially');
    assert.ok(doc.body.textContent?.includes('Keep one camera movement.'), 'editorial content is server-rendered before opening');
    assert.equal(doc.querySelector('dd')?.textContent, '42');
    assert.equal(doc.querySelector('a')?.getAttribute('href'), '/compare/kling-vs-wan');
    assert.deepEqual([...doc.querySelectorAll('h3')].map(node => node.textContent),
      ['Pour améliorer le prompt', 'Réglages du rendu original', 'Comparer ce modèle']);
    assert.equal(doc.querySelectorAll('ul:empty, dl:empty, p:empty').length, 0);
  } finally { dom.window.close(); }
});

test('opening details at the bottom reveals the content; mounting, closing and already-visible content do not scroll', async () => {
  const dom = new JSDOM('<div id="root"></div>', { pretendToBeVisual: true });
  const globals = { window: dom.window, document: dom.window.document, React, IS_REACT_ACT_ENVIRONMENT: true };
  const saved = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  const root = createRoot(dom.window.document.getElementById('root')!);
  const scrolls: ScrollIntoViewOptions[] = [];
  try {
    await act(async () => root.render(React.createElement(ExampleReaderContext, {
      detail, locale: 'en', context: { ...emptyContext, notes: ['Keep one camera movement.'] },
    })));
    const disclosure = dom.window.document.querySelector('details')!;
    const body = disclosure.lastElementChild!;
    const toggle = () => act(async () => {
      disclosure.querySelector('summary')!.click();
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    let contentTop = dom.window.innerHeight - 30;
    body.getBoundingClientRect = () => ({ top: contentTop } as DOMRect);
    disclosure.scrollIntoView = (options) => scrolls.push(options as ScrollIntoViewOptions);
    assert.equal(scrolls.length, 0, 'initial render must not move the page away from the player');
    await toggle();
    assert.ok(disclosure.open);
    assert.equal(scrolls.length, 1, 'opening near the bottom must expose the first additional content');
    assert.equal(scrolls[0].block, 'start');
    await toggle();
    assert.equal(disclosure.open, false);
    assert.equal(scrolls.length, 1, 'closing retains the reading position');
    contentTop = 180;
    await toggle();
    assert.equal(scrolls.length, 1, 'avoid moving content that is already visible');
  } finally {
    await act(async () => root.unmount()); dom.window.close();
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
