import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import type { ExampleWatchDetail } from '../frontend/lib/example-watch-detail';

test('reader distinguishes historical cost from each executable quote and recovers a blocked prompt copy', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/video/example', pretendToBeVisual: true });
  let blocked = false;
  const copied: string[] = [];
  Object.defineProperty(dom.window.navigator, 'clipboard', { value: { writeText: async (text: string) => {
    if (blocked) throw new Error('Clipboard denied');
    copied.push(text);
  } } });
  Object.defineProperty(dom.window.document, 'execCommand', { value: () => false });
  dom.window.HTMLMediaElement.prototype.pause = () => {};
  const globals = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator, React, IS_REACT_ACT_ENVIRONMENT: true };
  const saved = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  const settings = { durationSec: 8, resolution: '1080p', aspectRatio: '16:9', audio: true };
  const detail = {
    id: 'example', title: 'Mountain observatory video example', prompt: 'Full unabridged prompt for the mountain observatory.',
    videoUrl: 'https://media.maxvideoai.com/example.mp4', posterUrl: null, engineLabel: 'Kling',
    watchHref: '/video/example', modelHref: '/models/kling-3-turbo-pro', recreateHref: '/app?from=example',
    aspectRatio: '16:9', durationSec: 8, hasAudio: true, historicalCost: { amountCents: 139, currency: 'USD' },
    scenario: settings, quotes: [
      { engineId: 'kling-3-turbo-pro', label: 'Kling', amountCents: 146, currency: 'USD', href: '/app?recreate=first', original: true, settings, changed: [] },
      { engineId: 'ltx-2-5-fast', label: 'LTX', amountCents: 136, currency: 'USD', href: '/app?recreate=second', original: false, settings: { ...settings, resolution: '720p' }, changed: ['resolution'] },
      { engineId: 'gemini-omni-flash-1-1', label: 'Gemini', amountCents: 159, currency: 'USD', href: '/app?recreate=third', original: false, settings, changed: [] },
    ], references: [], context: { intro: 'Video description', visualContext: null, negativePrompt: null, createdAt: '', details: [], controls: [], highlights: [], notes: [], engineDescription: '', engineBadges: [], compareLinks: [], keyframes: null },
  } as ExampleWatchDetail;
  const root = createRoot(dom.window.document.getElementById('root')!);
  try {
    const { ExampleReaderContent } = await import('../frontend/components/examples/ExampleReaderContent');
    const { readerCopy } = await import('../frontend/components/examples/example-reader-copy');
    await act(async () => root.render(React.createElement(ExampleReaderContent, { detail, copy: readerCopy('en'), locale: 'en', headingLevel: 'h1' })));
    const doc = dom.window.document;
    assert.equal(doc.querySelector('h1')?.textContent, detail.title, 'the complete watch H1 survives presentation changes');
    assert.ok(doc.body.textContent?.includes('Original render cost'));
    const quotes = [...doc.querySelectorAll('article')];
    assert.equal(quotes.length, 3);
    assert.deepEqual(quotes.map(quote => quote.querySelector('a')?.getAttribute('href')), detail.quotes.map(quote => quote.href));
    assert.ok(quotes[0].textContent?.includes('$1.46') && !quotes[0].textContent?.includes('$1.39'));
    assert.ok(quotes[1].textContent?.includes('720p') && quotes[1].textContent?.includes('Adapted video settings'));
    assert.ok(quotes[0].textContent?.includes('Matches original video settings'));
    const comparison = doc.querySelector('.video-reader-comparison')!;
    assert.ok(comparison.textContent?.includes('one new video with the settings shown'));
    assert.ok(comparison.textContent?.includes('open this prompt in the app'));
    assert.ok(comparison.textContent?.includes('reference images and videos are not included'));
    assert.ok(comparison.querySelector('.video-reader-comparisonNote'), 'adaptations are explained when a proposal differs');
    assert.ok(quotes.every(quote => quote.querySelector('a')?.textContent?.includes('Use this model')));
    const copy = [...doc.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.includes('Copy prompt'));
    assert.ok(copy, 'prompt copy is an explicit control');
    await act(async () => copy.click());
    assert.deepEqual(copied, [detail.prompt]);
    blocked = true;
    copy.focus();
    await act(async () => copy.click());
    const fallback = doc.querySelector<HTMLTextAreaElement>('textarea[readonly]');
    assert.equal(fallback?.value, detail.prompt, 'the full prompt remains copyable if browser clipboard APIs fail');
    assert.equal(doc.activeElement, copy, 'clipboard fallback returns keyboard focus to the copy action');
    const matching = { ...detail, quotes: detail.quotes.map(quote => ({ ...quote, settings, changed: [] })) };
    await act(async () => root.render(React.createElement(ExampleReaderContent, { detail: matching, copy: readerCopy('en'), locale: 'en', headingLevel: 'h1' })));
    assert.equal(doc.querySelector('.video-reader-comparisonNote'), null, 'identical proposals do not display an irrelevant adaptations explanation');
    await act(async () => root.render(React.createElement(ExampleReaderContent, { detail: { ...matching, scenario: null }, copy: readerCopy('en'), locale: 'en', headingLevel: 'h1' })));
    assert.ok(doc.querySelector('.video-reader-comparisonNote')?.textContent?.includes('original settings are incomplete'));
    assert.ok([...doc.querySelectorAll('article')].every(quote => quote.textContent?.includes('Suggested video settings')), 'unknown originals must not claim matching settings');
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
