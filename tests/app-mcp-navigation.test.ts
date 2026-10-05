import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import mcpPublication from '../frontend/config/mcp-publication.json';
import { getMcpPublicationState } from '../frontend/lib/mcp-publication';
import { getAppMcpIntegrations } from '../frontend/components/app/AppAssistantConnections';

test('app MCP links disappear when public pages or public indexing are withdrawn', () => {
  const ready = { ...mcpPublication, publicMarketing: true, publicIndexing: true };
  assert.equal(getAppMcpIntegrations(getMcpPublicationState(ready)).length, 5);
  for (const withdrawn of [{ publicMarketing: false }, { publicIndexing: false }]) {
    assert.deepEqual(getAppMcpIntegrations(getMcpPublicationState({ ...ready, ...withdrawn })), []);
  }
});

test('MCP shortcuts link to every published integration and open only MCP connections on mobile', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/app/studio' });
  const globals = { window: dom.window, self: dom.window, document: dom.window.document, navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, React, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  dom.window.HTMLDialogElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new dom.window.Event('close'));
  };
  const require = createRequire(import.meta.url);
  const { createRoot } = require('../frontend/node_modules/react-dom/client');
  const root = createRoot(dom.window.document.getElementById('root')!);
  try {
    const { AppMcpShortcuts } = await import('../frontend/components/app/AppMcpShortcuts.client');
    const expected = ['claude', 'chatgpt', 'codex', 'openclaw', 'n8n'];
    for (const locale of ['en', 'fr', 'es'] as const) {
      await act(async () => root.render(React.createElement(AppMcpShortcuts, { locale })));
      const nav = dom.window.document.querySelector('nav')!;
      const prefix = locale === 'en' ? '' : `/${locale}`;
      const segment = locale === 'es' ? 'integraciones' : 'integrations';
      const verifyLinks = (container: Element) => {
        const links = [...container.querySelectorAll<HTMLAnchorElement>('a')].filter(link => link.querySelector('[data-mcp-integration-mark]'));
        assert.equal(links.length, expected.length);
        for (const [index, id] of expected.entries()) {
          const link = links[index];
          assert.equal(link.getAttribute('href'), `${prefix}/${segment}/${id}`);
          assert.equal(link.querySelector('[data-mcp-integration-mark]')?.getAttribute('data-mcp-integration-mark'), id);
          assert.ok(link.querySelector('img'), `${id} keeps its brand logo`);
          assert.ok(link.textContent?.includes(id === 'chatgpt' ? 'ChatGPT' : id === 'openclaw' ? 'OpenClaw' : id === 'claude' ? 'Claude' : id === 'codex' ? 'Codex' : 'n8n'));
          assert.equal(link.target, '_blank');
          assert.match(link.rel, /noopener/);
          assert.equal(link.getAttribute('aria-haspopup'), null);
        }
      };
      verifyLinks(nav);
      const trigger = dom.window.document.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')!;
      assert.ok(trigger);
      await act(async () => trigger.click());
      const dialog = dom.window.document.querySelector('dialog[open]')!;
      assert.ok(dialog, 'MCP has its own dialog');
      verifyLinks(dialog);
      assert.ok([...dialog.querySelectorAll('a')].every(link => /\/(integrations|integraciones)\/|\/mcp$/.test(link.getAttribute('href')!)), 'MCP does not open the general application or account menu');
      const link = dialog.querySelector<HTMLAnchorElement>('a')!;
      link.addEventListener('click', event => event.preventDefault(), { once: true });
      await act(async () => link.click());
      assert.equal(dom.window.document.querySelector('dialog[open]'), null);
      assert.equal(dom.window.document.activeElement, trigger, 'closing the MCP menu restores its own trigger');
    }
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, value] of previous) {
      if (value) Object.defineProperty(globalThis, key, value);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
