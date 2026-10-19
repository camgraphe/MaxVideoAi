import './helpers/server-view-styles';
import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { McpPageView } from '../frontend/app/(localized)/[locale]/(marketing)/mcp/_components/McpPageView';
import { getMcpPageCopy } from '../frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-page-copy';
import { getMcpCompatibilityEvidence } from '../frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-compatibility';
import { IntegrationPageView } from '../frontend/app/(localized)/[locale]/(marketing)/integrations/_components/IntegrationPageView';
import { getIntegrationCopy } from '../frontend/app/(localized)/[locale]/(marketing)/integrations/_lib/integration-copy';

(globalThis as typeof globalThis & { React: typeof React }).React = React;
const live = { renderPublicPage: true, connectionAvailable: true, indexable: true, showTrialClaim: false, showPaidGenerationClaim: true, showReferenceClaim: true };
const compatibility = getMcpCompatibilityEvidence();

for (const locale of ['en', 'fr', 'es'] as const) {
  test(`${locale}: hub renders three assistant-made films without eager video playback`, () => {
    const html = renderToStaticMarkup(React.createElement(McpPageView, { locale, compatibility, copy: getMcpPageCopy(locale), publication: live }));
    const dom = new JSDOM(html, { runScripts: 'dangerously' });
    const videos = [...dom.window.document.querySelectorAll('video')];
    assert.equal(videos.length, 3);
    for (const tag of videos) {
      assert.equal(tag.preload, 'none');
      assert.equal(tag.controls, true);
      assert.equal(tag.getAttribute('poster'), null);
      assert.equal(tag.hasAttribute('data-deferred-poster'), true);
      assert.equal(tag.autoplay, false);
    }
    dom.window.close();
    assert.match(html, /id="creative-examples"/);
    assert.match(html, /id="the-hat-stays"/);
    assert.match(html, /creativecommons.org\/licenses\/by\/4.0/);
    assert.match(html, /Codex/);
  });
  test(`${locale}: host pages keep local editing evidence distinct from ChatGPT and Claude validation`, () => {
    for (const client of ['codex', 'chatgpt', 'claude'] as const) {
      const html = renderToStaticMarkup(React.createElement(IntegrationPageView, { locale, compatibility: compatibility.clients[client]!, copy: getIntegrationCopy(locale, client), publication: live }));
      if (client === 'codex') assert.equal((html.match(/data-creation-film/g) ?? []).length, 3);
      else {
        assert.doesNotMatch(html, /data-creation-film/);
        assert.match(html, new RegExp(`href="${locale === 'en' ? '' : `/${locale}`}/mcp#creative-examples"`));
        assert.match(html, /data-creation-host-scope/);
      }
    }
  });
}

test('disabled paid workflow never exposes the creation examples or their host bridge', () => {
  const publication = { ...live, connectionAvailable: false, showPaidGenerationClaim: false };
  const hub = renderToStaticMarkup(React.createElement(McpPageView, { locale: 'en', compatibility, copy: getMcpPageCopy('en'), publication }));
  assert.doesNotMatch(hub, /data-creation-film|data-creation-host-scope/);
  for (const client of ['codex', 'chatgpt', 'claude'] as const) {
    const html = renderToStaticMarkup(React.createElement(IntegrationPageView, { locale: 'en', compatibility: compatibility.clients[client]!, copy: getIntegrationCopy('en', client), publication }));
    assert.doesNotMatch(html, /data-creation-film|data-creation-host-scope/);
  }
});

for (const locale of ['en', 'fr', 'es'] as const) {
 test(`${locale}: ChatGPT connection-only checkpoint is visible outside setup disclosures`, () => {
  const html = renderToStaticMarkup(React.createElement(IntegrationPageView, { locale, compatibility: compatibility.clients.chatgpt!, copy: getIntegrationCopy(locale, 'chatgpt'), publication: live }));
  assert.match(html, /data-mcp-connection-scope/);
  const scope = html.match(/<aside data-mcp-connection-scope[^>]*>([\s\S]*?)<\/aside>/)?.[1] ?? '';
  assert.match(scope, /2026-10-01|01\/10\/2026/);
  assert.doesNotMatch(scope, /<details/);
 });
}
