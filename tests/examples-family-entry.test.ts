import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { getExampleModelLanding } from '../frontend/lib/examples/modelLanding';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

test('FLUX entry renders one localized model link inside its existing introductory paragraph', async () => {
  const require = createRequire(import.meta.url);
  const previous = require.extensions['.css'];
  require.extensions['.css'] = () => {};
  try {
    const { ExamplesIntroHero } = await import('../frontend/app/(localized)/[locale]/(marketing)/examples/_components/examples-route-sections');
    for (const [locale, href] of [
      ['en', '/models/flux-3-max'],
      ['fr', '/fr/modeles/flux-3-max'],
      ['es', '/es/modelos/flux-3-max'],
    ] as const) {
      const landing = getExampleModelLanding(locale, 'flux')!;
      const dom = new JSDOM(renderToStaticMarkup(React.createElement(ExamplesIntroHero, {
        heroLead: '', heroTitle: landing.heroTitle, heroSubtitle: landing.heroSubtitle, heroLink: landing.heroLink,
      })));
      try {
        const document = dom.window.document;
        assert.equal(document.querySelector('h1')?.textContent, landing.heroTitle);
        assert.equal(document.querySelectorAll('p').length, 1);
        assert.equal(document.querySelectorAll('a').length, 1);
        assert.equal(document.querySelector('p > a')?.getAttribute('href'), href);
        assert.equal(document.querySelector('p > a')?.textContent, landing.heroLink?.label);
        assert.match(document.querySelector('p')?.textContent ?? '', /FLUX 3 Draft.*FLUX 3 Max/);
        assert.equal(document.querySelectorAll('section').length, 1);
        assert.equal(document.querySelector('img, video, article, nav'), null);
      } finally { dom.window.close(); }
    }
    const unlinked = renderToStaticMarkup(React.createElement(ExamplesIntroHero, {
      heroLead: 'Existing introduction', heroSubtitle: '', heroTitle: 'Other family',
    }));
    assert.match(unlinked, /Existing introduction/);
    assert.doesNotMatch(unlinked, /<a\b/);
  } finally {
    if (previous) require.extensions['.css'] = previous;
    else delete require.extensions['.css'];
  }
});
