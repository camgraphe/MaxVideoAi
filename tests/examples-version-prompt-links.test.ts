import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

test('version shortcuts explain their destination without repeating gallery excerpts', async () => {
  const require = createRequire(import.meta.url);
  const previous = require.extensions['.css'];
  require.extensions['.css'] = () => {};
  try {
    const { ExamplesPromptStarters } = await import('../frontend/app/(localized)/[locale]/(marketing)/examples/_components/examples-prompt-starters');
    const starters = [
      { href: '/video/wan-prime', engineLabel: 'Wan 3 Prime', current: true, prompt: 'SOURCE_EXCERPT_ALREADY_ON_CARD' },
      { href: '/video/historical-outside-page', engineLabel: 'Wan 2.6', current: false, prompt: 'SOURCE_EXCERPT_ALREADY_ON_CARD' },
    ];
    for (const locale of ['en', 'fr', 'es'] as const) {
      const dom = new JSDOM(renderToStaticMarkup(React.createElement(ExamplesPromptStarters, { locale, starters })));
      try {
        const nav = dom.window.document.querySelector('nav')!;
        assert.ok(nav, 'the compact list is navigation to a real example');
        const link = nav.querySelector('a')!;
        assert.equal(link.getAttribute('href'), '/video/wan-prime');
        assert.match(link.textContent ?? '', /Wan 3 Prime/);
        assert.match(link.getAttribute('aria-label') ?? '', /prompt/i);
        assert.equal(nav.querySelectorAll('ul').length, 2, 'recent and historical links are explicitly separated');
        assert.equal(nav.querySelectorAll('a').length, 2);
        assert.equal(nav.querySelectorAll('a')[1].getAttribute('href'), '/video/historical-outside-page');
        assert.match(nav.querySelectorAll('ul')[1].getAttribute('aria-label') ?? '', /histor|earlier|anteriores/i);
        const label = dom.window.document.getElementById(nav.getAttribute('aria-labelledby')!)?.textContent;
        assert.match(label ?? '', /video|vidéo/i);
        assert.match(label ?? '', /prompt/i);
        assert.doesNotMatch(nav.textContent ?? '', /SOURCE_EXCERPT_ALREADY_ON_CARD|22 s|16:9/);
        assert.equal(nav.querySelector('blockquote, article, img, video'), null);
      } finally { dom.window.close(); }
    }
    assert.equal(renderToStaticMarkup(React.createElement(ExamplesPromptStarters, { locale: 'fr', starters: [] })), '');
  } finally {
    if (previous) require.extensions['.css'] = previous;
    else delete require.extensions['.css'];
  }
});
