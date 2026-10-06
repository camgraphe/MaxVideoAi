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

test('Connect opens one localized assistant list and restores its trigger after navigation', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/app/studio' });
  const globals = { window: dom.window, self: dom.window, document: dom.window.document, navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, React, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  const require = createRequire(import.meta.url);
  const { createRoot } = require('../frontend/node_modules/react-dom/client');
  const root = createRoot(dom.window.document.getElementById('root')!);
  try {
    const { AppMcpShortcuts } = await import('../frontend/components/app/AppMcpShortcuts.client');
    const expected = ['claude', 'chatgpt', 'codex', 'openclaw', 'n8n'];
    for (const locale of ['en', 'fr', 'es'] as const) {
      await act(async () => root.render(React.createElement(AppMcpShortcuts, { locale })));
      const trigger = dom.window.document.querySelector<HTMLButtonElement>('button[aria-controls]')!;
      assert.ok(trigger, 'one disclosure trigger controls the assistant panel');
      assert.equal(trigger.textContent?.trim(), 'Connect');
      assert.equal(trigger.querySelector('img'), null, 'provider logos stay out of the header trigger');
      assert.equal(trigger.getAttribute('aria-expanded'), 'false');
      const panel = dom.window.document.getElementById(trigger.getAttribute('aria-controls')!)!;
      assert.ok(panel.hidden, 'assistant links are concealed until Connect opens');
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
      await act(async () => trigger.click());
      assert.equal(trigger.getAttribute('aria-expanded'), 'true');
      assert.equal(panel.hidden, false);
      verifyLinks(panel);
      assert.ok([...panel.querySelectorAll('a')].every(link => /\/(integrations|integraciones)\/|\/mcp$/.test(link.getAttribute('href')!)), 'Connect does not open the general application or account menu');
      const link = panel.querySelector<HTMLAnchorElement>('a')!;
      link.addEventListener('click', event => event.preventDefault(), { once: true });
      await act(async () => link.click());
      assert.ok(panel.hidden);
      assert.equal(dom.window.document.activeElement, trigger, 'choosing an assistant restores its own trigger');

      await act(async () => trigger.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })));
      assert.equal(dom.window.document.activeElement, panel.querySelector('a'), 'keyboard opening focuses the first assistant');
      await act(async () => dom.window.document.activeElement?.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
      assert.ok(panel.hidden);
      assert.equal(dom.window.document.activeElement, trigger);

      await act(async () => trigger.click());
      const outside = dom.window.document.createElement('button');
      dom.window.document.body.append(outside);
      await act(async () => outside.dispatchEvent(new dom.window.Event('pointerdown', { bubbles: true })));
      assert.ok(panel.hidden, 'outside interaction dismisses Connect');
      outside.remove();

      await act(async () => trigger.blur());
      const wrapper = trigger.parentElement!;
      const pointer = (type: string, pointerType: string, target: Element, relatedTarget: Element | null = null) => {
        const event = new dom.window.MouseEvent(type, { bubbles: true, relatedTarget });
        Object.defineProperty(event, 'pointerType', { value: pointerType });
        target.dispatchEvent(event);
      };
      await act(async () => pointer('pointerover', 'touch', wrapper));
      assert.ok(panel.hidden, 'touch movement does not open a hover menu');
      await act(async () => pointer('pointerover', 'mouse', wrapper));
      assert.equal(panel.hidden, false, 'desktop hover reveals assistants');
      assert.notEqual(dom.window.document.activeElement, link, 'hover does not steal keyboard focus');
      await act(async () => trigger.click());
      assert.equal(panel.hidden, false, 'a click after mouse entry keeps the disclosure open');
      await act(async () => trigger.click());
      assert.ok(panel.hidden, 'the next deliberate click toggles it closed');
      await act(async () => pointer('pointerover', 'mouse', wrapper));
      await act(async () => pointer('pointerout', 'mouse', trigger, panel));
      assert.equal(panel.hidden, false, 'moving into the attached panel keeps it open');
      await act(async () => {
        pointer('pointerout', 'mouse', wrapper, dom.window.document.body);
        await new Promise(resolve => setTimeout(resolve, 220));
      });
      assert.ok(panel.hidden, 'leaving the entire Connect area closes the hover panel');
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
