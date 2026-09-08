import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { DEFAULT_STUDIO_COPY } from '../frontend/app/(core)/(workspace)/app/studio/_lib/studio-copy';

test('selected node commands stay in canvas screen space at low zoom and keep keyboard focus', async () => {
  const require = createRequire(import.meta.url);
  const previousCssLoader = require.extensions['.css'];
  require.extensions['.css'] = (module) => { module.exports = new Proxy({}, { get: (_, key) => key === '__esModule' ? false : key }); };
  const dom = new JSDOM('<div class="react-flow" style="position:relative"><div class="react-flow__viewport" style="transform:translate(0px,0px) scale(0.406977)"><div class="react-flow__node" id="root"></div></div></div>', { pretendToBeVisual: true });
  const globals = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, Node: dom.window.Node,
    MutationObserver: dom.window.MutationObserver, React, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  const root = createRoot(dom.window.document.getElementById('root')!);
  const rect = (x: number, y: number, width: number, height: number) => ({ x, y, left: x, top: y, right: x + width, bottom: y + height, width, height, toJSON() {} });
  let nodeX = 370;
  let nodeY = 230;
  dom.window.HTMLElement.prototype.getBoundingClientRect = function () {
    if (this.classList.contains('react-flow')) return rect(100, 80, 320, 240);
    if (this.tagName === 'ARTICLE') return rect(nodeX, nodeY, 120, 120);
    if (this.hasAttribute('data-canvas-node-actions-overlay')) return rect(100 + Number.parseFloat(this.style.left || '0'), 80 + Number.parseFloat(this.style.top || '0'), 90, 44);
    const overlay = this.closest<HTMLElement>('[data-canvas-node-actions-overlay]');
    if (this.classList.contains('nodeActionsRoot') && overlay) {
      const bounds = overlay.getBoundingClientRect();
      return rect(bounds.left + 46, bounds.top, 44, 44);
    }
    if (this.getAttribute('role') === 'menu') return rect(0, 0, 210, 154);
    return rect(0, 0, 0, 0);
  };
  for (const file of ['canvas-nodes', 'canvas-node-actions']) {
    const style = dom.window.document.createElement('style');
    style.textContent = readFileSync(new URL(`../frontend/app/(core)/(workspace)/app/studio/workspace/_styles/${file}.module.css`, import.meta.url), 'utf8');
    dom.window.document.head.append(style);
  }
  const settle = async () => act(async () => new Promise(resolve => dom.window.setTimeout(resolve, 35)));
  const key = async (element: Element, value: string) => act(async () => { element.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: value, bubbles: true })); });
  try {
    const { NodeFrame } = await import('../frontend/app/(core)/(workspace)/app/studio/workspace/_components/nodes/workspace-node-frame');
    const { CanvasNodeActionsProvider } = await import('../frontend/app/(core)/(workspace)/app/studio/workspace/_components/canvas/CanvasNodeActionsContext');
    await act(async () => root.render(React.createElement(CanvasNodeActionsProvider, {
      isSingleSelection: true, onConnections() {}, onCopyNode: async () => true, onDeleteNode() {},
      children: React.createElement(NodeFrame, { nodeId: 'shot', data: { kind: 'shot', title: 'Shot', studioCanvasCopy: DEFAULT_STUDIO_COPY.canvas }, selected: true, icon: null, children: null }),
    })));
    await settle();
    const settings = dom.window.document.querySelector<HTMLButtonElement>('[data-canvas-node-inspect-button]')!;
    const actions = dom.window.document.querySelector<HTMLButtonElement>('[data-canvas-node-actions-button]')!;
    for (const button of [settings, actions]) {
      assert.equal(button.closest('.react-flow__viewport'), null, 'zoom must not shrink selected-node commands');
      assert.ok(button.closest('.react-flow'), 'commands remain inside their canvas');
      assert.equal(dom.window.getComputedStyle(button).width, '44px');
      assert.equal(dom.window.getComputedStyle(button).height, '44px');
    }
    const overlay = actions.closest<HTMLElement>('[data-canvas-node-actions-overlay]')!;
    assert.ok(overlay.getBoundingClientRect().right <= 412, 'right-edge node controls are clamped within the canvas');
    actions.focus();
    await key(actions, 'ArrowDown');
    await settle();
    const menu = dom.window.document.querySelector<HTMLElement>('[role="menu"]')!;
    assert.ok(menu.contains(dom.window.document.activeElement));
    const items = Array.from(menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
    assert.equal(dom.window.getComputedStyle(items[0]).minHeight, '44px', 'menu items keep touch-sized targets');
    const menuRoot = menu.parentElement!.getBoundingClientRect();
    assert.ok(menuRoot.left + Number.parseFloat(menu.style.left) + 210 <= 412, 'menu fits the canvas right edge');
    assert.ok(menuRoot.top + Number.parseFloat(menu.style.top) + 154 <= 312, 'menu flips upward before crossing the canvas bottom');
    await key(items[0], 'End');
    assert.equal(dom.window.document.activeElement, items.at(-1));
    await key(items.at(-1)!, 'Escape');
    await settle();
    assert.equal(dom.window.document.activeElement, actions, 'Escape returns focus to Actions');
    assert.equal(dom.window.document.querySelector('[role="menu"]'), null);
    nodeX = 110;
    nodeY = 100;
    await act(async () => dom.window.document.querySelector<HTMLElement>('.react-flow__viewport')!.style.setProperty('transform', 'translate(10px,10px) scale(0.8)'));
    await settle();
    assert.ok(overlay.getBoundingClientRect().left < 240, 'commands follow viewport movement');
    await act(async () => actions.click());
    await settle();
    const copyItem = Array.from(dom.window.document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')).find(item => item.textContent === DEFAULT_STUDIO_COPY.canvas.nodes.copySelection)!;
    await act(async () => copyItem.click());
    await settle();
    assert.equal(dom.window.document.activeElement, actions, 'completing Copy returns focus to Actions');
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
    }
    if (previousCssLoader) require.extensions['.css'] = previousCssLoader; else delete require.extensions['.css'];
  }
});
