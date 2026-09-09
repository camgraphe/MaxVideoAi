import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { DEFAULT_STUDIO_COPY } from '../frontend/app/(core)/(workspace)/app/studio/_lib/studio-copy';
import type { CanvasFloatingToolbarProps } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_components/canvas/CanvasFloatingToolbar';

test('compact canvas dock creates real presets, selects tools, preserves history and exposes active workbench links', async () => {
  const require = createRequire(import.meta.url);
  const previousCssLoader = require.extensions['.css'];
  require.extensions['.css'] = (module) => { module.exports = new Proxy({}, { get: (_, key) => key === '__esModule' ? false : key }); };
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/app/studio/workspace', pretendToBeVisual: true });
  const globals = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, Node: dom.window.Node,
    CustomEvent: dom.window.CustomEvent, React, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  const root = createRoot(dom.window.document.getElementById('root')!);
  const style = dom.window.document.createElement('style');
  style.textContent = readFileSync(new URL('../frontend/app/(core)/(workspace)/app/studio/workspace/_styles/canvas-toolbar.module.css', import.meta.url), 'utf8');
  dom.window.document.head.append(style);
  const creations: unknown[] = [], selections: string[] = [], history: string[] = [];
  const props: CanvasFloatingToolbarProps = {
    copy: DEFAULT_STUDIO_COPY.canvas, activeCanvasName: 'My canvas', canRedo: true, canUndo: true,
    canRenameActiveCanvas: true, selectionTool: 'pointer',
    onRedo: () => history.push('redo'), onUndo: () => history.push('undo'),
    onRenameActiveCanvas() {}, onSaveActiveCanvas: () => history.push('save'), onSaveCanvasTemplate() {},
    onSelectionToolChange: tool => selections.push(tool), onCreateBlock: (kind, presetId) => creations.push([kind, presetId]),
  };
  const click = async (selector: string) => {
    const element = dom.window.document.querySelector<HTMLElement>(selector);
    assert.ok(element, `Expected reachable command ${selector}`);
    await act(async () => element.click());
  };
  const settle = async () => act(async () => new Promise(resolve => dom.window.setTimeout(resolve, 25)));
  try {
    const { CanvasFloatingToolbar } = await import('../frontend/app/(core)/(workspace)/app/studio/workspace/_components/canvas/CanvasFloatingToolbar');
    const { I18nProvider } = await import('../frontend/lib/i18n/I18nProvider');
    await act(async () => root.render(React.createElement(I18nProvider, { locale: 'en', dictionary: {} as never, fallback: {} as never,
      children: React.createElement(CanvasFloatingToolbar, props) })));
    const dock = dom.window.document.querySelector('[data-canvas-floating-toolbar]')!;
    assert.equal(dock.querySelectorAll('button').length, 5, 'closed dock must fit five reachable primary commands');
    assert.equal(dom.window.getComputedStyle(dock).height, '44px', 'dock consumes one compact 44px row');
    assert.equal(dom.window.getComputedStyle(dock).flexWrap, 'nowrap', 'the primary commands never wrap into a second row');
    await click('[aria-label="Undo canvas edit"]');
    await click('[aria-label="Redo canvas edit"]');
    await click('[data-canvas-toolbar-menu-id="selection"]');
    assert.equal(dom.window.document.querySelector('[role="menuitemradio"][aria-checked="true"]')?.textContent, 'Select canvas nodes');
    await click('[role="menuitemradio"][aria-checked="false"]');
    assert.deepEqual(selections, ['marquee']);
    await click('[data-canvas-toolbar-menu-id="add"]');
    await settle();
    const add = dom.window.document.querySelector<HTMLButtonElement>('[data-canvas-toolbar-menu-id="add"]')!;
    assert.equal(add.getAttribute('aria-expanded'), 'true');
    const menu = dom.window.document.getElementById(add.getAttribute('aria-controls')!)!;
    assert.ok(menu.contains(dom.window.document.activeElement), 'opening Add focuses its first action');
    assert.equal(menu.querySelectorAll('[role="group"]').length, 5, 'media presets and workbenches remain grouped');
    const standalone = menu.querySelector<HTMLAnchorElement>('a[href="/app/tools/storyboard"]');
    assert.ok(standalone, 'standalone workshops must open their real workspace');
    assert.equal(standalone.target, '_blank', 'opening a workbench preserves the canvas');
    const denoise = menu.querySelector<HTMLAnchorElement>('a[href="/app/tools/denoise"]');
    assert.match(denoise?.textContent ?? '', /Denoise video/);
    assert.doesNotMatch(denoise?.textContent ?? '', /Validation/);
    assert.equal(menu.querySelector('[data-canvas-toolbar-preset-id="denoise"]'), null, 'the finishing workbench stays a route instead of pretending to be a Studio node');
    await click('[data-canvas-toolbar-preset-id="generate-video"]');
    await settle();
    assert.deepEqual(creations, [['shot', 'generate-video']]);
    assert.equal(add.getAttribute('aria-expanded'), 'false');
    assert.equal(dom.window.document.activeElement, add, 'creation returns keyboard focus to Add');
    await click('[data-canvas-toolbar-menu-id="add"]');
    await click('[data-canvas-toolbar-preset-id="angle"]');
    assert.deepEqual(creations.at(-1), ['shot', 'angle']);
    await click('[data-canvas-toolbar-menu-id="add"]');
    await settle();
    await act(async () => dom.window.document.activeElement?.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'End', bubbles: true })));
    assert.equal(dom.window.document.activeElement?.tagName, 'A', 'keyboard navigation reaches standalone workbenches');
    await act(async () => dom.window.document.activeElement?.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    await settle();
    assert.equal(dom.window.document.activeElement, add);
    await click('[data-canvas-toolbar-menu-id="save"]');
    await click('[role="dialog"] button');
    assert.deepEqual(history, ['undo', 'redo', 'save']);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
    }
    if (previousCssLoader) require.extensions['.css'] = previousCssLoader; else delete require.extensions['.css'];
  }
});
