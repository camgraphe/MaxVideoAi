import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';

test('public reader sharing copies the current canonical URL and exposes recoverable clipboard failures', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/examples?page=7' });
  const copied: string[] = [];
  let clipboardBlocked = false;
  Object.defineProperty(dom.window.navigator, 'clipboard', { value: {
    writeText: async (text: string) => {
      if (clipboardBlocked) throw new Error('Clipboard denied');
      copied.push(text);
    },
  } });
  Object.defineProperty(dom.window.document, 'execCommand', { value: () => false });
  const globals = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator, React, IS_REACT_ACT_ENVIRONMENT: true };
  const saved = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  const root = createRoot(dom.window.document.getElementById('root')!);
  try {
    const { VideoWatchShare } = await import('../frontend/app/(core)/video/[id]/_components/VideoWatchShare.client');
    const first = 'https://maxvideoai.com/video/first-approved-slug';
    const second = 'https://maxvideoai.com/video/second-approved-slug';
    await act(async () => root.render(React.createElement(VideoWatchShare, { watchUrl: first, locale: 'en' })));
    const button = dom.window.document.querySelector('button')!;
    assert.ok(button.textContent?.includes('Copy link'), 'copy must be available immediately without opening a second panel');
    const shareLinks = [...dom.window.document.querySelectorAll<HTMLAnchorElement>('a')];
    assert.equal(shareLinks.length, 2, 'social share actions are visible alongside the copy button');
    assert.equal(new URL(shareLinks[0].href).searchParams.get('url'), first);
    assert.equal(new URL(shareLinks[1].href).searchParams.get('text'), first);
    assert.ok(shareLinks.every(link => link.target === '_blank' && link.rel.includes('noopener')));
    await act(async () => button.click());
    assert.deepEqual(copied, [first], 'share the canonical watch URL, never the gallery or media URL');
    assert.ok(button.textContent?.includes('Link copied'));
    assert.equal(dom.window.document.querySelector('[role="status"]')?.textContent, 'Link copied');

    await act(async () => root.render(React.createElement(VideoWatchShare, { watchUrl: second, locale: 'fr' })));
    assert.ok(button.textContent?.includes('Copier le lien'), 'the next video must not retain the previous copied confirmation');
    assert.equal(new URL(shareLinks[0].href).searchParams.get('url'), second, 'social actions follow the current canonical URL too');
    clipboardBlocked = true;
    button.focus();
    await act(async () => button.click());
    assert.ok(dom.window.document.querySelector('[role="status"]')?.textContent?.includes('Impossible'));
    const fallback = dom.window.document.querySelector('input')!;
    assert.equal(fallback.value, second);
    assert.equal(fallback.readOnly, true);
    assert.equal(dom.window.document.activeElement, button, 'clipboard fallback must return keyboard focus to the reader action');

    clipboardBlocked = false;
    await act(async () => button.click());
    assert.deepEqual(copied, [first, second]);
    assert.ok(button.textContent?.includes('Lien copié'));
    assert.equal(dom.window.document.querySelector('input'), null, 'a successful retry removes the manual fallback');
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
